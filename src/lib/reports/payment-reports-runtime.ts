import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";

export type PaymentReportsSource = "payment_reports_runtime";

export type PaymentReportsDateRange = "today" | "7d" | "30d" | "month" | "year";

export type PaymentReportsLoadingState = "empty" | "error" | "loaded";

export type PaymentReportsRuntimeStatus = "needs_attention" | "ready" | "unavailable";

export type PaymentReportsBreakdownItem = {
  count: number;
  dataAvailability: "available" | "planned";
  label: string;
};

export type PaymentReportsProviderBreakdown = {
  count: number;
  dataAvailability: "available" | "planned";
  failedPayments: number;
  paymentVolume: number;
  provider: string;
  successfulPayments: number;
};

export type PaymentReportsCurrencyBreakdown = {
  count: number;
  currency: string;
  dataAvailability: "available" | "planned";
  paymentVolume: number;
};

export type PaymentReportsActivityItem = {
  activityAt: string;
  amountLabel: string;
  dataAvailability: "available" | "planned";
  provider: string;
  source: string;
  status: string;
};

export type PaymentReportsMetrics = {
  cancelledPayments: number;
  failedPayments: number;
  paymentVolume: number;
  pendingPayments: number;
  refundedPayments: number;
  successfulPayments: number;
  totalPayments: number;
};

export type PaymentReportsSnapshot = {
  dataSources: string[];
  errorMessage: string | null;
  generatedAt: string;
  lastUpdatedAt: string | null;
  latestPaymentActivity: PaymentReportsActivityItem[];
  loadingState: PaymentReportsLoadingState;
  metrics: PaymentReportsMetrics;
  paymentsByCurrency: PaymentReportsCurrencyBreakdown[];
  paymentsByProvider: PaymentReportsProviderBreakdown[];
  paymentsByStatus: PaymentReportsBreakdownItem[];
  rangeLabel: string;
  readOnly: true;
  selectedRange: PaymentReportsDateRange;
  source: PaymentReportsSource;
  status: PaymentReportsRuntimeStatus;
  warnings: string[];
};

export type PaymentReportsSummary = {
  lastGeneratedState: string;
  readOnly: true;
  status: PaymentReportsRuntimeStatus;
  summary: string;
};

export type PaymentReportsValidation = {
  isValid: boolean;
  issues: string[];
};

export const PAYMENT_REPORTS_SOURCE = "payment_reports_runtime" as const;

type PaymentClassification = "cancelled" | "failed" | "pending" | "refunded" | "successful" | "other";

type NormalizedPayment = {
  activityAt: string;
  amount: number;
  classification: PaymentClassification;
  currency: string;
  provider: string;
  rawStatus: string;
  source: string;
};

const SUCCESS_PAYMENT_STATUSES = new Set(["paid", "succeeded", "success", "completed", "confirmed"]);

const FAILED_PAYMENT_STATUSES = new Set([
  "declined",
  "failed",
  "payment_failed",
  "uncollectible",
  "void"
]);

const PENDING_PAYMENT_STATUSES = new Set([
  "draft",
  "new",
  "open",
  "pending",
  "processing",
  "requires_action",
  "requires_payment_method",
  "unpaid"
]);

const REFUNDED_PAYMENT_STATUSES = new Set(["refunded"]);

const CANCELLED_PAYMENT_STATUSES = new Set(["canceled", "cancelled"]);

const PAYMENT_EVENT_KEYWORDS = [
  "charge",
  "checkout",
  "invoice",
  "payment",
  "payout",
  "refund",
  "subscription"
];

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

  if (cleaned.includes("nowpayments") || cleaned.includes("now_payments") || cleaned.includes("crypto")) {
    return "nowpayments";
  }

  if (cleaned.includes("paypal")) {
    return "paypal";
  }

  if (cleaned.includes("manual") || cleaned.includes("whatsapp") || cleaned.includes("cod")) {
    return "manual";
  }

  return cleaned || "unknown";
}

function normalizeCurrency(value: unknown) {
  const cleaned = text(value, "USD").toUpperCase();
  return /^[A-Z]{3}$/.test(cleaned) ? cleaned : "USD";
}

function maskAmount(currency: string, amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) {
    return `${currency} —`;
  }

  return `${currency} ${amount.toFixed(2)}`;
}

function classifyPaymentStatus(status: string, secondaryStatus?: string) {
  const normalized = status.toLowerCase();
  const secondary = secondaryStatus?.toLowerCase() ?? "";

  if (SUCCESS_PAYMENT_STATUSES.has(normalized)) {
    return "successful" as const;
  }

  if (FAILED_PAYMENT_STATUSES.has(normalized)) {
    return "failed" as const;
  }

  if (REFUNDED_PAYMENT_STATUSES.has(normalized)) {
    return "refunded" as const;
  }

  if (CANCELLED_PAYMENT_STATUSES.has(normalized) || CANCELLED_PAYMENT_STATUSES.has(secondary)) {
    return "cancelled" as const;
  }

  if (PENDING_PAYMENT_STATUSES.has(normalized)) {
    return "pending" as const;
  }

  return "other" as const;
}

function classifyBillingEvent(eventType: string) {
  const normalized = eventType.toLowerCase();

  if (
    normalized.includes("payment_failed") ||
    normalized.includes("invoice_payment_failed") ||
    normalized.includes("charge_failed")
  ) {
    return "failed" as const;
  }

  if (
    normalized.includes("payment_succeeded") ||
    normalized.includes("invoice_paid") ||
    normalized.includes("charge_succeeded") ||
    normalized.includes("checkout.session.completed")
  ) {
    return "successful" as const;
  }

  if (normalized.includes("refund")) {
    return "refunded" as const;
  }

  if (normalized.includes("cancel")) {
    return "cancelled" as const;
  }

  if (normalized.includes("pending") || normalized.includes("processing")) {
    return "pending" as const;
  }

  return "other" as const;
}

function isPaymentRelatedEvent(eventType: string) {
  const normalized = eventType.toLowerCase();
  return PAYMENT_EVENT_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

function resolveRangeLabel(range: PaymentReportsDateRange) {
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

function resolveRangeStart(range: PaymentReportsDateRange) {
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
      warning: "Service-role admin access is unavailable. Payment report aggregates are empty."
    };
  }

  const { data, error } = await admin.from(table as never).select(columns as never).limit(5000);

  if (error) {
    return {
      records: [] as RawRecord[],
      warning: `Payment report source ${table} could not be loaded safely.`
    };
  }

  return {
    records: asRecords(data),
    warning: null as string | null
  };
}

function incrementStatusBreakdown(map: Map<string, PaymentReportsBreakdownItem>, label: string) {
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

function incrementProviderBreakdown(
  map: Map<string, PaymentReportsProviderBreakdown>,
  provider: string,
  update: Partial<PaymentReportsProviderBreakdown>
) {
  const key = normalizeProvider(provider);
  const current = map.get(key) ?? {
    count: 0,
    dataAvailability: "available" as const,
    failedPayments: 0,
    paymentVolume: 0,
    provider: key,
    successfulPayments: 0
  };

  map.set(key, {
    ...current,
    count: current.count + (update.count ?? 0),
    failedPayments: current.failedPayments + (update.failedPayments ?? 0),
    paymentVolume: current.paymentVolume + (update.paymentVolume ?? 0),
    successfulPayments: current.successfulPayments + (update.successfulPayments ?? 0)
  });
}

function incrementCurrencyBreakdown(
  map: Map<string, PaymentReportsCurrencyBreakdown>,
  currency: string,
  update: Partial<PaymentReportsCurrencyBreakdown>
) {
  const key = normalizeCurrency(currency);
  const current = map.get(key) ?? {
    count: 0,
    currency: key,
    dataAvailability: "available" as const,
    paymentVolume: 0
  };

  map.set(key, {
    ...current,
    count: current.count + (update.count ?? 0),
    paymentVolume: current.paymentVolume + (update.paymentVolume ?? 0)
  });
}

function normalizeCommerceOrder(order: RawRecord): NormalizedPayment | null {
  const activityAt = text(order.created_at) || text(order.updated_at);

  if (!activityAt) {
    return null;
  }

  const paymentStatus = text(order.payment_status, "pending");
  const orderStatus = text(order.status);
  const classification = classifyPaymentStatus(paymentStatus, orderStatus);

  return {
    activityAt,
    amount: numberValue(order.total_amount),
    classification,
    currency: normalizeCurrency(order.currency),
    provider: normalizeProvider(order.payment_method),
    rawStatus: paymentStatus,
    source: "commerce_checkout"
  };
}

function normalizeStoreOrder(order: RawRecord): NormalizedPayment | null {
  const activityAt = text(order.created_at) || text(order.updated_at);

  if (!activityAt) {
    return null;
  }

  const paymentStatus = text(order.payment_status, "pending");
  const orderStatus = text(order.order_status);
  const classification = classifyPaymentStatus(paymentStatus, orderStatus);

  return {
    activityAt,
    amount: numberValue(order.total),
    classification,
    currency: "USD",
    provider: normalizeProvider(order.payment_method),
    rawStatus: paymentStatus,
    source: "store_checkout"
  };
}

function normalizeInvoice(invoice: RawRecord): NormalizedPayment | null {
  const activityAt =
    text(invoice.paid_at) || text(invoice.issued_at) || text(invoice.updated_at) || text(invoice.created_at);

  if (!activityAt) {
    return null;
  }

  const status = text(invoice.status, "unknown");
  const classification = classifyPaymentStatus(status);
  const paidAmount = numberValue(invoice.amount_paid) / 100;

  return {
    activityAt,
    amount: paidAmount > 0 ? paidAmount : numberValue(invoice.amount_due) / 100,
    classification,
    currency: normalizeCurrency(invoice.currency),
    provider: normalizeProvider(invoice.provider),
    rawStatus: status,
    source: "platform_invoice"
  };
}

function normalizeBillingEvent(event: RawRecord): NormalizedPayment | null {
  const eventType = text(event.event_type);

  if (!eventType || !isPaymentRelatedEvent(eventType)) {
    return null;
  }

  const activityAt = text(event.processed_at) || text(event.created_at);

  if (!activityAt) {
    return null;
  }

  return {
    activityAt,
    amount: 0,
    classification: classifyBillingEvent(eventType),
    currency: "USD",
    provider: normalizeProvider(event.provider),
    rawStatus: eventType,
    source: "provider_event_log"
  };
}

function buildEmptySnapshot(
  range: PaymentReportsDateRange,
  warnings: string[],
  errorMessage: string | null = null
): PaymentReportsSnapshot {
  return {
    dataSources: [],
    errorMessage,
    generatedAt: new Date().toISOString(),
    lastUpdatedAt: null,
    latestPaymentActivity: [],
    loadingState: errorMessage ? "error" : warnings.length ? "empty" : "loaded",
    metrics: {
      cancelledPayments: 0,
      failedPayments: 0,
      paymentVolume: 0,
      pendingPayments: 0,
      refundedPayments: 0,
      successfulPayments: 0,
      totalPayments: 0
    },
    paymentsByCurrency: [],
    paymentsByProvider: [],
    paymentsByStatus: [],
    rangeLabel: resolveRangeLabel(range),
    readOnly: true,
    selectedRange: range,
    source: PAYMENT_REPORTS_SOURCE,
    status: errorMessage ? "unavailable" : warnings.length ? "needs_attention" : "ready",
    warnings
  };
}

export async function runPaymentReportsSnapshot(
  range: PaymentReportsDateRange = "30d"
): Promise<PaymentReportsSnapshot> {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    return buildEmptySnapshot(range, ["Super Admin access is required for Payment Reports runtime."]);
  }

  const selectedRange = range;
  const rangeStart = resolveRangeStart(selectedRange);
  const warnings: string[] = [];
  const dataSources: string[] = [];
  let lastUpdatedAt: string | null = null;

  try {
    const [commerceOrdersResult, storeOrdersResult, invoicesResult, billingEventsResult] = await Promise.all([
      safeAdminSelect(
        "commerce_orders",
        "id, payment_status, payment_method, currency, total_amount, status, created_at, updated_at"
      ),
      safeAdminSelect(
        "store_orders",
        "id, payment_status, payment_method, total, order_status, created_at, updated_at"
      ),
      safeAdminSelect(
        "invoices",
        "id, provider, status, amount_due, amount_paid, currency, paid_at, issued_at, created_at, updated_at"
      ),
      safeAdminSelect("billing_events", "id, provider, event_type, processed_at, created_at")
    ]);

    for (const result of [commerceOrdersResult, storeOrdersResult, invoicesResult, billingEventsResult]) {
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

    const normalizedPayments: NormalizedPayment[] = [];

    for (const order of commerceOrdersResult.records) {
      const payment = normalizeCommerceOrder(order);

      if (payment && isWithinRange(payment.activityAt, rangeStart)) {
        normalizedPayments.push(payment);
      }
    }

    for (const order of storeOrdersResult.records) {
      const payment = normalizeStoreOrder(order);

      if (payment && isWithinRange(payment.activityAt, rangeStart)) {
        normalizedPayments.push(payment);
      }
    }

    for (const invoice of invoicesResult.records) {
      const payment = normalizeInvoice(invoice);

      if (payment && isWithinRange(payment.activityAt, rangeStart)) {
        normalizedPayments.push(payment);
      }
    }

    for (const event of billingEventsResult.records) {
      const payment = normalizeBillingEvent(event);

      if (payment && isWithinRange(payment.activityAt, rangeStart)) {
        normalizedPayments.push(payment);
      }
    }

    if (invoicesResult.records.length && billingEventsResult.records.length) {
      warnings.push(
        "Provider event logs may overlap platform invoice rows. Totals remain read-only aggregates across safe sources."
      );
    }

    if (storeOrdersResult.records.length && !commerceOrdersResult.records.length) {
      warnings.push("Store checkout currency defaults to USD when checkout currency metadata is unavailable.");
    }

    const paymentsByStatus = new Map<string, PaymentReportsBreakdownItem>();
    const paymentsByProvider = new Map<string, PaymentReportsProviderBreakdown>();
    const paymentsByCurrency = new Map<string, PaymentReportsCurrencyBreakdown>();

    let totalPayments = 0;
    let successfulPayments = 0;
    let failedPayments = 0;
    let pendingPayments = 0;
    let cancelledPayments = 0;
    let refundedPayments = 0;
    let paymentVolume = 0;

    for (const payment of normalizedPayments) {
      totalPayments += 1;

      if (payment.activityAt && (!lastUpdatedAt || dateValue(payment.activityAt) > dateValue(lastUpdatedAt))) {
        lastUpdatedAt = payment.activityAt;
      }

      incrementStatusBreakdown(paymentsByStatus, payment.classification);
      incrementProviderBreakdown(paymentsByProvider, payment.provider, {
        count: 1,
        failedPayments: payment.classification === "failed" ? 1 : 0,
        paymentVolume: payment.classification === "successful" ? payment.amount : 0,
        successfulPayments: payment.classification === "successful" ? 1 : 0
      });
      incrementCurrencyBreakdown(paymentsByCurrency, payment.currency, {
        count: 1,
        paymentVolume: payment.classification === "successful" ? payment.amount : 0
      });

      if (payment.classification === "successful") {
        successfulPayments += 1;
        paymentVolume += payment.amount;
      } else if (payment.classification === "failed") {
        failedPayments += 1;
      } else if (payment.classification === "pending") {
        pendingPayments += 1;
      } else if (payment.classification === "cancelled") {
        cancelledPayments += 1;
      } else if (payment.classification === "refunded") {
        refundedPayments += 1;
      }
    }

    const latestPaymentActivity = [...normalizedPayments]
      .sort((left, right) => dateValue(right.activityAt) - dateValue(left.activityAt))
      .slice(0, 8)
      .map((payment) => ({
        activityAt: payment.activityAt,
        amountLabel: maskAmount(payment.currency, payment.classification === "successful" ? payment.amount : 0),
        dataAvailability: payment.source === "store_checkout" && payment.currency === "USD"
          ? ("planned" as const)
          : ("available" as const),
        provider: payment.provider,
        source: payment.source,
        status: payment.rawStatus
      }));

    const status: PaymentReportsRuntimeStatus =
      warnings.length || failedPayments > 0
        ? "needs_attention"
        : dataSources.length
          ? "ready"
          : "unavailable";

    return {
      dataSources,
      errorMessage: null,
      generatedAt: new Date().toISOString(),
      lastUpdatedAt,
      latestPaymentActivity,
      loadingState: dataSources.length ? "loaded" : "empty",
      metrics: {
        cancelledPayments,
        failedPayments,
        paymentVolume,
        pendingPayments,
        refundedPayments,
        successfulPayments,
        totalPayments
      },
      paymentsByCurrency: [...paymentsByCurrency.values()].sort(
        (left, right) => right.paymentVolume - left.paymentVolume
      ),
      paymentsByProvider: [...paymentsByProvider.values()].sort((left, right) => right.count - left.count),
      paymentsByStatus: [...paymentsByStatus.values()].sort((left, right) => right.count - left.count),
      rangeLabel: resolveRangeLabel(selectedRange),
      readOnly: true,
      selectedRange,
      source: PAYMENT_REPORTS_SOURCE,
      status,
      warnings
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Payment Reports runtime failed to load safely.";

    return buildEmptySnapshot(selectedRange, [], message);
  }
}

export function getPaymentReportsSummary(snapshot: PaymentReportsSnapshot): PaymentReportsSummary {
  return {
    lastGeneratedState: snapshot.lastUpdatedAt
      ? `Generated ${snapshot.generatedAt}; latest payment activity ${snapshot.lastUpdatedAt}`
      : `Generated ${snapshot.generatedAt}; no payment activity timestamps recorded`,
    readOnly: true,
    status: snapshot.status,
    summary: [
      `status ${snapshot.status}`,
      `${snapshot.rangeLabel}`,
      `${snapshot.metrics.totalPayments} total payments`,
      `${snapshot.metrics.successfulPayments} successful`,
      `${snapshot.metrics.failedPayments} failed`,
      `${snapshot.metrics.paymentVolume.toFixed(2)} payment volume`
    ].join("; ")
  };
}

export function validatePaymentReportsRuntime(snapshot: PaymentReportsSnapshot): PaymentReportsValidation {
  const issues: string[] = [];

  if (!snapshot.readOnly) {
    issues.push("Payment Reports runtime must remain read-only.");
  }

  if (snapshot.source !== PAYMENT_REPORTS_SOURCE) {
    issues.push("Payment Reports runtime must originate from the payment reports runtime.");
  }

  if (!snapshot.generatedAt) {
    issues.push("Payment Reports runtime must include generatedAt.");
  }

  if (snapshot.metrics.totalPayments < 0 || snapshot.metrics.paymentVolume < 0) {
    issues.push("Payment Reports totals must not be negative.");
  }

  return {
    isValid: issues.length === 0,
    issues
  };
}

export async function mapPaymentReportsRuntimeToAdminFields(range: PaymentReportsDateRange = "30d") {
  const snapshot = await runPaymentReportsSnapshot(range);
  const validation = validatePaymentReportsRuntime(snapshot);
  const summary = getPaymentReportsSummary(snapshot);

  return {
    errorMessage: snapshot.errorMessage,
    generatedAt: snapshot.generatedAt,
    lastGeneratedState: summary.lastGeneratedState,
    lastUpdatedAt: snapshot.lastUpdatedAt,
    latestPaymentActivity: snapshot.latestPaymentActivity,
    loadingState: snapshot.loadingState,
    metrics: snapshot.metrics,
    paymentsByCurrency: snapshot.paymentsByCurrency,
    paymentsByProvider: snapshot.paymentsByProvider,
    paymentsByStatus: snapshot.paymentsByStatus,
    rangeLabel: snapshot.rangeLabel,
    readOnly: true as const,
    selectedRange: snapshot.selectedRange,
    status: validation.isValid ? summary.status : ("needs_attention" as const),
    summary: validation.isValid
      ? summary.summary
      : "Payment Reports runtime validation requires safe read-only defaults.",
    warnings: [...snapshot.warnings, ...validation.issues]
  };
}
