import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";
import Stripe from "https://esm.sh/stripe@12.3.0";
import { corsHeaders } from "../_shared/cors.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") as string, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const MAX_RETRIES = 5;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { paymentId } = await req.json();
    if (!paymentId) {
      return new Response(JSON.stringify({ error: "Missing paymentId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch the failed payment with student info
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .select("*, students(name, stripe_customer_id, subscription_id, membership_plan_id)")
      .eq("id", paymentId)
      .eq("status", "failed")
      .single();

    if (paymentError || !payment) {
      return new Response(JSON.stringify({ error: "Failed payment not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (payment.retry_count >= MAX_RETRIES) {
      return new Response(
        JSON.stringify({ error: `Maximum retries (${MAX_RETRIES}) reached` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const student = payment.students;
    if (!student?.stripe_customer_id) {
      return new Response(JSON.stringify({ error: "Student has no payment method on file" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get organization Stripe account
    const { data: org } = await supabase
      .from("organizations")
      .select("stripe_account_id")
      .eq("id", payment.organization_id)
      .single();

    if (!org?.stripe_account_id) {
      return new Response(JSON.stringify({ error: "Stripe not configured for this organization" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripeOptions = { stripeAccount: org.stripe_account_id };
    let chargeSucceeded = false;
    let newFailureReason = "Payment failed";
    let newFailureCode: string | null = null;

    // Attempt 1: pay the specific invoice we stored
    const invoiceId = payment.stripe_invoice_id;
    if (invoiceId) {
      try {
        const paid = await stripe.invoices.pay(invoiceId, { forgive: true }, stripeOptions);
        chargeSucceeded = paid.status === "paid";
        if (!chargeSucceeded) {
          const chargeId = paid.charge as string;
          if (chargeId) {
            const charge = await stripe.charges.retrieve(chargeId, {}, stripeOptions);
            newFailureCode = charge.failure_code ?? null;
            newFailureReason = charge.failure_message || newFailureReason;
          }
        }
      } catch (err: any) {
        console.error("Invoice pay error:", err);
        newFailureReason = err?.message || newFailureReason;
        newFailureCode = err?.raw?.decline_code || err?.raw?.code || null;
      }
    }

    // Attempt 2: if no stored invoice but subscription exists, pay its latest open invoice
    if (!chargeSucceeded && !invoiceId && student.subscription_id) {
      try {
        const sub = await stripe.subscriptions.retrieve(student.subscription_id, stripeOptions);
        const latestInvoiceId = sub.latest_invoice as string;
        if (latestInvoiceId) {
          const paid = await stripe.invoices.pay(latestInvoiceId, { forgive: true }, stripeOptions);
          chargeSucceeded = paid.status === "paid";
          if (!chargeSucceeded) {
            const chargeId = paid.charge as string;
            if (chargeId) {
              const charge = await stripe.charges.retrieve(chargeId, {}, stripeOptions);
              newFailureCode = charge.failure_code ?? null;
              newFailureReason = charge.failure_message || newFailureReason;
            }
          }
        }
      } catch (err: any) {
        console.error("Subscription invoice pay error:", err);
        newFailureReason = err?.message || newFailureReason;
        newFailureCode = err?.raw?.decline_code || err?.raw?.code || null;
      }
    }

    // Attempt 3: fall back to a direct PaymentIntent with saved default card
    if (!chargeSucceeded && !invoiceId && !student.subscription_id) {
      try {
        const customer = await stripe.customers.retrieve(
          student.stripe_customer_id,
          {},
          stripeOptions
        ) as Stripe.Customer;

        const defaultPmId = customer.invoice_settings?.default_payment_method as string | null;
        if (!defaultPmId) {
          return new Response(JSON.stringify({ error: "No default payment method on file" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const pi = await stripe.paymentIntents.create({
          amount: Math.round(payment.amount * 100),
          currency: "usd",
          customer: student.stripe_customer_id,
          payment_method: defaultPmId,
          confirm: true,
          off_session: true,
          metadata: {
            studentId: payment.student_id.toString(),
            organizationId: payment.organization_id,
          },
        }, stripeOptions);

        chargeSucceeded = pi.status === "succeeded";
        if (!chargeSucceeded) {
          newFailureCode = pi.last_payment_error?.code ?? null;
          newFailureReason = pi.last_payment_error?.message || newFailureReason;
        }
      } catch (err: any) {
        console.error("PaymentIntent error:", err);
        newFailureReason = err?.message || newFailureReason;
        newFailureCode = err?.raw?.decline_code || err?.raw?.code || null;
      }
    }

    if (chargeSucceeded) {
      await supabase.from("payments").update({
        status: "paid",
        failure_reason: null,
        failure_code: null,
        retry_count: payment.retry_count + 1,
        next_retry_at: null,
      }).eq("id", paymentId);

      await supabase.from("students").update({
        membership_status: "active",
        status: "student",
      }).eq("id", payment.student_id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const newRetryCount = payment.retry_count + 1;
    await supabase.from("payments").update({
      retry_count: newRetryCount,
      failure_reason: newFailureReason,
      failure_code: newFailureCode,
      next_retry_at: newRetryCount < MAX_RETRIES
        ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        : null,
    }).eq("id", paymentId);

    return new Response(
      JSON.stringify({
        error: newFailureReason,
        failure_code: newFailureCode,
        retry_count: newRetryCount,
        max_retries: MAX_RETRIES,
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Retry payment error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
