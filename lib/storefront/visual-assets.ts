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

export function productGalleryAssetReferences(gallery: unknown[]) {
  return gallery.map(visualAssetReference).filter((asset): asset is VisualAssetReference => Boolean(asset));
}

export function resolveProductImageSlots({
  fallback,
  gallery,
  primary,
  title
}: {
  fallback?: unknown;
  gallery?: unknown[];
  primary?: unknown;
  title: string;
}): ProductImageSlots {
  const galleryAssets = productGalleryAssetReferences(gallery ?? []);
  const primaryAsset = resolveVisualAssetSlot({
    alt: title,
    candidates: [primary, ...galleryAssets],
    slot: "product.primary"
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
  icon,
  image,
  name
}: {
  banner?: unknown;
  icon?: unknown;
  image?: unknown;
  name: string;
}): CategoryImageSlots {
  return {
    banner: resolveVisualAssetSlot({ alt: `${name} banner`, candidates: [banner, image], slot: "category.banner" }),
    icon: resolveVisualAssetSlot({ alt: `${name} icon`, candidates: [icon], slot: "category.icon" }),
    image: resolveVisualAssetSlot({ alt: name, candidates: [image, banner], slot: "category.image" })
  };
}

export function resolveHeroBannerSlots({
  ctaOverlay,
  desktop,
  mobile,
  title
}: {
  ctaOverlay?: unknown;
  desktop?: unknown;
  mobile?: unknown;
  title: string;
}): HeroBannerSlots {
  const desktopAsset = resolveVisualAssetSlot({ alt: title, candidates: [desktop, mobile], slot: "hero.desktop" });

  return {
    ctaOverlay: resolveVisualAssetSlot({ alt: `${title} CTA overlay`, candidates: [ctaOverlay], slot: "hero.ctaOverlay" }),
    desktop: desktopAsset,
    mobile: resolveVisualAssetSlot({ alt: `${title} mobile`, candidates: [mobile, desktop], slot: "hero.mobile" })
  };
}

export function resolveMarketingBannerSlots(config: Record<string, unknown>): MarketingBannerSlots {
  return {
    announcement: resolveVisualAssetSlot({
      alt: "Announcement banner",
      candidates: [config.announcementBanner, config.announcementBannerUrl],
      slot: "marketing.announcement"
    }),
    collection: resolveVisualAssetSlot({
      alt: "Collection banner",
      candidates: [config.collectionBanner, config.collectionBannerUrl],
      slot: "marketing.collection"
    }),
    flashSale: resolveVisualAssetSlot({
      alt: "Flash sale banner",
      candidates: [config.flashSaleBanner, config.flashSaleBannerUrl],
      slot: "marketing.flashSale"
    }),
    seasonalSale: resolveVisualAssetSlot({
      alt: "Seasonal sale banner",
      candidates: [config.seasonalSaleBanner, config.seasonalSaleBannerUrl],
      slot: "marketing.seasonalSale"
    })
  };
}

