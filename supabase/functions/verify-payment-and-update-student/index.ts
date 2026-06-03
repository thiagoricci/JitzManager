import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";
import Stripe from "https://esm.sh/stripe@12.3.0";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  // Handle OPTIONS request for CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Initialize Stripe and Supabase clients within the try block
    // to handle potential missing environment variables gracefully.
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") as string, {
      apiVersion: "2023-10-16",
      httpClient: Stripe.createFetchHttpClient(),
    });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Validate the request method
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: corsHeaders });
    }

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

    // Parse the request body
    const { sessionId, studentId } = await req.json();
    if (!sessionId || !studentId) {
      return new Response(JSON.stringify({ error: "Missing session ID or student ID" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Fetch student and organization to get the Stripe account ID
    const { data: studentOrg, error: studentOrgError } = await supabase
      .from("students")
      .select("organization_id, organizations!inner(stripe_account_id)")
      .eq("id", studentId)
      .single();

    if (studentOrgError || !studentOrg) {
      return new Response(
        JSON.stringify({ error: "Could not find student or linked Stripe account" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Extract stripe_account_id from the organizations object
    const orgData = studentOrg.organizations as any;
    const stripeAccountId = orgData?.stripe_account_id;
    
    if (!stripeAccountId) {
      return new Response(
        JSON.stringify({ error: "Stripe account not configured for this organization" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 2. Fetch the checkout session from Stripe using the connected account
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["line_items"],
    }, {
      stripeAccount: stripeAccountId,
    });

    if (!session) {
      return new Response(JSON.stringify({ error: "Session not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Verify payment status
    console.log(`Payment status for session ${sessionId}: ${session.payment_status}`);
    
    if (session.payment_status === "processing") {
      // Payment is still processing, this is normal for some payment methods
      return new Response(JSON.stringify({ 
        status: "processing",
        message: "Payment is still processing. Please wait a moment and try again.", 
        session_status: session.payment_status 
      }), {
        status: 202, // Accepted but not completed
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    if (session.payment_status !== "paid") {
      console.error(`Payment not successful. Status: ${session.payment_status}, Session:`, session);
      return new Response(JSON.stringify({ 
        error: "Payment was not successful", 
        message: `Payment status is ${session.payment_status}`,
        session_status: session.payment_status 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Extract relevant data from the session
    const studentIdFromSession = session.client_reference_id; // This should have been set during checkout creation
    const planId = session.metadata?.planId; // This should have been set during checkout creation

    if (!studentIdFromSession || !planId) {
      return new Response(JSON.stringify({ error: "Missing student ID or plan ID in session metadata" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Fetch student to confirm they exist and get related info if needed
    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("id, organization_id") // Only select necessary fields
      .eq("id", studentIdFromSession)
      .single();

    if (studentError || !student) {
      console.error("Error fetching student:", studentError);
      return new Response(JSON.stringify({ error: "Student not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4.5. Fetch the plan to determine if it's a trial plan
    const { data: plan, error: planError } = await supabase
      .from("membership_plans")
      .select("price, period")
      .eq("id", planId)
      .single();

    if (planError || !plan) {
      console.error("Error fetching plan:", planError);
      return new Response(JSON.stringify({ error: "Plan not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if this is a trial plan (free with a daily or weekly period)
    const isTrialPlan =
      parseFloat(plan.price) === 0 &&
      ["daily", "weekly"].includes((plan.period ?? "").toLowerCase());

    // 5. Update the student's membership_plan_id, membership_status, and save stripe_customer_id
    const { error: updateError } = await supabase
      .from("students")
      .update({
        membership_plan_id: parseInt(planId, 10),
        membership_status: "active",
        status: isTrialPlan ? "trial" : "student", // Set status based on plan type
        stripe_customer_id: session.customer as string, // Save customer ID for future payments
      })
      .eq("id", studentIdFromSession);

    if (updateError) {
      console.error("Error updating student:", updateError);
      return new Response(JSON.stringify({ error: "Failed to update student record" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 6. Create a payment record in 'payments' table
    // If amount_total is 0 but the plan has a price, the subscription is in trial
    // (future billing date) — record as scheduled with the correct plan amount.
    const chargedAmount = session.amount_total ? session.amount_total / 100 : 0;
    const planPrice = parseFloat(plan.price);
    const isScheduled = chargedAmount === 0 && planPrice > 0;
    const paymentStatus = isScheduled ? "scheduled" : "paid";
    const paymentAmount = isScheduled ? planPrice : chargedAmount;
    const paymentDate = new Date(session.created * 1000).toISOString();

    // Resolve the PaymentIntent so the payment is refundable. Scheduled charges
    // have no PaymentIntent yet — invoice.paid links it later via the webhook.
    let paymentIntentId: string | null = null;
    if (!isScheduled && session.subscription) {
      try {
        const sub = await stripe.subscriptions.retrieve(
          session.subscription as string,
          { expand: ["latest_invoice"] },
          { stripeAccount: stripeAccountId },
        );
        const latestInvoice = sub.latest_invoice as Stripe.Invoice | null;
        paymentIntentId = (latestInvoice?.payment_intent as string) || null;
      } catch (e) {
        console.error("Could not resolve PaymentIntent for checkout session:", e);
      }
    }

    if (student.organization_id && (!isScheduled || planPrice > 0)) {
      console.log(`Inserting payment for student ${studentIdFromSession} in org ${student.organization_id} — status: ${paymentStatus}`);
      const { data: paymentData, error: paymentError } = await supabase
        .from("payments")
        .insert([{
          student_id: studentIdFromSession,
          organization_id: student.organization_id,
          amount: paymentAmount,
          date: paymentDate,
          status: paymentStatus,
          stripe_payment_intent_id: paymentIntentId,
        }])
        .select();

      if (paymentError) {
        console.error("Error inserting payment record:", JSON.stringify(paymentError));
      } else {
        console.log(`Payment recorded for student: ${studentIdFromSession}`, paymentData);
      }
    } else {
      console.error(`Student ${studentIdFromSession} has no organization_id, skipping payment record.`);
    }

  return new Response(JSON.stringify({
    success: true,
    message: "Payment verified and student updated successfully.",
    studentId: studentIdFromSession, // Return the studentId to the client
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

  } catch (error) {
    console.error("Verification error:", error);
    return new Response(JSON.stringify({ error: "Internal server error during verification" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});