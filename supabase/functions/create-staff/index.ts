import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";
import { corsHeaders } from "../_shared/cors.ts";
import { recordAudit } from "../_shared/audit.ts";

const ADMIN_ROLES = ["owner", "admin"];

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

    // Identify the caller from their JWT.
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

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

    // Service-role client for admin operations.
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Verify the caller is an admin/owner and grab their organization.
    const { data: callerProfile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("organization_id, role")
      .eq("id", user.id)
      .single();

    if (profileError || !callerProfile?.organization_id) {
      return new Response(JSON.stringify({ error: "Organization not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!ADMIN_ROLES.includes(callerProfile.role)) {
      return new Response(JSON.stringify({ error: "Only admins can add staff" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const organizationId = callerProfile.organization_id;

    const { full_name, email, password } = await req.json();

    if (!email || !password) {
      return new Response(JSON.stringify({ error: "Email and password are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create the staff auth user (auto-confirmed, like the paid signup flow).
    const { data: authData, error: createError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        app_metadata: { organization_id: organizationId, role: "staff" },
      });

    if (createError) {
      const message = createError.message?.includes("already registered")
        ? "A user with this email already exists."
        : createError.message;
      return new Response(JSON.stringify({ error: message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const newUserId = authData.user.id;

    // Link the new user to the caller's organization as staff.
    const { error: insertError } = await supabaseAdmin.from("profiles").upsert({
      id: newUserId,
      organization_id: organizationId,
      role: "staff",
      full_name: full_name ?? null,
      email,
    });

    if (insertError) {
      // Roll back the auth user so we don't leave an orphan.
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      throw insertError;
    }

    await recordAudit(supabaseAdmin, {
      organizationId,
      actorId: user.id,
      actorEmail: user.email,
      action: "staff.created",
      entityType: "staff",
      entityId: newUserId,
      summary: `Added staff member ${full_name ?? email}`,
      details: { email, full_name: full_name ?? null, role: "staff" },
    });

    return new Response(JSON.stringify({ success: true, userId: newUserId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in create-staff function:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
