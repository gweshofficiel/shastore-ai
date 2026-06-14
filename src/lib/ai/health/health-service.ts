import "server-only";
import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { aiVisualQueueFromStoreData } from "@/lib/storefront/ai-visual-queue";
import { getAIVisualProviderRuntimeConfig } from "@/lib/storefront/ai-visual-provider";
import {
  aiHealthProviders,
  calculateAIProviderHealth
} from "@/src/lib/ai/health/health-engine";
import type {
  AIHealthJobSignal,
  AIHealthLogSignal,
  AIHealthProviderKey,
  AIHealthSnapshot,
  AIProviderRuntimeMetadata
} from "@/src/lib/ai/health/health-types";

type SelectTable = {
  select: (columns: string) => {
    limit: (limit: number) => PromiseLike<{
      data: unknown[] | null;
      error: { message: string } | null;
    }>;
  };
};

type AdminClient = {
  from: (table: string) => unknown;
};

const MAX_HEALTH_ROWS = 500;

function requireSuperAdmin(access: Awaited<ReturnType<typeof getAdminAccess>>) {
  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can access AI runtime health.");
  }
}

function table(client: AdminClient, tableName: string) {
  return client.from(tableName) as SelectTable;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function safeErrorSummary(value: unknown) {
  const raw = text(value).replace(/\s+/g, " ");

  if (!raw) {
    return null;
  }

  return raw
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, "[redacted]")
    .replace(/\b(api[-_]?key|token|secret|password|authorization|private[-_]?key)\s*[:=]\s*[^,\s]+/gi, "$1=[redacted]")
    .slice(0, 180);
}

function enabledProvider(): AIHealthProviderKey | null {
  const runtime = getAIVisualProviderRuntimeConfig();

  if (runtime.provider === "openai-image") {
    return "openai";
  }

  if (runtime.provider === "replicate") {
    return "replicate";
  }

  return null;
}

function envConfigured(names: string[]) {
  return names.some((name) => Boolean(process.env[name]));
}

function providerRuntimeMetadata(): AIProviderRuntimeMetadata[] {
  const runtime = getAIVisualProviderRuntimeConfig();
  const activeProvider = enabledProvider();
  const entries: Record<AIHealthProviderKey, { configured: boolean; enabled: boolean }> = {
    deepgram: {
      configured: envConfigured(["DEEPGRAM_API_KEY"]),
      enabled: false
    },
    elevenlabs: {
      configured: envConfigured(["ELEVENLABS_API_KEY"]),
      enabled: false
    },
    fal: {
      configured: envConfigured(["FAL_KEY", "FAL_API_KEY"]),
      enabled: false
    },
    gemini: {
      configured: envConfigured(["GEMINI_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY"]),
      enabled: false
    },
    kling: {
      configured: envConfigured(["KLING_API_KEY"]),
      enabled: false
    },
    openai: {
      configured: envConfigured(["OPENAI_API_KEY", "AI_IMAGE_PROVIDER_API_KEY", "AI_VISUAL_PROVIDER_API_KEY"]),
      enabled: runtime.status !== "disabled" && activeProvider === "openai"
    },
    replicate: {
      configured: envConfigured(["REPLICATE_API_TOKEN", "REPLICATE_API_KEY", "AI_IMAGE_PROVIDER_API_KEY", "AI_VISUAL_PROVIDER_API_KEY"]),
      enabled: runtime.status !== "disabled" && activeProvider === "replicate"
    },
    runway: {
      configured: envConfigured(["RUNWAY_API_KEY"]),
      enabled: false
    }
  };

  return aiHealthProviders.map((provider) => ({
    configured: entries[provider.key].configured,
    enabled: entries[provider.key].enabled,
    provider: provider.key
  }));
}

async function safeRead(client: AdminClient, tableName: string, columns: string) {
  const { data, error } = await table(client, tableName)
    .select(columns)
    .limit(MAX_HEALTH_ROWS);

  if (error) {
    return [];
  }

  return data ?? [];
}

function jobsFromStores(rows: unknown[]): AIHealthJobSignal[] {
  const jobs: AIHealthJobSignal[] = [];

  for (const row of rows) {
    if (!isRecord(row)) {
      continue;
    }

    const queue = aiVisualQueueFromStoreData(row.store_data);

    for (const job of Object.values(queue.jobs) as Array<Record<string, unknown>>) {
      jobs.push({
        completedAt: text(job.completedAt) || null,
        createdAt: text(job.createdAt, text(row.created_at)) || null,
        errorSummary: safeErrorSummary(job.error),
        provider: text(job.provider, "openai"),
        status: text(job.status, "pending")
      });
    }
  }

  return jobs;
}

function jobsFromLegacyQueue(rows: unknown[]): AIHealthJobSignal[] {
  return rows
    .filter(isRecord)
    .map((row) => ({
      completedAt: text(row.completed_at) || text(row.failed_at) || null,
      createdAt: text(row.created_at) || null,
      errorSummary: safeErrorSummary(row.error_message),
      provider: "openai",
      status: text(row.queue_status, text(row.workflow_state, "waiting"))
    }));
}

function jobsFromLegacyResults(rows: unknown[]): AIHealthJobSignal[] {
  return rows
    .filter(isRecord)
    .map((row) => ({
      completedAt: text(row.updated_at) || null,
      createdAt: text(row.created_at) || null,
      errorSummary: text(row.result_status) === "failed" ? "Legacy AI generation result failed." : null,
      provider: "openai",
      status: text(row.result_status, "unknown")
    }));
}

function logsFromMonitoring(rows: unknown[]): AIHealthLogSignal[] {
  return rows
    .filter(isRecord)
    .map((row) => {
      const metadata = isRecord(row.metadata) ? row.metadata : {};

      return {
        createdAt: text(row.created_at) || null,
        eventStatus: text(row.event_status, "info"),
        eventType: text(row.event_type, "ai_event"),
        provider: text(metadata.provider, text(metadata.provider_key, text(metadata.providerKey, text(row.entity_type))))
      };
    })
    .filter((log) => {
      const haystack = `${log.eventType} ${log.provider}`.toLowerCase();

      return haystack.includes("ai") ||
        haystack.includes("openai") ||
        haystack.includes("fal") ||
        haystack.includes("replicate") ||
        haystack.includes("runway") ||
        haystack.includes("kling") ||
        haystack.includes("eleven") ||
        haystack.includes("deepgram") ||
        haystack.includes("gemini");
    });
}

export async function getAIProviderHealthSnapshot(): Promise<AIHealthSnapshot> {
  const access = await getAdminAccess();
  requireSuperAdmin(access);

  const admin = createAdminClient();

  if (!admin) {
    return {
      generatedAt: new Date().toISOString(),
      providers: calculateAIProviderHealth({
        jobs: [],
        logs: [],
        runtime: providerRuntimeMetadata()
      })
    };
  }

  const [stores, legacyQueue, legacyResults, monitoringEvents] = await Promise.all([
    safeRead(admin, "stores", "store_data, created_at"),
    safeRead(admin, "ai_generation_queue", "workflow_state, queue_status, completed_at, failed_at, error_message, created_at"),
    safeRead(admin, "ai_generation_results", "result_status, created_at, updated_at"),
    safeRead(admin, "monitoring_events", "event_type, event_status, entity_type, metadata, created_at")
  ]);

  return {
    generatedAt: new Date().toISOString(),
    providers: calculateAIProviderHealth({
      jobs: [
        ...jobsFromStores(stores),
        ...jobsFromLegacyQueue(legacyQueue),
        ...jobsFromLegacyResults(legacyResults)
      ],
      logs: logsFromMonitoring(monitoringEvents),
      runtime: providerRuntimeMetadata()
    })
  };
}
