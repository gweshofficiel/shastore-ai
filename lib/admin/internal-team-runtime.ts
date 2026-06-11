import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

export type InternalTeamRole =
  | "admin"
  | "developer_operator"
  | "finance_manager"
  | "moderator"
  | "read_only_auditor"
  | "security_analyst"
  | "super_admin"
  | "support_agent";

export type InternalTeamMemberStatus = "active" | "suspended";
export type InternalTeamInvitationStatus = "accepted" | "cancelled" | "expired" | "pending";

export type InternalTeamMemberRow = {
  accepted_at?: string | null;
  created_at?: string | null;
  display_name?: string | null;
  email: string;
  id: string;
  invited_at?: string | null;
  last_active_at?: string | null;
  role: InternalTeamRole;
  status: InternalTeamMemberStatus;
  user_id?: string | null;
};

export type InternalTeamInvitationRow = {
  accepted_at?: string | null;
  accepted_user_id?: string | null;
  created_at?: string | null;
  display_name?: string | null;
  email: string;
  email_error?: string | null;
  email_status?: string | null;
  expires_at: string;
  id: string;
  invited_by?: string | null;
  last_sent_at?: string | null;
  role: InternalTeamRole;
  status: InternalTeamInvitationStatus;
};

export const internalTeamRoles: Array<{
  accessLevel: "full" | "limited" | "read_only" | "specialized";
  assignedArea: string;
  key: InternalTeamRole;
  name: string;
  permissionsSummary: string;
}> = [
  {
    accessLevel: "full",
    assignedArea: "Platform governance",
    key: "super_admin",
    name: "Super Admin",
    permissionsSummary: "All Super Admin areas, access safety, and internal staff governance."
  },
  {
    accessLevel: "limited",
    assignedArea: "Platform administration",
    key: "admin",
    name: "Admin",
    permissionsSummary: "Users, stores, support, marketplace, reports, and non-sensitive settings."
  },
  {
    accessLevel: "specialized",
    assignedArea: "Support",
    key: "support_agent",
    name: "Support Agent",
    permissionsSummary: "Support tickets, customer issue triage, and read-only user/store context."
  },
  {
    accessLevel: "specialized",
    assignedArea: "Moderation",
    key: "moderator",
    name: "Moderator",
    permissionsSummary: "Marketplace, content review, abuse queues, and moderation/reviews only."
  },
  {
    accessLevel: "specialized",
    assignedArea: "Billing",
    key: "finance_manager",
    name: "Finance Manager",
    permissionsSummary: "Billing, subscriptions, payment provider monitoring, invoices, and reports."
  },
  {
    accessLevel: "specialized",
    assignedArea: "Security",
    key: "security_analyst",
    name: "Security Analyst",
    permissionsSummary: "Security Center, audit events, fraud/abuse monitoring, and risk review."
  },
  {
    accessLevel: "specialized",
    assignedArea: "Operations",
    key: "developer_operator",
    name: "Developer / Operator",
    permissionsSummary: "Operations, integrations, AI/provider diagnostics, queues, and runtime monitoring."
  },
  {
    accessLevel: "read_only",
    assignedArea: "Audit",
    key: "read_only_auditor",
    name: "Read-only Auditor",
    permissionsSummary: "Read-only access to reports, security, operations, and audit summaries."
  }
];

const allowedRoleKeys = new Set<InternalTeamRole>(internalTeamRoles.map((role) => role.key));

const allowedPathPrefixes: Record<InternalTeamRole, string[]> = {
  admin: [
    "/admin",
    "/admin/users",
    "/admin/stores",
    "/admin/sellers",
    "/admin/resellers",
    "/admin/support",
    "/admin/marketplace",
    "/admin/reports"
  ],
  developer_operator: [
    "/admin",
    "/admin/ai",
    "/admin/domains-hosting",
    "/admin/email",
    "/admin/integrations",
    "/admin/notifications",
    "/admin/operations"
  ],
  finance_manager: ["/admin", "/admin/billing", "/admin/reports", "/admin/subscriptions"],
  moderator: ["/admin", "/admin/marketplace", "/admin/moderation", "/admin/templates"],
  read_only_auditor: ["/admin", "/admin/operations", "/admin/reports", "/admin/security", "/admin/stores", "/admin/users"],
  security_analyst: ["/admin", "/admin/security"],
  super_admin: ["/admin"],
  support_agent: ["/admin", "/admin/resellers", "/admin/sellers", "/admin/stores", "/admin/support", "/admin/users"]
};

export function normalizeInternalTeamRole(value: unknown): InternalTeamRole {
  return allowedRoleKeys.has(value as InternalTeamRole) ? (value as InternalTeamRole) : "read_only_auditor";
}

export function internalTeamRoleMeta(role: InternalTeamRole) {
  return internalTeamRoles.find((candidate) => candidate.key === role) ?? internalTeamRoles.at(-1)!;
}

export function createInternalTeamInviteToken() {
  const token = randomBytes(32).toString("base64url");

  return {
    token,
    tokenHash: hashInternalTeamInviteToken(token)
  };
}

export function hashInternalTeamInviteToken(token: string) {
  return createHash("sha256").update(token.trim(), "utf8").digest("hex");
}

export function internalTeamInviteAcceptPath(token: string) {
  return `/admin/internal-team/accept/${encodeURIComponent(token)}`;
}

export function canInternalTeamRoleAccessPath(role: InternalTeamRole, pathname: string) {
  if (role === "super_admin") {
    return true;
  }

  const normalizedPath = pathname.split("?")[0] || "/admin";
  const prefixes = allowedPathPrefixes[role] ?? ["/admin"];

  return prefixes.some((prefix) => normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`));
}

export function internalTeamRoleCanMutate(role: InternalTeamRole) {
  return role !== "read_only_auditor";
}

export async function getInternalTeamMemberForAuthUser({
  email,
  userId
}: {
  email?: string | null;
  userId: string;
}) {
  const admin = createAdminClient();

  if (!admin) {
    return null;
  }

  const normalizedEmail = email?.trim().toLowerCase() ?? "";
  const query = admin
    .from("internal_team_members" as never)
    .select("id, user_id, email, display_name, role, status, invited_at, accepted_at, last_active_at, created_at")
    .eq("user_id" as never, userId as never)
    .maybeSingle();

  let { data, error } = await query;

  if (!data && normalizedEmail) {
    ({ data, error } = await admin
      .from("internal_team_members" as never)
      .select("id, user_id, email, display_name, role, status, invited_at, accepted_at, last_active_at, created_at")
      .ilike("email" as never, normalizedEmail as never)
      .maybeSingle());
  }

  if (error) {
    console.warn("[internal-team] member lookup failed", {
      code: error.code,
      message: error.message,
      userId
    });
    return null;
  }

  const row = data as InternalTeamMemberRow | null;

  if (!row) {
    return null;
  }

  return {
    ...row,
    role: normalizeInternalTeamRole(row.role)
  };
}

export async function canUseAdminLoginForInternalTeam(email: string) {
  const admin = createAdminClient();
  const normalizedEmail = email.trim().toLowerCase();

  if (!admin || !normalizedEmail) {
    return false;
  }

  const [{ data: member }, { data: invite }] = await Promise.all([
    admin
      .from("internal_team_members" as never)
      .select("id, status")
      .ilike("email" as never, normalizedEmail as never)
      .eq("status" as never, "active" as never)
      .maybeSingle(),
    admin
      .from("internal_team_invitations" as never)
      .select("id, status, expires_at")
      .ilike("email" as never, normalizedEmail as never)
      .eq("status" as never, "pending" as never)
      .gt("expires_at" as never, new Date().toISOString() as never)
      .maybeSingle()
  ]);

  return Boolean(member || invite);
}

export async function countActiveInternalSuperAdmins(client?: SupabaseClient | null) {
  const admin = client ?? createAdminClient();

  if (!admin) {
    return 0;
  }

  const { count, error } = await admin
    .from("internal_team_members" as never)
    .select("id", { count: "exact", head: true } as never)
    .eq("role" as never, "super_admin" as never)
    .eq("status" as never, "active" as never);

  if (error) {
    console.warn("[internal-team] active super admin count failed", {
      code: error.code,
      message: error.message
    });
    return 0;
  }

  return count ?? 0;
}
