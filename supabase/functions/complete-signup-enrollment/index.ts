import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";
import Stripe from "https://esm.sh/stripe@12.3.0";
import { corsHeaders } from "../_shared/cors.ts";
import { provisionSelfSignup } from "../_shared/provision-signup.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { sessionId, organizationId } = await req.json() as {
      sessionId?: string;
      organizationId?: string;
    };

    if (!sessionId || !organizationId) {
      return json({ error: "Missing sessionId or organizationId" }, 400);
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") as string, {
      apiVersion: "2023-10-16",
      httpClient: Stripe.createFetchHttpClient(),
    });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Resolve the connected account from the org passed in the redirect URL.
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .select("stripe_account_id")
      .eq("id", organizationId)
      .single();

    if (orgError || !org?.stripe_account_id) {
      return json({ error: "Organization not found or Stripe not connected" }, 400);
    }

    const connectedAccountId = org.stripe_account_id as string;
    const stripeOptions = { stripeAccount: connectedAccountId };

    // Retrieve the checkout session on the connected account. An invalid or
    // foreign session simply won't be found here.
    const session = await stripe.checkout.sessions.retrieve(sessionId, stripeOptions);

    if (!["paid", "no_payment_required"].includes(session.payment_status ?? "")) {
      // Subscription not finalized yet — the client will retry.
      return json({ status: "processing" });
    }

    const subscriptionId = session.subscription as string | null;
    if (!subscriptionId) {
      return json({ error: "No subscription on this session" }, 400);
    }

    // The authoritative plan/org come from the subscription metadata we set
    // when creating the payment link — not from the (spoofable) URL params.
    const subscription = await stripe.subscriptions.retrieve(subscriptionId, stripeOptions);
    const meta = subscription.metadata || {};

    if (meta.sessionType !== "student_self_signup") {
      return json({ error: "Not a self-signup session" }, 400);
    }
    if (meta.organizationId !== organizationId) {
      return json({ error: "Organization mismatch" }, 403);
    }
    if (!meta.planId) {
      return json({ error: "Missing plan on subscription" }, 400);
    }

    const result = await provisionSelfSignup(stripe, supabase, {
      organizationId,
      planId: meta.planId,
      connectedAccountId,
      customerId: (session.customer as string) ?? null,
      subscriptionId,
      amountTotal: session.amount_total ?? null,
      name: meta.signupName || session.customer_details?.name || null,
      email: meta.signupEmail || session.customer_details?.email || null,
      phone: meta.signupPhone || session.customer_details?.phone || null,
      dateOfBirth: meta.signupDateOfBirth || null,
      waiverSignedName: meta.waiverSignedName || null,
      waiverIsMinor: meta.waiverIsMinor === "true",
      waiverGuardianName: meta.waiverGuardianName || null,
    });

    return json({ success: true, studentId: result.studentId });
  } catch (error) {
    const message = error instanceof Error ? error.message : JSON.stringify(error);
    console.error("Error completing signup enrollment:", message);
    return json({ error: message }, 500);
  }
});
