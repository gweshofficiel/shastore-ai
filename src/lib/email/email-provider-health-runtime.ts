import "server-only";

import {
  buildEmailProviderRuntimeRecordsSafe,
  getEmailProviderLabel,
  type EmailProviderConfigurationStatus,
  type EmailProviderKey,
  type EmailProviderRegistryItem,
  type EmailProviderRuntimeRecord
} from "@/src/lib/email/email-provider-runtime";
import type { EmailRegistryStatus } from "@/src/lib/email/email-status-runtime";

export type EmailProviderHealthState =
  | "degraded"
  | "failed"
  | "healthy"
  | "missing_config"
  | "monitoring"
  | "not_configured"
  | "placeholder"
  | "unknown";

export type EmailProviderHealthBadgeTone = "amber" | "blue" | "green" | "red" | "slate";

export type EmailProviderHealthRegistryItem = EmailProviderRegistryItem & {
  updatedAt?: string | null;
};

export type EmailProviderHealthRecord = {
  configurationState: EmailProviderConfigurationStatus;
  healthLabel: string;
  healthState: EmailProviderHealthState;
  lastCheckedLabel: string;
  metadataSummary: string;
  providerKey: EmailProviderKey;
  providerLabel: string;
};

export type EmailProviderHealthStats = {
  degradedProviders: number;
  failedProviders: number;
  healthyProviders: number;
  missingConfigProviders: number;
  monitoringProviders: number;
  notConfiguredProviders: number;
  placeholderProviders: number;
  totalProviders: number;
  unknownProviders: number;
};

export const EMAIL_PROVIDER_HEALTH_STATES: readonly EmailProviderHealthState[] = [
  "healthy",
  "degraded",
  "failed",
  "missing_config",
  "not_configured",
  "placeholder",
  "monitoring",
  "unknown"
] as const;

const healthStateLabels: Record<EmailProviderHealthState, string> = {
  degraded: "Degraded readiness",
  failed: "Failed foundation state",
  healthy: "Healthy readiness",
  missing_config: "Missing configuration",
  monitoring: "Monitoring only",
  not_configured: "Not configured",
  placeholder: "Placeholder",
  unknown: "Unknown"
};

const healthStateDescriptions: Record<EmailProviderHealthState, string> = {
  degraded: "Partial masked configuration detected. No live provider health check executed.",
  failed: "Registry foundation reports a failed state. No provider execution connected.",
  healthy: "Masked configuration readiness looks complete. No live provider health check executed.",
  missing_config: "Required masked configuration is incomplete. No provider secrets exposed.",
  monitoring: "Monitoring-only foundation state from registry metadata.",
  not_configured: "Provider is not selected or configured for platform email delivery.",
  placeholder: "Reserved provider placeholder. No live health check or execution connected.",
  unknown: "Provider health readiness could not be resolved safely."
};

const badgeToneByHealthState: Record<EmailProviderHealthState, EmailProviderHealthBadgeTone> = {
  degraded: "amber",
  failed: "red",
  healthy: "green",
  missing_config: "red",
  monitoring: "blue",
  not_configured: "red",
  placeholder: "blue",
  unknown: "amber"
};

function text(value: unknown, maxLength = 500) {
  if (typeof value !== "string") return "";

  return value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/\bjavascript:/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function resendSelected() {
  return process.env.EMAIL_PROVIDER?.trim().toLowerCase() === "resend";
}

export function isValidEmailProviderHealthState(value: unknown): value is EmailProviderHealthState {
  return typeof value === "string" && EMAIL_PROVIDER_HEALTH_STATES.includes(value as EmailProviderHealthState);
}

export function parseEmailProviderHealthState(value: unknown): EmailProviderHealthState | null {
  const cleaned = text(value, 80);
  return isValidEmailProviderHealthState(cleaned) ? cleaned : null;
}

export function getEmailProviderHealthStateLabel(state: EmailProviderHealthState) {
  return healthStateLabels[state];
}

export function getEmailProviderHealthStateDescription(state: EmailProviderHealthState) {
  return healthStateDescriptions[state];
}

export function getEmailProviderHealthBadgeTone(state: EmailProviderHealthState): EmailProviderHealthBadgeTone {
  return badgeToneByHealthState[state];
}

export function resolveEmailProviderHealthStateSafe(
  record: EmailProviderRuntimeRecord,
  registryStatus?: EmailRegistryStatus | null
): EmailProviderHealthState {
  const status = registryStatus ?? record.registryStatus;

  if (status === "failed") {
    return "failed";
  }

  if (status === "monitoring") {
    return "monitoring";
  }

  if (record.providerKey === "future") {
    return "placeholder";
  }

  if (record.providerKey === "resend") {
    if (!resendSelected()) {
      return "not_configured";
    }

    if (record.configurationStatus === "configured" && record.healthStatus === "healthy") {
      return "healthy";
    }

    if (record.configurationStatus === "partial") {
      return "degraded";
    }

    return "missing_config";
  }

  if (record.providerKey === "smtp") {
    if (record.configurationStatus === "configured") {
      return "degraded";
    }

    if (record.configurationStatus === "partial") {
      return "degraded";
    }

    return "placeholder";
  }

  if (status === "unknown") {
    return "unknown";
  }

  if (record.healthStatus === "healthy") {
    return "healthy";
  }

  if (record.healthStatus === "warning") {
    return "degraded";
  }

  if (record.healthStatus === "placeholder") {
    return "placeholder";
  }

  if (record.healthStatus === "missing_config") {
    return record.configurationStatus === "missing" ? "not_configured" : "missing_config";
  }

  return "unknown";
}

export function resolveEmailProviderLastCheckedLabelSafe(item?: EmailProviderHealthRegistryItem | null) {
  const updatedAt = text(item?.updatedAt, 80);

  if (updatedAt) {
    return `Registry reference only (${updatedAt.slice(0, 10)})`;
  }

  return "Not checked live";
}

export function buildEmailProviderHealthRecordSafe(
  record: EmailProviderRuntimeRecord,
  item?: EmailProviderHealthRegistryItem | null
): EmailProviderHealthRecord {
  const healthState = resolveEmailProviderHealthStateSafe(record, item?.status ?? record.registryStatus);

  return {
    configurationState: record.configurationStatus,
    healthLabel: getEmailProviderHealthStateLabel(healthState),
    healthState,
    lastCheckedLabel: resolveEmailProviderLastCheckedLabelSafe(item),
    metadataSummary: record.metadataSummary,
    providerKey: record.providerKey,
    providerLabel: text(record.name, 200) || getEmailProviderLabel(record.providerKey)
  };
}

export function buildEmailProviderHealthRecordsSafe(
  items: EmailProviderHealthRegistryItem[] | null | undefined
): EmailProviderHealthRecord[] {
  try {
    const providerRecords = buildEmailProviderRuntimeRecordsSafe(items);
    const itemsByKey = new Map<string, EmailProviderHealthRegistryItem>();

    for (const item of Array.isArray(items) ? items : []) {
      const registryKey = text(item.registryKey, 160);
      const providerKey = text(item.providerKey, 80);

      if (registryKey) {
        itemsByKey.set(registryKey, item);
      }

      if (providerKey) {
        itemsByKey.set(providerKey, item);
      }
    }

    return providerRecords.map((record) =>
      buildEmailProviderHealthRecordSafe(
        record,
        itemsByKey.get(record.registryKey) ?? itemsByKey.get(record.providerKey) ?? null
      )
    );
  } catch (error) {
    console.error("[email-provider-health-runtime] provider health records build failed", error);
    return [];
  }
}

export function buildEmailProviderHealthStatsSafe(
  items: EmailProviderHealthRegistryItem[] | null | undefined
): EmailProviderHealthStats {
  try {
    const records = buildEmailProviderHealthRecordsSafe(items);

    return {
      degradedProviders: records.filter((record) => record.healthState === "degraded").length,
      failedProviders: records.filter((record) => record.healthState === "failed").length,
      healthyProviders: records.filter((record) => record.healthState === "healthy").length,
      missingConfigProviders: records.filter((record) => record.healthState === "missing_config").length,
      monitoringProviders: records.filter((record) => record.healthState === "monitoring").length,
      notConfiguredProviders: records.filter((record) => record.healthState === "not_configured").length,
      placeholderProviders: records.filter((record) => record.healthState === "placeholder").length,
      totalProviders: records.length,
      unknownProviders: records.filter((record) => record.healthState === "unknown").length
    };
  } catch (error) {
    console.error("[email-provider-health-runtime] provider health stats build failed", error);

    return {
      degradedProviders: 0,
      failedProviders: 0,
      healthyProviders: 0,
      missingConfigProviders: 0,
      monitoringProviders: 0,
      notConfiguredProviders: 0,
      placeholderProviders: 0,
      totalProviders: 0,
      unknownProviders: 0
    };
  }
}

export function listEmailProviderHealthCatalog() {
  return EMAIL_PROVIDER_HEALTH_STATES.map((healthState) => ({
    badgeTone: getEmailProviderHealthBadgeTone(healthState),
    description: getEmailProviderHealthStateDescription(healthState),
    healthState,
    label: getEmailProviderHealthStateLabel(healthState)
  }));
}
