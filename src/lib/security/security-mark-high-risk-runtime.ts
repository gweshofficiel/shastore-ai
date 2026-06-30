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

export type SecurityMarkHighRiskSource = "security_mark_high_risk_runtime";

export type SecurityMarkHighRiskState =
  | "already_high_risk"
  | "disabled"
  | "error"
  | "forbidden"
  | "idle"
  | "not_found"
  | "success";

export type SecurityMarkHighRiskResult = {
  eventId: string;
  message: string;
  ok: boolean;
  readOnly: false;
  source: SecurityMarkHighRiskSource;
  state: SecurityMarkHighRiskState;
  updatedAt: string | null;
};

export type SecurityMarkHighRiskSupport = {
  confirmationMessage: string;
  confirmationRequired: boolean;
  disabledReason: string | null;
  readOnly: true;
  registryKey: string;
  registrySource: typeof SECURITY_REGISTRY_SOURCE;
  safeActionsSource: typeof SECURITY_SAFE_ACTIONS_SOURCE;
  source: SecurityMarkHighRiskSource;
  supported: boolean;
};

export type SecurityMarkHighRiskInput = {
  eventId: string;
  eventType?: string | null;
};

export const SECURITY_MARK_HIGH_RISK_SOURCE = "security_mark_high_risk_runtime" as const;

export const SECURITY_MARK_HIGH_RISK_ACTION_KEY = "sec-action-mark-high-risk" as const;

export const SECURITY_MARK_HIGH_RISK_REGISTRY_KEY = "sec-security-events" as const;

export const SECURITY_MARK_HIGH_RISK_TABLE = "security_audit_logs" as const;

export const SECURITY_MARK_HIGH_RISK_AUDIT_ACTION = "security.event.high_risk" as const;

export const SECURITY_MARK_HIGH_RISK_CLEARED_ACTION = "security.event.risk_cleared" as const;

export const SECURITY_MARK_HIGH_RISK_CONFIRMATION_MESSAGE =
  "Mark this security target as high risk? This records a high-risk audit entry attributed to your Super Admin account.";

export const SECURITY_MARK_HIGH_RISK_DISABLED_STATE =
  "Mark High Risk is not available for this target in the current runtime configuration.";

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" && value ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function auditMechanismAvailable(): boolean {
  return Boolean(createAdminClient());
}

export function resolveSecurityMarkHighRiskSupport(): SecurityMarkHighRiskSupport {
  const action = getSecuritySafeAction(SECURITY_MARK_HIGH_RISK_ACTION_KEY);
  const registryEntry = getSecurityRegistryEntry(SECURITY_MARK_HIGH_RISK_REGISTRY_KEY);

  const base = {
    confirmationMessage: SECURITY_MARK_HIGH_RISK_CONFIRMATION_MESSAGE,
    confirmationRequired: action?.confirmationRequired ?? true,
    readOnly: true as const,
    registryKey: SECURITY_MARK_HIGH_RISK_REGISTRY_KEY,
    registrySource: SECURITY_REGISTRY_SOURCE,
    safeActionsSource: SECURITY_SAFE_ACTIONS_SOURCE,
    source: SECURITY_MARK_HIGH_RISK_SOURCE
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
      disabledReason: action?.disabledReason ?? "Mark High Risk is not enabled in the security safe actions runtime.",
      supported: false
    };
  }

  if (!auditMechanismAvailable()) {
    return {
      ...base,
      disabledReason:
        "Mark High Risk is disabled because no safe audit mechanism (service-role admin access) is configured.",
      supported: false
    };
  }

  return {
    ...base,
    disabledReason: null,
    supported: true
  };
}

export function isSecurityTargetEligibleForHighRisk(input: {
  alreadyHighRisk: boolean;
  exists: boolean;
}): boolean {
  return input.exists && !input.alreadyHighRisk;
}

function buildResult(
  state: SecurityMarkHighRiskState,
  eventId: string,
  message: string,
  updatedAt: string | null = null
): SecurityMarkHighRiskResult {
  return {
    eventId,
    message,
    ok: state === "success",
    readOnly: false,
    source: SECURITY_MARK_HIGH_RISK_SOURCE,
    state,
    updatedAt
  };
}

export function buildSecurityMarkHighRiskIdleResult(): SecurityMarkHighRiskResult {
  return buildResult("idle", "", "No Mark High Risk action has been triggered yet.");
}

export async function runSecurityMarkHighRisk(
  input: SecurityMarkHighRiskInput
): Promise<SecurityMarkHighRiskResult> {
  const eventId = text(input.eventId).trim();

  if (!eventId) {
    return buildResult("error", eventId, "A security event id is required to mark the target high risk.");
  }

  const support = resolveSecurityMarkHighRiskSupport();

  if (!support.supported) {
    return buildResult("disabled", eventId, support.disabledReason ?? SECURITY_MARK_HIGH_RISK_DISABLED_STATE);
  }

  let access: Awaited<ReturnType<typeof getAdminAccess>>;

  try {
    access = await getAdminAccess();
  } catch {
    return buildResult("forbidden", eventId, "Super Admin authentication is required to mark targets high risk.");
  }

  if (access.role !== "super_admin") {
    return buildResult("forbidden", eventId, "Only an official Super Admin may mark security targets high risk.");
  }

  const admin = createAdminClient();

  if (!admin) {
    return buildResult(
      "disabled",
      eventId,
      "Mark High Risk is disabled because no safe audit mechanism is configured."
    );
  }

  try {
    const { data: eventRow, error: eventError } = await admin
      .from(SECURITY_MARK_HIGH_RISK_TABLE as never)
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
      .from(SECURITY_MARK_HIGH_RISK_TABLE as never)
      .select("id, action, created_at")
      .in("action" as never, [
        SECURITY_MARK_HIGH_RISK_AUDIT_ACTION,
        SECURITY_MARK_HIGH_RISK_CLEARED_ACTION
      ] as never)
      .eq("metadata->>event_id" as never, eventId as never)
      .order("created_at" as never, { ascending: false } as never)
      .limit(1)
      .maybeSingle();

    if (riskLookupError) {
      return buildResult(
        "error",
        eventId,
        `Unable to confirm high-risk eligibility: ${riskLookupError.message}`
      );
    }

    const latestRiskRecord = isRecord(latestRiskMark)
      ? (latestRiskMark as { action?: string | null })
      : null;

    if (latestRiskRecord && text(latestRiskRecord.action) === SECURITY_MARK_HIGH_RISK_AUDIT_ACTION) {
      return buildResult(
        "already_high_risk",
        eventId,
        "This security target is already marked high risk."
      );
    }

    const eventRecord = eventRow as { action?: string | null; store_id?: string | null };
    const updatedAt = new Date().toISOString();
    const eventType = text(input.eventType) || text(eventRecord.action, "security.event");

    const { error: insertError } = await admin.from(SECURITY_MARK_HIGH_RISK_TABLE as never).insert({
      action: SECURITY_MARK_HIGH_RISK_AUDIT_ACTION,
      ip_address: null,
      metadata: {
        event_id: eventId,
        risk_level: "high",
        source: "super_admin_security_center_mark_high_risk",
        target_event_type: eventType
      },
      reason: `Security target ${eventId} marked high risk by Super Admin.`,
      route: "/admin/security",
      store_id: text(eventRecord.store_id) || null,
      user_agent: null,
      user_id: access.user.id,
      workspace_id: null
    } as never);

    if (insertError) {
      return buildResult("error", eventId, `Unable to record the high-risk mark: ${insertError.message}`);
    }

    return buildResult("success", eventId, "Security target marked high risk.", updatedAt);
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Unknown error while marking the target high risk.";
    return buildResult("error", eventId, `Unable to mark the target high risk: ${message}`);
  }
}
