import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { getBillingPlan } from "@/lib/billing/plans";
import { createAdminClient } from "@/lib/supabase/admin";

export type SubscriptionReportsSource = "subscription_reports_runtime";

export type SubscriptionReportsDateRange = "today" | "7d" | "30d" | "month" | "year";

export type SubscriptionReportsLoadingState = "empty" | "error" | "loaded";

export type SubscriptionReportsRuntimeStatus = "needs_attention" | "ready" | "unavailable";

export type SubscriptionReportsBreakdownItem = {
  count: number;
  dataAvailability: "available" | "planned";
  label: string;
};

export type SubscriptionReportsMetrics = {
  activeSubscriptions: number;
  cancelledExpiredSubscriptions: number;
  freeSubscriptions: number;
  newlyActivatedSubscriptions: number;
  paidSubscriptions: number;
  totalSubscriptions: number;
  trialSubscriptions: number;
};

export type SubscriptionReportsSnapshot = {
  dataSources: string[];
  errorMessage: string | null;
  generatedAt: string;
  lastUpdatedAt: string | null;
  loadingState: SubscriptionReportsLoadingState;
  metrics: SubscriptionReportsMetrics;
  rangeLabel: string;
  readOnly: true;
  selectedRange: SubscriptionReportsDateRange;
  source: SubscriptionReportsSource;
  status: SubscriptionReportsRuntimeStatus;
  subscriptionsByPlan: SubscriptionReportsBreakdownItem[];
  subscriptionsByProvider: SubscriptionReportsBreakdownItem[];
  subscriptionsByStatus: SubscriptionReportsBreakdownItem[];
  warnings: string[];
};

export type SubscriptionReportsSummary = {
  lastGeneratedState: string;
  readOnly: true;
  status: SubscriptionReportsRuntimeStatus;
  summary: string;
};

export type SubscriptionReportsValidation = {
  isValid: boolean;
  issues: string[];
};

export const SUBSCRIPTION_REPORTS_SOURCE = "subscription_reports_runtime" as const;

const ACTIVE_STATUSES = new Set(["active", "trialing"]);

const CANCELLED_EXPIRED_STATUSES = new Set([
  "canceled",
  "cancelled",
  "expired",
  "incomplete_expired",
  "unpaid"
]);

type RawRecord = Record<string, unknown>;

function text(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function dateValue(value: unknown) {
  const parsed = Date.parse(text(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function resolveRangeLabel(range: SubscriptionReportsDateRange) {
  switch (range) {
    case "today":
      return "Today";
    case "7d":
      return "Last 7 days";
    case "30d":
      return "Last 30 days";
    case "month":
      return "Current month";
    case "year":
      return "Current year";
    default:
      return "Last 30 days";
  }
}

function resolveRangeStart(range: SubscriptionReportsDateRange) {
  const now = new Date();

  if (range === "today") {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }

  if (range === "7d") {
    return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }

  if (range === "30d") {
    return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  if (range === "month") {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  }

  return new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
}

function isWithinRange(timestamp: string | null | undefined, rangeStart: Date) {
  const value = dateValue(timestamp);

  if (!value) {
    return false;
  }

  return value >= rangeStart.getTime();
}

function asRecords(data: unknown): RawRecord[] {
  return Array.isArray(data) ? (data as RawRecord[]) : [];
}

async function safeAdminSelect(table: string, columns: string) {
  const admin = createAdminClient();

  if (!admin) {
    return {
      records: [] as RawRecord[],
      warning: "Service-role admin access is unavailable. Subscription report aggregates are empty."
    };
  }

  const { data, error } = await admin.from(table as never).select(columns as never).limit(5000);

  if (error) {
    return {
      records: [] as RawRecord[],
      warning: `Subscription report source ${table} could not be loaded safely.`
    };
  }

  return {
    records: asRecords(data),
    warning: null as string | null
  };
}

function incrementBreakdown(map: Map<string, SubscriptionReportsBreakdownItem>, label: string) {
  const key = label || "unknown";
  const current = map.get(key) ?? {
    count: 0,
    dataAvailability: "available" as const,
    label: key
  };

  map.set(key, {
    ...current,
    count: current.count + 1
  });
}

function normalizeProvider(value: unknown) {
  const cleaned = text(value, "unknown").toLowerCase();

  if (cleaned.includes("stripe")) {
    return "stripe";
  }

  if (cleaned.includes("nowpayments") || cleaned.includes("now_payments")) {
    return "nowpayments";
  }

  if (cleaned.includes("paypal")) {
    return "paypal";
  }

  if (cleaned.includes("manual")) {
    return "manual";
  }

  return cleaned || "unknown";
}

function resolveSubscriptionProvider(
  subscription: RawRecord,
  invoicesByUser: Map<string, RawRecord[]>,
  billingEventsByUser: Map<string, RawRecord[]>
) {
  if (text(subscription.stripe_subscription_id) || text(subscription.stripe_customer_id)) {
    return "stripe";
  }

  const userId = text(subscription.user_id);
  const userInvoices = invoicesByUser.get(userId) ?? [];
  const userEvents = billingEventsByUser.get(userId) ?? [];

  return normalizeProvider(
    text(userInvoices[0]?.provider) || text(userEvents[0]?.provider) || "manual"
  );
}

function buildEmptySnapshot(
  range: SubscriptionReportsDateRange,
  warnings: string[],
  errorMessage: string | null = null
): SubscriptionReportsSnapshot {
  return {
    dataSources: [],
    errorMessage,
    generatedAt: new Date().toISOString(),
    lastUpdatedAt: null,
    loadingState: errorMessage ? "error" : warnings.length ? "empty" : "loaded",
    metrics: {
      activeSubscriptions: 0,
      cancelledExpiredSubscriptions: 0,
      freeSubscriptions: 0,
      newlyActivatedSubscriptions: 0,
      paidSubscriptions: 0,
      totalSubscriptions: 0,
      trialSubscriptions: 0
    },
    rangeLabel: resolveRangeLabel(range),
    readOnly: true,
    selectedRange: range,
    source: SUBSCRIPTION_REPORTS_SOURCE,
    status: errorMessage ? "unavailable" : warnings.length ? "needs_attention" : "ready",
    subscriptionsByPlan: [],
    subscriptionsByProvider: [],
    subscriptionsByStatus: [],
    warnings
  };
}

export async function runSubscriptionReportsSnapshot(
  range: SubscriptionReportsDateRange = "30d"
): Promise<SubscriptionReportsSnapshot> {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    return buildEmptySnapshot(range, ["Super Admin access is required for Subscription Reports runtime."]);
  }

  const selectedRange = range;
  const rangeStart = resolveRangeStart(selectedRange);
  const warnings: string[] = [];
  const dataSources: string[] = [];
  let lastUpdatedAt: string | null = null;

  try {
    const [subscriptionsResult, invoicesResult, billingEventsResult] = await Promise.all([
      safeAdminSelect(
        "user_subscriptions",
        "id, user_id, plan_id, status, stripe_customer_id, stripe_subscription_id, current_period_start, current_period_end, cancel_at_period_end, created_at, updated_at"
      ),
      safeAdminSelect("invoices", "user_id, provider, status, created_at, updated_at"),
      safeAdminSelect("billing_events", "user_id, provider, event_type, processed_at, created_at")
    ]);

    for (const result of [subscriptionsResult, invoicesResult, billingEventsResult]) {
      if (result.warning) {
        warnings.push(result.warning);
      }
    }

    if (subscriptionsResult.records.length) {
      dataSources.push("user_subscriptions");
    }

    if (invoicesResult.records.length) {
      dataSources.push("invoices");
    }

    if (billingEventsResult.records.length) {
      dataSources.push("billing_events");
    }

    const invoicesByUser = new Map<string, RawRecord[]>();

    for (const invoice of invoicesResult.records) {
      const userId = text(invoice.user_id);

      if (!userId) {
        continue;
      }

      invoicesByUser.set(userId, [...(invoicesByUser.get(userId) ?? []), invoice]);
    }

    const billingEventsByUser = new Map<string, RawRecord[]>();

    for (const event of billingEventsResult.records) {
      const userId = text(event.user_id);

      if (!userId) {
        continue;
      }

      billingEventsByUser.set(userId, [...(billingEventsByUser.get(userId) ?? []), event]);
    }

    const subscriptionsByPlan = new Map<string, SubscriptionReportsBreakdownItem>();
    const subscriptionsByStatus = new Map<string, SubscriptionReportsBreakdownItem>();
    const subscriptionsByProvider = new Map<string, SubscriptionReportsBreakdownItem>();

    let activeSubscriptions = 0;
    let freeSubscriptions = 0;
    let paidSubscriptions = 0;
    let newlyActivatedSubscriptions = 0;
    let cancelledExpiredSubscriptions = 0;
    let trialSubscriptions = 0;

    for (const subscription of subscriptionsResult.records) {
      const planId = text(subscription.plan_id, "free");
      const plan = getBillingPlan(planId);
      const status = text(subscription.status, "active").toLowerCase();
      const provider = resolveSubscriptionProvider(subscription, invoicesByUser, billingEventsByUser);
      const activationAt =
        text(subscription.current_period_start) ||
        text(subscription.created_at) ||
        text(subscription.updated_at);
      const updatedAt =
        text(subscription.updated_at) ||
        text(subscription.current_period_end) ||
        text(subscription.created_at);

      if (updatedAt && (!lastUpdatedAt || dateValue(updatedAt) > dateValue(lastUpdatedAt))) {
        lastUpdatedAt = updatedAt;
      }

      incrementBreakdown(subscriptionsByPlan, plan.name);
      incrementBreakdown(subscriptionsByStatus, status);
      incrementBreakdown(subscriptionsByProvider, provider);

      if (ACTIVE_STATUSES.has(status)) {
        activeSubscriptions += 1;
      }

      if (planId === "free") {
        freeSubscriptions += 1;
      } else if (ACTIVE_STATUSES.has(status)) {
        paidSubscriptions += 1;
      }

      if (status === "trialing") {
        trialSubscriptions += 1;
      }

      if (
        CANCELLED_EXPIRED_STATUSES.has(status) ||
        subscription.cancel_at_period_end === true
      ) {
        cancelledExpiredSubscriptions += 1;
      }

      if (isWithinRange(activationAt, rangeStart)) {
        newlyActivatedSubscriptions += 1;
      }
    }

    const totalSubscriptions = subscriptionsResult.records.length;

    if (!invoicesResult.records.length && !billingEventsResult.records.length) {
      warnings.push("Provider breakdown uses subscription linkage defaults because billing rows are unavailable.");
    }

    const status: SubscriptionReportsRuntimeStatus =
      warnings.length || cancelledExpiredSubscriptions > 0
        ? "needs_attention"
        : dataSources.length
          ? "ready"
          : "unavailable";

    return {
      dataSources,
      errorMessage: null,
      generatedAt: new Date().toISOString(),
      lastUpdatedAt,
      loadingState: dataSources.length ? "loaded" : "empty",
      metrics: {
        activeSubscriptions,
        cancelledExpiredSubscriptions,
        freeSubscriptions,
        newlyActivatedSubscriptions,
        paidSubscriptions,
        totalSubscriptions,
        trialSubscriptions
      },
      rangeLabel: resolveRangeLabel(selectedRange),
      readOnly: true,
      selectedRange,
      source: SUBSCRIPTION_REPORTS_SOURCE,
      status,
      subscriptionsByPlan: [...subscriptionsByPlan.values()].sort((left, right) => right.count - left.count),
      subscriptionsByProvider: [...subscriptionsByProvider.values()].sort(
        (left, right) => right.count - left.count
      ),
      subscriptionsByStatus: [...subscriptionsByStatus.values()].sort((left, right) => right.count - left.count),
      warnings
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Subscription Reports runtime failed to load safely.";

    return buildEmptySnapshot(selectedRange, [], message);
  }
}

export function getSubscriptionReportsSummary(snapshot: SubscriptionReportsSnapshot): SubscriptionReportsSummary {
  return {
    lastGeneratedState: snapshot.lastUpdatedAt
      ? `Generated ${snapshot.generatedAt}; latest subscription activity ${snapshot.lastUpdatedAt}`
      : `Generated ${snapshot.generatedAt}; no subscription activity timestamps recorded`,
    readOnly: true,
    status: snapshot.status,
    summary: [
      `status ${snapshot.status}`,
      `${snapshot.rangeLabel}`,
      `${snapshot.metrics.totalSubscriptions} total subscriptions`,
      `${snapshot.metrics.activeSubscriptions} active`,
      `${snapshot.metrics.paidSubscriptions} paid`,
      `${snapshot.metrics.newlyActivatedSubscriptions} newly activated in range`
    ].join("; ")
  };
}

export function validateSubscriptionReportsRuntime(
  snapshot: SubscriptionReportsSnapshot
): SubscriptionReportsValidation {
  const issues: string[] = [];

  if (!snapshot.readOnly) {
    issues.push("Subscription Reports runtime must remain read-only.");
  }

  if (snapshot.source !== SUBSCRIPTION_REPORTS_SOURCE) {
    issues.push("Subscription Reports runtime must originate from the subscription reports runtime.");
  }

  if (!snapshot.generatedAt) {
    issues.push("Subscription Reports runtime must include generatedAt.");
  }

  if (snapshot.metrics.totalSubscriptions < 0) {
    issues.push("Subscription Reports total subscription count must not be negative.");
  }

  return {
    isValid: issues.length === 0,
    issues
  };
}

export async function mapSubscriptionReportsRuntimeToAdminFields(
  range: SubscriptionReportsDateRange = "30d"
) {
  const snapshot = await runSubscriptionReportsSnapshot(range);
  const validation = validateSubscriptionReportsRuntime(snapshot);
  const summary = getSubscriptionReportsSummary(snapshot);

  return {
    errorMessage: snapshot.errorMessage,
    generatedAt: snapshot.generatedAt,
    lastGeneratedState: summary.lastGeneratedState,
    lastUpdatedAt: snapshot.lastUpdatedAt,
    loadingState: snapshot.loadingState,
    metrics: snapshot.metrics,
    rangeLabel: snapshot.rangeLabel,
    readOnly: true as const,
    selectedRange: snapshot.selectedRange,
    status: validation.isValid ? summary.status : ("needs_attention" as const),
    subscriptionsByPlan: snapshot.subscriptionsByPlan,
    subscriptionsByProvider: snapshot.subscriptionsByProvider,
    subscriptionsByStatus: snapshot.subscriptionsByStatus,
    summary: validation.isValid
      ? summary.summary
      : "Subscription Reports runtime validation requires safe read-only defaults.",
    warnings: [...snapshot.warnings, ...validation.issues]
  };
}
