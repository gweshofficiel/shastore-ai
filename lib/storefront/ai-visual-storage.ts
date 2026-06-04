import "server-only";

import crypto from "node:crypto";
import type { AIVisualProviderKey } from "@/lib/storefront/ai-visual-provider";
import type {
  AIVisualAttachTargetType,
  AIVisualGenerationJob
} from "@/lib/storefront/ai-visual-queue";
import type {
  VisualAssetReference,
  VisualAssetSlot
} from "@/lib/storefront/visual-assets";

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
  publicUrl?: string | null;
};

export type AIVisualStoragePlan = {
  bucket: string | null;
  contentType: string | null;
  publicUrl: string | null;
  r2Configured: boolean;
  storageKey: string;
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

function hmac(key: Buffer | string, value: string) {
  return crypto.createHmac("sha256", key).update(value).digest();
}

function sha256(value: Uint8Array | string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function awsDate(date = new Date()) {
  const iso = date.toISOString().replace(/[:-]|\.\d{3}/g, "");
  return {
    date: iso.slice(0, 8),
    timestamp: iso
  };
}

function encodeS3Path(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}

function r2Config() {
  const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID;
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
  const bucket = process.env.CLOUDFLARE_R2_BUCKET;
  const publicBaseUrl = process.env.CLOUDFLARE_R2_PUBLIC_URL || process.env.AI_VISUAL_R2_PUBLIC_BASE_URL;

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
  const storageKey = [
    r2PrefixForGeneratedAsset({
      slot: job.slot,
      storeId: job.storeId,
      targetId: job.attachTarget.entityId
    }),
    `${slugify(job.requestId)}.${extension}`
  ].join("");

  return {
    bucket: job.storage.bucket,
    contentType: output?.contentType ?? null,
    publicUrl: output?.publicUrl ?? null,
    r2Configured: job.storage.provider === "cloudflare-r2" && Boolean(job.storage.bucket),
    storageKey
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
    assetId: job.requestId,
    assetType: generatedAssetTypeForSlot(job.slot),
    bucket: storage.bucket,
    generatedAt: new Date().toISOString(),
    promptKey: job.request.prompt.blueprint.id,
    provider: job.provider,
    publicUrl: storage.publicUrl,
    r2Key: storage.storageKey,
    source: storage.publicUrl ? "r2" : "ai-ready",
    storageKey: storage.storageKey,
    targetId: job.attachTarget.entityId,
    targetType: job.attachTarget.type,
    url: storage.publicUrl
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

  const region = "auto";
  const service = "s3";
  const { date, timestamp } = awsDate();
  const host = `${config.value.accountId}.r2.cloudflarestorage.com`;
  const contentType = output.contentType || "image/png";
  const bodyHash = sha256(output.data);
  const canonicalUri = `/${encodeURIComponent(config.value.bucket)}/${encodeS3Path(plan.storageKey)}`;
  const canonicalHeaders = [
    `host:${host}`,
    `x-amz-content-sha256:${bodyHash}`,
    `x-amz-date:${timestamp}`
  ].join("\n");
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = [
    "PUT",
    canonicalUri,
    "",
    `${canonicalHeaders}\n`,
    signedHeaders,
    bodyHash
  ].join("\n");
  const credentialScope = `${date}/${region}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    timestamp,
    credentialScope,
    sha256(canonicalRequest)
  ].join("\n");
  const dateKey = hmac(`AWS4${config.value.secretAccessKey}`, date);
  const regionKey = hmac(dateKey, region);
  const serviceKey = hmac(regionKey, service);
  const signingKey = hmac(serviceKey, "aws4_request");
  const signature = crypto.createHmac("sha256", signingKey).update(stringToSign).digest("hex");
  const uploadUrl = `https://${host}${canonicalUri}`;
  const response = await fetch(uploadUrl, {
    body: Buffer.from(output.data),
    headers: {
      Authorization: `AWS4-HMAC-SHA256 Credential=${config.value.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
      "Content-Type": contentType,
      "x-amz-content-sha256": bodyHash,
      "x-amz-date": timestamp
    },
    method: "PUT"
  });

  if (!response.ok) {
    const responseText = await response.text().catch(() => "");

    return {
      error: `Cloudflare R2 upload failed with HTTP ${response.status} for bucket "${config.value.bucket}" key "${plan.storageKey}".${responseText ? ` ${responseText.slice(0, 240)}` : ""}`,
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
      publicUrl
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

