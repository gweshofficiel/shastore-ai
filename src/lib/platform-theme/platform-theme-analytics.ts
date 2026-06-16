import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { listBrandSettings } from "@/src/lib/platform-theme/platform-brand-settings";
import { listPlatformThemeAssets } from "@/src/lib/platform-theme/platform-theme-assets";
import { listThemePresets } from "@/src/lib/platform-theme/platform-theme-presets";

export type PlatformThemeAnalyticsRange = "all_time" | "last_30_days" | "last_7_days" | "today";

export type PlatformThemeAnalyticsMetric = {
  label: string;
  value: number | string;
};

export type PlatformThemeTrendPoint = {
  date: string;
  label: string;
  value: number;
};

export type PlatformThemeTrendWidget = {
  label: string;
  points: PlatformThemeTrendPoint[];
  total: number;
};

export type PlatformThemeAnalyticsOverview = {
  activeAssets: number;
  activePresets: number;
  draftSettings: number;
  publishedSettings: number;
  range: PlatformThemeAnalyticsRange;
  totalSettings: number;
};

export type PlatformThemePublishAnalytics = {
  lastPublishDate: string | null;
  publishesLast30Days: number;
  publishesLast7Days: number;
  publishesInRange: number;
  range: PlatformThemeAnalyticsRange;
  totalPublishes: number;
};

export type PlatformThemeAssetAnalytics = {
  archivedAssets: number;
  faviconsCount: number;
  logosCount: number;
  range: PlatformThemeAnalyticsRange;
  storageUsageSummary: string;
  totalActiveAssets: number;
};

export type PlatformThemePresetAnalytics = {
  customPresets: number;
  mostUsedPreset: string;
  mostUsedPresetCount: number;
  range: PlatformThemeAnalyticsRange;
  systemPresets: number;
  totalPresets: number;
};

export type PlatformThemeVersionAnalytics = {
  latestVersionNumber: number;
  range: PlatformThemeAnalyticsRange;
  rollbackCount: number;
  snapshotsInRange: number;
  totalSnapshots: number;
};

export type PlatformThemeAnalyticsDashboard = {
  assets: PlatformThemeAssetAnalytics;
  overview: PlatformThemeAnalyticsOverview;
  presets: PlatformThemePresetAnalytics;
  publish: PlatformThemePublishAnalytics;
  range: PlatformThemeAnalyticsRange;
  trends: {
    assetUploads: PlatformThemeTrendWidget;
    presetUsage: PlatformThemeTrendWidget;
    publishActivity: PlatformThemeTrendWidget;
    versionCreation: PlatformThemeTrendWidget;
  };
  versions: PlatformThemeVersionAnalytics;
};

type VersionEventRow = {
  created_at?: string | null;
  snapshot_type?: string | null;
  version_number?: number | null;
};

type MonitoringEventRow = {
  created_at?: string | null;
  event_type?: string | null;
  metadata?: unknown;
};

type AnalyticsContext = {
  monitoringEvents: MonitoringEventRow[];
  range: PlatformThemeAnalyticsRange;
  rangeStart: Date | null;
  versionEvents: VersionEventRow[];
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function safeRecord(value: unknown) {
  return isRecord(value) ? value : {};
}

function parseDate(value: unknown) {
  const cleaned = text(value, 80);

  if (!cleaned) return null;

  const date = new Date(cleaned);

  return Number.isNaN(date.getTime()) ? null : date;
}

export function parsePlatformThemeAnalyticsRange(value: unknown): PlatformThemeAnalyticsRange {
  const cleaned = text(value, 40);

  if (cleaned === "today" || cleaned === "last_7_days" || cleaned === "last_30_days" || cleaned === "all_time") {
    return cleaned;
  }

  return "last_7_days";
}

function startDateForRange(range: PlatformThemeAnalyticsRange) {
  if (range === "all_time") {
    return null;
  }

  const date = new Date();

  if (range === "today") {
    date.setHours(0, 0, 0, 0);
    return date;
  }

  date.setDate(date.getDate() - (range === "last_7_days" ? 7 : 30));
  return date;
}

function isInRange(date: Date | null, rangeStart: Date | null, range: PlatformThemeAnalyticsRange) {
  if (range === "all_time" || !rangeStart || !date) {
    return range === "all_time";
  }

  return date >= rangeStart;
}

async function requireSuperAdmin() {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can view platform theme analytics.");
  }
}

function requireAdminClient() {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for platform theme analytics.");
  }

  return admin;
}

function settingsDiffer(left: Record<string, unknown>, right: Record<string, unknown>) {
  return JSON.stringify(left) !== JSON.stringify(right);
}

async function loadAnalyticsContext(range: PlatformThemeAnalyticsRange): Promise<AnalyticsContext> {
  await requireSuperAdmin();

  const admin = requireAdminClient();
  const [versionResult, monitoringResult] = await Promise.all([
    admin
      .from("platform_theme_versions" as never)
      .select("created_at, snapshot_type, version_number")
      .order("created_at" as never, { ascending: false })
      .limit(1000),
    admin
      .from("monitoring_events" as never)
      .select("created_at, event_type, metadata")
      .eq("entity_type" as never, "admin_platform_theme_branding" as never)
      .order("created_at" as never, { ascending: false })
      .limit(1000)
  ]);

  if (versionResult.error) {
    throw new Error(`Platform theme version analytics could not be loaded: ${versionResult.error.message}`);
  }

  if (monitoringResult.error) {
    throw new Error(`Platform theme monitoring analytics could not be loaded: ${monitoringResult.error.message}`);
  }

  return {
    monitoringEvents: (Array.isArray(monitoringResult.data) ? monitoringResult.data : []) as MonitoringEventRow[],
    range,
    rangeStart: startDateForRange(range),
    versionEvents: (Array.isArray(versionResult.data) ? versionResult.data : []) as VersionEventRow[]
  };
}

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function dayLabel(key: string) {
  const date = new Date(`${key}T00:00:00.000Z`);

  return date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC"
  });
}

function buildTrendPoints(dates: Array<Date | null>, range: PlatformThemeAnalyticsRange): PlatformThemeTrendPoint[] {
  const counts = new Map<string, number>();

  for (const date of dates) {
    if (!date) continue;

    if (range !== "all_time") {
      const rangeStart = startDateForRange(range);

      if (rangeStart && date < rangeStart) {
        continue;
      }
    } else {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 90);

      if (date < cutoff) {
        continue;
      }
    }

    const key = dayKey(date);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-14)
    .map(([date, value]) => ({
      date,
      label: dayLabel(date),
      value
    }));
}

function buildTrendWidget(label: string, points: PlatformThemeTrendPoint[]): PlatformThemeTrendWidget {
  return {
    label,
    points,
    total: points.reduce((total, point) => total + point.value, 0)
  };
}

function formatBytes(totalBytes: number) {
  if (!totalBytes) {
    return "0.00 MB";
  }

  return `${(totalBytes / (1024 * 1024)).toFixed(2)} MB`;
}

function countSince(events: VersionEventRow[], days: number, snapshotType?: string) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  return events.filter((event) => {
    if (snapshotType && text(event.snapshot_type, 40) !== snapshotType) {
      return false;
    }

    const createdAt = parseDate(event.created_at);

    return Boolean(createdAt && createdAt >= cutoff);
  }).length;
}

function monitoringEventsInRange(context: AnalyticsContext, eventTypes: Set<string>) {
  return context.monitoringEvents.filter((event) => {
    const eventType = text(event.event_type, 120);

    if (!eventTypes.has(eventType)) {
      return false;
    }

    const createdAt = parseDate(event.created_at);

    return isInRange(createdAt, context.rangeStart, context.range);
  });
}

function versionEventsInRange(context: AnalyticsContext, snapshotType?: string) {
  return context.versionEvents.filter((event) => {
    if (snapshotType && text(event.snapshot_type, 40) !== snapshotType) {
      return false;
    }

    const createdAt = parseDate(event.created_at);

    return isInRange(createdAt, context.rangeStart, context.range);
  });
}

export async function getThemeAnalyticsOverview(range: PlatformThemeAnalyticsRange = "last_7_days"): Promise<PlatformThemeAnalyticsOverview> {
  await requireSuperAdmin();

  const [settings, assets, presets] = await Promise.all([
    listBrandSettings(),
    listPlatformThemeAssets(),
    listThemePresets(false)
  ]);

  const publishedSettings = settings.filter(
    (setting) => setting.status === "published" || Object.keys(setting.publishedValue).length > 0
  ).length;
  const draftSettings = settings.filter((setting) => settingsDiffer(setting.draftValue, setting.publishedValue)).length;
  const activeAssets = assets.filter((asset) => asset.status === "draft" || asset.status === "published").length;
  const activePresets = presets.filter((preset) => preset.status === "active").length;

  return {
    activeAssets,
    activePresets,
    draftSettings,
    publishedSettings,
    range,
    totalSettings: settings.length
  };
}

export async function getThemePublishAnalytics(range: PlatformThemeAnalyticsRange = "last_7_days"): Promise<PlatformThemePublishAnalytics> {
  const context = await loadAnalyticsContext(range);
  const publishEvents = context.versionEvents.filter((event) => text(event.snapshot_type, 40) === "published");
  const lastPublish = publishEvents
    .map((event) => parseDate(event.created_at))
    .filter((date): date is Date => Boolean(date))
    .sort((left, right) => right.getTime() - left.getTime())[0] ?? null;

  return {
    lastPublishDate: lastPublish ? lastPublish.toISOString() : null,
    publishesLast30Days: countSince(context.versionEvents, 30, "published"),
    publishesLast7Days: countSince(context.versionEvents, 7, "published"),
    publishesInRange: versionEventsInRange(context, "published").length,
    range,
    totalPublishes: publishEvents.length
  };
}

export async function getThemeAssetAnalytics(range: PlatformThemeAnalyticsRange = "last_7_days"): Promise<PlatformThemeAssetAnalytics> {
  await requireSuperAdmin();

  const assets = await listPlatformThemeAssets();
  const activeAssets = assets.filter((asset) => asset.status === "draft" || asset.status === "published");
  const archivedAssets = assets.filter((asset) => asset.status === "archived").length;
  const logosCount = activeAssets.filter((asset) => asset.assetType === "logo").length;
  const faviconsCount = activeAssets.filter((asset) => asset.assetType === "favicon").length;
  const storageBytes = activeAssets.reduce((total, asset) => total + asset.fileSize, 0);

  return {
    archivedAssets,
    faviconsCount,
    logosCount,
    range,
    storageUsageSummary: formatBytes(storageBytes),
    totalActiveAssets: activeAssets.length
  };
}

export async function getThemePresetAnalytics(range: PlatformThemeAnalyticsRange = "last_7_days"): Promise<PlatformThemePresetAnalytics> {
  const context = await loadAnalyticsContext(range);
  const presets = await listThemePresets(true);
  const applyEvents = monitoringEventsInRange(context, new Set(["admin_platform_theme_preset_apply"]));
  const presetUsage = new Map<string, number>();

  for (const event of applyEvents) {
    const metadata = safeRecord(event.metadata);
    const presetKey = text(metadata.preset_key, 120) || "unknown";
    presetUsage.set(presetKey, (presetUsage.get(presetKey) ?? 0) + 1);
  }

  const mostUsed = Array.from(presetUsage.entries()).sort((left, right) => right[1] - left[1])[0];

  return {
    customPresets: presets.filter((preset) => !preset.isSystem && preset.status === "active").length,
    mostUsedPreset: mostUsed?.[0] ?? "None yet",
    mostUsedPresetCount: mostUsed?.[1] ?? 0,
    range,
    systemPresets: presets.filter((preset) => preset.isSystem && preset.status === "active").length,
    totalPresets: presets.filter((preset) => preset.status === "active").length
  };
}

export async function getThemeVersionAnalytics(range: PlatformThemeAnalyticsRange = "last_7_days"): Promise<PlatformThemeVersionAnalytics> {
  const context = await loadAnalyticsContext(range);
  const latestVersionNumber = context.versionEvents.reduce((latest, event) => {
    const versionNumber = typeof event.version_number === "number" ? event.version_number : 0;
    return Math.max(latest, versionNumber);
  }, 0);

  return {
    latestVersionNumber,
    range,
    rollbackCount: context.versionEvents.filter((event) => text(event.snapshot_type, 40) === "rollback_to_draft").length,
    snapshotsInRange: versionEventsInRange(context).length,
    totalSnapshots: context.versionEvents.length
  };
}

export async function getPlatformThemeAnalyticsTrends(range: PlatformThemeAnalyticsRange = "last_7_days") {
  const context = await loadAnalyticsContext(range);

  const publishDates = versionEventsInRange(context, "published")
    .map((event) => parseDate(event.created_at))
    .filter((date): date is Date => Boolean(date));
  const versionDates = versionEventsInRange(context)
    .map((event) => parseDate(event.created_at))
    .filter((date): date is Date => Boolean(date));
  const assetUploadDates = [
    ...versionEventsInRange(context, "asset_uploaded").map((event) => parseDate(event.created_at)),
    ...monitoringEventsInRange(
      context,
      new Set(["admin_platform_theme_logo_upload", "admin_platform_theme_favicon_upload"])
    ).map((event) => parseDate(event.created_at))
  ].filter((date): date is Date => Boolean(date));
  const presetUsageDates = monitoringEventsInRange(context, new Set(["admin_platform_theme_preset_apply"]))
    .map((event) => parseDate(event.created_at))
    .filter((date): date is Date => Boolean(date));

  return {
    assetUploads: buildTrendWidget("Asset uploads", buildTrendPoints(assetUploadDates, range)),
    presetUsage: buildTrendWidget("Preset usage", buildTrendPoints(presetUsageDates, range)),
    publishActivity: buildTrendWidget("Publish activity", buildTrendPoints(publishDates, range)),
    range,
    versionCreation: buildTrendWidget("Version creation", buildTrendPoints(versionDates, range))
  };
}

export async function getPlatformThemeAnalyticsDashboard(
  rangeInput: unknown = "last_7_days"
): Promise<PlatformThemeAnalyticsDashboard> {
  const range = parsePlatformThemeAnalyticsRange(rangeInput);
  const [overview, publish, assets, presets, versions, trends] = await Promise.all([
    getThemeAnalyticsOverview(range),
    getThemePublishAnalytics(range),
    getThemeAssetAnalytics(range),
    getThemePresetAnalytics(range),
    getThemeVersionAnalytics(range),
    getPlatformThemeAnalyticsTrends(range)
  ]);

  return {
    assets,
    overview,
    presets,
    publish,
    range,
    trends,
    versions
  };
}
