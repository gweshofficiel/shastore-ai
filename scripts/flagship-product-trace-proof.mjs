/**
 * Trace-proof report for flagship homepage product sections.
 * Run: node scripts/flagship-product-trace-proof.mjs
 */

const TARGET = "new-shastore-flagship-premium-store-7ac6fe38";

function isPublicProductStatus(status) {
  return status === "active" || status === "published";
}

function numericProductPrice(price) {
  const numericPrice = typeof price === "number" ? price : Number(price ?? NaN);
  return Number.isFinite(numericPrice) ? numericPrice : null;
}

function productSectionProducts(products, sectionType) {
  const publicProducts = products.filter((product) => isPublicProductStatus(product.status));

  if (sectionType === "new_arrivals") {
    return [...publicProducts]
      .sort((left, right) => new Date(right.createdAt ?? 0).getTime() - new Date(left.createdAt ?? 0).getTime())
      .slice(0, 8);
  }

  if (sectionType === "best_sellers") {
    return [...publicProducts].sort((left, right) => right.salesCount - left.salesCount).slice(0, 8);
  }

  if (sectionType === "flash_deals") {
    const discountedProducts = publicProducts.filter((product) => {
      const compareAt = numericProductPrice(product.compareAtPrice);
      const price = numericProductPrice(product.price);
      return compareAt !== null && price !== null && compareAt > price;
    });

    return (discountedProducts.length ? discountedProducts : publicProducts).slice(0, 8);
  }

  if (sectionType === "recommended_products") {
    return [...publicProducts]
      .sort((left, right) => right.salesCount * 2 - left.salesCount * 2)
      .slice(0, 8);
  }

  return publicProducts.slice(0, 6);
}

function resolveBeforeFix(discoveryProducts, sectionType) {
  const inputLength = productSectionProducts(discoveryProducts, sectionType).length;
  const outputLength = Math.min(inputLength, sectionType === "featured_products" ? 6 : 8);
  const liveCatalogLength = discoveryProducts.filter((product) => isPublicProductStatus(product.status)).length;
  const branch =
    outputLength > 0
      ? "real-cards"
      : liveCatalogLength > 0
        ? "no-matching-message"
        : sectionType === "flash_deals"
          ? "flash-deals-placeholder"
          : sectionType === "new_arrivals"
            ? "new-arrivals-placeholder"
            : "flagship-product-placeholder-grid";

  return { branch, inputLength, liveCatalogLength, outputLength };
}

function resolveAfterFix(homepageProducts, sectionType) {
  const catalogProducts = homepageProducts.filter((product) => isPublicProductStatus(product.status));
  let sectionProducts = productSectionProducts(homepageProducts, sectionType);

  if (!sectionProducts.length && catalogProducts.length) {
    sectionProducts = catalogProducts;
  }

  const outputLength = Math.min(
    sectionProducts.length,
    sectionType === "featured_products" ? 6 : 8
  );
  const branch = outputLength > 0 ? "real-cards" : "flagship-product-placeholder-grid";

  return { branch, inputLength: productSectionProducts(homepageProducts, sectionType).length, liveCatalogLength: catalogProducts.length, outputLength };
}

async function main() {
  const { createRequire } = await import("module");
  const require = createRequire(import.meta.url);
  const { createClient } = await import("@supabase/supabase-js");

  require("@next/env").loadEnvConfig(process.cwd());

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !service) {
    console.error("Missing Supabase env for proof script.");
    process.exit(1);
  }

  const admin = createClient(url, service, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const { data: publication } = await admin
    .from("published_stores")
    .select("store_id")
    .eq("slug", TARGET)
    .eq("status", "published")
    .maybeSingle();
  const { data: store } = await admin
    .from("stores")
    .select("id")
    .eq("slug", TARGET)
    .maybeSingle();
  const storeId = publication?.store_id ?? store?.id;

  if (!storeId) {
    console.error("Target store not found for proof script.");
    process.exit(1);
  }

  const { data: rows, error } = await admin
    .from("store_products")
    .select("id, title, name, status, compare_at_price, price, created_at")
    .eq("store_id", storeId)
    .eq("status", "active")
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("Failed to load store products for proof script:", error.message);
    process.exit(1);
  }

  const homepageProducts = (rows ?? []).map((product) => ({
    compareAtPrice: product.compare_at_price,
    createdAt: product.created_at,
    price: product.price,
    salesCount: product.sales_count ?? 0,
    status: product.status,
    title: product.title || product.name
  }));

  const discoveryProducts = [];

  const sectionTypes = [
    "featured_products",
    "best_sellers",
    "flash_deals",
    "recommended_products",
    "new_arrivals"
  ];

  console.log(`Target store: ${TARGET}`);
  console.log(`Homepage catalog products: ${homepageProducts.length}`);
  console.log(`Discovery-filtered products (simulated empty filters): ${discoveryProducts.length}`);
  console.log("");

  console.log("| Section | Before branch | Before output | After branch | After output |");
  console.log("|---|---|---:|---|---:|");

  for (const sectionType of sectionTypes) {
    const before = resolveBeforeFix(discoveryProducts, sectionType);
    const after = resolveAfterFix(homepageProducts, sectionType);

    console.log(
      `| ${sectionType} | ${before.branch} | ${before.outputLength} | ${after.branch} | ${after.outputLength} |`
    );
  }

  console.log("");
  console.log("Premium Product 1 source when placeholders render:");
  console.log("lib/storefront/sections.tsx:456 FlagshipProductPlaceholderCard");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
