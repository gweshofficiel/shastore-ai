import "server-only";
import { getAdminAccess } from "@/lib/admin-access";
import { maskSensitiveText } from "@/lib/integrations/safe-diagnostics";
import { aiVisualQueueFromStoreData } from "@/lib/storefront/ai-visual-queue";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  aggregateAIErrorSignals,
  classifyAIErrorGroup,
  filterAIErrorEvents
} from "@/src/lib/ai/errors/error-center";
import type {
  AIErrorCenterItem,
  AIErrorFilters,
  AIErrorGroup,
  AIErrorSignal,
  PersistedAIErrorEvent
} from "@/src/lib/ai/errors/error-types";

type QueryLimitResult = PromiseLike<{
  data: unknown[] | null;
  error: { message: string } | null;
}>;

type SelectTable = {
  select: (columns: string) => {
    order: (column: string, options: { ascending: boolean }) => {
      limit: (limit: number) => QueryLimitResult;
    };
    limit: (limit: number) => QueryLimitResult;
  };
};

type ErrorEventsTable = SelectTable & {
  upsert: (values: never, options: { onConflict: string }) => PromiseLike<{
    error: { message: string } | null;
  }>;
};

type AdminClient = {
  from: (table: string) => unknown;
};

export type AIErrorCenterSnapshot = {
  errors: AIErrorCenterItem[];
  generatedAt: string;
  sourceCount: number;
};

const MAX_ERROR_SOURCE_ROWS = 750;
const MAX_ERROR_CENTER_ROWS = 500;

function requireSuperAdmin(access: Awaited<ReturnType<typeof getAdminAccess>>) {
  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can access AI Error Center.");
  }
}

function table(client: AdminClient, tableName: string) {
  return client.from(tableName) as SelectTable;
}

function errorEventsTable(client: AdminClient) {
  return client.from("ai_error_events") as ErrorEventsTable;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function text(value: unknown, maxLength = 500) {
  return typeof value === "string" && value.trim()
    ? maskSensitiveText(value.trim()).replace(/\s+/g, " ").slice(0, maxLength)
    : "";
}

function nullableText(value: unknown, maxLength = 500) {
  const cleaned = text(value, maxLength);

  return cleaned || null;
}

function safeDate(value: unknown, fallback = new Date().toISOString()) {
  const candidate = text(value, 80);

  return Number.isFinite(Date.parse(candidate)) ? candidate : fallback;
}

async function safeRead(client: AdminClient, tableName: string, columns: string) {
  const { data, error } = await table(client, tableName)
    .select(columns)
    .limit(MAX_ERROR_SOURCE_ROWS);

  if (error) {
    return [];
  }

  return data ?? [];
}

async function safeReadOrdered(client: AdminClient, tableName: string, columns: string, orderColumn: string) {
  const { data, error } = await table(client, tableName)
    .select(columns)
    .order(orderColumn, { ascending: false })
    .limit(MAX_ERROR_CENTER_ROWS);

  if (error) {
    return [];
  }

  return data ?? [];
}

function signalFromAudit(row: unknown): AIErrorSignal | null {
  if (!isRecord(row)) {
    return null;
  }

  const status = text(row.status, 80);
  const eventType = text(row.event_type, 120);

  if (status !== "failed" && eventType !== "ai_job_failed") {
    return null;
  }

  const errorMessage = nullableText(row.error_message, 500);
  const errorCode = nullableText(row.error_code, 160);

  return {
    assetType: nullableText(row.asset_type, 120),
    errorCode,
    errorGroup: classifyAIErrorGroup(errorMessage, errorCode),
    errorMessage: errorMessage ?? "AI runtime failure recorded.",
    jobId: nullableText(row.job_id, 160),
    observedAt: safeDate(row.created_at),
    provider: nullableText(row.provider_key, 120),
    storeId: nullableText(row.store_id, 80)
  };
}

function signalFromQueue(row: unknown): AIErrorSignal | null {
  if (!isRecord(row)) {
    return null;
  }

  const status = text(row.queue_status, 80) || text(row.workflow_state, 80);

  if (status !== "failed") {
    return null;
  }

  const errorMessage = nullableText(row.error_message, 500) ?? "AI store generation workflow failed.";

  return {
    assetType: "store_generation",
    errorCode: "ai_generation_queue_failed",
    errorGroup: classifyAIErrorGroup(errorMessage, "ai_generation_queue_failed"),
    errorMessage,
    jobId: nullableText(row.job_id, 160) ?? nullableText(row.id, 160),
    observedAt: safeDate(row.failed_at, safeDate(row.updated_at, safeDate(row.created_at))),
    provider: "workflow_placeholder",
    storeId: nullableText(row.store_instance_id, 80)
  };
}

function signalsFromStores(rows: unknown[]): AIErrorSignal[] {
  const signals: AIErrorSignal[] = [];

  for (const row of rows) {
    if (!isRecord(row)) {
      continue;
    }

    const queue = aiVisualQueueFromStoreData(row.store_data);

    for (const job of Object.values(queue.jobs)) {
      if (job.status !== "failed") {
        continue;
      }

      const errorMessage = nullableText(job.error, 500) ?? "AI visual job failed.";

      signals.push({
        assetType: text(job.kind, 120) || null,
        errorCode: "ai_visual_job_failed",
        errorGroup: classifyAIErrorGroup(errorMessage, "ai_visual_job_failed"),
        errorMessage,
        jobId: text(job.jobId, 160) || text(job.requestId, 160) || null,
        observedAt: safeDate(job.completedAt, safeDate(job.updatedAt, safeDate(job.createdAt, safeDate(row.created_at)))),
        provider: text(job.provider, 120) || null,
        storeId: text(job.storeId, 80) || nullableText(row.id, 80)
      });
    }
  }

  return signals;
}

function parsePersistedEvent(row: unknown): AIErrorCenterItem | null {
  if (!isRecord(row)) {
    return null;
  }

  const id = text(row.id, 80);
  const errorGroup = text(row.error_group, 80) as AIErrorGroup;
  const severity = text(row.severity, 80) as AIErrorCenterItem["severity"];
  const firstSeenAt = safeDate(row.first_seen_at);
  const lastSeenAt = safeDate(row.last_seen_at, firstSeenAt);

  if (!id || !errorGroup || !severity) {
    return null;
  }

  return {
    assetType: nullableText(row.asset_type, 120),
    errorCode: nullableText(row.error_code, 160),
    errorGroup,
    errorMessage: nullableText(row.error_message, 500),
    firstSeenAt,
    id,
    jobId: nullableText(row.job_id, 160),
    lastSeenAt,
    occurrences: typeof row.occurrences === "number" ? row.occurrences : 1,
    provider: nullableText(row.provider, 120),
    severity,
    storeId: nullableText(row.store_id, 80)
  };
}

function rowForPersistedEvent(event: PersistedAIErrorEvent) {
  return {
    aggregation_key: event.aggregationKey,
    asset_type: event.assetType,
    error_code: event.errorCode,
    error_group: event.errorGroup,
    error_message: event.errorMessage,
    first_seen_at: event.firstSeenAt,
    job_id: event.jobId,
    last_seen_at: event.lastSeenAt,
    occurrences: event.occurrences,
    provider: event.provider,
    severity: event.severity,
    store_id: event.storeId
  };
}

async function persistAggregatedErrors(client: AdminClient, events: PersistedAIErrorEvent[]) {
  if (!events.length) {
    return;
  }

  const { error } = await errorEventsTable(client).upsert(
    events.map(rowForPersistedEvent) as never,
    { onConflict: "aggregation_key" }
  );

  if (error) {
    console.warn("ai_error_events_upsert_failed", {
      message: maskSensitiveText(error.message)
    });
  }
}

export async function getAIErrorCenterSnapshot(filters: AIErrorFilters = {}): Promise<AIErrorCenterSnapshot> {
  const access = await getAdminAccess();
  requireSuperAdmin(access);

  const admin = createAdminClient();

  if (!admin) {
    return {
      errors: [],
      generatedAt: new Date().toISOString(),
      sourceCount: 0
    };
  }

  const [auditRows, queueRows, storeRows] = await Promise.all([
    safeRead(admin, "ai_audit_logs", "id, event_type, provider_key, job_id, store_id, asset_type, status, error_code, error_message, created_at"),
    safeRead(admin, "ai_generation_queue", "id, job_id, store_instance_id, workflow_state, queue_status, error_message, failed_at, updated_at, created_at"),
    safeRead(admin, "stores", "id, store_data, created_at")
  ]);
  const signals = [
    ...auditRows.map(signalFromAudit).filter((signal): signal is AIErrorSignal => Boolean(signal)),
    ...queueRows.map(signalFromQueue).filter((signal): signal is AIErrorSignal => Boolean(signal)),
    ...signalsFromStores(storeRows)
  ];
  const aggregated = aggregateAIErrorSignals(signals);

  await persistAggregatedErrors(admin, aggregated);

  const persistedRows = await safeReadOrdered(
    admin,
    "ai_error_events",
    "id, provider, job_id, store_id, asset_type, error_group, error_code, error_message, severity, first_seen_at, last_seen_at, occurrences, created_at",
    "last_seen_at"
  );
  const persisted = persistedRows
    .map(parsePersistedEvent)
    .filter((event): event is AIErrorCenterItem => Boolean(event));
  const current = persisted.length ? persisted : aggregated;

  return {
    errors: filterAIErrorEvents(current, filters),
    generatedAt: new Date().toISOString(),
    sourceCount: signals.length
  };
}
