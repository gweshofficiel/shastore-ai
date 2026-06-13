import "server-only";
import { getAdminAccess } from "@/lib/admin-access";
import { maskIntegrationDiagnostic, maskSensitiveText } from "@/lib/integrations/safe-diagnostics";
import { createAdminClient } from "@/lib/supabase/admin";

export type WebhookEventStatus =
  | "failed"
  | "ignored"
  | "processed"
  | "received"
  | "retry_pending";

export type WebhookEventRecord = {
  attempts: number;
  createdAt: string;
  errorCode: string | null;
  errorMessage: string | null;
  eventType: string;
  httpStatus: number | null;
  id: string;
  lastAttemptAt: string;
  nextRetryAt: string | null;
  processedAt: string | null;
  providerKey: string;
  relatedEntityId: string | null;
  relatedEntityType: string | null;
  safePayloadSummary: Record<string, unknown> | null;
  status: WebhookEventStatus;
  updatedAt: string | null;
  webhookType: string;
};

export type WebhookEventFilters = {
  eventType?: string | null;
  failedOnly?: boolean;
  providerKey?: string | null;
  status?: WebhookEventStatus | "all" | null;
  window?: "24h" | "7d" | "all" | null;
};

export type RecordWebhookEventInput = {
  attempts?: number | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  eventType: string;
  httpStatus?: number | null;
  nextRetryAt?: string | null;
  processedAt?: string | null;
  providerKey: string;
  relatedEntityId?: string | null;
  relatedEntityType?: string | null;
  safePayloadSummary?: Record<string, unknown> | null;
  status: WebhookEventStatus;
  webhookType: string;
};

export type WebhookStats = {
  failed: number;
  ignored: number;
  processed: number;
  retryPending: number;
  total: number;
};

type WebhookEventsTable = {
  insert: (values: never) => PromiseLike<{ error: { message: string } | null }>;
  select: (columns: string) => {
    order: (column: string, options: { ascending: boolean }) => {
      limit: (limit: number) => PromiseLike<{
        data: unknown[] | null;
        error: { message: string } | null;
      }>;
    };
  };
};

type AdminClient = {
  from: (table: string) => unknown;
};

const webhookStatuses: WebhookEventStatus[] = [
  "failed",
  "ignored",
  "processed",
  "received",
  "retry_pending"
];

function requireSuperAdmin(access: Awaited<ReturnType<typeof getAdminAccess>>) {
  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can access webhook monitoring.");
  }
}

function table(client: AdminClient) {
  return client.from("integration_webhook_events") as WebhookEventsTable;
}

function cleanText(value: unknown, maxLength = 500) {
  return typeof value === "string" ? maskSensitiveText(value.trim()).slice(0, maxLength) : "";
}

function nullableText(value: unknown, maxLength = 500) {
  const cleaned = cleanText(value, maxLength);

  return cleaned || null;
}

function cleanNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function cleanDate(value: unknown) {
  const cleaned = cleanText(value, 80);

  if (!cleaned) {
    return null;
  }

  const timestamp = Date.parse(cleaned);

  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function statusValue(value: unknown): WebhookEventStatus {
  return webhookStatuses.includes(value as WebhookEventStatus)
    ? (value as WebhookEventStatus)
    : "received";
}

function windowStart(window: WebhookEventFilters["window"]) {
  if (window === "24h") {
    return Date.now() - 24 * 60 * 60 * 1000;
  }

  if (window === "7d") {
    return Date.now() - 7 * 24 * 60 * 60 * 1000;
  }

  return null;
}

function parseWebhookEvent(row: unknown): WebhookEventRecord | null {
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    return null;
  }

  const value = row as Record<string, unknown>;
  const id = cleanText(value.id, 80);
  const providerKey = cleanText(value.provider_key, 120);
  const eventType = cleanText(value.event_type, 160);
  const createdAt = cleanDate(value.created_at);
  const lastAttemptAt = cleanDate(value.last_attempt_at);

  if (!id || !providerKey || !eventType || !createdAt || !lastAttemptAt) {
    return null;
  }

  return {
    attempts: cleanNumber(value.attempts) ?? 1,
    createdAt,
    errorCode: nullableText(value.error_code, 160),
    errorMessage: nullableText(value.error_message, 500),
    eventType,
    httpStatus: cleanNumber(value.http_status),
    id,
    lastAttemptAt,
    nextRetryAt: cleanDate(value.next_retry_at),
    processedAt: cleanDate(value.processed_at),
    providerKey,
    relatedEntityId: nullableText(value.related_entity_id, 160),
    relatedEntityType: nullableText(value.related_entity_type, 120),
    safePayloadSummary: (maskIntegrationDiagnostic(value.safe_payload_summary) ?? null) as Record<string, unknown> | null,
    status: statusValue(value.status),
    updatedAt: cleanDate(value.updated_at),
    webhookType: cleanText(value.webhook_type, 160)
  };
}

export function safeWebhookPayloadSummary(value: unknown): Record<string, unknown> {
  const masked = maskIntegrationDiagnostic(value);

  if (!masked || typeof masked !== "object" || Array.isArray(masked)) {
    return {};
  }

  return masked as Record<string, unknown>;
}

export async function recordWebhookEvent(input: RecordWebhookEventInput) {
  const admin = createAdminClient();

  if (!admin) {
    console.warn("integration_webhook_event_skipped", {
      code: "admin_client_unavailable",
      providerKey: input.providerKey,
      status: input.status
    });
    return;
  }

  const now = new Date().toISOString();
  const processedAt = input.processedAt ?? (input.status === "processed" ? now : null);
  const { error } = await table(admin).insert({
    attempts: Math.max(1, input.attempts ?? 1),
    error_code: nullableText(input.errorCode, 160),
    error_message: nullableText(input.errorMessage, 500),
    event_type: cleanText(input.eventType, 160) || "unknown",
    http_status: input.httpStatus ?? null,
    last_attempt_at: now,
    next_retry_at: cleanDate(input.nextRetryAt),
    processed_at: processedAt,
    provider_key: cleanText(input.providerKey, 120) || "unknown",
    related_entity_id: nullableText(input.relatedEntityId, 160),
    related_entity_type: nullableText(input.relatedEntityType, 120),
    safe_payload_summary: safeWebhookPayloadSummary(input.safePayloadSummary ?? {}),
    status: input.status,
    webhook_type: cleanText(input.webhookType, 160) || "webhook"
  } as never);

  if (error) {
    console.warn("integration_webhook_event_failed", {
      code: "insert_failed",
      message: maskSensitiveText(error.message),
      providerKey: input.providerKey,
      status: input.status
    });
  }
}

async function readWebhookEvents() {
  const admin = createAdminClient();

  if (!admin) {
    return [];
  }

  const { data, error } = await table(admin)
    .select("id, provider_key, webhook_type, event_type, status, http_status, attempts, last_attempt_at, next_retry_at, processed_at, error_code, error_message, related_entity_type, related_entity_id, safe_payload_summary, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    return [];
  }

  return (data ?? [])
    .map(parseWebhookEvent)
    .filter((event): event is WebhookEventRecord => Boolean(event));
}

export async function listWebhookEvents(filters: WebhookEventFilters = {}) {
  const access = await getAdminAccess();
  requireSuperAdmin(access);

  const start = windowStart(filters.window);

  return (await readWebhookEvents())
    .filter((event) => !filters.providerKey || filters.providerKey === "all" || event.providerKey === filters.providerKey)
    .filter((event) => !filters.status || filters.status === "all" || event.status === filters.status)
    .filter((event) => !filters.eventType || filters.eventType === "all" || event.eventType === filters.eventType)
    .filter((event) => !filters.failedOnly || event.status === "failed")
    .filter((event) => !start || Date.parse(event.createdAt) >= start);
}

export async function getWebhookStats(): Promise<WebhookStats> {
  const access = await getAdminAccess();
  requireSuperAdmin(access);

  const events = await readWebhookEvents();

  return {
    failed: events.filter((event) => event.status === "failed").length,
    ignored: events.filter((event) => event.status === "ignored").length,
    processed: events.filter((event) => event.status === "processed").length,
    retryPending: events.filter((event) => event.status === "retry_pending").length,
    total: events.length
  };
}
