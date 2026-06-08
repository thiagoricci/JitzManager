import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";
import Stripe from "https://esm.sh/stripe@12.3.0";
import { corsHeaders } from "../_shared/cors.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") as string, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

function periodToRecurring(period: string): { interval: "day" | "week" | "month" | "year"; interval_count: number } {
  switch (period) {
    case "Daily":     return { interval: "day",   interval_count: 1 };
    case "Weekly":    return { interval: "week",  interval_count: 1 };
    case "Quarterly": return { interval: "month", interval_count: 3 };
    case "Biannual":  return { interval: "month", interval_count: 6 };
    case "Annual":    return { interval: "year",  interval_count: 1 };
    default:          return { interval: "month", interval_count: 1 }; // Monthly
  }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Public: a prospective student submits their details and we build the Stripe
// Checkout session ourselves (on the gym's connected account), de-duping the
// customer by email. Returns the hosted checkout URL to redirect to.
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { organizationId, planId, name, email, phone, dateOfBirth, waiverSignedName, isMinor, guardianName } = await req.json() as {
      organizationId?: string;
      planId?: number | string;
      name?: string;
      email?: string;
      phone?: string;
      dateOfBirth?: string;
      waiverSignedName?: string;
      isMinor?: boolean;
      guardianName?: string;
    };

    if (!organizationId || !planId) return json({ error: "Missing organizationId or planId" }, 400);
    if (!name?.trim() || !email?.trim()) return json({ error: "Name and email are required" }, 400);

    const siteUrl = Deno.env.get("SITE_URL")?.replace(/\/$/, "");
    if (!siteUrl) return json({ error: "Site URL is not configured" }, 500);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: plan, error } = await supabase
      .from("membership_plans")
      .select("id, name, price, period, status, organization_id, stripe_price_id, organizations(stripe_account_id)")
      .eq("id", planId)
      .single();

    if (error || !plan) return json({ error: "Plan not found" }, 404);
    if (plan.organization_id !== organizationId) return json({ error: "Plan not found" }, 404);
    if (plan.status !== "active") return json({ error: "This plan is no longer available." }, 400);

    const priceAmount = Math.round(parseFloat(plan.price) * 100);
    if (!priceAmount || priceAmount <= 0) return json({ error: "This plan can't be joined online." }, 400);

    const stripeAccountId = (plan.organizations as { stripe_account_id: string | null })?.stripe_account_id;
    if (!stripeAccountId) return json({ error: "This gym isn't set up to accept online payments yet." }, 400);

    const stripeOptions = { stripeAccount: stripeAccountId };
    const cleanName = name.trim();
    const cleanEmail = email.trim();
    const cleanPhone = phone?.trim() || "";

    // De-dupe the Stripe customer by email so repeat attempts don't pile up.
    let customerId: string;
    const existing = await stripe.customers.list({ email: cleanEmail, limit: 1 }, stripeOptions);
    if (existing.data.length > 0) {
      customerId = existing.data[0].id;
      await stripe.customers.update(
        customerId,
        { name: cleanName, ...(cleanPhone ? { phone: cleanPhone } : {}) },
        stripeOptions,
      );
    } else {
      const customer = await stripe.customers.create(
        { email: cleanEmail, name: cleanName, ...(cleanPhone ? { phone: cleanPhone } : {}) },
        stripeOptions,
      );
      customerId = customer.id;
    }

    // Prefer the plan's synced price (correct interval); otherwise build one inline.
    const { interval, interval_count } = periodToRecurring(plan.period);
    const lineItem = plan.stripe_price_id
      ? { price: plan.stripe_price_id as string, quantity: 1 }
      : {
          price_data: {
            currency: "usd",
            product_data: { name: plan.name },
            unit_amount: priceAmount,
            recurring: { interval, interval_count },
          },
          quantity: 1,
        };

    const signupMeta = {
      planId: String(plan.id),
      organizationId,
      sessionType: "student_self_signup",
      signupName: cleanName,
      signupEmail: cleanEmail,
      signupPhone: cleanPhone,
      signupDateOfBirth: dateOfBirth || "",
      waiverSignedName: waiverSignedName?.trim() || cleanName,
      waiverIsMinor: isMinor ? "true" : "false",
      waiverGuardianName: guardianName?.trim() || "",
    };

    const session = await stripe.checkout.sessions.create(
      {
        mode: "subscription",
        customer: customerId,
        line_items: [lineItem],
        success_url: `${siteUrl}/enroll-success?org=${organizationId}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${siteUrl}/join/${organizationId}/${plan.id}`,
        metadata: signupMeta,
        subscription_data: { metadata: signupMeta },
      },
      stripeOptions,
    );

    return json({ url: session.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : JSON.stringify(error);
    console.error("Error creating enrollment checkout:", message);
    return json({ error: message }, 500);
  }
});
