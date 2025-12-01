import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";
import Stripe from "https://esm.sh/stripe@12.3.0";
import { corsHeaders } from "../_shared/cors.ts";

const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");

if (!stripeSecretKey) {
  console.error("Missing STRIPE_SECRET_KEY environment variable");
  throw new Error("Missing STRIPE_SECRET_KEY environment variable");
}

const stripe = new Stripe(stripeSecretKey as string, {
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
    const { studentId } = await req.json();

    if (!studentId) {
      return new Response(
        JSON.stringify({ error: "Missing studentId parameter" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("stripe_customer_id, organization_id")
      .eq("id", studentId)
      .single();

    if (studentError || !student) {
      console.error("Error fetching student:", studentError);
      return new Response(JSON.stringify({ error: "Student not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!student.stripe_customer_id) {
      return new Response(JSON.stringify({ paymentMethods: [] }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the organization's Stripe account ID (optional for Connect mode)
    let stripeAccountId: string | null = null;
    if (student.organization_id) {
      const { data: organization } = await supabase
        .from("organizations")
        .select("stripe_account_id")
        .eq("id", student.organization_id)
        .single();
      
      stripeAccountId = organization?.stripe_account_id || null;
    }

    // Build Stripe options - only include stripeAccount if we have a connected account
    const stripeOptions = stripeAccountId ? { stripeAccount: stripeAccountId } : {};

    const customer = await stripe.customers.retrieve(
      student.stripe_customer_id,
      {
        expand: ["invoice_settings.default_payment_method"],
      },
      stripeOptions
    );

    const paymentMethods = await stripe.paymentMethods.list(
      {
        customer: student.stripe_customer_id,
        type: "card",
      },
      stripeOptions
    );

    const formattedPaymentMethods = paymentMethods.data.map((pm: Stripe.PaymentMethod) => ({
      id: pm.id,
      brand: pm.card?.brand,
      last4: pm.card?.last4,
      exp_month: pm.card?.exp_month,
      exp_year: pm.card?.exp_year,
      isDefault:
        pm.id ===
        (customer.invoice_settings?.default_payment_method as Stripe.PaymentMethod)
          ?.id,
    }));

    return new Response(JSON.stringify({ paymentMethods: formattedPaymentMethods }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching payment methods:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});