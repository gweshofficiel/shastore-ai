import "server-only";

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { AIVisualProviderKey } from "@/lib/storefront/ai-visual-provider";
import type {
  AIVisualAttachTargetType,
  AIVisualGenerationJob
} from "@/lib/storefront/ai-visual-queue";
import type {
  VisualAssetApprovalStatus,
  VisualAssetReference,
  VisualAssetSlot
} from "@/lib/storefront/visual-assets";
import { visualAssetSlotSizing } from "@/lib/storefront/visual-assets";

export type AIVisualGeneratedAssetType =
  | "product_primary_image"
  | "product_gallery_image"
  | "category_image"
  | "category_banner"
  | "hero_banner"
  | "promo_banner"
  | "collection_banner";

export type AIVisualGeneratedAssetReference = VisualAssetReference & {
  assetType: AIVisualGeneratedAssetType;
  generatedAt: string;
  provider: AIVisualProviderKey;
  storageKey: string;
  targetId: string | null;
  targetType: AIVisualAttachTargetType;
};

export type AIVisualAssetOutput = {
  contentType?: string | null;
  data?: Uint8Array | null;
  height?: number | null;
  publicUrl?: string | null;
  width?: number | null;
};

export type AIVisualStoragePlan = {
  aspectRatio: string;
  bucket: string | null;
  contentType: string | null;
  fitMode: string;
  height: number;
  objectPosition: string;
  publicUrl: string | null;
  r2Configured: boolean;
  storageKey: string;
  width: number;
};

export type AIVisualStorageUploadResult = {
  error: string | null;
  output: AIVisualAssetOutput | null;
  plan: AIVisualStoragePlan;
};

export type AIVisualAttachmentResult = {
  asset: AIVisualGeneratedAssetReference;
  overwritten: boolean;
  skipped: boolean;
  storeData: Record<string, unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "asset";
}

function r2S3Endpoint(accountId: string) {
  return `https://${accountId}.r2.cloudflarestorage.com`;
}

function invalidHeaderCredentialChars(value: string) {
  return /[\r\n\u0000]/.test(value);
}

function readR2Env(name: string, raw: string | undefined): { error: string | null; value: string | null } {
  if (!raw) {
    return { error: null, value: null };
  }

  const value = raw.trim();

  if (!value) {
    return { error: null, value: null };
  }

  if (invalidHeaderCredentialChars(value)) {
    return {
      error: `${name} contains invalid characters (newline, carriage return, or null). Re-save the value in your server environment without line breaks or pasted formatting.`,
      value: null
    };
  }

  return { error: null, value };
}

function createR2S3Client(config: {
  accessKeyId: string;
  accountId: string;
  bucket: string;
  secretAccessKey: string;
}) {
  const endpoint = r2S3Endpoint(config.accountId);
  const client = new S3Client({
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey
    },
    endpoint,
    region: "auto"
  });

  client.middlewareStack.add(
    (next) => async (args) => {
      const request = args.request as { headers?: Record<string, unknown> } | undefined;
      const headerKeys = request?.headers ? Object.keys(request.headers).map((key) => key.toLowerCase()) : [];

      console.info("AI visual R2 SDK outgoing request.", {
        bucket: config.bucket,
        endpoint,
        headerKeys,
        uploadMethod: "S3Client.send(PutObjectCommand)"
      });

      return next(args);
    },
    {
      name: "aiVisualR2RequestDebugLogging",
      step: "finalizeRequest"
    }
  );

  return client;
}

function r2Config() {
  const accountIdResult = readR2Env("CLOUDFLARE_R2_ACCOUNT_ID", process.env.CLOUDFLARE_R2_ACCOUNT_ID);
  const accessKeyIdResult = readR2Env("CLOUDFLARE_R2_ACCESS_KEY_ID", process.env.CLOUDFLARE_R2_ACCESS_KEY_ID);
  const secretAccessKeyResult = readR2Env(
    "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
    process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY
  );
  const bucketResult = readR2Env("CLOUDFLARE_R2_BUCKET", process.env.CLOUDFLARE_R2_BUCKET);
  const publicBaseUrlResult = readR2Env(
    "CLOUDFLARE_R2_PUBLIC_URL",
    process.env.CLOUDFLARE_R2_PUBLIC_URL || process.env.AI_VISUAL_R2_PUBLIC_BASE_URL
  );
  const invalidEnvError =
    accountIdResult.error ||
    accessKeyIdResult.error ||
    secretAccessKeyResult.error ||
    bucketResult.error ||
    publicBaseUrlResult.error;

  if (invalidEnvError) {
    return {
      error: invalidEnvError,
      value: null
    };
  }

  const accountId = accountIdResult.value;
  const accessKeyId = accessKeyIdResult.value;
  const secretAccessKey = secretAccessKeyResult.value;
  const bucket = bucketResult.value;
  const publicBaseUrl = publicBaseUrlResult.value;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicBaseUrl) {
    return {
      error: "Cloudflare R2 is not fully configured. Set CLOUDFLARE_R2_ACCOUNT_ID, CLOUDFLARE_R2_ACCESS_KEY_ID, CLOUDFLARE_R2_SECRET_ACCESS_KEY, CLOUDFLARE_R2_BUCKET, and CLOUDFLARE_R2_PUBLIC_URL.",
      value: null
    };
  }

  return {
    error: null,
    value: {
      accessKeyId,
      accountId,
      bucket,
      publicBaseUrl,
      secretAccessKey
    }
  };
}

export function generatedAssetTypeForSlot(slot: VisualAssetSlot): AIVisualGeneratedAssetType {
  if (slot === "product.gallery") {
    return "product_gallery_image";
  }

  if (slot.startsWith("product.")) {
    return "product_primary_image";
  }

  if (slot === "category.banner") {
    return "category_banner";
  }

  if (slot.startsWith("category.")) {
    return "category_image";
  }

  if (slot.startsWith("hero.")) {
    return "hero_banner";
  }

  if (slot === "marketing.collection") {
    return "collection_banner";
  }

  return "promo_banner";
}

export function r2PrefixForGeneratedAsset({
  slot,
  storeId,
  targetId
}: {
  slot: VisualAssetSlot;
  storeId: string;
  targetId: string | null;
}) {
  const safeStoreId = slugify(storeId);
  const safeTargetId = targetId ? slugify(targetId) : "template";

  if (slot.startsWith("product.")) {
    return `stores/${safeStoreId}/products/${safeTargetId}/ai/`;
  }

  if (slot.startsWith("category.")) {
    return `stores/${safeStoreId}/categories/${safeTargetId}/ai/`;
  }

  if (slot.startsWith("hero.")) {
    return `stores/${safeStoreId}/banners/hero/`;
  }

  if (slot === "marketing.collection") {
    return targetId
      ? `stores/${safeStoreId}/collections/${safeTargetId}/ai/`
      : `stores/${safeStoreId}/collections/`;
  }

  return `stores/${safeStoreId}/banners/promo/`;
}

export function planGeneratedAssetStorage({
  job,
  output
}: {
  job: AIVisualGenerationJob;
  output?: AIVisualAssetOutput | null;
}): AIVisualStoragePlan {
  const extension = output?.contentType === "image/png" ? "png" : "webp";
  const sizing = visualAssetSlotSizing(job.slot);
  const storageKey = [
    r2PrefixForGeneratedAsset({
      slot: job.slot,
      storeId: job.storeId,
      targetId: job.attachTarget.entityId
    }),
    `${slugify(job.requestId)}.${extension}`
  ].join("");

  return {
    aspectRatio: sizing.aspectRatio,
    bucket: job.storage.bucket,
    contentType: output?.contentType ?? null,
    fitMode: sizing.fitMode,
    height: output?.height ?? sizing.height,
    objectPosition: sizing.objectPosition,
    publicUrl: output?.publicUrl ?? null,
    r2Configured: job.storage.provider === "cloudflare-r2" && Boolean(job.storage.bucket),
    storageKey,
    width: output?.width ?? sizing.width
  };
}

export function createGeneratedAssetReference({
  job,
  output
}: {
  job: AIVisualGenerationJob;
  output?: AIVisualAssetOutput | null;
}): AIVisualGeneratedAssetReference {
  const storage = planGeneratedAssetStorage({ job, output });

  return {
    alt: job.request.entityTitle,
    aspectRatio: storage.aspectRatio,
    approvalStatus: "generated",
    assetId: job.requestId,
    assetType: generatedAssetTypeForSlot(job.slot),
    bucket: storage.bucket,
    fitMode: storage.fitMode,
    generatedAt: new Date().toISOString(),
    height: storage.height,
    objectPosition: storage.objectPosition,
    promptKey: job.request.prompt.blueprint.id,
    provider: job.provider,
    publicUrl: storage.publicUrl,
    r2Key: storage.storageKey,
    source: storage.publicUrl ? "r2" : "ai-ready",
    storageKey: storage.storageKey,
    targetId: job.attachTarget.entityId,
    targetType: job.attachTarget.type,
    url: storage.publicUrl,
    width: storage.width
  };
}

export async function uploadGeneratedAssetToR2({
  job,
  output
}: {
  job: AIVisualGenerationJob;
  output: AIVisualAssetOutput;
}): Promise<AIVisualStorageUploadResult> {
  const plan = planGeneratedAssetStorage({ job, output });

  if (!output.data?.length) {
    return {
      error: "Generated asset output did not include image bytes.",
      output: null,
      plan
    };
  }

  const config = r2Config();

  if (!config.value) {
    return {
      error: config.error,
      output: null,
      plan
    };
  }

  const bucket = config.value.bucket;
  const endpoint = r2S3Endpoint(config.value.accountId);
  const contentType = output.contentType || "image/png";
  const key = plan.storageKey;

  console.info("AI visual R2 upload starting.", {
    bucket,
    endpoint,
    key,
    uploadMethod: "S3Client.send(PutObjectCommand)"
  });

  try {
    const client = createR2S3Client({
      ...config.value,
      bucket
    });

    await client.send(
      new PutObjectCommand({
        Body: Buffer.from(output.data),
        Bucket: bucket,
        ContentType: contentType,
        Key: key
      })
    );
  } catch (error) {
    let message = error instanceof Error ? error.message : "Unknown R2 upload error.";

    if (message.includes('Invalid character in header content ["authorization"]')) {
      message =
        "Cloudflare R2 credentials produced an invalid Authorization header. Check CLOUDFLARE_R2_ACCESS_KEY_ID (and related R2 secrets) in your deployment environment for trailing spaces, quotes, or Windows line breaks. " +
        message;
    }

    return {
      error: `Cloudflare R2 upload failed for bucket "${bucket}" key "${key}" at ${endpoint}: ${message}`,
      output: null,
      plan
    };
  }

  const publicUrl = `${config.value.publicBaseUrl.replace(/\/$/, "")}/${plan.storageKey}`;

  return {
    error: null,
    output: {
      contentType,
      data: output.data,
      height: plan.height,
      publicUrl,
      width: plan.width
    },
    plan: {
      ...plan,
      publicUrl
    }
  };
}

export function attachGeneratedVisualAsset({
  allowOverwrite = false,
  asset,
  slot,
  storeData,
  targetId,
  targetType
}: {
  allowOverwrite?: boolean;
  asset: AIVisualGeneratedAssetReference;
  slot: VisualAssetSlot;
  storeData: Record<string, unknown>;
  targetId: string | null;
  targetType: AIVisualAttachTargetType;
}): AIVisualAttachmentResult {
  const generatedVisualAssets = isRecord(storeData.generatedVisualAssets)
    ? storeData.generatedVisualAssets
    : {};
  const targetGroup = isRecord(generatedVisualAssets[targetType])
    ? generatedVisualAssets[targetType] as Record<string, unknown>
    : {};
  const entityKey = targetId ?? "template";
  const entityAssets = isRecord(targetGroup[entityKey])
    ? targetGroup[entityKey] as Record<string, unknown>
    : {};
  const existing = entityAssets[slot];

  if (existing && !allowOverwrite) {
    return {
      asset: existing as AIVisualGeneratedAssetReference,
      overwritten: false,
      skipped: true,
      storeData
    };
  }

  return {
    asset,
    overwritten: Boolean(existing),
    skipped: false,
    storeData: {
      ...storeData,
      generatedVisualAssets: {
        ...generatedVisualAssets,
        [targetType]: {
          ...targetGroup,
          [entityKey]: {
            ...entityAssets,
            [slot]: asset
          }
        }
      }
    }
  };
}

export function updateGeneratedVisualAssetApproval({
  asset,
  status,
  storeData,
  targetId,
  targetType,
  slot
}: {
  asset: VisualAssetReference;
  status: VisualAssetApprovalStatus;
  storeData: Record<string, unknown>;
  targetId: string | null;
  targetType: AIVisualAttachTargetType;
  slot: VisualAssetSlot;
}) {
  const timestamp = new Date().toISOString();
  const generatedVisualAssets = isRecord(storeData.generatedVisualAssets)
    ? storeData.generatedVisualAssets
    : {};
  const targetGroup = isRecord(generatedVisualAssets[targetType])
    ? generatedVisualAssets[targetType] as Record<string, unknown>
    : {};
  const entityKey = targetId ?? "template";
  const entityAssets = isRecord(targetGroup[entityKey])
    ? targetGroup[entityKey] as Record<string, unknown>
    : {};
  const existingAsset = isRecord(entityAssets[slot])
    ? entityAssets[slot] as VisualAssetReference
    : {};
  const nextAsset: VisualAssetReference = {
    ...existingAsset,
    ...asset,
    approvalStatus: status,
    approvedAt: status === "approved" ? timestamp : existingAsset.approvedAt ?? null,
    disabledAt: status === "disabled" ? timestamp : existingAsset.disabledAt ?? null,
    rejectedAt: status === "rejected" ? timestamp : existingAsset.rejectedAt ?? null
  };

  return {
    asset: nextAsset,
    storeData: {
      ...storeData,
      generatedVisualAssets: {
        ...generatedVisualAssets,
        [targetType]: {
          ...targetGroup,
          [entityKey]: {
            ...entityAssets,
            [slot]: nextAsset
          }
        }
      }
    }
  };
}

export function attachGeneratedProductPrimaryImage(input: Omit<Parameters<typeof attachGeneratedVisualAsset>[0], "slot" | "targetType">) {
  return attachGeneratedVisualAsset({ ...input, slot: "product.primary", targetType: "product" });
}

export function attachGeneratedProductGalleryImage(input: Omit<Parameters<typeof attachGeneratedVisualAsset>[0], "slot" | "targetType">) {
  return attachGeneratedVisualAsset({ ...input, slot: "product.gallery", targetType: "product" });
}

export function attachGeneratedCategoryImage(input: Omit<Parameters<typeof attachGeneratedVisualAsset>[0], "slot" | "targetType">) {
  return attachGeneratedVisualAsset({ ...input, slot: "category.image", targetType: "category" });
}

export function attachGeneratedCategoryBanner(input: Omit<Parameters<typeof attachGeneratedVisualAsset>[0], "slot" | "targetType">) {
  return attachGeneratedVisualAsset({ ...input, slot: "category.banner", targetType: "category" });
}

export function attachGeneratedHeroBanner(input: Omit<Parameters<typeof attachGeneratedVisualAsset>[0], "slot" | "targetType">) {
  return attachGeneratedVisualAsset({ ...input, slot: "hero.desktop", targetType: "banner" });
}

export function attachGeneratedPromoBanner(input: Omit<Parameters<typeof attachGeneratedVisualAsset>[0], "slot" | "targetType">) {
  return attachGeneratedVisualAsset({ ...input, slot: "marketing.flashSale", targetType: "banner" });
}

export function attachGeneratedCollectionBanner(input: Omit<Parameters<typeof attachGeneratedVisualAsset>[0], "slot" | "targetType">) {
  return attachGeneratedVisualAsset({ ...input, slot: "marketing.collection", targetType: "collection" });
}

