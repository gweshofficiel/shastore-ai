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
  aspectRatio?: string | null;
  assetId?: string | null;
  assetType?: string | null;
  bucket?: string | null;
  fitMode?: VisualAssetFitMode | string | null;
  generatedAt?: string | null;
  height?: number | null;
  objectPosition?: string | null;
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
  aspectRatio: string | null;
  assetId: string | null;
  bucket: string | null;
  fitMode: VisualAssetFitMode;
  height: number | null;
  objectPosition: string;
  promptKey: string | null;
  source: VisualAssetSource;
  slot: VisualAssetSlot;
  state: "ready" | "coming-soon" | "fallback";
  url: string | null;
  width: number | null;
};

export type VisualAssetFitMode = "cover" | "contain";

export type OpenAIVisualImageSize = "1024x1024" | "1024x1536" | "1536x1024" | "auto";

export type VisualAssetSlotSizing = {
  aspectRatio: string;
  composition: string;
  fitMode: VisualAssetFitMode;
  height: number;
  objectPosition: string;
  openAIImageSize: OpenAIVisualImageSize;
  slot: VisualAssetSlot;
  width: number;
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

const defaultSlotSizing: VisualAssetSlotSizing = {
  aspectRatio: "1:1",
  composition: "Square ecommerce visual with centered subject, clean safe margins, and responsive crop tolerance.",
  fitMode: "cover",
  height: 1024,
  objectPosition: "center",
  openAIImageSize: "1024x1024",
  slot: "product.primary",
  width: 1024
};

export const visualAssetSlotSizingMap: Record<VisualAssetSlot, VisualAssetSlotSizing> = {
  "category.banner": {
    aspectRatio: "3:2",
    composition: "Wide category header/banner composition with real category products, horizontal layout, clear subject grouping, and crop-safe edges.",
    fitMode: "cover",
    height: 1024,
    objectPosition: "center",
    openAIImageSize: "1536x1024",
    slot: "category.banner",
    width: 1536
  },
  "category.icon": {
    aspectRatio: "1:1",
    composition: "Square category icon/card image with a real product subject, centered composition, and clean background.",
    fitMode: "cover",
    height: 1024,
    objectPosition: "center",
    openAIImageSize: "1024x1024",
    slot: "category.icon",
    width: 1024
  },
  "category.image": {
    aspectRatio: "4:3",
    composition: "Category card image with real products matching the category, balanced 4:3 crop, clean margins, and no symbolic placeholder art.",
    fitMode: "cover",
    height: 1024,
    objectPosition: "center",
    openAIImageSize: "1024x1024",
    slot: "category.image",
    width: 1024
  },
  "hero.ctaOverlay": {
    aspectRatio: "1:1",
    composition: "Square supporting CTA overlay visual with realistic ecommerce subject and clean safe margins.",
    fitMode: "cover",
    height: 1024,
    objectPosition: "center",
    openAIImageSize: "1024x1024",
    slot: "hero.ctaOverlay",
    width: 1024
  },
  "hero.desktop": {
    aspectRatio: "3:2",
    composition: "Wide horizontal ecommerce hero/banner composition with product or lifestyle scene, subject slightly off-center, generous negative space for runtime copy, and crop-safe edges.",
    fitMode: "cover",
    height: 1024,
    objectPosition: "center",
    openAIImageSize: "1536x1024",
    slot: "hero.desktop",
    width: 1536
  },
  "hero.mobile": {
    aspectRatio: "2:3",
    composition: "Vertical mobile hero composition with centered subject, clean top and bottom safe areas, and space for runtime copy overlays.",
    fitMode: "cover",
    height: 1536,
    objectPosition: "center",
    openAIImageSize: "1024x1536",
    slot: "hero.mobile",
    width: 1024
  },
  "marketing.announcement": {
    aspectRatio: "3:2",
    composition: "Wide homepage announcement/banner composition with realistic products, clean commercial background, and no rendered text.",
    fitMode: "cover",
    height: 1024,
    objectPosition: "center",
    openAIImageSize: "1536x1024",
    slot: "marketing.announcement",
    width: 1536
  },
  "marketing.collection": {
    aspectRatio: "3:2",
    composition: "Wide collection/homepage banner with real products arranged for a responsive storefront banner and crop-safe horizontal layout.",
    fitMode: "cover",
    height: 1024,
    objectPosition: "center",
    openAIImageSize: "1536x1024",
    slot: "marketing.collection",
    width: 1536
  },
  "marketing.flashSale": {
    aspectRatio: "3:2",
    composition: "Wide flash deals/discount banner with realistic sale products, energetic commercial composition, no fake text or discount labels.",
    fitMode: "cover",
    height: 1024,
    objectPosition: "center",
    openAIImageSize: "1536x1024",
    slot: "marketing.flashSale",
    width: 1536
  },
  "marketing.seasonalSale": {
    aspectRatio: "3:2",
    composition: "Wide seasonal promo/discount banner with realistic products, clean campaign styling, and no rendered promo text.",
    fitMode: "cover",
    height: 1024,
    objectPosition: "center",
    openAIImageSize: "1536x1024",
    slot: "marketing.seasonalSale",
    width: 1536
  },
  "product.comingSoon": {
    aspectRatio: "1:1",
    composition: "Square product placeholder-safe visual with centered realistic subject and clean background.",
    fitMode: "contain",
    height: 1024,
    objectPosition: "center",
    openAIImageSize: "1024x1024",
    slot: "product.comingSoon",
    width: 1024
  },
  "product.fallback": {
    aspectRatio: "1:1",
    composition: "Square fallback product visual with centered realistic product and clean background.",
    fitMode: "contain",
    height: 1024,
    objectPosition: "center",
    openAIImageSize: "1024x1024",
    slot: "product.fallback",
    width: 1024
  },
  "product.gallery": {
    aspectRatio: "1:1",
    composition: "Square product gallery image with realistic detail view, centered subject, clean margins, and consistent catalog lighting.",
    fitMode: "contain",
    height: 1024,
    objectPosition: "center",
    openAIImageSize: "1024x1024",
    slot: "product.gallery",
    width: 1024
  },
  "product.primary": {
    aspectRatio: "1:1",
    composition: "Square product primary photo with centered product, full product visible, clean background, and no cropping of important edges.",
    fitMode: "contain",
    height: 1024,
    objectPosition: "center",
    openAIImageSize: "1024x1024",
    slot: "product.primary",
    width: 1024
  }
};

export function visualAssetSlotSizing(slot: VisualAssetSlot): VisualAssetSlotSizing {
  return visualAssetSlotSizingMap[slot] ?? {
    ...defaultSlotSizing,
    slot
  };
}

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
  const fitMode = stringValue(value.fitMode) === "contain" ? "contain" : stringValue(value.fitMode) === "cover" ? "cover" : null;

  if (!url && !publicUrl && !promptKey && !assetId && !r2Key) {
    return null;
  }

  return {
    alt: stringValue(value.alt) || null,
    aspectRatio: stringValue(value.aspectRatio) || null,
    assetId,
    assetType: stringValue(value.assetType) || null,
    bucket: stringValue(value.bucket) || null,
    fitMode,
    generatedAt: stringValue(value.generatedAt) || null,
    height: numberValue(value.height),
    objectPosition: stringValue(value.objectPosition) || null,
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
  const sizing = visualAssetSlotSizing(slot);

  return {
    alt: reference?.alt || alt,
    aspectRatio: reference?.aspectRatio ?? sizing.aspectRatio,
    assetId: reference?.assetId ?? null,
    bucket: reference?.bucket ?? null,
    fitMode: reference?.fitMode === "contain" || reference?.fitMode === "cover" ? reference.fitMode : sizing.fitMode,
    height: reference?.height ?? sizing.height,
    objectPosition: reference?.objectPosition ?? sizing.objectPosition,
    promptKey: reference?.promptKey ?? null,
    source: normalizeVisualAssetSource(reference?.source, url),
    slot,
    state: url ? "ready" : reference?.promptKey || reference?.assetId ? "coming-soon" : "fallback",
    url,
    width: reference?.width ?? sizing.width
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

