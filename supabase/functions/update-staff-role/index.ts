import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";
import { corsHeaders } from "../_shared/cors.ts";
import { recordAudit } from "../_shared/audit.ts";

const ADMIN_ROLES = ["owner", "admin"];
// Roles an admin/owner may assign. 'owner' is set at org creation/transfer.
const ASSIGNABLE_ROLES = ["admin", "coach", "front_desk"];

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
      return new Response(JSON.stringify({ error: "Only admins can change staff roles" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { userId, role } = await req.json();
    if (!userId || !role) {
      return new Response(JSON.stringify({ error: "Missing userId or role" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!ASSIGNABLE_ROLES.includes(role)) {
      return new Response(JSON.stringify({ error: "Invalid role" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Admins cannot change their own role here.
    if (userId === user.id) {
      return new Response(JSON.stringify({ error: "You cannot change your own role" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // The target must belong to the caller's org and not be an owner.
    const { data: targetProfile, error: targetError } = await supabaseAdmin
      .from("profiles")
      .select("organization_id, role, full_name, email")
      .eq("id", userId)
      .single();

    if (targetError || !targetProfile) {
      return new Response(JSON.stringify({ error: "Staff member not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (
      targetProfile.organization_id !== callerProfile.organization_id ||
      targetProfile.role === "owner"
    ) {
      return new Response(JSON.stringify({ error: "Cannot change this user's role" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const previousRole = targetProfile.role;
    if (previousRole === role) {
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({ role })
      .eq("id", userId);
    if (updateError) throw updateError;

    // Keep the JWT app_metadata role in sync with the profile.
    await supabaseAdmin.auth.admin.updateUserById(userId, {
      app_metadata: { organization_id: callerProfile.organization_id, role },
    });

    await recordAudit(supabaseAdmin, {
      organizationId: callerProfile.organization_id,
      actorId: user.id,
      actorEmail: user.email,
      action: "staff.role_changed",
      entityType: "staff",
      entityId: userId,
      summary: `Changed ${targetProfile.full_name ?? targetProfile.email ?? userId}'s role: ${previousRole} -> ${role}`,
      details: { from: previousRole, to: role },
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in update-staff-role function:", error);
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
