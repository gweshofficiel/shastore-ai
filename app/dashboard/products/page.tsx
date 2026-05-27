import { PageHeader } from "@/components/dashboard/page-header";
import { ProductImageUploadFields } from "@/components/dashboard/product-image-upload-fields";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  archiveStoreOwnerProduct,
  createStoreOwnerProduct,
  removeStoreOwnerProductImage,
  setStoreOwnerProductVisibility,
  uploadStoreOwnerProductImage,
  updateStoreOwnerProduct
} from "@/lib/product-actions";
import { createClient } from "@/lib/supabase/server";
import { getUserPrimaryWorkspaceId, getUserWorkspaceRole, hasPermission } from "@/lib/permissions/rbac";
import { fetchStoresForAuthUser, type UserStoreRow } from "@/lib/stores/user-stores";
import { getActiveWorkspaceForUser } from "@/lib/workspaces/active-workspace";

export const dynamic = "force-dynamic";

const productListPath = "/dashboard/products";

type ProductRow = {
  compare_at_price?: number | string | null;
  created_at: string;
  currency?: string | null;
  description?: string | null;
  gallery?: unknown;
  id: string;
  image_url?: string | null;
  name?: string | null;
  price?: number | string | null;
  sku?: string | null;
  slug?: string | null;
  status?: string | null;
  store_id: string;
  title?: string | null;
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

type ProductWithImages = ProductRow & {
  images: ProductImageRow[];
};

type ProductsDashboardData = {
  activeStore: UserStoreRow | null;
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
      error: "We could not verify your session. Please sign in again.",
      products: [],
      schemaIssue: null,
      stores: []
    };
  }

  if (!user) {
    return {
      activeStore: null,
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
      error: null,
      products: [],
      schemaIssue: null,
      stores
    };
  }

  const { data: products, error: productsError } = await supabase
    .from("store_products" as never)
    .select(
      "id, workspace_id, store_id, title, name, slug, description, status, price, compare_at_price, currency, image_url, gallery, created_at, updated_at"
    )
    .eq("workspace_id" as never, workspaceId as never)
    .eq("store_id", activeStore.id)
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false });

  if (productsError) {
    return {
      activeStore,
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

  return {
    activeStore,
    error: null,
    products: ((products ?? []) as unknown as ProductRow[]).map((product) => ({
      ...product,
      images: imagesByProduct.get(product.id) ?? []
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

function statusMessage(status: string | undefined) {
  const messages: Record<string, string> = {
    "create-failed": "Product could not be created. Check the fields and try again.",
    archived: "Product archived.",
    "archive-failed": "Product could not be archived. Please try again.",
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

function ProductFields({ product }: { product?: ProductRow }) {
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
      <SelectField defaultValue={productStatus(product ?? ({} as ProductRow))} name="status" />
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

  const { activeStore, error, products, schemaIssue, stores } = await getProductsDashboardData(
    query.storeId
  );
  const message = statusMessage(query.products);

  return (
    <div className="grid gap-6 lg:gap-8">
      <PageHeader
        action={
          activeStore ? (
            <ButtonLink href={`/dashboard/stores/${activeStore.id}`} variant="secondary">
              Store settings
            </ButtonLink>
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
              <ProductFields />
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
                  Add your first product with a title, price, image, and active/draft status.
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
                      <ProductFields product={product} />
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
                                Image
                              </p>
                              <p className="mt-1 font-black text-ink">
                                {product.image_url ? "Connected" : "Not set"}
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
