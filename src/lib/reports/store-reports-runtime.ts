import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { getBillingPlan } from "@/lib/billing/plans";
import { createAdminClient } from "@/lib/supabase/admin";

export type StoreReportsSource = "store_reports_runtime";

export type StoreReportsDateRange = "today" | "7d" | "30d" | "month" | "year";

export type StoreReportsLoadingState = "empty" | "error" | "loaded";

export type StoreReportsRuntimeStatus = "needs_attention" | "ready" | "unavailable";

export type StoreReportsBreakdownItem = {
  count: number;
  dataAvailability: "available" | "planned";
  label: string;
};

export type StoreReportsMetrics = {
  activeStores: number;
  inactiveStores: number;
  newlyCreatedStores: number;
  storesWithDomains: number;
  storesWithOwners: number;
  suspendedStores: number;
  totalStores: number;
};

export type StoreReportsSnapshot = {
  dataSources: string[];
  errorMessage: string | null;
  generatedAt: string;
  lastUpdatedAt: string | null;
  loadingState: StoreReportsLoadingState;
  metrics: StoreReportsMetrics;
  rangeLabel: string;
  readOnly: true;
  selectedRange: StoreReportsDateRange;
  source: StoreReportsSource;
  status: StoreReportsRuntimeStatus;
  storesByPlan: StoreReportsBreakdownItem[];
  storesByStatus: StoreReportsBreakdownItem[];
  warnings: string[];
};

export type StoreReportsSummary = {
  lastGeneratedState: string;
  readOnly: true;
  status: StoreReportsRuntimeStatus;
  summary: string;
};

export type StoreReportsValidation = {
  isValid: boolean;
  issues: string[];
};

export const STORE_REPORTS_SOURCE = "store_reports_runtime" as const;

type RawRecord = Record<string, unknown>;

function text(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function dateValue(value: unknown) {
  const parsed = Date.parse(text(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function isRecord(value: unknown): value is RawRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function ownerUserId(record: RawRecord) {
  return text(record.owner_user_id) || text(record.user_id);
}

function governanceStatus(storeData: unknown, fallback: string) {
  if (!isRecord(storeData) || !isRecord(storeData.adminGovernance)) {
    return fallback;
  }

  const status = text(storeData.adminGovernance.status);

  if (status === "suspended" || status === "under_review") {
    return status;
  }

  return fallback;
}

function resolveRangeLabel(range: StoreReportsDateRange) {
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

function resolveRangeStart(range: StoreReportsDateRange) {
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
      warning: "Service-role admin access is unavailable. Store report aggregates are empty."
    };
  }

  const { data, error } = await admin.from(table as never).select(columns as never).limit(5000);

  if (error) {
    return {
      records: [] as RawRecord[],
      warning: `Store report source ${table} could not be loaded safely.`
    };
  }

  return {
    records: asRecords(data),
    warning: null as string | null
  };
}

function incrementBreakdown(map: Map<string, StoreReportsBreakdownItem>, label: string) {
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

function buildEmptySnapshot(
  range: StoreReportsDateRange,
  warnings: string[],
  errorMessage: string | null = null
): StoreReportsSnapshot {
  return {
    dataSources: [],
    errorMessage,
    generatedAt: new Date().toISOString(),
    lastUpdatedAt: null,
    loadingState: errorMessage ? "error" : warnings.length ? "empty" : "loaded",
    metrics: {
      activeStores: 0,
      inactiveStores: 0,
      newlyCreatedStores: 0,
      storesWithDomains: 0,
      storesWithOwners: 0,
      suspendedStores: 0,
      totalStores: 0
    },
    rangeLabel: resolveRangeLabel(range),
    readOnly: true,
    selectedRange: range,
    source: STORE_REPORTS_SOURCE,
    status: errorMessage ? "unavailable" : warnings.length ? "needs_attention" : "ready",
    storesByPlan: [],
    storesByStatus: [],
    warnings
  };
}

function storeHasDomain(
  storeId: string,
  publicationsByStore: Map<string, RawRecord>,
  domainsByStore: Map<string, RawRecord[]>
) {
  const publication = publicationsByStore.get(storeId);

  if (text(publication?.custom_domain)) {
    return true;
  }

  const domains = domainsByStore.get(storeId) ?? [];

  return domains.some((domain) => {
    const status = text(domain.status).toLowerCase();
    const verificationStatus = text(domain.verification_status).toLowerCase();

    return status === "verified" || verificationStatus === "verified" || Boolean(text(domain.hostname));
  });
}

function resolveStoreLifecycleStatus(store: RawRecord, publication: RawRecord | undefined) {
  const baseStatus = governanceStatus(store.store_data, text(store.status, "draft"));
  const publicationStatus = text(publication?.status).toLowerCase();

  if (baseStatus === "suspended" || baseStatus === "under_review") {
    return baseStatus;
  }

  if (publicationStatus === "published" || baseStatus === "active") {
    return "active";
  }

  if (["draft", "inactive", "archived"].includes(baseStatus)) {
    return "inactive";
  }

  return baseStatus || "inactive";
}

export async function runStoreReportsSnapshot(
  range: StoreReportsDateRange = "30d"
): Promise<StoreReportsSnapshot> {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    return buildEmptySnapshot(range, ["Super Admin access is required for Store Reports runtime."]);
  }

  const selectedRange = range;
  const rangeStart = resolveRangeStart(selectedRange);
  const warnings: string[] = [];
  const dataSources: string[] = [];
  let lastUpdatedAt: string | null = null;

  try {
    const [storesResult, publicationsResult, domainsResult, subscriptionsResult] = await Promise.all([
      safeAdminSelect(
        "stores",
        "id, user_id, owner_user_id, workspace_id, status, store_data, created_at, updated_at"
      ),
      safeAdminSelect("published_stores", "store_id, status, custom_domain, updated_at"),
      safeAdminSelect("store_domains", "store_id, hostname, status, verification_status, updated_at"),
      safeAdminSelect("user_subscriptions", "user_id, plan_id, status, updated_at")
    ]);

    for (const result of [storesResult, publicationsResult, domainsResult, subscriptionsResult]) {
      if (result.warning) {
        warnings.push(result.warning);
      }
    }

    if (storesResult.records.length) {
      dataSources.push("stores");
    }

    if (publicationsResult.records.length) {
      dataSources.push("published_stores");
    }

    if (domainsResult.records.length) {
      dataSources.push("store_domains");
    }

    if (subscriptionsResult.records.length) {
      dataSources.push("user_subscriptions");
    }

    const publicationsByStore = new Map(
      publicationsResult.records.map((record) => [text(record.store_id), record] as const)
    );
    const domainsByStore = new Map<string, RawRecord[]>();

    for (const domain of domainsResult.records) {
      const storeId = text(domain.store_id);

      if (!storeId) {
        continue;
      }

      domainsByStore.set(storeId, [...(domainsByStore.get(storeId) ?? []), domain]);
    }

    const subscriptionByUser = new Map(
      subscriptionsResult.records.map((record) => [text(record.user_id), record] as const)
    );

    const storesByPlan = new Map<string, StoreReportsBreakdownItem>();
    const storesByStatus = new Map<string, StoreReportsBreakdownItem>();

    let activeStores = 0;
    let inactiveStores = 0;
    let suspendedStores = 0;
    let newlyCreatedStores = 0;
    let storesWithDomains = 0;
    let storesWithOwners = 0;

    for (const store of storesResult.records) {
      const storeId = text(store.id);
      const publication = publicationsByStore.get(storeId);
      const lifecycleStatus = resolveStoreLifecycleStatus(store, publication);
      const ownerId = ownerUserId(store);
      const createdAt = text(store.created_at);
      const updatedAt = text(store.updated_at) || createdAt;
      const subscription = subscriptionByUser.get(ownerId);
      const planId = text(subscription?.plan_id, "free");
      const planLabel = getBillingPlan(planId).name;

      if (updatedAt && (!lastUpdatedAt || dateValue(updatedAt) > dateValue(lastUpdatedAt))) {
        lastUpdatedAt = updatedAt;
      }

      incrementBreakdown(storesByStatus, lifecycleStatus);
      incrementBreakdown(storesByPlan, planLabel);

      if (lifecycleStatus === "active") {
        activeStores += 1;
      } else if (lifecycleStatus === "suspended" || lifecycleStatus === "under_review") {
        suspendedStores += 1;
      } else {
        inactiveStores += 1;
      }

      if (isWithinRange(createdAt, rangeStart)) {
        newlyCreatedStores += 1;
      }

      if (ownerId) {
        storesWithOwners += 1;
      }

      if (storeHasDomain(storeId, publicationsByStore, domainsByStore)) {
        storesWithDomains += 1;
      }
    }

    const totalStores = storesResult.records.length;
    const status: StoreReportsRuntimeStatus =
      warnings.length || suspendedStores > 0
        ? "needs_attention"
        : dataSources.length
          ? "ready"
          : "unavailable";

    if (!subscriptionsResult.records.length) {
      warnings.push("Store plan breakdown uses free-plan defaults because subscription rows are unavailable.");
    }

    return {
      dataSources,
      errorMessage: null,
      generatedAt: new Date().toISOString(),
      lastUpdatedAt,
      loadingState: dataSources.length ? "loaded" : "empty",
      metrics: {
        activeStores,
        inactiveStores,
        newlyCreatedStores,
        storesWithDomains,
        storesWithOwners,
        suspendedStores,
        totalStores
      },
      rangeLabel: resolveRangeLabel(selectedRange),
      readOnly: true,
      selectedRange,
      source: STORE_REPORTS_SOURCE,
      status,
      storesByPlan: [...storesByPlan.values()].sort((left, right) => right.count - left.count),
      storesByStatus: [...storesByStatus.values()].sort((left, right) => right.count - left.count),
      warnings
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Store Reports runtime failed to load safely.";

    return buildEmptySnapshot(selectedRange, [], message);
  }
}

export function getStoreReportsSummary(snapshot: StoreReportsSnapshot): StoreReportsSummary {
  return {
    lastGeneratedState: snapshot.lastUpdatedAt
      ? `Generated ${snapshot.generatedAt}; latest store activity ${snapshot.lastUpdatedAt}`
      : `Generated ${snapshot.generatedAt}; no store activity timestamps recorded`,
    readOnly: true,
    status: snapshot.status,
    summary: [
      `status ${snapshot.status}`,
      `${snapshot.rangeLabel}`,
      `${snapshot.metrics.totalStores} total stores`,
      `${snapshot.metrics.activeStores} active`,
      `${snapshot.metrics.suspendedStores} suspended`,
      `${snapshot.metrics.newlyCreatedStores} newly created in range`
    ].join("; ")
  };
}

export function validateStoreReportsRuntime(snapshot: StoreReportsSnapshot): StoreReportsValidation {
  const issues: string[] = [];

  if (!snapshot.readOnly) {
    issues.push("Store Reports runtime must remain read-only.");
  }

  if (snapshot.source !== STORE_REPORTS_SOURCE) {
    issues.push("Store Reports runtime must originate from the store reports runtime.");
  }

  if (!snapshot.generatedAt) {
    issues.push("Store Reports runtime must include generatedAt.");
  }

  if (snapshot.metrics.totalStores < 0) {
    issues.push("Store Reports total store count must not be negative.");
  }

  return {
    isValid: issues.length === 0,
    issues
  };
}

export async function mapStoreReportsRuntimeToAdminFields(range: StoreReportsDateRange = "30d") {
  const snapshot = await runStoreReportsSnapshot(range);
  const validation = validateStoreReportsRuntime(snapshot);
  const summary = getStoreReportsSummary(snapshot);

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
    storesByPlan: snapshot.storesByPlan,
    storesByStatus: snapshot.storesByStatus,
    summary: validation.isValid
      ? summary.summary
      : "Store Reports runtime validation requires safe read-only defaults.",
    warnings: [...snapshot.warnings, ...validation.issues]
  };
}
