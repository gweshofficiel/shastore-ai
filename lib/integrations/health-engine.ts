import "server-only";
import { getAdminAccess } from "@/lib/admin-access";
import { integrationDefinitions, type IntegrationDefinition } from "@/lib/integrations/catalog";
import { createAdminClient } from "@/lib/supabase/admin";

export type IntegrationHealthStatus =
  | "not_checked"
  | "healthy"
  | "degraded"
  | "failed"
  | "disabled"
  | "missing_config"
  | "placeholder";

export type IntegrationHealthState = {
  category: string;
  configured: boolean;
  consecutiveFailures: number;
  createdAt: string | null;
  enabled: boolean;
  failureCount: number;
  id: string | null;
  lastCheckedAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  lastFailureAt: string | null;
  lastSafeResponseSummary: Record<string, unknown>;
  lastSuccessAt: string | null;
  mode: "live" | "test" | "sandbox" | "placeholder";
  providerKey: string;
  providerName: string;
  responseTimeMs: number | null;
  status: IntegrationHealthStatus;
  updatedAt: string | null;
};

type HealthCheckResult = {
  configured: boolean;
  errorCode: string | null;
  errorMessage: string | null;
  responseTimeMs: number;
  safeSummary: Record<string, unknown>;
  status: IntegrationHealthStatus;
};

type HealthTable = {
  select: (columns: string) => {
    order: (column: string, options: { ascending: boolean }) => PromiseLike<{
      data: unknown[] | null;
      error: { message: string } | null;
    }>;
  };
  upsert: (
    values: never,
    options: { onConflict: string }
  ) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>;
};

type MonitoringEventsTable = {
  insert: (values: never) => PromiseLike<{ error: { message: string } | null }>;
};

type AdminClient = {
  from: (table: string) => unknown;
};

const HEALTH_CHECK_TIMEOUT_MS = 3000;
const sensitiveKeyParts = [
  "apikey",
  "api_key",
  "api-key",
  "authorization",
  "bearer",
  "key",
  "password",
  "private_key",
  "privatekey",
  "secret",
  "token",
  "webhook_secret",
  "webhooksecret"
];
const statusValues: IntegrationHealthStatus[] = [
  "not_checked",
  "healthy",
  "degraded",
  "failed",
  "disabled",
  "missing_config",
  "placeholder"
];

function normalizedKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9_-]/g, "");
}

function isSensitiveKey(value: string) {
  const key = normalizedKey(value);

  return sensitiveKeyParts.some((part) => key.includes(normalizedKey(part)));
}

function maskSensitiveText(value: string) {
  return value
    .replace(
      /((?:api[-_]?key|apikey|key|token|secret|password|auth|authorization|bearer|private[-_]?key|webhook[-_]?secret)=)[^&\s"']+/gi,
      "$1[redacted]"
    )
    .replace(
      /((?:api[-_]?key|apikey|key|token|secret|password|auth|authorization|bearer|private[-_]?key|webhook[-_]?secret)["']?\s*:\s*["']?)[^"',}\s]+/gi,
      "$1[redacted]"
    )
    .slice(0, 500);
}

export function maskIntegrationDiagnostic(value: unknown): unknown {
  if (typeof value === "string") {
    return maskSensitiveText(value);
  }

  if (typeof value === "number" || typeof value === "boolean" || value === null) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => maskIntegrationDiagnostic(item));
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => [
      key,
      isSensitiveKey(key) ? "[redacted]" : maskIntegrationDiagnostic(nestedValue)
    ])
  );
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function integrationMode(providerKey: string): IntegrationHealthState["mode"] {
  if (providerKey === "paypal" || providerKey === "paypal_platform") {
    return process.env.PAYPAL_ENVIRONMENT === "live" ? "live" : "sandbox";
  }

  if (["cloudflare_r2", "domain_service", "email_service", "nowpayments", "openai", "resend", "stripe", "youcan_pay"].includes(providerKey)) {
    return process.env.NODE_ENV === "production" ? "live" : "test";
  }

  return "placeholder";
}

function envCounts(requiredEnv: string[]) {
  const configuredCount = requiredEnv.filter((name) => Boolean(process.env[name]?.trim())).length;

  return {
    configuredCount,
    missingCount: Math.max(0, requiredEnv.length - configuredCount),
    requiredCount: requiredEnv.length
  };
}

function providerStatusFromEnv(definition: IntegrationDefinition): Pick<HealthCheckResult, "configured" | "errorCode" | "errorMessage" | "safeSummary" | "status"> {
  const counts = envCounts(definition.requiredEnv);

  if (!counts.requiredCount) {
    return {
      configured: false,
      errorCode: null,
      errorMessage: null,
      safeSummary: {
        checkType: "placeholder",
        message: "Provider is reserved for a later runtime phase.",
        providerKey: definition.key,
        requiredConfigCount: 0
      },
      status: "placeholder"
    };
  }

  if (counts.configuredCount === counts.requiredCount) {
    return {
      configured: true,
      errorCode: null,
      errorMessage: null,
      safeSummary: {
        checkType: definition.key === "platform_webhooks" ? "route_config_presence_only" : "env_presence_only",
        configuredConfigCount: counts.configuredCount,
        mutationPerformed: false,
        providerKey: definition.key,
        requiredConfigCount: counts.requiredCount
      },
      status: "healthy"
    };
  }

  if (counts.configuredCount > 0) {
    return {
      configured: false,
      errorCode: "partial_config",
      errorMessage: "Required provider configuration is partially present.",
      safeSummary: {
        checkType: definition.key === "platform_webhooks" ? "route_config_presence_only" : "env_presence_only",
        configuredConfigCount: counts.configuredCount,
        missingConfigCount: counts.missingCount,
        mutationPerformed: false,
        providerKey: definition.key,
        requiredConfigCount: counts.requiredCount
      },
      status: "degraded"
    };
  }

  return {
    configured: false,
    errorCode: "missing_config",
    errorMessage: "Required provider configuration is missing.",
    safeSummary: {
      checkType: definition.key === "platform_webhooks" ? "route_config_presence_only" : "env_presence_only",
      configuredConfigCount: 0,
      missingConfigCount: counts.missingCount,
      mutationPerformed: false,
      providerKey: definition.key,
      requiredConfigCount: counts.requiredCount
    },
    status: "missing_config"
  };
}

function table(client: AdminClient) {
  return client.from("integration_health_states") as HealthTable;
}

function monitoringEventsTable(client: AdminClient) {
  return client.from("monitoring_events") as MonitoringEventsTable;
}

function parseHealthRow(row: unknown): IntegrationHealthState | null {
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    return null;
  }

  const value = row as Record<string, unknown>;
  const providerKey = cleanText(value.provider_key);
  const status = cleanText(value.status) as IntegrationHealthStatus;

  if (!providerKey) {
    return null;
  }

  return {
    category: cleanText(value.category),
    configured: Boolean(value.configured),
    consecutiveFailures: cleanNumber(value.consecutive_failures) ?? 0,
    createdAt: cleanText(value.created_at) || null,
    enabled: Boolean(value.enabled),
    failureCount: cleanNumber(value.failure_count) ?? 0,
    id: cleanText(value.id) || null,
    lastCheckedAt: cleanText(value.last_checked_at) || null,
    lastErrorCode: cleanText(value.last_error_code) || null,
    lastErrorMessage: cleanText(value.last_error_message) || null,
    lastFailureAt: cleanText(value.last_failure_at) || null,
    lastSafeResponseSummary: (maskIntegrationDiagnostic(value.last_safe_response_summary) ?? {}) as Record<string, unknown>,
    lastSuccessAt: cleanText(value.last_success_at) || null,
    mode: (cleanText(value.mode) as IntegrationHealthState["mode"]) || "placeholder",
    providerKey,
    providerName: cleanText(value.provider_name),
    responseTimeMs: cleanNumber(value.response_time_ms),
    status: statusValues.includes(status) ? status : "not_checked",
    updatedAt: cleanText(value.updated_at) || null
  };
}

function defaultHealthState(definition: IntegrationDefinition): IntegrationHealthState {
  const counts = envCounts(definition.requiredEnv);
  const configured = counts.requiredCount > 0 && counts.configuredCount === counts.requiredCount;

  return {
    category: definition.category,
    configured,
    consecutiveFailures: 0,
    createdAt: null,
    enabled: configured,
    failureCount: 0,
    id: null,
    lastCheckedAt: null,
    lastErrorCode: null,
    lastErrorMessage: null,
    lastFailureAt: null,
    lastSafeResponseSummary: {},
    lastSuccessAt: null,
    mode: integrationMode(definition.key),
    providerKey: definition.key,
    providerName: definition.name,
    responseTimeMs: null,
    status: definition.requiredEnv.length ? "not_checked" : "placeholder",
    updatedAt: null
  };
}

function requireSuperAdmin(access: Awaited<ReturnType<typeof getAdminAccess>>) {
  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can access integration health checks.");
  }
}

async function logHealthEvent({
  access,
  eventStatus,
  eventType,
  metadata
}: {
  access: Awaited<ReturnType<typeof getAdminAccess>>;
  eventStatus: "failed" | "info" | "success";
  eventType: string;
  metadata: Record<string, unknown>;
}) {
  const admin = createAdminClient();

  if (!admin) {
    return;
  }

  await monitoringEventsTable(admin).insert({
    entity_id: null,
    entity_type: "admin_integration_health",
    event_status: eventStatus,
    event_type: eventType,
    metadata: maskIntegrationDiagnostic(metadata),
    store_id: null,
    user_id: access.user.id,
    workspace_id: null
  } as never);
}

async function runPresenceCheck(definition: IntegrationDefinition): Promise<HealthCheckResult> {
  const startedAt = Date.now();
  const envResult = providerStatusFromEnv(definition);

  return {
    ...envResult,
    responseTimeMs: Math.max(1, Date.now() - startedAt)
  };
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error("integration_health_check_timeout")), timeoutMs);
      })
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

async function currentHealthByProvider(admin: AdminClient) {
  const { data, error } = await table(admin)
    .select("id, provider_key, provider_name, category, status, enabled, configured, mode, last_checked_at, last_success_at, last_failure_at, response_time_ms, failure_count, consecutive_failures, last_error_code, last_error_message, last_safe_response_summary, created_at, updated_at")
    .order("provider_key", { ascending: true });

  if (error) {
    return new Map<string, IntegrationHealthState>();
  }

  return new Map(
    (data ?? [])
      .map(parseHealthRow)
      .filter((row): row is IntegrationHealthState => Boolean(row))
      .map((row) => [row.providerKey, row])
  );
}

export async function listIntegrationHealth(): Promise<IntegrationHealthState[]> {
  const access = await getAdminAccess();
  requireSuperAdmin(access);

  const admin = createAdminClient();

  if (!admin) {
    return integrationDefinitions.map(defaultHealthState);
  }

  const current = await currentHealthByProvider(admin);

  return integrationDefinitions.map((definition) => current.get(definition.key) ?? defaultHealthState(definition));
}

export async function runIntegrationHealthCheck(providerKey: string): Promise<IntegrationHealthState> {
  const access = await getAdminAccess();
  requireSuperAdmin(access);

  const definition = integrationDefinitions.find((provider) => provider.key === providerKey.trim());
  const admin = createAdminClient();

  if (!definition) {
    await logHealthEvent({
      access,
      eventStatus: "info",
      eventType: "integration_health_check_skipped",
      metadata: {
        code: "unknown_provider",
        provider_key: providerKey
      }
    });
    throw new Error("Unknown integration provider.");
  }

  if (!admin) {
    throw new Error("Service-role admin access is required for integration health checks.");
  }

  const current = (await currentHealthByProvider(admin)).get(definition.key) ?? defaultHealthState(definition);
  const startedAt = Date.now();

  console.info("integration_health_check_started", {
    providerKey: definition.key
  });
  await logHealthEvent({
    access,
    eventStatus: "info",
    eventType: "integration_health_check_started",
    metadata: {
      category: definition.category,
      provider_key: definition.key
    }
  });

  let result: HealthCheckResult;

  try {
    result = await withTimeout(runPresenceCheck(definition), HEALTH_CHECK_TIMEOUT_MS);
  } catch (error) {
    result = {
      configured: false,
      errorCode: error instanceof Error && error.message === "integration_health_check_timeout"
        ? "timeout"
        : "health_check_exception",
      errorMessage: "Integration health check failed safely.",
      responseTimeMs: Math.max(1, Date.now() - startedAt),
      safeSummary: {
        checkType: "safe_presence_wrapper",
        message: maskSensitiveText(error instanceof Error ? error.message : "Unknown integration health check error."),
        mutationPerformed: false,
        providerKey: definition.key
      },
      status: "failed"
    };
  }

  const checkedAt = new Date().toISOString();
  const failed = ["degraded", "failed", "missing_config"].includes(result.status);
  const nextFailureCount = failed ? current.failureCount + 1 : current.failureCount;
  const nextConsecutiveFailures = failed ? current.consecutiveFailures + 1 : 0;
  const nextState = {
    category: definition.category,
    configured: result.configured,
    enabled: result.configured && result.status !== "placeholder",
    last_checked_at: checkedAt,
    last_error_code: result.errorCode,
    last_error_message: result.errorMessage ? maskSensitiveText(result.errorMessage) : null,
    last_failure_at: failed ? checkedAt : current.lastFailureAt,
    last_safe_response_summary: maskIntegrationDiagnostic(result.safeSummary),
    last_success_at: failed || result.status === "placeholder" ? current.lastSuccessAt : checkedAt,
    mode: integrationMode(definition.key),
    provider_key: definition.key,
    provider_name: definition.name,
    response_time_ms: result.responseTimeMs,
    status: result.status,
    failure_count: nextFailureCount,
    consecutive_failures: nextConsecutiveFailures
  };
  const { error } = await table(admin).upsert(nextState as never, { onConflict: "provider_key" });

  if (error) {
    console.error("integration_health_check_failed", {
      code: "integration_health_state_update_failed",
      message: maskSensitiveText(error.message),
      providerKey: definition.key
    });
    throw new Error("Integration health state could not be updated.");
  }

  const eventType = failed ? "integration_health_check_failed" : "integration_health_check_success";

  console[failed ? "error" : "info"](eventType, {
    providerKey: definition.key,
    responseTimeMs: result.responseTimeMs,
    status: result.status
  });
  await logHealthEvent({
    access,
    eventStatus: failed ? "failed" : "success",
    eventType,
    metadata: {
      category: definition.category,
      configured: result.configured,
      provider_key: definition.key,
      response_time_ms: result.responseTimeMs,
      status: result.status
    }
  });

  return {
    ...defaultHealthState(definition),
    configured: nextState.configured,
    consecutiveFailures: nextState.consecutive_failures,
    enabled: nextState.enabled,
    failureCount: nextState.failure_count,
    lastCheckedAt: nextState.last_checked_at,
    lastErrorCode: nextState.last_error_code,
    lastErrorMessage: nextState.last_error_message,
    lastFailureAt: nextState.last_failure_at,
    lastSafeResponseSummary: nextState.last_safe_response_summary as Record<string, unknown>,
    lastSuccessAt: nextState.last_success_at,
    mode: nextState.mode,
    responseTimeMs: nextState.response_time_ms,
    status: nextState.status,
    updatedAt: checkedAt
  };
}

export async function runAllIntegrationHealthChecks(): Promise<IntegrationHealthState[]> {
  const results: IntegrationHealthState[] = [];

  for (const definition of integrationDefinitions) {
    results.push(await runIntegrationHealthCheck(definition.key));
  }

  return results;
}
