import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { maskSensitiveText } from "@/lib/integrations/safe-diagnostics";
import { createAdminClient } from "@/lib/supabase/admin";

export type DomainEmailReportsSource = "domain_email_reports_runtime";

export type DomainEmailReportsDateRange = "today" | "7d" | "30d" | "month" | "year";

export type DomainEmailReportsLoadingState = "empty" | "error" | "loaded";

export type DomainEmailReportsRuntimeStatus = "needs_attention" | "ready" | "unavailable";

export type DomainEmailReportsBreakdownItem = {
  count: number;
  dataAvailability: "available" | "planned";
  label: string;
};

export type DomainEmailReportsActivityItem = {
  activityAt: string;
  dataAvailability: "available" | "planned";
  label: string;
  provider: string;
  scopeLabel: string;
  status: string;
};

export type DomainEmailReportsMetrics = {
  activeDomains: number;
  activeEmailServices: number;
  failedDomains: number;
  pendingDomains: number;
  pendingEmailServices: number;
  totalDomains: number;
  totalEmailServices: number;
};

export type DomainEmailReportsSnapshot = {
  dataSources: string[];
  domainsByExtension: DomainEmailReportsBreakdownItem[];
  domainsByProvider: DomainEmailReportsBreakdownItem[];
  domainsByStatus: DomainEmailReportsBreakdownItem[];
  errorMessage: string | null;
  generatedAt: string;
  lastUpdatedAt: string | null;
  latestDomainActivity: DomainEmailReportsActivityItem[];
  latestEmailActivity: DomainEmailReportsActivityItem[];
  loadingState: DomainEmailReportsLoadingState;
  metrics: DomainEmailReportsMetrics;
  rangeLabel: string;
  readOnly: true;
  selectedRange: DomainEmailReportsDateRange;
  source: DomainEmailReportsSource;
  status: DomainEmailReportsRuntimeStatus;
  warnings: string[];
};

export type DomainEmailReportsSummary = {
  lastGeneratedState: string;
  readOnly: true;
  status: DomainEmailReportsRuntimeStatus;
  summary: string;
};

export type DomainEmailReportsValidation = {
  isValid: boolean;
  issues: string[];
};

export const DOMAIN_EMAIL_REPORTS_SOURCE = "domain_email_reports_runtime" as const;

type DomainClassification = "active" | "failed" | "pending";

type NormalizedDomain = {
  activityAt: string;
  classification: DomainClassification;
  extension: string;
  hostname: string;
  provider: string;
  rawStatus: string;
  scopeLabel: string;
  source: string;
};

type NormalizedEmailService = {
  activityAt: string;
  classification: DomainClassification;
  label: string;
  provider: string;
  rawStatus: string;
  scopeLabel: string;
  source: string;
};

type RawRecord = Record<string, unknown>;

function text(value: unknown, fallback = "") {
  const cleaned =
    typeof value === "string" && value.trim()
      ? maskSensitiveText(value.trim()).replace(/\s+/g, " ").slice(0, 120)
      : fallback;

  return cleaned;
}

function dateValue(value: unknown) {
  const parsed = Date.parse(text(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function isRecord(value: unknown): value is RawRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function recordsFromStoreData(storeData: unknown, key: string): RawRecord[] {
  if (!isRecord(storeData) || !isRecord(storeData[key])) {
    return [];
  }

  return Object.values(storeData[key]).filter(isRecord);
}

function storeLabel(row: RawRecord | undefined, fallback = "Unknown store") {
  if (!row) {
    return fallback;
  }

  return text(row.store_name, text(row.name, text(row.slug, fallback)));
}

function maskHostname(value: string) {
  const cleaned = text(value);

  if (!cleaned) {
    return "domain";
  }

  const parts = cleaned.split(".");

  if (parts.length <= 1) {
    return `${cleaned.slice(0, 3)}***`;
  }

  return `***.${parts.slice(-2).join(".")}`;
}

function maskMailbox(value: string) {
  const cleaned = text(value);

  if (!cleaned.includes("@")) {
    return "mailbox";
  }

  const [, domain] = cleaned.split("@");
  return `***@${domain}`;
}

function resolveExtension(hostname: string, tld?: string) {
  const normalizedTld = text(tld);

  if (normalizedTld) {
    return normalizedTld.startsWith(".") ? normalizedTld : `.${normalizedTld}`;
  }

  const parts = text(hostname).split(".");

  if (parts.length > 1) {
    return `.${parts[parts.length - 1]}`;
  }

  return "unknown";
}

function normalizeProvider(value: unknown) {
  const cleaned = text(value, "unknown").toLowerCase();

  if (cleaned.includes("httpapi") || cleaned.includes("resell")) {
    return "domain_provider";
  }

  if (cleaned.includes("hostinsh")) {
    return "hostinsh";
  }

  if (cleaned.includes("manual")) {
    return "manual";
  }

  return cleaned || "unknown";
}

function classifyDomainStatus(...statuses: string[]): DomainClassification {
  const normalized = statuses.map((status) => status.toLowerCase()).filter(Boolean);

  if (normalized.some((status) => status.includes("fail"))) {
    return "failed";
  }

  if (
    normalized.some((status) =>
      ["active", "verified", "configured", "ssl_active", "ready", "published"].includes(status)
    )
  ) {
    return "active";
  }

  return "pending";
}

function classifyEmailStatus(...statuses: string[]): DomainClassification {
  const normalized = statuses.map((status) => status.toLowerCase()).filter(Boolean);

  if (normalized.some((status) => status.includes("fail"))) {
    return "failed";
  }

  if (normalized.some((status) => ["active", "activated", "provisioned", "ready"].includes(status))) {
    return "active";
  }

  return "pending";
}

function resolveRangeLabel(range: DomainEmailReportsDateRange) {
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

function resolveRangeStart(range: DomainEmailReportsDateRange) {
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
      warning: "Service-role admin access is unavailable. Domain and email report aggregates are empty."
    };
  }

  const { data, error } = await admin.from(table as never).select(columns as never).limit(5000);

  if (error) {
    return {
      records: [] as RawRecord[],
      warning: `Domain and email report source ${table} could not be loaded safely.`
    };
  }

  return {
    records: asRecords(data),
    warning: null as string | null
  };
}

function incrementBreakdown(map: Map<string, DomainEmailReportsBreakdownItem>, label: string, planned = false) {
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

function normalizeStoreDomain(domain: RawRecord, storeById: Map<string, RawRecord>): NormalizedDomain | null {
  const hostname = text(domain.hostname, text(domain.primary_domain));
  const activityAt = text(domain.updated_at) || text(domain.created_at);

  if (!hostname || !activityAt) {
    return null;
  }

  const store =
    storeById.get(text(domain.store_id)) ?? storeById.get(text(domain.store_instance_id));
  const rawStatus = text(domain.status, text(domain.verification_status, text(domain.dns_status, "pending")));

  return {
    activityAt,
    classification: classifyDomainStatus(
      text(domain.status),
      text(domain.verification_status),
      text(domain.dns_status),
      text(domain.ssl_status)
    ),
    extension: resolveExtension(hostname),
    hostname,
    provider: normalizeProvider("manual"),
    rawStatus,
    scopeLabel: storeLabel(store),
    source: "store_domains"
  };
}

function normalizeDomainOrder(order: RawRecord, storeById: Map<string, RawRecord>): NormalizedDomain | null {
  const hostname = text(order.domain_name);
  const activityAt = text(order.created_at);

  if (!hostname || !activityAt) {
    return null;
  }

  const store = storeById.get(text(order.store_id));
  const rawStatus = text(order.status, "pending");

  return {
    activityAt,
    classification: classifyDomainStatus(rawStatus),
    extension: resolveExtension(hostname, text(order.tld)),
    hostname,
    provider: normalizeProvider(order.provider),
    rawStatus,
    scopeLabel: storeLabel(store),
    source: "domain_orders"
  };
}

function domainsFromStoreData(stores: RawRecord[]): NormalizedDomain[] {
  const domains: NormalizedDomain[] = [];

  for (const store of stores) {
    const scopeLabel = storeLabel(store);

    for (const draft of recordsFromStoreData(store.store_data, "domainOrderDrafts")) {
      const hostname = text(draft.selectedDomain);
      const activityAt = text(draft.createdAt) || text(draft.updatedAt);

      if (!hostname || !activityAt) {
        continue;
      }

      domains.push({
        activityAt,
        classification: classifyDomainStatus(text(draft.status, "draft")),
        extension: resolveExtension(hostname, text(draft.extension)),
        hostname,
        provider: normalizeProvider("manual"),
        rawStatus: text(draft.status, "draft"),
        scopeLabel,
        source: "domain_order_draft"
      });
    }

    for (const workflow of recordsFromStoreData(store.store_data, "domainRegistrationWorkflows")) {
      const hostname = text(workflow.domain);
      const activityAt = text(workflow.createdAt) || text(workflow.updatedAt);
      const dnsSetup = isRecord(workflow.dnsSetup) ? workflow.dnsSetup : {};
      const sslSetup = isRecord(workflow.sslSetup) ? workflow.sslSetup : {};

      if (!hostname || !activityAt) {
        continue;
      }

      domains.push({
        activityAt,
        classification: classifyDomainStatus(
          text(workflow.status),
          text(dnsSetup.status),
          text(sslSetup.status)
        ),
        extension: resolveExtension(hostname),
        hostname,
        provider: normalizeProvider(workflow.provider),
        rawStatus: text(workflow.status, "ready_for_registration"),
        scopeLabel,
        source: "domain_registration_workflow"
      });
    }
  }

  return domains;
}

function emailServicesFromStoreData(stores: RawRecord[]): NormalizedEmailService[] {
  const services: NormalizedEmailService[] = [];

  for (const store of stores) {
    const scopeLabel = storeLabel(store);

    for (const draft of [
      ...recordsFromStoreData(store.store_data, "professionalEmailMailboxDrafts"),
      ...recordsFromStoreData(store.store_data, "professionalEmailOrderDrafts")
    ]) {
      const mailbox = text(draft.mailboxAddress, text(draft.emailAddress, "mailbox"));
      const activityAt = text(draft.createdAt) || text(draft.updatedAt);
      const emailDnsSetup = isRecord(draft.emailDnsSetup) ? draft.emailDnsSetup : {};

      if (!activityAt) {
        continue;
      }

      services.push({
        activityAt,
        classification: classifyEmailStatus(
          text(draft.status),
          text(draft.activationStatus),
          text(emailDnsSetup.status)
        ),
        label: maskMailbox(mailbox),
        provider: normalizeProvider("email_runtime"),
        rawStatus: text(draft.status, text(draft.activationStatus, "draft")),
        scopeLabel,
        source: "professional_email_draft"
      });
    }
  }

  return services;
}

function dedupeDomains(domains: NormalizedDomain[]) {
  const merged = new Map<string, NormalizedDomain>();

  for (const domain of domains) {
    const key = domain.hostname.toLowerCase();
    const current = merged.get(key);

    if (!current || dateValue(domain.activityAt) >= dateValue(current.activityAt)) {
      merged.set(key, domain);
    }
  }

  return [...merged.values()];
}

function buildEmptySnapshot(
  range: DomainEmailReportsDateRange,
  warnings: string[],
  errorMessage: string | null = null
): DomainEmailReportsSnapshot {
  return {
    dataSources: [],
    domainsByExtension: [],
    domainsByProvider: [],
    domainsByStatus: [],
    errorMessage,
    generatedAt: new Date().toISOString(),
    lastUpdatedAt: null,
    latestDomainActivity: [],
    latestEmailActivity: [],
    loadingState: errorMessage ? "error" : warnings.length ? "empty" : "loaded",
    metrics: {
      activeDomains: 0,
      activeEmailServices: 0,
      failedDomains: 0,
      pendingDomains: 0,
      pendingEmailServices: 0,
      totalDomains: 0,
      totalEmailServices: 0
    },
    rangeLabel: resolveRangeLabel(range),
    readOnly: true,
    selectedRange: range,
    source: DOMAIN_EMAIL_REPORTS_SOURCE,
    status: errorMessage ? "unavailable" : warnings.length ? "needs_attention" : "ready",
    warnings
  };
}

export async function runDomainEmailReportsSnapshot(
  range: DomainEmailReportsDateRange = "30d"
): Promise<DomainEmailReportsSnapshot> {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    return buildEmptySnapshot(range, [
      "Super Admin access is required for Domain & Email Reports runtime."
    ]);
  }

  const selectedRange = range;
  const rangeStart = resolveRangeStart(selectedRange);
  const warnings: string[] = [];
  const dataSources: string[] = [];
  let lastUpdatedAt: string | null = null;

  try {
    const [storesResult, storeDomainsResult, domainOrdersResult, dnsRecordsResult] = await Promise.all([
      safeAdminSelect("stores", "id, name, store_name, slug, store_data, created_at, updated_at"),
      safeAdminSelect(
        "store_domains",
        "id, store_id, store_instance_id, hostname, primary_domain, status, verification_status, dns_status, ssl_status, created_at, updated_at"
      ),
      safeAdminSelect(
        "domain_orders",
        "id, store_id, domain_name, tld, provider, status, created_at"
      ),
      safeAdminSelect(
        "domain_dns_records",
        "domain_order_id, status, verification_status, created_at, updated_at"
      )
    ]);

    for (const result of [storesResult, storeDomainsResult, domainOrdersResult, dnsRecordsResult]) {
      if (result.warning) {
        warnings.push(result.warning);
      }
    }

    if (storesResult.records.length) {
      dataSources.push("stores");
    }

    if (storeDomainsResult.records.length) {
      dataSources.push("store_domains");
    }

    if (domainOrdersResult.records.length) {
      dataSources.push("domain_orders");
    }

    if (dnsRecordsResult.records.length) {
      dataSources.push("domain_dns_records");
    }

    const storeById = new Map(storesResult.records.map((store) => [text(store.id), store]));

    const normalizedDomains = dedupeDomains([
      ...storeDomainsResult.records
        .map((domain) => normalizeStoreDomain(domain, storeById))
        .filter((domain): domain is NormalizedDomain => Boolean(domain)),
      ...domainOrdersResult.records
        .map((order) => normalizeDomainOrder(order, storeById))
        .filter((domain): domain is NormalizedDomain => Boolean(domain)),
      ...domainsFromStoreData(storesResult.records)
    ]).filter((domain) => isWithinRange(domain.activityAt, rangeStart));

    const normalizedEmailServices = emailServicesFromStoreData(storesResult.records).filter((service) =>
      isWithinRange(service.activityAt, rangeStart)
    );

    if (storeDomainsResult.records.length && domainOrdersResult.records.length) {
      warnings.push(
        "Domain totals dedupe connected domains and provider orders by hostname. Overlapping rows remain read-only aggregates."
      );
    }

    if (!normalizedEmailServices.length) {
      warnings.push("Email service metrics use store draft sources until dedicated email runtime tables are available.");
    }

    const domainsByStatus = new Map<string, DomainEmailReportsBreakdownItem>();
    const domainsByExtension = new Map<string, DomainEmailReportsBreakdownItem>();
    const domainsByProvider = new Map<string, DomainEmailReportsBreakdownItem>();

    let activeDomains = 0;
    let pendingDomains = 0;
    let failedDomains = 0;

    for (const domain of normalizedDomains) {
      if (domain.activityAt && (!lastUpdatedAt || dateValue(domain.activityAt) > dateValue(lastUpdatedAt))) {
        lastUpdatedAt = domain.activityAt;
      }

      incrementBreakdown(domainsByStatus, domain.classification);
      incrementBreakdown(domainsByExtension, domain.extension);
      incrementBreakdown(domainsByProvider, domain.provider);

      if (domain.classification === "active") {
        activeDomains += 1;
      } else if (domain.classification === "failed") {
        failedDomains += 1;
      } else {
        pendingDomains += 1;
      }
    }

    for (const record of dnsRecordsResult.records) {
      const activityAt = text(record.updated_at) || text(record.created_at);

      if (activityAt && (!lastUpdatedAt || dateValue(activityAt) > dateValue(lastUpdatedAt))) {
        lastUpdatedAt = activityAt;
      }
    }

    let activeEmailServices = 0;
    let pendingEmailServices = 0;
    const totalEmailServices = normalizedEmailServices.length;

    for (const service of normalizedEmailServices) {
      if (service.activityAt && (!lastUpdatedAt || dateValue(service.activityAt) > dateValue(lastUpdatedAt))) {
        lastUpdatedAt = service.activityAt;
      }

      if (service.classification === "active") {
        activeEmailServices += 1;
      } else if (service.classification === "pending") {
        pendingEmailServices += 1;
      }
    }

    const latestDomainActivity = [...normalizedDomains]
      .sort((left, right) => dateValue(right.activityAt) - dateValue(left.activityAt))
      .slice(0, 8)
      .map((domain) => ({
        activityAt: domain.activityAt,
        dataAvailability: "available" as const,
        label: maskHostname(domain.hostname),
        provider: domain.provider,
        scopeLabel: domain.scopeLabel,
        status: domain.rawStatus
      }));

    const latestEmailActivity = [...normalizedEmailServices]
      .sort((left, right) => dateValue(right.activityAt) - dateValue(left.activityAt))
      .slice(0, 8)
      .map((service) => ({
        activityAt: service.activityAt,
        dataAvailability: service.source === "professional_email_draft" ? ("planned" as const) : ("available" as const),
        label: service.label,
        provider: service.provider,
        scopeLabel: service.scopeLabel,
        status: service.rawStatus
      }));

    const status: DomainEmailReportsRuntimeStatus =
      warnings.length || failedDomains > 0
        ? "needs_attention"
        : dataSources.length
          ? "ready"
          : "unavailable";

    return {
      dataSources,
      domainsByExtension: [...domainsByExtension.values()].sort((left, right) => right.count - left.count),
      domainsByProvider: [...domainsByProvider.values()].sort((left, right) => right.count - left.count),
      domainsByStatus: [...domainsByStatus.values()].sort((left, right) => right.count - left.count),
      errorMessage: null,
      generatedAt: new Date().toISOString(),
      lastUpdatedAt,
      latestDomainActivity,
      latestEmailActivity,
      loadingState: dataSources.length ? "loaded" : "empty",
      metrics: {
        activeDomains,
        activeEmailServices,
        failedDomains,
        pendingDomains,
        pendingEmailServices,
        totalDomains: normalizedDomains.length,
        totalEmailServices
      },
      rangeLabel: resolveRangeLabel(selectedRange),
      readOnly: true,
      selectedRange,
      source: DOMAIN_EMAIL_REPORTS_SOURCE,
      status,
      warnings
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Domain & Email Reports runtime failed to load safely.";

    return buildEmptySnapshot(selectedRange, [], message);
  }
}

export function getDomainEmailReportsSummary(snapshot: DomainEmailReportsSnapshot): DomainEmailReportsSummary {
  return {
    lastGeneratedState: snapshot.lastUpdatedAt
      ? `Generated ${snapshot.generatedAt}; latest domain or email activity ${snapshot.lastUpdatedAt}`
      : `Generated ${snapshot.generatedAt}; no domain or email activity timestamps recorded`,
    readOnly: true,
    status: snapshot.status,
    summary: [
      `status ${snapshot.status}`,
      `${snapshot.rangeLabel}`,
      `${snapshot.metrics.totalDomains} total domains`,
      `${snapshot.metrics.activeDomains} active`,
      `${snapshot.metrics.pendingDomains} pending`,
      `${snapshot.metrics.totalEmailServices} email services`
    ].join("; ")
  };
}

export function validateDomainEmailReportsRuntime(
  snapshot: DomainEmailReportsSnapshot
): DomainEmailReportsValidation {
  const issues: string[] = [];

  if (!snapshot.readOnly) {
    issues.push("Domain & Email Reports runtime must remain read-only.");
  }

  if (snapshot.source !== DOMAIN_EMAIL_REPORTS_SOURCE) {
    issues.push("Domain & Email Reports runtime must originate from the domain email reports runtime.");
  }

  if (!snapshot.generatedAt) {
    issues.push("Domain & Email Reports runtime must include generatedAt.");
  }

  if (snapshot.metrics.totalDomains < 0 || snapshot.metrics.totalEmailServices < 0) {
    issues.push("Domain & Email Reports totals must not be negative.");
  }

  return {
    isValid: issues.length === 0,
    issues
  };
}

export async function mapDomainEmailReportsRuntimeToAdminFields(
  range: DomainEmailReportsDateRange = "30d"
) {
  const snapshot = await runDomainEmailReportsSnapshot(range);
  const validation = validateDomainEmailReportsRuntime(snapshot);
  const summary = getDomainEmailReportsSummary(snapshot);

  return {
    domainsByExtension: snapshot.domainsByExtension,
    domainsByProvider: snapshot.domainsByProvider,
    domainsByStatus: snapshot.domainsByStatus,
    errorMessage: snapshot.errorMessage,
    generatedAt: snapshot.generatedAt,
    lastGeneratedState: summary.lastGeneratedState,
    lastUpdatedAt: snapshot.lastUpdatedAt,
    latestDomainActivity: snapshot.latestDomainActivity,
    latestEmailActivity: snapshot.latestEmailActivity,
    loadingState: snapshot.loadingState,
    metrics: snapshot.metrics,
    rangeLabel: snapshot.rangeLabel,
    readOnly: true as const,
    selectedRange: snapshot.selectedRange,
    status: validation.isValid ? summary.status : ("needs_attention" as const),
    summary: validation.isValid
      ? summary.summary
      : "Domain & Email Reports runtime validation requires safe read-only defaults.",
    warnings: [...snapshot.warnings, ...validation.issues]
  };
}
