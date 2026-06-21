import "server-only";

import {
  buildEmailProviderRuntimeRecordsSafe,
  getEmailProviderLabel,
  type EmailProviderKey,
  type EmailProviderRegistryItem
} from "@/src/lib/email/email-provider-runtime";
import {
  buildEmailProviderHealthRecordsSafe,
  getEmailProviderHealthStateLabel,
  type EmailProviderHealthRecord,
  type EmailProviderHealthState
} from "@/src/lib/email/email-provider-health-runtime";

export type EmailProviderFailoverReadinessState =
  | "backup_available"
  | "disabled"
  | "failover_ready"
  | "needs_review"
  | "no_backup"
  | "primary_only"
  | "provider_unhealthy"
  | "unknown";

export type EmailProviderFailoverRecord = {
  backupProviderLabel: string | null;
  failoverReadinessState: EmailProviderFailoverReadinessState;
  failoverReadinessStateLabel: string;
  metadataSummary: string;
  primaryProviderLabel: string;
  providerHealthState: EmailProviderHealthState;
  providerHealthStateLabel: string;
  providerKey: EmailProviderKey;
  providerLabel: string;
  providerRole: "backup" | "primary" | "reserved";
};

export type EmailProviderFailoverRuntimeSummary = {
  backupProviderLabel: string | null;
  failoverReadinessState: EmailProviderFailoverReadinessState;
  failoverReadinessStateLabel: string;
  metadataSummary: string;
  primaryProviderLabel: string;
  providerHealthState: EmailProviderHealthState;
  providerHealthStateLabel: string;
};

export type EmailProviderFailoverRuntimeStats = {
  backupAvailableFailoverItems: number;
  disabledFailoverItems: number;
  failoverReadyFailoverItems: number;
  needsReviewFailoverItems: number;
  noBackupFailoverItems: number;
  primaryOnlyFailoverItems: number;
  providerUnhealthyFailoverItems: number;
  totalFailoverItems: number;
  unknownFailoverItems: number;
};

export type EmailProviderFailoverFoundationSnapshot = {
  providerHealthRecords: EmailProviderHealthRecord[];
};

export const EMAIL_PROVIDER_FAILOVER_READINESS_STATES: readonly EmailProviderFailoverReadinessState[] = [
  "failover_ready",
  "primary_only",
  "backup_available",
  "no_backup",
  "provider_unhealthy",
  "needs_review",
  "disabled",
  "unknown"
] as const;

const failoverStateLabels: Record<EmailProviderFailoverReadinessState, string> = {
  backup_available: "Backup provider available",
  disabled: "Provider failover disabled",
  failover_ready: "Provider failover ready",
  needs_review: "Provider failover needs review",
  no_backup: "No backup provider configured",
  primary_only: "Primary provider only",
  provider_unhealthy: "Primary provider unhealthy",
  unknown: "Unknown provider failover readiness"
};

const failoverStateDescriptions: Record<EmailProviderFailoverReadinessState, string> = {
  backup_available:
    "Backup provider foundation is available for admin review. No automatic provider switching or failover execution connected.",
  disabled: "Provider failover foundation is disabled in registry. No provider switching connected.",
  failover_ready:
    "Primary and backup provider readiness foundations look complete. No automatic failover execution connected.",
  needs_review:
    "Provider failover foundation requires admin review. No live provider health checks or switching connected.",
  no_backup:
    "No backup provider foundation is configured. Primary provider readiness only. No failover execution connected.",
  primary_only:
    "Primary provider foundation is active with no backup failover path connected. No provider switching connected.",
  provider_unhealthy:
    "Primary provider foundation is unhealthy in read-only summaries. No provider calls or failover execution connected.",
  unknown: "Provider failover readiness could not be resolved safely."
};

function text(value: unknown, maxLength = 500) {
  if (typeof value !== "string") return "";

  return value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/\bjavascript:/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function findProviderHealth(
  records: EmailProviderHealthRecord[],
  providerKey: EmailProviderKey
): EmailProviderHealthRecord | null {
  return records.find((record) => record.providerKey === providerKey) ?? null;
}

export function getEmailProviderFailoverReadinessStateLabel(state: EmailProviderFailoverReadinessState) {
  return failoverStateLabels[state];
}

export function getEmailProviderFailoverReadinessStateDescription(state: EmailProviderFailoverReadinessState) {
  return failoverStateDescriptions[state];
}

function isBackupCandidateHealth(healthState: EmailProviderHealthState) {
  return healthState === "healthy" || healthState === "degraded" || healthState === "monitoring";
}

function isPrimaryHealthy(healthState: EmailProviderHealthState) {
  return healthState === "healthy" || healthState === "monitoring";
}

function isPrimaryUnhealthy(healthState: EmailProviderHealthState) {
  return (
    healthState === "failed" ||
    healthState === "missing_config" ||
    healthState === "not_configured" ||
    healthState === "degraded"
  );
}

export function resolveEmailProviderFailoverReadinessStateSafe(params: {
  backupHealth: EmailProviderHealthRecord | null;
  primaryHealth: EmailProviderHealthRecord | null;
}): EmailProviderFailoverReadinessState {
  const { backupHealth, primaryHealth } = params;

  if (!primaryHealth) {
    return "unknown";
  }

  if (primaryHealth.healthState === "placeholder" && primaryHealth.providerKey === "future") {
    return "disabled";
  }

  if (primaryHealth.healthState === "failed") {
    return "disabled";
  }

  if (isPrimaryUnhealthy(primaryHealth.healthState)) {
    return "provider_unhealthy";
  }

  if (primaryHealth.healthState === "placeholder") {
    return "needs_review";
  }

  const backupAvailable = backupHealth ? isBackupCandidateHealth(backupHealth.healthState) : false;
  const backupPlaceholderOnly =
    backupHealth?.healthState === "placeholder" || backupHealth?.healthState === "not_configured";

  if (isPrimaryHealthy(primaryHealth.healthState) && backupAvailable && backupHealth?.healthState === "healthy") {
    return "failover_ready";
  }

  if (isPrimaryHealthy(primaryHealth.healthState) && backupAvailable) {
    return "backup_available";
  }

  if (isPrimaryHealthy(primaryHealth.healthState) && backupPlaceholderOnly) {
    return "primary_only";
  }

  if (isPrimaryHealthy(primaryHealth.healthState) && !backupHealth) {
    return "no_backup";
  }

  if (isPrimaryHealthy(primaryHealth.healthState)) {
    return "primary_only";
  }

  return "unknown";
}

function buildFailoverMetadataSummary(
  record: EmailProviderFailoverRecord,
  registryDescription: string | null
) {
  const roleSummary =
    record.providerRole === "primary"
      ? "Primary provider failover foundation only."
      : record.providerRole === "backup"
        ? "Backup provider failover foundation only."
        : "Reserved provider placeholder. No failover execution connected.";

  if (registryDescription) {
    return `${registryDescription} ${roleSummary}`;
  }

  return `${failoverStateDescriptions[record.failoverReadinessState]} ${roleSummary}`;
}

function resolveProviderRole(providerKey: EmailProviderKey): EmailProviderFailoverRecord["providerRole"] {
  if (providerKey === "resend") {
    return "primary";
  }

  if (providerKey === "smtp") {
    return "backup";
  }

  return "reserved";
}

export function buildEmailProviderFailoverRecordSafe(params: {
  backupProviderLabel: string | null;
  failoverReadinessState: EmailProviderFailoverReadinessState;
  healthRecord: EmailProviderHealthRecord;
  primaryProviderLabel: string;
  registryDescription?: string | null;
}): EmailProviderFailoverRecord {
  const providerRole = resolveProviderRole(params.healthRecord.providerKey);

  const record: EmailProviderFailoverRecord = {
    backupProviderLabel: providerRole === "primary" ? params.backupProviderLabel : null,
    failoverReadinessState: params.failoverReadinessState,
    failoverReadinessStateLabel: getEmailProviderFailoverReadinessStateLabel(params.failoverReadinessState),
    metadataSummary: "",
    primaryProviderLabel: providerRole === "primary" ? params.primaryProviderLabel : params.primaryProviderLabel,
    providerHealthState: params.healthRecord.healthState,
    providerHealthStateLabel: params.healthRecord.healthLabel,
    providerKey: params.healthRecord.providerKey,
    providerLabel: params.healthRecord.providerLabel,
    providerRole
  };

  record.metadataSummary =
    text(params.healthRecord.metadataSummary, 500) ||
    buildFailoverMetadataSummary(record, text(params.registryDescription, 500) || null);

  return record;
}

export function buildEmailProviderFailoverRecordsSafe(
  registryItems: EmailProviderRegistryItem[] | null | undefined
): EmailProviderFailoverRecord[] {
  try {
    const healthRecords = buildEmailProviderHealthRecordsSafe(registryItems);
    const runtimeRecords = buildEmailProviderRuntimeRecordsSafe(registryItems);
    const primaryHealth = findProviderHealth(healthRecords, "resend");
    const backupHealth = findProviderHealth(healthRecords, "smtp");
    const primaryLabel = primaryHealth?.providerLabel || getEmailProviderLabel("resend");
    const backupLabel = backupHealth?.providerLabel || getEmailProviderLabel("smtp");
    const aggregateFailoverState = resolveEmailProviderFailoverReadinessStateSafe({
      backupHealth,
      primaryHealth
    });

    const descriptionByKey = new Map(
      runtimeRecords.map((record) => [record.providerKey, record.description] as const)
    );

    const orderedKeys: EmailProviderKey[] = ["resend", "smtp", "future"];

    return orderedKeys
      .map((providerKey) => {
        const healthRecord = findProviderHealth(healthRecords, providerKey);
        if (!healthRecord) {
          return null;
        }

        const role = resolveProviderRole(providerKey);
        const failoverReadinessState =
          role === "primary"
            ? aggregateFailoverState
            : role === "backup"
              ? backupHealth && isBackupCandidateHealth(backupHealth.healthState)
                ? "backup_available"
                : backupHealth?.healthState === "placeholder"
                  ? "primary_only"
                  : "no_backup"
              : "disabled";

        return buildEmailProviderFailoverRecordSafe({
          backupProviderLabel: role === "primary" ? backupLabel : null,
          failoverReadinessState,
          healthRecord,
          primaryProviderLabel: primaryLabel,
          registryDescription: descriptionByKey.get(providerKey) ?? null
        });
      })
      .filter((record): record is EmailProviderFailoverRecord => Boolean(record));
  } catch (error) {
    console.error("[email-provider-failover-runtime] provider failover records build failed", error);
    return [];
  }
}

export function buildEmailProviderFailoverRuntimeSummarySafe(
  registryItems: EmailProviderRegistryItem[] | null | undefined
): EmailProviderFailoverRuntimeSummary {
  try {
    const healthRecords = buildEmailProviderHealthRecordsSafe(registryItems);
    const primaryHealth = findProviderHealth(healthRecords, "resend");
    const backupHealth = findProviderHealth(healthRecords, "smtp");
    const primaryProviderLabel = primaryHealth?.providerLabel || getEmailProviderLabel("resend");
    const backupProviderLabel = backupHealth ? backupHealth.providerLabel : null;
    const failoverReadinessState = resolveEmailProviderFailoverReadinessStateSafe({
      backupHealth,
      primaryHealth
    });
    const providerHealthState = primaryHealth?.healthState ?? "unknown";
    const providerHealthStateLabel =
      primaryHealth?.healthLabel || getEmailProviderHealthStateLabel("unknown");

    return {
      backupProviderLabel,
      failoverReadinessState,
      failoverReadinessStateLabel: getEmailProviderFailoverReadinessStateLabel(failoverReadinessState),
      metadataSummary: failoverStateDescriptions[failoverReadinessState],
      primaryProviderLabel,
      providerHealthState,
      providerHealthStateLabel
    };
  } catch (error) {
    console.error("[email-provider-failover-runtime] provider failover runtime summary build failed", error);

    return {
      backupProviderLabel: null,
      failoverReadinessState: "unknown",
      failoverReadinessStateLabel: getEmailProviderFailoverReadinessStateLabel("unknown"),
      metadataSummary: "Provider failover readiness foundation could not be resolved safely.",
      primaryProviderLabel: getEmailProviderLabel("resend"),
      providerHealthState: "unknown",
      providerHealthStateLabel: getEmailProviderHealthStateLabel("unknown")
    };
  }
}

export function buildEmailProviderFailoverRuntimeStatsSafe(
  registryItems: EmailProviderRegistryItem[] | null | undefined
): EmailProviderFailoverRuntimeStats {
  try {
    const records = buildEmailProviderFailoverRecordsSafe(registryItems);

    if (!records.length) {
      return {
        backupAvailableFailoverItems: 0,
        disabledFailoverItems: 0,
        failoverReadyFailoverItems: 0,
        needsReviewFailoverItems: 0,
        noBackupFailoverItems: 0,
        primaryOnlyFailoverItems: 0,
        providerUnhealthyFailoverItems: 0,
        totalFailoverItems: 0,
        unknownFailoverItems: 0
      };
    }

    return {
      backupAvailableFailoverItems: records.filter((record) => record.failoverReadinessState === "backup_available")
        .length,
      disabledFailoverItems: records.filter((record) => record.failoverReadinessState === "disabled").length,
      failoverReadyFailoverItems: records.filter((record) => record.failoverReadinessState === "failover_ready")
        .length,
      needsReviewFailoverItems: records.filter((record) => record.failoverReadinessState === "needs_review").length,
      noBackupFailoverItems: records.filter((record) => record.failoverReadinessState === "no_backup").length,
      primaryOnlyFailoverItems: records.filter((record) => record.failoverReadinessState === "primary_only").length,
      providerUnhealthyFailoverItems: records.filter((record) => record.failoverReadinessState === "provider_unhealthy")
        .length,
      totalFailoverItems: records.length,
      unknownFailoverItems: records.filter((record) => record.failoverReadinessState === "unknown").length
    };
  } catch (error) {
    console.error("[email-provider-failover-runtime] provider failover runtime stats build failed", error);

    return {
      backupAvailableFailoverItems: 0,
      disabledFailoverItems: 0,
      failoverReadyFailoverItems: 0,
      needsReviewFailoverItems: 0,
      noBackupFailoverItems: 0,
      primaryOnlyFailoverItems: 0,
      providerUnhealthyFailoverItems: 0,
      totalFailoverItems: 0,
      unknownFailoverItems: 0
    };
  }
}

export function buildEmailProviderFailoverRecordsFromSnapshotSafe(
  snapshot: EmailProviderFailoverFoundationSnapshot | null | undefined
): EmailProviderFailoverRecord[] {
  try {
    const healthRecords = Array.isArray(snapshot?.providerHealthRecords) ? snapshot.providerHealthRecords : [];
    const primaryHealth = findProviderHealth(healthRecords, "resend");
    const backupHealth = findProviderHealth(healthRecords, "smtp");
    const primaryLabel = primaryHealth?.providerLabel || getEmailProviderLabel("resend");
    const backupLabel = backupHealth?.providerLabel || getEmailProviderLabel("smtp");
    const aggregateFailoverState = resolveEmailProviderFailoverReadinessStateSafe({
      backupHealth,
      primaryHealth
    });
    const orderedKeys: EmailProviderKey[] = ["resend", "smtp", "future"];

    return orderedKeys
      .map((providerKey) => {
        const healthRecord = findProviderHealth(healthRecords, providerKey);
        if (!healthRecord) {
          return null;
        }

        const role = resolveProviderRole(providerKey);
        const failoverReadinessState =
          role === "primary"
            ? aggregateFailoverState
            : role === "backup"
              ? backupHealth && isBackupCandidateHealth(backupHealth.healthState)
                ? "backup_available"
                : backupHealth?.healthState === "placeholder"
                  ? "primary_only"
                  : "no_backup"
              : "disabled";

        return buildEmailProviderFailoverRecordSafe({
          backupProviderLabel: role === "primary" ? backupLabel : null,
          failoverReadinessState,
          healthRecord,
          primaryProviderLabel: primaryLabel
        });
      })
      .filter((record): record is EmailProviderFailoverRecord => Boolean(record));
  } catch (error) {
    console.error("[email-provider-failover-runtime] provider failover snapshot records build failed", error);
    return [];
  }
}

export function listEmailProviderFailoverReadinessCatalog() {
  return EMAIL_PROVIDER_FAILOVER_READINESS_STATES.map((readinessState) => ({
    description: getEmailProviderFailoverReadinessStateDescription(readinessState),
    label: getEmailProviderFailoverReadinessStateLabel(readinessState),
    readinessState
  }));
}
