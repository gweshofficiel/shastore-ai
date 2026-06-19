import "server-only";

export type MarketingPromotionScheduleState =
  | "ended"
  | "invalid_schedule"
  | "live"
  | "scheduled"
  | "unknown"
  | "unscheduled";

export type MarketingPromotionSchedulingView = {
  endsAt: string | null;
  scheduleBadgeTone: "amber" | "blue" | "green" | "red";
  scheduleDescription: string;
  scheduleLabel: string;
  scheduleState: MarketingPromotionScheduleState;
  startsAt: string | null;
  timezoneDisplay: string | null;
};

export type MarketingPromotionSchedulingInput = {
  endsAt?: unknown;
  metadata?: unknown;
  startsAt?: unknown;
};

const secretPattern =
  /(api[_-]?key|secret|token|password|credential|iban|payout|bank_account|card_number|cvv|cvc|private[_-]?key|@[a-z0-9._%+-]+\.[a-z]{2,})/i;

const timezonePattern = /^[A-Za-z0-9_+\-/]{2,64}$/;

function text(value: unknown, maxLength = 500) {
  if (typeof value !== "string") return "";

  return value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/\bjavascript:/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function safeRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function metadataValue(metadata: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = text(metadata[key], 120);
    if (value) return value;
  }

  return "";
}

function sanitizeScheduleDisplayValue(value: unknown) {
  const cleaned = text(value, 120);

  if (!cleaned || secretPattern.test(cleaned)) {
    return null;
  }

  return cleaned;
}

function parseScheduleInstant(value: unknown): Date | null {
  const cleaned = sanitizeScheduleDisplayValue(value);

  if (!cleaned) {
    return null;
  }

  const parsed = Date.parse(cleaned);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return new Date(parsed);
}

export function resolveMarketingPromotionScheduleBounds(input: MarketingPromotionSchedulingInput) {
  const metadata = safeRecord(input.metadata);
  const startsAt =
    sanitizeScheduleDisplayValue(input.startsAt) ??
    sanitizeScheduleDisplayValue(metadataValue(metadata, ["starts_at", "start_date", "schedule_start"]));
  const endsAt =
    sanitizeScheduleDisplayValue(input.endsAt) ??
    sanitizeScheduleDisplayValue(metadataValue(metadata, ["ends_at", "end_date", "schedule_end"]));

  return {
    endsAt,
    endsAtInstant: parseScheduleInstant(endsAt),
    startsAt,
    startsAtInstant: parseScheduleInstant(startsAt)
  };
}

export function resolveMarketingPromotionTimezoneDisplay(metadata: unknown) {
  const record = safeRecord(metadata);
  const timezone = sanitizeScheduleDisplayValue(
    metadataValue(record, ["timezone", "schedule_timezone", "time_zone"])
  );

  if (!timezone || !timezonePattern.test(timezone)) {
    return null;
  }

  return timezone;
}

export function resolveMarketingPromotionScheduleState(
  input: MarketingPromotionSchedulingInput,
  now: Date = new Date()
): MarketingPromotionScheduleState {
  const bounds = resolveMarketingPromotionScheduleBounds(input);
  const metadata = safeRecord(input.metadata);
  const rawStart = text(input.startsAt, 120) || metadataValue(metadata, ["starts_at", "start_date", "schedule_start"]);
  const rawEnd = text(input.endsAt, 120) || metadataValue(metadata, ["ends_at", "end_date", "schedule_end"]);

  if (!bounds.startsAt && !bounds.endsAt) {
    if (rawStart || rawEnd) {
      return "invalid_schedule";
    }

    return "unscheduled";
  }

  if ((rawStart && !bounds.startsAtInstant) || (rawEnd && !bounds.endsAtInstant)) {
    return "invalid_schedule";
  }

  if (bounds.startsAtInstant && bounds.endsAtInstant && bounds.endsAtInstant.getTime() < bounds.startsAtInstant.getTime()) {
    return "invalid_schedule";
  }

  const nowMs = now.getTime();

  if (bounds.endsAtInstant && nowMs >= bounds.endsAtInstant.getTime()) {
    return "ended";
  }

  if (bounds.startsAtInstant && nowMs < bounds.startsAtInstant.getTime()) {
    return "scheduled";
  }

  if (bounds.startsAtInstant || bounds.endsAtInstant) {
    return "live";
  }

  return "unknown";
}

export function getMarketingPromotionScheduleLabel(state: MarketingPromotionScheduleState) {
  if (state === "scheduled") return "Scheduled";
  if (state === "live") return "Live";
  if (state === "ended") return "Ended";
  if (state === "invalid_schedule") return "Invalid schedule";
  if (state === "unscheduled") return "Unscheduled";
  return "Unknown";
}

export function getMarketingPromotionScheduleDescription(state: MarketingPromotionScheduleState) {
  if (state === "scheduled") {
    return "Promotion has future schedule bounds for Super Admin review. No automatic activation occurs.";
  }

  if (state === "live") {
    return "Promotion is within its display schedule window. No checkout or billing enforcement is connected.";
  }

  if (state === "ended") {
    return "Promotion schedule window has ended for display classification only. Status is not mutated.";
  }

  if (state === "invalid_schedule") {
    return "Promotion schedule data is malformed and requires review. No automation runs on page load.";
  }

  if (state === "unscheduled") {
    return "Promotion has no schedule bounds yet. Scheduling remains display-only.";
  }

  return "Promotion schedule could not be classified safely.";
}

export function getMarketingPromotionScheduleBadgeTone(
  state: MarketingPromotionScheduleState
): MarketingPromotionSchedulingView["scheduleBadgeTone"] {
  if (state === "live") return "green";
  if (state === "scheduled") return "amber";
  if (state === "ended" || state === "invalid_schedule") return "red";
  return "blue";
}

export function buildMarketingPromotionScheduleLabel(params: {
  endsAt: string | null;
  scheduleState: MarketingPromotionScheduleState;
  startsAt: string | null;
  timezoneDisplay: string | null;
}) {
  if (params.scheduleState === "unscheduled") {
    return "No schedule configured";
  }

  if (params.scheduleState === "invalid_schedule") {
    return "Schedule requires review";
  }

  if (params.startsAt && params.endsAt) {
    return `${params.startsAt} to ${params.endsAt}`;
  }

  if (params.startsAt) {
    return `Starts ${params.startsAt}`;
  }

  if (params.endsAt) {
    return `Ends ${params.endsAt}`;
  }

  return getMarketingPromotionScheduleLabel(params.scheduleState);
}

export function resolveMarketingPromotionSchedulingView(
  input: MarketingPromotionSchedulingInput,
  now?: Date
): MarketingPromotionSchedulingView {
  const bounds = resolveMarketingPromotionScheduleBounds(input);
  const scheduleState = resolveMarketingPromotionScheduleState(input, now);
  const timezoneDisplay = resolveMarketingPromotionTimezoneDisplay(input.metadata);

  return {
    endsAt: bounds.endsAt,
    scheduleBadgeTone: getMarketingPromotionScheduleBadgeTone(scheduleState),
    scheduleDescription: getMarketingPromotionScheduleDescription(scheduleState),
    scheduleLabel: buildMarketingPromotionScheduleLabel({
      endsAt: bounds.endsAt,
      scheduleState,
      startsAt: bounds.startsAt,
      timezoneDisplay
    }),
    scheduleState,
    startsAt: bounds.startsAt,
    timezoneDisplay
  };
}

export function resolveMarketingPromotionSchedulingViewSafe(
  input: MarketingPromotionSchedulingInput
): MarketingPromotionSchedulingView {
  try {
    return resolveMarketingPromotionSchedulingView(input);
  } catch (error) {
    console.error("[marketing-promotion-scheduling-runtime] scheduling view failed", error);

    return {
      endsAt: null,
      scheduleBadgeTone: "blue",
      scheduleDescription: getMarketingPromotionScheduleDescription("unknown"),
      scheduleLabel: getMarketingPromotionScheduleLabel("unknown"),
      scheduleState: "unknown",
      startsAt: null,
      timezoneDisplay: null
    };
  }
}

export function isValidMarketingPromotionScheduleState(
  value: unknown
): value is MarketingPromotionScheduleState {
  return (
    value === "unscheduled" ||
    value === "scheduled" ||
    value === "live" ||
    value === "ended" ||
    value === "invalid_schedule" ||
    value === "unknown"
  );
}
