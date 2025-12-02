import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the user from the JWT
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get organization and role from JWT
    const organizationId = user.app_metadata?.organization_id;
    const userRole = user.app_metadata?.role;

    // Ensure user is an admin of an organization
    if (userRole !== "admin" || !organizationId) {
      return new Response(
        JSON.stringify({
          error: "User is not an admin or has no organization",
        }),
        {
          status: 403, // Forbidden
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse request body - expecting the authorization code from OAuth
    const { code, state } = await req.json();

    if (!code) {
      return new Response(
        JSON.stringify({ error: "Authorization code is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verify state parameter if provided
    if (state) {
      try {
        const stateData = JSON.parse(atob(state));
        if (stateData.organization_id !== organizationId) {
          return new Response(
            JSON.stringify({ error: "Invalid state parameter" }),
            {
              status: 403,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
      } catch (e) {
        console.error("Error parsing state:", e);
        // Continue anyway if state parsing fails
      }
    }

    // Check if organization already has a Stripe account connected
    const { data: organization, error: orgError } = await supabase
      .from("organizations")
      .select("stripe_account_id")
      .eq("id", organizationId)
      .single();

    if (orgError) {
      console.error("Error fetching organization:", orgError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch organization" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // If already connected, return success with existing account info
    if (organization?.stripe_account_id) {
      console.log("Organization already has Stripe account connected:", organization.stripe_account_id);
      
      // Initialize Stripe to get account details
      const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
      if (stripeSecretKey) {
        try {
          const stripe = new Stripe(stripeSecretKey, {
            apiVersion: "2023-10-16",
          });
          const account = await stripe.accounts.retrieve(organization.stripe_account_id);
          
          return new Response(
            JSON.stringify({
              success: true,
              accountId: organization.stripe_account_id,
              chargesEnabled: account.charges_enabled,
              payoutsEnabled: account.payouts_enabled,
              businessName: account.business_profile?.name || account.settings?.dashboard?.display_name,
              alreadyConnected: true,
            }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        } catch (e) {
          console.error("Error fetching existing Stripe account:", e);
        }
      }
      
      // Return basic success if we can't fetch account details
      return new Response(
        JSON.stringify({
          success: true,
          accountId: organization.stripe_account_id,
          alreadyConnected: true,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Initialize Stripe
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecretKey) {
      return new Response(
        JSON.stringify({ error: "Stripe not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
    });

    // Exchange the authorization code for an access token and account ID
    // Note: redirect_uri is NOT required for the token exchange per Stripe OAuth docs
    // Only grant_type and code are required
    console.log("Exchanging authorization code for access token...");
    console.log("Code received:", code ? `${code.substring(0, 10)}...` : "none");
    
    const response = await stripe.oauth.token({
      grant_type: "authorization_code",
      code: code,
    });

    const connectedAccountId = response.stripe_user_id;

    if (!connectedAccountId) {
      return new Response(
        JSON.stringify({ error: "Failed to get Stripe account ID" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verify the account exists and get its details
    const account = await stripe.accounts.retrieve(connectedAccountId);

    // Update the organization with the Stripe account ID
    const { error: updateError } = await supabase
      .from("organizations")
      .update({ stripe_account_id: connectedAccountId })
      .eq("id", organizationId);

    if (updateError) {
      console.error("Error updating organization:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to save Stripe account" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        accountId: connectedAccountId,
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
        businessName: account.business_profile?.name || account.settings?.dashboard?.display_name,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("Error completing Stripe Connect:", error);
    
    // Extract detailed error information for better debugging
    let errorMessage = "Internal server error";
    let errorCode = "";
    
    if (error instanceof Error) {
      errorMessage = error.message;
      // Check if it's a Stripe error with additional details
      const stripeError = error as any;
      if (stripeError.type) {
        errorCode = stripeError.type;
        console.error("Stripe error type:", stripeError.type);
      }
      if (stripeError.code) {
        errorCode = stripeError.code;
        console.error("Stripe error code:", stripeError.code);
      }
      if (stripeError.raw) {
        console.error("Stripe raw error:", JSON.stringify(stripeError.raw));
      }
    }
    
    return new Response(
      JSON.stringify({
        error: errorMessage,
        code: errorCode || undefined,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});