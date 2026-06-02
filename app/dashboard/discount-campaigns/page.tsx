import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  createDiscountCampaignAction,
  updateDiscountCampaignStatusAction
} from "@/lib/discount-campaign-actions";
import { getUserWorkspaceRole, hasPermission } from "@/lib/permissions/rbac";
import { createClient } from "@/lib/supabase/server";
import { fetchStoresForAuthUser, type UserStoreRow } from "@/lib/stores/user-stores";
import { getActiveWorkspaceForUser } from "@/lib/workspaces/active-workspace";

export const dynamic = "force-dynamic";

type DiscountCampaignRow = {
  discount_type: "fixed" | "free_shipping" | "percentage";
  discount_value: number | string;
  ends_at?: string | null;
  id: string;
  name: string;
  starts_at?: string | null;
  status: string;
};

type DiscountRuleRow = {
  campaign_id: string;
  rule_type: string;
  rule_value?: string | null;
};

type ProductRow = {
  id: string;
  name?: string | null;
  title?: string | null;
};

type CategoryRow = {
  id: string;
  name: string;
};

type DashboardData = {
  activeStore: UserStoreRow | null;
  campaigns: DiscountCampaignRow[];
  categories: CategoryRow[];
  error: string | null;
  products: ProductRow[];
  rulesByCampaign: Map<string, DiscountRuleRow[]>;
  stores: UserStoreRow[];
};

const segmentOptions = [
  ["all_customers", "All customers"],
  ["new_customers", "New customers"],
  ["returning_customers", "Returning customers"],
  ["vip_customers", "VIP customers"],
  ["digital_product_customers", "Digital product customers"]
] as const;

function statusMessage(value: string | undefined) {
  const messages: Record<string, string> = {
    "access-denied": "You do not have permission to manage discount campaigns for that store.",
    "create-failed": "Discount campaign could not be created. Apply the discount campaigns migration and try again.",
    created: "Discount campaign created.",
    invalid: "Enter a campaign name and valid discount value.",
    "invalid-percentage": "Percentage discounts cannot exceed 100%.",
    updated: "Discount campaign status updated.",
    "update-failed": "Discount campaign status could not be updated."
  };

  return value ? messages[value] ?? null : null;
}

function formatDiscount(campaign: DiscountCampaignRow) {
  if (campaign.discount_type === "free_shipping") {
    return "Free shipping";
  }

  return campaign.discount_type === "percentage"
    ? `${Number(campaign.discount_value)}%`
    : Number(campaign.discount_value).toFixed(2);
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "No limit";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function statusClass(status: string) {
  if (status === "active") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (status === "expired") {
    return "bg-slate-100 text-muted";
  }

  return "bg-amber-100 text-amber-700";
}

function ruleSummary(rules: DiscountRuleRow[], productsById: Map<string, ProductRow>, categoriesById: Map<string, CategoryRow>) {
  const allProducts = rules.some((rule) => rule.rule_type === "all_products");
  const products = rules
    .filter((rule) => rule.rule_type === "product" && rule.rule_value)
    .map((rule) => productsById.get(rule.rule_value as string)?.title ?? productsById.get(rule.rule_value as string)?.name ?? "Product");
  const categories = rules
    .filter((rule) => rule.rule_type === "category" && rule.rule_value)
    .map((rule) => categoriesById.get(rule.rule_value as string)?.name ?? "Category");
  const segments = rules
    .filter((rule) => rule.rule_type === "customer_segment" && rule.rule_value)
    .map((rule) => segmentOptions.find(([value]) => value === rule.rule_value)?.[1] ?? "Customer segment");

  return [
    allProducts ? "All products" : null,
    products.length ? `Products: ${products.join(", ")}` : null,
    categories.length ? `Categories: ${categories.join(", ")}` : null,
    segments.length ? `Segments: ${segments.join(", ")}` : null
  ].filter(Boolean).join(" · ") || "All products";
}

async function getDashboardData(selectedStoreId?: string): Promise<DashboardData> {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      activeStore: null,
      campaigns: [],
      categories: [],
      error: "Sign in to manage discount campaigns.",
      products: [],
      rulesByCampaign: new Map(),
      stores: []
    };
  }

  const selection = await getActiveWorkspaceForUser({ supabase, userId: user.id });
  const workspaceId = selection.activeWorkspaceId;
  const role = await getUserWorkspaceRole(supabase, workspaceId, user.id);
  const canEdit = hasPermission(role, "can_edit_stores");

  if (!canEdit) {
    return {
      activeStore: null,
      campaigns: [],
      categories: [],
      error: "You do not have permission to manage discount campaigns.",
      products: [],
      rulesByCampaign: new Map(),
      stores: []
    };
  }

  const { stores, error: storesError } = await fetchStoresForAuthUser(supabase, user.id, workspaceId);
  const activeStore = stores.find((store) => store.id === selectedStoreId) ?? stores[0] ?? null;

  if (storesError || !activeStore) {
    return {
      activeStore,
      campaigns: [],
      categories: [],
      error: storesError ? "Stores could not be loaded." : null,
      products: [],
      rulesByCampaign: new Map(),
      stores
    };
  }

  const [campaignsResult, rulesResult, productsResult, categoriesResult] = await Promise.all([
    supabase
      .from("discount_campaigns" as never)
      .select("id, name, discount_type, discount_value, status, starts_at, ends_at")
      .eq("workspace_id" as never, workspaceId as never)
      .eq("store_id" as never, activeStore.id as never)
      .order("created_at" as never, { ascending: false } as never),
    supabase
      .from("discount_campaign_rules" as never)
      .select("campaign_id, rule_type, rule_value")
      .eq("workspace_id" as never, workspaceId as never)
      .eq("store_id" as never, activeStore.id as never),
    supabase
      .from("store_products" as never)
      .select("id, title, name")
      .eq("workspace_id" as never, workspaceId as never)
      .eq("store_id" as never, activeStore.id as never)
      .order("title" as never, { ascending: true }),
    supabase
      .from("store_categories" as never)
      .select("id, name")
      .eq("workspace_id" as never, workspaceId as never)
      .eq("store_id" as never, activeStore.id as never)
      .order("name" as never, { ascending: true })
  ]);

  if (campaignsResult.error) {
    return {
      activeStore,
      campaigns: [],
      categories: [],
      error: "Discount campaign tables could not be loaded. Apply the discount campaigns migration.",
      products: [],
      rulesByCampaign: new Map(),
      stores
    };
  }

  const rulesByCampaign = new Map<string, DiscountRuleRow[]>();

  for (const rule of (rulesResult.data ?? []) as unknown as DiscountRuleRow[]) {
    rulesByCampaign.set(rule.campaign_id, [...(rulesByCampaign.get(rule.campaign_id) ?? []), rule]);
  }

  return {
    activeStore,
    campaigns: (campaignsResult.data ?? []) as unknown as DiscountCampaignRow[],
    categories: (categoriesResult.data ?? []) as unknown as CategoryRow[],
    error: null,
    products: (productsResult.data ?? []) as unknown as ProductRow[],
    rulesByCampaign,
    stores
  };
}

export default async function DiscountCampaignsPage({
  searchParams
}: {
  searchParams: Promise<{ discounts?: string; storeId?: string }>;
}) {
  const query = await searchParams;
  const { activeStore, campaigns, categories, error, products, rulesByCampaign, stores } =
    await getDashboardData(query.storeId);
  const message = statusMessage(query.discounts);
  const productsById = new Map(products.map((product) => [product.id, product]));
  const categoriesById = new Map(categories.map((category) => [category.id, category]));

  return (
    <div className="grid gap-6 lg:gap-8">
      <PageHeader
        description="Create structured campaign discounts with product, category, and customer segment rules."
        title="Discount Campaigns"
      />

      {message ? (
        <Card className="border-blue-200 bg-blue-50 p-5">
          <p className="text-sm font-bold text-blue-800">{message}</p>
        </Card>
      ) : null}

      {error ? (
        <Card className="border-red-200 bg-red-50 p-5">
          <p className="text-sm font-bold text-red-700">{error}</p>
        </Card>
      ) : null}

      {activeStore ? (
        <>
          <Card className="p-5 lg:p-6">
            <form className="flex flex-wrap items-end gap-3" method="get">
              <label className="grid min-w-64 gap-2 text-sm font-semibold text-ink">
                <span>Store</span>
                <select
                  className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink shadow-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                  defaultValue={activeStore.id}
                  name="storeId"
                >
                  {stores.map((store) => (
                    <option key={store.id} value={store.id}>
                      {store.name || store.store_name || "Untitled store"}
                    </option>
                  ))}
                </select>
              </label>
              <Button type="submit" variant="secondary">View campaigns</Button>
            </form>
          </Card>

          <Card className="grid gap-5 p-5 lg:p-6">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Create campaign</p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">
                New discount for {activeStore.name || activeStore.store_name || "this store"}
              </h2>
            </div>
            <form action={createDiscountCampaignAction} className="grid gap-5">
              <input name="storeId" type="hidden" value={activeStore.id} />
              <div className="grid gap-4 md:grid-cols-4">
                <Input id="discount-name" label="Name" name="name" placeholder="Summer Sale" required />
                <label className="grid gap-2 text-sm font-semibold text-ink">
                  <span>Discount type</span>
                  <select
                    className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink shadow-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                    name="discountType"
                  >
                    <option value="percentage">Percentage</option>
                    <option value="fixed">Fixed amount</option>
                    <option value="free_shipping">Free shipping</option>
                  </select>
                </label>
                <Input id="discount-value" label="Discount value" min="0" name="discountValue" step="0.01" type="number" />
                <label className="grid gap-2 text-sm font-semibold text-ink">
                  <span>Status</span>
                  <select
                    className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink shadow-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                    name="status"
                  >
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="expired">Expired</option>
                  </select>
                </label>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Input id="starts-at" label="Start date" name="startsAt" type="datetime-local" />
                <Input id="ends-at" label="End date" name="endsAt" type="datetime-local" />
              </div>
              <div className="grid gap-4 lg:grid-cols-3">
                <Card className="grid gap-3 border-slate-200 p-4 shadow-none">
                  <label className="flex items-center gap-3 text-sm font-black text-ink">
                    <input defaultChecked className="h-4 w-4 accent-slate-950" name="allProducts" type="checkbox" />
                    All products
                  </label>
                  <p className="text-xs font-semibold leading-5 text-muted">
                    Leave checked for storewide discounts. Uncheck and select products or categories for targeted campaigns.
                  </p>
                </Card>
                <Card className="grid max-h-72 gap-3 overflow-auto border-slate-200 p-4 shadow-none">
                  <p className="text-sm font-black text-ink">Selected products</p>
                  {products.length ? products.map((product) => (
                    <label className="flex items-center gap-3 text-sm font-semibold text-muted" key={product.id}>
                      <input className="h-4 w-4 accent-slate-950" name="productIds" type="checkbox" value={product.id} />
                      {product.title || product.name || product.id}
                    </label>
                  )) : <p className="text-xs font-semibold text-muted">No products yet.</p>}
                </Card>
                <Card className="grid max-h-72 gap-3 overflow-auto border-slate-200 p-4 shadow-none">
                  <p className="text-sm font-black text-ink">Selected categories</p>
                  {categories.length ? categories.map((category) => (
                    <label className="flex items-center gap-3 text-sm font-semibold text-muted" key={category.id}>
                      <input className="h-4 w-4 accent-slate-950" name="categoryIds" type="checkbox" value={category.id} />
                      {category.name}
                    </label>
                  )) : <p className="text-xs font-semibold text-muted">No categories yet.</p>}
                </Card>
              </div>
              <Card className="grid gap-3 border-slate-200 p-4 shadow-none">
                <p className="text-sm font-black text-ink">Customer segments</p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {segmentOptions.map(([value, label]) => (
                    <label className="flex items-center gap-3 text-sm font-semibold text-muted" key={value}>
                      <input className="h-4 w-4 accent-slate-950" name="customerSegments" type="checkbox" value={value} />
                      {label}
                    </label>
                  ))}
                </div>
                <p className="text-xs font-semibold leading-5 text-muted">
                  If no segment is selected, the campaign can match any customer.
                </p>
              </Card>
              <Button className="w-fit" type="submit">Create discount campaign</Button>
            </form>
          </Card>

          <section className="grid gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Campaigns</p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">
                {campaigns.length} {campaigns.length === 1 ? "campaign" : "campaigns"}
              </h2>
            </div>
            {campaigns.length ? campaigns.map((campaign) => (
              <Card className="grid gap-4 p-5" key={campaign.id}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.16em] ${statusClass(campaign.status)}`}>
                        {campaign.status}
                      </span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-muted">
                        {formatDiscount(campaign)}
                      </span>
                    </div>
                    <h3 className="mt-3 text-xl font-black tracking-[-0.03em] text-ink">{campaign.name}</h3>
                    <p className="mt-2 text-sm font-semibold leading-6 text-muted">
                      {ruleSummary(rulesByCampaign.get(campaign.id) ?? [], productsById, categoriesById)}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-muted">
                      Starts {formatDate(campaign.starts_at)} · Ends {formatDate(campaign.ends_at)}
                    </p>
                  </div>
                  <form action={updateDiscountCampaignStatusAction} className="flex flex-wrap gap-2">
                    <input name="campaignId" type="hidden" value={campaign.id} />
                    <input name="storeId" type="hidden" value={activeStore.id} />
                    <input
                      name="status"
                      type="hidden"
                      value={campaign.status === "active" ? "expired" : "active"}
                    />
                    <Button type="submit" variant="secondary">
                      {campaign.status === "active" ? "Expire" : "Activate"}
                    </Button>
                  </form>
                </div>
              </Card>
            )) : (
              <Card className="border-dashed border-slate-300 p-8 text-center">
                <p className="text-sm font-bold text-muted">No discount campaigns yet for this store.</p>
              </Card>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
