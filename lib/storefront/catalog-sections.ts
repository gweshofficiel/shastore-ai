import type {
  PublicStorefrontCategory,
  PublicStorefrontProduct
} from "@/lib/public-storefront-preview";

const hiddenPublicCategoryNames = new Set(["add a catalog category"]);

function normalizedCategoryName(value: string | null | undefined) {
  return (value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

export function isPublicCategoryTitle(value: string | null | undefined) {
  const normalized = normalizedCategoryName(value);
  return Boolean(normalized) && !hiddenPublicCategoryNames.has(normalized);
}

export type PublicProductSection = {
  category: PublicStorefrontCategory;
  products: PublicStorefrontProduct[];
};

export function buildPublicProductSections({
  categories,
  products
}: {
  categories: PublicStorefrontCategory[];
  products: PublicStorefrontProduct[];
}): PublicProductSection[] {
  const categorizedProductIds = new Set<string>();
  const categorySections = categories
    .filter((category) => category.status === "active" && isPublicCategoryTitle(category.name))
    .map((category) => {
      const categoryProducts = products.filter((product) => {
        const matchesCategory =
          product.categoryId === category.id ||
          (!product.categoryId && product.categoryName === category.name);

        if (matchesCategory) {
          categorizedProductIds.add(product.id);
        }

        return matchesCategory;
      });

      return { category, products: categoryProducts };
    })
    .filter((section) => section.products.length > 0);
  const uncategorizedProducts = products.filter((product) => !categorizedProductIds.has(product.id));

  if (categorySections.length) {
    return [
      ...categorySections,
      ...(uncategorizedProducts.length
        ? [
            {
              category: {
                description: "Additional products from this store.",
                id: "uncategorized",
                imageUrl: null,
                name: "More products",
                slug: null,
                status: "active"
              },
              products: uncategorizedProducts
            }
          ]
        : [])
    ];
  }

  return products.length
    ? [
        {
          category: {
            description: "Products available from this store.",
            id: "featured",
            imageUrl: null,
            name: "Featured products",
            slug: null,
            status: "active"
          },
          products
        }
      ]
    : [];
}
