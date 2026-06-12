import { billingPlans, getBillingPlan, type BillingPlan, type SubscriptionPlanId } from "@/lib/billing/plans";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type ManagedBillingPlan = BillingPlan & {
  active: boolean;
  limits: Record<string, unknown>;
  sortOrder: number;
  yearlyPrice: number;
};

type SubscriptionPlanRow = {
  active?: boolean | null;
  id?: string | null;
  is_active?: boolean | null;
  limits?: unknown;
  monthly_price?: number | string | null;
  name?: string | null;
  plan_id?: string | null;
  plan_name?: string | null;
  price_cents?: number | null;
  sort_order?: number | null;
  yearly_price?: number | string | null;
};

function isSubscriptionPlanId(value: string | null | undefined): value is SubscriptionPlanId {
  return value === "free" || value === "starter" || value === "pro" || value === "agency";
}

function isMissingSubscriptionPlansTable(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const record = error as { code?: string; message?: string };
  return (
    record.code === "PGRST205" ||
    record.message?.toLowerCase().includes("subscription_plans") ||
    false
  );
}

function decimalToNumber(value: number | string | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function centsFromMonthlyPrice(row: SubscriptionPlanRow, fallback: BillingPlan) {
  const monthlyPrice = decimalToNumber(row.monthly_price);

  if (monthlyPrice !== null) {
    return Math.max(0, Math.round(monthlyPrice * 100));
  }

  return typeof row.price_cents === "number" && Number.isFinite(row.price_cents)
    ? Math.max(0, row.price_cents)
    : fallback.priceCents;
}

function limitsFromRow(row: SubscriptionPlanRow) {
  return row.limits && typeof row.limits === "object" && !Array.isArray(row.limits)
    ? (row.limits as Record<string, unknown>)
    : {};
}

function managedStaticPlan(plan: BillingPlan, index: number): ManagedBillingPlan {
  return {
    ...plan,
    active: true,
    limits: {},
    sortOrder: index * 10,
    yearlyPrice: plan.priceCents === 0 ? 0 : (plan.priceCents / 100) * 10
  };
}

function mergePlanRow(row: SubscriptionPlanRow, index: number): ManagedBillingPlan | null {
  const rowPlanId = row.plan_id ?? row.id;
  const normalizedPlanId = rowPlanId === "business" ? "agency" : rowPlanId;

  if (!isSubscriptionPlanId(normalizedPlanId)) {
    return null;
  }

  const fallback = getBillingPlan(normalizedPlanId);
  const priceCents = centsFromMonthlyPrice(row, fallback);
  const active = row.active ?? row.is_active ?? true;

  return {
    ...fallback,
    active,
    limits: limitsFromRow(row),
    name: row.plan_name?.trim() || row.name?.trim() || fallback.name,
    price: priceCents === 0 ? "$0" : `$${priceCents / 100}`,
    priceCents,
    sortOrder: row.sort_order ?? index * 10,
    yearlyPrice: decimalToNumber(row.yearly_price) ?? (priceCents === 0 ? 0 : (priceCents / 100) * 10)
  };
}

function mergeCatalog(rows: SubscriptionPlanRow[] | null, onlyActive: boolean) {
  if (!rows) {
    return billingPlans.map(managedStaticPlan).filter((plan) => !onlyActive || plan.active);
  }

  const managedRows = rows
    .map((row, index) => mergePlanRow(row, index))
    .filter((plan): plan is ManagedBillingPlan => Boolean(plan));
  const rowByPlanId = new Map(managedRows.map((plan) => [plan.id, plan]));
  const merged = billingPlans
    .map((staticPlan, index) => rowByPlanId.get(staticPlan.id) ?? managedStaticPlan(staticPlan, index))
    .filter((plan) => !onlyActive || plan.active);

  return merged.sort((first, second) => first.sortOrder - second.sortOrder);
}

async function fetchPlanRows(useAdminClient: boolean) {
  const supabase = useAdminClient ? createAdminClient() : await createClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("subscription_plans" as never)
    .select("id, plan_id, plan_name, name, monthly_price, yearly_price, price_cents, active, is_active, sort_order, limits")
    .order("sort_order" as never, { ascending: true });

  if (error) {
    if (!isMissingSubscriptionPlansTable(error)) {
      console.warn("[billing-plans] subscription_plans catalog lookup failed", {
        message: error.message
      });
    }

    return null;
  }

  return (data ?? []) as SubscriptionPlanRow[];
}

export async function getManagedBillingPlansForDisplay() {
  const rows = await fetchPlanRows(false);
  return mergeCatalog(rows, true);
}

export async function getAdminManagedBillingPlans() {
  const rows = await fetchPlanRows(true);
  return mergeCatalog(rows, false);
}

export async function getManagedBillingPlanForCheckout(planId: SubscriptionPlanId) {
  const rows = await fetchPlanRows(true);
  const plan = mergeCatalog(rows, false).find((candidate) => candidate.id === planId);

  return plan ?? managedStaticPlan(getBillingPlan(planId), 0);
}
