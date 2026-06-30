import "server-only";

import { isConfiguredSuperAdminEmail } from "@/lib/account-roles";
import { getAdminAccess } from "@/lib/admin-access";
import { suspendAdminUserShortcut } from "@/lib/admin/user-actions";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  SECURITY_REGISTRY_SOURCE,
  getSecurityRegistryEntry
} from "@/src/lib/security/security-registry-runtime";
import {
  SECURITY_SAFE_ACTIONS_SOURCE,
  getSecuritySafeAction
} from "@/src/lib/security/security-safe-actions-runtime";

export type SecurityUserSuspendSource = "security_user_suspend_shortcut_runtime";

export type SecurityUserSuspendState =
  | "already_suspended"
  | "disabled"
  | "error"
  | "forbidden"
  | "idle"
  | "not_found"
  | "protected"
  | "self_forbidden"
  | "success";

export type SecurityUserSuspendResult = {
  message: string;
  ok: boolean;
  readOnly: false;
  source: SecurityUserSuspendSource;
  state: SecurityUserSuspendState;
  suspendedAt: string | null;
  userId: string;
};

export type SecurityUserSuspendSupport = {
  confirmationMessage: string;
  confirmationRequired: boolean;
  confirmationToken: string;
  destructive: true;
  disabledReason: string | null;
  readOnly: true;
  registryKey: string;
  registrySource: typeof SECURITY_REGISTRY_SOURCE;
  safeActionsSource: typeof SECURITY_SAFE_ACTIONS_SOURCE;
  source: SecurityUserSuspendSource;
  supported: boolean;
};

export type SecurityUserSuspendInput = {
  confirmationToken?: string | null;
  userId: string;
};

export const SECURITY_USER_SUSPEND_SOURCE = "security_user_suspend_shortcut_runtime" as const;

export const SECURITY_USER_SUSPEND_ACTION_KEY = "sec-action-user-suspend-shortcut" as const;

export const SECURITY_USER_SUSPEND_REGISTRY_KEY = "sec-security-actions" as const;

export const SECURITY_USER_SUSPEND_CONFIRMATION_TOKEN = "SUSPEND" as const;

export const SECURITY_USER_SUSPEND_CONFIRMATION_MESSAGE =
  "Suspend this user via the certified suspension workflow? This bans auth login and revokes sessions while preserving stores, orders, subscriptions, and history. Type SUSPEND to confirm.";

export const SECURITY_USER_SUSPEND_DISABLED_STATE =
  "User Suspend Shortcut is not available in the current runtime configuration.";

const SECURITY_USER_SUSPEND_PROTECTED_ROLES = ["super_admin", "internal_team", "service", "system"] as const;

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" && value ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function suspensionMechanismAvailable(): boolean {
  return Boolean(createAdminClient());
}

export function resolveSecurityUserSuspendSupport(): SecurityUserSuspendSupport {
  const action = getSecuritySafeAction(SECURITY_USER_SUSPEND_ACTION_KEY);
  const registryEntry = getSecurityRegistryEntry(SECURITY_USER_SUSPEND_REGISTRY_KEY);

  const base = {
    confirmationMessage: SECURITY_USER_SUSPEND_CONFIRMATION_MESSAGE,
    confirmationRequired: action?.confirmationRequired ?? true,
    confirmationToken: SECURITY_USER_SUSPEND_CONFIRMATION_TOKEN,
    destructive: true as const,
    readOnly: true as const,
    registryKey: SECURITY_USER_SUSPEND_REGISTRY_KEY,
    registrySource: SECURITY_REGISTRY_SOURCE,
    safeActionsSource: SECURITY_SAFE_ACTIONS_SOURCE,
    source: SECURITY_USER_SUSPEND_SOURCE
  };

  if (!registryEntry || registryEntry.visibility !== "super_admin") {
    return {
      ...base,
      disabledReason: "Security actions are not registered as a super-admin module in the security registry.",
      supported: false
    };
  }

  if (!action) {
    return {
      ...base,
      disabledReason: "User Suspend Shortcut is not defined in the security safe actions runtime.",
      supported: false
    };
  }

  if (!suspensionMechanismAvailable()) {
    return {
      ...base,
      disabledReason:
        "User Suspend Shortcut is disabled because no existing safe user suspension mechanism (service-role admin access) is configured.",
      supported: false
    };
  }

  return {
    ...base,
    disabledReason: null,
    supported: true
  };
}

export function isUserEligibleForSuspension(input: {
  alreadySuspended: boolean;
  exists: boolean;
  isProtected: boolean;
  isSelf: boolean;
}): boolean {
  return input.exists && !input.isProtected && !input.isSelf && !input.alreadySuspended;
}

function buildResult(
  state: SecurityUserSuspendState,
  userId: string,
  message: string,
  suspendedAt: string | null = null
): SecurityUserSuspendResult {
  return {
    message,
    ok: state === "success",
    readOnly: false,
    source: SECURITY_USER_SUSPEND_SOURCE,
    state,
    suspendedAt,
    userId
  };
}

export function buildSecurityUserSuspendIdleResult(): SecurityUserSuspendResult {
  return buildResult("idle", "", "No User Suspend Shortcut action has been triggered yet.");
}

export async function runSecurityUserSuspendShortcut(
  input: SecurityUserSuspendInput
): Promise<SecurityUserSuspendResult> {
  const userId = text(input.userId).trim();

  if (!userId) {
    return buildResult("error", userId, "A target user id is required to use the User Suspend Shortcut.");
  }

  const support = resolveSecurityUserSuspendSupport();

  if (!support.supported) {
    return buildResult("disabled", userId, support.disabledReason ?? SECURITY_USER_SUSPEND_DISABLED_STATE);
  }

  if (support.confirmationRequired && text(input.confirmationToken).trim() !== support.confirmationToken) {
    return buildResult(
      "error",
      userId,
      `User Suspend Shortcut requires explicit confirmation. Type ${support.confirmationToken} to confirm.`
    );
  }

  let access: Awaited<ReturnType<typeof getAdminAccess>>;

  try {
    access = await getAdminAccess();
  } catch {
    return buildResult("forbidden", userId, "Super Admin authentication is required to suspend a user.");
  }

  if (access.role !== "super_admin") {
    return buildResult("forbidden", userId, "Only an official Super Admin may suspend a user.");
  }

  if (userId === access.user.id) {
    return buildResult("self_forbidden", userId, "Super Admins cannot suspend their own account.");
  }

  const admin = createAdminClient();

  if (!admin) {
    return buildResult(
      "disabled",
      userId,
      "User Suspend Shortcut is disabled because no safe suspension mechanism is configured."
    );
  }

  try {
    const { data: userResult, error: userError } = await admin.auth.admin.getUserById(userId);

    if (userError || !userResult?.user) {
      return buildResult("not_found", userId, "The requested user could not be found.");
    }

    if (isConfiguredSuperAdminEmail(userResult.user.email)) {
      return buildResult("protected", userId, "Configured Super Admin accounts cannot be suspended.");
    }

    const { data: roleRow, error: roleError } = await admin
      .from("account_roles" as never)
      .select("role, status")
      .eq("user_id" as never, userId as never)
      .limit(1)
      .maybeSingle();

    if (roleError) {
      return buildResult("error", userId, `Unable to validate the target user role: ${roleError.message}`);
    }

    const roleRecord = isRecord(roleRow) ? (roleRow as { role?: string | null; status?: string | null }) : null;
    const role = text(roleRecord?.role).toLowerCase();

    if (role && SECURITY_USER_SUSPEND_PROTECTED_ROLES.includes(role as (typeof SECURITY_USER_SUSPEND_PROTECTED_ROLES)[number])) {
      return buildResult("protected", userId, `Accounts with the ${role} role cannot be suspended from this runtime.`);
    }

    if (text(roleRecord?.status).toLowerCase() === "suspended") {
      return buildResult("already_suspended", userId, "This user is already suspended.");
    }

    const formData = new FormData();
    formData.set("userId", userId);

    await suspendAdminUserShortcut(formData);

    return buildResult("success", userId, "User suspended via the certified suspension workflow.", new Date().toISOString());
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Unknown error while suspending the user.";
    return buildResult("error", userId, `Unable to suspend the user: ${message}`);
  }
}
