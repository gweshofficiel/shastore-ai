import { PageHeader } from "@/components/dashboard/page-header";
import { ProductImageUploadFields } from "@/components/dashboard/product-image-upload-fields";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  archiveStoreOwnerProduct,
  createStoreOwnerProductVariant,
  createStoreOwnerProduct,
  removeStoreOwnerProductImage,
  setStoreOwnerProductVisibility,
  uploadStoreOwnerProductImage,
  updateStoreOwnerProduct,
  updateStoreOwnerProductVariant
} from "@/lib/product-actions";
import { createClient } from "@/lib/supabase/server";
import { getUserPrimaryWorkspaceId, getUserWorkspaceRole, hasPermission } from "@/lib/permissions/rbac";
import { fetchStoresForAuthUser, type UserStoreRow } from "@/lib/stores/user-stores";
import { getActiveWorkspaceForUser } from "@/lib/workspaces/active-workspace";

export const dynamic = "force-dynamic";

const productListPath = "/dashboard/products";

type ProductRow = {
  category_id?: string | null;
  compare_at_price?: number | string | null;
  created_at: string;
  currency?: string | null;
  description?: string | null;
  gallery?: unknown;
  id: string;
  image_url?: string | null;
  inventory_status?: string | null;
  low_stock_threshold?: number | null;
  name?: string | null;
  price?: number | string | null;
  sku?: string | null;
  slug?: string | null;
  status?: string | null;
  stock_quantity?: number | null;
  store_id: string;
  title?: string | null;
  track_inventory?: boolean | null;
  updated_at?: string | null;
  workspace_id?: string | null;
};

type ProductImageRow = {
  id: string;
  image_role: "gallery" | "main";
  product_id: string;
  public_url: string;
  sort_order: number;
};

type ProductVariantRow = {
  id: string;
  name: string;
  option_color?: string | null;
  option_custom_name?: string | null;
  option_custom_value?: string | null;
  option_material?: string | null;
  option_size?: string | null;
  price_override?: number | string | null;
  product_id: string;
  sku?: string | null;
  status?: string | null;
  stock_quantity?: number | null;
};

type ProductWithImages = ProductRow & {
  images: ProductImageRow[];
  variants: ProductVariantRow[];
};

type CategoryRow = {
  id: string;
  name: string;
  slug?: string | null;
  status?: string | null;
};

type ProductsDashboardData = {
  activeStore: UserStoreRow | null;
  categories: CategoryRow[];
  error: string | null;
  products: ProductWithImages[];
  schemaIssue: string | null;
  stores: UserStoreRow[];
};

function isMissingProductsFoundation(error: { code?: string; message?: string } | null) {
  const message = (error?.message ?? "").toLowerCase();
  return (
    error?.code === "PGRST202" ||
    error?.code === "PGRST205" ||
    message.includes("store_products") ||
    message.includes("could not find")
  );
}

async function getProductsDashboardData(selectedStoreId?: string): Promise<ProductsDashboardData> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError) {
    return {
      activeStore: null,
      categories: [],
      error: "We could not verify your session. Please sign in again.",
      products: [],
      schemaIssue: null,
      stores: []
    };
  }

  if (!user) {
    return {
      activeStore: null,
      categories: [],
      error: "Sign in to manage products.",
      products: [],
      schemaIssue: null,
      stores: []
    };
  }

  const selection = await getActiveWorkspaceForUser({ supabase, userId: user.id });
  const workspaceId = selection.activeWorkspaceId;
  const { stores, error: storesError } = await fetchStoresForAuthUser(
    supabase,
    user.id,
    workspaceId
  );

  if (storesError) {
    return {
      activeStore: null,
      categories: [],
      error: "Stores could not be loaded. Please try again.",
      products: [],
      schemaIssue: null,
      stores: []
    };
  }

  const activeStore =
    stores.find((store) => store.id === selectedStoreId) ?? stores[0] ?? null;

  if (!activeStore) {
    return {
      activeStore: null,
      categories: [],
      error: null,
      products: [],
      schemaIssue: null,
      stores
    };
  }

  const { data: products, error: productsError } = await supabase
    .from("store_products" as never)
    .select(
      "id, workspace_id, store_id, category_id, title, name, slug, description, status, price, compare_at_price, currency, image_url, gallery, stock_quantity, track_inventory, low_stock_threshold, inventory_status, created_at, updated_at"
    )
    .eq("workspace_id" as never, workspaceId as never)
    .eq("store_id", activeStore.id)
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false });

  if (productsError) {
    return {
      activeStore,
      categories: [],
      error: isMissingProductsFoundation(productsError)
        ? null
        : "Products could not be loaded. Please try again.",
      products: [],
      schemaIssue: isMissingProductsFoundation(productsError)
        ? "Missing products foundation: run the workspace store product catalog migration."
        : null,
      stores
    };
  }

  const { data: categories } = await supabase
    .from("store_categories" as never)
    .select("id, name, slug, status")
    .eq("workspace_id" as never, workspaceId as never)
    .eq("store_id", activeStore.id)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  const productIds = ((products ?? []) as Array<{ id?: string }>).map((product) => product.id).filter(Boolean) as string[];
  const { data: productImages } = productIds.length
    ? await supabase
        .from("product_images" as never)
        .select("id, product_id, public_url, image_role, sort_order")
        .eq("workspace_id" as never, workspaceId as never)
        .eq("store_id", activeStore.id)
        .in("product_id" as never, productIds as never)
        .order("sort_order", { ascending: true })
    : { data: [] };
  const imagesByProduct = new Map<string, ProductImageRow[]>();

  for (const image of (productImages ?? []) as unknown as ProductImageRow[]) {
    const existing = imagesByProduct.get(image.product_id) ?? [];
    existing.push(image);
    imagesByProduct.set(image.product_id, existing);
  }
  const { data: productVariants } = productIds.length
    ? await supabase
        .from("product_variants" as never)
        .select("id, product_id, name, option_size, option_color, option_material, option_custom_name, option_custom_value, sku, price_override, stock_quantity, status")
        .eq("workspace_id" as never, workspaceId as never)
        .eq("store_id", activeStore.id)
        .in("product_id" as never, productIds as never)
        .order("created_at", { ascending: true })
    : { data: [] };
  const variantsByProduct = new Map<string, ProductVariantRow[]>();

  for (const variant of (productVariants ?? []) as unknown as ProductVariantRow[]) {
    const existing = variantsByProduct.get(variant.product_id) ?? [];
    existing.push(variant);
    variantsByProduct.set(variant.product_id, existing);
  }

  return {
    activeStore,
    categories: (categories ?? []) as unknown as CategoryRow[],
    error: null,
    products: ((products ?? []) as unknown as ProductRow[]).map((product) => ({
      ...product,
      images: imagesByProduct.get(product.id) ?? [],
      variants: variantsByProduct.get(product.id) ?? []
    })),
    schemaIssue: null,
    stores
  };
}

function productTitle(product: ProductRow) {
  return product.title?.trim() || product.name?.trim() || "Untitled product";
}

function productStatus(product: ProductRow) {
  return product.status === "active" || product.status === "archived" ? product.status : "draft";
}

function moneyValue(value: ProductRow["price"]) {
  if (typeof value === "number") {
    return value.toFixed(2);
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed.toFixed(2) : "0.00";
  }

  return "0.00";
}

function optionalMoneyValue(value: ProductRow["compare_at_price"]) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  return moneyValue(value);
}

function formatCurrency(value: ProductRow["price"]) {
  return new Intl.NumberFormat("en", {
    currency: "USD",
    style: "currency"
  }).format(Number(moneyValue(value)));
}

function galleryUrls(product: ProductRow) {
  if (!Array.isArray(product.gallery)) {
    return [];
  }

  return product.gallery
    .map((item) => {
      if (typeof item === "string") {
        return item;
      }

      if (item && typeof item === "object") {
        const record = item as Record<string, unknown>;
        return typeof record.url === "string"
          ? record.url
          : typeof record.publicUrl === "string"
            ? record.publicUrl
            : null;
      }

      return null;
    })
    .filter((url): url is string => Boolean(url));
}

function statusBadgeClass(status: string | null | undefined) {
  if (status === "active") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (status === "archived") {
    return "bg-slate-100 text-slate-600";
  }

  return "bg-amber-100 text-amber-700";
}

function inventoryLabel(product: ProductRow) {
  if (!product.track_inventory) {
    return "Not tracked";
  }

  return `${product.stock_quantity ?? 0} in stock`;
}

function inventoryBadgeClass(product: ProductRow) {
  if (!product.track_inventory) {
    return "bg-slate-100 text-slate-600";
  }

  if ((product.stock_quantity ?? 0) <= 0 || product.inventory_status === "out_of_stock") {
    return "bg-rose-100 text-rose-700";
  }

  if (
    product.low_stock_threshold != null &&
    (product.stock_quantity ?? 0) <= product.low_stock_threshold
  ) {
    return "bg-amber-100 text-amber-700";
  }

  return "bg-emerald-100 text-emerald-700";
}

function statusMessage(status: string | undefined) {
  if (status?.startsWith("billing-blocked:")) {
    return status.replace("billing-blocked:", "");
  }

  const messages: Record<string, string> = {
    "create-failed": "Product could not be created. Check the fields and try again.",
    archived: "Product archived.",
    "archive-failed": "Product could not be archived. Please try again.",
    "category-not-found": "Selected category was not found for this store.",
    created: "Product created.",
    deleted: "Product archived.",
    "delete-failed": "Product could not be archived. Please try again.",
    "image-failed": "Product image could not be uploaded. Please try again.",
    "image-remove-failed": "Product image could not be removed. Please try again.",
    "image-removed": "Product image removed.",
    "image-save-failed": "Image uploaded, but product image data could not be saved. Please try again.",
    "image-too-large": "Product image is too large. Use an image up to 5MB.",
    "image-uploaded": "Product image uploaded.",
    "invalid-image": "Only JPG, JPEG, PNG, and WebP image files are allowed.",
    "missing-image": "Choose an image before uploading.",
    "missing-store": "Choose a claimed store before managing products.",
    "missing-title": "Product title is required.",
    "not-authorized": "You do not have permission to manage that store.",
    published: "Product published and visible on the public storefront.",
    unpublished: "Product moved back to draft and hidden from the public storefront.",
    "update-failed": "Product could not be updated. Check the fields and try again.",
    "variant-created": "Variant created.",
    "variant-failed": "Variant could not be saved. Check the fields and try again.",
    "variant-updated": "Variant updated.",
    "visibility-failed": "Product visibility could not be updated. Please try again.",
    updated: "Product updated."
  };

  return status ? messages[status] : null;
}

function FieldLabel({
  children,
  label
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <label className="grid min-w-0 gap-2 text-sm font-semibold text-ink">
      <span>{label}</span>
      {children}
    </label>
  );
}

function SelectField({
  defaultValue,
  name
}: {
  defaultValue?: string;
  name: string;
}) {
  return (
    <FieldLabel label="Status">
      <select
        className="h-12 min-w-0 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink shadow-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
        defaultValue={defaultValue ?? "draft"}
        name={name}
      >
        <option value="draft">Draft</option>
        <option value="active">Active</option>
        <option value="archived">Archived</option>
      </select>
    </FieldLabel>
  );
}

function ProductFields({
  categories,
  product
}: {
  categories: CategoryRow[];
  product?: ProductRow;
}) {
  return (
    <>
      <Input
        defaultValue={product ? productTitle(product) : ""}
        id={product ? `title-${product.id}` : "title-new"}
        label="Title"
        maxLength={180}
        name="title"
        placeholder="Premium starter product"
        required
      />
      <Textarea
        defaultValue={product?.description ?? ""}
        id={product ? `description-${product.id}` : "description-new"}
        label="Description"
        maxLength={1000}
        name="description"
        placeholder="A concise product description for the store owner dashboard."
        rows={4}
      />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Input
          defaultValue={moneyValue(product?.price)}
          id={product ? `price-${product.id}` : "price-new"}
          label="Price"
          min="0"
          name="price"
          step="0.01"
          type="number"
        />
        <Input
          defaultValue={optionalMoneyValue(product?.compare_at_price)}
          id={product ? `compare-at-price-${product.id}` : "compare-at-price-new"}
          label="Compare at price"
          min="0"
          name="compareAtPrice"
          step="0.01"
          type="number"
        />
        <Input
          defaultValue={product?.currency ?? "USD"}
          id={product ? `currency-${product.id}` : "currency-new"}
          label="Currency"
          maxLength={3}
          name="currency"
          placeholder="USD"
        />
      </div>
      <FieldLabel label="Category">
        <select
          className="h-12 min-w-0 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink shadow-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
          defaultValue={product?.category_id ?? ""}
          name="categoryId"
        >
          <option value="">No category</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
              {category.status === "inactive" ? " (inactive)" : ""}
            </option>
          ))}
        </select>
      </FieldLabel>
      <SelectField defaultValue={productStatus(product ?? ({} as ProductRow))} name="status" />
      <div className="grid gap-4 rounded-3xl border border-slate-100 bg-slate-50 p-4">
        <label className="flex items-start gap-3 text-sm font-semibold text-ink">
          <input
            className="mt-1 h-4 w-4 rounded border-slate-300"
            defaultChecked={Boolean(product?.track_inventory)}
            name="trackInventory"
            type="checkbox"
          />
          <span>
            Track inventory
            <span className="mt-1 block text-xs font-medium leading-5 text-muted">
              When enabled, checkout is blocked if the requested quantity exceeds available stock.
            </span>
          </span>
        </label>
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            defaultValue={String(product?.stock_quantity ?? 0)}
            id={product ? `stock-quantity-${product.id}` : "stock-quantity-new"}
            label="Stock quantity"
            min="0"
            name="stockQuantity"
            step="1"
            type="number"
          />
          <Input
            defaultValue={product?.low_stock_threshold == null ? "" : String(product.low_stock_threshold)}
            id={product ? `low-stock-threshold-${product.id}` : "low-stock-threshold-new"}
            label="Low stock threshold"
            min="0"
            name="lowStockThreshold"
            placeholder="Optional"
            step="1"
            type="number"
          />
        </div>
      </div>
    </>
  );
}

function VariantFields({ productId, variant }: { productId: string; variant?: ProductVariantRow }) {
  return (
    <>
      <input name="productId" type="hidden" value={productId} />
      {variant ? <input name="variantId" type="hidden" value={variant.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          defaultValue={variant?.name ?? ""}
          id={variant ? `variant-${variant.id}-name` : `variant-${productId}-name`}
          label="Variant name"
          maxLength={140}
          name="variantName"
          placeholder="Red / Large"
          required
        />
        <Input
          defaultValue={variant?.sku ?? ""}
          id={variant ? `variant-${variant.id}-sku` : `variant-${productId}-sku`}
          label="SKU"
          maxLength={80}
          name="variantSku"
          placeholder="SKU-RED-L"
        />
        <Input
          defaultValue={variant?.price_override == null ? "" : moneyValue(variant.price_override)}
          id={variant ? `variant-${variant.id}-price` : `variant-${productId}-price`}
          label="Price override"
          min="0"
          name="variantPrice"
          step="0.01"
          type="number"
        />
        <Input
          defaultValue={String(variant?.stock_quantity ?? 0)}
          id={variant ? `variant-${variant.id}-stock` : `variant-${productId}-stock`}
          label="Variant stock"
          min="0"
          name="variantStockQuantity"
          step="1"
          type="number"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Input
          defaultValue={variant?.option_size ?? ""}
          id={variant ? `variant-${variant.id}-size` : `variant-${productId}-size`}
          label="Size"
          maxLength={80}
          name="variantSize"
          placeholder="S, M, L"
        />
        <Input
          defaultValue={variant?.option_color ?? ""}
          id={variant ? `variant-${variant.id}-color` : `variant-${productId}-color`}
          label="Color"
          maxLength={80}
          name="variantColor"
          placeholder="Black"
        />
        <Input
          defaultValue={variant?.option_material ?? ""}
          id={variant ? `variant-${variant.id}-material` : `variant-${productId}-material`}
          label="Material"
          maxLength={120}
          name="variantMaterial"
          placeholder="Cotton"
        />
        <Input
          defaultValue={variant?.option_custom_name ?? ""}
          id={variant ? `variant-${variant.id}-custom-name` : `variant-${productId}-custom-name`}
          label="Custom option"
          maxLength={80}
          name="variantCustomName"
          placeholder="Style"
        />
        <Input
          defaultValue={variant?.option_custom_value ?? ""}
          id={variant ? `variant-${variant.id}-custom-value` : `variant-${productId}-custom-value`}
          label="Custom value"
          maxLength={120}
          name="variantCustomValue"
          placeholder="Premium"
        />
      </div>
      <label className="grid gap-2 text-sm font-semibold text-ink">
        <span>Variant status</span>
        <select
          className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink shadow-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
          defaultValue={variant?.status === "inactive" ? "inactive" : "active"}
          name="variantStatus"
        >
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </label>
    </>
  );
}

export default async function SellerProductsPage({
  searchParams
}: {
  searchParams: Promise<{ edit?: string; products?: string; storeId?: string }>;
}) {
  const query = await searchParams;
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (user) {
    const workspaceId = await getUserPrimaryWorkspaceId(supabase, user.id);
    const role = await getUserWorkspaceRole(supabase, workspaceId, user.id);

    if (!hasPermission(role, "manage_products")) {
      console.warn("[permission-denied] products page denied", {
        permission: "manage_products",
        role,
        userId: user.id,
        workspaceId
      });

      return (
        <div className="grid gap-6 lg:gap-8">
          <PageHeader
            description="Product access is assigned by workspace role."
            title="Products"
          />
          <Card className="border-amber-200 bg-amber-50 p-5">
            <p className="text-sm font-bold text-amber-800">
              You do not have permission to manage products.
            </p>
          </Card>
        </div>
      );
    }
  }

  const { activeStore, categories, error, products, schemaIssue, stores } = await getProductsDashboardData(
    query.storeId
  );
  const message = statusMessage(query.products);

  return (
    <div className="grid gap-6 lg:gap-8">
      <PageHeader
        action={
          activeStore ? (
            <div className="flex flex-wrap gap-2">
              <ButtonLink href={`/dashboard/categories?storeId=${activeStore.id}`} variant="secondary">
                Categories
              </ButtonLink>
              <ButtonLink href={`/dashboard/stores/${activeStore.id}`} variant="secondary">
                Store settings
              </ButtonLink>
            </div>
          ) : null
        }
        description="Create and maintain workspace-isolated ecommerce product records for stores."
        title="Products"
      />

      {message ? (
        <div className="rounded-3xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm font-bold text-blue-800">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700">
          {error}
        </div>
      ) : null}

      {schemaIssue ? (
        <Card className="border-amber-200 bg-amber-50 p-6">
          <p className="text-sm font-bold text-amber-900">{schemaIssue}</p>
        </Card>
      ) : null}

      {!schemaIssue && stores.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
            Products Foundation
          </p>
          <h2 className="mt-3 text-2xl font-black tracking-[-0.03em] text-ink">
            No stores in this workspace yet
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-muted">
            Create a store before adding products. Product records are isolated by
            workspace and store.
          </p>
        </Card>
      ) : null}

      {activeStore ? (
        <>
          <Card className="grid gap-4 p-5 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                Active Store
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">
                {activeStore.store_name || activeStore.name || "Workspace store"}
              </h2>
              <p className="mt-1 text-sm text-muted">
                Products are scoped to this workspace store only.
              </p>
            </div>
            <form className="flex flex-col gap-3 sm:min-w-[260px]" method="get">
              <label className="grid gap-2 text-sm font-semibold text-ink">
                <span>Switch store</span>
                <select
                  className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink shadow-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                  defaultValue={activeStore.id}
                  name="storeId"
                >
                  {stores.map((store) => (
                    <option key={store.id} value={store.id}>
                      {store.store_name || store.name || store.slug || store.id}
                    </option>
                  ))}
                </select>
              </label>
              <Button type="submit" variant="secondary">
                View products
              </Button>
            </form>
          </Card>

          <Card className="grid gap-5 p-6">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                Create Product
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">
                Add a minimal product
              </h2>
            </div>
            <form action={createStoreOwnerProduct} className="grid gap-4">
              <input name="storeId" type="hidden" value={activeStore.id} />
              <ProductFields categories={categories} />
              <div className="flex justify-end">
                <Button type="submit">Create product</Button>
              </div>
            </form>
          </Card>

          <section className="grid gap-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                  Product List
                </p>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">
                  {products.length} {products.length === 1 ? "product" : "products"}
                </h2>
              </div>
            </div>

            {products.length === 0 ? (
              <Card className="p-8 text-center">
                <h3 className="text-xl font-black tracking-[-0.03em] text-ink">
                  No products yet
                </h3>
                <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted">
                Add your first product with a title, price, stock, and active/draft status.
                </p>
              </Card>
            ) : null}

            {products.map((product) => {
              const isEditing = query.edit === product.id;
              const mainImage = product.images.find((image) => image.image_role === "main");
              const galleryImages = product.images.filter((image) => image.image_role === "gallery");
              const syncedGalleryUrls = galleryUrls(product);

              return (
                <Card key={product.id} className="grid gap-5 p-5">
                  {isEditing ? (
                    <form action={updateStoreOwnerProduct} className="grid gap-4">
                      <input name="storeId" type="hidden" value={activeStore.id} />
                      <input name="productId" type="hidden" value={product.id} />
                      <ProductFields categories={categories} product={product} />
                      <div className="flex flex-wrap justify-end gap-3">
                        <ButtonLink
                          href={`${productListPath}?storeId=${activeStore.id}`}
                          variant="ghost"
                        >
                          Cancel
                        </ButtonLink>
                        <Button type="submit">Save product</Button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                        <div className="grid min-w-0 gap-4 md:grid-cols-[180px_minmax(0,1fr)]">
                          <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-50">
                            {product.image_url ? (
                              <img
                                alt={productTitle(product)}
                                className="aspect-square w-full object-cover"
                                src={product.image_url}
                              />
                            ) : (
                              <div className="flex aspect-square items-center justify-center p-6 text-center text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                                No image
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-3">
                            <h3 className="text-xl font-black tracking-[-0.03em] text-ink">
                              {productTitle(product)}
                            </h3>
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.16em] ${statusBadgeClass(product.status)}`}
                            >
                              {productStatus(product)}
                            </span>
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.16em] ${inventoryBadgeClass(product)}`}
                            >
                              {inventoryLabel(product)}
                            </span>
                            {product.category_id ? (
                              <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-blue-700">
                                {categories.find((category) => category.id === product.category_id)?.name ?? "Category"}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
                            {product.description || "No description yet."}
                          </p>
                          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                            <div className="rounded-2xl bg-slate-50 p-4">
                              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                                Price
                              </p>
                              <p className="mt-1 font-black text-ink">
                                {formatCurrency(product.price)}
                              </p>
                            </div>
                            <div className="rounded-2xl bg-slate-50 p-4">
                              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                                Compare
                              </p>
                              <p className="mt-1 font-black text-ink">
                                {product.compare_at_price
                                  ? formatCurrency(product.compare_at_price)
                                  : "Not set"}
                              </p>
                            </div>
                            <div className="rounded-2xl bg-slate-50 p-4">
                              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                                Currency
                              </p>
                              <p className="mt-1 font-black text-ink">
                                {product.currency || "USD"}
                              </p>
                            </div>
                            <div className="rounded-2xl bg-slate-50 p-4">
                              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                                Inventory
                              </p>
                              <p className="mt-1 font-black text-ink">
                                {inventoryLabel(product)}
                              </p>
                            </div>
                          </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-3 lg:justify-end">
                          {productStatus(product) === "active" ? (
                            <form action={setStoreOwnerProductVisibility}>
                              <input name="storeId" type="hidden" value={activeStore.id} />
                              <input name="productId" type="hidden" value={product.id} />
                              <input name="visibilityStatus" type="hidden" value="draft" />
                              <Button type="submit" variant="secondary">
                                Unpublish
                              </Button>
                            </form>
                          ) : productStatus(product) === "draft" ? (
                            <form action={setStoreOwnerProductVisibility}>
                              <input name="storeId" type="hidden" value={activeStore.id} />
                              <input name="productId" type="hidden" value={product.id} />
                              <input name="visibilityStatus" type="hidden" value="active" />
                              <Button type="submit">Publish</Button>
                            </form>
                          ) : null}
                          <ButtonLink
                            href={`${productListPath}?storeId=${activeStore.id}&edit=${product.id}`}
                            variant="secondary"
                          >
                            Edit
                          </ButtonLink>
                        </div>
                      </div>

                      <div className="grid gap-4 rounded-3xl border border-slate-100 bg-slate-50 p-4">
                        <div>
                          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                            Product variants
                          </p>
                          <p className="mt-1 text-sm leading-6 text-muted">
                            Add size, color, material, or custom options with variant-specific SKU, price, and stock.
                          </p>
                        </div>
                        {product.variants.length ? (
                          <div className="grid gap-3">
                            {product.variants.map((variant) => (
                              <form
                                action={updateStoreOwnerProductVariant}
                                className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4"
                                key={variant.id}
                              >
                                <input name="storeId" type="hidden" value={activeStore.id} />
                                <VariantFields productId={product.id} variant={variant} />
                                <div className="flex justify-end">
                                  <Button type="submit" variant="secondary">
                                    Save variant
                                  </Button>
                                </div>
                              </form>
                            ))}
                          </div>
                        ) : (
                          <p className="rounded-2xl bg-white p-4 text-sm font-semibold text-muted">
                            No variants yet. Product-level price and inventory will continue to be used.
                          </p>
                        )}
                        <form
                          action={createStoreOwnerProductVariant}
                          className="grid gap-3 rounded-2xl border border-dashed border-slate-300 bg-white p-4"
                        >
                          <input name="storeId" type="hidden" value={activeStore.id} />
                          <VariantFields productId={product.id} />
                          <div className="flex justify-end">
                            <Button type="submit">Add variant</Button>
                          </div>
                        </form>
                      </div>

                      <div className="grid gap-4 rounded-3xl border border-slate-100 bg-slate-50 p-4 lg:grid-cols-2">
                        <div className="grid gap-3">
                          <form action={uploadStoreOwnerProductImage} className="grid gap-3">
                            <input name="storeId" type="hidden" value={activeStore.id} />
                            <input name="productId" type="hidden" value={product.id} />
                            <input name="imageRole" type="hidden" value="main" />
                            <label className="grid gap-2 text-sm font-semibold text-ink">
                              <span>Main product image</span>
                              <ProductImageUploadFields inputId={`main-image-${product.id}`} />
                            </label>
                            <Button type="submit">Upload / replace main image</Button>
                          </form>
                          {mainImage ? (
                            <form action={removeStoreOwnerProductImage}>
                              <input name="storeId" type="hidden" value={activeStore.id} />
                              <input name="productId" type="hidden" value={product.id} />
                              <input name="imageId" type="hidden" value={mainImage.id} />
                              <Button type="submit" variant="ghost">
                                Remove main image
                              </Button>
                            </form>
                          ) : null}
                        </div>

                        <form action={uploadStoreOwnerProductImage} className="grid gap-3">
                          <input name="storeId" type="hidden" value={activeStore.id} />
                          <input name="productId" type="hidden" value={product.id} />
                          <input name="imageRole" type="hidden" value="gallery" />
                          <label className="grid gap-2 text-sm font-semibold text-ink">
                            <span>Gallery image</span>
                            <ProductImageUploadFields inputId={`gallery-image-${product.id}`} />
                          </label>
                          <div>
                            <Button type="submit" variant="secondary">
                              Add gallery image
                            </Button>
                          </div>
                        </form>
                      </div>

                      {galleryImages.length || syncedGalleryUrls.length ? (
                        <div className="grid gap-3">
                          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                            Product gallery
                          </p>
                          <div className="flex flex-wrap gap-3">
                            {galleryImages.map((image) => (
                              <div key={image.id} className="grid gap-2">
                                <img
                                  alt={`${productTitle(product)} gallery image`}
                                  className="h-24 w-24 rounded-2xl border border-slate-200 object-cover"
                                  src={image.public_url}
                                />
                                <form action={removeStoreOwnerProductImage}>
                                  <input name="storeId" type="hidden" value={activeStore.id} />
                                  <input name="productId" type="hidden" value={product.id} />
                                  <input name="imageId" type="hidden" value={image.id} />
                                  <Button type="submit" variant="ghost">
                                    Remove
                                  </Button>
                                </form>
                              </div>
                            ))}
                            {!galleryImages.length
                              ? syncedGalleryUrls.map((url) => (
                                  <img
                                    key={url}
                                    alt={`${productTitle(product)} gallery image`}
                                    className="h-24 w-24 rounded-2xl border border-slate-200 object-cover"
                                    src={url}
                                  />
                                ))
                              : null}
                          </div>
                        </div>
                      ) : null}

                      <details className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
                        <summary className="cursor-pointer text-sm font-black text-amber-700">
                          Archive product
                        </summary>
                        <form action={archiveStoreOwnerProduct} className="mt-4 grid gap-3">
                          <input name="storeId" type="hidden" value={activeStore.id} />
                          <input name="productId" type="hidden" value={product.id} />
                          <p className="text-sm leading-6 text-amber-700">
                            This hides the product from public storefronts without deleting
                            dashboard history or store settings.
                          </p>
                          <div>
                            <Button className="bg-amber-600 hover:bg-amber-700" type="submit">
                              Confirm archive
                            </Button>
                          </div>
                        </form>
                      </details>
                    </>
                  )}
                </Card>
              );
            })}
          </section>
        </>
      ) : null}
    </div>
  );
}
