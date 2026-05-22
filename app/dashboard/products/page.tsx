import { PageHeader } from "@/components/dashboard/page-header";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  createStoreOwnerProduct,
  deleteStoreOwnerProduct,
  updateStoreOwnerProduct
} from "@/lib/product-actions";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const productListPath = "/dashboard/products";

type OwnedStore = {
  access_role?: string | null;
  id: string;
  internal_slug?: string | null;
  store_name?: string | null;
};

type ProductRow = {
  compare_at_price?: number | string | null;
  created_at: string;
  id: string;
  inventory_quantity?: number | null;
  name?: string | null;
  price?: number | string | null;
  short_description?: string | null;
  sku?: string | null;
  status?: string | null;
  store_instance_id: string;
  title?: string | null;
  updated_at?: string | null;
};

type ProductsDashboardData = {
  activeStore: OwnedStore | null;
  error: string | null;
  products: ProductRow[];
  schemaIssue: string | null;
  stores: OwnedStore[];
};

function isMissingProductsFoundation(error: { code?: string; message?: string } | null) {
  const message = (error?.message ?? "").toLowerCase();
  return (
    error?.code === "PGRST202" ||
    error?.code === "PGRST205" ||
    message.includes("store_instance_products") ||
    message.includes("get_claimed_store_instances_for_current_user") ||
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

  const { data: claimedStores, error: claimedError } = await supabase.rpc(
    "get_claimed_store_instances_for_current_user" as never
  );

  if (claimedError) {
    return {
      activeStore: null,
      error: isMissingProductsFoundation(claimedError)
        ? null
        : "Owned stores could not be loaded. Please try again.",
      products: [],
      schemaIssue: isMissingProductsFoundation(claimedError)
        ? "Missing ownership foundation: run the buyer activation and account claim migrations first."
        : null,
      stores: []
    };
  }

  const stores = ((claimedStores ?? []) as OwnedStore[]).filter(
    (store) => !store.access_role || store.access_role === "owner" || store.access_role === "admin"
  );
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
    .from("store_instance_products" as never)
    .select(
      "id, store_instance_id, title, name, short_description, status, price, compare_at_price, sku, inventory_quantity, created_at, updated_at"
    )
    .eq("store_instance_id", activeStore.id)
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
        ? "Missing products foundation: run the store owner products migration."
        : null,
      stores
    };
  }

  return {
    activeStore,
    error: null,
    products: (products ?? []) as unknown as ProductRow[],
    schemaIssue: null,
    stores
  };
}

function productTitle(product: ProductRow) {
  return product.title?.trim() || product.name?.trim() || "Untitled product";
}

function productStatus(product: ProductRow) {
  return product.status === "published" ? "published" : "draft";
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

function statusBadgeClass(status: string | null | undefined) {
  return status === "published"
    ? "bg-emerald-100 text-emerald-700"
    : "bg-amber-100 text-amber-700";
}

function statusMessage(status: string | undefined) {
  const messages: Record<string, string> = {
    "create-failed": "Product could not be created. Check the fields and try again.",
    created: "Product created.",
    deleted: "Product deleted.",
    "delete-failed": "Product could not be deleted. Please try again.",
    "missing-store": "Choose a claimed store before managing products.",
    "missing-title": "Product title is required.",
    "not-authorized": "You do not have permission to manage that store.",
    "update-failed": "Product could not be updated. Check the fields and try again.",
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
        <option value="published">Published</option>
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
        defaultValue={product?.short_description ?? ""}
        id={product ? `short-description-${product.id}` : "short-description-new"}
        label="Short description"
        maxLength={500}
        name="shortDescription"
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
          defaultValue={product?.sku ?? ""}
          id={product ? `sku-${product.id}` : "sku-new"}
          label="SKU"
          maxLength={80}
          name="sku"
          placeholder="SKU-001"
        />
        <Input
          defaultValue={String(product?.inventory_quantity ?? 0)}
          id={product ? `inventory-${product.id}` : "inventory-new"}
          label="Inventory"
          min="0"
          name="inventoryQuantity"
          step="1"
          type="number"
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
        description="Create and maintain the first stable ecommerce product records for claimed stores."
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
            No claimed stores yet
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-muted">
            Claim a store before creating products. Product records are isolated by
            store instance and require claimed owner access.
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
                {activeStore.store_name || "Claimed store"}
              </h2>
              <p className="mt-1 text-sm text-muted">
                Products are scoped to this store instance only.
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
                      {store.store_name || store.internal_slug || store.id}
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
                  Create the first draft product with a title, price, SKU, inventory, and
                  short description.
                </p>
              </Card>
            ) : null}

            {products.map((product) => {
              const isEditing = query.edit === product.id;

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
                            {product.short_description || "No short description yet."}
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
                                SKU
                              </p>
                              <p className="mt-1 font-black text-ink">
                                {product.sku || "Not set"}
                              </p>
                            </div>
                            <div className="rounded-2xl bg-slate-50 p-4">
                              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                                Inventory
                              </p>
                              <p className="mt-1 font-black text-ink">
                                {product.inventory_quantity ?? 0}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-3 lg:justify-end">
                          <ButtonLink
                            href={`${productListPath}?storeId=${activeStore.id}&edit=${product.id}`}
                            variant="secondary"
                          >
                            Edit
                          </ButtonLink>
                        </div>
                      </div>
                      <details className="rounded-2xl border border-red-100 bg-red-50/60 p-4">
                        <summary className="cursor-pointer text-sm font-black text-red-700">
                          Delete product
                        </summary>
                        <form action={deleteStoreOwnerProduct} className="mt-4 grid gap-3">
                          <input name="storeId" type="hidden" value={activeStore.id} />
                          <input name="productId" type="hidden" value={product.id} />
                          <p className="text-sm leading-6 text-red-700">
                            This removes the product from this store instance. This does
                            not touch media, checkout, carts, analytics, or store settings.
                          </p>
                          <div>
                            <Button className="bg-red-600 hover:bg-red-700" type="submit">
                              Confirm delete
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
