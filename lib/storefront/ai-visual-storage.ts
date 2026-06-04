import "server-only";

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

