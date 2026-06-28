import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  getOperationsRegistryEntry,
  OPERATIONS_REGISTRY_SOURCE,
  type OperationsRegistryVisibility
} from "@/src/lib/operations/operations-registry-runtime";

export type OperationsEmailQueueRuntimeSource = "operations_email_queue_runtime";

export type OperationsEmailQueueGroupKey =
  | "billing-email-queue"
  | "future-email-queue-hooks"
  | "marketing-email-queue"
  | "notification-email-queue"
  | "report-email-queue"
  | "transactional-email-queue"
  | "verification-email-queue";

export type OperationsEmailQueueRuntimeStatus =
  | "active"
  | "disabled"
  | "empty"
  | "future_hook"
  | "has_failed_emails"
  | "has_pending_emails"
  | "no_table_detected"
  | "registered"
  | "review_required";

export type OperationsEmailQueueReviewStatus = "clear" | "not_applicable" | "review_required";

export type OperationsEmailQueueSafeControlKey = "cancel_pending" | "inspect" | "pause_queue" | "resume_queue" | "retry_failed";

export type OperationsEmailQueueSafeControl = {
  enabled: false;
  key: OperationsEmailQueueSafeControlKey;
  label: string;
  note: string;
};

export type OperationsEmailQueueRuntimeItem = {
  cancelledEmails: number;
  emailQueueKey: string;
  failedEmails: number;
  groupKey: OperationsEmailQueueGroupKey;
  lastEmailAt: string | null;
  lastFailureAt: string | null;
  maskedRecipientCount: number;
  pendingEmails: number;
  processingEmails: number;
  provider: string;
  queueName: string;
  registryKey: string;
  reviewStatus: OperationsEmailQueueReviewStatus;
  runtimeStatus: OperationsEmailQueueRuntimeStatus;
  safeControls: OperationsEmailQueueSafeControl[];
  sentEmails: number;
  tableDetected: boolean;
  totalEmails: number;
  visibility: OperationsRegistryVisibility;
};

export type OperationsEmailQueueRuntimeGroup = {
  groupKey: OperationsEmailQueueGroupKey;
  itemCount: number;
  items: OperationsEmailQueueRuntimeItem[];
  title: string;
};

export type OperationsEmailQueueRuntimeSummary = {
  activeQueues: number;
  failedQueues: number;
  groupCount: number;
  readOnly: true;
  registrySource: typeof OPERATIONS_REGISTRY_SOURCE;
  source: OperationsEmailQueueRuntimeSource;
  status: "email_queue_runtime_ready" | "needs_attention";
  summary: string;
  totalQueues: number;
};

type AnyRecord = Record<string, unknown>;

type EmailQueueGroupDefinition = {
  emailQueueKey: string;
  groupKey: OperationsEmailQueueGroupKey;
  matchesTemplateKey: (templateKey: string) => boolean;
  queueName: string;
  registryKey: string;
};

export const OPERATIONS_EMAIL_QUEUE_RUNTIME_SOURCE = "operations_email_queue_runtime" as const;

export const OPERATIONS_EMAIL_QUEUE_SAFE_CONTROLS: readonly OperationsEmailQueueSafeControl[] = [
  {
    enabled: false,
    key: "retry_failed",
    label: "Retry Failed",
    note: "Read-only placeholder. No email retry is executed during OP-8 page load."
  },
  {
    enabled: false,
    key: "pause_queue",
    label: "Pause Queue",
    note: "Read-only placeholder. No email queue pause runs during OP-8 page load."
  },
  {
    enabled: false,
    key: "resume_queue",
    label: "Resume Queue",
    note: "Read-only placeholder. No email queue resume runs during OP-8 page load."
  },
  {
    enabled: false,
    key: "cancel_pending",
    label: "Cancel Pending",
    note: "Read-only placeholder. No email cancellation runs during OP-8 page load."
  },
  {
    enabled: false,
    key: "inspect",
    label: "Inspect",
    note: "Read-only placeholder. No email body or recipient inspection runs during OP-8 page load."
  }
] as const;

const EMAIL_QUEUE_GROUP_DEFINITIONS: ReadonlyArray<{
  groupKey: OperationsEmailQueueGroupKey;
  title: string;
}> = [
  { groupKey: "transactional-email-queue", title: "Transactional Email Queue" },
  { groupKey: "verification-email-queue", title: "Verification Email Queue" },
  { groupKey: "billing-email-queue", title: "Billing Email Queue" },
  { groupKey: "notification-email-queue", title: "Notification Email Queue" },
  { groupKey: "marketing-email-queue", title: "Marketing Email Queue" },
  { groupKey: "report-email-queue", title: "Report Email Queue" },
  { groupKey: "future-email-queue-hooks", title: "Future Email Queue Hooks" }
];

const EMAIL_QUEUE_DEFINITIONS: readonly EmailQueueGroupDefinition[] = [
  {
    emailQueueKey: "op-email-queue-transactional",
    groupKey: "transactional-email-queue",
    matchesTemplateKey: (templateKey) =>
      [
        "order_confirmation",
        "order_status_update",
        "thank_you",
        "review_request",
        "review_reminder",
        "customer_welcome"
      ].includes(templateKey),
    queueName: "Transactional email queue",
    registryKey: "op-email-queue"
  },
  {
    emailQueueKey: "op-email-queue-verification",
    groupKey: "verification-email-queue",
    matchesTemplateKey: (templateKey) =>
      templateKey.includes("verify") || templateKey.includes("verification") || templateKey.includes("confirm"),
    queueName: "Verification email queue",
    registryKey: "op-email-queue"
  },
  {
    emailQueueKey: "op-email-queue-billing",
    groupKey: "billing-email-queue",
    matchesTemplateKey: (templateKey) =>
      templateKey.includes("billing") ||
      templateKey.includes("invoice") ||
      templateKey.includes("subscription") ||
      templateKey.includes("payment"),
    queueName: "Billing email queue",
    registryKey: "op-email-queue"
  },
  {
    emailQueueKey: "op-email-queue-notification",
    groupKey: "notification-email-queue",
    matchesTemplateKey: (templateKey) =>
      templateKey.includes("notification") ||
      templateKey.includes("alert") ||
      templateKey === "low_stock_alert",
    queueName: "Notification email queue",
    registryKey: "op-email-queue"
  },
  {
    emailQueueKey: "op-email-queue-marketing",
    groupKey: "marketing-email-queue",
    matchesTemplateKey: (templateKey) =>
      templateKey.includes("campaign") ||
      templateKey.includes("marketing") ||
      templateKey.includes("abandoned_cart"),
    queueName: "Marketing email queue",
    registryKey: "op-email-queue"
  },
  {
    emailQueueKey: "op-email-queue-report",
    groupKey: "report-email-queue",
    matchesTemplateKey: (templateKey) => templateKey.includes("report") || templateKey.includes("export"),
    queueName: "Report email queue",
    registryKey: "op-email-queue"
  }
] as const;

function text(value: unknown, maxLength = 500) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : "";
}

function dateValue(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function asRecords(value: unknown): AnyRecord[] {
  return Array.isArray(value) ? value.filter((row) => row && typeof row === "object") as AnyRecord[] : [];
}

function isMissingTableError(error: { code?: string | null; message?: string | null } | null) {
  if (!error) {
    return false;
  }

  const message = text(error.message).toLowerCase();
  return error.code === "42P01" || message.includes("does not exist") || message.includes("could not find the table");
}

function buildSafeControls() {
  return OPERATIONS_EMAIL_QUEUE_SAFE_CONTROLS.map((control) => ({ ...control }));
}

function sanitizeProvider(value: unknown) {
  const provider = text(value, 80).toLowerCase();

  if (!provider) {
    return "not_configured";
  }

  if (provider.includes("secret") || provider.includes("key") || provider.includes("token") || provider.includes("password")) {
    return "masked_provider";
  }

  return provider;
}

export function maskEmailRecipientSafe(value: unknown) {
  const recipient = text(value, 320).toLowerCase();

  if (!recipient || !recipient.includes("@")) {
    return "[masked-recipient]";
  }

  const [localPart, domainPart] = recipient.split("@");

  if (!localPart || !domainPart) {
    return "[masked-recipient]";
  }

  const visible = localPart.slice(0, 1) || "*";
  return `${visible}***@${domainPart}`;
}

function latestDate(rows: AnyRecord[], keys: string[]) {
  return (
    rows
      .flatMap((row) => keys.map((key) => text(row[key])).filter(Boolean))
      .sort((left, right) => dateValue(right) - dateValue(left))[0] ?? null
  );
}

function resolveReviewStatus(failedEmails: number, tableDetected: boolean): OperationsEmailQueueReviewStatus {
  if (!tableDetected) {
    return "not_applicable";
  }

  if (failedEmails > 0) {
    return "review_required";
  }

  return "clear";
}

function resolveEmailQueueRuntimeStatus(input: {
  failedEmails: number;
  forceDisabled?: boolean;
  forceFutureHook?: boolean;
  pendingEmails: number;
  reviewStatus: OperationsEmailQueueReviewStatus;
  tableDetected: boolean;
  totalEmails: number;
}): OperationsEmailQueueRuntimeStatus {
  if (input.forceFutureHook) {
    return "future_hook";
  }

  if (input.forceDisabled) {
    return "disabled";
  }

  if (!input.tableDetected) {
    return "no_table_detected";
  }

  if (input.failedEmails > 0) {
    return "has_failed_emails";
  }

  if (input.reviewStatus === "review_required") {
    return "review_required";
  }

  if (input.pendingEmails > 0) {
    return "has_pending_emails";
  }

  if (input.totalEmails === 0) {
    return "empty";
  }

  if (input.totalEmails > 0) {
    return "active";
  }

  return "registered";
}

function resolvePrimaryProvider(rows: AnyRecord[]) {
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

function partitionEmailQueueRows(rows: AnyRecord[]) {
  const assignments = new Map<string, AnyRecord[]>(
    EMAIL_QUEUE_DEFINITIONS.map((definition) => [definition.emailQueueKey, [] as AnyRecord[]])
  );
  const unmatched: AnyRecord[] = [];

  for (const row of rows) {
    const templateKey = text(row.template_key, 120).toLowerCase();
    const definition = EMAIL_QUEUE_DEFINITIONS.find((entry) => entry.matchesTemplateKey(templateKey));

    if (definition) {
      assignments.get(definition.emailQueueKey)?.push(row);
    } else {
      unmatched.push(row);
    }
  }

  if (unmatched.length) {
    assignments.get("op-email-queue-transactional")?.push(...unmatched);
  }

  return assignments;
}

function buildEmailQueueRuntimeItem(input: {
  definition: EmailQueueGroupDefinition;
  rows: AnyRecord[];
  tableDetected: boolean;
}): OperationsEmailQueueRuntimeItem {
  const registryEntry = getOperationsRegistryEntry(input.definition.registryKey);
  const groupRows = input.rows.filter((row) =>
    input.definition.matchesTemplateKey(text(row.template_key, 120).toLowerCase())
  );
  const pendingEmails = groupRows.filter((row) =>
    ["pending", "queued", "retry_pending"].includes(text(row.status).toLowerCase())
  ).length;
  const processingEmails = groupRows.filter((row) => text(row.status).toLowerCase() === "processing").length;
  const sentEmails = groupRows.filter((row) => text(row.status).toLowerCase() === "sent").length;
  const failedEmails = groupRows.filter((row) => text(row.status).toLowerCase() === "failed").length;
  const cancelledEmails = groupRows.filter((row) => text(row.status).toLowerCase() === "cancelled").length;
  const totalEmails = groupRows.length;
  const lastEmailAt = latestDate(groupRows, ["sent_at", "updated_at", "created_at"]);
  const lastFailureAt = latestDate(
    groupRows.filter((row) => text(row.status).toLowerCase() === "failed"),
    ["updated_at", "created_at", "sent_at"]
  );
  const reviewStatus = resolveReviewStatus(failedEmails, input.tableDetected);

  return {
    cancelledEmails,
    emailQueueKey: input.definition.emailQueueKey,
    failedEmails,
    groupKey: input.definition.groupKey,
    lastEmailAt,
    lastFailureAt,
    maskedRecipientCount: totalEmails,
    pendingEmails,
    processingEmails,
    provider: resolvePrimaryProvider(groupRows),
    queueName: input.definition.queueName,
    registryKey: input.definition.registryKey,
    reviewStatus,
    runtimeStatus: resolveEmailQueueRuntimeStatus({
      failedEmails,
      pendingEmails,
      reviewStatus,
      tableDetected: input.tableDetected,
      totalEmails
    }),
    safeControls: buildSafeControls(),
    sentEmails,
    tableDetected: input.tableDetected,
    totalEmails,
    visibility: registryEntry?.visibility ?? "super_admin"
  };
}

function buildFutureEmailQueueHookItems(): OperationsEmailQueueRuntimeItem[] {
  const registryEntry = getOperationsRegistryEntry("op-future-hooks");
  const hooks = registryEntry?.futureHooks ?? [];

  return hooks
    .filter((hook) => /email|queue|retry|drain/i.test(hook))
    .map((hook, index) => ({
      cancelledEmails: 0,
      emailQueueKey: `op-future-email-queue-hook-${index + 1}`,
      failedEmails: 0,
      groupKey: "future-email-queue-hooks" as const,
      lastEmailAt: null,
      lastFailureAt: null,
      maskedRecipientCount: 0,
      pendingEmails: 0,
      processingEmails: 0,
      provider: "future_hook",
      queueName: hook,
      registryKey: "op-future-hooks",
      reviewStatus: "not_applicable" as const,
      runtimeStatus: "future_hook" as const,
      safeControls: buildSafeControls(),
      sentEmails: 0,
      tableDetected: false,
      totalEmails: 0,
      visibility: registryEntry?.visibility ?? "super_admin"
    }));
}

async function safeEmailQueueTableSelect(
  supabase: SupabaseClient<Database>,
  limit: number
): Promise<{ rows: AnyRecord[]; tableDetected: boolean }> {
  try {
    const { data, error } = await supabase
      .from("email_event_logs" as never)
      .select("id, status, template_key, provider, created_at, updated_at, sent_at")
      .limit(limit);

    if (error) {
      if (isMissingTableError(error)) {
        return { rows: [], tableDetected: false };
      }

      console.warn("[operations-email-queue-runtime] read-only email queue select failed", error.message);
      return { rows: [], tableDetected: false };
    }

    return {
      rows: asRecords(data),
      tableDetected: true
    };
  } catch (error) {
    console.warn("[operations-email-queue-runtime] read-only email queue select crashed", error);
    return { rows: [], tableDetected: false };
  }
}

export function operationsEmailQueueRuntimeStatusLabel(status: OperationsEmailQueueRuntimeStatus) {
  switch (status) {
    case "active":
      return "Active";
    case "disabled":
      return "Disabled";
    case "empty":
      return "Empty";
    case "future_hook":
      return "Future Hook";
    case "has_failed_emails":
      return "Has Failed Emails";
    case "has_pending_emails":
      return "Has Pending Emails";
    case "no_table_detected":
      return "No Table Detected";
    case "registered":
      return "Registered";
    case "review_required":
      return "Review Required";
  }
}

export function operationsEmailQueueRuntimeStatusBadgeTone(status: OperationsEmailQueueRuntimeStatus) {
  switch (status) {
    case "active":
    case "registered":
      return "green" as const;
    case "empty":
    case "has_pending_emails":
      return "blue" as const;
    case "has_failed_emails":
    case "review_required":
      return "amber" as const;
    case "no_table_detected":
      return "red" as const;
    case "disabled":
    case "future_hook":
      return "slate" as const;
  }
}

export function buildOperationsEmailQueueRuntimeGroups(
  items: OperationsEmailQueueRuntimeItem[]
): OperationsEmailQueueRuntimeGroup[] {
  return EMAIL_QUEUE_GROUP_DEFINITIONS.map((group) => {
    const groupItems = items.filter((item) => item.groupKey === group.groupKey);

    return {
      groupKey: group.groupKey,
      itemCount: groupItems.length,
      items: groupItems,
      title: group.title
    };
  }).filter((group) => group.itemCount > 0);
}

export function getOperationsEmailQueueRuntimeSummary(
  items: OperationsEmailQueueRuntimeItem[]
): OperationsEmailQueueRuntimeSummary {
  const operationalQueues = items.filter((item) => item.groupKey !== "future-email-queue-hooks");
  const activeQueues = operationalQueues.filter((item) => item.runtimeStatus === "active").length;
  const failedQueues = operationalQueues.filter(
    (item) => item.runtimeStatus === "has_failed_emails" || item.reviewStatus === "review_required"
  ).length;
  const status =
    failedQueues > 0 || operationalQueues.some((item) => item.runtimeStatus === "no_table_detected")
      ? ("needs_attention" as const)
      : ("email_queue_runtime_ready" as const);

  return {
    activeQueues,
    failedQueues,
    groupCount: buildOperationsEmailQueueRuntimeGroups(items).length,
    readOnly: true,
    registrySource: OPERATIONS_REGISTRY_SOURCE,
    source: OPERATIONS_EMAIL_QUEUE_RUNTIME_SOURCE,
    status,
    summary: [
      `status ${status}`,
      `${operationalQueues.length} email queue groups`,
      `${activeQueues} active`,
      `${failedQueues} require review`
    ].join("; "),
    totalQueues: items.length
  };
}

export async function loadOperationsEmailQueueRuntimeReadOnlySafe(params: {
  supabase: SupabaseClient<Database>;
}) {
  const emailLoad = await safeEmailQueueTableSelect(params.supabase, 500);
  const partitionedRows = partitionEmailQueueRows(emailLoad.rows);
  const emailQueues = [
    ...EMAIL_QUEUE_DEFINITIONS.map((definition) =>
      buildEmailQueueRuntimeItem({
        definition,
        rows: partitionedRows.get(definition.emailQueueKey) ?? [],
        tableDetected: emailLoad.tableDetected
      })
    ),
    ...buildFutureEmailQueueHookItems()
  ];
  const groups = buildOperationsEmailQueueRuntimeGroups(emailQueues);
  const summary = getOperationsEmailQueueRuntimeSummary(emailQueues);

  return {
    emailQueues,
    emailQueueRuntime: summary,
    groups,
    safeControls: buildSafeControls()
  };
}

export function mapOperationsEmailQueueRuntimeToAdminFields(
  input: Awaited<ReturnType<typeof loadOperationsEmailQueueRuntimeReadOnlySafe>>
) {
  return {
    emailQueueRuntime: input.emailQueueRuntime,
    emailQueues: input.emailQueues,
    groups: input.groups,
    safeControls: input.safeControls
  };
}
