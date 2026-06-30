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

export type SecurityMarkReviewedSource = "security_mark_reviewed_runtime";

export type SecurityMarkReviewedState =
  | "already_reviewed"
  | "disabled"
  | "error"
  | "forbidden"
  | "idle"
  | "not_found"
  | "success";

export type SecurityMarkReviewedResult = {
  eventId: string;
  message: string;
  ok: boolean;
  readOnly: false;
  reviewedAt: string | null;
  source: SecurityMarkReviewedSource;
  state: SecurityMarkReviewedState;
};

export type SecurityMarkReviewedSupport = {
  confirmationMessage: string;
  confirmationRequired: boolean;
  disabledReason: string | null;
  readOnly: true;
  registryKey: string;
  registrySource: typeof SECURITY_REGISTRY_SOURCE;
  safeActionsSource: typeof SECURITY_SAFE_ACTIONS_SOURCE;
  source: SecurityMarkReviewedSource;
  supported: boolean;
};

export type SecurityMarkReviewedInput = {
  eventId: string;
  eventType?: string | null;
};

export const SECURITY_MARK_REVIEWED_SOURCE = "security_mark_reviewed_runtime" as const;

export const SECURITY_MARK_REVIEWED_ACTION_KEY = "sec-action-mark-reviewed" as const;

export const SECURITY_MARK_REVIEWED_REGISTRY_KEY = "sec-security-events" as const;

export const SECURITY_MARK_REVIEWED_TABLE = "security_audit_logs" as const;

export const SECURITY_MARK_REVIEWED_AUDIT_ACTION = "security.event.reviewed" as const;

export const SECURITY_MARK_REVIEWED_CONFIRMATION_MESSAGE =
  "Mark this security event as reviewed? This records a review audit entry attributed to your Super Admin account.";

export const SECURITY_MARK_REVIEWED_DISABLED_STATE =
  "Mark Reviewed is not available for this event in the current runtime configuration.";

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" && value ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function auditMechanismAvailable(): boolean {
  return Boolean(createAdminClient());
}

export function resolveSecurityMarkReviewedSupport(): SecurityMarkReviewedSupport {
  const action = getSecuritySafeAction(SECURITY_MARK_REVIEWED_ACTION_KEY);
  const registryEntry = getSecurityRegistryEntry(SECURITY_MARK_REVIEWED_REGISTRY_KEY);

  const base = {
    confirmationMessage: SECURITY_MARK_REVIEWED_CONFIRMATION_MESSAGE,
    confirmationRequired: action?.confirmationRequired ?? true,
    readOnly: true as const,
    registryKey: SECURITY_MARK_REVIEWED_REGISTRY_KEY,
    registrySource: SECURITY_REGISTRY_SOURCE,
    safeActionsSource: SECURITY_SAFE_ACTIONS_SOURCE,
    source: SECURITY_MARK_REVIEWED_SOURCE
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
      disabledReason: action?.disabledReason ?? "Mark Reviewed is not enabled in the security safe actions runtime.",
      supported: false
    };
  }

  if (!auditMechanismAvailable()) {
    return {
      ...base,
      disabledReason:
        "Mark Reviewed is disabled because no safe audit mechanism (service-role admin access) is configured.",
      supported: false
    };
  }

  return {
    ...base,
    disabledReason: null,
    supported: true
  };
}

export function isSecurityEventEligibleForReview(input: {
  alreadyReviewed: boolean;
  exists: boolean;
}): boolean {
  return input.exists && !input.alreadyReviewed;
}

function buildResult(
  state: SecurityMarkReviewedState,
  eventId: string,
  message: string,
  reviewedAt: string | null = null
): SecurityMarkReviewedResult {
  return {
    eventId,
    message,
    ok: state === "success",
    readOnly: false,
    reviewedAt,
    source: SECURITY_MARK_REVIEWED_SOURCE,
    state
  };
}

export function buildSecurityMarkReviewedIdleResult(): SecurityMarkReviewedResult {
  return buildResult("idle", "", "No Mark Reviewed action has been triggered yet.");
}

export async function runSecurityMarkReviewed(
  input: SecurityMarkReviewedInput
): Promise<SecurityMarkReviewedResult> {
  const eventId = text(input.eventId).trim();

  if (!eventId) {
    return buildResult("error", eventId, "A security event id is required to mark the event reviewed.");
  }

  const support = resolveSecurityMarkReviewedSupport();

  if (!support.supported) {
    return buildResult("disabled", eventId, support.disabledReason ?? SECURITY_MARK_REVIEWED_DISABLED_STATE);
  }

  let access: Awaited<ReturnType<typeof getAdminAccess>>;

  try {
    access = await getAdminAccess();
  } catch {
    return buildResult("forbidden", eventId, "Super Admin authentication is required to mark events reviewed.");
  }

  if (access.role !== "super_admin") {
    return buildResult(
      "forbidden",
      eventId,
      "Only an official Super Admin may mark security events reviewed."
    );
  }

  const admin = createAdminClient();

  if (!admin) {
    return buildResult(
      "disabled",
      eventId,
      "Mark Reviewed is disabled because no safe audit mechanism is configured."
    );
  }

  try {
    const { data: eventRow, error: eventError } = await admin
      .from(SECURITY_MARK_REVIEWED_TABLE as never)
      .select("id, action, user_id, store_id, metadata, created_at")
      .eq("id" as never, eventId as never)
      .limit(1)
      .maybeSingle();

    if (eventError) {
      return buildResult("error", eventId, `Unable to validate the security event: ${eventError.message}`);
    }

    if (!isRecord(eventRow)) {
      return buildResult("not_found", eventId, "The requested security event could not be found.");
    }

    const { data: existingReview, error: reviewLookupError } = await admin
      .from(SECURITY_MARK_REVIEWED_TABLE as never)
      .select("id")
      .eq("action" as never, SECURITY_MARK_REVIEWED_AUDIT_ACTION as never)
      .eq("metadata->>event_id" as never, eventId as never)
      .limit(1)
      .maybeSingle();

    if (reviewLookupError) {
      return buildResult(
        "error",
        eventId,
        `Unable to confirm review eligibility: ${reviewLookupError.message}`
      );
    }

    if (isRecord(existingReview)) {
      return buildResult("already_reviewed", eventId, "This security event has already been marked reviewed.");
    }

    const eventRecord = eventRow as { action?: string | null; store_id?: string | null; user_id?: string | null };
    const reviewedAt = new Date().toISOString();
    const eventType = text(input.eventType) || text(eventRecord.action, "security.event");

    const { error: insertError } = await admin.from(SECURITY_MARK_REVIEWED_TABLE as never).insert({
      action: SECURITY_MARK_REVIEWED_AUDIT_ACTION,
      ip_address: null,
      metadata: {
        event_id: eventId,
        reviewed_event_type: eventType,
        source: "super_admin_security_center_mark_reviewed"
      },
      reason: `Security event ${eventId} marked reviewed by Super Admin.`,
      route: "/admin/security",
      store_id: text(eventRecord.store_id) || null,
      user_agent: null,
      user_id: access.user.id,
      workspace_id: null
    } as never);

    if (insertError) {
      return buildResult("error", eventId, `Unable to record the review: ${insertError.message}`);
    }

    return buildResult("success", eventId, "Security event marked reviewed.", reviewedAt);
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Unknown error while marking the event reviewed.";
    return buildResult("error", eventId, `Unable to mark the event reviewed: ${message}`);
  }
}
