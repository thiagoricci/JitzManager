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

  let debugStage = "start";

  try {
    debugStage = "parse-body";
    console.log("Function invoked.");
    const { studentId, organizationId } = await req.json();
    console.log("Request body:", { studentId, organizationId });

    const siteUrl = Deno.env.get("SITE_URL");
    if (!siteUrl) {
      console.error("Missing SITE_URL environment variable");
      throw new Error("Missing SITE_URL environment variable");
    }
    if (!studentId || !organizationId) {
      console.error("Missing required parameters.");
      return new Response(
        JSON.stringify({ error: "Missing required parameters" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    debugStage = "init-supabase";
    console.log("Initializing Supabase client...");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    debugStage = "fetch-student";
    console.log(`Fetching student with ID: ${studentId}`);
    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("name, email, stripe_customer_id")
      .eq("id", studentId)
      .single();

    if (studentError || !student) {
      console.error("Error fetching student:", studentError);
      return new Response(JSON.stringify({ error: "Student not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log("Student found:", student);

    debugStage = "fetch-organization";
    console.log(`Fetching organization with ID: ${organizationId}`);
    const { data: organization, error: organizationError } = await supabase
      .from("organizations")
      .select("stripe_account_id")
      .eq("id", organizationId)
      .single();

    if (organizationError || !organization || !organization.stripe_account_id) {
      console.error("Error fetching organization:", organizationError);
      return new Response(
        JSON.stringify({ error: "Stripe account not configured for this organization" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    console.log("Organization found with Stripe account:", organization.stripe_account_id);

    debugStage = "create-or-retrieve-stripe-customer";
    console.log("Creating or retrieving Stripe customer...");
    
    // Check if student already has a Stripe customer ID
    let customerId = student.stripe_customer_id;
    
    // Verify the customer exists on the connected account
    if (customerId) {
      try {
        await stripe.customers.retrieve(customerId, {
          stripeAccount: organization.stripe_account_id,
        });
        console.log("Existing customer verified on connected account");
      } catch (verifyError: any) {
        console.log("Existing customer not found on connected account, will create new one:", verifyError.message);
        customerId = null;
      }
    }
    
    if (!customerId) {
      // Create new customer on the connected account
      const customer = await stripe.customers.create({
        email: student.email || undefined,
        name: student.name,
        metadata: {
          studentId: studentId.toString(),
          organizationId: organizationId.toString(),
        },
      }, {
        stripeAccount: organization.stripe_account_id,
      });
      customerId = customer.id;
      console.log("New Stripe customer created on connected account:", customerId);

      // Save the new customer ID to the student's record
      const { error: updateError } = await supabase
        .from("students")
        .update({ stripe_customer_id: customerId })
        .eq("id", studentId);

      if (updateError) {
        console.error("Error updating student with Stripe customer ID:", updateError);
      }
    } else {
      console.log("Using existing Stripe customer:", customerId);
    }

    debugStage = "create-setup-session";
    console.log("=== CREATING SETUP SESSION (NOT PAYMENT) ===");
    console.log("Mode: setup (this will NOT charge the customer)");
    console.log("Customer ID:", customerId);
    console.log("Connected Account:", organization.stripe_account_id);
    
    const sessionConfig = {
      payment_method_types: ["card"],
      mode: "setup" as const,
      success_url: `${siteUrl}/student/${studentId}?setup_success=true`,
      cancel_url: `${siteUrl}/student/${studentId}?setup_cancelled=true`,
      customer: customerId,
      client_reference_id: studentId.toString(),
      metadata: {
        studentId: studentId.toString(),
        organizationId: organizationId.toString(),
        sessionType: "setup_only_no_charge",
      },
    };
    
    console.log("Session config:", JSON.stringify(sessionConfig, null, 2));
    
    const session = await stripe.checkout.sessions.create(sessionConfig, {
      stripeAccount: organization.stripe_account_id,
    });

    console.log("=== SETUP SESSION CREATED SUCCESSFULLY ===");
    console.log("Session ID:", session.id);
    console.log("Session Mode:", session.mode);
    console.log("Session URL:", session.url);
    console.log("This session will ONLY save the payment method, NO charge will be made.");

    return new Response(JSON.stringify({
      sessionId: session.id,
      stripeAccountId: organization.stripe_account_id
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Caught error at stage", debugStage, ":", error);
    
    let errorDetails = {};
    if (error instanceof Error) {
      errorDetails = {
        message: error.message,
        stack: error.stack,
        name: error.name,
      };
    } else {
      errorDetails = { ...error };
    }

    return new Response(
      JSON.stringify({
        error: `Error creating setup session at stage: ${debugStage}`,
        details: errorDetails,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});