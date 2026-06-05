import "server-only";

import OpenAI from "openai";
import type {
  AIVisualAssetProviderPlan,
  AIVisualAssetRequest
} from "@/lib/storefront/ai-visual-assets";
import { planAIVisualAssetProviderRequest } from "@/lib/storefront/ai-visual-assets";
import { visualAssetSlotSizing, type OpenAIVisualImageSize } from "@/lib/storefront/visual-assets";

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
    height?: number | null;
    width?: number | null;
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

function configuredOpenAIImageSize(value: unknown): OpenAIVisualImageSize | null {
  return value === "1024x1536" || value === "1536x1024" || value === "1024x1024" || value === "auto" ? value : null;
}

function openAIImageSizeForRequest(request: AIVisualAssetRequest): OpenAIVisualImageSize {
  return configuredOpenAIImageSize(process.env.AI_VISUAL_OPENAI_IMAGE_SIZE) ?? visualAssetSlotSizing(request.slot).openAIImageSize;
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

const OPENAI_IMAGE_GENERATION_TIMEOUT_MS = 120_000;
const OPENAI_IMAGE_DOWNLOAD_TIMEOUT_MS = 60_000;

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`${label} timed out after ${Math.round(ms / 1000)} seconds.`));
        }, ms);
      })
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

type OpenAIImageItem = {
  b64_json?: string | null;
  revised_prompt?: string | null;
  url?: string | null;
};

function contentTypeFromUrl(url: string) {
  const lowered = url.toLowerCase();

  if (lowered.includes(".webp")) {
    return "image/webp";
  }

  if (lowered.includes(".jpg") || lowered.includes(".jpeg")) {
    return "image/jpeg";
  }

  return "image/png";
}

async function decodeOpenAIImageItem(
  image: OpenAIImageItem
): Promise<{ contentType: string; data: Uint8Array } | { error: string }> {
  const b64 = image.b64_json;

  if (typeof b64 === "string" && b64.length > 0) {
    return {
      contentType: "image/png",
      data: Uint8Array.from(Buffer.from(b64, "base64"))
    };
  }

  const url = image.url;

  if (typeof url === "string" && url.length > 0) {
    try {
      const response = await withTimeout(
        fetch(url),
        OPENAI_IMAGE_DOWNLOAD_TIMEOUT_MS,
        "OpenAI image URL download"
      );

      if (!response.ok) {
        return {
          error: `OpenAI returned an image URL but download failed with HTTP ${response.status}.`
        };
      }

      const buffer = Buffer.from(await response.arrayBuffer());

      if (!buffer.length) {
        return {
          error: "OpenAI image URL download returned an empty body."
        };
      }

      return {
        contentType: response.headers.get("content-type") || contentTypeFromUrl(url),
        data: Uint8Array.from(buffer)
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "OpenAI image URL download failed.";

      return { error: message };
    }
  }

  const keys = Object.keys(image).filter((key) => image[key as keyof OpenAIImageItem] != null);

  return {
    error: `OpenAI image generation completed without usable image data (expected b64_json or url; received keys: ${keys.join(", ") || "none"}).`
  };
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
        const model = openAIImageModel();
        const response = await withTimeout(
          client.images.generate({
            model,
            n: 1,
            prompt: imagePromptForRequest(request),
            size: openAIImageSizeForRequest(request)
          }),
          OPENAI_IMAGE_GENERATION_TIMEOUT_MS,
          `OpenAI ${model} image generation`
        );
        const image = response.data?.[0] as OpenAIImageItem | undefined;

        if (!image) {
          return {
            error: `OpenAI ${model} returned no image entries in response.data.`,
            job: this.createPendingJob(request),
            output: null,
            providerPlan,
            status: "skipped"
          };
        }

        const decoded = await decodeOpenAIImageItem(image);

        if ("error" in decoded) {
          return {
            error: decoded.error,
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
            ...decoded,
            height: visualAssetSlotSizing(request.slot).height,
            width: visualAssetSlotSizing(request.slot).width
          },
          providerPlan,
          status: "completed"
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "OpenAI image generation failed.";

        return {
          error: `OpenAI image generation failed: ${message}`,
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

