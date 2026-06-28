import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  getOperationsRegistryEntry,
  OPERATIONS_REGISTRY_SOURCE,
  type OperationsRegistryVisibility
} from "@/src/lib/operations/operations-registry-runtime";

export type OperationsDomainEmailQueueRuntimeSource = "operations_domain_email_queue_runtime";

export type OperationsDomainEmailQueueGroupKey =
  | "dns-queue"
  | "domain-registration-queue"
  | "domain-renewal-queue"
  | "email-mailbox-queue"
  | "future-domain-email-hooks"
  | "hosting-provisioning-queue"
  | "ssl-provisioning-queue";

export type OperationsDomainEmailQueueType =
  | "dns"
  | "domain_registration"
  | "domain_renewal"
  | "email_mailbox"
  | "future_hook"
  | "hosting_provisioning"
  | "ssl_provisioning";

export type OperationsDomainEmailQueueRuntimeStatus =
  | "active"
  | "disabled"
  | "empty"
  | "future_hook"
  | "has_failed_jobs"
  | "has_pending_jobs"
  | "no_table_detected"
  | "registered"
  | "review_required";

export type OperationsDomainEmailQueueReviewStatus = "clear" | "not_applicable" | "review_required";

export type OperationsDomainEmailQueueSafeControlKey =
  | "cancel_pending"
  | "inspect"
  | "pause_queue"
  | "resume_queue"
  | "retry_failed";

export type OperationsDomainEmailQueueSafeControl = {
  enabled: false;
  key: OperationsDomainEmailQueueSafeControlKey;
  label: string;
  note: string;
};

export type OperationsDomainEmailQueueRuntimeItem = {
  cancelledJobs: number;
  completedJobs: number;
  domainEmailQueueKey: string;
  failedJobs: number;
  groupKey: OperationsDomainEmailQueueGroupKey;
  lastFailureAt: string | null;
  lastJobAt: string | null;
  maskedJobCount: number;
  pendingJobs: number;
  processingJobs: number;
  provider: string;
  queueName: string;
  queueType: OperationsDomainEmailQueueType;
  registryKey: string;
  reviewStatus: OperationsDomainEmailQueueReviewStatus;
  runtimeStatus: OperationsDomainEmailQueueRuntimeStatus;
  safeControls: OperationsDomainEmailQueueSafeControl[];
  tableDetected: boolean;
  totalJobs: number;
  visibility: OperationsRegistryVisibility;
};

export type OperationsDomainEmailQueueRuntimeGroup = {
  groupKey: OperationsDomainEmailQueueGroupKey;
  itemCount: number;
  items: OperationsDomainEmailQueueRuntimeItem[];
  title: string;
};

export type OperationsDomainEmailQueueRuntimeSummary = {
  activeQueues: number;
  failedQueues: number;
  groupCount: number;
  readOnly: true;
  registrySource: typeof OPERATIONS_REGISTRY_SOURCE;
  source: OperationsDomainEmailQueueRuntimeSource;
  status: "domain_email_queue_runtime_ready" | "needs_attention";
  summary: string;
  totalQueues: number;
};

type AnyRecord = Record<string, unknown>;

type NormalizedDomainEmailJobRow = {
  cancelledAt: string | null;
  completedAt: string | null;
  createdAt: string | null;
  failedAt: string | null;
  provider: string;
  queueType: OperationsDomainEmailQueueType;
  status: string;
  updatedAt: string | null;
};

type DomainEmailQueueDefinition = {
  domainEmailQueueKey: string;
  groupKey: OperationsDomainEmailQueueGroupKey;
  queueName: string;
  queueType: OperationsDomainEmailQueueType;
  registryKey: string;
  tableDetected: boolean;
};

export const OPERATIONS_DOMAIN_EMAIL_QUEUE_RUNTIME_SOURCE = "operations_domain_email_queue_runtime" as const;

export const OPERATIONS_DOMAIN_EMAIL_QUEUE_SAFE_CONTROLS: readonly OperationsDomainEmailQueueSafeControl[] = [
  {
    enabled: false,
    key: "retry_failed",
    label: "Retry Failed",
    note: "Read-only placeholder. No domain or email queue retry runs during OP-10 page load."
  },
  {
    enabled: false,
    key: "pause_queue",
    label: "Pause Queue",
    note: "Read-only placeholder. No domain or email queue pause runs during OP-10 page load."
  },
  {
    enabled: false,
    key: "resume_queue",
    label: "Resume Queue",
    note: "Read-only placeholder. No domain or email queue resume runs during OP-10 page load."
  },
  {
    enabled: false,
    key: "cancel_pending",
    label: "Cancel Pending",
    note: "Read-only placeholder. No domain or email job cancellation runs during OP-10 page load."
  },
  {
    enabled: false,
    key: "inspect",
    label: "Inspect",
    note: "Read-only placeholder. No owner, customer, DNS value, or provider secret inspection runs during OP-10 page load."
  }
] as const;

const DOMAIN_EMAIL_QUEUE_GROUP_DEFINITIONS: ReadonlyArray<{
  groupKey: OperationsDomainEmailQueueGroupKey;
  title: string;
}> = [
  { groupKey: "domain-registration-queue", title: "Domain Registration Queue" },
  { groupKey: "domain-renewal-queue", title: "Domain Renewal Queue" },
  { groupKey: "dns-queue", title: "DNS Queue" },
  { groupKey: "hosting-provisioning-queue", title: "Hosting Provisioning Queue" },
  { groupKey: "email-mailbox-queue", title: "Email Mailbox Queue" },
  { groupKey: "ssl-provisioning-queue", title: "SSL Provisioning Queue" },
  { groupKey: "future-domain-email-hooks", title: "Future Domain & Email Hooks" }
];

function text(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function dateValue(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function asRecords(value: unknown): AnyRecord[] {
  return Array.isArray(value) ? (value.filter((row) => row && typeof row === "object") as AnyRecord[]) : [];
}

function isMissingTableError(error: { code?: string | null; message?: string | null } | null) {
  if (!error) {
    return false;
  }

  const message = text(error.message).toLowerCase();
  return error.code === "42P01" || message.includes("does not exist") || message.includes("could not find the table");
}

function buildSafeControls() {
  return OPERATIONS_DOMAIN_EMAIL_QUEUE_SAFE_CONTROLS.map((control) => ({ ...control }));
}

function sanitizeProvider(value: unknown) {
  const provider = text(value).toLowerCase();

  if (!provider) {
    return "not_configured";
  }

  if (
    provider.includes("secret") ||
    provider.includes("key") ||
    provider.includes("token") ||
    provider.includes("password") ||
    provider.includes("sk-")
  ) {
    return "masked_provider";
  }

  return provider.slice(0, 80);
}

export function maskDomainOwnerSafe(value: unknown) {
  const owner = text(value).toLowerCase();

  if (!owner) {
    return "[masked-owner]";
  }

  if (owner.includes("@")) {
    const [localPart, domainPart] = owner.split("@");
    const visible = localPart.slice(0, 1) || "*";
    return `${visible}***@${domainPart}`;
  }

  return `${owner.slice(0, 1) || "*"}***`;
}

export function maskCustomerEmailSafe(value: unknown) {
  return maskDomainOwnerSafe(value);
}

function latestDate(values: Array<string | null>) {
  return (
    values
      .filter(Boolean)
      .sort((left, right) => dateValue(right ?? "") - dateValue(left ?? ""))[0] ?? null
  );
}

function resolveReviewStatus(failedJobs: number, tableDetected: boolean): OperationsDomainEmailQueueReviewStatus {
  if (!tableDetected) {
    return "not_applicable";
  }

  if (failedJobs > 0) {
    return "review_required";
  }

  return "clear";
}

function resolveDomainEmailQueueRuntimeStatus(input: {
  failedJobs: number;
  forceDisabled?: boolean;
  forceFutureHook?: boolean;
  pendingJobs: number;
  reviewStatus: OperationsDomainEmailQueueReviewStatus;
  tableDetected: boolean;
  totalJobs: number;
}): OperationsDomainEmailQueueRuntimeStatus {
  if (input.forceFutureHook) {
    return "future_hook";
  }

  if (input.forceDisabled) {
    return "disabled";
  }

  if (!input.tableDetected) {
    return "no_table_detected";
  }

  if (input.failedJobs > 0) {
    return "has_failed_jobs";
  }

  if (input.reviewStatus === "review_required") {
    return "review_required";
  }

  if (input.pendingJobs > 0) {
    return "has_pending_jobs";
  }

  if (input.totalJobs === 0) {
    return "empty";
  }

  if (input.totalJobs > 0) {
    return "active";
  }

  return "registered";
}

function isPendingStatus(status: string) {
  return ["draft", "submitted", "pending", "waiting", "queued", "blocked", "verifying", "not_configured"].includes(
    status
  );
}

function isProcessingStatus(status: string) {
  return ["processing", "running", "active", "configured", "submitted"].includes(status);
}

function isCompletedStatus(status: string) {
  return ["completed", "succeeded", "ready", "verified", "active", "sent"].includes(status);
}

function isFailedStatus(status: string) {
  return status.includes("fail") || status === "failed";
}

function isCancelledStatus(status: string) {
  return status.includes("cancel") || status === "cancelled";
}

function countJobs(rows: NormalizedDomainEmailJobRow[]) {
  const pendingJobs = rows.filter((row) => isPendingStatus(text(row.status).toLowerCase())).length;
  const processingJobs = rows.filter((row) => isProcessingStatus(text(row.status).toLowerCase())).length;
  const completedJobs = rows.filter((row) => isCompletedStatus(text(row.status).toLowerCase())).length;
  const failedJobs = rows.filter((row) => isFailedStatus(text(row.status).toLowerCase())).length;
  const cancelledJobs = rows.filter((row) => isCancelledStatus(text(row.status).toLowerCase())).length;

  return {
    cancelledJobs,
    completedJobs,
    failedJobs,
    pendingJobs,
    processingJobs,
    totalJobs: rows.length
  };
}

function resolvePrimaryProvider(rows: NormalizedDomainEmailJobRow[]) {
  const counts = new Map<string, number>();

  for (const row of rows) {
    const provider = sanitizeProvider(row.provider);

    if (provider === "not_configured" || provider === "masked_provider") {
      continue;
    }

    counts.set(provider, (counts.get(provider) ?? 0) + 1);
  }

  const sorted = [...counts.entries()].sort((left, right) => right[1] - left[1]);
  return sorted[0]?.[0] ?? "not_configured";
}

function normalizeDomainOrderRow(row: AnyRecord, queueType: OperationsDomainEmailQueueType): NormalizedDomainEmailJobRow {
  const status = text(row.status).toLowerCase();

  return {
    cancelledAt: null,
    completedAt: status === "active" ? text(row.created_at) || null : null,
    createdAt: text(row.created_at) || null,
    failedAt: status === "failed" ? text(row.created_at) || null : null,
    provider: sanitizeProvider(row.provider),
    queueType,
    status,
    updatedAt: text(row.created_at) || null
  };
}

function normalizeDnsRecordRow(row: AnyRecord): NormalizedDomainEmailJobRow {
  const status = text(row.status, text(row.verification_status)).toLowerCase();

  return {
    cancelledAt: null,
    completedAt: status === "verified" ? text(row.updated_at, text(row.created_at)) || null : null,
    createdAt: text(row.created_at) || null,
    failedAt: status === "failed" ? text(row.updated_at, text(row.created_at)) || null : null,
    provider: "dns_runtime",
    queueType: "dns",
    status,
    updatedAt: text(row.updated_at, text(row.created_at)) || null
  };
}

function normalizeStoreDomainRow(row: AnyRecord, queueType: OperationsDomainEmailQueueType): NormalizedDomainEmailJobRow {
  const status = text(
    queueType === "ssl_provisioning" ? row.ssl_status : queueType === "dns" ? row.dns_status : row.status
  ).toLowerCase();

  return {
    cancelledAt: null,
    completedAt: ["active", "ready", "verified"].includes(status) ? text(row.updated_at, text(row.created_at)) || null : null,
    createdAt: text(row.created_at) || null,
    failedAt: status === "failed" ? text(row.updated_at, text(row.created_at)) || null : null,
    provider: "hosting_runtime",
    queueType,
    status,
    updatedAt: text(row.updated_at, text(row.created_at)) || null
  };
}

function normalizeMailboxEventRow(row: AnyRecord): NormalizedDomainEmailJobRow {
  const status = text(row.status, text(row.event_status)).toLowerCase();

  return {
    cancelledAt: null,
    completedAt: ["sent", "success", "completed", "recorded"].includes(status) ? text(row.created_at) || null : null,
    createdAt: text(row.created_at) || null,
    failedAt: status === "failed" ? text(row.created_at) || null : null,
    provider: sanitizeProvider(row.provider),
    queueType: "email_mailbox",
    status,
    updatedAt: text(row.created_at) || null
  };
}

function isMailboxTemplateKey(templateKey: string) {
  return /domain_email|mailbox|professional|email_setup|hosting|dns|ssl/i.test(templateKey);
}

function isMailboxMonitoringEvent(row: AnyRecord) {
  const eventType = text(row.event_type).toLowerCase();
  const entityType = text(row.entity_type).toLowerCase();
  return /mailbox|professional.?email|email.?setup|domain.?email/i.test(`${eventType} ${entityType}`);
}

async function safeTableSelect(
  supabase: SupabaseClient<Database>,
  tableName: string,
  columns: string,
  limit: number
): Promise<{ rows: AnyRecord[]; tableDetected: boolean }> {
  try {
    const { data, error } = await supabase.from(tableName as never).select(columns).limit(limit);

    if (error) {
      if (isMissingTableError(error)) {
        return { rows: [], tableDetected: false };
      }

      console.warn(`[operations-domain-email-queue-runtime] read-only ${tableName} select failed`, error.message);
      return { rows: [], tableDetected: false };
    }

    return {
      rows: asRecords(data),
      tableDetected: true
    };
  } catch (error) {
    console.warn(`[operations-domain-email-queue-runtime] read-only ${tableName} select crashed`, error);
    return { rows: [], tableDetected: false };
  }
}

function buildDomainEmailQueueRuntimeItem(input: {
  definition: DomainEmailQueueDefinition;
  rows: NormalizedDomainEmailJobRow[];
}): OperationsDomainEmailQueueRuntimeItem {
  const registryEntry = getOperationsRegistryEntry(input.definition.registryKey);
  const counts = countJobs(input.rows);
  const lastJobAt = latestDate(
    input.rows.flatMap((row) => [row.completedAt, row.updatedAt, row.createdAt])
  );
  const lastFailureAt = latestDate(input.rows.map((row) => row.failedAt));
  const reviewStatus = resolveReviewStatus(counts.failedJobs, input.definition.tableDetected);

  return {
    cancelledJobs: counts.cancelledJobs,
    completedJobs: counts.completedJobs,
    domainEmailQueueKey: input.definition.domainEmailQueueKey,
    failedJobs: counts.failedJobs,
    groupKey: input.definition.groupKey,
    lastFailureAt,
    lastJobAt,
    maskedJobCount: counts.totalJobs,
    pendingJobs: counts.pendingJobs,
    processingJobs: counts.processingJobs,
    provider: resolvePrimaryProvider(input.rows),
    queueName: input.definition.queueName,
    queueType: input.definition.queueType,
    registryKey: input.definition.registryKey,
    reviewStatus,
    runtimeStatus: resolveDomainEmailQueueRuntimeStatus({
      failedJobs: counts.failedJobs,
      pendingJobs: counts.pendingJobs,
      reviewStatus,
      tableDetected: input.definition.tableDetected,
      totalJobs: counts.totalJobs
    }),
    safeControls: buildSafeControls(),
    tableDetected: input.definition.tableDetected,
    totalJobs: counts.totalJobs,
    visibility: registryEntry?.visibility ?? "super_admin"
  };
}

function buildFutureDomainEmailHookItems(): OperationsDomainEmailQueueRuntimeItem[] {
  const registryEntry = getOperationsRegistryEntry("op-future-hooks");
  const hooks = registryEntry?.futureHooks ?? [];

  return hooks
    .filter((hook) => /domain|dns|hosting|email|mailbox|ssl|renew|registr/i.test(hook))
    .map((hook, index) => ({
      cancelledJobs: 0,
      completedJobs: 0,
      domainEmailQueueKey: `op-future-domain-email-hook-${index + 1}`,
      failedJobs: 0,
      groupKey: "future-domain-email-hooks" as const,
      lastFailureAt: null,
      lastJobAt: null,
      maskedJobCount: 0,
      pendingJobs: 0,
      processingJobs: 0,
      provider: "future_hook",
      queueName: hook,
      queueType: "future_hook" as const,
      registryKey: "op-future-hooks",
      reviewStatus: "not_applicable" as const,
      runtimeStatus: "future_hook" as const,
      safeControls: buildSafeControls(),
      tableDetected: false,
      totalJobs: 0,
      visibility: registryEntry?.visibility ?? "super_admin"
    }));
}

export function operationsDomainEmailQueueRuntimeStatusLabel(status: OperationsDomainEmailQueueRuntimeStatus) {
  switch (status) {
    case "active":
      return "Active";
    case "disabled":
      return "Disabled";
    case "empty":
      return "Empty";
    case "future_hook":
      return "Future Hook";
    case "has_failed_jobs":
      return "Has Failed Jobs";
    case "has_pending_jobs":
      return "Has Pending Jobs";
    case "no_table_detected":
      return "No Table Detected";
    case "registered":
      return "Registered";
    case "review_required":
      return "Review Required";
  }
}

export function operationsDomainEmailQueueRuntimeStatusBadgeTone(status: OperationsDomainEmailQueueRuntimeStatus) {
  switch (status) {
    case "active":
    case "registered":
      return "green" as const;
    case "empty":
    case "has_pending_jobs":
      return "blue" as const;
    case "has_failed_jobs":
    case "review_required":
      return "amber" as const;
    case "no_table_detected":
      return "red" as const;
    case "disabled":
    case "future_hook":
      return "slate" as const;
  }
}

export function buildOperationsDomainEmailQueueRuntimeGroups(
  items: OperationsDomainEmailQueueRuntimeItem[]
): OperationsDomainEmailQueueRuntimeGroup[] {
  return DOMAIN_EMAIL_QUEUE_GROUP_DEFINITIONS.map((group) => {
    const groupItems = items.filter((item) => item.groupKey === group.groupKey);

    return {
      groupKey: group.groupKey,
      itemCount: groupItems.length,
      items: groupItems,
      title: group.title
    };
  }).filter((group) => group.itemCount > 0);
}

export function getOperationsDomainEmailQueueRuntimeSummary(
  items: OperationsDomainEmailQueueRuntimeItem[]
): OperationsDomainEmailQueueRuntimeSummary {
  const operationalQueues = items.filter((item) => item.groupKey !== "future-domain-email-hooks");
  const activeQueues = operationalQueues.filter((item) => item.runtimeStatus === "active").length;
  const failedQueues = operationalQueues.filter(
    (item) => item.runtimeStatus === "has_failed_jobs" || item.reviewStatus === "review_required"
  ).length;
  const status =
    failedQueues > 0 || operationalQueues.some((item) => item.runtimeStatus === "no_table_detected")
      ? ("needs_attention" as const)
      : ("domain_email_queue_runtime_ready" as const);

  return {
    activeQueues,
    failedQueues,
    groupCount: buildOperationsDomainEmailQueueRuntimeGroups(items).length,
    readOnly: true,
    registrySource: OPERATIONS_REGISTRY_SOURCE,
    source: OPERATIONS_DOMAIN_EMAIL_QUEUE_RUNTIME_SOURCE,
    status,
    summary: [
      `status ${status}`,
      `${operationalQueues.length} domain & email queue groups`,
      `${activeQueues} active`,
      `${failedQueues} require review`
    ].join("; "),
    totalQueues: items.length
  };
}

export async function loadOperationsDomainEmailQueueRuntimeReadOnlySafe(params: {
  supabase: SupabaseClient<Database>;
}) {
  const [domainOrdersLoad, dnsRecordsLoad, storeDomainsLoad, mailboxEmailLoad, mailboxMonitoringLoad] =
    await Promise.all([
      safeTableSelect(params.supabase, "domain_orders", "id, status, provider, registration_years, created_at", 500),
      safeTableSelect(
        params.supabase,
        "domain_dns_records",
        "id, status, verification_status, record_type, created_at, updated_at",
        500
      ),
      safeTableSelect(
        params.supabase,
        "store_domains",
        "id, status, dns_status, ssl_status, verification_status, domain_type, created_at, updated_at",
        500
      ),
      safeTableSelect(
        params.supabase,
        "email_event_logs",
        "id, status, template_key, provider, created_at, updated_at",
        500
      ),
      safeTableSelect(params.supabase, "monitoring_events", "event_type, event_status, entity_type, created_at", 500)
    ]);

  const registrationRows = domainOrdersLoad.rows
    .filter((row) => text(row.status).toLowerCase() !== "active")
    .map((row) => normalizeDomainOrderRow(row, "domain_registration"));
  const renewalRows = domainOrdersLoad.rows
    .filter((row) => text(row.status).toLowerCase() === "active")
    .map((row) => normalizeDomainOrderRow(row, "domain_renewal"));
  const dnsRows = dnsRecordsLoad.rows.map((row) => normalizeDnsRecordRow(row));
  const hostingRows = storeDomainsLoad.rows.map((row) => normalizeStoreDomainRow(row, "hosting_provisioning"));
  const sslRows = storeDomainsLoad.rows.map((row) => normalizeStoreDomainRow(row, "ssl_provisioning"));
  const mailboxRows = [
    ...mailboxEmailLoad.rows
      .filter((row) => isMailboxTemplateKey(text(row.template_key)))
      .map((row) => normalizeMailboxEventRow(row)),
    ...mailboxMonitoringLoad.rows.filter((row) => isMailboxMonitoringEvent(row)).map((row) => normalizeMailboxEventRow(row))
  ];

  const definitions: DomainEmailQueueDefinition[] = [
    {
      domainEmailQueueKey: "op-domain-email-queue-registration",
      groupKey: "domain-registration-queue",
      queueName: "Domain registration queue",
      queueType: "domain_registration",
      registryKey: "op-domain-email-queue",
      tableDetected: domainOrdersLoad.tableDetected
    },
    {
      domainEmailQueueKey: "op-domain-email-queue-renewal",
      groupKey: "domain-renewal-queue",
      queueName: "Domain renewal queue",
      queueType: "domain_renewal",
      registryKey: "op-domain-email-queue",
      tableDetected: domainOrdersLoad.tableDetected
    },
    {
      domainEmailQueueKey: "op-domain-email-queue-dns",
      groupKey: "dns-queue",
      queueName: "DNS queue",
      queueType: "dns",
      registryKey: "op-domain-email-queue",
      tableDetected: dnsRecordsLoad.tableDetected
    },
    {
      domainEmailQueueKey: "op-domain-email-queue-hosting",
      groupKey: "hosting-provisioning-queue",
      queueName: "Hosting provisioning queue",
      queueType: "hosting_provisioning",
      registryKey: "op-domain-email-queue",
      tableDetected: storeDomainsLoad.tableDetected
    },
    {
      domainEmailQueueKey: "op-domain-email-queue-mailbox",
      groupKey: "email-mailbox-queue",
      queueName: "Email mailbox queue",
      queueType: "email_mailbox",
      registryKey: "op-domain-email-queue",
      tableDetected: mailboxEmailLoad.tableDetected || mailboxMonitoringLoad.tableDetected
    },
    {
      domainEmailQueueKey: "op-domain-email-queue-ssl",
      groupKey: "ssl-provisioning-queue",
      queueName: "SSL provisioning queue",
      queueType: "ssl_provisioning",
      registryKey: "op-domain-email-queue",
      tableDetected: storeDomainsLoad.tableDetected
    }
  ];

  const rowsByQueueType = new Map<OperationsDomainEmailQueueType, NormalizedDomainEmailJobRow[]>([
    ["domain_registration", registrationRows],
    ["domain_renewal", renewalRows],
    ["dns", dnsRows],
    ["hosting_provisioning", hostingRows],
    ["email_mailbox", mailboxRows],
    ["ssl_provisioning", sslRows]
  ]);

  const domainEmailQueues = [
    ...definitions.map((definition) =>
      buildDomainEmailQueueRuntimeItem({
        definition,
        rows: rowsByQueueType.get(definition.queueType) ?? []
      })
    ),
    ...buildFutureDomainEmailHookItems()
  ];
  const groups = buildOperationsDomainEmailQueueRuntimeGroups(domainEmailQueues);
  const summary = getOperationsDomainEmailQueueRuntimeSummary(domainEmailQueues);

  return {
    domainEmailQueues,
    domainEmailQueueRuntime: summary,
    groups,
    safeControls: buildSafeControls()
  };
}

export function mapOperationsDomainEmailQueueRuntimeToAdminFields(
  input: Awaited<ReturnType<typeof loadOperationsDomainEmailQueueRuntimeReadOnlySafe>>
) {
  return {
    domainEmailQueueRuntime: input.domainEmailQueueRuntime,
    domainEmailQueues: input.domainEmailQueues,
    groups: input.groups,
    safeControls: input.safeControls
  };
}
