import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { getBillingPlan } from "@/lib/billing/plans";
import { createAdminClient } from "@/lib/supabase/admin";

export type RevenueReportsSource = "revenue_reports_runtime";

export type RevenueReportsDateRange = "today" | "7d" | "30d" | "month" | "year";

export type RevenueReportsLoadingState = "empty" | "error" | "loaded";

export type RevenueReportsRuntimeStatus = "needs_attention" | "ready" | "unavailable";

export type RevenueReportsProviderBreakdown = {
  dataAvailability: "available" | "planned";
  failedPayments: number;
  provider: string;
  refundedOrCancelledPayments: number;
  revenueAmount: number;
  successfulPayments: number;
};

export type RevenueReportsCurrencyBreakdown = {
  commerceOrderRevenue: number;
  currency: string;
  dataAvailability: "available" | "planned";
  invoiceRevenue: number;
  totalRevenue: number;
};

export type RevenueReportsMetrics = {
  commerceOrderRevenue: number;
  failedPayments: number;
  refundedOrCancelledPayments: number;
  subscriptionRevenue: number;
  successfulPayments: number;
  totalRevenue: number;
};

export type RevenueReportsSnapshot = {
  currencyBreakdown: RevenueReportsCurrencyBreakdown[];
  dataSources: string[];
  errorMessage: string | null;
  generatedAt: string;
  lastUpdatedAt: string | null;
  loadingState: RevenueReportsLoadingState;
  metrics: RevenueReportsMetrics;
  providerBreakdown: RevenueReportsProviderBreakdown[];
  rangeLabel: string;
  readOnly: true;
  selectedRange: RevenueReportsDateRange;
  source: RevenueReportsSource;
  status: RevenueReportsRuntimeStatus;
  warnings: string[];
};

export type RevenueReportsSummary = {
  lastGeneratedState: string;
  readOnly: true;
  status: RevenueReportsRuntimeStatus;
  summary: string;
};

export type RevenueReportsValidation = {
  isValid: boolean;
  issues: string[];
};

export const REVENUE_REPORTS_SOURCE = "revenue_reports_runtime" as const;

const SUCCESS_ORDER_STATUSES = new Set([
  "completed",
  "confirmed",
  "delivered",
  "paid",
  "processed",
  "success"
]);

const FAILED_ORDER_STATUSES = new Set(["declined", "failed", "payment_failed", "uncollectible"]);

const REFUNDED_ORDER_STATUSES = new Set(["canceled", "cancelled", "refunded", "void"]);

const SUCCESS_INVOICE_STATUSES = new Set(["paid", "succeeded"]);

const FAILED_INVOICE_STATUSES = new Set(["failed", "uncollectible", "void"]);

const REFUNDED_INVOICE_STATUSES = new Set(["refunded"]);

type RawRecord = Record<string, unknown>;

function text(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function numberValue(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateValue(value: unknown) {
  const parsed = Date.parse(text(value));
  return Number.isFinite(parsed) ? parsed : 0;
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

function normalizeCurrency(value: unknown) {
  const cleaned = text(value, "USD").toUpperCase();
  return /^[A-Z]{3}$/.test(cleaned) ? cleaned : "USD";
}

function classifyOrderStatus(status: string) {
  const normalized = status.toLowerCase();

  if (SUCCESS_ORDER_STATUSES.has(normalized)) {
    return "successful" as const;
  }

  if (FAILED_ORDER_STATUSES.has(normalized)) {
    return "failed" as const;
  }

  if (REFUNDED_ORDER_STATUSES.has(normalized)) {
    return "refunded_or_cancelled" as const;
  }

  return "other" as const;
}

function classifyInvoiceStatus(status: string) {
  const normalized = status.toLowerCase();

  if (SUCCESS_INVOICE_STATUSES.has(normalized)) {
    return "successful" as const;
  }

  if (FAILED_INVOICE_STATUSES.has(normalized)) {
    return "failed" as const;
  }

  if (REFUNDED_INVOICE_STATUSES.has(normalized)) {
    return "refunded_or_cancelled" as const;
  }

  return "other" as const;
}

function resolveRangeLabel(range: RevenueReportsDateRange) {
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

function resolveRangeStart(range: RevenueReportsDateRange) {
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
      warning: "Service-role admin access is unavailable. Revenue report aggregates are empty."
    };
  }

  const { data, error } = await admin.from(table as never).select(columns as never).limit(5000);

  if (error) {
    return {
      records: [] as RawRecord[],
      warning: `Revenue report source ${table} could not be loaded safely.`
    };
  }

  return {
    records: asRecords(data),
    warning: null as string | null
  };
}

function incrementProviderBreakdown(
  breakdown: Map<string, RevenueReportsProviderBreakdown>,
  provider: string,
  update: Partial<RevenueReportsProviderBreakdown>
) {
  const key = normalizeProvider(provider);
  const current = breakdown.get(key) ?? {
    dataAvailability: "available" as const,
    failedPayments: 0,
    provider: key,
    refundedOrCancelledPayments: 0,
    revenueAmount: 0,
    successfulPayments: 0
  };

  breakdown.set(key, {
    ...current,
    failedPayments: current.failedPayments + (update.failedPayments ?? 0),
    refundedOrCancelledPayments:
      current.refundedOrCancelledPayments + (update.refundedOrCancelledPayments ?? 0),
    revenueAmount: current.revenueAmount + (update.revenueAmount ?? 0),
    successfulPayments: current.successfulPayments + (update.successfulPayments ?? 0)
  });
}

function incrementCurrencyBreakdown(
  breakdown: Map<string, RevenueReportsCurrencyBreakdown>,
  currency: string,
  update: Partial<RevenueReportsCurrencyBreakdown>
) {
  const key = normalizeCurrency(currency);
  const current = breakdown.get(key) ?? {
    commerceOrderRevenue: 0,
    currency: key,
    dataAvailability: "available" as const,
    invoiceRevenue: 0,
    totalRevenue: 0
  };

  const commerceOrderRevenue = current.commerceOrderRevenue + (update.commerceOrderRevenue ?? 0);
  const invoiceRevenue = current.invoiceRevenue + (update.invoiceRevenue ?? 0);

  breakdown.set(key, {
    commerceOrderRevenue,
    currency: key,
    dataAvailability: "available",
    invoiceRevenue,
    totalRevenue: commerceOrderRevenue + invoiceRevenue
  });
}

function buildEmptySnapshot(
  range: RevenueReportsDateRange,
  warnings: string[],
  errorMessage: string | null = null
): RevenueReportsSnapshot {
  return {
    currencyBreakdown: [],
    dataSources: [],
    errorMessage,
    generatedAt: new Date().toISOString(),
    lastUpdatedAt: null,
    loadingState: errorMessage ? "error" : warnings.length ? "empty" : "loaded",
    metrics: {
      commerceOrderRevenue: 0,
      failedPayments: 0,
      refundedOrCancelledPayments: 0,
      subscriptionRevenue: 0,
      successfulPayments: 0,
      totalRevenue: 0
    },
    providerBreakdown: [],
    rangeLabel: resolveRangeLabel(range),
    readOnly: true,
    selectedRange: range,
    source: REVENUE_REPORTS_SOURCE,
    status: errorMessage ? "unavailable" : warnings.length ? "needs_attention" : "ready",
    warnings
  };
}

export async function runRevenueReportsSnapshot(
  range: RevenueReportsDateRange = "30d"
): Promise<RevenueReportsSnapshot> {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    return buildEmptySnapshot(range, ["Super Admin access is required for Revenue Reports runtime."], null);
  }

  const selectedRange = range;
  const rangeStart = resolveRangeStart(selectedRange);
  const warnings: string[] = [];
  const dataSources: string[] = [];
  let lastUpdatedAt: string | null = null;

  try {
    const [commerceOrdersResult, storeOrdersResult, invoicesResult, billingEventsResult, subscriptionsResult] =
      await Promise.all([
        safeAdminSelect(
          "commerce_orders",
          "id, total_amount, total, currency, status, payment_method, created_at, updated_at"
        ),
        safeAdminSelect(
          "store_orders",
          "id, total_amount, total, currency, status, payment_method, created_at, updated_at"
        ),
        safeAdminSelect(
          "invoices",
          "id, provider, status, amount_due, amount_paid, currency, issued_at, paid_at, created_at, updated_at"
        ),
        safeAdminSelect("billing_events", "id, provider, event_type, processed_at, created_at"),
        safeAdminSelect("user_subscriptions", "id, plan_id, status, updated_at, created_at")
      ]);

    for (const result of [
      commerceOrdersResult,
      storeOrdersResult,
      invoicesResult,
      billingEventsResult,
      subscriptionsResult
    ]) {
      if (result.warning) {
        warnings.push(result.warning);
      }
    }

    if (commerceOrdersResult.records.length) {
      dataSources.push("commerce_orders");
    }

    if (storeOrdersResult.records.length) {
      dataSources.push("store_orders");
    }

    if (invoicesResult.records.length) {
      dataSources.push("invoices");
    }

    if (billingEventsResult.records.length) {
      dataSources.push("billing_events");
    }

    if (subscriptionsResult.records.length) {
      dataSources.push("user_subscriptions");
    }

    const providerBreakdown = new Map<string, RevenueReportsProviderBreakdown>();
    const currencyBreakdown = new Map<string, RevenueReportsCurrencyBreakdown>();

    let commerceOrderRevenue = 0;
    let subscriptionRevenue = 0;
    let successfulPayments = 0;
    let failedPayments = 0;
    let refundedOrCancelledPayments = 0;

    const orderSources: Array<RawRecord & { source: string }> = [
      ...commerceOrdersResult.records.map((record) => ({ ...record, source: "commerce_orders" })),
      ...storeOrdersResult.records.map((record) => ({ ...record, source: "store_orders" }))
    ];

    for (const order of orderSources) {
      const createdAt = text(order.created_at) || text(order.updated_at);

      if (!isWithinRange(createdAt, rangeStart)) {
        continue;
      }

      if (createdAt && (!lastUpdatedAt || dateValue(createdAt) > dateValue(lastUpdatedAt))) {
        lastUpdatedAt = createdAt;
      }

      const status = classifyOrderStatus(text(order.status, "unknown"));
      const provider = normalizeProvider(order.payment_method ?? "commerce");
      const currency = normalizeCurrency(order.currency);
      const amount = numberValue(order.total_amount) || numberValue(order.total);

      if (status === "successful") {
        successfulPayments += 1;
        commerceOrderRevenue += amount;
        incrementProviderBreakdown(providerBreakdown, provider, {
          revenueAmount: amount,
          successfulPayments: 1
        });
        incrementCurrencyBreakdown(currencyBreakdown, currency, {
          commerceOrderRevenue: amount
        });
      } else if (status === "failed") {
        failedPayments += 1;
        incrementProviderBreakdown(providerBreakdown, provider, { failedPayments: 1 });
      } else if (status === "refunded_or_cancelled") {
        refundedOrCancelledPayments += 1;
        incrementProviderBreakdown(providerBreakdown, provider, { refundedOrCancelledPayments: 1 });
      }
    }

    for (const invoice of invoicesResult.records) {
      const eventAt =
        text(invoice.paid_at) || text(invoice.issued_at) || text(invoice.updated_at) || text(invoice.created_at);

      if (!isWithinRange(eventAt, rangeStart)) {
        continue;
      }

      if (eventAt && (!lastUpdatedAt || dateValue(eventAt) > dateValue(lastUpdatedAt))) {
        lastUpdatedAt = eventAt;
      }

      const status = classifyInvoiceStatus(text(invoice.status, "unknown"));
      const provider = normalizeProvider(invoice.provider);
      const currency = normalizeCurrency(invoice.currency);
      const paidAmount = numberValue(invoice.amount_paid) / 100;

      if (status === "successful") {
        successfulPayments += 1;
        subscriptionRevenue += paidAmount;
        incrementProviderBreakdown(providerBreakdown, provider, {
          revenueAmount: paidAmount,
          successfulPayments: 1
        });
        incrementCurrencyBreakdown(currencyBreakdown, currency, {
          invoiceRevenue: paidAmount
        });
      } else if (status === "failed") {
        failedPayments += 1;
        incrementProviderBreakdown(providerBreakdown, provider, { failedPayments: 1 });
      } else if (status === "refunded_or_cancelled") {
        refundedOrCancelledPayments += 1;
        incrementProviderBreakdown(providerBreakdown, provider, { refundedOrCancelledPayments: 1 });
      }
    }

    for (const event of billingEventsResult.records) {
      const eventAt = text(event.processed_at) || text(event.created_at);

      if (!isWithinRange(eventAt, rangeStart)) {
        continue;
      }

      const eventType = text(event.event_type).toLowerCase();
      const provider = normalizeProvider(event.provider);

      if (eventType.includes("payment_failed") || eventType.includes("invoice_payment_failed")) {
        failedPayments += 1;
        incrementProviderBreakdown(providerBreakdown, provider, { failedPayments: 1 });
      } else if (eventType.includes("payment_succeeded") || eventType.includes("invoice_paid")) {
        successfulPayments += 1;
        incrementProviderBreakdown(providerBreakdown, provider, { successfulPayments: 1 });
      } else if (eventType.includes("refund") || eventType.includes("cancel")) {
        refundedOrCancelledPayments += 1;
        incrementProviderBreakdown(providerBreakdown, provider, { refundedOrCancelledPayments: 1 });
      }
    }

    const activeSubscriptionRevenue = subscriptionsResult.records.reduce((total, subscription) => {
      const status = text(subscription.status, "active").toLowerCase();
      const planId = text(subscription.plan_id, "free");

      if (!["active", "trialing"].includes(status) || planId === "free") {
        return total;
      }

      return total + getBillingPlan(planId).priceCents / 100;
    }, 0);

    if (!subscriptionRevenue && activeSubscriptionRevenue > 0) {
      subscriptionRevenue = activeSubscriptionRevenue;
      warnings.push("Subscription revenue uses active plan pricing estimate because paid invoice totals are unavailable.");
    }

    const totalRevenue = commerceOrderRevenue + subscriptionRevenue;
    const status: RevenueReportsRuntimeStatus =
      warnings.length || failedPayments > 0 ? "needs_attention" : dataSources.length ? "ready" : "unavailable";

    return {
      currencyBreakdown: [...currencyBreakdown.values()].sort((left, right) => right.totalRevenue - left.totalRevenue),
      dataSources,
      errorMessage: null,
      generatedAt: new Date().toISOString(),
      lastUpdatedAt,
      loadingState: dataSources.length ? "loaded" : "empty",
      metrics: {
        commerceOrderRevenue,
        failedPayments,
        refundedOrCancelledPayments,
        subscriptionRevenue,
        successfulPayments,
        totalRevenue
      },
      providerBreakdown: [...providerBreakdown.values()].sort((left, right) => right.revenueAmount - left.revenueAmount),
      rangeLabel: resolveRangeLabel(selectedRange),
      readOnly: true,
      selectedRange,
      source: REVENUE_REPORTS_SOURCE,
      status,
      warnings
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Revenue Reports runtime failed to load safely.";

    return buildEmptySnapshot(selectedRange, [], message);
  }
}

export function getRevenueReportsSummary(snapshot: RevenueReportsSnapshot): RevenueReportsSummary {
  return {
    lastGeneratedState: snapshot.lastUpdatedAt
      ? `Generated ${snapshot.generatedAt}; latest source activity ${snapshot.lastUpdatedAt}`
      : `Generated ${snapshot.generatedAt}; no in-range source activity`,
    readOnly: true,
    status: snapshot.status,
    summary: [
      `status ${snapshot.status}`,
      `${snapshot.rangeLabel}`,
      `total revenue ${snapshot.metrics.totalRevenue.toFixed(2)}`,
      `${snapshot.metrics.successfulPayments} successful`,
      `${snapshot.metrics.failedPayments} failed`,
      `${snapshot.metrics.refundedOrCancelledPayments} refunded/cancelled`
    ].join("; ")
  };
}

export function validateRevenueReportsRuntime(snapshot: RevenueReportsSnapshot): RevenueReportsValidation {
  const issues: string[] = [];

  if (!snapshot.readOnly) {
    issues.push("Revenue Reports runtime must remain read-only.");
  }

  if (snapshot.source !== REVENUE_REPORTS_SOURCE) {
    issues.push("Revenue Reports runtime must originate from the revenue reports runtime.");
  }

  if (!snapshot.generatedAt) {
    issues.push("Revenue Reports runtime must include generatedAt.");
  }

  if (snapshot.metrics.totalRevenue < 0) {
    issues.push("Revenue Reports total revenue must not be negative.");
  }

  return {
    isValid: issues.length === 0,
    issues
  };
}

export async function mapRevenueReportsRuntimeToAdminFields(range: RevenueReportsDateRange = "30d") {
  const snapshot = await runRevenueReportsSnapshot(range);
  const validation = validateRevenueReportsRuntime(snapshot);
  const summary = getRevenueReportsSummary(snapshot);

  return {
    currencyBreakdown: snapshot.currencyBreakdown,
    errorMessage: snapshot.errorMessage,
    generatedAt: snapshot.generatedAt,
    lastGeneratedState: summary.lastGeneratedState,
    lastUpdatedAt: snapshot.lastUpdatedAt,
    loadingState: snapshot.loadingState,
    metrics: snapshot.metrics,
    providerBreakdown: snapshot.providerBreakdown,
    rangeLabel: snapshot.rangeLabel,
    readOnly: true as const,
    selectedRange: snapshot.selectedRange,
    status: validation.isValid ? summary.status : ("needs_attention" as const),
    summary: validation.isValid ? summary.summary : "Revenue Reports runtime validation requires safe read-only defaults.",
    warnings: [...snapshot.warnings, ...validation.issues]
  };
}
