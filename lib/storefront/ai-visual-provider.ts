import type {
  AIVisualAssetProviderPlan,
  AIVisualAssetRequest
} from "@/lib/storefront/ai-visual-assets";
import { planAIVisualAssetProviderRequest } from "@/lib/storefront/ai-visual-assets";

export type AIVisualProviderKey =
  | "disabled"
  | "openai-image"
  | "replicate"
  | "stability"
  | "custom";

export type AIVisualProviderStatus = "disabled" | "missing_credentials" | "configured";

export type AIVisualProviderRuntimeConfig = {
  apiKeyConfigured: boolean;
  endpointConfigured: boolean;
  provider: AIVisualProviderKey;
  r2Configured: boolean;
  status: AIVisualProviderStatus;
};

export type AIVisualProviderPendingJob = {
  createdAt: string;
  jobId: string;
  provider: AIVisualProviderKey;
  providerStatus: AIVisualProviderStatus;
  request: AIVisualAssetRequest;
  status: "pending";
};

export type AIVisualProviderGenerateResult = {
  error: string | null;
  job: AIVisualProviderPendingJob | null;
  providerPlan: AIVisualAssetProviderPlan;
  status: "pending" | "skipped";
};

export type AIVisualProviderAdapter = {
  createPendingJob(request: AIVisualAssetRequest): AIVisualProviderPendingJob;
  generate(request: AIVisualAssetRequest): Promise<AIVisualProviderGenerateResult>;
  key: AIVisualProviderKey;
  runtimeConfig(): AIVisualProviderRuntimeConfig;
};

function enabledProvider(value: unknown): AIVisualProviderKey {
  if (
    value === "openai-image" ||
    value === "replicate" ||
    value === "stability" ||
    value === "custom"
  ) {
    return value;
  }

  return "disabled";
}

export function getAIVisualProviderRuntimeConfig(): AIVisualProviderRuntimeConfig {
  const provider = enabledProvider(process.env.AI_VISUAL_PROVIDER);
  const apiKeyConfigured = Boolean(process.env.AI_VISUAL_PROVIDER_API_KEY);
  const endpointConfigured = Boolean(process.env.AI_VISUAL_PROVIDER_ENDPOINT);
  const r2Configured = Boolean(
    process.env.CLOUDFLARE_R2_ACCOUNT_ID &&
    process.env.CLOUDFLARE_R2_ACCESS_KEY_ID &&
    process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY &&
    process.env.CLOUDFLARE_R2_BUCKET
  );
  const status: AIVisualProviderStatus =
    provider === "disabled" ? "disabled" : apiKeyConfigured ? "configured" : "missing_credentials";

  return {
    apiKeyConfigured,
    endpointConfigured,
    provider,
    r2Configured,
    status
  };
}

function pendingJobId(request: AIVisualAssetRequest, provider: AIVisualProviderKey) {
  return [
    "pending",
    provider,
    request.requestId,
    request.slot.replace(/\./g, "-")
  ].join("-");
}

export function createDisabledAIVisualProviderAdapter(): AIVisualProviderAdapter {
  return {
    createPendingJob(request) {
      const config = getAIVisualProviderRuntimeConfig();

      return {
        createdAt: new Date().toISOString(),
        jobId: pendingJobId(request, config.provider),
        provider: config.provider,
        providerStatus: config.status,
        request,
        status: "pending"
      };
    },
    async generate(request) {
      const providerPlan = planAIVisualAssetProviderRequest(request);

      return {
        error: "AI visual generation provider execution is disabled until an explicit server-side provider adapter is connected.",
        job: this.createPendingJob(request),
        providerPlan,
        status: "skipped"
      };
    },
    key: "disabled",
    runtimeConfig: getAIVisualProviderRuntimeConfig
  };
}

export function getAIVisualProviderAdapter(): AIVisualProviderAdapter {
  return createDisabledAIVisualProviderAdapter();
}

