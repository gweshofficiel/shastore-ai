import "server-only";

import { filterEmailRegistryItemsByType, type EmailRegistryType } from "@/src/lib/email/email-type-runtime";
import {
  getEmailStatusLabel,
  type EmailRegistryStatus
} from "@/src/lib/email/email-status-runtime";

export type EmailProviderKey = "future" | "resend" | "smtp";

export type EmailProviderType = "api" | "future_placeholder" | "smtp_placeholder";

export type EmailProviderConfigurationStatus = "configured" | "missing" | "partial";

export type EmailProviderHealthStatus = "healthy" | "missing_config" | "placeholder" | "warning";

export type EmailProviderSecretStatus =
  | "masked_configured"
  | "masked_partial"
  | "missing"
  | "no_secret_required";

export type EmailRegistryProviderView = {
  configurationStatus: EmailProviderConfigurationStatus;
  healthStatus: EmailProviderHealthStatus;
  name: string;
  provider: EmailProviderKey;
  secretStatus: EmailProviderSecretStatus;
};

export type EmailProviderRegistryItem = {
  description: string;
  metadata: Record<string, unknown>;
  name: string;
  providerKey: string;
  registryKey: string;
  registryType: EmailRegistryType;
  slug: string;
  status: EmailRegistryStatus;
};

export type EmailProviderCatalogEntry = {
  defaultDescription: string;
  description: string;
  label: string;
  providerKey: EmailProviderKey;
  providerType: EmailProviderType;
};

export type EmailProviderRuntimeRecord = EmailRegistryProviderView & {
  description: string;
  healthLabel: string;
  metadataSummary: string;
  providerKey: EmailProviderKey;
  providerType: EmailProviderType;
  registryKey: string;
  registryStatus: EmailRegistryStatus;
  registryStatusLabel: string;
  slug: string;
};

export type EmailProviderStats = {
  configuredProviders: number;
  futurePlaceholderProviders: number;
  healthyProviders: number;
  missingProviders: number;
  partialProviders: number;
  resendProviders: number;
  smtpPlaceholderProviders: number;
  totalProviders: number;
};

export const EMAIL_PROVIDER_KEYS: readonly EmailProviderKey[] = ["resend", "smtp", "future"] as const;

const secretPattern =
  /(?:api[_-]?key|secret|token|password|private[_-]?key|access[_-]?token|refresh[_-]?token|service[_-]?role|sb_secret|smtp|provider[_-]?config|@[a-z0-9.-]+\.[a-z]{2,})/i;

const providerCatalog: Record<
  EmailProviderKey,
  Omit<EmailProviderCatalogEntry, "providerKey"> & { requiredEnv?: readonly string[] }
> = {
  future: {
    defaultDescription: "Reserved placeholder for future email providers.",
    description: "Future provider placeholder foundation only. No provider execution connected.",
    label: "Future providers placeholder",
    providerType: "future_placeholder"
  },
  resend: {
    defaultDescription: "Primary platform email provider foundation.",
    description: "Resend API provider foundation with masked configuration state only.",
    label: "Resend",
    providerType: "api",
    requiredEnv: ["RESEND_API_KEY", "EMAIL_FROM"]
  },
  smtp: {
    defaultDescription: "SMTP provider placeholder foundation only.",
    description: "SMTP placeholder foundation only. No SMTP connection or credential exposure.",
    label: "SMTP placeholder",
    providerType: "smtp_placeholder",
    requiredEnv: ["SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD"]
  }
};

const healthLabels: Record<EmailProviderHealthStatus, string> = {
  healthy: "Healthy",
  missing_config: "Missing configuration",
  placeholder: "Placeholder",
  warning: "Warning"
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

function safeRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function envVarPresent(name: string) {
  return Boolean(process.env[name]?.trim());
}

function envConfigurationStatus(names: readonly string[]): EmailProviderConfigurationStatus {
  if (!names.length) {
    return "configured";
  }

  const configuredCount = names.filter((name) => envVarPresent(name)).length;

  if (configuredCount === names.length) {
    return "configured";
  }

  return configuredCount > 0 ? "partial" : "missing";
}

function integrationSecretStatus(names: readonly string[]): EmailProviderSecretStatus {
  const status = envConfigurationStatus(names);

  if (!names.length) {
    return "no_secret_required";
  }

  if (status === "configured") {
    return "masked_configured";
  }

  return status === "partial" ? "masked_partial" : "missing";
}

function sanitizeProviderMetadata(metadata: Record<string, unknown>) {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(metadata)) {
    const cleanedKey = text(key, 80);
    if (!cleanedKey || secretPattern.test(cleanedKey)) continue;

    if (typeof value === "string") {
      const cleanedValue = text(value, 240);
      if (!cleanedValue || secretPattern.test(cleanedValue)) continue;
      sanitized[cleanedKey] = cleanedValue;
      continue;
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      sanitized[cleanedKey] = value;
    }
  }

  return sanitized;
}

function buildProviderMetadataSummary(item: EmailProviderRegistryItem) {
  const metadata = sanitizeProviderMetadata(safeRecord(item.metadata));
  const source = text(metadata.source, 120);

  if (source) {
    return `Registry source: ${source}. Email provider foundation only.`;
  }

  if (item.description) {
    return item.description;
  }

  const providerKey = parseEmailProviderKey(item.providerKey);
  return providerKey
    ? providerCatalog[providerKey].defaultDescription
    : "Email provider foundation only.";
}

export function isValidEmailProviderKey(value: unknown): value is EmailProviderKey {
  return typeof value === "string" && EMAIL_PROVIDER_KEYS.includes(value as EmailProviderKey);
}

export function parseEmailProviderKey(value: unknown): EmailProviderKey | null {
  const cleaned = text(value, 80);
  return isValidEmailProviderKey(cleaned) ? cleaned : null;
}

export function getEmailProviderLabel(providerKey: EmailProviderKey) {
  return providerCatalog[providerKey].label;
}

export function getEmailProviderType(providerKey: EmailProviderKey): EmailProviderType {
  return providerCatalog[providerKey].providerType;
}

export function getEmailProviderDescription(providerKey: EmailProviderKey) {
  return providerCatalog[providerKey].description;
}

export function getEmailProviderHealthLabel(healthStatus: EmailProviderHealthStatus) {
  return healthLabels[healthStatus];
}

export function listEmailProviderCatalog(): EmailProviderCatalogEntry[] {
  return EMAIL_PROVIDER_KEYS.map((providerKey) => ({
    ...providerCatalog[providerKey],
    providerKey
  }));
}

export function resolveEmailProviderStatusSafe(providerKey: EmailProviderKey): Pick<
  EmailRegistryProviderView,
  "configurationStatus" | "healthStatus" | "secretStatus"
> {
  if (providerKey === "resend") {
    const resendSelected = process.env.EMAIL_PROVIDER?.trim().toLowerCase() === "resend";
    const requiredEnv = providerCatalog.resend.requiredEnv ?? [];

    return {
      configurationStatus: resendSelected ? envConfigurationStatus(requiredEnv) : "missing",
      healthStatus:
        resendSelected && envVarPresent("RESEND_API_KEY") && envVarPresent("EMAIL_FROM")
          ? "healthy"
          : "missing_config",
      secretStatus: resendSelected ? integrationSecretStatus(requiredEnv) : "missing"
    };
  }

  if (providerKey === "smtp") {
    const requiredEnv = providerCatalog.smtp.requiredEnv ?? [];
    const configurationStatus = envConfigurationStatus(requiredEnv);

    return {
      configurationStatus,
      healthStatus: configurationStatus === "configured" ? "warning" : "placeholder",
      secretStatus: integrationSecretStatus(requiredEnv)
    };
  }

  return {
    configurationStatus: "missing",
    healthStatus: "placeholder",
    secretStatus: "no_secret_required"
  };
}

export function buildEmailProviderRuntimeRecordSafe(
  item: EmailProviderRegistryItem
): EmailProviderRuntimeRecord | null {
  try {
    const providerKey = parseEmailProviderKey(item.providerKey);
    if (!providerKey) return null;

    const status = resolveEmailProviderStatusSafe(providerKey);
    const catalog = providerCatalog[providerKey];

    return {
      ...status,
      description: text(item.description, 2000) || catalog.defaultDescription,
      healthLabel: getEmailProviderHealthLabel(status.healthStatus),
      metadataSummary: buildProviderMetadataSummary(item),
      name: text(item.name, 200) || catalog.label,
      provider: providerKey,
      providerKey,
      providerType: catalog.providerType,
      registryKey: text(item.registryKey, 160) || `${providerKey}-provider`,
      registryStatus: item.status,
      registryStatusLabel: getEmailStatusLabel(item.status),
      slug: text(item.slug, 160) || providerKey
    };
  } catch (error) {
    console.error("[email-provider-runtime] provider record build failed", error);
    return null;
  }
}

export function buildEmailProviderViewsSafe(
  items: EmailProviderRegistryItem[] | null | undefined
): EmailRegistryProviderView[] {
  try {
    const providerItems = filterEmailRegistryItemsByType(
      Array.isArray(items) ? items : [],
      "provider"
    );

    return providerItems
      .map((item) => {
        const record = buildEmailProviderRuntimeRecordSafe(item);
        if (!record) return null;

        return {
          configurationStatus: record.configurationStatus,
          healthStatus: record.healthStatus,
          name: record.name,
          provider: record.provider,
          secretStatus: record.secretStatus
        };
      })
      .filter((provider): provider is EmailRegistryProviderView => Boolean(provider));
  } catch (error) {
    console.error("[email-provider-runtime] provider view build failed", error);
    return [];
  }
}

export function buildEmailProviderRuntimeRecordsSafe(
  items: EmailProviderRegistryItem[] | null | undefined
): EmailProviderRuntimeRecord[] {
  try {
    const providerItems = filterEmailRegistryItemsByType(
      Array.isArray(items) ? items : [],
      "provider"
    );

    return providerItems
      .map((item) => buildEmailProviderRuntimeRecordSafe(item))
      .filter((record): record is EmailProviderRuntimeRecord => Boolean(record));
  } catch (error) {
    console.error("[email-provider-runtime] provider runtime records build failed", error);
    return [];
  }
}

export function buildEmailProviderStatsSafe(
  items: EmailProviderRegistryItem[] | null | undefined
): EmailProviderStats {
  try {
    const records = buildEmailProviderRuntimeRecordsSafe(items);

    return {
      configuredProviders: records.filter((record) => record.configurationStatus === "configured").length,
      futurePlaceholderProviders: records.filter((record) => record.providerKey === "future").length,
      healthyProviders: records.filter((record) => record.healthStatus === "healthy").length,
      missingProviders: records.filter((record) => record.configurationStatus === "missing").length,
      partialProviders: records.filter((record) => record.configurationStatus === "partial").length,
      resendProviders: records.filter((record) => record.providerKey === "resend").length,
      smtpPlaceholderProviders: records.filter((record) => record.providerKey === "smtp").length,
      totalProviders: records.length
    };
  } catch (error) {
    console.error("[email-provider-runtime] provider stats build failed", error);

    return {
      configuredProviders: 0,
      futurePlaceholderProviders: 0,
      healthyProviders: 0,
      missingProviders: 0,
      partialProviders: 0,
      resendProviders: 0,
      smtpPlaceholderProviders: 0,
      totalProviders: 0
    };
  }
}
