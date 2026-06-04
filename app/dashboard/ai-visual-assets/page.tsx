import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  requestAIVisualAssetGenerationAction,
  triggerAIVisualAssetWorkerAction
} from "@/lib/ai-visual-provider-actions";
import { getAIVisualProviderRuntimeConfig } from "@/lib/storefront/ai-visual-provider";
import {
  aiVisualQueueFromStoreData,
  type AIVisualGenerationJob,
  type AIVisualJobLifecycleStatus
} from "@/lib/storefront/ai-visual-queue";
import type { VisualAssetSlot } from "@/lib/storefront/visual-assets";
import { createClient } from "@/lib/supabase/server";
import { fetchStoresForAuthUser, type UserStoreRow } from "@/lib/stores/user-stores";
import { getActiveWorkspaceForUser } from "@/lib/workspaces/active-workspace";
import { assertStoreAccessInWorkspace } from "@/lib/workspaces/data-access";

export const dynamic = "force-dynamic";

type ProductTarget = {
  id: string;
  title?: string | null;
  name?: string | null;
};

type CategoryTarget = {
  id: string;
  name: string;
};

type AIVisualAssetsDashboardData = {
  activeStore: UserStoreRow | null;
  categories: CategoryTarget[];
  error: string | null;
  jobs: AIVisualGenerationJob[];
  products: ProductTarget[];
  stores: UserStoreRow[];
};

const statusClasses: Record<AIVisualJobLifecycleStatus, string> = {
  cancelled: "bg-slate-100 text-slate-700",
  completed: "bg-emerald-50 text-emerald-700",
  failed: "bg-red-50 text-red-700",
  pending: "bg-amber-50 text-amber-700",
  processing: "bg-blue-50 text-blue-700"
};

const requestCards: Array<{
  description: string;
  entityTitle: string;
  label: string;
  slot: VisualAssetSlot;
  targetKind: "product" | "category" | "template";
}> = [
  {
    description: "Queue a primary product image for the selected product.",
    entityTitle: "Product image",
    label: "Generate product image",
    slot: "product.primary",
    targetKind: "product"
  },
  {
    description: "Queue a category image for the selected category.",
    entityTitle: "Category image",
    label: "Generate category image",
    slot: "category.image",
    targetKind: "category"
  },
  {
    description: "Queue a shared homepage hero banner for the active template.",
    entityTitle: "Hero banner",
    label: "Generate hero banner",
    slot: "hero.desktop",
    targetKind: "template"
  },
  {
    description: "Queue a shared promotional banner for campaign blocks.",
    entityTitle: "Promo banner",
    label: "Generate promo banner",
    slot: "marketing.flashSale",
    targetKind: "template"
  },
  {
    description: "Queue a shared collection banner for collection sections.",
    entityTitle: "Collection banner",
    label: "Generate collection banner",
    slot: "marketing.collection",
    targetKind: "template"
  }
];

async function queueAIVisualAssetGeneration(formData: FormData) {
  "use server";

  await requestAIVisualAssetGenerationAction(undefined, formData);
}

async function processAIVisualAssetJob(formData: FormData) {
  "use server";

  await triggerAIVisualAssetWorkerAction(undefined, formData);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function displayStoreName(store: UserStoreRow | null) {
  return store?.store_name || store?.name || store?.slug || "Selected store";
}

function targetName(job: AIVisualGenerationJob) {
  return job.request.entityTitle || job.attachTarget.entityId || "Template visual";
}

async function getAIVisualAssetsDashboardData(
  selectedStoreId?: string
): Promise<AIVisualAssetsDashboardData> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      activeStore: null,
      categories: [],
      error: "Sign in to manage AI visual assets.",
      jobs: [],
      products: [],
      stores: []
    };
  }

  const selection = await getActiveWorkspaceForUser({ supabase, userId: user.id });
  const workspaceId = selection.activeWorkspaceId;

  if (selection.activeWorkspaceRole !== "owner" && selection.activeWorkspaceRole !== "admin") {
    return {
      activeStore: null,
      categories: [],
      error: "Only workspace owners and admins can access AI visual generation controls.",
      jobs: [],
      products: [],
      stores: []
    };
  }

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
      jobs: [],
      products: [],
      stores: []
    };
  }

  const activeStore = stores.find((store) => store.id === selectedStoreId) ?? stores[0] ?? null;

  if (!activeStore) {
    return {
      activeStore: null,
      categories: [],
      error: null,
      jobs: [],
      products: [],
      stores
    };
  }

  const access = await assertStoreAccessInWorkspace({
    permission: "can_edit_stores",
    storeId: activeStore.id,
    supabase,
    userId: user.id,
    workspaceId
  });

  if (!access.allowed) {
    return {
      activeStore,
      categories: [],
      error: access.reason,
      jobs: [],
      products: [],
      stores
    };
  }

  const [storeResult, productsResult, categoriesResult] = await Promise.all([
    supabase
      .from("stores" as never)
      .select("id, store_data")
      .eq("id" as never, activeStore.id as never)
      .eq("workspace_id" as never, workspaceId as never)
      .maybeSingle(),
    supabase
      .from("store_products" as never)
      .select("id, title, name")
      .eq("store_id" as never, activeStore.id as never)
      .eq("workspace_id" as never, workspaceId as never)
      .order("created_at", { ascending: false })
      .limit(25),
    supabase
      .from("store_categories" as never)
      .select("id, name")
      .eq("store_id" as never, activeStore.id as never)
      .eq("workspace_id" as never, workspaceId as never)
      .order("name", { ascending: true })
      .limit(25)
  ]);

  if (storeResult.error || !storeResult.data) {
    return {
      activeStore,
      categories: [],
      error: storeResult.error?.message ?? "Store AI visual data could not be loaded.",
      jobs: [],
      products: [],
      stores
    };
  }

  const storeData = isRecord((storeResult.data as { store_data?: unknown }).store_data)
    ? (storeResult.data as { store_data?: Record<string, unknown> }).store_data ?? {}
    : {};
  const queue = aiVisualQueueFromStoreData(storeData);
  const jobs = Object.values(queue.jobs)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  return {
    activeStore,
    categories: (categoriesResult.data ?? []) as unknown as CategoryTarget[],
    error: productsResult.error || categoriesResult.error
      ? "Targets could not be fully loaded. You can still review existing jobs."
      : null,
    jobs,
    products: (productsResult.data ?? []) as unknown as ProductTarget[],
    stores
  };
}

function TargetFields({
  activeStore,
  categories,
  card,
  products
}: {
  activeStore: UserStoreRow;
  categories: CategoryTarget[];
  card: (typeof requestCards)[number];
  products: ProductTarget[];
}) {
  if (card.targetKind === "product") {
    const firstProduct = products[0];

    return (
      <>
        <select
          className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-ink outline-none"
          disabled={!products.length}
          name="entityId"
          required
        >
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.title || product.name || product.id}
            </option>
          ))}
        </select>
        <input
          className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-ink outline-none"
          defaultValue={firstProduct?.title || firstProduct?.name || card.entityTitle}
          name="entityTitle"
          placeholder="Target name"
          required
        />
      </>
    );
  }

  if (card.targetKind === "category") {
    const firstCategory = categories[0];

    return (
      <>
        <select
          className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-ink outline-none"
          disabled={!categories.length}
          name="entityId"
          required
        >
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <input
          className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-ink outline-none"
          defaultValue={firstCategory?.name || card.entityTitle}
          name="entityTitle"
          placeholder="Target name"
          required
        />
      </>
    );
  }

  return (
    <>
      <input name="entityId" type="hidden" value={`${activeStore.id}-${card.slot}`} />
      <input name="entityTitle" type="hidden" value={`${displayStoreName(activeStore)} ${card.entityTitle}`} />
    </>
  );
}

function StatusBadge({ status }: { status: AIVisualJobLifecycleStatus }) {
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${statusClasses[status]}`}>
      {status}
    </span>
  );
}

export default async function AIVisualAssetsDashboard({
  searchParams
}: {
  searchParams: Promise<{ storeId?: string }>;
}) {
  const query = await searchParams;
  const { activeStore, categories, error, jobs, products, stores } = await getAIVisualAssetsDashboardData(query.storeId);
  const providerConfig = getAIVisualProviderRuntimeConfig();
  const providerReady = providerConfig.status === "configured";

  return (
    <div className="grid gap-6 lg:gap-8">
      <PageHeader
        description="Request, review, and manually process AI visual asset jobs through the shared template visual pipeline."
        title="AI Visual Assets"
      />

      {error ? (
        <Card className="border-red-200 bg-red-50 p-5 text-sm font-bold text-red-700">
          {error}
        </Card>
      ) : null}

      {stores.length ? (
        <Card className="p-4">
          <form className="flex flex-wrap items-end gap-3">
            <label className="grid gap-2 text-sm font-bold text-ink">
              <span>Store</span>
              <select
                className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-ink outline-none"
                defaultValue={activeStore?.id}
                name="storeId"
              >
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {displayStoreName(store)}
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit" variant="secondary">
              View store
            </Button>
          </form>
        </Card>
      ) : null}

      {activeStore ? (
        <>
          <Card className={providerReady ? "border-emerald-100 bg-emerald-50" : "border-amber-100 bg-amber-50"}>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
              Provider status
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">
              {providerReady ? "Provider configured" : "Provider not configured"}
            </h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-muted">
              Current provider: {providerConfig.provider}. R2 storage: {providerConfig.r2Configured ? "configured" : "not configured"}. API keys stay server-side and are never rendered in this panel.
            </p>
          </Card>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {requestCards.map((card) => {
              const disabled =
                (card.targetKind === "product" && !products.length) ||
                (card.targetKind === "category" && !categories.length);

              return (
                <Card className="grid gap-4 p-4" key={card.slot}>
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                      {card.slot}
                    </p>
                    <h2 className="mt-1 text-lg font-black tracking-[-0.03em] text-ink">
                      {card.label}
                    </h2>
                    <p className="mt-2 text-sm font-semibold leading-6 text-muted">
                      {card.description}
                    </p>
                  </div>
                  <form action={queueAIVisualAssetGeneration} className="mt-auto grid gap-3">
                    <input name="storeId" type="hidden" value={activeStore.id} />
                    <input name="templateId" type="hidden" value={activeStore.template_id ?? ""} />
                    <input name="slot" type="hidden" value={card.slot} />
                    <TargetFields activeStore={activeStore} card={card} categories={categories} products={products} />
                    <Button disabled={disabled} type="submit" variant="secondary">
                      Queue job
                    </Button>
                  </form>
                </Card>
              );
            })}
          </section>

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.45fr)]">
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                    Queue
                  </p>
                  <h2 className="mt-1 text-2xl font-black tracking-[-0.03em] text-ink">
                    AI visual jobs
                  </h2>
                </div>
                <form action={processAIVisualAssetJob}>
                  <input name="storeId" type="hidden" value={activeStore.id} />
                  <Button type="submit">Process next pending</Button>
                </form>
              </div>

              <div className="mt-5 grid gap-3">
                {jobs.length ? jobs.map((job) => (
                  <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-4" key={job.requestId}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-black tracking-[-0.03em] text-ink">
                          {targetName(job)}
                        </h3>
                        <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-muted">
                          {job.kind.replaceAll("_", " ")} · {job.slot}
                        </p>
                      </div>
                      <StatusBadge status={job.status} />
                    </div>
                    <div className="mt-4 grid gap-2 text-sm font-semibold text-muted md:grid-cols-2">
                      <p>Asset type: {job.kind.replaceAll("_", " ")}</p>
                      <p>Target type: {job.attachTarget.type}</p>
                      <p>Provider: {job.provider}</p>
                      <p>Attempts: {job.attempts}</p>
                      <p>Created: {new Date(job.createdAt).toLocaleString()}</p>
                      <p>Updated: {new Date(job.updatedAt).toLocaleString()}</p>
                    </div>
                    {job.error ? (
                      <p className="mt-3 rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700">
                        {job.error}
                      </p>
                    ) : null}
                    {job.status === "pending" ? (
                      <form action={processAIVisualAssetJob} className="mt-4">
                        <input name="storeId" type="hidden" value={activeStore.id} />
                        <input name="requestId" type="hidden" value={job.requestId} />
                        <Button type="submit" variant="secondary">
                          Process this job
                        </Button>
                      </form>
                    ) : null}
                  </div>
                )) : (
                  <div className="rounded-[2rem] border border-dashed border-slate-200 bg-slate-50 p-6 text-sm font-bold text-muted">
                    No AI visual jobs yet. Queue a visual asset above to start the manual pipeline.
                  </div>
                )}
              </div>
            </Card>

            <Card>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                Safety
              </p>
              <h2 className="mt-1 text-2xl font-black tracking-[-0.03em] text-ink">
                Manual controls only
              </h2>
              <div className="mt-4 grid gap-3 text-sm font-semibold leading-6 text-muted">
                <p>Jobs are created only by owner/admin form submission.</p>
                <p>The worker runs only when manually triggered from this panel.</p>
                <p>Provider and R2 keys are read only by server-side modules.</p>
                <p>All templates share the same queue, worker, storage, and resolver pipeline.</p>
              </div>
            </Card>
          </section>
        </>
      ) : (
        <Card className="p-6 text-sm font-bold text-muted">
          Create or select a store before managing AI visual assets.
        </Card>
      )}
    </div>
  );
}

