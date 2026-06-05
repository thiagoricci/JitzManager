import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";
import Stripe from "https://esm.sh/stripe@12.3.0";
import { corsHeaders } from "../_shared/cors.ts";
import { recordAudit } from "../_shared/audit.ts";
import { attemptCharge } from "../_shared/charge.ts";

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

    const { succeeded: chargeSucceeded, failureReason: newFailureReason, failureCode: newFailureCode } =
      await attemptCharge(stripe, payment, student, org.stripe_account_id);

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

      await recordAudit(supabase, {
        organizationId: payment.organization_id,
        actorId: user.id,
        actorEmail: user.email,
        action: "payment.retried",
        entityType: "payment",
        entityId: payment.id,
        summary: `Retried payment #${payment.id} for ${student.name ?? "student"} ($${Number(payment.amount).toFixed(2)})`,
        details: {
          amount: Number(payment.amount),
          student_id: payment.student_id,
          retry_count: payment.retry_count + 1,
        },
      });

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
