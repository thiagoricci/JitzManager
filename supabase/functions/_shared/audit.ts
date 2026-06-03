// Records an audit-log entry from a service_role edge function.
//
// Student changes are captured by a DB trigger (the user edits them directly),
// but payment/refund and staff/role actions run here under service_role where
// auth.uid() is NULL — so these functions log explicitly with the caller they
// resolve from the JWT.
//
// Best-effort: an audit failure must never break the underlying action, so this
// swallows and logs its own errors. Callers should `await` it after the action
// has succeeded.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

export type AuditEntry = {
  organizationId: string;
  actorId?: string | null;
  actorEmail?: string | null;
  action: string;
  entityType: "student" | "payment" | "staff";
  entityId?: string | number | null;
  summary?: string | null;
  details?: Record<string, unknown>;
};

export async function recordAudit(
  admin: SupabaseClient,
  entry: AuditEntry
): Promise<void> {
  try {
    const { error } = await admin.from("audit_log").insert({
      organization_id: entry.organizationId,
      actor_id: entry.actorId ?? null,
      actor_email: entry.actorEmail ?? null,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId != null ? String(entry.entityId) : null,
      summary: entry.summary ?? null,
      details: entry.details ?? {},
    });
    if (error) console.error("audit_log insert failed:", error.message);
  } catch (e) {
    console.error("audit_log insert threw:", e);
  }
}
