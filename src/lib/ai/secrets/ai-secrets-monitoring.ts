import "server-only";
import { getAdminAccess } from "@/lib/admin-access";
import { getAIVisualProviderRuntimeConfig } from "@/lib/storefront/ai-visual-provider";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordAiAuditLog } from "@/src/lib/ai/audit/ai-audit-log";
import type {
  AISecretRotationInput,
  AISecretsProviderKey,
  AISecretsProviderRecord,
  AISecretsSnapshot,
  AISecretsStatus
} from "@/src/lib/ai/secrets/ai-secrets-types";

type AISecretDefinition = {
  key: AISecretsProviderKey;
  name: string;
  optionalSecretNames: string[];
  requiredSecretNames: string[];
  runtimeProvider?: "openai-image" | "replicate";
};

type RotationTable = {
  select: (columns: string) => {
    order: (column: string, options: { ascending: boolean }) => PromiseLike<{
      data: unknown[] | null;
      error: { message: string } | null;
    }>;
  };
  upsert: (
    values: never,
    options: { onConflict: string }
  ) => PromiseLike<{ error: { message: string } | null }>;
};

type AdminClient = {
  from: (table: string) => unknown;
};

const AI_SECRET_CATEGORY = "AI Provider";

const aiSecretDefinitions: AISecretDefinition[] = [
  {
    key: "openai",
    name: "OpenAI",
    optionalSecretNames: ["AI_IMAGE_PROVIDER_API_KEY", "AI_VISUAL_PROVIDER_API_KEY"],
    requiredSecretNames: ["OPENAI_API_KEY"],
    runtimeProvider: "openai-image"
  },
  {
    key: "fal",
    name: "Fal",
    optionalSecretNames: ["FAL_API_KEY"],
    requiredSecretNames: ["FAL_KEY"]
  },
  {
    key: "replicate",
    name: "Replicate",
    optionalSecretNames: ["REPLICATE_API_KEY", "AI_IMAGE_PROVIDER_API_KEY", "AI_VISUAL_PROVIDER_API_KEY"],
    requiredSecretNames: ["REPLICATE_API_TOKEN"],
    runtimeProvider: "replicate"
  },
  {
    key: "runway",
    name: "Runway",
    optionalSecretNames: [],
    requiredSecretNames: ["RUNWAY_API_KEY"]
  },
  {
    key: "kling",
    name: "Kling",
    optionalSecretNames: [],
    requiredSecretNames: ["KLING_API_KEY"]
  },
  {
    key: "elevenlabs",
    name: "ElevenLabs",
    optionalSecretNames: [],
    requiredSecretNames: ["ELEVENLABS_API_KEY"]
  },
  {
    key: "deepgram",
    name: "Deepgram",
    optionalSecretNames: [],
    requiredSecretNames: ["DEEPGRAM_API_KEY"]
  },
  {
    key: "gemini",
    name: "Gemini",
    optionalSecretNames: ["GOOGLE_GENERATIVE_AI_API_KEY"],
    requiredSecretNames: ["GEMINI_API_KEY"]
  }
];

function requireSuperAdmin(access: Awaited<ReturnType<typeof getAdminAccess>>) {
  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can access AI secrets monitoring.");
  }
}

function table(client: AdminClient) {
  return client.from("integration_secret_rotation_records") as RotationTable;
}

function cleanText(value: unknown, maxLength = 500) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : "";
}

function cleanDate(value: unknown) {
  const cleaned = cleanText(value, 80);

  if (!cleaned) {
    return null;
  }

  const timestamp = Date.parse(cleaned);

  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function hasEnv(name: string) {
  return Boolean(process.env[name]);
}

function isRuntimeEnabled(definition: AISecretDefinition) {
  const runtime = getAIVisualProviderRuntimeConfig();

  return Boolean(
    definition.runtimeProvider &&
    runtime.status !== "disabled" &&
    runtime.provider === definition.runtimeProvider
  );
}

function providerId(provider: AISecretsProviderKey) {
  return `ai:${provider}`;
}

function assertProvider(provider: AISecretsProviderKey) {
  const definition = aiSecretDefinitions.find((candidate) => candidate.key === provider);

  if (!definition) {
    throw new Error("Unknown AI provider.");
  }

  return definition;
}

function parseRotationRow(row: unknown) {
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    return null;
  }

  const value = row as Record<string, unknown>;
  const providerKey = cleanText(value.provider_key, 120);

  if (!providerKey.startsWith("ai:")) {
    return null;
  }

  return {
    lastRotatedAt: cleanDate(value.last_rotated_at),
    providerKey,
    rotationRequired: Boolean(value.rotation_required),
    secretKeyName: cleanText(value.secret_key_name, 160),
    status: cleanText(value.status, 80)
  };
}

function statusForProvider({
  configured,
  definition,
  missingOptional,
  rotationRequired
}: {
  configured: boolean;
  definition: AISecretDefinition;
  missingOptional: string[];
  rotationRequired: boolean;
}): AISecretsStatus {
  if (rotationRequired) {
    return "rotation_required";
  }

  if (!configured) {
    return "missing_config";
  }

  if (missingOptional.length > 0) {
    return "partial_config";
  }

  if (definition.runtimeProvider && !isRuntimeEnabled(definition)) {
    return "disabled";
  }

  return "configured";
}

async function listRotationRows() {
  const admin = createAdminClient();

  if (!admin) {
    return [];
  }

  const { data, error } = await table(admin)
    .select("provider_key, secret_key_name, status, rotation_required, last_rotated_at")
    .order("provider_key", { ascending: true });

  if (error) {
    return [];
  }

  return (data ?? []).map(parseRotationRow).filter((row): row is NonNullable<ReturnType<typeof parseRotationRow>> => Boolean(row));
}

function buildProviderRecord(definition: AISecretDefinition, rotationRows: Awaited<ReturnType<typeof listRotationRows>>): AISecretsProviderRecord {
  const providerRows = rotationRows.filter((row) => row.providerKey === providerId(definition.key));
  const requiredConfigured = definition.requiredSecretNames.every(hasEnv);
  const missingRequired = definition.requiredSecretNames.filter((name) => !hasEnv(name));
  const missingOptional = definition.optionalSecretNames.filter((name) => !hasEnv(name));
  const rotationRequired = providerRows.some((row) => row.rotationRequired);
  const lastRotatedAt = providerRows
    .map((row) => row.lastRotatedAt)
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => Date.parse(right) - Date.parse(left))[0] ?? null;

  return {
    configured: requiredConfigured,
    last_rotated_at: lastRotatedAt,
    missing_required_secrets: missingRequired,
    optional_secrets_missing: missingOptional,
    provider: definition.key,
    provider_name: definition.name,
    required_secret_names: definition.requiredSecretNames,
    rotation_required: rotationRequired,
    status: statusForProvider({
      configured: requiredConfigured,
      definition,
      missingOptional,
      rotationRequired
    })
  };
}

async function auditSecretEvent({
  access,
  eventType,
  provider
}: {
  access: Awaited<ReturnType<typeof getAdminAccess>>;
  eventType: "ai_secret_marked_rotated" | "ai_secret_rotation_required";
  provider: AISecretsProviderKey;
}) {
  await recordAiAuditLog({
    eventType,
    providerKey: provider,
    safeSummary: {
      metadataOnly: true,
      mutationPerformed: false,
      provider,
      secretValuesTouched: false
    },
    status: "success",
    userId: access.user.id
  });
}

async function upsertRotationMetadata({
  access,
  definition,
  rotationRequired,
  status
}: {
  access: Awaited<ReturnType<typeof getAdminAccess>>;
  definition: AISecretDefinition;
  rotationRequired: boolean;
  status: "rotated" | "rotation_due";
}) {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for AI secret rotation metadata.");
  }

  const now = new Date().toISOString();
  const rows = definition.requiredSecretNames.map((secretKeyName) => ({
    ...(status === "rotated"
      ? {
          last_rotated_at: now,
          last_rotated_by: access.user.id
        }
      : {}),
    provider_key: providerId(definition.key),
    rotation_required: rotationRequired,
    secret_category: AI_SECRET_CATEGORY,
    secret_key_name: secretKeyName,
    status
  }));
  const { error } = await table(admin).upsert(rows as never, {
    onConflict: "provider_key,secret_key_name"
  });

  if (error) {
    throw new Error("AI secret rotation metadata could not be updated.");
  }
}

export async function listAISecretsMonitoring(): Promise<AISecretsSnapshot> {
  const access = await getAdminAccess();
  requireSuperAdmin(access);

  const rotationRows = await listRotationRows();

  return {
    generated_at: new Date().toISOString(),
    providers: aiSecretDefinitions.map((definition) => buildProviderRecord(definition, rotationRows))
  };
}

export async function markAISecretRotationRequired(input: AISecretRotationInput) {
  const access = await getAdminAccess();
  requireSuperAdmin(access);

  const definition = assertProvider(input.provider);

  await upsertRotationMetadata({
    access,
    definition,
    rotationRequired: true,
    status: "rotation_due"
  });
  await auditSecretEvent({
    access,
    eventType: "ai_secret_rotation_required",
    provider: definition.key
  });
}

export async function markAISecretRotated(input: AISecretRotationInput) {
  const access = await getAdminAccess();
  requireSuperAdmin(access);

  const definition = assertProvider(input.provider);

  await upsertRotationMetadata({
    access,
    definition,
    rotationRequired: false,
    status: "rotated"
  });
  await auditSecretEvent({
    access,
    eventType: "ai_secret_marked_rotated",
    provider: definition.key
  });
}
