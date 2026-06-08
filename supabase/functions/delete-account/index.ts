import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";
import Stripe from "https://esm.sh/stripe@12.3.0";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.organization_id) {
      return new Response(JSON.stringify({ error: "Organization not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const organizationId = profile.organization_id;

    // 1. Cancel Platform Subscription in Stripe
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (stripeSecretKey) {
      const stripe = new Stripe(stripeSecretKey, {
        apiVersion: "2023-10-16",
        httpClient: Stripe.createFetchHttpClient(),
      });

      const { data: subscription } = await supabaseAdmin
        .from("platform_subscriptions")
        .select("stripe_subscription_id")
        .eq("organization_id", organizationId)
        .maybeSingle();

      if (subscription?.stripe_subscription_id) {
        try {
          await stripe.subscriptions.cancel(subscription.stripe_subscription_id);
        } catch (stripeError) {
          console.error("Error cancelling Stripe subscription:", stripeError);
        }
      }

      // 1b. Disconnect Stripe Connect account
      const { data: org } = await supabaseAdmin
        .from("organizations")
        .select("stripe_account_id")
        .eq("id", organizationId)
        .single();

      if (org?.stripe_account_id) {
        const clientId = Deno.env.get("STRIPE_CLIENT_ID");
        if (clientId) {
          try {
            await stripe.oauth.deauthorize({
              client_id: clientId,
              stripe_user_id: org.stripe_account_id,
            });
          } catch (deauthError) {
            console.error("Stripe deauthorize error (non-fatal):", deauthError);
          }
        }
      }
    }

    // 2. Delete students first so the audit_students trigger fires while the
    //    organization row still exists. Deleting the org directly causes CASCADE
    //    to remove students mid-statement; the trigger then INSERTs into
    //    audit_log with an org_id that is being deleted → FK violation
    //    (audit_log_organization_id_fkey).
    const { error: deleteStudentsError } = await supabaseAdmin
      .from("students")
      .delete()
      .eq("organization_id", organizationId);

    if (deleteStudentsError) {
      console.error("Error deleting students:", deleteStudentsError);
      throw deleteStudentsError;
    }

    // 3. Delete audit_log rows for this org.
    const { error: deleteAuditError } = await supabaseAdmin
      .from("audit_log")
      .delete()
      .eq("organization_id", organizationId);
    if (deleteAuditError) {
      console.error("Error deleting audit_log:", deleteAuditError);
    }

    // 4. Delete Organization (CASCADE handles all remaining related data)
    const { error: deleteError } = await supabaseAdmin
      .from("organizations")
      .delete()
      .eq("id", organizationId);

    if (deleteError) {
      console.error("Error deleting organization:", deleteError);
      throw deleteError;
    }

    // 5. Delete the User from Auth
    const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
    if (deleteUserError) {
      console.error("Error deleting user:", deleteUserError);
    }

    return new Response(
      JSON.stringify({ success: true, message: "Account and data deleted successfully" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in delete-account function:", error);
    return new Response(
      JSON.stringify({
        error: "Internal Server Error",
        details: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
