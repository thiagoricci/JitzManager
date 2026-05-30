import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";
import Stripe from "https://esm.sh/stripe@12.3.0";
import { corsHeaders } from "../_shared/cors.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") as string, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { studentId, planId, paymentMethodId, billingStartDate } = await req.json();

    if (!studentId || !planId || !paymentMethodId) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Verify the user token
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      console.error("Auth error:", userError);
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Fetch student
    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("name, email, stripe_customer_id, organization_id")
      .eq("id", studentId)
      .single();

    if (studentError || !student) {
      return new Response(JSON.stringify({ error: "Student not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!student.stripe_customer_id) {
      return new Response(
        JSON.stringify({ error: "Student has no Stripe customer ID" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Fetch plan
    const { data: plan, error: planError } = await supabase
      .from("membership_plans")
      .select("name, price, period, stripe_product_id, stripe_price_id")
      .eq("id", planId)
      .single();

    if (planError || !plan) {
      return new Response(JSON.stringify({ error: "Plan not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the organization's Stripe account ID for Connect mode
    let stripeAccountId: string | null = null;
    if (student.organization_id) {
      const { data: organization } = await supabase
        .from("organizations")
        .select("stripe_account_id")
        .eq("id", student.organization_id)
        .single();
      
      stripeAccountId = organization?.stripe_account_id || null;
    }

    if (!stripeAccountId) {
      return new Response(
        JSON.stringify({ error: "Stripe account not configured for this organization" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Build Stripe options for connected account
    const stripeOptions = { stripeAccount: stripeAccountId };

    // Set the default payment method for the customer
    console.log(`Setting default payment method ${paymentMethodId} for customer ${student.stripe_customer_id}`);
    await stripe.customers.update(
      student.stripe_customer_id,
      {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      },
      stripeOptions
    );

    // Resolve the Stripe price ID — use the pre-created one if available
    console.log(`Creating subscription for student ${studentId} for plan ${planId}`);

    let priceId: string;

    if (plan.stripe_price_id) {
      priceId = plan.stripe_price_id;
    } else {
      // Fallback: create product + price on the fly for plans without Stripe IDs
      const productName = `Membership: ${plan.name}`;
      const existingProducts = await stripe.products.search({
        query: `name:'${productName}'`,
      }, stripeOptions);

      const product = existingProducts.data.length > 0
        ? existingProducts.data[0]
        : await stripe.products.create({
            name: productName,
            metadata: { planId: planId.toString() },
          }, stripeOptions);

      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: Math.round(parseFloat(plan.price) * 100),
        currency: "usd",
        recurring: { interval: "month" },
        metadata: { planId: planId.toString() },
      }, stripeOptions);

      priceId = price.id;
    }

    // Create the subscription with the price
    const subscriptionParams: Stripe.SubscriptionCreateParams = {
      customer: student.stripe_customer_id,
      items: [{ price: priceId }],
      default_payment_method: paymentMethodId,
      metadata: {
        studentId: studentId.toString(),
        planId: planId.toString(),
        organizationId: student.organization_id,
      },
      expand: ["latest_invoice.payment_intent"],
    };

    // Delay first billing if a future start date was requested
    if (billingStartDate) {
      const startTs = Math.floor(new Date(billingStartDate).getTime() / 1000);
      const tomorrowTs = Math.floor(Date.now() / 1000) + 86400;
      if (startTs > tomorrowTs) {
        subscriptionParams.trial_end = startTs;
      }
    }

    const subscription = await stripe.subscriptions.create(subscriptionParams, stripeOptions);

    // Check if the subscription was created successfully
    const invoice = subscription.latest_invoice as Stripe.Invoice;
    const paymentIntent = invoice?.payment_intent as Stripe.PaymentIntent;
    
    if (subscription.status === "active" || subscription.status === "trialing" ||
        (paymentIntent && paymentIntent.status === "succeeded")) {
      // Check if this is a trial plan (free with Daily or Weekly period)
      const isTrialPlan = 
        (plan.price === "0" || plan.price === "0.00") &&
        ["Daily", "Weekly"].includes(plan.period);
      
      // Update student status and save subscription/billing info
      const studentUpdates: Record<string, unknown> = {
        membership_status: "active",
        status: isTrialPlan ? "trial" : "student",
        membership_plan_id: parseInt(planId),
        subscription_id: subscription.id,
      };
      if (billingStartDate) {
        studentUpdates.billing_start_date = billingStartDate;
      }
      const { error: updateError } = await supabase
        .from("students")
        .update(studentUpdates)
        .eq("id", studentId);

      if (updateError) {
        console.error("Error updating student status:", updateError);
        // We still return success because payment succeeded, but log the error
      }

      // Record payment
      if (student.organization_id) {
        console.log(`Attempting to insert payment for student ${studentId} in org ${student.organization_id}`);
        const { data: paymentData, error: paymentError } = await supabase
          .from("payments")
          .insert({
            student_id: parseInt(studentId.toString()),
            organization_id: student.organization_id,
            amount: parseFloat(plan.price),
            date: new Date().toISOString(),
            status: 'paid'
          })
          .select();

        if (paymentError) {
          console.error("Error recording payment:", JSON.stringify(paymentError));
        } else {
          console.log(`Payment recorded for student: ${studentId}`, paymentData);
        }
      } else {
        console.error(`Student ${studentId} has no organization_id, skipping payment record.`);
      }

      return new Response(JSON.stringify({
        success: true,
        subscriptionId: subscription.id,
        subscriptionStatus: subscription.status,
        studentId: studentId
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      // Subscription creation failed or requires action
      const errorStatus = paymentIntent?.status || subscription.status;
      const failureReason = paymentIntent?.last_payment_error?.message || "Subscription creation failed";

      if (student.organization_id) {
        const { error: paymentError } = await supabase
          .from("payments")
          .insert({
            student_id: parseInt(studentId.toString()),
            organization_id: student.organization_id,
            amount: parseFloat(plan.price),
            date: new Date().toISOString(),
            status: "failed",
            failure_reason: failureReason,
            stripe_invoice_id: invoice?.id ?? null,
          });

        if (paymentError) {
          console.error("Error recording failed payment:", JSON.stringify(paymentError));
        } else {
          console.log(`Failed payment recorded for student: ${studentId}`);
        }
      }

      return new Response(
        JSON.stringify({
          error: "Subscription creation failed or requires action",
          status: errorStatus,
          clientSecret: paymentIntent?.client_secret
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

  } catch (error) {
    console.error("Error processing charge:", error);
    let errorMessage = "Internal Server Error";
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    // Handle Stripe errors specifically if possible
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});