import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";
import Stripe from "https://esm.sh/stripe@12.3.0";
import { corsHeaders } from "../_shared/cors.ts";
import { recordAudit } from "../_shared/audit.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") as string, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

// Stripe only accepts these enum values for `reason`; the staff's free-text
// explanation is preserved separately in metadata and in our payments table.
function mapReason(reason?: string): Stripe.RefundCreateParams.Reason | undefined {
  switch (reason) {
    case "duplicate":
      return "duplicate";
    case "fraudulent":
      return "fraudulent";
    case "requested_by_customer":
      return "requested_by_customer";
    default:
      return "requested_by_customer";
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // `amount` is optional — omit for a full refund, provide (in dollars) for partial.
    // `reasonCode` maps to a Stripe enum; `reasonNote` is the staff's free-text reason.
    const { paymentId, amount, reasonCode, reasonNote } = await req.json();

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

    // Resolve the caller's organization to enforce tenant isolation.
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (!profile?.organization_id) {
      return new Response(JSON.stringify({ error: "No organization for user" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch the payment and verify it belongs to the caller's organization.
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .select("id, organization_id, amount, refunded_amount, status, stripe_payment_intent_id")
      .eq("id", paymentId)
      .single();

    if (paymentError || !payment) {
      return new Response(JSON.stringify({ error: "Payment not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (payment.organization_id !== profile.organization_id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (payment.status !== "paid" && payment.status !== "partially_refunded") {
      return new Response(
        JSON.stringify({ error: `Only paid payments can be refunded (current status: ${payment.status}).` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!payment.stripe_payment_intent_id) {
      return new Response(
        JSON.stringify({ error: "This payment has no linked Stripe charge and cannot be refunded automatically. Refund it from the Stripe dashboard." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine how much is still refundable.
    const totalAmount = Number(payment.amount);
    const alreadyRefunded = Number(payment.refunded_amount ?? 0);
    const remaining = Math.round((totalAmount - alreadyRefunded) * 100) / 100;

    if (remaining <= 0) {
      return new Response(JSON.stringify({ error: "This payment is already fully refunded." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const refundDollars = amount != null ? Number(amount) : remaining;
    if (!(refundDollars > 0) || refundDollars > remaining + 0.0001) {
      return new Response(
        JSON.stringify({ error: `Refund amount must be between $0.01 and $${remaining.toFixed(2)}.` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the org's connected account so the refund executes on the right account.
    const { data: organization } = await supabase
      .from("organizations")
      .select("stripe_account_id")
      .eq("id", payment.organization_id)
      .single();

    if (!organization?.stripe_account_id) {
      return new Response(JSON.stringify({ error: "Stripe account not configured for this organization" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripeOptions = { stripeAccount: organization.stripe_account_id };

    const refund = await stripe.refunds.create(
      {
        payment_intent: payment.stripe_payment_intent_id,
        amount: Math.round(refundDollars * 100),
        reason: mapReason(reasonCode),
        metadata: {
          paymentId: String(paymentId),
          refundedBy: user.id,
          note: reasonNote ? String(reasonNote).slice(0, 480) : "",
        },
      },
      stripeOptions
    );

    const newRefundedTotal = Math.round((alreadyRefunded + refundDollars) * 100) / 100;
    const fullyRefunded = newRefundedTotal >= totalAmount - 0.0001;

    const { error: updateError } = await supabase
      .from("payments")
      .update({
        refunded_amount: newRefundedTotal,
        refund_reason: reasonNote || reasonCode || "requested_by_customer",
        refunded_at: new Date().toISOString(),
        status: fullyRefunded ? "refunded" : "partially_refunded",
      })
      .eq("id", paymentId);

    if (updateError) {
      console.error("Refund succeeded in Stripe but DB update failed:", updateError);
      return new Response(
        JSON.stringify({
          success: true,
          warning: "Refund processed in Stripe but the record could not be updated. It will sync via webhook.",
          refundId: refund.id,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await recordAudit(supabase, {
      organizationId: payment.organization_id,
      actorId: user.id,
      actorEmail: user.email,
      action: fullyRefunded ? "payment.refunded" : "payment.partially_refunded",
      entityType: "payment",
      entityId: payment.id,
      summary: `Refunded $${refundDollars.toFixed(2)} on payment #${payment.id}`,
      details: {
        refunded_amount: refundDollars,
        total_refunded: newRefundedTotal,
        payment_amount: totalAmount,
        status: fullyRefunded ? "refunded" : "partially_refunded",
        reason_code: reasonCode ?? null,
        reason_note: reasonNote ?? null,
        stripe_refund_id: refund.id,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        refundId: refund.id,
        refundedAmount: refundDollars,
        totalRefunded: newRefundedTotal,
        status: fullyRefunded ? "refunded" : "partially_refunded",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("refund-payment error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
