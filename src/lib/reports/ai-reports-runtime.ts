import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { maskSensitiveText } from "@/lib/integrations/safe-diagnostics";
import { aiVisualQueueFromStoreData } from "@/lib/storefront/ai-visual-queue";
import { createAdminClient } from "@/lib/supabase/admin";

export type AIReportsSource = "ai_reports_runtime";

export type AIReportsDateRange = "today" | "7d" | "30d" | "month" | "year";

export type AIReportsLoadingState = "empty" | "error" | "loaded";

export type AIReportsRuntimeStatus = "needs_attention" | "ready" | "unavailable";

export type AIReportsBreakdownItem = {
  count: number;
  dataAvailability: "available" | "planned";
  label: string;
};

export type AIReportsActivityItem = {
  activityAt: string;
  dataAvailability: "available" | "planned";
  feature: string;
  provider: string;
  scopeLabel: string;
  status: string;
};

export type AIReportsMetrics = {
  blockedOrUnsafeAttempts: number;
  creditsUsage: number;
  estimatedCost: number;
  failedAIRequests: number;
  successfulAIRequests: number;
  totalAIRequests: number;
};

export type AIReportsSnapshot = {
  dataSources: string[];
  errorMessage: string | null;
  generatedAt: string;
  lastUpdatedAt: string | null;
  latestAIActivity: AIReportsActivityItem[];
  loadingState: AIReportsLoadingState;
  metrics: AIReportsMetrics;
  rangeLabel: string;
  readOnly: true;
  selectedRange: AIReportsDateRange;
  source: AIReportsSource;
  status: AIReportsRuntimeStatus;
  usageByFeature: AIReportsBreakdownItem[];
  usageByUserRole: AIReportsBreakdownItem[];
  usageByWorkspaceOrStore: AIReportsBreakdownItem[];
  warnings: string[];
};

export type AIReportsSummary = {
  lastGeneratedState: string;
  readOnly: true;
  status: AIReportsRuntimeStatus;
  summary: string;
};

export type AIReportsValidation = {
  isValid: boolean;
  issues: string[];
};

export const AI_REPORTS_SOURCE = "ai_reports_runtime" as const;

type NormalizedAIRequest = {
  activityAt: string;
  blocked: boolean;
  costEstimate: number;
  feature: string;
  provider: string;
  scopeLabel: string;
  source: string;
  status: "failed" | "other" | "successful";
  userId: string | null;
};

type RawRecord = Record<string, unknown>;

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

function isRecord(value: unknown): value is RawRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeStatus(value: string) {
  const status = value.toLowerCase();

  if (["completed", "succeeded", "ready", "success"].includes(status)) {
    return "successful" as const;
  }

  if (status === "failed" || status.includes("error") || status === "timeout") {
    return "failed" as const;
  }

  return "other" as const;
}

function normalizeProvider(value: unknown) {
  const cleaned = text(value, "unknown").toLowerCase();

  if (cleaned.includes("openai")) {
    return "openai";
  }

  if (cleaned.includes("replicate")) {
    return "replicate";
  }

  if (cleaned.includes("stability")) {
    return "stability";
  }

  if (cleaned.includes("workflow")) {
    return "workflow";
  }

  return cleaned || "unknown";
}

function aiVisualJobCost(job: RawRecord) {
  const providerPlan = isRecord(job.providerPlan) ? job.providerPlan : {};
  const explicitCost = numberValue(providerPlan.estimatedCostUsd ?? providerPlan.estimatedCost);

  if (explicitCost > 0) {
    return explicitCost;
  }

  const kind = text(job.kind);

  if (kind.includes("hero") || kind.includes("banner")) {
    return 0.08;
  }

  return text(job.status) === "completed" ? 0.04 : 0;
}

function storeLabel(row: RawRecord | undefined, fallback = "Unknown store") {
  if (!row) {
    return fallback;
  }

  return text(row.store_name, text(row.name, text(row.slug, fallback)));
}

function resolveRangeLabel(range: AIReportsDateRange) {
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

function resolveRangeStart(range: AIReportsDateRange) {
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
      warning: "Service-role admin access is unavailable. AI report aggregates are empty."
    };
  }

  const { data, error } = await admin.from(table as never).select(columns as never).limit(5000);

  if (error) {
    return {
      records: [] as RawRecord[],
      warning: `AI report source ${table} could not be loaded safely.`
    };
  }

  return {
    records: asRecords(data),
    warning: null as string | null
  };
}

function incrementBreakdown(map: Map<string, AIReportsBreakdownItem>, label: string, planned = false) {
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

function jobsFromStores(rows: RawRecord[]): NormalizedAIRequest[] {
  const jobs: NormalizedAIRequest[] = [];

  for (const row of rows) {
    const queue = aiVisualQueueFromStoreData(row.store_data);
    const scopeLabel = storeLabel(row);

    for (const job of Object.values(queue.jobs) as RawRecord[]) {
      const activityAt = text(job.createdAt) || text(row.created_at);

      if (!activityAt) {
        continue;
      }

      jobs.push({
        activityAt,
        blocked: false,
        costEstimate: aiVisualJobCost(job),
        feature: text(job.kind, text(job.slot, "ai_visual")),
        provider: normalizeProvider(job.provider),
        scopeLabel,
        source: "store_visual_queue",
        status: normalizeStatus(text(job.status, "queued")),
        userId: text(job.requestedByUserId) || text(row.owner_user_id) || text(row.user_id) || null
      });
    }
  }

  return jobs;
}

function jobsFromQueue(rows: RawRecord[], storeById: Map<string, RawRecord>): NormalizedAIRequest[] {
  return rows.map((row) => {
    const storeId = text(row.store_instance_id);
    const store = storeById.get(storeId);

    return {
      activityAt: text(row.created_at) || text(row.updated_at),
      blocked: false,
      costEstimate: 0,
      feature: text(row.workflow_state, "store_generation"),
      provider: normalizeProvider("workflow"),
      scopeLabel: storeLabel(store, "AI workflow"),
      source: "ai_generation_queue",
      status: normalizeStatus(text(row.queue_status, text(row.workflow_state, "queued"))),
      userId: text(row.owner_user_id) || null
    };
  });
}

function jobsFromResults(rows: RawRecord[], storeById: Map<string, RawRecord>): NormalizedAIRequest[] {
  return rows.map((row) => {
    const storeId = text(row.store_instance_id);
    const store = storeById.get(storeId);
    const rawStatus = text(row.result_status, "unknown");

    return {
      activityAt: text(row.created_at) || text(row.updated_at),
      blocked: false,
      costEstimate: 0,
      feature: "legacy_ai_generation_result",
      provider: normalizeProvider("ai_result"),
      scopeLabel: storeLabel(store, "AI result"),
      source: "ai_generation_results",
      status: normalizeStatus(rawStatus),
      userId: text(row.owner_user_id) || null
    };
  });
}

function blockedAttemptsFromAudit(rows: RawRecord[], rangeStart: Date) {
  let count = 0;

  for (const row of rows) {
    const activityAt = text(row.created_at);

    if (!isWithinRange(activityAt, rangeStart)) {
      continue;
    }

    const status = text(row.status).toLowerCase();
    const eventType = text(row.event_type).toLowerCase();
    const errorCode = text(row.error_code).toLowerCase();

    if (
      status === "blocked" ||
      eventType.includes("blocked") ||
      errorCode.includes("blocked") ||
      eventType.includes("insufficient")
    ) {
      count += 1;
    }
  }

  return count;
}

function buildUserRoleMap(accountRoles: RawRecord[], teamMembers: RawRecord[]) {
  const roleByUser = new Map<string, string>();

  for (const row of accountRoles) {
    const userId = text(row.user_id);

    if (userId) {
      roleByUser.set(userId, text(row.role, "account_user"));
    }
  }

  for (const row of teamMembers) {
    const userId = text(row.user_id);

    if (userId) {
      roleByUser.set(userId, text(row.role, "internal_team"));
    }
  }

  return roleByUser;
}

function resolveUserRole(userId: string | null, roleByUser: Map<string, string>) {
  if (!userId) {
    return "unknown_user";
  }

  return roleByUser.get(userId) ?? "owner_or_member";
}

function buildEmptySnapshot(
  range: AIReportsDateRange,
  warnings: string[],
  errorMessage: string | null = null
): AIReportsSnapshot {
  return {
    dataSources: [],
    errorMessage,
    generatedAt: new Date().toISOString(),
    lastUpdatedAt: null,
    latestAIActivity: [],
    loadingState: errorMessage ? "error" : warnings.length ? "empty" : "loaded",
    metrics: {
      blockedOrUnsafeAttempts: 0,
      creditsUsage: 0,
      estimatedCost: 0,
      failedAIRequests: 0,
      successfulAIRequests: 0,
      totalAIRequests: 0
    },
    rangeLabel: resolveRangeLabel(range),
    readOnly: true,
    selectedRange: range,
    source: AI_REPORTS_SOURCE,
    status: errorMessage ? "unavailable" : warnings.length ? "needs_attention" : "ready",
    usageByFeature: [],
    usageByUserRole: [],
    usageByWorkspaceOrStore: [],
    warnings
  };
}

export async function runAIReportsSnapshot(range: AIReportsDateRange = "30d"): Promise<AIReportsSnapshot> {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    return buildEmptySnapshot(range, ["Super Admin access is required for AI Reports runtime."]);
  }

  const selectedRange = range;
  const rangeStart = resolveRangeStart(selectedRange);
  const warnings: string[] = [];
  const dataSources: string[] = [];
  let lastUpdatedAt: string | null = null;

  try {
    const [
      storesResult,
      queueResult,
      resultsResult,
      auditResult,
      creditLedgerResult,
      accountRolesResult,
      teamMembersResult,
      monitoringResult
    ] = await Promise.all([
      safeAdminSelect(
        "stores",
        "id, owner_user_id, user_id, workspace_id, name, store_name, slug, store_data, created_at"
      ),
      safeAdminSelect(
        "ai_generation_queue",
        "id, store_instance_id, owner_user_id, workflow_state, queue_status, created_at, updated_at"
      ),
      safeAdminSelect(
        "ai_generation_results",
        "id, store_instance_id, owner_user_id, result_status, created_at, updated_at"
      ),
      safeAdminSelect(
        "ai_audit_logs",
        "event_type, provider_key, store_id, workspace_id, user_id, asset_type, status, error_code, created_at"
      ),
      safeAdminSelect(
        "openai_credit_ledger",
        "operation, status, amount, store_id, user_id, workspace_id, asset_type, created_at"
      ),
      safeAdminSelect("account_roles", "user_id, role, status, created_at"),
      safeAdminSelect("internal_team_members", "user_id, role, status, created_at"),
      safeAdminSelect(
        "monitoring_events",
        "event_type, event_status, entity_type, created_at"
      )
    ]);

    for (const result of [
      storesResult,
      queueResult,
      resultsResult,
      auditResult,
      creditLedgerResult,
      accountRolesResult,
      teamMembersResult,
      monitoringResult
    ]) {
      if (result.warning) {
        warnings.push(result.warning);
      }
    }

    if (storesResult.records.length) {
      dataSources.push("stores");
    }

    if (queueResult.records.length) {
      dataSources.push("ai_generation_queue");
    }

    if (resultsResult.records.length) {
      dataSources.push("ai_generation_results");
    }

    if (auditResult.records.length) {
      dataSources.push("ai_audit_logs");
    }

    if (creditLedgerResult.records.length) {
      dataSources.push("openai_credit_ledger");
    }

    if (accountRolesResult.records.length) {
      dataSources.push("account_roles");
    }

    if (teamMembersResult.records.length) {
      dataSources.push("internal_team_members");
    }

    if (monitoringResult.records.length) {
      dataSources.push("monitoring_events");
    }

    const storeById = new Map(storesResult.records.map((store) => [text(store.id), store]));
    const roleByUser = buildUserRoleMap(accountRolesResult.records, teamMembersResult.records);

    const allRequests = [
      ...jobsFromStores(storesResult.records),
      ...jobsFromQueue(queueResult.records, storeById),
      ...jobsFromResults(resultsResult.records, storeById)
    ].filter((request) => request.activityAt && isWithinRange(request.activityAt, rangeStart));

    let blockedOrUnsafeAttempts = blockedAttemptsFromAudit(auditResult.records, rangeStart);

    for (const row of creditLedgerResult.records) {
      const activityAt = text(row.created_at);
      const status = text(row.status).toLowerCase();

      if (!isWithinRange(activityAt, rangeStart)) {
        continue;
      }

      if (status === "blocked") {
        blockedOrUnsafeAttempts += 1;
      }
    }

    for (const event of monitoringResult.records) {
      const activityAt = text(event.created_at);
      const eventType = text(event.event_type).toLowerCase();
      const entityType = text(event.entity_type).toLowerCase();

      if (!isWithinRange(activityAt, rangeStart)) {
        continue;
      }

      if (
        (eventType.includes("ai_usage_limit") || entityType.includes("ai")) &&
        text(event.event_status) === "failed"
      ) {
        blockedOrUnsafeAttempts += 1;
      }
    }

    const usageByFeature = new Map<string, AIReportsBreakdownItem>();
    const usageByUserRole = new Map<string, AIReportsBreakdownItem>();
    const usageByWorkspaceOrStore = new Map<string, AIReportsBreakdownItem>();

    let totalAIRequests = 0;
    let successfulAIRequests = 0;
    let failedAIRequests = 0;
    let estimatedCost = 0;
    let creditsUsage = 0;

    for (const request of allRequests) {
      totalAIRequests += 1;
      estimatedCost += request.costEstimate;

      if (request.activityAt && (!lastUpdatedAt || dateValue(request.activityAt) > dateValue(lastUpdatedAt))) {
        lastUpdatedAt = request.activityAt;
      }

      if (request.status === "successful") {
        successfulAIRequests += 1;
      } else if (request.status === "failed") {
        failedAIRequests += 1;
      }

      incrementBreakdown(usageByFeature, request.feature);
      incrementBreakdown(usageByUserRole, resolveUserRole(request.userId, roleByUser));
      incrementBreakdown(usageByWorkspaceOrStore, request.scopeLabel);
    }

    for (const row of creditLedgerResult.records) {
      const activityAt = text(row.created_at);
      const operation = text(row.operation).toLowerCase();
      const status = text(row.status).toLowerCase();

      if (!isWithinRange(activityAt, rangeStart)) {
        continue;
      }

      if (operation === "deduction" || status === "charged") {
        creditsUsage += numberValue(row.amount);
      }

      if (activityAt && (!lastUpdatedAt || dateValue(activityAt) > dateValue(lastUpdatedAt))) {
        lastUpdatedAt = activityAt;
      }
    }

    if (!creditLedgerResult.records.length) {
      warnings.push("Credit usage breakdown is planned until openai_credit_ledger rows are available.");
    }

    if (!accountRolesResult.records.length && !teamMembersResult.records.length) {
      warnings.push("User role breakdown uses safe defaults until account role sources are available.");
      incrementBreakdown(usageByUserRole, "planned_role_mapping", true);
    }

    const latestAIActivity = [...allRequests]
      .sort((left, right) => dateValue(right.activityAt) - dateValue(left.activityAt))
      .slice(0, 8)
      .map((request) => ({
        activityAt: request.activityAt,
        dataAvailability: "available" as const,
        feature: request.feature,
        provider: request.provider,
        scopeLabel: request.scopeLabel,
        status: request.status
      }));

    const status: AIReportsRuntimeStatus =
      warnings.length || failedAIRequests > 0 || blockedOrUnsafeAttempts > 0
        ? "needs_attention"
        : dataSources.length
          ? "ready"
          : "unavailable";

    return {
      dataSources,
      errorMessage: null,
      generatedAt: new Date().toISOString(),
      lastUpdatedAt,
      latestAIActivity,
      loadingState: dataSources.length ? "loaded" : "empty",
      metrics: {
        blockedOrUnsafeAttempts,
        creditsUsage,
        estimatedCost,
        failedAIRequests,
        successfulAIRequests,
        totalAIRequests
      },
      rangeLabel: resolveRangeLabel(selectedRange),
      readOnly: true,
      selectedRange,
      source: AI_REPORTS_SOURCE,
      status,
      usageByFeature: [...usageByFeature.values()].sort((left, right) => right.count - left.count),
      usageByUserRole: [...usageByUserRole.values()].sort((left, right) => right.count - left.count),
      usageByWorkspaceOrStore: [...usageByWorkspaceOrStore.values()].sort(
        (left, right) => right.count - left.count
      ),
      warnings
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI Reports runtime failed to load safely.";

    return buildEmptySnapshot(selectedRange, [], message);
  }
}

export function getAIReportsSummary(snapshot: AIReportsSnapshot): AIReportsSummary {
  return {
    lastGeneratedState: snapshot.lastUpdatedAt
      ? `Generated ${snapshot.generatedAt}; latest AI activity ${snapshot.lastUpdatedAt}`
      : `Generated ${snapshot.generatedAt}; no AI activity timestamps recorded`,
    readOnly: true,
    status: snapshot.status,
    summary: [
      `status ${snapshot.status}`,
      `${snapshot.rangeLabel}`,
      `${snapshot.metrics.totalAIRequests} total AI requests`,
      `${snapshot.metrics.successfulAIRequests} successful`,
      `${snapshot.metrics.failedAIRequests} failed`,
      `${snapshot.metrics.blockedOrUnsafeAttempts} blocked or unsafe attempts`
    ].join("; ")
  };
}

export function validateAIReportsRuntime(snapshot: AIReportsSnapshot): AIReportsValidation {
  const issues: string[] = [];

  if (!snapshot.readOnly) {
    issues.push("AI Reports runtime must remain read-only.");
  }

  if (snapshot.source !== AI_REPORTS_SOURCE) {
    issues.push("AI Reports runtime must originate from the AI reports runtime.");
  }

  if (!snapshot.generatedAt) {
    issues.push("AI Reports runtime must include generatedAt.");
  }

  if (snapshot.metrics.totalAIRequests < 0 || snapshot.metrics.estimatedCost < 0) {
    issues.push("AI Reports totals must not be negative.");
  }

  return {
    isValid: issues.length === 0,
    issues
  };
}

export async function mapAIReportsRuntimeToAdminFields(range: AIReportsDateRange = "30d") {
  const snapshot = await runAIReportsSnapshot(range);
  const validation = validateAIReportsRuntime(snapshot);
  const summary = getAIReportsSummary(snapshot);

  return {
    errorMessage: snapshot.errorMessage,
    generatedAt: snapshot.generatedAt,
    lastGeneratedState: summary.lastGeneratedState,
    lastUpdatedAt: snapshot.lastUpdatedAt,
    latestAIActivity: snapshot.latestAIActivity,
    loadingState: snapshot.loadingState,
    metrics: snapshot.metrics,
    rangeLabel: snapshot.rangeLabel,
    readOnly: true as const,
    selectedRange: snapshot.selectedRange,
    status: validation.isValid ? summary.status : ("needs_attention" as const),
    summary: validation.isValid
      ? summary.summary
      : "AI Reports runtime validation requires safe read-only defaults.",
    usageByFeature: snapshot.usageByFeature,
    usageByUserRole: snapshot.usageByUserRole,
    usageByWorkspaceOrStore: snapshot.usageByWorkspaceOrStore,
    warnings: [...snapshot.warnings, ...validation.issues]
  };
}
