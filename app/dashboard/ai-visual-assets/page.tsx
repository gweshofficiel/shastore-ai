import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  cancelPendingAIVisualJobAction,
  generateFullAIVisualPackageAction,
  pauseAIVisualQueueAction,
  processAIVisualAssetBatchAction,
  regenerateAIVisualAssetJobAction,
  requestAIVisualAssetGenerationAction,
  resumeAIVisualQueueAction,
  retryFailedAIVisualJobAction,
  triggerAIVisualAssetWorkerAction,
  updateAIVisualAssetApprovalAction
} from "@/lib/ai-visual-provider-actions";
import { getAIVisualProviderRuntimeConfig } from "@/lib/storefront/ai-visual-provider";
import {
  aiVisualCreditRules,
  aiVisualUsageSummary,
  resolveAIVisualEntitlementPlan,
  type AIVisualUsageSummary
} from "@/lib/storefront/ai-visual-usage";
import {
  aiVisualAuditLogEntryFromRow,
  type AIVisualAuditLogEntry
} from "@/lib/storefront/ai-visual-audit";
import { getUserSubscriptionAccessForClient } from "@/lib/billing/access";
import {
  aiVisualQueueFromStoreData,
  type AIVisualGenerationJob,
  type AIVisualJobLifecycleStatus
} from "@/lib/storefront/ai-visual-queue";
import type { VisualAssetSlot } from "@/lib/storefront/visual-assets";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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
  activity: AIVisualAuditLogEntry[];
  categories: CategoryTarget[];
  error: string | null;
  jobs: AIVisualGenerationJob[];
  products: ProductTarget[];
  queuePaused: boolean;
  stores: UserStoreRow[];
  usageSummary: AIVisualUsageSummary;
};

const emptyUsageSummary: AIVisualUsageSummary = {
  bulkPackageAvailable: false,
  cancelledToday: 0,
  completedToday: 0,
  creditsActive: false,
  creditsAvailable: null,
  creditsReserved: 0,
  dailyLimit: 2,
  failedToday: 0,
  maxBulkJobsPerClick: 1,
  monthlyLimit: 10,
  planId: "unknown",
  planName: "Limited",
  priorityProcessing: false,
  regenerateAvailable: false,
  remainingDailyAllowance: 2,
  remainingMonthlyAllowance: 10,
  retryLimit: 2,
  todayJobs: 0,
  totalGeneratedAssets: 0,
  upgradeHint: "Upgrade or refresh billing status to unlock AI visual generation limits."
};

const statusClasses: Record<AIVisualJobLifecycleStatus, string> = {
  cancelled: "bg-slate-100 text-slate-700",
  completed: "bg-emerald-50 text-emerald-700",
  failed: "bg-red-50 text-red-700",
  paused: "bg-violet-50 text-violet-700",
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
  }
];

async function queueAIVisualAssetGeneration(formData: FormData) {
  "use server";

  await requestAIVisualAssetGenerationAction(undefined, formData);
}

async function queueFullAIVisualPackage(formData: FormData) {
  "use server";

  await generateFullAIVisualPackageAction(undefined, formData);
}

async function processAIVisualAssetJob(formData: FormData) {
  "use server";

  await triggerAIVisualAssetWorkerAction(undefined, formData);
}

async function processAIVisualAssetBatch(formData: FormData) {
  "use server";

  await processAIVisualAssetBatchAction(undefined, formData);
}

async function pauseAIVisualQueue(formData: FormData) {
  "use server";

  await pauseAIVisualQueueAction(undefined, formData);
}

async function resumeAIVisualQueue(formData: FormData) {
  "use server";

  await resumeAIVisualQueueAction(undefined, formData);
}

async function cancelAIVisualJob(formData: FormData) {
  "use server";

  await cancelPendingAIVisualJobAction(undefined, formData);
}

async function retryAIVisualJob(formData: FormData) {
  "use server";

  await retryFailedAIVisualJobAction(undefined, formData);
}

async function reviewAIVisualAsset(formData: FormData) {
  "use server";

  await updateAIVisualAssetApprovalAction(undefined, formData);
}

async function regenerateAIVisualAsset(formData: FormData) {
  "use server";

  await regenerateAIVisualAssetJobAction(undefined, formData);
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

function completedAssetUrl(job: AIVisualGenerationJob) {
  if (job.status !== "completed") {
    return null;
  }

  return job.result?.publicUrl || job.result?.asset?.url || job.result?.asset?.publicUrl || null;
}

function completedAssetStorageKey(job: AIVisualGenerationJob) {
  return job.result?.asset?.storageKey || job.result?.asset?.r2Key || null;
}

function completedAssetApprovalStatus(job: AIVisualGenerationJob) {
  const status = job.result?.asset?.approvalStatus;
  return status === "approved" || status === "rejected" || status === "disabled" || status === "generated"
    ? status
    : job.status === "completed"
      ? "generated"
      : null;
}

function auditActionLabel(actionType: AIVisualAuditLogEntry["actionType"]) {
  return actionType
    .replace("ai_visual.", "")
    .replaceAll("_", " ");
}

function auditStatusClass(status: string) {
  if (status === "completed" || status === "approved") {
    return "bg-emerald-50 text-emerald-700";
  }

  if (status === "failed" || status === "rejected" || status === "cancelled") {
    return "bg-red-50 text-red-700";
  }

  if (status === "disabled") {
    return "bg-slate-100 text-slate-700";
  }

  if (status === "processing") {
    return "bg-blue-50 text-blue-700";
  }

  return "bg-amber-50 text-amber-700";
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
      activity: [],
      categories: [],
      error: "Sign in to manage AI visual assets.",
      jobs: [],
      products: [],
      queuePaused: false,
      stores: [],
      usageSummary: emptyUsageSummary
    };
  }

  const selection = await getActiveWorkspaceForUser({ supabase, userId: user.id });
  const workspaceId = selection.activeWorkspaceId;
  const subscriptionAccess = await getUserSubscriptionAccessForClient(supabase, user.id);
  const entitlement = resolveAIVisualEntitlementPlan({
    planId: subscriptionAccess.plan.id,
    status: subscriptionAccess.status
  });

  if (selection.activeWorkspaceRole !== "owner" && selection.activeWorkspaceRole !== "admin") {
    return {
      activeStore: null,
      activity: [],
      categories: [],
      error: "Only workspace owners and admins can access AI visual generation controls.",
      jobs: [],
      products: [],
      queuePaused: false,
      stores: [],
      usageSummary: emptyUsageSummary
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
      activity: [],
      categories: [],
      error: "Stores could not be loaded. Please try again.",
      jobs: [],
      products: [],
      queuePaused: false,
      stores: [],
      usageSummary: emptyUsageSummary
    };
  }

  const activeStore = stores.find((store) => store.id === selectedStoreId) ?? stores[0] ?? null;

  if (!activeStore) {
    return {
      activeStore: null,
      activity: [],
      categories: [],
      error: null,
      jobs: [],
      products: [],
      queuePaused: false,
      stores,
      usageSummary: emptyUsageSummary
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
      activity: [],
      categories: [],
      error: access.reason,
      jobs: [],
      products: [],
      queuePaused: false,
      stores,
      usageSummary: emptyUsageSummary
    };
  }

  const auditClient = createAdminClient() ?? supabase;
  const [storeResult, productsResult, categoriesResult, auditResult] = await Promise.all([
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
      .limit(25),
    auditClient
      .from("store_audit_logs" as never)
      .select("id, action, actor_user_id, metadata, store_id, created_at")
      .eq("store_id" as never, activeStore.id as never)
      .like("action" as never, "ai_visual.%")
      .order("created_at", { ascending: false })
      .limit(10)
  ]);

  if (storeResult.error || !storeResult.data) {
    return {
      activeStore,
      activity: [],
      categories: [],
      error: storeResult.error?.message ?? "Store AI visual data could not be loaded.",
      jobs: [],
      products: [],
      queuePaused: false,
      stores,
      usageSummary: emptyUsageSummary
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
    activity: auditResult.error
      ? []
      : ((auditResult.data ?? []) as unknown[])
          .map(aiVisualAuditLogEntryFromRow)
          .filter((entry): entry is AIVisualAuditLogEntry => Boolean(entry)),
    categories: (categoriesResult.data ?? []) as unknown as CategoryTarget[],
    error: productsResult.error || categoriesResult.error
      ? "Targets could not be fully loaded. You can still review existing jobs."
      : null,
    jobs,
    products: (productsResult.data ?? []) as unknown as ProductTarget[],
    queuePaused: Boolean(queue.pausedAt),
    stores,
    usageSummary: aiVisualUsageSummary(storeData, entitlement)
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
  const { activeStore, activity, categories, error, jobs, products, queuePaused, stores, usageSummary } = await getAIVisualAssetsDashboardData(query.storeId);
  const providerConfig = getAIVisualProviderRuntimeConfig();
  const providerReady = providerConfig.status === "configured";
  const generationAllowed = providerReady && usageSummary.remainingDailyAllowance > 0 && (
    usageSummary.creditsActive
      ? (usageSummary.creditsAvailable ?? 0) > 0
      : usageSummary.remainingDailyAllowance > 0
  ) && usageSummary.remainingMonthlyAllowance > 0;
  const bulkGenerationAllowed = generationAllowed && usageSummary.bulkPackageAvailable;

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
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                  Provider status
                </p>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">
                  {providerReady ? "Provider configured" : "Provider not configured"}
                </h2>
                <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-muted">
                  Current provider: {providerConfig.provider}. R2 storage: {providerConfig.r2Configured ? "configured" : "not configured"}. API keys stay server-side and are never rendered in this panel.
                </p>
              </div>
              <form action={queueFullAIVisualPackage} className="grid gap-2">
                <input name="storeId" type="hidden" value={activeStore.id} />
                <input name="templateId" type="hidden" value={activeStore.template_id ?? ""} />
                <Button disabled={!bulkGenerationAllowed} type="submit">
                  Generate full visual package
                </Button>
                <p className="max-w-xs text-xs font-bold leading-5 text-slate-500">
                  Queues up to {usageSummary.maxBulkJobsPerClick} shared-runtime visuals, skipping approved assets and active jobs.
                </p>
              </form>
            </div>
          </Card>

          {!providerReady ? (
            <Card className="border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
              AI visual provider missing. Add provider credentials before queueing generation jobs.
            </Card>
          ) : null}

          {providerReady && !usageSummary.creditsActive && usageSummary.remainingDailyAllowance <= 0 ? (
            <Card className="border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
              AI visual daily limit reached. Try again tomorrow or wait for future credits support.
            </Card>
          ) : null}

          {providerReady && usageSummary.remainingMonthlyAllowance <= 0 ? (
            <Card className="border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
              {usageSummary.planName} monthly AI visual limit reached. Upgrade to increase your monthly allowance.
            </Card>
          ) : null}

          {providerReady && !usageSummary.bulkPackageAvailable ? (
            <Card className="border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
              Bulk packages are locked on the {usageSummary.planName} plan. {usageSummary.upgradeHint}
            </Card>
          ) : null}

          {providerReady && usageSummary.creditsActive && (usageSummary.creditsAvailable ?? 0) <= 0 ? (
            <Card className="border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
              Not enough AI visual credits available. Future billing credits can refill this balance.
            </Card>
          ) : null}

          <Card>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                  Usage today
                </p>
                <h2 className="mt-1 text-2xl font-black tracking-[-0.03em] text-ink">
                  {usageSummary.planName} AI visual plan
                </h2>
                <p className="mt-2 text-sm font-semibold leading-6 text-muted">
                  {usageSummary.creditsActive
                    ? `Credits mode is active with ${usageSummary.creditsAvailable ?? 0} credits available and ${usageSummary.creditsReserved} reserved.`
                    : "Credits are not active yet, so AI visuals use the fallback daily allowance. Users are not charged."}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm font-bold text-muted sm:grid-cols-4">
                <div className="rounded-2xl bg-slate-50 p-3">
                  <p className="text-xl font-black text-ink">{usageSummary.remainingDailyAllowance}</p>
                  <p>Daily left / {usageSummary.dailyLimit}</p>
                </div>
                <div className="rounded-2xl bg-emerald-50 p-3">
                  <p className="text-xl font-black text-emerald-700">{usageSummary.remainingMonthlyAllowance}</p>
                  <p>Monthly left / {usageSummary.monthlyLimit}</p>
                </div>
                <div className="rounded-2xl bg-red-50 p-3">
                  <p className="text-xl font-black text-red-700">{usageSummary.bulkPackageAvailable ? "Yes" : "No"}</p>
                  <p>Bulk package</p>
                </div>
                <div className="rounded-2xl bg-blue-50 p-3">
                  <p className="text-xl font-black text-blue-700">{usageSummary.priorityProcessing ? "Yes" : "No"}</p>
                  <p>Priority</p>
                </div>
              </div>
            </div>
            {usageSummary.upgradeHint ? (
              <p className="mt-4 rounded-2xl bg-amber-50 p-3 text-sm font-bold text-amber-800">
                {usageSummary.upgradeHint}
              </p>
            ) : null}
            <div className="mt-4 grid gap-2 rounded-2xl bg-slate-50 p-3 text-xs font-bold leading-5 text-slate-500 sm:grid-cols-2 lg:grid-cols-5">
              <p>Product image: {aiVisualCreditRules.productImage} credit</p>
              <p>Category image: {aiVisualCreditRules.categoryImage} credit</p>
              <p>Hero banner: {aiVisualCreditRules.heroBanner} credits</p>
              <p>Promo banner: {aiVisualCreditRules.promoBanner} credits</p>
              <p>Bulk package: estimated from selected slots</p>
            </div>
          </Card>

          <Card>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                  Recent activity
                </p>
                <h2 className="mt-1 text-2xl font-black tracking-[-0.03em] text-ink">
                  AI visual audit trail
                </h2>
                <p className="mt-2 text-sm font-semibold leading-6 text-muted">
                  Latest 10 safe metadata events from the store audit log. Provider responses and secrets are never shown here.
                </p>
              </div>
            </div>
            <div className="mt-5 grid gap-3">
              {activity.length ? activity.map((entry) => (
                <div className="grid gap-3 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 md:grid-cols-[minmax(0,1fr)_auto]" key={`${entry.actionType}-${entry.requestId}-${entry.createdAt}`}>
                  <div>
                    <p className="text-sm font-black capitalize text-ink">
                      {auditActionLabel(entry.actionType)}
                    </p>
                    <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-muted">
                      {entry.assetType || "visual asset"} · {entry.targetType || "target"}
                    </p>
                    <p className="mt-2 break-all text-xs font-semibold text-slate-500">
                      Actor: {entry.actorUserId ?? "system"} · Provider: {entry.provider || "unknown"}
                    </p>
                    {entry.errorMessage ? (
                      <p className="mt-2 rounded-2xl bg-red-50 p-2 text-xs font-bold text-red-700">
                        {entry.errorMessage}
                      </p>
                    ) : null}
                  </div>
                  <div className="grid content-start gap-2 text-left md:text-right">
                    <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${auditStatusClass(entry.status)}`}>
                      {entry.status || "recorded"}
                    </span>
                    <p className="text-xs font-bold text-slate-500">
                      {new Date(entry.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              )) : (
                <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 p-5 text-sm font-bold text-muted">
                  No AI visual audit activity has been recorded for this store yet.
                </div>
              )}
            </div>
          </Card>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {requestCards.map((card) => {
              const disabled =
                !generationAllowed ||
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
                <div className="flex flex-wrap gap-2">
                  <form action={processAIVisualAssetBatch}>
                    <input name="storeId" type="hidden" value={activeStore.id} />
                    <input name="limit" type="hidden" value="1" />
                    <Button disabled={queuePaused} type="submit">
                      Process next job
                    </Button>
                  </form>
                  <form action={processAIVisualAssetBatch}>
                    <input name="storeId" type="hidden" value={activeStore.id} />
                    <input name="limit" type="hidden" value="3" />
                    <Button disabled={queuePaused} type="submit" variant="secondary">
                      Process next 3 jobs
                    </Button>
                  </form>
                  {queuePaused ? (
                    <form action={resumeAIVisualQueue}>
                      <input name="storeId" type="hidden" value={activeStore.id} />
                      <Button type="submit" variant="secondary">
                        Resume queue
                      </Button>
                    </form>
                  ) : (
                    <form action={pauseAIVisualQueue}>
                      <input name="storeId" type="hidden" value={activeStore.id} />
                      <Button type="submit" variant="secondary">
                        Pause queue
                      </Button>
                    </form>
                  )}
                </div>
              </div>
              {queuePaused ? (
                <p className="mt-3 rounded-2xl bg-violet-50 p-3 text-sm font-bold text-violet-700">
                  Queue is paused. Pending jobs are held until you resume processing.
                </p>
              ) : null}

              <div className="mt-5 grid gap-3">
                {jobs.length ? jobs.map((job) => {
                  const assetUrl = completedAssetUrl(job);
                  const approvalStatus = completedAssetApprovalStatus(job);
                  const storageKey = completedAssetStorageKey(job);

                  return (
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
                      {assetUrl ? (
                        <div className="mt-4 grid gap-3 rounded-[1.5rem] border border-emerald-100 bg-white p-3 sm:grid-cols-[120px_minmax(0,1fr)]">
                          <img
                            alt={job.request.entityTitle || "Generated AI visual asset"}
                            className="aspect-video w-full rounded-2xl object-cover sm:aspect-square"
                            src={assetUrl}
                          />
                          <div className="grid min-w-0 content-center gap-2">
                            <a
                              className="text-sm font-black text-emerald-700 underline-offset-4 hover:underline"
                              href={assetUrl}
                              rel="noreferrer"
                              target="_blank"
                            >
                              Open asset
                            </a>
                            {storageKey ? (
                              <p className="break-all rounded-2xl bg-slate-50 p-3 text-xs font-bold leading-5 text-slate-500">
                                Storage key: {storageKey}
                              </p>
                            ) : null}
                            {approvalStatus ? (
                              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                                Approval: {approvalStatus}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                      {job.status === "completed" && assetUrl ? (
                        <div className="mt-4 flex flex-wrap gap-2">
                          <form action={reviewAIVisualAsset}>
                            <input name="storeId" type="hidden" value={activeStore.id} />
                            <input name="requestId" type="hidden" value={job.requestId} />
                            <input name="approvalStatus" type="hidden" value="approved" />
                            <Button type="submit" variant="secondary">
                              Approve visual
                            </Button>
                          </form>
                          <form action={reviewAIVisualAsset}>
                            <input name="storeId" type="hidden" value={activeStore.id} />
                            <input name="requestId" type="hidden" value={job.requestId} />
                            <input name="approvalStatus" type="hidden" value="rejected" />
                            <Button type="submit" variant="secondary">
                              Reject visual
                            </Button>
                          </form>
                          <form action={reviewAIVisualAsset}>
                            <input name="storeId" type="hidden" value={activeStore.id} />
                            <input name="requestId" type="hidden" value={job.requestId} />
                            <input name="approvalStatus" type="hidden" value="disabled" />
                            <Button type="submit" variant="secondary">
                              Disable visual
                            </Button>
                          </form>
                          <form action={regenerateAIVisualAsset}>
                            <input name="storeId" type="hidden" value={activeStore.id} />
                            <input name="requestId" type="hidden" value={job.requestId} />
                            <Button disabled={!generationAllowed || !usageSummary.regenerateAvailable} type="submit" variant="secondary">
                              Regenerate
                            </Button>
                          </form>
                        </div>
                      ) : null}
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
                      <div className="mt-4 flex flex-wrap gap-2">
                        {job.status === "pending" ? (
                          <form action={processAIVisualAssetJob}>
                            <input name="storeId" type="hidden" value={activeStore.id} />
                            <input name="requestId" type="hidden" value={job.requestId} />
                            <Button disabled={queuePaused} type="submit" variant="secondary">
                              Process this job
                            </Button>
                          </form>
                        ) : null}
                        {job.status === "pending" || job.status === "paused" ? (
                          <form action={cancelAIVisualJob}>
                            <input name="storeId" type="hidden" value={activeStore.id} />
                            <input name="requestId" type="hidden" value={job.requestId} />
                            <Button type="submit" variant="secondary">
                              Cancel pending job
                            </Button>
                          </form>
                        ) : null}
                        {job.status === "failed" ? (
                          <form action={retryAIVisualJob}>
                            <input name="storeId" type="hidden" value={activeStore.id} />
                            <input name="requestId" type="hidden" value={job.requestId} />
                            <Button disabled={!generationAllowed} type="submit" variant="secondary">
                              Retry failed job
                            </Button>
                          </form>
                        ) : null}
                      </div>
                    </div>
                  );
                }) : (
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
                Safe worker controls
              </h2>
              <div className="mt-4 grid gap-3 text-sm font-semibold leading-6 text-muted">
                <p>Jobs are created only by owner/admin form submission.</p>
                <p>The worker runs only when manually triggered from this panel, capped at 3 jobs per click.</p>
                <p>Paused queues hold pending jobs until resumed. Completed jobs are never processed again.</p>
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

