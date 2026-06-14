import "server-only";
import { getAdminAccess } from "@/lib/admin-access";
import { getAIVisualProviderRuntimeConfig } from "@/lib/storefront/ai-visual-provider";
import { recordAiAuditLog } from "@/src/lib/ai/audit/ai-audit-log";
import type {
  AIDiagnosticResult,
  AIDiagnosticStatus,
  AIDiagnosticsProviderKey,
  AIDiagnosticsSnapshot
} from "@/src/lib/ai/diagnostics/diagnostics-types";

type ProviderDefinition = {
  envNames: string[];
  key: AIDiagnosticsProviderKey;
  name: string;
  runtimeProvider?: "openai-image" | "replicate";
};

const providerDefinitions: ProviderDefinition[] = [
  {
    envNames: ["OPENAI_API_KEY", "AI_IMAGE_PROVIDER_API_KEY", "AI_VISUAL_PROVIDER_API_KEY"],
    key: "openai",
    name: "OpenAI",
    runtimeProvider: "openai-image"
  },
  {
    envNames: ["FAL_KEY", "FAL_API_KEY"],
    key: "fal",
    name: "Fal"
  },
  {
    envNames: ["REPLICATE_API_TOKEN", "REPLICATE_API_KEY", "AI_IMAGE_PROVIDER_API_KEY", "AI_VISUAL_PROVIDER_API_KEY"],
    key: "replicate",
    name: "Replicate",
    runtimeProvider: "replicate"
  },
  {
    envNames: ["RUNWAY_API_KEY"],
    key: "runway",
    name: "Runway"
  },
  {
    envNames: ["KLING_API_KEY"],
    key: "kling",
    name: "Kling"
  },
  {
    envNames: ["ELEVENLABS_API_KEY"],
    key: "elevenlabs",
    name: "ElevenLabs"
  },
  {
    envNames: ["DEEPGRAM_API_KEY"],
    key: "deepgram",
    name: "Deepgram"
  },
  {
    envNames: ["GEMINI_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY"],
    key: "gemini",
    name: "Gemini"
  }
];

function requireSuperAdmin(access: Awaited<ReturnType<typeof getAdminAccess>>) {
  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can access AI diagnostics.");
  }
}

function hasAnyEnv(names: string[]) {
  return names.some((name) => Boolean(process.env[name]));
}

function runtimeEnabled(definition: ProviderDefinition) {
  const runtime = getAIVisualProviderRuntimeConfig();

  return Boolean(
    definition.runtimeProvider &&
    runtime.status !== "disabled" &&
    runtime.provider === definition.runtimeProvider
  );
}

function statusForProvider({
  configured,
  definition,
  enabled
}: {
  configured: boolean;
  definition: ProviderDefinition;
  enabled: boolean;
}): AIDiagnosticStatus {
  if (!configured) {
    return "missing_config";
  }

  if (enabled) {
    return "connected";
  }

  return definition.runtimeProvider ? "disabled" : "placeholder";
}

function messageForStatus(status: AIDiagnosticStatus, providerName: string) {
  if (status === "connected") {
    return `${providerName} configuration is present and selected in the current AI runtime. No provider request was made.`;
  }

  if (status === "missing_config") {
    return `${providerName} configuration is missing. Checked environment variable presence only; no secret values were read.`;
  }

  if (status === "disabled") {
    return `${providerName} configuration is present, but the provider is not selected in the current AI runtime.`;
  }

  if (status === "placeholder") {
    return `${providerName} configuration is present for a future or inactive AI capability. No provider request was made.`;
  }

  return `${providerName} diagnostic was skipped.`;
}

async function recordDiagnosticAudit({
  provider,
  result,
  stage,
  userId
}: {
  provider: AIDiagnosticsProviderKey;
  result?: AIDiagnosticResult;
  stage: "failed" | "skipped" | "started" | "success";
  userId: string;
}) {
  await recordAiAuditLog({
    errorCode: result?.error_code ?? null,
    errorMessage: result?.error_message ?? null,
    eventType: `ai_diagnostic_${stage}`,
    providerKey: provider,
    safeSummary: result
      ? {
          configured: result.configured,
          enabled: result.enabled,
          responseTimeMs: result.response_time_ms,
          safeMessage: result.safe_message,
          status: result.status
        }
      : {
          safeMessage: "AI diagnostic started. No provider request is made by this diagnostic."
        },
    status: stage === "started" ? "started" : stage === "success" ? "success" : stage,
    userId
  });
}

export function getAIDiagnosticsProviderDefinitions() {
  return providerDefinitions.map((definition) => ({
    key: definition.key,
    name: definition.name,
    runtimeProvider: definition.runtimeProvider
  }));
}

export async function runAIDiagnostic(
  provider: AIDiagnosticsProviderKey,
  options: { audit?: boolean } = {}
): Promise<AIDiagnosticResult> {
  const access = await getAdminAccess();
  requireSuperAdmin(access);

  if (options.audit) {
    await recordDiagnosticAudit({
      provider,
      stage: "started",
      userId: access.user.id
    });
  }

  const startedAt = Date.now();
  const definition = providerDefinitions.find((candidate) => candidate.key === provider);

  if (!definition) {
    const result: AIDiagnosticResult = {
      configured: false,
      enabled: false,
      error_code: "unsupported_provider",
      error_message: "Unsupported AI diagnostics provider.",
      last_checked_at: new Date().toISOString(),
      provider,
      provider_name: provider,
      response_time_ms: Date.now() - startedAt,
      safe_message: "Unsupported provider diagnostic was skipped.",
      status: "skipped"
    };

    if (options.audit) {
      await recordDiagnosticAudit({
        provider,
        result,
        stage: "skipped",
        userId: access.user.id
      });
    }

    return result;
  }

  try {
    const configured = hasAnyEnv(definition.envNames);
    const enabled = runtimeEnabled(definition);
    const status = statusForProvider({ configured, definition, enabled });
    const result: AIDiagnosticResult = {
      configured,
      enabled,
      error_code: status === "missing_config" ? "missing_config" : null,
      error_message: null,
      last_checked_at: new Date().toISOString(),
      provider,
      provider_name: definition.name,
      response_time_ms: Date.now() - startedAt,
      safe_message: messageForStatus(status, definition.name),
      status
    };

    if (options.audit) {
      await recordDiagnosticAudit({
        provider,
        result,
        stage: status === "missing_config" || status === "disabled" || status === "placeholder" ? "skipped" : "success",
        userId: access.user.id
      });
    }

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI diagnostic failed.";
    const result: AIDiagnosticResult = {
      configured: false,
      enabled: false,
      error_code: "diagnostic_failed",
      error_message: message.replace(/\b(api[-_]?key|token|secret|password|authorization)\s*[:=]\s*[^,\s]+/gi, "$1=[redacted]").slice(0, 240),
      last_checked_at: new Date().toISOString(),
      provider,
      provider_name: definition.name,
      response_time_ms: Date.now() - startedAt,
      safe_message: "Diagnostic failed before any provider request was made.",
      status: "failed"
    };

    if (options.audit) {
      await recordDiagnosticAudit({
        provider,
        result,
        stage: "failed",
        userId: access.user.id
      });
    }

    return result;
  }
}

export async function runAllAIDiagnostics(options: { audit?: boolean } = {}): Promise<AIDiagnosticsSnapshot> {
  const providers = await Promise.all(
    providerDefinitions.map((definition) => runAIDiagnostic(definition.key, options))
  );

  return {
    generated_at: new Date().toISOString(),
    providers
  };
}

export async function getAIDiagnosticsSnapshot(): Promise<AIDiagnosticsSnapshot> {
  return runAllAIDiagnostics({ audit: false });
}
