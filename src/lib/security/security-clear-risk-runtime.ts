import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  SECURITY_REGISTRY_SOURCE,
  getSecurityRegistryEntry
} from "@/src/lib/security/security-registry-runtime";
import {
  SECURITY_SAFE_ACTIONS_SOURCE,
  getSecuritySafeAction
} from "@/src/lib/security/security-safe-actions-runtime";

export type SecurityClearRiskSource = "security_clear_risk_runtime";

export type SecurityClearRiskState =
  | "disabled"
  | "error"
  | "forbidden"
  | "idle"
  | "not_found"
  | "not_high_risk"
  | "success";

export type SecurityClearRiskResult = {
  eventId: string;
  message: string;
  ok: boolean;
  readOnly: false;
  source: SecurityClearRiskSource;
  state: SecurityClearRiskState;
  updatedAt: string | null;
};

export type SecurityClearRiskSupport = {
  confirmationMessage: string;
  confirmationRequired: boolean;
  disabledReason: string | null;
  readOnly: true;
  registryKey: string;
  registrySource: typeof SECURITY_REGISTRY_SOURCE;
  safeActionsSource: typeof SECURITY_SAFE_ACTIONS_SOURCE;
  source: SecurityClearRiskSource;
  supported: boolean;
};

export type SecurityClearRiskInput = {
  eventId: string;
  eventType?: string | null;
};

export const SECURITY_CLEAR_RISK_SOURCE = "security_clear_risk_runtime" as const;

export const SECURITY_CLEAR_RISK_ACTION_KEY = "sec-action-clear-risk" as const;

export const SECURITY_CLEAR_RISK_REGISTRY_KEY = "sec-security-events" as const;

export const SECURITY_CLEAR_RISK_TABLE = "security_audit_logs" as const;

export const SECURITY_CLEAR_RISK_AUDIT_ACTION = "security.event.risk_cleared" as const;

export const SECURITY_CLEAR_RISK_HIGH_RISK_ACTION = "security.event.high_risk" as const;

export const SECURITY_CLEAR_RISK_CONFIRMATION_MESSAGE =
  "Clear the high-risk flag on this security target? This records a risk-cleared audit entry attributed to your Super Admin account.";

export const SECURITY_CLEAR_RISK_DISABLED_STATE =
  "Clear Risk is not available for this target in the current runtime configuration.";

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" && value ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function auditMechanismAvailable(): boolean {
  return Boolean(createAdminClient());
}

export function resolveSecurityClearRiskSupport(): SecurityClearRiskSupport {
  const action = getSecuritySafeAction(SECURITY_CLEAR_RISK_ACTION_KEY);
  const registryEntry = getSecurityRegistryEntry(SECURITY_CLEAR_RISK_REGISTRY_KEY);

  const base = {
    confirmationMessage: SECURITY_CLEAR_RISK_CONFIRMATION_MESSAGE,
    confirmationRequired: action?.confirmationRequired ?? true,
    readOnly: true as const,
    registryKey: SECURITY_CLEAR_RISK_REGISTRY_KEY,
    registrySource: SECURITY_REGISTRY_SOURCE,
    safeActionsSource: SECURITY_SAFE_ACTIONS_SOURCE,
    source: SECURITY_CLEAR_RISK_SOURCE
  };

  if (!registryEntry || registryEntry.visibility !== "super_admin") {
    return {
      ...base,
      disabledReason: "Security events are not registered as a super-admin module in the security registry.",
      supported: false
    };
  }

  if (!action || !action.enabled) {
    return {
      ...base,
      disabledReason: action?.disabledReason ?? "Clear Risk is not enabled in the security safe actions runtime.",
      supported: false
    };
  }

  if (!auditMechanismAvailable()) {
    return {
      ...base,
      disabledReason:
        "Clear Risk is disabled because no safe audit mechanism (service-role admin access) is configured.",
      supported: false
    };
  }

  return {
    ...base,
    disabledReason: null,
    supported: true
  };
}

export function isSecurityTargetEligibleForRiskClear(input: {
  currentlyHighRisk: boolean;
  exists: boolean;
}): boolean {
  return input.exists && input.currentlyHighRisk;
}

function buildResult(
  state: SecurityClearRiskState,
  eventId: string,
  message: string,
  updatedAt: string | null = null
): SecurityClearRiskResult {
  return {
    eventId,
    message,
    ok: state === "success",
    readOnly: false,
    source: SECURITY_CLEAR_RISK_SOURCE,
    state,
    updatedAt
  };
}

export function buildSecurityClearRiskIdleResult(): SecurityClearRiskResult {
  return buildResult("idle", "", "No Clear Risk action has been triggered yet.");
}

export async function runSecurityClearRisk(
  input: SecurityClearRiskInput
): Promise<SecurityClearRiskResult> {
  const eventId = text(input.eventId).trim();

  if (!eventId) {
    return buildResult("error", eventId, "A security event id is required to clear the risk flag.");
  }

  const support = resolveSecurityClearRiskSupport();

  if (!support.supported) {
    return buildResult("disabled", eventId, support.disabledReason ?? SECURITY_CLEAR_RISK_DISABLED_STATE);
  }

  let access: Awaited<ReturnType<typeof getAdminAccess>>;

  try {
    access = await getAdminAccess();
  } catch {
    return buildResult("forbidden", eventId, "Super Admin authentication is required to clear risk.");
  }

  if (access.role !== "super_admin") {
    return buildResult("forbidden", eventId, "Only an official Super Admin may clear security risk flags.");
  }

  const admin = createAdminClient();

  if (!admin) {
    return buildResult(
      "disabled",
      eventId,
      "Clear Risk is disabled because no safe audit mechanism is configured."
    );
  }

  try {
    const { data: eventRow, error: eventError } = await admin
      .from(SECURITY_CLEAR_RISK_TABLE as never)
      .select("id, action, user_id, store_id, metadata, created_at")
      .eq("id" as never, eventId as never)
      .limit(1)
      .maybeSingle();

    if (eventError) {
      return buildResult("error", eventId, `Unable to validate the security target: ${eventError.message}`);
    }

    if (!isRecord(eventRow)) {
      return buildResult("not_found", eventId, "The requested security target could not be found.");
    }

    const { data: latestRiskMark, error: riskLookupError } = await admin
      .from(SECURITY_CLEAR_RISK_TABLE as never)
      .select("id, action, created_at")
      .in("action" as never, [
        SECURITY_CLEAR_RISK_HIGH_RISK_ACTION,
        SECURITY_CLEAR_RISK_AUDIT_ACTION
      ] as never)
      .eq("metadata->>event_id" as never, eventId as never)
      .order("created_at" as never, { ascending: false } as never)
      .limit(1)
      .maybeSingle();

    if (riskLookupError) {
      return buildResult(
        "error",
        eventId,
        `Unable to confirm risk-clear eligibility: ${riskLookupError.message}`
      );
    }

    const latestRiskRecord = isRecord(latestRiskMark)
      ? (latestRiskMark as { action?: string | null })
      : null;
    const currentlyHighRisk =
      latestRiskRecord !== null && text(latestRiskRecord.action) === SECURITY_CLEAR_RISK_HIGH_RISK_ACTION;

    if (!currentlyHighRisk) {
      return buildResult(
        "not_high_risk",
        eventId,
        "This security target is not currently marked high risk, so there is no risk flag to clear."
      );
    }

    const eventRecord = eventRow as { action?: string | null; store_id?: string | null };
    const updatedAt = new Date().toISOString();
    const eventType = text(input.eventType) || text(eventRecord.action, "security.event");

    const { error: insertError } = await admin.from(SECURITY_CLEAR_RISK_TABLE as never).insert({
      action: SECURITY_CLEAR_RISK_AUDIT_ACTION,
      ip_address: null,
      metadata: {
        event_id: eventId,
        risk_level: "cleared",
        source: "super_admin_security_center_clear_risk",
        target_event_type: eventType
      },
      reason: `Security target ${eventId} risk flag cleared by Super Admin.`,
      route: "/admin/security",
      store_id: text(eventRecord.store_id) || null,
      user_agent: null,
      user_id: access.user.id,
      workspace_id: null
    } as never);

    if (insertError) {
      return buildResult("error", eventId, `Unable to record the risk clear: ${insertError.message}`);
    }

    return buildResult("success", eventId, "Security target risk flag cleared.", updatedAt);
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Unknown error while clearing the risk flag.";
    return buildResult("error", eventId, `Unable to clear the risk flag: ${message}`);
  }
}
