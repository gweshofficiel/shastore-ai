export type VisualAssetSource = "uploaded" | "r2" | "ai-generated" | "ai-ready" | "external" | "fallback";

export type VisualAssetSlot =
  | "product.primary"
  | "product.gallery"
  | "product.fallback"
  | "product.comingSoon"
  | "category.icon"
  | "category.image"
  | "category.banner"
  | "hero.desktop"
  | "hero.mobile"
  | "hero.ctaOverlay"
  | "marketing.flashSale"
  | "marketing.seasonalSale"
  | "marketing.collection"
  | "marketing.announcement";

export type VisualAssetReference = {
  alt?: string | null;
  assetId?: string | null;
  assetType?: string | null;
  bucket?: string | null;
  generatedAt?: string | null;
  height?: number | null;
  promptKey?: string | null;
  provider?: string | null;
  publicUrl?: string | null;
  r2Key?: string | null;
  source?: VisualAssetSource | string | null;
  storageKey?: string | null;
  targetId?: string | null;
  targetType?: string | null;
  url?: string | null;
  width?: number | null;
};

export type ResolvedVisualAsset = {
  alt: string;
  assetId: string | null;
  bucket: string | null;
  promptKey: string | null;
  source: VisualAssetSource;
  slot: VisualAssetSlot;
  state: "ready" | "coming-soon" | "fallback";
  url: string | null;
};

export type ProductImageSlots = {
  fallback: ResolvedVisualAsset;
  gallery: ResolvedVisualAsset[];
  primary: ResolvedVisualAsset;
};

export type CategoryImageSlots = {
  banner: ResolvedVisualAsset;
  icon: ResolvedVisualAsset;
  image: ResolvedVisualAsset;
};

export type HeroBannerSlots = {
  ctaOverlay: ResolvedVisualAsset;
  desktop: ResolvedVisualAsset;
  mobile: ResolvedVisualAsset;
};

export type GeneratedVisualAssetTargetType = "product" | "category" | "banner" | "collection";

export type GeneratedVisualAssetStore = Partial<
  Record<GeneratedVisualAssetTargetType, Record<string, Partial<Record<VisualAssetSlot, VisualAssetReference>>>>
>;

export type GeneratedVisualAssetSlotInput = {
  generatedVisualAssets?: GeneratedVisualAssetStore | null;
  slot: VisualAssetSlot;
  storeId?: string | null;
  targetId?: string | null;
};

export type MarketingBannerSlots = {
  announcement: ResolvedVisualAsset;
  collection: ResolvedVisualAsset;
  flashSale: ResolvedVisualAsset;
  seasonalSale: ResolvedVisualAsset;
};

const sourceAliases: Record<string, VisualAssetSource> = {
  ai: "ai-generated",
  ai_generated: "ai-generated",
  aiGenerated: "ai-generated",
  aiReady: "ai-ready",
  ai_ready: "ai-ready",
  cloudflare: "r2",
  cloudflare_r2: "r2",
  external_url: "external",
  upload: "uploaded"
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function safeAssetUrl(value: unknown) {
  const url = stringValue(value);

  if (!url) {
    return null;
  }

  if (
    url.startsWith("/") ||
    url.startsWith("data:image/") ||
    url.startsWith("blob:") ||
    /^https?:\/\//i.test(url)
  ) {
    return url;
  }

  return null;
}

export function normalizeVisualAssetSource(value: unknown, url?: string | null): VisualAssetSource {
  const source = stringValue(value);

  if (source) {
    const normalized = sourceAliases[source] ?? source;

    if (
      normalized === "uploaded" ||
      normalized === "r2" ||
      normalized === "ai-generated" ||
      normalized === "ai-ready" ||
      normalized === "external" ||
      normalized === "fallback"
    ) {
      return normalized;
    }
  }

  if (url?.startsWith("http")) {
    return "external";
  }

  return url ? "uploaded" : "fallback";
}

export function visualAssetReference(value: unknown): VisualAssetReference | null {
  if (typeof value === "string") {
    const url = safeAssetUrl(value);
    return url ? { source: normalizeVisualAssetSource(null, url), url } : null;
  }

  if (!isRecord(value)) {
    return null;
  }

  const url = safeAssetUrl(value.url ?? value.publicUrl ?? value.imageUrl ?? value.src ?? value.href);
  const publicUrl = safeAssetUrl(value.publicUrl ?? value.url ?? value.imageUrl ?? value.src);
  const promptKey = stringValue(value.promptKey ?? value.aiPromptKey ?? value.generationKey) || null;
  const assetId = stringValue(value.assetId ?? value.assetKey ?? value.id) || null;
  const r2Key = stringValue(value.r2Key ?? value.storageKey ?? value.key ?? value.path) || null;

  if (!url && !publicUrl && !promptKey && !assetId && !r2Key) {
    return null;
  }

  return {
    alt: stringValue(value.alt) || null,
    assetId,
    assetType: stringValue(value.assetType) || null,
    bucket: stringValue(value.bucket) || null,
    generatedAt: stringValue(value.generatedAt) || null,
    height: numberValue(value.height),
    promptKey,
    provider: stringValue(value.provider) || null,
    publicUrl,
    r2Key,
    source: normalizeVisualAssetSource(value.source, url ?? publicUrl),
    storageKey: r2Key,
    targetId: stringValue(value.targetId) || null,
    targetType: stringValue(value.targetType) || null,
    url: url ?? publicUrl,
    width: numberValue(value.width)
  };
}

export function generatedVisualAssetsFromStoreData(value: unknown): GeneratedVisualAssetStore {
  if (!isRecord(value) || !isRecord(value.generatedVisualAssets)) {
    return {};
  }

  const generatedVisualAssets: GeneratedVisualAssetStore = {};

  for (const targetType of ["product", "category", "banner", "collection"] as const) {
    const targetGroup = value.generatedVisualAssets[targetType];

    if (!isRecord(targetGroup)) {
      continue;
    }

    const normalizedTargetGroup: Record<string, Partial<Record<VisualAssetSlot, VisualAssetReference>>> = {};

    for (const [targetId, slots] of Object.entries(targetGroup)) {
      if (!isRecord(slots)) {
        continue;
      }

      const normalizedSlots: Partial<Record<VisualAssetSlot, VisualAssetReference>> = {};

      for (const [slot, asset] of Object.entries(slots)) {
        const reference = visualAssetReference(asset);

        if (reference) {
          normalizedSlots[slot as VisualAssetSlot] = reference;
        }
      }

      if (Object.keys(normalizedSlots).length > 0) {
        normalizedTargetGroup[targetId] = normalizedSlots;
      }
    }

    if (Object.keys(normalizedTargetGroup).length > 0) {
      generatedVisualAssets[targetType] = normalizedTargetGroup;
    }
  }

  return generatedVisualAssets;
}

export function generatedVisualAssetForTarget({
  generatedVisualAssets,
  slot,
  targetId,
  targetType
}: {
  generatedVisualAssets?: GeneratedVisualAssetStore | null;
  slot: VisualAssetSlot;
  targetId: string | null;
  targetType: GeneratedVisualAssetTargetType;
}): VisualAssetReference | null {
  if (!generatedVisualAssets || !targetId) {
    return null;
  }

  return generatedVisualAssets[targetType]?.[targetId]?.[slot] ?? null;
}

function generatedVisualTargetTypesForSlot(slot: VisualAssetSlot): GeneratedVisualAssetTargetType[] {
  if (slot.startsWith("product.")) {
    return ["product"];
  }

  if (slot.startsWith("category.")) {
    return ["category"];
  }

  if (slot === "marketing.collection") {
    return ["collection", "banner"];
  }

  return ["banner"];
}

function generatedVisualTargetIdsForSlot({
  slot,
  storeId,
  targetId
}: Omit<GeneratedVisualAssetSlotInput, "generatedVisualAssets">) {
  return Array.from(new Set([
    targetId ?? null,
    storeId ? `${storeId}-${slot}` : null,
    slot,
    "template"
  ].filter((value): value is string => Boolean(value))));
}

export function resolveGeneratedVisualAssetForSlot({
  generatedVisualAssets,
  slot,
  storeId,
  targetId
}: GeneratedVisualAssetSlotInput): VisualAssetReference | null {
  if (!generatedVisualAssets) {
    return null;
  }

  const targetTypes = generatedVisualTargetTypesForSlot(slot);
  const targetIds = generatedVisualTargetIdsForSlot({ slot, storeId, targetId });

  for (const targetType of targetTypes) {
    for (const id of targetIds) {
      const asset = generatedVisualAssets[targetType]?.[id]?.[slot];

      if (asset) {
        return asset;
      }
    }
  }

  for (const targetType of targetTypes) {
    const targetGroup = generatedVisualAssets[targetType];

    if (!targetGroup || targetType === "product" || targetType === "category") {
      continue;
    }

    for (const slots of Object.values(targetGroup)) {
      const asset = slots[slot];

      if (asset) {
        return asset;
      }
    }
  }

  return null;
}

export function resolveVisualAssetSlot({
  alt,
  candidates,
  slot
}: {
  alt: string;
  candidates: unknown[];
  slot: VisualAssetSlot;
}): ResolvedVisualAsset {
  const reference = candidates.map(visualAssetReference).find(Boolean) ?? null;
  const url = reference?.url ?? reference?.publicUrl ?? null;

  return {
    alt: reference?.alt || alt,
    assetId: reference?.assetId ?? null,
    bucket: reference?.bucket ?? null,
    promptKey: reference?.promptKey ?? null,
    source: normalizeVisualAssetSource(reference?.source, url),
    slot,
    state: url ? "ready" : reference?.promptKey || reference?.assetId ? "coming-soon" : "fallback",
    url
  };
}

export function resolveVisualAssetSlotWithGenerated({
  alt,
  catalogCandidates = [],
  fallbackCandidates = [],
  generatedVisualAssets,
  sectionCandidates = [],
  slot,
  storeId,
  targetId,
  themeCandidates = []
}: GeneratedVisualAssetSlotInput & {
  alt: string;
  catalogCandidates?: unknown[];
  fallbackCandidates?: unknown[];
  sectionCandidates?: unknown[];
  themeCandidates?: unknown[];
}): ResolvedVisualAsset {
  const generatedAsset = resolveGeneratedVisualAssetForSlot({
    generatedVisualAssets,
    slot,
    storeId,
    targetId
  });

  return resolveVisualAssetSlot({
    alt,
    candidates: [
      generatedAsset,
      ...themeCandidates,
      ...sectionCandidates,
      ...catalogCandidates,
      ...fallbackCandidates
    ],
    slot
  });
}

export function productGalleryAssetReferences(gallery: unknown[]) {
  return gallery.map(visualAssetReference).filter((asset): asset is VisualAssetReference => Boolean(asset));
}

export function resolveProductImageSlots({
  fallback,
  gallery,
  generatedVisualAssets,
  generatedPrimary,
  primary,
  storeId,
  targetId,
  title
}: {
  fallback?: unknown;
  gallery?: unknown[];
  generatedVisualAssets?: GeneratedVisualAssetStore | null;
  generatedPrimary?: unknown;
  primary?: unknown;
  storeId?: string | null;
  targetId?: string | null;
  title: string;
}): ProductImageSlots {
  const galleryAssets = productGalleryAssetReferences(gallery ?? []);
  const primaryAsset = resolveVisualAssetSlotWithGenerated({
    alt: title,
    catalogCandidates: [primary, ...galleryAssets],
    generatedVisualAssets,
    sectionCandidates: [generatedPrimary],
    slot: "product.primary",
    storeId,
    targetId
  });

  return {
    fallback: resolveVisualAssetSlot({
      alt: `${title} image coming soon`,
      candidates: [fallback],
      slot: primaryAsset.url ? "product.fallback" : "product.comingSoon"
    }),
    gallery: galleryAssets.map((asset, index) =>
      resolveVisualAssetSlot({
        alt: `${title} gallery image ${index + 1}`,
        candidates: [asset],
        slot: "product.gallery"
      })
    ),
    primary: primaryAsset
  };
}

export function resolveCategoryImageSlots({
  banner,
  generatedVisualAssets,
  icon,
  image,
  name,
  storeId,
  targetId
}: {
  banner?: unknown;
  generatedVisualAssets?: GeneratedVisualAssetStore | null;
  icon?: unknown;
  image?: unknown;
  name: string;
  storeId?: string | null;
  targetId?: string | null;
}): CategoryImageSlots {
  return {
    banner: resolveVisualAssetSlotWithGenerated({
      alt: `${name} banner`,
      catalogCandidates: [banner, image],
      generatedVisualAssets,
      slot: "category.banner",
      storeId,
      targetId
    }),
    icon: resolveVisualAssetSlot({ alt: `${name} icon`, candidates: [icon], slot: "category.icon" }),
    image: resolveVisualAssetSlotWithGenerated({
      alt: name,
      catalogCandidates: [image, banner],
      generatedVisualAssets,
      slot: "category.image",
      storeId,
      targetId
    })
  };
}

export function resolveHeroBannerSlots({
  ctaOverlay,
  desktop,
  generatedVisualAssets,
  mobile,
  storeId,
  targetId,
  themeDesktop,
  themeMobile,
  title
}: {
  ctaOverlay?: unknown;
  desktop?: unknown;
  generatedVisualAssets?: GeneratedVisualAssetStore | null;
  mobile?: unknown;
  storeId?: string | null;
  targetId?: string | null;
  themeDesktop?: unknown;
  themeMobile?: unknown;
  title: string;
}): HeroBannerSlots {
  const desktopAsset = resolveVisualAssetSlotWithGenerated({
    alt: title,
    generatedVisualAssets,
    themeCandidates: [themeDesktop],
    sectionCandidates: [desktop, mobile],
    slot: "hero.desktop",
    storeId,
    targetId
  });

  return {
    ctaOverlay: resolveVisualAssetSlotWithGenerated({
      alt: `${title} CTA overlay`,
      generatedVisualAssets,
      sectionCandidates: [ctaOverlay],
      slot: "hero.ctaOverlay",
      storeId,
      targetId
    }),
    desktop: desktopAsset,
    mobile: resolveVisualAssetSlotWithGenerated({
      alt: `${title} mobile`,
      generatedVisualAssets,
      themeCandidates: [themeMobile, themeDesktop],
      sectionCandidates: [mobile, desktop],
      slot: "hero.mobile",
      storeId,
      targetId
    })
  };
}

export function resolveMarketingBannerSlots(
  config: Record<string, unknown>,
  input: Omit<GeneratedVisualAssetSlotInput, "slot"> = {}
): MarketingBannerSlots {
  return {
    announcement: resolveVisualAssetSlotWithGenerated({
      alt: "Announcement banner",
      generatedVisualAssets: input.generatedVisualAssets,
      sectionCandidates: [config.announcementBanner, config.announcementBannerUrl],
      slot: "marketing.announcement",
      storeId: input.storeId,
      targetId: input.targetId
    }),
    collection: resolveVisualAssetSlotWithGenerated({
      alt: "Collection banner",
      generatedVisualAssets: input.generatedVisualAssets,
      sectionCandidates: [config.collectionBanner, config.collectionBannerUrl],
      slot: "marketing.collection",
      storeId: input.storeId,
      targetId: input.targetId
    }),
    flashSale: resolveVisualAssetSlotWithGenerated({
      alt: "Flash sale banner",
      generatedVisualAssets: input.generatedVisualAssets,
      sectionCandidates: [config.flashSaleBanner, config.flashSaleBannerUrl],
      slot: "marketing.flashSale",
      storeId: input.storeId,
      targetId: input.targetId
    }),
    seasonalSale: resolveVisualAssetSlotWithGenerated({
      alt: "Seasonal sale banner",
      generatedVisualAssets: input.generatedVisualAssets,
      sectionCandidates: [config.seasonalSaleBanner, config.seasonalSaleBannerUrl],
      slot: "marketing.seasonalSale",
      storeId: input.storeId,
      targetId: input.targetId
    })
  };
}

