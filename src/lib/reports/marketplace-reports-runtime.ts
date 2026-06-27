import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { maskSensitiveText } from "@/lib/integrations/safe-diagnostics";
import { createAdminClient } from "@/lib/supabase/admin";

export type MarketplaceReportsSource = "marketplace_reports_runtime";

export type MarketplaceReportsDateRange = "today" | "7d" | "30d" | "month" | "year";

export type MarketplaceReportsLoadingState = "empty" | "error" | "loaded";

export type MarketplaceReportsRuntimeStatus = "needs_attention" | "ready" | "unavailable";

export type MarketplaceReportsBreakdownItem = {
  count: number;
  dataAvailability: "available" | "planned";
  label: string;
};

export type MarketplaceReportsActivityItem = {
  activityAt: string;
  activityType: string;
  dataAvailability: "available" | "planned";
  itemLabel: string;
  status: string;
};

export type MarketplaceReportsMetrics = {
  approvedItems: number;
  archivedItems: number;
  creatorsCount: number;
  draftItems: number;
  liveInstalls: number;
  marketplacePaymentsProcessed: number;
  pendingReviewItems: number;
  rejectedItems: number;
  totalMarketplaceItems: number;
};

export type MarketplaceReportsSnapshot = {
  dataSources: string[];
  errorMessage: string | null;
  generatedAt: string;
  itemsByCategory: MarketplaceReportsBreakdownItem[];
  itemsByStatus: MarketplaceReportsBreakdownItem[];
  lastUpdatedAt: string | null;
  latestMarketplaceActivity: MarketplaceReportsActivityItem[];
  loadingState: MarketplaceReportsLoadingState;
  metrics: MarketplaceReportsMetrics;
  rangeLabel: string;
  readOnly: true;
  selectedRange: MarketplaceReportsDateRange;
  source: MarketplaceReportsSource;
  status: MarketplaceReportsRuntimeStatus;
  warnings: string[];
};

export type MarketplaceReportsSummary = {
  lastGeneratedState: string;
  readOnly: true;
  status: MarketplaceReportsRuntimeStatus;
  summary: string;
};

export type MarketplaceReportsValidation = {
  isValid: boolean;
  issues: string[];
};

export const MARKETPLACE_REPORTS_SOURCE = "marketplace_reports_runtime" as const;

type NormalizedActivity = {
  activityAt: string;
  activityType: string;
  itemLabel: string;
  status: string;
};

type RawRecord = Record<string, unknown>;

const ITEM_STATUSES = new Set(["approved", "archived", "draft", "pending_review", "rejected"]);

function text(value: unknown, fallback = "") {
  const cleaned =
    typeof value === "string" && value.trim()
      ? maskSensitiveText(value.trim()).replace(/\s+/g, " ").slice(0, 120)
      : fallback;

  return cleaned;
}

function numberValue(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateValue(value: unknown) {
  const parsed = Date.parse(text(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function resolveRangeLabel(range: MarketplaceReportsDateRange) {
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

function resolveRangeStart(range: MarketplaceReportsDateRange) {
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
      warning: "Service-role admin access is unavailable. Marketplace report aggregates are empty."
    };
  }

  const { data, error } = await admin.from(table as never).select(columns as never).limit(5000);

  if (error) {
    return {
      records: [] as RawRecord[],
      warning: `Marketplace report source ${table} could not be loaded safely.`
    };
  }

  return {
    records: asRecords(data),
    warning: null as string | null
  };
}

function incrementBreakdown(map: Map<string, MarketplaceReportsBreakdownItem>, label: string, planned = false) {
  const key = label || "unknown";
  const current = map.get(key) ?? {
    count: 0,
    dataAvailability: planned ? ("planned" as const) : ("available" as const),
    label: key
  };

  map.set(key, {
    ...current,
    count: current.count + 1
  });
}

function formatSectionLabel(section: string) {
  const cleaned = text(section, "unknown");

  return cleaned
    .replace(/_marketplace$/i, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function maskItemLabel(itemKey: string, itemType: string) {
  const typeLabel = text(itemType, "item");
  const keyLabel = text(itemKey);

  if (!keyLabel) {
    return `${typeLabel} item`;
  }

  if (keyLabel.length <= 4) {
    return `${typeLabel} · ${keyLabel.slice(0, 2)}***`;
  }

  return `${typeLabel} · ${keyLabel.slice(0, 3)}***`;
}

function buildEmptySnapshot(
  range: MarketplaceReportsDateRange,
  warnings: string[],
  errorMessage: string | null = null
): MarketplaceReportsSnapshot {
  return {
    dataSources: [],
    errorMessage,
    generatedAt: new Date().toISOString(),
    itemsByCategory: [],
    itemsByStatus: [],
    lastUpdatedAt: null,
    latestMarketplaceActivity: [],
    loadingState: errorMessage ? "error" : warnings.length ? "empty" : "loaded",
    metrics: {
      approvedItems: 0,
      archivedItems: 0,
      creatorsCount: 0,
      draftItems: 0,
      liveInstalls: 0,
      marketplacePaymentsProcessed: 0,
      pendingReviewItems: 0,
      rejectedItems: 0,
      totalMarketplaceItems: 0
    },
    rangeLabel: resolveRangeLabel(range),
    readOnly: true,
    selectedRange: range,
    source: MARKETPLACE_REPORTS_SOURCE,
    status: errorMessage ? "unavailable" : warnings.length ? "needs_attention" : "ready",
    warnings
  };
}

export async function runMarketplaceReportsSnapshot(
  range: MarketplaceReportsDateRange = "30d"
): Promise<MarketplaceReportsSnapshot> {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    return buildEmptySnapshot(range, ["Super Admin access is required for Marketplace Reports runtime."]);
  }

  const selectedRange = range;
  const rangeStart = resolveRangeStart(selectedRange);
  const warnings: string[] = [];
  const dataSources: string[] = [];
  let lastUpdatedAt: string | null = null;

  try {
    const [
      itemsResult,
      creatorsResult,
      installEventsResult,
      revenueEventsResult,
      purchasesResult,
      installationsResult
    ] = await Promise.all([
      safeAdminSelect(
        "marketplace_items",
        "id, item_key, item_type, section, status, install_count, live_installs, creator_account_id, created_at, updated_at"
      ),
      safeAdminSelect("marketplace_creator_accounts", "id, creator_status, created_at, updated_at"),
      safeAdminSelect(
        "marketplace_install_events",
        "marketplace_item_id, item_type, install_status, created_at"
      ),
      safeAdminSelect(
        "marketplace_revenue_events",
        "marketplace_item_id, revenue_status, gross_amount, currency, created_at"
      ),
      safeAdminSelect(
        "marketplace_purchases",
        "marketplace_item_id, purchase_status, amount, currency, created_at"
      ),
      safeAdminSelect(
        "marketplace_app_plugin_installations",
        "marketplace_item_id, installation_type, installation_status, created_at, updated_at"
      )
    ]);

    for (const result of [
      itemsResult,
      creatorsResult,
      installEventsResult,
      revenueEventsResult,
      purchasesResult,
      installationsResult
    ]) {
      if (result.warning) {
        warnings.push(result.warning);
      }
    }

    if (itemsResult.records.length) {
      dataSources.push("marketplace_items");
    }

    if (creatorsResult.records.length) {
      dataSources.push("marketplace_creator_accounts");
    }

    if (installEventsResult.records.length) {
      dataSources.push("marketplace_install_events");
    }

    if (revenueEventsResult.records.length) {
      dataSources.push("marketplace_revenue_events");
    }

    if (purchasesResult.records.length) {
      dataSources.push("marketplace_purchases");
    }

    if (installationsResult.records.length) {
      dataSources.push("marketplace_app_plugin_installations");
    }

    const itemById = new Map(itemsResult.records.map((item) => [text(item.id), item]));
    const itemsByStatus = new Map<string, MarketplaceReportsBreakdownItem>();
    const itemsByCategory = new Map<string, MarketplaceReportsBreakdownItem>();

    let approvedItems = 0;
    let archivedItems = 0;
    let draftItems = 0;
    let pendingReviewItems = 0;
    let rejectedItems = 0;
    let liveInstalls = itemsResult.records.reduce((total, item) => total + numberValue(item.live_installs), 0);

    for (const item of itemsResult.records) {
      const status = text(item.status, "draft").toLowerCase();
      const section = formatSectionLabel(text(item.section, text(item.item_type, "unknown")));
      const activityAt = text(item.updated_at) || text(item.created_at);

      incrementBreakdown(itemsByStatus, ITEM_STATUSES.has(status) ? status : "unknown");
      incrementBreakdown(itemsByCategory, section);

      if (activityAt && (!lastUpdatedAt || dateValue(activityAt) > dateValue(lastUpdatedAt))) {
        lastUpdatedAt = activityAt;
      }

      if (status === "approved") {
        approvedItems += 1;
      } else if (status === "archived") {
        archivedItems += 1;
      } else if (status === "draft") {
        draftItems += 1;
      } else if (status === "pending_review") {
        pendingReviewItems += 1;
      } else if (status === "rejected") {
        rejectedItems += 1;
      }
    }

    if (!liveInstalls && installationsResult.records.length) {
      liveInstalls = installationsResult.records.filter((row) =>
        ["active", "installed"].includes(text(row.installation_status).toLowerCase())
      ).length;
    }

    const creatorsCount = creatorsResult.records.length;

    if (!creatorsResult.records.length) {
      warnings.push("Creator counts remain planned until marketplace_creator_accounts rows are available.");
    }

    let marketplacePaymentsProcessed = 0;
    const activityCandidates: NormalizedActivity[] = [];

    for (const item of itemsResult.records) {
      const activityAt = text(item.updated_at) || text(item.created_at);

      if (!isWithinRange(activityAt, rangeStart)) {
        continue;
      }

      activityCandidates.push({
        activityAt,
        activityType: "item_update",
        itemLabel: maskItemLabel(text(item.item_key), text(item.item_type, "item")),
        status: text(item.status, "unknown")
      });
    }

    for (const event of installEventsResult.records) {
      const activityAt = text(event.created_at);
      const item = itemById.get(text(event.marketplace_item_id));

      if (activityAt && (!lastUpdatedAt || dateValue(activityAt) > dateValue(lastUpdatedAt))) {
        lastUpdatedAt = activityAt;
      }

      if (!isWithinRange(activityAt, rangeStart)) {
        continue;
      }

      activityCandidates.push({
        activityAt,
        activityType: "install_event",
        itemLabel: maskItemLabel(text(item?.item_key), text(event.item_type, text(item?.item_type, "item"))),
        status: text(event.install_status, "installed")
      });
    }

    for (const event of revenueEventsResult.records) {
      const activityAt = text(event.created_at);
      const item = itemById.get(text(event.marketplace_item_id));
      const revenueStatus = text(event.revenue_status).toLowerCase();

      if (activityAt && (!lastUpdatedAt || dateValue(activityAt) > dateValue(lastUpdatedAt))) {
        lastUpdatedAt = activityAt;
      }

      if (isWithinRange(activityAt, rangeStart) && revenueStatus === "processed") {
        marketplacePaymentsProcessed += 1;
      }

      if (!isWithinRange(activityAt, rangeStart)) {
        continue;
      }

      activityCandidates.push({
        activityAt,
        activityType: "revenue_event",
        itemLabel: maskItemLabel(text(item?.item_key), text(item?.item_type, "item")),
        status: revenueStatus || "pending"
      });
    }

    for (const purchase of purchasesResult.records) {
      const activityAt = text(purchase.created_at);
      const item = itemById.get(text(purchase.marketplace_item_id));
      const purchaseStatus = text(purchase.purchase_status).toLowerCase();

      if (activityAt && (!lastUpdatedAt || dateValue(activityAt) > dateValue(lastUpdatedAt))) {
        lastUpdatedAt = activityAt;
      }

      if (isWithinRange(activityAt, rangeStart) && purchaseStatus === "paid") {
        marketplacePaymentsProcessed += 1;
      }

      if (!isWithinRange(activityAt, rangeStart)) {
        continue;
      }

      activityCandidates.push({
        activityAt,
        activityType: "purchase",
        itemLabel: maskItemLabel(text(item?.item_key), text(item?.item_type, "item")),
        status: purchaseStatus || "draft"
      });
    }

    for (const installation of installationsResult.records) {
      const activityAt = text(installation.updated_at) || text(installation.created_at);
      const item = itemById.get(text(installation.marketplace_item_id));
      const installationStatus = text(installation.installation_status).toLowerCase();

      if (activityAt && (!lastUpdatedAt || dateValue(activityAt) > dateValue(lastUpdatedAt))) {
        lastUpdatedAt = activityAt;
      }

      if (!isWithinRange(activityAt, rangeStart)) {
        continue;
      }

      activityCandidates.push({
        activityAt,
        activityType: "app_plugin_installation",
        itemLabel: maskItemLabel(text(item?.item_key), text(installation.installation_type, "installation")),
        status: installationStatus || "pending"
      });
    }

    if (revenueEventsResult.records.length && purchasesResult.records.length) {
      warnings.push(
        "Processed payment totals may include overlapping revenue and purchase rows. Aggregates remain read-only."
      );
    }

    if (!installEventsResult.records.length && !installationsResult.records.length && liveInstalls === 0) {
      warnings.push("Live install metrics use item counters until install event sources are available.");
    }

    const latestMarketplaceActivity = [...activityCandidates]
      .sort((left, right) => dateValue(right.activityAt) - dateValue(left.activityAt))
      .slice(0, 8)
      .map((activity) => ({
        activityAt: activity.activityAt,
        activityType: activity.activityType,
        dataAvailability: "available" as const,
        itemLabel: activity.itemLabel,
        status: activity.status
      }));

    const totalMarketplaceItems = itemsResult.records.length;
    const status: MarketplaceReportsRuntimeStatus =
      warnings.length || pendingReviewItems > 0 || rejectedItems > 0
        ? "needs_attention"
        : dataSources.length
          ? "ready"
          : "unavailable";

    return {
      dataSources,
      errorMessage: null,
      generatedAt: new Date().toISOString(),
      itemsByCategory: [...itemsByCategory.values()].sort((left, right) => right.count - left.count),
      itemsByStatus: [...itemsByStatus.values()].sort((left, right) => right.count - left.count),
      lastUpdatedAt,
      latestMarketplaceActivity,
      loadingState: dataSources.length ? "loaded" : "empty",
      metrics: {
        approvedItems,
        archivedItems,
        creatorsCount,
        draftItems,
        liveInstalls,
        marketplacePaymentsProcessed,
        pendingReviewItems,
        rejectedItems,
        totalMarketplaceItems
      },
      rangeLabel: resolveRangeLabel(selectedRange),
      readOnly: true,
      selectedRange,
      source: MARKETPLACE_REPORTS_SOURCE,
      status,
      warnings
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Marketplace Reports runtime failed to load safely.";

    return buildEmptySnapshot(selectedRange, [], message);
  }
}

export function getMarketplaceReportsSummary(snapshot: MarketplaceReportsSnapshot): MarketplaceReportsSummary {
  return {
    lastGeneratedState: snapshot.lastUpdatedAt
      ? `Generated ${snapshot.generatedAt}; latest marketplace activity ${snapshot.lastUpdatedAt}`
      : `Generated ${snapshot.generatedAt}; no marketplace activity timestamps recorded`,
    readOnly: true,
    status: snapshot.status,
    summary: [
      `status ${snapshot.status}`,
      `${snapshot.rangeLabel}`,
      `${snapshot.metrics.totalMarketplaceItems} total marketplace items`,
      `${snapshot.metrics.approvedItems} approved`,
      `${snapshot.metrics.pendingReviewItems} pending review`,
      `${snapshot.metrics.marketplacePaymentsProcessed} payments processed in range`
    ].join("; ")
  };
}

export function validateMarketplaceReportsRuntime(
  snapshot: MarketplaceReportsSnapshot
): MarketplaceReportsValidation {
  const issues: string[] = [];

  if (!snapshot.readOnly) {
    issues.push("Marketplace Reports runtime must remain read-only.");
  }

  if (snapshot.source !== MARKETPLACE_REPORTS_SOURCE) {
    issues.push("Marketplace Reports runtime must originate from the marketplace reports runtime.");
  }

  if (!snapshot.generatedAt) {
    issues.push("Marketplace Reports runtime must include generatedAt.");
  }

  if (snapshot.metrics.totalMarketplaceItems < 0 || snapshot.metrics.marketplacePaymentsProcessed < 0) {
    issues.push("Marketplace Reports totals must not be negative.");
  }

  return {
    isValid: issues.length === 0,
    issues
  };
}

export async function mapMarketplaceReportsRuntimeToAdminFields(
  range: MarketplaceReportsDateRange = "30d"
) {
  const snapshot = await runMarketplaceReportsSnapshot(range);
  const validation = validateMarketplaceReportsRuntime(snapshot);
  const summary = getMarketplaceReportsSummary(snapshot);

  return {
    errorMessage: snapshot.errorMessage,
    generatedAt: snapshot.generatedAt,
    itemsByCategory: snapshot.itemsByCategory,
    itemsByStatus: snapshot.itemsByStatus,
    lastGeneratedState: summary.lastGeneratedState,
    lastUpdatedAt: snapshot.lastUpdatedAt,
    latestMarketplaceActivity: snapshot.latestMarketplaceActivity,
    loadingState: snapshot.loadingState,
    metrics: snapshot.metrics,
    rangeLabel: snapshot.rangeLabel,
    readOnly: true as const,
    selectedRange: snapshot.selectedRange,
    status: validation.isValid ? summary.status : ("needs_attention" as const),
    summary: validation.isValid
      ? summary.summary
      : "Marketplace Reports runtime validation requires safe read-only defaults.",
    warnings: [...snapshot.warnings, ...validation.issues]
  };
}
