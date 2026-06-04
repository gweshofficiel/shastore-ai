import "server-only";

import OpenAI from "openai";
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
  output: {
    contentType: string;
    data: Uint8Array;
  } | null;
  providerPlan: AIVisualAssetProviderPlan;
  status: "completed" | "pending" | "skipped";
};

export type AIVisualProviderAdapter = {
  createPendingJob(request: AIVisualAssetRequest): AIVisualProviderPendingJob;
  generate(request: AIVisualAssetRequest): Promise<AIVisualProviderGenerateResult>;
  key: AIVisualProviderKey;
  runtimeConfig(): AIVisualProviderRuntimeConfig;
};

function enabledProvider(value: unknown): AIVisualProviderKey {
  if (value === "disabled") {
    return "disabled";
  }

  if (
    value === "openai-image" ||
    value === "replicate" ||
    value === "stability" ||
    value === "custom"
  ) {
    return value;
  }

  return "openai-image";
}

function providerApiKey() {
  return process.env.AI_IMAGE_PROVIDER_API_KEY ||
    process.env.AI_VISUAL_PROVIDER_API_KEY ||
    process.env.OPENAI_API_KEY ||
    null;
}

export function getAIVisualProviderRuntimeConfig(): AIVisualProviderRuntimeConfig {
  const provider = enabledProvider(process.env.AI_VISUAL_PROVIDER);
  const apiKeyConfigured = Boolean(providerApiKey());
  const endpointConfigured = Boolean(process.env.AI_VISUAL_PROVIDER_ENDPOINT);
  const r2Configured = Boolean(
    process.env.CLOUDFLARE_R2_ACCOUNT_ID &&
    process.env.CLOUDFLARE_R2_ACCESS_KEY_ID &&
    process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY &&
    process.env.CLOUDFLARE_R2_BUCKET &&
    (process.env.CLOUDFLARE_R2_PUBLIC_URL || process.env.AI_VISUAL_R2_PUBLIC_BASE_URL)
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
        output: null,
        providerPlan,
        status: "skipped"
      };
    },
    key: "disabled",
    runtimeConfig: getAIVisualProviderRuntimeConfig
  };
}

function openAIImageModel() {
  return process.env.AI_VISUAL_OPENAI_IMAGE_MODEL || "gpt-image-1";
}

function openAIImageSize(value: unknown) {
  return value === "1024x1536" || value === "1536x1024" || value === "auto" ? value : "1024x1024";
}

function imagePromptForRequest(request: AIVisualAssetRequest) {
  return [
    request.prompt.promptText,
    request.prompt.negativePrompt ? `Avoid: ${request.prompt.negativePrompt}` : "",
    "Create a polished ecommerce visual. No text, no logos, no watermarks."
  ].filter(Boolean).join("\n\n");
}

function isFirstSafeExecutionSlot(request: AIVisualAssetRequest) {
  return request.slot === "product.primary" || request.slot === "category.image" || request.slot === "hero.desktop";
}

export function createOpenAIVisualProviderAdapter(): AIVisualProviderAdapter {
  return {
    createPendingJob(request) {
      const config = getAIVisualProviderRuntimeConfig();

      return {
        createdAt: new Date().toISOString(),
        jobId: pendingJobId(request, "openai-image"),
        provider: "openai-image",
        providerStatus: config.status,
        request,
        status: "pending"
      };
    },
    async generate(request) {
      const providerPlan = planAIVisualAssetProviderRequest(request);
      const apiKey = providerApiKey();

      if (!isFirstSafeExecutionSlot(request)) {
        return {
          error: "First safe AI visual execution is limited to product primary image, category image, or hero banner targets.",
          job: this.createPendingJob(request),
          output: null,
          providerPlan,
          status: "skipped"
        };
      }

      if (!apiKey) {
        return {
          error: "AI image provider is not configured. Set AI_IMAGE_PROVIDER_API_KEY on the server.",
          job: this.createPendingJob(request),
          output: null,
          providerPlan,
          status: "skipped"
        };
      }

      try {
        const client = new OpenAI({ apiKey });
        const response = await client.images.generate({
          model: openAIImageModel(),
          n: 1,
          prompt: imagePromptForRequest(request),
          size: openAIImageSize(process.env.AI_VISUAL_OPENAI_IMAGE_SIZE)
        });
        const image = response.data?.[0] as { b64_json?: string | null } | undefined;
        const b64 = image?.b64_json;

        if (!b64) {
          return {
            error: "OpenAI image generation completed without returning image data.",
            job: this.createPendingJob(request),
            output: null,
            providerPlan,
            status: "skipped"
          };
        }

        return {
          error: null,
          job: this.createPendingJob(request),
          output: {
            contentType: "image/png",
            data: Uint8Array.from(Buffer.from(b64, "base64"))
          },
          providerPlan,
          status: "completed"
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "OpenAI image generation failed.";

        return {
          error: message,
          job: this.createPendingJob(request),
          output: null,
          providerPlan,
          status: "skipped"
        };
      }
    },
    key: "openai-image",
    runtimeConfig: getAIVisualProviderRuntimeConfig
  };
}

export function getAIVisualProviderAdapter(): AIVisualProviderAdapter {
  const config = getAIVisualProviderRuntimeConfig();

  if (config.provider === "openai-image") {
    return createOpenAIVisualProviderAdapter();
  }

  return createDisabledAIVisualProviderAdapter();
}

