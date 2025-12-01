import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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

    // Get the user's profile to find their organization
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.organization_id) {
      return new Response(
        JSON.stringify({ error: "User has no organization" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get the organization details
    const { data: organization, error: orgError } = await supabase
      .from("organizations")
      .select("id, name, stripe_account_id")
      .eq("id", profile.organization_id)
      .single();

    if (orgError || !organization) {
      return new Response(
        JSON.stringify({ error: "Organization not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check if already connected
    if (organization.stripe_account_id) {
      return new Response(
        JSON.stringify({ error: "Stripe account already connected" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get Stripe Client ID for OAuth
    const stripeClientId = Deno.env.get("STRIPE_CLIENT_ID");
    if (!stripeClientId) {
      return new Response(
        JSON.stringify({ error: "Stripe OAuth not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse request body for return URL
    const { returnUrl } = await req.json();
    
    if (!returnUrl) {
      return new Response(
        JSON.stringify({ error: "Return URL is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Generate a state parameter for security (includes organization ID)
    const state = btoa(JSON.stringify({
      organization_id: organization.id,
      timestamp: Date.now(),
    }));

    // Build the Stripe Connect OAuth URL
    // This allows users to connect their EXISTING Stripe account only (no new account creation)
    const oauthUrl = new URL("https://connect.stripe.com/oauth/authorize");
    oauthUrl.searchParams.set("response_type", "code");
    oauthUrl.searchParams.set("client_id", stripeClientId);
    oauthUrl.searchParams.set("scope", "read_write");
    oauthUrl.searchParams.set("redirect_uri", returnUrl);
    oauthUrl.searchParams.set("state", state);
    
    // IMPORTANT: Force login-only flow for existing Stripe accounts
    // stripe_landing=login shows the login page first instead of registration
    oauthUrl.searchParams.set("stripe_landing", "login");
    
    // Pre-fill the user's email to help Stripe identify their existing account
    // This also prevents the "create new account" flow from being the default
    if (user.email) {
      oauthUrl.searchParams.set("stripe_user[email]", user.email);
    }
    
    // Set the business name to help identify the connection
    if (organization.name) {
      oauthUrl.searchParams.set("stripe_user[business_name]", organization.name);
    }
    
    // always_prompt=true ensures the user is always asked to authorize, even if previously connected
    oauthUrl.searchParams.set("always_prompt", "true");

    return new Response(
      JSON.stringify({
        url: oauthUrl.toString(),
        state: state,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("Error creating Stripe Connect link:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});