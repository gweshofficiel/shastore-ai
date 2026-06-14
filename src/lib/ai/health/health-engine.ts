import type {
  AIHealthJobSignal,
  AIHealthLogSignal,
  AIHealthProviderKey,
  AIHealthStatus,
  AIProviderHealth,
  AIProviderRuntimeMetadata
} from "@/src/lib/ai/health/health-types";

export const aiHealthProviders: Array<{
  key: AIHealthProviderKey;
  name: string;
}> = [
  { key: "openai", name: "OpenAI" },
  { key: "fal", name: "Fal" },
  { key: "replicate", name: "Replicate" },
  { key: "runway", name: "Runway" },
  { key: "kling", name: "Kling" },
  { key: "elevenlabs", name: "ElevenLabs" },
  { key: "deepgram", name: "Deepgram" },
  { key: "gemini", name: "Gemini" }
];

const RECENT_FAILURE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const DEGRADED_FAILURE_THRESHOLD = 3;

function normalizedProvider(value: string): AIHealthProviderKey | null {
  const key = value.toLowerCase().replace(/[^a-z0-9]/g, "");

  if (key.includes("openai") || key.includes("gpt")) return "openai";
  if (key.includes("fal")) return "fal";
  if (key.includes("replicate")) return "replicate";
  if (key.includes("runway")) return "runway";
  if (key.includes("kling")) return "kling";
  if (key.includes("eleven")) return "elevenlabs";
  if (key.includes("deepgram")) return "deepgram";
  if (key.includes("gemini") || key.includes("google")) return "gemini";

  return null;
}

function timestamp(value: string | null) {
  return value ? Date.parse(value) || 0 : 0;
}

function latest(left: string | null, right: string | null) {
  if (!left) return right;
  if (!right) return left;

  return timestamp(right) > timestamp(left) ? right : left;
}

function isFailedStatus(value: string) {
  const status = value.toLowerCase();

  return status === "failed" || status.includes("error") || status.includes("timeout");
}

function isRecent(value: string | null) {
  return Boolean(value && Date.now() - timestamp(value) <= RECENT_FAILURE_WINDOW_MS);
}

function calculateHealth({
  configured,
  enabled,
  recentFailures
}: {
  configured: boolean;
  enabled: boolean;
  recentFailures: number;
}): AIHealthStatus {
  if (!configured) {
    return "unknown";
  }

  if (!enabled) {
    return "offline";
  }

  if (recentFailures >= DEGRADED_FAILURE_THRESHOLD) {
    return "degraded";
  }

  return "healthy";
}

export function calculateAIProviderHealth({
  jobs,
  logs,
  runtime
}: {
  jobs: AIHealthJobSignal[];
  logs: AIHealthLogSignal[];
  runtime: AIProviderRuntimeMetadata[];
}): AIProviderHealth[] {
  const runtimeByProvider = new Map(runtime.map((entry) => [entry.provider, entry]));

  return aiHealthProviders.map((provider) => {
    const metadata = runtimeByProvider.get(provider.key) ?? {
      configured: false,
      enabled: false,
      provider: provider.key
    };
    let lastActivity: string | null = null;
    let recentFailures = 0;

    for (const job of jobs) {
      const jobProvider = normalizedProvider(job.provider);

      if (jobProvider !== provider.key) {
        continue;
      }

      const activityAt = job.completedAt ?? job.createdAt;
      lastActivity = latest(lastActivity, activityAt);

      if (isFailedStatus(job.status) && isRecent(activityAt)) {
        recentFailures += 1;
      }
    }

    for (const log of logs) {
      const logProvider = normalizedProvider(log.provider || log.eventType);

      if (logProvider !== provider.key) {
        continue;
      }

      lastActivity = latest(lastActivity, log.createdAt);

      if (log.eventStatus.toLowerCase() === "failed" && isRecent(log.createdAt)) {
        recentFailures += 1;
      }
    }

    return {
      configured: metadata.configured,
      enabled: metadata.enabled,
      health: calculateHealth({
        configured: metadata.configured,
        enabled: metadata.enabled,
        recentFailures
      }),
      lastActivity,
      provider: provider.key,
      providerName: provider.name,
      recentFailures
    };
  });
}
