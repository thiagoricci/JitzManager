import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email, password, sessionId, action, userId: providedUserId } = await req.json();

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") as string, {
      apiVersion: "2023-10-16",
    });

    // Handle getting session details (email)
    if (action === 'get_session_details') {
      if (!sessionId) throw new Error("Missing sessionId");
      
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (!session) throw new Error("Session not found");

      return new Response(
        JSON.stringify({
          email: session.customer_details?.email || session.customer_email
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!sessionId) {
      throw new Error("Missing sessionId");
    }

    if (!providedUserId && !password) {
      throw new Error("Missing password for new user creation");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 1. Verify Stripe Session
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (!session || session.payment_status !== "paid") {
      throw new Error("Invalid or unpaid session");
    }

    // Use email from Stripe session if available, otherwise fallback to provided email
    const userEmail = session.customer_details?.email || session.customer_email || email;

    if (!userEmail) {
      throw new Error("No email found in session or request");
    }

    const subscriptionId = session.subscription as string;
    const customerId = session.customer as string;

    let userId = providedUserId;

    // 2. Create User (if not provided)
    if (!userId) {
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: userEmail,
        password,
        email_confirm: true, // Auto-confirm for paid users
      });

      if (authError) {
        // If user already exists, we can't proceed without their ID.
        // But we can't get their ID easily.
        // Throw specific error so frontend can ask them to login.
        if (authError.message.includes("already registered")) {
           throw new Error("User already exists. Please login to complete setup.");
        }
        throw authError;
      }
      userId = authData.user.id;
    }

    // 3. Create or Get Organization
    // Check if user already has an organization
    const { data: existingOrg } = await supabase
      .from("organizations")
      .select("id")
      .eq("owner_id", userId)
      .maybeSingle();

    let organizationId = existingOrg?.id;

    if (!organizationId) {
      const { data: orgData, error: orgError } = await supabase
        .from("organizations")
        .insert({
          name: "My Academy",
          owner_id: userId,
          slug: `academy-${userId.substring(0, 8)}`,
        })
        .select()
        .single();

      if (orgError) throw orgError;
      organizationId = orgData.id;
    }

    // 4. Create or Update Profile
    const { error: profileError } = await supabase
      .from("profiles")
      .upsert({
        id: userId,
        organization_id: organizationId,
        role: "admin",
      });

    if (profileError) throw profileError;

    // 5. Update user metadata in JWT
    const { error: metadataError } = await supabase.auth.admin.updateUserById(
      userId,
      {
        app_metadata: {
          organization_id: organizationId,
          role: "admin",
        },
      }
    );

    if (metadataError) throw metadataError;

    // 6. Create or Update Platform Subscription
    const { error: subError } = await supabase
      .from("platform_subscriptions")
      .upsert({
        organization_id: organizationId,
        stripe_subscription_id: subscriptionId,
        stripe_customer_id: customerId,
        status: "active",
        current_period_start: new Date().toISOString(),
        current_period_end: new Date().toISOString(), // Should get from subscription object
        plan_id: "standard",
      });

    if (subError) throw subError;

    // 7. Update Stripe Customer Metadata
    await stripe.customers.update(customerId, {
      metadata: {
        organizationId: organizationId,
      },
    });
    
    await stripe.subscriptions.update(subscriptionId, {
      metadata: {
        organizationId: organizationId,
        sessionType: "platform_subscription",
      },
    });

    return new Response(
      JSON.stringify({ success: true, userId }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error completing signup:", error);
    // Return 200 with error message to make it easier for frontend to handle
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});