import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";
import Stripe from "https://esm.sh/stripe@12.3.0";
import { corsHeaders } from "../_shared/cors.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") as string, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

function periodToRecurring(period: string): { interval: "day" | "week" | "month" | "year"; interval_count: number } {
  // The billing_period enum is lowercase; lowercase here too so any legacy
  // capitalized value still maps correctly.
  switch ((period ?? "").toLowerCase()) {
    case "daily":     return { interval: "day",   interval_count: 1 };
    case "weekly":    return { interval: "week",  interval_count: 1 };
    case "quarterly": return { interval: "month", interval_count: 3 };
    case "biannual":  return { interval: "month", interval_count: 6 };
    case "annual":    return { interval: "year",  interval_count: 1 };
    default:          return { interval: "month", interval_count: 1 }; // monthly
  }
}

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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { planId, action } = await req.json() as { planId: number; action: "create" | "update" | "delete" };

    const { data: plan } = await supabase
      .from("membership_plans")
      .select("*, organizations(stripe_account_id)")
      .eq("id", planId)
      .single();

    if (!plan) {
      return new Response(JSON.stringify({ error: "Plan not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripeAccountId = (plan.organizations as { stripe_account_id: string | null })?.stripe_account_id;
    if (!stripeAccountId) {
      // No Stripe account connected — skip silently
      return new Response(JSON.stringify({ success: true, skipped: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripeOptions = { stripeAccount: stripeAccountId };
    const priceAmount = Math.round(parseFloat(plan.price) * 100);

    if (action === "create") {
      // Free/trial plans don't need Stripe products
      if (priceAmount === 0) {
        return new Response(JSON.stringify({ success: true, skipped: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const product = await stripe.products.create({
        name: plan.name,
        ...(plan.description ? { description: plan.description } : {}),
        metadata: { plan_id: String(planId) },
      }, stripeOptions);

      const { interval, interval_count } = periodToRecurring(plan.period);
      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: priceAmount,
        currency: "usd",
        recurring: { interval, interval_count },
        metadata: { plan_id: String(planId) },
      }, stripeOptions);

      await supabase
        .from("membership_plans")
        .update({ stripe_product_id: product.id, stripe_price_id: price.id })
        .eq("id", planId);

      return new Response(JSON.stringify({ success: true, productId: product.id, priceId: price.id }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update") {
      // If there's no existing product, treat as create
      if (!plan.stripe_product_id) {
        // Recurse as create by re-calling this logic inline
        if (priceAmount === 0) {
          return new Response(JSON.stringify({ success: true, skipped: true }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const product = await stripe.products.create({
          name: plan.name,
          ...(plan.description ? { description: plan.description } : {}),
          metadata: { plan_id: String(planId) },
        }, stripeOptions);

        const { interval, interval_count } = periodToRecurring(plan.period);
        const price = await stripe.prices.create({
          product: product.id,
          unit_amount: priceAmount,
          currency: "usd",
          recurring: { interval, interval_count },
          metadata: { plan_id: String(planId) },
        }, stripeOptions);

        await supabase
          .from("membership_plans")
          .update({ stripe_product_id: product.id, stripe_price_id: price.id })
          .eq("id", planId);

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update product name/description
      await stripe.products.update(plan.stripe_product_id, {
        name: plan.name,
        ...(plan.description ? { description: plan.description } : {}),
      }, stripeOptions);

      // Prices are immutable in Stripe — archive the old one and create a new one
      if (plan.stripe_price_id) {
        await stripe.prices.update(plan.stripe_price_id, { active: false }, stripeOptions);
      }

      const { interval, interval_count } = periodToRecurring(plan.period);
      const newPrice = await stripe.prices.create({
        product: plan.stripe_product_id,
        unit_amount: priceAmount,
        currency: "usd",
        recurring: { interval, interval_count },
        metadata: { plan_id: String(planId) },
      }, stripeOptions);

      // The existing sign-up Payment Link points at the now-archived price.
      // Deactivate it and clear it so the admin regenerates one with the new price.
      if (plan.signup_link_id) {
        await stripe.paymentLinks.update(plan.signup_link_id, { active: false }, stripeOptions).catch(console.error);
      }

      await supabase
        .from("membership_plans")
        .update({ stripe_price_id: newPrice.id, signup_link_url: null, signup_link_id: null })
        .eq("id", planId);

      return new Response(JSON.stringify({ success: true, priceId: newPrice.id }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      if (plan.signup_link_id) {
        await stripe.paymentLinks.update(plan.signup_link_id, { active: false }, stripeOptions).catch(console.error);
      }
      if (plan.stripe_product_id) {
        // Archive all active prices first, then the product
        if (plan.stripe_price_id) {
          await stripe.prices.update(plan.stripe_price_id, { active: false }, stripeOptions).catch(console.error);
        }
        await stripe.products.update(plan.stripe_product_id, { active: false }, stripeOptions).catch(console.error);
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : JSON.stringify(error);
    console.error("Error syncing membership plan:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
