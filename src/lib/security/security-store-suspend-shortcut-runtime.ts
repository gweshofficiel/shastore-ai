import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { suspendAdminStore } from "@/lib/admin/store-governance-actions";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  SECURITY_REGISTRY_SOURCE,
  getSecurityRegistryEntry
} from "@/src/lib/security/security-registry-runtime";
import {
  SECURITY_SAFE_ACTIONS_SOURCE,
  getSecuritySafeAction
} from "@/src/lib/security/security-safe-actions-runtime";

export type SecurityStoreSuspendSource = "security_store_suspend_shortcut_runtime";

export type SecurityStoreSuspendState =
  | "already_suspended"
  | "disabled"
  | "error"
  | "forbidden"
  | "idle"
  | "not_found"
  | "protected"
  | "success";

export type SecurityStoreSuspendResult = {
  message: string;
  ok: boolean;
  readOnly: false;
  source: SecurityStoreSuspendSource;
  state: SecurityStoreSuspendState;
  storeId: string;
  suspendedAt: string | null;
};

export type SecurityStoreSuspendSupport = {
  confirmationMessage: string;
  confirmationRequired: boolean;
  confirmationToken: string;
  destructive: true;
  disabledReason: string | null;
  readOnly: true;
  registryKey: string;
  registrySource: typeof SECURITY_REGISTRY_SOURCE;
  safeActionsSource: typeof SECURITY_SAFE_ACTIONS_SOURCE;
  source: SecurityStoreSuspendSource;
  supported: boolean;
};

export type SecurityStoreSuspendInput = {
  confirmationToken?: string | null;
  storeId: string;
};

export const SECURITY_STORE_SUSPEND_SOURCE = "security_store_suspend_shortcut_runtime" as const;

export const SECURITY_STORE_SUSPEND_ACTION_KEY = "sec-action-store-suspend-shortcut" as const;

export const SECURITY_STORE_SUSPEND_REGISTRY_KEY = "sec-security-actions" as const;

export const SECURITY_STORE_SUSPEND_CONFIRMATION_TOKEN = "SUSPEND" as const;

export const SECURITY_STORE_SUSPEND_CONFIRMATION_MESSAGE =
  "Suspend this store via the certified store governance workflow? This unpublishes the storefront while preserving store data, orders, and history. Type SUSPEND to confirm.";

export const SECURITY_STORE_SUSPEND_DISABLED_STATE =
  "Store Suspend Shortcut is not available in the current runtime configuration.";

const SECURITY_STORE_SUSPEND_PROTECTED_FLAG_KEYS = [
  "demo",
  "internal",
  "isDemo",
  "isInternal",
  "isProtected",
  "isSystem",
  "protected",
  "system"
] as const;

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" && value ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function suspensionMechanismAvailable(): boolean {
  return Boolean(createAdminClient());
}

export function resolveSecurityStoreSuspendSupport(): SecurityStoreSuspendSupport {
  const action = getSecuritySafeAction(SECURITY_STORE_SUSPEND_ACTION_KEY);
  const registryEntry = getSecurityRegistryEntry(SECURITY_STORE_SUSPEND_REGISTRY_KEY);

  const base = {
    confirmationMessage: SECURITY_STORE_SUSPEND_CONFIRMATION_MESSAGE,
    confirmationRequired: action?.confirmationRequired ?? true,
    confirmationToken: SECURITY_STORE_SUSPEND_CONFIRMATION_TOKEN,
    destructive: true as const,
    readOnly: true as const,
    registryKey: SECURITY_STORE_SUSPEND_REGISTRY_KEY,
    registrySource: SECURITY_REGISTRY_SOURCE,
    safeActionsSource: SECURITY_SAFE_ACTIONS_SOURCE,
    source: SECURITY_STORE_SUSPEND_SOURCE
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
      disabledReason: "Store Suspend Shortcut is not defined in the security safe actions runtime.",
      supported: false
    };
  }

  if (!suspensionMechanismAvailable()) {
    return {
      ...base,
      disabledReason:
        "Store Suspend Shortcut is disabled because no existing safe store suspension mechanism (service-role admin access) is configured.",
      supported: false
    };
  }

  return {
    ...base,
    disabledReason: null,
    supported: true
  };
}

export function isStoreProtectedFromSuspension(storeData: unknown): boolean {
  if (!isRecord(storeData)) {
    return false;
  }

  for (const key of SECURITY_STORE_SUSPEND_PROTECTED_FLAG_KEYS) {
    if (storeData[key] === true) {
      return true;
    }
  }

  const governance = isRecord(storeData.adminGovernance) ? storeData.adminGovernance : null;

  if (governance) {
    for (const key of SECURITY_STORE_SUSPEND_PROTECTED_FLAG_KEYS) {
      if (governance[key] === true) {
        return true;
      }
    }
  }

  return false;
}

export function isStoreEligibleForSuspension(input: {
  alreadySuspended: boolean;
  exists: boolean;
  isProtected: boolean;
}): boolean {
  return input.exists && !input.isProtected && !input.alreadySuspended;
}

function buildResult(
  state: SecurityStoreSuspendState,
  storeId: string,
  message: string,
  suspendedAt: string | null = null
): SecurityStoreSuspendResult {
  return {
    message,
    ok: state === "success",
    readOnly: false,
    source: SECURITY_STORE_SUSPEND_SOURCE,
    state,
    storeId,
    suspendedAt
  };
}

export function buildSecurityStoreSuspendIdleResult(): SecurityStoreSuspendResult {
  return buildResult("idle", "", "No Store Suspend Shortcut action has been triggered yet.");
}

export async function runSecurityStoreSuspendShortcut(
  input: SecurityStoreSuspendInput
): Promise<SecurityStoreSuspendResult> {
  const storeId = text(input.storeId).trim();

  if (!storeId) {
    return buildResult("error", storeId, "A target store id is required to use the Store Suspend Shortcut.");
  }

  const support = resolveSecurityStoreSuspendSupport();

  if (!support.supported) {
    return buildResult("disabled", storeId, support.disabledReason ?? SECURITY_STORE_SUSPEND_DISABLED_STATE);
  }

  if (support.confirmationRequired && text(input.confirmationToken).trim() !== support.confirmationToken) {
    return buildResult(
      "error",
      storeId,
      `Store Suspend Shortcut requires explicit confirmation. Type ${support.confirmationToken} to confirm.`
    );
  }

  let access: Awaited<ReturnType<typeof getAdminAccess>>;

  try {
    access = await getAdminAccess();
  } catch {
    return buildResult("forbidden", storeId, "Super Admin authentication is required to suspend a store.");
  }

  if (access.role !== "super_admin") {
    return buildResult("forbidden", storeId, "Only an official Super Admin may suspend a store.");
  }

  const admin = createAdminClient();

  if (!admin) {
    return buildResult(
      "disabled",
      storeId,
      "Store Suspend Shortcut is disabled because no safe suspension mechanism is configured."
    );
  }

  try {
    const { data: storeRow, error: storeError } = await admin
      .from("stores" as never)
      .select("id, status, store_data")
      .eq("id" as never, storeId as never)
      .limit(1)
      .maybeSingle();

    if (storeError) {
      return buildResult("error", storeId, `Unable to validate the target store: ${storeError.message}`);
    }

    if (!isRecord(storeRow)) {
      return buildResult("not_found", storeId, "The requested store could not be found.");
    }

    const storeRecord = storeRow as { status?: string | null; store_data?: unknown };

    if (isStoreProtectedFromSuspension(storeRecord.store_data)) {
      return buildResult(
        "protected",
        storeId,
        "Protected, system, demo, or internal stores cannot be suspended from this runtime."
      );
    }

    const storeData = isRecord(storeRecord.store_data) ? storeRecord.store_data : {};
    const governance = isRecord(storeData.adminGovernance) ? storeData.adminGovernance : {};

    if (
      text(storeRecord.status).toLowerCase() === "suspended" ||
      text(governance.status).toLowerCase() === "suspended"
    ) {
      return buildResult("already_suspended", storeId, "This store is already suspended.");
    }

    const formData = new FormData();
    formData.set("storeId", storeId);

    await suspendAdminStore(formData);

    return buildResult(
      "success",
      storeId,
      "Store suspended via the certified store governance workflow.",
      new Date().toISOString()
    );
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Unknown error while suspending the store.";
    return buildResult("error", storeId, `Unable to suspend the store: ${message}`);
  }
}
