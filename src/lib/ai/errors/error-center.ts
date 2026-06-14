import "server-only";
import { maskSensitiveText } from "@/lib/integrations/safe-diagnostics";
import type {
  AIErrorCenterItem,
  AIErrorFilters,
  AIErrorGroup,
  AIErrorSeverity,
  AIErrorSignal,
  PersistedAIErrorEvent
} from "@/src/lib/ai/errors/error-types";

export const aiErrorGroups: AIErrorGroup[] = [
  "PROVIDER_ERROR",
  "STORAGE_ERROR",
  "TIMEOUT_ERROR",
  "MODERATION_ERROR",
  "VALIDATION_ERROR",
  "UNKNOWN_ERROR"
];

export const aiErrorSeverities: AIErrorSeverity[] = ["low", "medium", "high", "critical"];

function cleanText(value: unknown, maxLength = 500) {
  return typeof value === "string" ? maskSensitiveText(value.trim()).replace(/\s+/g, " ").slice(0, maxLength) : "";
}

function normalizedMessage(value: string | null) {
  const text = cleanText(value, 220).toLowerCase();

  return text
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, "[id]")
    .replace(/\b\d{4,}\b/g, "[number]")
    .slice(0, 160);
}

function stableKey(parts: Array<string | null | undefined>) {
  return parts.map((part) => cleanText(part ?? "none", 180).toLowerCase() || "none").join("|");
}

export function classifyAIErrorGroup(errorMessage?: string | null, errorCode?: string | null): AIErrorGroup {
  const haystack = `${errorCode ?? ""} ${errorMessage ?? ""}`.toLowerCase();

  if (/(timeout|timed out|deadline|etimedout|econnaborted|gateway timeout)/i.test(haystack)) {
    return "TIMEOUT_ERROR";
  }

  if (/(r2|storage|upload|object store|bucket|asset upload|public url|private url|cdn)/i.test(haystack)) {
    return "STORAGE_ERROR";
  }

  if (/(moderation|policy|safety|unsafe|content filter|blocked content)/i.test(haystack)) {
    return "MODERATION_ERROR";
  }

  if (/(validation|invalid|missing required|required field|schema|malformed|parse)/i.test(haystack)) {
    return "VALIDATION_ERROR";
  }

  if (/(provider|openai|replicate|fal|runway|kling|elevenlabs|deepgram|gemini|rate limit|quota|model|generation)/i.test(haystack)) {
    return "PROVIDER_ERROR";
  }

  return "UNKNOWN_ERROR";
}

export function severityForError(errorGroup: AIErrorGroup, occurrences: number): AIErrorSeverity {
  if (occurrences >= 50) {
    return "critical";
  }

  if (occurrences >= 10) {
    return "high";
  }

  if (errorGroup === "TIMEOUT_ERROR" || errorGroup === "STORAGE_ERROR" || errorGroup === "PROVIDER_ERROR") {
    return occurrences >= 3 ? "high" : "medium";
  }

  if (errorGroup === "UNKNOWN_ERROR") {
    return occurrences >= 5 ? "medium" : "low";
  }

  return "medium";
}

function fallbackDate(value: string) {
  return Number.isFinite(Date.parse(value)) ? value : new Date().toISOString();
}

export function aggregateAIErrorSignals(signals: AIErrorSignal[]): PersistedAIErrorEvent[] {
  const grouped = new Map<string, PersistedAIErrorEvent>();

  for (const signal of signals) {
    const observedAt = fallbackDate(signal.observedAt);
    const key = stableKey([
      signal.provider,
      signal.storeId,
      signal.assetType,
      signal.errorGroup,
      signal.errorCode,
      normalizedMessage(signal.errorMessage)
    ]);
    const current = grouped.get(key);

    if (!current) {
      grouped.set(key, {
        aggregationKey: key,
        assetType: cleanText(signal.assetType, 120) || null,
        errorCode: cleanText(signal.errorCode, 160) || null,
        errorGroup: signal.errorGroup,
        errorMessage: cleanText(signal.errorMessage, 500) || null,
        firstSeenAt: observedAt,
        id: key,
        jobId: cleanText(signal.jobId, 160) || null,
        lastSeenAt: observedAt,
        occurrences: 1,
        provider: cleanText(signal.provider, 120) || null,
        severity: severityForError(signal.errorGroup, 1),
        storeId: cleanText(signal.storeId, 80) || null
      });
      continue;
    }

    current.occurrences += 1;
    current.severity = severityForError(current.errorGroup, current.occurrences);

    if (Date.parse(observedAt) < Date.parse(current.firstSeenAt)) {
      current.firstSeenAt = observedAt;
      current.jobId = cleanText(signal.jobId, 160) || current.jobId;
    }

    if (Date.parse(observedAt) > Date.parse(current.lastSeenAt)) {
      current.lastSeenAt = observedAt;
      current.jobId = cleanText(signal.jobId, 160) || current.jobId;
    }
  }

  return [...grouped.values()].sort((a, b) => Date.parse(b.lastSeenAt) - Date.parse(a.lastSeenAt));
}

function dateRangeStart(range: AIErrorFilters["dateRange"]) {
  if (!range || range === "all") {
    return null;
  }

  const now = Date.now();
  const hours = range === "24h" ? 24 : range === "7d" ? 24 * 7 : 24 * 30;

  return now - hours * 60 * 60 * 1000;
}

export function filterAIErrorEvents(events: AIErrorCenterItem[], filters: AIErrorFilters = {}) {
  const start = dateRangeStart(filters.dateRange);

  return events
    .filter((event) => !filters.provider || filters.provider === "all" || event.provider === filters.provider)
    .filter((event) => !filters.severity || filters.severity === "all" || event.severity === filters.severity)
    .filter((event) => !filters.errorGroup || filters.errorGroup === "all" || event.errorGroup === filters.errorGroup)
    .filter((event) => !filters.storeId || filters.storeId === "all" || event.storeId === filters.storeId)
    .filter((event) => {
      if (!start) {
        return true;
      }

      const lastSeen = Date.parse(event.lastSeenAt);

      return Number.isFinite(lastSeen) && lastSeen >= start;
    });
}
