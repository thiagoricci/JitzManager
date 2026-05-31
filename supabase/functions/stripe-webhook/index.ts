import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";
import Stripe from "https://esm.sh/stripe@12.3.0";
import { provisionSelfSignup } from "../_shared/provision-signup.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") as string, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const signature = req.headers.get("Stripe-Signature");
    const body = await req.text();
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SIGNING_SECRET");

    if (!signature || !webhookSecret) {
      console.error("Missing Stripe signature or webhook secret.");
      return new Response("Webhook Error: Missing signature or secret", { status: 400 });
    }

    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(
        body,
        signature,
        webhookSecret,
        undefined,
        Stripe.createSubtleCryptoProvider()
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : JSON.stringify(err);
      console.error(`Webhook signature verification failed: ${message}`);
      return new Response(`Webhook Error: ${message}`, { status: 400 });
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      let { studentId, planId, organizationId, sessionType } = session.metadata || {};

      // Payment Links don't reliably copy their metadata onto the resulting
      // Checkout Session. For self-signup links we set subscription_data.metadata,
      // so recover it from the subscription when the session lacks it.
      if (!sessionType && session.payment_link && session.subscription) {
        try {
          const connectedAccountId = event.account;
          const sub = await stripe.subscriptions.retrieve(
            session.subscription as string,
            connectedAccountId ? { stripeAccount: connectedAccountId } : {}
          );
          sessionType = sub.metadata?.sessionType ?? sessionType;
          planId = sub.metadata?.planId ?? planId;
          organizationId = sub.metadata?.organizationId ?? organizationId;
          studentId = sub.metadata?.studentId ?? studentId;
        } catch (metaErr) {
          console.error("Error recovering metadata from subscription:", metaErr);
        }
      }

      console.log("Checkout session completed:", {
        mode: session.mode,
        sessionType,
        studentId,
        planId,
        organizationId,
        fromPaymentLink: !!session.payment_link,
      });

      // Handle Platform Subscription
      if (sessionType === "platform_subscription") {
        console.log("=== PROCESSING PLATFORM SUBSCRIPTION ===");
        if (!organizationId) {
          console.error("Missing organizationId in platform subscription metadata");
          return new Response("Error: Missing organizationId", { status: 400 });
        }

        const subscriptionId = session.subscription as string;
        const customerId = session.customer as string;

        // Upsert into platform_subscriptions
        const { error } = await supabaseAdmin
          .from("platform_subscriptions")
          .upsert({
            organization_id: organizationId,
            stripe_subscription_id: subscriptionId,
            stripe_customer_id: customerId,
            status: "active",
            current_period_start: new Date().toISOString(), // Approximate, webhook will update
            current_period_end: new Date().toISOString(), // Approximate
            plan_id: "standard", // Hardcoded for now
          }, { onConflict: "organization_id" });

        if (error) {
          console.error("Error updating platform_subscriptions:", error);
          return new Response(`Database Error: ${error.message}`, { status: 500 });
        }

        console.log(`Successfully activated platform subscription for org: ${organizationId}`);
        return new Response(JSON.stringify({ received: true, type: "platform_subscription" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Handle STUDENT SELF-SIGNUP via a shared Payment Link (backup path —
      // the /enroll-success redirect provisions this synchronously too, and the
      // shared helper is idempotent on subscription_id so they don't collide).
      if (sessionType === "student_self_signup") {
        console.log("=== PROCESSING STUDENT SELF-SIGNUP ===");

        if (!planId || !organizationId) {
          console.error("Missing planId/organizationId in self-signup session metadata");
          return new Response("Error: Missing metadata in self-signup session", { status: 400 });
        }

        const result = await provisionSelfSignup(stripe, supabaseAdmin, {
          organizationId,
          planId,
          connectedAccountId: event.account,
          customerId: (session.customer as string) ?? null,
          subscriptionId: (session.subscription as string) ?? null,
          amountTotal: session.amount_total ?? null,
          name: session.customer_details?.name ?? null,
          email: session.customer_details?.email ?? null,
          phone: session.customer_details?.phone ?? null,
        });

        console.log(`Successfully processed self-signup for student: ${result.studentId} (already=${result.alreadyProvisioned})`);
        return new Response(JSON.stringify({ received: true, type: "student_self_signup" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Handle SETUP sessions (adding payment method only, no charge)
      if (session.mode === "setup") {
        console.log("=== PROCESSING SETUP SESSION (Payment Method Only) ===");
        
        if (!studentId) {
          console.error("Missing studentId in setup session metadata");
          return new Response("Error: Missing studentId in setup session", { status: 400 });
        }

        // Get the SetupIntent to retrieve the payment method
        const setupIntentId = session.setup_intent as string;
        if (!setupIntentId) {
          console.error("No setup_intent found in session");
          return new Response("Error: No setup_intent in session", { status: 400 });
        }

        // Retrieve the SetupIntent to get the payment method
        // Note: For connected accounts, we need to use the stripeAccount header
        const connectedAccountId = event.account;
        console.log("Connected account ID:", connectedAccountId);

        let setupIntent: Stripe.SetupIntent;
        if (connectedAccountId) {
          setupIntent = await stripe.setupIntents.retrieve(setupIntentId, {
            stripeAccount: connectedAccountId,
          });
        } else {
          setupIntent = await stripe.setupIntents.retrieve(setupIntentId);
        }

        const paymentMethodId = setupIntent.payment_method as string;
        console.log("Payment method from SetupIntent:", paymentMethodId);

        if (paymentMethodId && session.customer) {
          // Set the payment method as the default for the customer
          const customerId = session.customer as string;
          console.log(`Setting payment method ${paymentMethodId} as default for customer ${customerId}`);
          
          try {
            if (connectedAccountId) {
              await stripe.customers.update(customerId, {
                invoice_settings: {
                  default_payment_method: paymentMethodId,
                },
              }, {
                stripeAccount: connectedAccountId,
              });
            } else {
              await stripe.customers.update(customerId, {
                invoice_settings: {
                  default_payment_method: paymentMethodId,
                },
              });
            }
            console.log("Successfully set default payment method for customer");
          } catch (updateError) {
            console.error("Error setting default payment method:", updateError);
            // Don't fail the webhook, the payment method is still attached
          }
        }

        console.log(`Successfully processed setup session for student: ${studentId}`);
        return new Response(JSON.stringify({ received: true, type: "setup" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Handle PAYMENT/SUBSCRIPTION sessions
      if (!studentId || !planId) {
        console.error("Missing metadata in checkout session:", session.metadata);
        return new Response("Error: Missing metadata in session", { status: 400 });
      }

      console.log(`Processing successful payment for student: ${studentId}`);

      // Fetch the plan to determine if it's a trial plan
      const { data: plan, error: planError } = await supabaseAdmin
        .from("membership_plans")
        .select("price, period")
        .eq("id", planId)
        .single();

      if (planError || !plan) {
        console.error("Error fetching plan:", planError);
        return new Response(`Database Error: Plan not found`, { status: 404 });
      }

      // Check if this is a trial plan (free with Daily or Weekly period)
      const isTrialPlan =
        (plan.price === "0" || plan.price === "0.00") &&
        ["Daily", "Weekly"].includes(plan.period);

      const { error } = await supabaseAdmin
        .from("students")
        .update({
          membership_status: "active",
          status: isTrialPlan ? "trial" : "student",
          membership_plan_id: parseInt(planId),
        })
        .eq("id", studentId);

      if (error) {
        console.error("Error updating student record:", error);
        return new Response(`Database Error: ${error.message}`, { status: 500 });
      }

      // Record payment — if amount_total is 0 but plan has a price, the subscription
      // is in trial (future billing date), so record as scheduled instead of paid.
      if (organizationId) {
        const planPrice = parseFloat(plan.price);
        const chargedAmount = session.amount_total ? session.amount_total / 100 : 0;
        const isScheduled = chargedAmount === 0 && planPrice > 0;

        if (!isScheduled || planPrice > 0) {
          const paymentStatus = isScheduled ? "scheduled" : "paid";
          const paymentAmount = isScheduled ? planPrice : chargedAmount;

          console.log(`Inserting payment for student ${studentId} in org ${organizationId} — status: ${paymentStatus}`);
          const { data: paymentData, error: paymentError } = await supabaseAdmin
            .from("payments")
            .insert({
              student_id: parseInt(studentId.toString()),
              organization_id: organizationId,
              amount: paymentAmount,
              date: new Date().toISOString(),
              status: paymentStatus,
            })
            .select();

          if (paymentError) {
            console.error("Error recording payment:", JSON.stringify(paymentError));
          } else {
            console.log(`Payment recorded for student: ${studentId}`, paymentData);
          }
        }
      } else {
        console.warn(`Missing organizationId in metadata for student: ${studentId}, skipping payment record.`);
      }

      console.log(`Successfully activated membership for student: ${studentId}`);
    } else if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      const { organizationId } = subscription.metadata || {};

      // Only process if it's a platform subscription (has organizationId metadata)
      if (organizationId) {
        console.log(`Processing subscription update for org: ${organizationId}, status: ${subscription.status}`);
        
        const { error } = await supabaseAdmin
          .from("platform_subscriptions")
          .update({
            status: subscription.status,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            cancel_at_period_end: subscription.cancel_at_period_end,
          })
          .eq("stripe_subscription_id", subscription.id);

        if (error) {
          console.error("Error updating platform subscription status:", error);
          return new Response(`Database Error: ${error.message}`, { status: 500 });
        }
        console.log("Platform subscription updated successfully");
      }
    } else if (event.type === "invoice.paid") {
      const invoice = event.data.object as Stripe.Invoice;
      console.log("=== PROCESSING INVOICE PAID ===", { billing_reason: invoice.billing_reason, amount_paid: invoice.amount_paid });

      // Only handle recurring charges (subscription_cycle covers both scheduled trial-end charges and monthly renewals).
      // subscription_create payments are already recorded by checkout.session.completed or charge-student directly.
      if (invoice.billing_reason !== "subscription_cycle") {
        console.log("Skipping invoice.paid with billing_reason:", invoice.billing_reason);
      } else {
        const subscriptionId = invoice.subscription as string;
        if (!subscriptionId) {
          console.log("No subscription on invoice, skipping");
        } else {
          const connectedAccountId = event.account;
          const stripeOptions = connectedAccountId ? { stripeAccount: connectedAccountId } : {};

          const subscription = await stripe.subscriptions.retrieve(subscriptionId, stripeOptions);
          const { studentId, organizationId } = subscription.metadata || {};

          if (!studentId || !organizationId) {
            console.log("No studentId/organizationId in subscription metadata, skipping (likely a platform subscription)");
          } else {
            const amount = invoice.amount_paid ? invoice.amount_paid / 100 : 0;

            if (amount > 0) {
              // Promote a scheduled record to paid if one exists, otherwise insert fresh
              const { data: scheduledPayment } = await supabaseAdmin
                .from("payments")
                .select("id")
                .eq("student_id", parseInt(studentId))
                .eq("organization_id", organizationId)
                .eq("status", "scheduled")
                .maybeSingle();

              if (scheduledPayment) {
                const { error: updateError } = await supabaseAdmin
                  .from("payments")
                  .update({ status: "paid", date: new Date().toISOString(), stripe_invoice_id: invoice.id })
                  .eq("id", scheduledPayment.id);
                if (updateError) {
                  console.error("Error promoting scheduled payment to paid:", updateError);
                } else {
                  console.log(`Scheduled payment promoted to paid for student: ${studentId}`);
                }
              } else {
                const { error: paymentError } = await supabaseAdmin.from("payments").insert({
                  student_id: parseInt(studentId),
                  organization_id: organizationId,
                  amount,
                  date: new Date().toISOString(),
                  status: "paid",
                  stripe_invoice_id: invoice.id,
                });

                if (paymentError) {
                  console.error("Error recording invoice.paid payment:", paymentError);
                } else {
                  console.log(`Recurring payment recorded for student: ${studentId}, amount: ${amount}`);
                }
              }

              // Ensure student is active (catches the scheduled start date case)
              await supabaseAdmin.from("students").update({
                membership_status: "active",
                status: "student",
              }).eq("id", parseInt(studentId));
            }
          }
        }
      }
    } else if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice;
      console.log("=== PROCESSING INVOICE PAYMENT FAILED ===");

      const subscriptionId = invoice.subscription as string;
      if (!subscriptionId) {
        console.log("No subscription ID on invoice, skipping failed payment record");
      } else {
        const connectedAccountId = event.account;
        let stripeOptions: { stripeAccount?: string } = {};
        if (connectedAccountId) {
          stripeOptions = { stripeAccount: connectedAccountId };
        }

        const subscription = await stripe.subscriptions.retrieve(
          subscriptionId,
          stripeOptions
        );
        const { studentId, planId, organizationId } = subscription.metadata || {};

        if (!studentId || !organizationId) {
          console.error("Missing studentId or organizationId in subscription metadata:", subscription.metadata);
        } else {
          const amount = invoice.amount_due ? invoice.amount_due / 100 : 0;

          let failureReason = "Payment failed";
          let failureCode: string | null = null;

          // Retrieve the charge to get the exact Stripe decline code
          const chargeId = invoice.charge as string;
          if (chargeId) {
            try {
              const charge = await stripe.charges.retrieve(chargeId, stripeOptions);
              failureCode = charge.failure_code ?? null;
              failureReason = charge.failure_message || failureReason;
            } catch (e) {
              console.error("Error retrieving charge for decline code:", e);
            }
          }
          if (failureReason === "Payment failed" && invoice.last_finalization_error?.message) {
            failureReason = invoice.last_finalization_error.message;
          }

          console.log(`Recording failed payment for student: ${studentId}, amount: ${amount}, reason: ${failureReason}, code: ${failureCode}`);

          const { data: paymentData, error: paymentError } = await supabaseAdmin
            .from("payments")
            .insert({
              student_id: parseInt(studentId.toString()),
              organization_id: organizationId,
              amount: amount,
              date: new Date().toISOString(),
              status: "failed",
              failure_reason: failureReason,
              failure_code: failureCode,
              stripe_invoice_id: invoice.id,
            })
            .select();

          if (paymentError) {
            console.error("Error recording failed payment:", JSON.stringify(paymentError));
          } else {
            console.log(`Failed payment recorded for student: ${studentId}`, paymentData);
          }
        }
      }
    } else if (event.type === "account.updated") {
      // Fires when a connected Express account completes (or updates) Stripe onboarding.
      const account = event.data.object as Stripe.Account;
      console.log(`account.updated for ${account.id}, charges_enabled=${account.charges_enabled}`);

      const { error } = await supabaseAdmin
        .from("organizations")
        .update({ stripe_charges_enabled: account.charges_enabled })
        .eq("stripe_account_id", account.id);

      if (error) {
        console.error("Error updating stripe_charges_enabled:", error);
      }
    } else if (event.type === "payment_intent.payment_failed") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      console.log("=== PROCESSING PAYMENT INTENT FAILED ===");

      const { studentId, organizationId } = paymentIntent.metadata || {};

      if (!studentId || !organizationId) {
        console.log("No studentId/organizationId in payment_intent metadata, skipping");
      } else {
        const amount = paymentIntent.amount ? paymentIntent.amount / 100 : 0;
        const failureReason = paymentIntent.last_payment_error?.message || "Payment failed";

        console.log(`Recording failed payment intent for student: ${studentId}, amount: ${amount}, reason: ${failureReason}`);

        const { data: paymentData, error: paymentError } = await supabaseAdmin
          .from("payments")
          .insert({
            student_id: parseInt(studentId.toString()),
            organization_id: organizationId,
            amount: amount,
            date: new Date().toISOString(),
            status: "failed",
            failure_reason: failureReason,
          })
          .select();

        if (paymentError) {
          console.error("Error recording failed payment intent:", JSON.stringify(paymentError));
        } else {
          console.log(`Failed payment intent recorded for student: ${studentId}`, paymentData);
        }
      }
    } else {
      console.log(`Received unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook handler error:", error);
    const errorMessage =
      error instanceof Error ? error.message : JSON.stringify(error);
    return new Response(
      JSON.stringify({
        error: "Internal Server Error",
        details: errorMessage,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});