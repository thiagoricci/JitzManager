import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";
import { corsHeaders } from "../_shared/cors.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Public: returns the plan + gym info needed to render the join page.
// Uses the service role so it works for unauthenticated prospects (RLS would
// otherwise hide the org's plans).
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { organizationId, planId } = await req.json() as {
      organizationId?: string;
      planId?: number | string;
    };
    if (!organizationId || !planId) {
      return json({ error: "Missing organizationId or planId" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: plan, error } = await supabase
      .from("membership_plans")
      .select("id, name, description, price, period, currency, status, organization_id, organizations(name, stripe_account_id, waiver_text)")
      .eq("id", planId)
      .single();

    if (error || !plan) return json({ error: "Plan not found" }, 404);
    if (plan.organization_id !== organizationId) return json({ error: "Plan not found" }, 404);
    if (plan.status !== "active") return json({ error: "This plan is no longer available." }, 400);

    const priceAmount = Math.round(parseFloat(plan.price) * 100);
    if (!priceAmount || priceAmount <= 0) {
      return json({ error: "This plan can't be joined online." }, 400);
    }

    const org = plan.organizations as { name: string; stripe_account_id: string | null; waiver_text: string | null };
    if (!org?.stripe_account_id) {
      return json({ error: "This gym isn't set up to accept online payments yet." }, 400);
    }

    return json({
      organizationName: org.name,
      plan: {
        name: plan.name,
        description: plan.description,
        price: plan.price,
        period: plan.period,
        currency: plan.currency,
      },
      waiverText: org.waiver_text?.trim() || null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : JSON.stringify(error);
    console.error("Error fetching enrollment details:", message);
    return json({ error: message }, 500);
  }
});
