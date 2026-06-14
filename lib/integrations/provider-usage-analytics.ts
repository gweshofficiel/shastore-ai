import "server-only";
import { getAdminAccess } from "@/lib/admin-access";
import { integrationDefinitions } from "@/lib/integrations/catalog";
import { maskIntegrationDiagnostic, maskSensitiveText } from "@/lib/integrations/safe-diagnostics";
import { createAdminClient } from "@/lib/supabase/admin";

export type ProviderUsageRange = "all_time" | "last_30_days" | "last_7_days" | "today";

export type ProviderUsageCategory =
  | "AI"
  | "Analytics"
  | "Domains"
  | "Email"
  | "Hosting"
  | "Payments"
  | "Placeholder"
  | "SMS"
  | "Storage"
  | "Webhooks";

export type ProviderUsageRow = {
  averageResponseTimeMs: number | null;
  category: ProviderUsageCategory;
  consecutiveFailures: number;
  diagnosticsRuns: number;
  failedOperations: number;
  failureRate: number;
  healthChecks: number;
  lastFailure: string | null;
  lastSuccess: string | null;
  providerKey: string;
  providerName: string;
  skippedOperations: number;
  successfulOperations: number;
  totalOperations: number;
  webhookEvents: number;
};

export type ProviderFailureBreakdownRow = {
  count: number;
  errorCode: string;
  lastSeen: string | null;
  providerKey: string;
  providerName: string;
};

export type ProviderUsageSummary = {
  averageResponseTimeMs: number | null;
  failedOperations: number;
  failureBreakdown: ProviderFailureBreakdownRow[];
  failureRate: number;
  providers: ProviderUsageRow[];
  range: ProviderUsageRange;
  skippedOperations: number;
  successfulOperations: number;
  totalOperations: number;
  webhookEvents: number;
};

type AdminClient = {
  from: (table: string) => unknown;
};

type ReadTable = {
  select: (columns: string) => {
    order: (column: string, options: { ascending: boolean }) => {
      limit: (limit: number) => PromiseLike<{
        data: unknown[] | null;
        error: { message: string } | null;
      }>;
    };
  };
};

type HealthTable = {
  select: (columns: string) => {
    order: (column: string, options: { ascending: boolean }) => PromiseLike<{
      data: unknown[] | null;
      error: { message: string } | null;
    }>;
  };
};

type OperationStatus = "failed" | "skipped" | "success";

type OperationEvent = {
  errorCode: string | null;
  operation: string;
  providerKey: string;
  responseTimeMs: number | null;
  status: OperationStatus;
  timestamp: string;
  webhook: boolean;
};

type HealthSnapshot = {
  consecutiveFailures: number;
  lastFailure: string | null;
  lastSuccess: string | null;
  providerKey: string;
  responseTimeMs: number | null;
};

const MAX_ANALYTICS_ROWS = 1500;
const ranges: ProviderUsageRange[] = ["today", "last_7_days", "last_30_days", "all_time"];

function requireSuperAdmin(access: Awaited<ReturnType<typeof getAdminAccess>>) {
  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can access provider usage analytics.");
  }
}

function table(client: AdminClient, tableName: string) {
  return client.from(tableName) as ReadTable;
}

function healthTable(client: AdminClient) {
  return client.from("integration_health_states") as HealthTable;
}

function cleanText(value: unknown, maxLength = 500) {
  return typeof value === "string" ? maskSensitiveText(value.trim()).slice(0, maxLength) : "";
}

function cleanNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function cleanDate(value: unknown) {
  const cleaned = cleanText(value, 80);

  if (!cleaned) {
    return null;
  }

  const timestamp = Date.parse(cleaned);

  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function safeRange(value: unknown): ProviderUsageRange {
  return ranges.includes(value as ProviderUsageRange) ? (value as ProviderUsageRange) : "last_7_days";
}

function rangeStart(range: ProviderUsageRange) {
  const now = new Date();

  if (range === "today") {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  }

  if (range === "last_7_days") {
    return Date.now() - 7 * 24 * 60 * 60 * 1000;
  }

  if (range === "last_30_days") {
    return Date.now() - 30 * 24 * 60 * 60 * 1000;
  }

  return null;
}

function inRange(timestamp: string | null, range: ProviderUsageRange) {
  if (!timestamp) {
    return false;
  }

  const start = rangeStart(range);

  return !start || Date.parse(timestamp) >= start;
}

function providerName(providerKey: string) {
  return integrationDefinitions.find((provider) => provider.key === providerKey)?.name ?? providerKey;
}

function providerCategory(providerKey: string): ProviderUsageCategory {
  const definition = integrationDefinitions.find((provider) => provider.key === providerKey);
  const category = definition?.category ?? "";

  if (!definition || definition.requiredEnv.length === 0) return "Placeholder";
  if (category.includes("AI")) return "AI";
  if (category.includes("Analytics")) return "Analytics";
  if (category.includes("Domain")) {
    if (providerKey === "hosting_service") return "Hosting";
    if (providerKey === "email_service") return "Email";
    return "Domains";
  }
  if (category.includes("Email")) return "Email";
  if (category.includes("Payment")) return "Payments";
  if (category.includes("SMS") || category.includes("WhatsApp")) return "SMS";
  if (category.includes("Storage")) return "Storage";
  if (category.includes("Webhook")) return "Webhooks";

  return "Placeholder";
}

function normalizedProviderKey(value: unknown) {
  const key = cleanText(value, 120).toLowerCase();

  if (!key) return "unknown";
  if (key.includes("stripe")) return "stripe";
  if (key.includes("nowpayments")) return "nowpayments";
  if (key.includes("paypal_platform")) return "paypal_platform";
  if (key === "paypal") return "paypal";
  if (key.includes("youcan")) return "youcan_pay";
  if (key.includes("openai")) return "openai";
  if (key.includes("resend")) return "resend";
  if (key.includes("httpapi") || key.includes("domain")) return "domain_service";

  return key;
}

function operationFromAudit(row: unknown): OperationEvent | null {
  if (!isRecord(row)) return null;

  const timestamp = cleanDate(row.created_at);
  const providerKey = normalizedProviderKey(row.provider_key);
  const status = cleanText(row.status, 40);
  const safeSummary = maskIntegrationDiagnostic(row.safe_summary);
  const summary = isRecord(safeSummary) ? safeSummary : {};
  const responseTimeMs = cleanNumber(summary.responseTimeMs) ?? cleanNumber(summary.response_time_ms);

  if (!timestamp || !providerKey) return null;

  return {
    errorCode: cleanText(row.error_code, 160) || null,
    operation: cleanText(row.operation, 160) || "integration_operation",
    providerKey,
    responseTimeMs,
    status: status === "success" ? "success" : status === "skipped" ? "skipped" : "failed",
    timestamp,
    webhook: false
  };
}

function operationFromWebhook(row: unknown): OperationEvent | null {
  if (!isRecord(row)) return null;

  const timestamp = cleanDate(row.created_at);
  const providerKey = normalizedProviderKey(row.provider_key);
  const status = cleanText(row.status, 40);

  if (!timestamp || !providerKey) return null;

  return {
    errorCode: cleanText(row.error_code, 160) || null,
    operation: `webhook:${cleanText(row.event_type, 160) || "unknown"}`,
    providerKey,
    responseTimeMs: null,
    status: status === "processed" ? "success" : status === "ignored" ? "skipped" : status === "failed" ? "failed" : "skipped",
    timestamp,
    webhook: true
  };
}

function operationFromBilling(row: unknown): OperationEvent | null {
  if (!isRecord(row)) return null;

  const timestamp = cleanDate(row.processed_at) ?? cleanDate(row.created_at);
  const providerKey = normalizedProviderKey(row.provider);
  const eventType = cleanText(row.event_type, 160);

  if (!timestamp || !providerKey || !eventType) return null;

  return {
    errorCode: eventType.toLowerCase().includes("failed") ? eventType : null,
    operation: `billing:${eventType}`,
    providerKey,
    responseTimeMs: null,
    status: eventType.toLowerCase().includes("failed") ? "failed" : eventType.toLowerCase().includes("skipped") ? "skipped" : "success",
    timestamp,
    webhook: false
  };
}

function operationFromMonitoring(row: unknown): OperationEvent | null {
  if (!isRecord(row)) return null;

  const timestamp = cleanDate(row.created_at);
  const metadata = isRecord(row.metadata) ? row.metadata : {};
  const providerKey = normalizedProviderKey(
    metadata.provider_key ??
    metadata.providerKey ??
    metadata.provider ??
    metadata.integration_key ??
    row.entity_type
  );
  const eventType = cleanText(row.event_type, 160);
  const eventStatus = cleanText(row.event_status, 40);

  if (!timestamp || !providerKey || providerKey === "unknown") return null;

  return {
    errorCode: eventStatus === "failed" ? eventType : null,
    operation: `monitoring:${eventType}`,
    providerKey,
    responseTimeMs: cleanNumber(metadata.response_time_ms) ?? cleanNumber(metadata.responseTimeMs),
    status: eventStatus === "failed" ? "failed" : eventStatus === "success" ? "success" : "skipped",
    timestamp,
    webhook: false
  };
}

function healthFromRow(row: unknown): HealthSnapshot | null {
  if (!isRecord(row)) return null;

  const providerKey = normalizedProviderKey(row.provider_key);

  if (!providerKey) return null;

  return {
    consecutiveFailures: cleanNumber(row.consecutive_failures) ?? 0,
    lastFailure: cleanDate(row.last_failure_at),
    lastSuccess: cleanDate(row.last_success_at),
    providerKey,
    responseTimeMs: cleanNumber(row.response_time_ms)
  };
}

async function safeRead(client: AdminClient, tableName: string, columns: string, orderColumn = "created_at") {
  const { data, error } = await table(client, tableName)
    .select(columns)
    .order(orderColumn, { ascending: false })
    .limit(MAX_ANALYTICS_ROWS);

  if (error) {
    return [];
  }

  return data ?? [];
}

async function readHealth(client: AdminClient) {
  const { data, error } = await healthTable(client)
    .select("provider_key, consecutive_failures, last_success_at, last_failure_at, response_time_ms")
    .order("provider_key", { ascending: true });

  if (error) {
    return [];
  }

  return (data ?? [])
    .map(healthFromRow)
    .filter((row): row is HealthSnapshot => Boolean(row));
}

async function readAnalyticsSources(range: ProviderUsageRange) {
  const access = await getAdminAccess();
  requireSuperAdmin(access);

  const admin = createAdminClient();

  if (!admin) {
    return { health: [], operations: [] };
  }

  const [auditRows, webhookRows, billingRows, monitoringRows, health] = await Promise.all([
    safeRead(admin, "integration_audit_logs", "provider_key, operation, status, error_code, safe_summary, created_at"),
    safeRead(admin, "integration_webhook_events", "provider_key, event_type, status, error_code, created_at"),
    safeRead(admin, "billing_events", "provider, event_type, processed_at, created_at", "created_at"),
    safeRead(admin, "monitoring_events", "entity_type, event_type, event_status, metadata, created_at"),
    readHealth(admin)
  ]);
  const operations = [
    ...auditRows.map(operationFromAudit),
    ...webhookRows.map(operationFromWebhook),
    ...billingRows.map(operationFromBilling),
    ...monitoringRows.map(operationFromMonitoring)
  ].filter((event): event is OperationEvent => Boolean(event))
    .filter((event) => inRange(event.timestamp, range));

  return { health, operations };
}

function emptyProviderRow(providerKey: string): ProviderUsageRow & { responseSamples: number[] } {
  return {
    averageResponseTimeMs: null,
    category: providerCategory(providerKey),
    consecutiveFailures: 0,
    diagnosticsRuns: 0,
    failedOperations: 0,
    failureRate: 0,
    healthChecks: 0,
    lastFailure: null,
    lastSuccess: null,
    providerKey,
    providerName: providerName(providerKey),
    responseSamples: [],
    skippedOperations: 0,
    successfulOperations: 0,
    totalOperations: 0,
    webhookEvents: 0
  };
}

function latest(left: string | null, right: string | null) {
  if (!left) return right;
  if (!right) return left;

  return Date.parse(right) > Date.parse(left) ? right : left;
}

function average(values: number[]) {
  if (!values.length) return null;

  return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
}

function aggregateProviderRows(operations: OperationEvent[], health: HealthSnapshot[]) {
  const rows = new Map<string, ProviderUsageRow & { responseSamples: number[] }>();
  const ensureRow = (providerKey: string) => {
    const key = providerKey || "unknown";
    const row = rows.get(key) ?? emptyProviderRow(key);

    rows.set(key, row);

    return row;
  };

  for (const definition of integrationDefinitions) {
    ensureRow(definition.key);
  }

  for (const event of operations) {
    const row = ensureRow(event.providerKey);

    row.totalOperations += 1;
    if (event.status === "success") {
      row.successfulOperations += 1;
      row.lastSuccess = latest(row.lastSuccess, event.timestamp);
    } else if (event.status === "failed") {
      row.failedOperations += 1;
      row.lastFailure = latest(row.lastFailure, event.timestamp);
    } else {
      row.skippedOperations += 1;
    }

    if (event.webhook) row.webhookEvents += 1;
    if (event.operation === "provider_health_check") row.healthChecks += 1;
    if (event.operation === "provider_diagnostic") row.diagnosticsRuns += 1;
    if (event.responseTimeMs !== null) row.responseSamples.push(event.responseTimeMs);
  }

  for (const snapshot of health) {
    const row = ensureRow(snapshot.providerKey);

    row.consecutiveFailures = snapshot.consecutiveFailures;
    row.lastSuccess = latest(row.lastSuccess, snapshot.lastSuccess);
    row.lastFailure = latest(row.lastFailure, snapshot.lastFailure);
    if (snapshot.responseTimeMs !== null) row.responseSamples.push(snapshot.responseTimeMs);
  }

  return [...rows.values()]
    .map((row) => ({
      ...row,
      averageResponseTimeMs: average(row.responseSamples),
      failureRate: row.totalOperations ? Math.round((row.failedOperations / row.totalOperations) * 1000) / 10 : 0
    }))
    .sort((left, right) => right.totalOperations - left.totalOperations || left.providerName.localeCompare(right.providerName));
}

function buildFailureBreakdown(operations: OperationEvent[]) {
  const breakdown = new Map<string, ProviderFailureBreakdownRow>();

  for (const operation of operations) {
    if (operation.status !== "failed") continue;

    const errorCode = operation.errorCode || "unknown_error";
    const key = `${operation.providerKey}:${errorCode}`;
    const current = breakdown.get(key) ?? {
      count: 0,
      errorCode,
      lastSeen: null,
      providerKey: operation.providerKey,
      providerName: providerName(operation.providerKey)
    };

    current.count += 1;
    current.lastSeen = latest(current.lastSeen, operation.timestamp);
    breakdown.set(key, current);
  }

  return [...breakdown.values()]
    .sort((left, right) => right.count - left.count || Date.parse(right.lastSeen ?? "0") - Date.parse(left.lastSeen ?? "0"))
    .slice(0, 50);
}

function summarize(range: ProviderUsageRange, operations: OperationEvent[], health: HealthSnapshot[]): ProviderUsageSummary {
  const providers = aggregateProviderRows(operations, health);
  const responseSamples = providers
    .map((provider) => provider.averageResponseTimeMs)
    .filter((value): value is number => value !== null);
  const totalOperations = providers.reduce((total, provider) => total + provider.totalOperations, 0);
  const failedOperations = providers.reduce((total, provider) => total + provider.failedOperations, 0);

  return {
    averageResponseTimeMs: average(responseSamples),
    failedOperations,
    failureBreakdown: buildFailureBreakdown(operations),
    failureRate: totalOperations ? Math.round((failedOperations / totalOperations) * 1000) / 10 : 0,
    providers,
    range,
    skippedOperations: providers.reduce((total, provider) => total + provider.skippedOperations, 0),
    successfulOperations: providers.reduce((total, provider) => total + provider.successfulOperations, 0),
    totalOperations,
    webhookEvents: providers.reduce((total, provider) => total + provider.webhookEvents, 0)
  };
}

export async function getProviderUsageSummary(rangeInput: ProviderUsageRange) {
  const range = safeRange(rangeInput);
  const { health, operations } = await readAnalyticsSources(range);

  return summarize(range, operations, health);
}

export async function getProviderUsageByProvider(providerKey: string, rangeInput: ProviderUsageRange) {
  const summary = await getProviderUsageSummary(rangeInput);
  const key = normalizedProviderKey(providerKey);

  return summary.providers.find((provider) => provider.providerKey === key) ?? emptyProviderRow(key);
}

export async function getProviderFailureBreakdown(rangeInput: ProviderUsageRange) {
  const summary = await getProviderUsageSummary(rangeInput);

  return summary.failureBreakdown;
}
