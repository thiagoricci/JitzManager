import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { studentId, planId, organizationId } = await req.json();
    
    console.log("=== CREATE CHECKOUT SESSION START ===");
    console.log("Received request:", { studentId, planId, organizationId });

    if (!studentId || !planId || !organizationId) {
      console.error("Missing required parameters:", { studentId, planId, organizationId });
      return new Response(
        JSON.stringify({ error: "Missing required parameters" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Initialize Stripe
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecretKey) {
      console.error("STRIPE_SECRET_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "Stripe is not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
    });

    const siteUrl = Deno.env.get("SITE_URL");
    if (!siteUrl) {
      console.error("SITE_URL is not configured");
      return new Response(
        JSON.stringify({ error: "Site URL is not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Environment variables OK, SITE_URL:", siteUrl);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    console.log("Fetching student data...");
    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("name, email, stripe_customer_id, organization_id")
      .eq("id", studentId)
      .single();

    if (studentError) {
      console.error("Student query error:", studentError);
      return new Response(JSON.stringify({ error: "Student not found", details: studentError.message }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!student) {
      console.error("Student not found for ID:", studentId);
      return new Response(JSON.stringify({ error: "Student not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Student found:", { name: student.name, email: student.email, hasStripeCustomer: !!student.stripe_customer_id });

    console.log("Fetching plan data...");
    const { data: plan, error: planError } = await supabase
      .from("membership_plans")
      .select("name, price")
      .eq("id", planId)
      .single();

    if (planError) {
      console.error("Plan query error:", planError);
      return new Response(JSON.stringify({ error: "Plan not found", details: planError.message }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!plan) {
      console.error("Plan not found for ID:", planId);
      return new Response(JSON.stringify({ error: "Plan not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Plan found:", { name: plan.name, price: plan.price });

    console.log("Fetching organization data...");
    const { data: organization, error: organizationError } = await supabase
      .from("organizations")
      .select("stripe_account_id")
      .eq("id", organizationId)
      .single();

    if (organizationError) {
      console.error("Organization query error:", organizationError);
      return new Response(
        JSON.stringify({ error: "Organization not found", details: organizationError.message }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!organization || !organization.stripe_account_id) {
      console.error("Organization missing Stripe account:", { organization });
      return new Response(
        JSON.stringify({ error: "Stripe account not configured for this organization. Please connect your Stripe account in Settings." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Organization found with Stripe account:", organization.stripe_account_id);

    let customerId = student.stripe_customer_id;

    // Check if the existing customer ID is valid on the connected account
    if (customerId) {
      console.log("Verifying existing Stripe customer:", customerId);
      try {
        await stripe.customers.retrieve(customerId, {
          stripeAccount: organization.stripe_account_id,
        });
        console.log("Existing customer verified on connected account");
      } catch (verifyError: any) {
        console.log("Existing customer not found on connected account, will create new one:", verifyError.message);
        customerId = null; // Reset to create a new customer
      }
    }

    if (!customerId) {
      console.log("Creating new Stripe customer for student:", { email: student.email, name: student.name });
      try {
        const customer = await stripe.customers.create({
          email: student.email || undefined,
          name: student.name,
          metadata: {
            studentId: studentId.toString(),
            organizationId: organizationId,
          },
        }, {
          stripeAccount: organization.stripe_account_id,
        });
        customerId = customer.id;
        console.log("Created Stripe customer on connected account:", customerId);
      } catch (customerError: any) {
        console.error("Error creating Stripe customer:", customerError);
        return new Response(
          JSON.stringify({
            error: "Failed to create Stripe customer",
            details: customerError.message
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const { error: updateError } = await supabase
        .from("students")
        .update({ stripe_customer_id: customerId })
        .eq("id", studentId);

      if (updateError) {
        console.error("Failed to update student with Stripe customer ID:", updateError);
        // Don't fail the request, just log the error
      } else {
        console.log("Updated student record with Stripe customer ID");
      }
    } else {
      console.log("Using existing Stripe customer:", customerId);
    }

    // Create a subscription checkout session
    // The payment method is automatically saved when creating a subscription
    const priceInCents = Math.round(parseFloat(plan.price) * 100);
    console.log("Creating checkout session with:", {
      customerId,
      planName: plan.name,
      planPrice: plan.price,
      priceInCents,
      stripeAccount: organization.stripe_account_id,
      successUrl: `${siteUrl}/payment-success?session_id={CHECKOUT_SESSION_ID}&student_id=${studentId}`,
      cancelUrl: `${siteUrl}/payment-cancelled`,
    });
    
    try {
      const session = await stripe.checkout.sessions.create(
        {
          payment_method_types: ["card"],
          customer: customerId,
          line_items: [
            {
              price_data: {
                currency: "usd",
                product_data: {
                  name: plan.name,
                },
                unit_amount: priceInCents,
                recurring: {
                  interval: "month",
                },
              },
              quantity: 1,
            },
          ],
          mode: "subscription",
          success_url: `${siteUrl}/payment-success?session_id={CHECKOUT_SESSION_ID}&student_id=${studentId}`,
          cancel_url: `${siteUrl}/payment-cancelled`,
          client_reference_id: studentId.toString(),
          metadata: {
            planId: planId.toString(),
            organizationId: organizationId,
          },
          subscription_data: {
            metadata: {
              studentId: studentId.toString(),
              planId: planId.toString(),
              organizationId: organizationId,
            },
          },
        },
        {
          stripeAccount: organization.stripe_account_id,
        }
      );

      console.log("Checkout session created successfully:", session.id);
      console.log("=== CREATE CHECKOUT SESSION END ===");

      return new Response(JSON.stringify({
        sessionId: session.id,
        stripeAccountId: organization.stripe_account_id
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (stripeError: any) {
      console.error("Stripe checkout session creation error:", stripeError);
      return new Response(
        JSON.stringify({
          error: "Failed to create checkout session",
          details: stripeError.message,
          code: stripeError.code,
          type: stripeError.type
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
  } catch (error) {
    console.error("Error creating checkout session:", error);
    
    // Provide more specific error messages
    let errorMessage = "Internal Server Error";
    let statusCode = 500;
    
    if (error instanceof Error) {
      errorMessage = error.message;
      
      // Check for common Stripe errors
      if (error.message.includes("No such customer")) {
        errorMessage = "Customer not found in Stripe. Please try again.";
        statusCode = 400;
      } else if (error.message.includes("Invalid API Key")) {
        errorMessage = "Stripe configuration error. Please contact support.";
      } else if (error.message.includes("No such price")) {
        errorMessage = "Invalid price configuration.";
        statusCode = 400;
      }
    }
    
    return new Response(
      JSON.stringify({
        error: errorMessage,
        details: error instanceof Error ? error.message : String(error)
      }),
      {
        status: statusCode,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});