import "server-only";

export type MarketingStatus = "active" | "archived" | "draft" | "expired" | "paused";

export type MarketingStatusBadgeTone = "amber" | "blue" | "green" | "red";

export type MarketingStatusCatalogEntry = {
  badgeTone: MarketingStatusBadgeTone;
  description: string;
  label: string;
  status: MarketingStatus;
};

export type MarketingStatusOverview = {
  activeSections: number;
  archivedSections: number;
  draftSections: number;
  expiredSections: number;
  pausedSections: number;
  totalSections: number;
};

export type MarketingStatusStats = {
  activeItems: number;
  archivedItems: number;
  draftItems: number;
  expiredItems: number;
  pausedItems: number;
  totalItems: number;
};

export type MarketingPlatformActionEventType =
  | "admin_platform_marketing_activate_campaign"
  | "admin_platform_marketing_archive_campaign"
  | "admin_platform_marketing_create_draft"
  | "admin_platform_marketing_pause_campaign"
  | "admin_platform_marketing_view_usage";

export const MARKETING_STATUSES: readonly MarketingStatus[] = [
  "draft",
  "active",
  "paused",
  "expired",
  "archived"
] as const;

export const MARKETING_PLATFORM_ACTION_EVENT_TYPES: readonly MarketingPlatformActionEventType[] = [
  "admin_platform_marketing_activate_campaign",
  "admin_platform_marketing_archive_campaign",
  "admin_platform_marketing_create_draft",
  "admin_platform_marketing_pause_campaign",
  "admin_platform_marketing_view_usage"
] as const;

const statusLabels: Record<MarketingStatus, string> = {
  active: "Active",
  archived: "Archived",
  draft: "Draft",
  expired: "Expired",
  paused: "Paused"
};

const statusDescriptions: Record<MarketingStatus, string> = {
  active: "Visible to Super Admin review and eligible for future activation flows.",
  archived: "Retired from active marketing operations. Historical reference only.",
  draft: "Prepared for internal review. Not publicly exposed or executed.",
  expired: "Past its configured lifecycle window. Requires review before reuse.",
  paused: "Temporarily suspended from marketing operations."
};

const badgeToneByStatus: Record<MarketingStatus, MarketingStatusBadgeTone> = {
  active: "green",
  archived: "red",
  draft: "amber",
  expired: "red",
  paused: "blue"
};

const platformActionToStatus: Partial<Record<MarketingPlatformActionEventType, MarketingStatus>> = {
  admin_platform_marketing_activate_campaign: "active",
  admin_platform_marketing_archive_campaign: "archived",
  admin_platform_marketing_create_draft: "draft",
  admin_platform_marketing_pause_campaign: "paused"
};

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

export function isValidMarketingStatus(value: unknown): value is MarketingStatus {
  return typeof value === "string" && MARKETING_STATUSES.includes(value as MarketingStatus);
}

export function parseMarketingStatus(value: unknown): MarketingStatus | null {
  const cleaned = text(value, 80);
  return isValidMarketingStatus(cleaned) ? cleaned : null;
}

export function assertValidMarketingStatus(value: unknown): MarketingStatus {
  const status = parseMarketingStatus(value);

  if (!status) {
    throw new Error("Marketing status must be draft, active, paused, expired, or archived.");
  }

  return status;
}

export function getMarketingStatusLabel(status: MarketingStatus) {
  return statusLabels[status];
}

export function getMarketingStatusDescription(status: MarketingStatus) {
  return statusDescriptions[status];
}

export function getMarketingStatusBadgeTone(status: MarketingStatus): MarketingStatusBadgeTone {
  return badgeToneByStatus[status];
}

export function resolveMarketingStatusLabel(value: unknown) {
  const status = parseMarketingStatus(value);
  return status ? getMarketingStatusLabel(status) : "Unknown status";
}

export function resolveMarketingStatusBadgeTone(value: unknown): MarketingStatusBadgeTone {
  const status = parseMarketingStatus(value);
  return status ? getMarketingStatusBadgeTone(status) : "red";
}

export function resolveMarketingStatusDescription(value: unknown) {
  const status = parseMarketingStatus(value);
  return status ? getMarketingStatusDescription(status) : "Status could not be resolved.";
}

export function listMarketingStatusCatalog(): MarketingStatusCatalogEntry[] {
  return MARKETING_STATUSES.map((status) => ({
    badgeTone: getMarketingStatusBadgeTone(status),
    description: getMarketingStatusDescription(status),
    label: getMarketingStatusLabel(status),
    status
  }));
}

export function countMarketingItemsByStatus<T extends { status: MarketingStatus }>(
  items: T[]
): MarketingStatusStats {
  return {
    activeItems: items.filter((item) => item.status === "active").length,
    archivedItems: items.filter((item) => item.status === "archived").length,
    draftItems: items.filter((item) => item.status === "draft").length,
    expiredItems: items.filter((item) => item.status === "expired").length,
    pausedItems: items.filter((item) => item.status === "paused").length,
    totalItems: items.length
  };
}

export function countMarketingStatusOverview<T extends { status: MarketingStatus }>(
  items: T[]
): MarketingStatusOverview {
  const stats = countMarketingItemsByStatus(items);

  return {
    activeSections: stats.activeItems,
    archivedSections: stats.archivedItems,
    draftSections: stats.draftItems,
    expiredSections: stats.expiredItems,
    pausedSections: stats.pausedItems,
    totalSections: stats.totalItems
  };
}

export function isMarketingPlatformActionEventType(value: unknown): value is MarketingPlatformActionEventType {
  return typeof value === "string" && MARKETING_PLATFORM_ACTION_EVENT_TYPES.includes(value as MarketingPlatformActionEventType);
}

export function resolveMarketingStatusFromPlatformAction(
  eventType: unknown,
  fallback: MarketingStatus
): MarketingStatus {
  const cleaned = text(eventType, 120);

  if (!isMarketingPlatformActionEventType(cleaned)) {
    return fallback;
  }

  return platformActionToStatus[cleaned] ?? fallback;
}

export function indexLatestMarketingPlatformActions(
  events: Array<{ created_at?: unknown; event_type?: unknown; metadata?: unknown }>
): Map<string, string> {
  const latestActionByCampaign = new Map<string, string>();
  const sortedEvents = [...events].sort(
    (left, right) => dateValue(right.created_at) - dateValue(left.created_at)
  );

  for (const event of sortedEvents) {
    const eventType = text(event.event_type, 120);

    if (!eventType.startsWith("admin_platform_marketing_")) {
      continue;
    }

    const metadata = safeRecord(event.metadata);
    const campaignId = text(metadata.campaign_id, 160);

    if (campaignId && !latestActionByCampaign.has(campaignId)) {
      latestActionByCampaign.set(campaignId, eventType);
    }
  }

  return latestActionByCampaign;
}

export function resolveMarketingRegistryStatus(params: {
  fallbackStatus: MarketingStatus;
  latestActionByCampaign: Map<string, string>;
  registryKey: string;
}): MarketingStatus {
  const eventType = params.latestActionByCampaign.get(params.registryKey) ?? "";
  return resolveMarketingStatusFromPlatformAction(eventType, params.fallbackStatus);
}

function dateValue(value: unknown) {
  if (typeof value !== "string" || !value) {
    return 0;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}
