import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

export type AccountRole = "super_admin" | "owner" | "reseller" | "delivery" | "customer";
export type AccountRoleStatus = "pending" | "active" | "suspended" | "disabled";

export type AccountRoleRow = {
  role: AccountRole;
  status: AccountRoleStatus;
  user_id: string;
};

const allowedRoles = new Set<AccountRole>(["super_admin", "owner", "reseller", "delivery", "customer"]);

export function isAccountRole(value: unknown): value is AccountRole {
  return typeof value === "string" && allowedRoles.has(value as AccountRole);
}

function normalizeStatus(value: unknown): AccountRoleStatus {
  if (value === "active" || value === "suspended" || value === "disabled") {
    return value;
  }

  return "pending";
}

export async function getAccountRoleForUser(
  supabase: SupabaseClient,
  userId: string | null | undefined
): Promise<AccountRoleRow | null> {
  if (!userId) {
    return null;
  }

  const { data, error } = await supabase
    .from("account_roles" as never)
    .select("user_id, role, status")
    .eq("user_id" as never, userId as never)
    .maybeSingle();

  if (error) {
    console.warn("[account-roles] role lookup failed", {
      code: error.code,
      message: error.message,
      userId
    });
    return null;
  }

  const row = data as { role?: unknown; status?: unknown; user_id?: string } | null;

  if (!row || !isAccountRole(row.role) || !row.user_id) {
    return null;
  }

  return {
    role: row.role,
    status: normalizeStatus(row.status),
    user_id: row.user_id
  };
}

export function configuredSuperAdminEmails() {
  return (process.env.SHASTORE_SUPER_ADMIN_EMAILS ?? process.env.ADMIN_EMAILS ?? process.env.ADMIN_EMAIL ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isOfficialSuperAdminEmail(email: string | null | undefined) {
  const configured = configuredSuperAdminEmails();
  const normalized = email?.trim().toLowerCase() ?? "";

  return configured.length > 0 && configured.includes(normalized);
}

export async function upsertAccountRoleForUser({
  role,
  status,
  userId
}: {
  role: AccountRole;
  status: AccountRoleStatus;
  userId: string;
}) {
  const admin = createAdminClient();

  if (!admin) {
    console.warn("[account-roles] service role client unavailable");
    return false;
  }

  const { error } = await admin
    .from("account_roles" as never)
    .upsert(
      {
        role,
        status,
        user_id: userId
      } as never,
      { onConflict: "user_id" } as never
    );

  if (error) {
    console.warn("[account-roles] role upsert failed", {
      code: error.code,
      message: error.message,
      role,
      userId
    });
    return false;
  }

  return true;
}

export async function activateAccountRoleForUser(userId: string, expectedRole?: AccountRole) {
  const admin = createAdminClient();

  if (!admin) {
    return false;
  }

  let query = admin
    .from("account_roles" as never)
    .update({ status: "active" } as never)
    .eq("user_id" as never, userId as never);

  if (expectedRole) {
    query = query.eq("role" as never, expectedRole as never);
  }

  const { error } = await query;

  if (error) {
    console.warn("[account-roles] role activation failed", {
      code: error.code,
      expectedRole,
      message: error.message,
      userId
    });
    return false;
  }

  return true;
}
