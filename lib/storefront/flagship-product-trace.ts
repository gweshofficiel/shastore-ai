const FLAGSHIP_TRACE_TARGET_SLUG = "new-shastore-flagship-premium-store-7ac6fe38";

export type FlagshipProductGridTrace = {
  branch:
    | "real-cards"
    | "no-matching-message"
    | "flash-deals-placeholder"
    | "new-arrivals-placeholder"
    | "flagship-product-placeholder-grid"
    | "premium-skeleton-grid";
  inputProductsLength: number;
  liveCatalogProductsLength: number;
  outputProductsLength: number;
  placeholderSource: string | null;
  productSectionsLength: number;
  sectionType: string;
};

export function shouldTraceFlagshipProducts(storeSlug?: string | null) {
  if (process.env.NODE_ENV !== "development") {
    return false;
  }

  if (process.env.FLAGSHIP_PRODUCT_TRACE === "1") {
    return true;
  }

  return (storeSlug ?? "").trim().toLowerCase() === FLAGSHIP_TRACE_TARGET_SLUG;
}

export function traceFlagshipProducts(event: string, payload: Record<string, unknown>) {
  const storeSlug = typeof payload.storeSlug === "string" ? payload.storeSlug : null;

  if (!shouldTraceFlagshipProducts(storeSlug)) {
    return;
  }

  console.info(`[flagship-product-trace] ${event}`, payload);
}

export function summarizeFlagshipPageProducts(
  storeSlug: string,
  previewProducts: Array<{ status: string | null; title: string }>,
  loaderProducts: Array<{ status: string | null; title: string }>
) {
  traceFlagshipProducts("page.before-dynamic-section-loader", {
    discoveryProductsLength: loaderProducts.length,
    firstTitles: loaderProducts.slice(0, 5).map((product) => product.title),
    previewProductsLength: previewProducts.length,
    previewStatuses: [...new Set(previewProducts.map((product) => product.status))],
    storeSlug
  });
}

export function summarizeFlagshipProductGrid(trace: FlagshipProductGridTrace & { storeSlug: string }) {
  traceFlagshipProducts("product-grid-section", trace);
}
