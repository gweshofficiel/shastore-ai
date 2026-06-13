import "server-only";
import { getAdminAccess } from "@/lib/admin-access";
import { recordIntegrationAuditLog } from "@/lib/integrations/audit-log";
import { integrationDefinitions, type IntegrationDefinition } from "@/lib/integrations/catalog";
import {
  maskIntegrationDiagnostic,
  maskSensitiveText
} from "@/lib/integrations/safe-diagnostics";
import { createAdminClient } from "@/lib/supabase/admin";

export type ProviderDiagnosticStatus =
  | "connected"
  | "failed"
  | "missing_config"
  | "placeholder"
  | "skipped";

export type ProviderDiagnosticResult = {
  checked_at: string;
  error_code: string | null;
  error_message: string | null;
  provider_key: string;
  response_time_ms: number;
  safe_message: string;
  status: ProviderDiagnosticStatus;
};

type HealthTable = {
  select: (columns: string) => {
    eq: (column: string, value: string) => {
      maybeSingle: () => PromiseLike<{
        data: unknown | null;
        error: { message: string } | null;
      }>;
    };
  };
  upsert: (
    values: never,
    options: { onConflict: string }
  ) => PromiseLike<{ error: { message: string } | null }>;
};

type AdminClient = {
  from: (table: string) => unknown;
};

const DIAGNOSTIC_TIMEOUT_MS = 3000;

function requireSuperAdmin(access: Awaited<ReturnType<typeof getAdminAccess>>) {
  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can run provider diagnostics.");
  }
}

function healthTable(client: AdminClient) {
  return client.from("integration_health_states") as HealthTable;
}

function integrationMode(providerKey: string) {
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

function safeCheckType(providerKey: string) {
  return providerKey === "platform_webhooks" ? "route_config_presence_only" : "env_presence_only";
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error("provider_diagnostic_timeout")), timeoutMs);
      })
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

async function runSafeDiagnostic(definition: IntegrationDefinition): Promise<ProviderDiagnosticResult> {
  const startedAt = Date.now();
  const checkedAt = new Date().toISOString();
  const counts = envCounts(definition.requiredEnv);

  if (!counts.requiredCount) {
    return {
      checked_at: checkedAt,
      error_code: null,
      error_message: null,
      provider_key: definition.key,
      response_time_ms: Math.max(1, Date.now() - startedAt),
      safe_message: "Placeholder provider reserved for a later runtime phase.",
      status: "placeholder"
    };
  }

  if (counts.configuredCount === counts.requiredCount) {
    return {
      checked_at: checkedAt,
      error_code: null,
      error_message: null,
      provider_key: definition.key,
      response_time_ms: Math.max(1, Date.now() - startedAt),
      safe_message: `${safeCheckType(definition.key)} passed. No provider mutation was performed.`,
      status: "connected"
    };
  }

  return {
    checked_at: checkedAt,
    error_code: counts.configuredCount > 0 ? "partial_config" : "missing_config",
    error_message: "Required provider configuration is missing or incomplete.",
    provider_key: definition.key,
    response_time_ms: Math.max(1, Date.now() - startedAt),
    safe_message: `${safeCheckType(definition.key)} failed. Required configuration is missing or incomplete.`,
    status: "missing_config"
  };
}

async function currentHealthFailureCounts(admin: AdminClient, providerKey: string) {
  const { data } = await healthTable(admin)
    .select("failure_count, consecutive_failures")
    .eq("provider_key", providerKey)
    .maybeSingle();
  const row = data && typeof data === "object" && !Array.isArray(data)
    ? (data as Record<string, unknown>)
    : {};

  return {
    consecutiveFailures: typeof row.consecutive_failures === "number" ? row.consecutive_failures : 0,
    failureCount: typeof row.failure_count === "number" ? row.failure_count : 0
  };
}

function healthStatusForDiagnostic(status: ProviderDiagnosticStatus) {
  if (status === "connected") return "healthy";
  if (status === "missing_config") return "missing_config";
  if (status === "placeholder") return "placeholder";
  if (status === "skipped") return "disabled";

  return "failed";
}

async function persistDiagnostic({
  admin,
  definition,
  result
}: {
  admin: AdminClient;
  definition: IntegrationDefinition;
  result: ProviderDiagnosticResult;
}) {
  const failed = result.status === "failed" || result.status === "missing_config";
  const counts = await currentHealthFailureCounts(admin, definition.key);
  const nextFailureCount = failed ? counts.failureCount + 1 : counts.failureCount;
  const nextConsecutiveFailures = failed ? counts.consecutiveFailures + 1 : 0;
  const { error } = await healthTable(admin).upsert({
    category: definition.category,
    configured: result.status === "connected",
    consecutive_failures: nextConsecutiveFailures,
    enabled: result.status === "connected",
    failure_count: nextFailureCount,
    last_checked_at: result.checked_at,
    last_error_code: result.error_code,
    last_error_message: result.error_message ? maskSensitiveText(result.error_message) : null,
    last_failure_at: failed ? result.checked_at : null,
    last_safe_response_summary: maskIntegrationDiagnostic({
      checkType: safeCheckType(definition.key),
      diagnosticStatus: result.status,
      mutationPerformed: false,
      providerKey: definition.key,
      safeMessage: result.safe_message
    }),
    last_success_at: result.status === "connected" ? result.checked_at : null,
    mode: integrationMode(definition.key),
    provider_key: definition.key,
    provider_name: definition.name,
    response_time_ms: result.response_time_ms,
    status: healthStatusForDiagnostic(result.status)
  } as never, { onConflict: "provider_key" });

  if (error) {
    throw new Error("Provider diagnostic state could not be persisted.");
  }
}

async function auditDiagnostic({
  definition,
  result,
  status
}: {
  definition: IntegrationDefinition;
  result: ProviderDiagnosticResult;
  status: "failed" | "skipped" | "started" | "success";
}) {
  await recordIntegrationAuditLog({
    category: definition.category,
    errorCode: result.error_code,
    errorMessage: result.error_message,
    operation: "provider_diagnostic",
    providerKey: definition.key,
    providerName: definition.name,
    safeSummary: {
      checkType: safeCheckType(definition.key),
      diagnosticStatus: result.status,
      mutationPerformed: false,
      responseTimeMs: result.response_time_ms,
      safeMessage: result.safe_message
    },
    status
  });
}

export async function runProviderDiagnostic(providerKey: string): Promise<ProviderDiagnosticResult> {
  const access = await getAdminAccess();
  requireSuperAdmin(access);

  const definition = integrationDefinitions.find((provider) => provider.key === providerKey.trim());

  if (!definition) {
    const skipped: ProviderDiagnosticResult = {
      checked_at: new Date().toISOString(),
      error_code: "unknown_provider",
      error_message: "Unknown provider.",
      provider_key: providerKey,
      response_time_ms: 1,
      safe_message: "Provider diagnostic skipped because provider key is unknown.",
      status: "skipped"
    };

    await recordIntegrationAuditLog({
      category: "Unknown",
      errorCode: skipped.error_code,
      errorMessage: skipped.error_message,
      operation: "provider_diagnostic",
      providerKey,
      providerName: providerKey || "Unknown provider",
      safeSummary: {
        safeMessage: skipped.safe_message
      },
      status: "skipped",
      userId: access.user.id
    });

    return skipped;
  }

  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for provider diagnostics.");
  }

  const started: ProviderDiagnosticResult = {
    checked_at: new Date().toISOString(),
    error_code: null,
    error_message: null,
    provider_key: definition.key,
    response_time_ms: 1,
    safe_message: "Provider diagnostic started.",
    status: "skipped"
  };
  await auditDiagnostic({ definition, result: started, status: "started" });

  let result: ProviderDiagnosticResult;

  try {
    result = await withTimeout(runSafeDiagnostic(definition), DIAGNOSTIC_TIMEOUT_MS);
  } catch (error) {
    result = {
      checked_at: new Date().toISOString(),
      error_code: error instanceof Error && error.message === "provider_diagnostic_timeout"
        ? "timeout"
        : "provider_diagnostic_exception",
      error_message: "Provider diagnostic failed safely.",
      provider_key: definition.key,
      response_time_ms: DIAGNOSTIC_TIMEOUT_MS,
      safe_message: maskSensitiveText(error instanceof Error ? error.message : "Unknown provider diagnostic error."),
      status: "failed"
    };
  }

  await persistDiagnostic({ admin, definition, result });
  await auditDiagnostic({
    definition,
    result,
    status: result.status === "connected" || result.status === "placeholder"
      ? "success"
      : result.status === "skipped"
        ? "skipped"
        : "failed"
  });

  return result;
}

export async function runAllProviderDiagnostics() {
  const results: ProviderDiagnosticResult[] = [];

  for (const definition of integrationDefinitions) {
    results.push(await runProviderDiagnostic(definition.key));
  }

  return results;
}
