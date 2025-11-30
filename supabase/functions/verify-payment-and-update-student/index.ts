import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";
import Stripe from "https://esm.sh/stripe@12.3.0";
import { corsHeaders } from "../_shared/cors.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") as string, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const { sessionId } = await req.json();

  if (!sessionId) {
    return new Response(JSON.stringify({ error: "Missing session ID" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    {
      global: {
        headers: { Authorization: req.headers.get("Authorization")! },
      },
    }
  );

  try {
    // 1. Fetch the checkout session from Stripe to get payment details
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['line_items'],
    });

    if (!session) {
      return new Response(JSON.stringify({ error: "Session not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Verify payment status
    if (session.payment_status !== "paid") {
      return new Response(JSON.stringify({ error: "Payment was not successful", message: `Payment status is ${session.payment_status}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Extract relevant data from the session
    const studentId = session.client_reference_id; // This should have been set during checkout creation
    const planId = session.metadata?.planId; // This should have been set during checkout creation

    if (!studentId || !planId) {
      return new Response(JSON.stringify({ error: "Missing student ID or plan ID in session metadata" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Fetch student to confirm they exist and get related info if needed
    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("id, organization_id") // Only select necessary fields
      .eq("id", studentId)
      .single();

    if (studentError || !student) {
      console.error("Error fetching student:", studentError);
      return new Response(JSON.stringify({ error: "Student not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. Update the student's membership_plan_id, membership_status, and save stripe_customer_id
    const { error: updateError } = await supabase
      .from("students")
      .update({
        membership_plan_id: parseInt(planId, 10),
        membership_status: "active",
        status: "student", // Ensure status is 'student' when active
        stripe_customer_id: session.customer as string, // Save customer ID for future payments
      })
      .eq("id", studentId);

    if (updateError) {
      console.error("Error updating student:", updateError);
      return new Response(JSON.stringify({ error: "Failed to update student record" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 6. Optionally, create a payment record in your 'payments' table
    // This assumes you have a 'payments' table with columns like id, student_id, amount, date, stripe_session_id, etc.
    // const amount = session.amount_total; // This is in cents
    // const currency = session.currency;
    // const paymentDate = new Date(session.created * 1000).toISOString(); // Convert Unix timestamp to ISO string
    // const { error: paymentError } = await supabase
    //   .from("payments")
    //   .insert([{
    //     student_id: studentId,
    //     amount: amount ? amount / 10 : 0, // Convert cents to dollars
    //     currency: currency || 'usd',
    //     date: paymentDate,
    //     stripe_session_id: sessionId,
    //     status: session.payment_status, // e.g., 'paid'
    //   }]);
    //
    // if (paymentError) {
    //   console.error("Error inserting payment record:", paymentError);
    //   // Log the error but don't necessarily fail the main operation if payment logging fails
    // }

    return new Response(JSON.stringify({ success: true, message: "Payment verified and student updated successfully." }), {
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