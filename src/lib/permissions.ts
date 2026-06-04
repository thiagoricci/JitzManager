// Org staff roles & the permission matrix (issue #5).
//
// This is the single source of truth for what each role may do in the UI. The
// database enforces the same matrix in RLS + a student-update trigger (see
// supabase/migrations/20260604000000_org_staff_roles.sql); keep the two in sync.

export type Role = "owner" | "admin" | "coach" | "front_desk";

export type Permission =
  | "manage_billing" // membership plans, charges, subscriptions
  | "manage_staff" // add/remove/role staff members
  | "manage_settings" // org settings, schedules, appearance, integrations
  | "view_audit" // audit log viewer
  | "manage_students" // add/edit/delete student records (excluding rank)
  | "record_attendance" // mark attendance
  | "promote_ranks"; // change a student's belt/stripes

// Which roles are granted each permission. owner/admin always have full access.
const MATRIX: Record<Permission, Role[]> = {
  manage_billing: ["owner", "admin"],
  manage_staff: ["owner", "admin"],
  manage_settings: ["owner", "admin"],
  view_audit: ["owner", "admin"],
  manage_students: ["owner", "admin", "front_desk"],
  record_attendance: ["owner", "admin", "coach", "front_desk"],
  promote_ranks: ["owner", "admin", "coach"],
};

// Roles that carry full administrative access (owner/admin). Kept here so the UI
// and edge functions share one definition.
export const ADMIN_ROLES: Role[] = ["owner", "admin"];

export function isRole(value: string | null | undefined): value is Role {
  return value === "owner" || value === "admin" || value === "coach" || value === "front_desk";
}

export function hasPermission(role: string | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return MATRIX[permission].includes(role as Role);
}

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  admin: "Admin",
  coach: "Coach",
  front_desk: "Front Desk",
};

// Roles an owner/admin may assign to staff. 'owner' is set at org creation /
// transfer and is intentionally not assignable here.
export const ASSIGNABLE_ROLES: Role[] = ["admin", "coach", "front_desk"];

export function roleLabel(role: string | null | undefined): string {
  return isRole(role) ? ROLE_LABELS[role] : "Member";
}
