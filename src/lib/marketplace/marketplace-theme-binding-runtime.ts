import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  listThemePresets,
  type PlatformThemePresetRecord,
  type PlatformThemePresetStatus
} from "@/src/lib/platform-theme/platform-theme-presets";

export type MarketplaceThemeBindingStatus = "bound" | "invalid" | "orphaned" | "unbound";

export type MarketplaceThemeBindingRecord = {
  bindingStatus: MarketplaceThemeBindingStatus;
  bindingUpdatedAt: string | null;
  linkedThemeId: string | null;
  themeKey: string | null;
  themeName: string | null;
  themeStatus: PlatformThemePresetStatus | null;
  themeVersion: string | null;
  verificationIssues: string[];
  verified: boolean;
};

export type MarketplaceThemeBindingVerification = MarketplaceThemeBindingRecord & {
  itemId: string;
  itemKey: string;
  itemName: string;
  marketplaceStatus: string;
  marketplaceVisibility: string;
};

export type MarketplaceThemeBindingStats = {
  boundThemeItems: number;
  invalidThemeItems: number;
  orphanedThemeItems: number;
  totalThemeItems: number;
  unboundThemeItems: number;
  verifiedThemeItems: number;
};

export const MARKETPLACE_THEME_BINDING_STATUSES: readonly MarketplaceThemeBindingStatus[] = [
  "bound",
  "invalid",
  "orphaned",
  "unbound"
] as const;

const bindingItemSelect =
  "id, item_key, name, item_type, section, status, visibility, linked_theme_id, theme_version, theme_binding_status, theme_binding_updated_at";

const legacyThemeItemKeyMap: Record<string, string> = {
  "theme:platform-brand-pack": "default"
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

function rowRecord(value: unknown) {
  const candidate = value as unknown;
  return isRecord(candidate) ? candidate : null;
}

export function isValidMarketplaceThemeBindingStatus(
  value: unknown
): value is MarketplaceThemeBindingStatus {
  return MARKETPLACE_THEME_BINDING_STATUSES.includes(value as MarketplaceThemeBindingStatus);
}

export function parseMarketplaceThemeBindingStatus(
  value: unknown
): MarketplaceThemeBindingStatus | null {
  const cleaned = text(value, 40);
  return isValidMarketplaceThemeBindingStatus(cleaned) ? cleaned : null;
}

function parseThemePresetStatus(value: unknown): PlatformThemePresetStatus | null {
  const cleaned = text(value, 40);
  if (cleaned === "active" || cleaned === "archived") {
    return cleaned;
  }
  return null;
}

function themeKeyFromMarketplaceItemKey(itemKey: string) {
  const cleaned = text(itemKey, 160);
  return cleaned.startsWith("theme:") ? cleaned.slice("theme:".length) : "";
}

function resolvePresetKeyFromItemKey(itemKey: string) {
  const cleaned = text(itemKey, 160);
  return legacyThemeItemKeyMap[cleaned] ?? themeKeyFromMarketplaceItemKey(cleaned);
}

function resolveThemeBindingVersion(preset: PlatformThemePresetRecord, storedVersion: string | null) {
  if (storedVersion) return storedVersion;
  if (preset.updatedAt) return preset.updatedAt.slice(0, 10);
  return "1";
}

export function evaluateMarketplaceThemeBinding(params: {
  itemKey: string;
  itemType: string;
  linkedThemeId: string | null;
  marketplaceStatus: string;
  marketplaceVisibility: string;
  storedBindingStatus: MarketplaceThemeBindingStatus | null;
  preset: PlatformThemePresetRecord | null;
  themeVersion: string | null;
}): MarketplaceThemeBindingRecord {
  if (params.itemType !== "theme") {
    return {
      bindingStatus: "unbound",
      bindingUpdatedAt: null,
      linkedThemeId: null,
      themeKey: null,
      themeName: null,
      themeStatus: null,
      themeVersion: null,
      verificationIssues: [],
      verified: true
    };
  }

  const verificationIssues: string[] = [];
  const expectedPresetKey = resolvePresetKeyFromItemKey(params.itemKey);

  if (!params.linkedThemeId) {
    return {
      bindingStatus: "unbound",
      bindingUpdatedAt: null,
      linkedThemeId: null,
      themeKey: expectedPresetKey || null,
      themeName: null,
      themeStatus: null,
      themeVersion: null,
      verificationIssues: ["Theme marketplace item is missing linked_theme_id."],
      verified: false
    };
  }

  if (!params.preset) {
    return {
      bindingStatus: "orphaned",
      bindingUpdatedAt: null,
      linkedThemeId: params.linkedThemeId,
      themeKey: expectedPresetKey || null,
      themeName: null,
      themeStatus: null,
      themeVersion: params.themeVersion,
      verificationIssues: ["Linked platform theme preset was not found."],
      verified: false
    };
  }

  if (expectedPresetKey && expectedPresetKey !== params.preset.presetKey) {
    verificationIssues.push("Marketplace item_key does not match linked theme preset_key.");
  }

  if (params.preset.status === "archived" && params.marketplaceStatus === "approved") {
    verificationIssues.push("Linked theme preset is archived while marketplace item remains approved.");
  }

  if (params.marketplaceVisibility === "public" && params.marketplaceStatus === "approved") {
    if (params.preset.status !== "active") {
      verificationIssues.push("Public approved marketplace theme items require an active theme preset.");
    }
  }

  const bindingStatus: MarketplaceThemeBindingStatus = verificationIssues.length ? "invalid" : "bound";

  return {
    bindingStatus,
    bindingUpdatedAt: null,
    linkedThemeId: params.linkedThemeId,
    themeKey: params.preset.presetKey,
    themeName: params.preset.name,
    themeStatus: params.preset.status,
    themeVersion: resolveThemeBindingVersion(params.preset, params.themeVersion),
    verificationIssues,
    verified: verificationIssues.length === 0 && bindingStatus === "bound"
  };
}

async function requireSuperAdmin() {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can access marketplace theme binding runtime.");
  }

  return access;
}

function requireAdminClient() {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for marketplace theme binding runtime.");
  }

  return admin;
}

async function loadMarketplaceThemeBindingItem(itemId: string) {
  const cleanedId = text(itemId, 120);

  if (!cleanedId) {
    throw new Error("Marketplace item id is required.");
  }

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("marketplace_items" as never)
    .select(bindingItemSelect as never)
    .eq("id" as never, cleanedId as never)
    .maybeSingle();

  if (error) {
    throw new Error(`Marketplace theme binding item could not be loaded: ${error.message}`);
  }

  if (!data) {
    throw new Error("Marketplace item was not found.");
  }

  const row = rowRecord(data);

  if (!row) {
    throw new Error("Marketplace theme binding item record is invalid.");
  }

  const id = text(row.id, 120);
  const itemKey = text(row.item_key, 160);
  const name = text(row.name, 240);
  const itemType = text(row.item_type, 40);

  if (!id || !itemKey || !name || itemType !== "theme") {
    throw new Error("Marketplace theme binding requires a theme marketplace item.");
  }

  return {
    bindingStatus: parseMarketplaceThemeBindingStatus(row.theme_binding_status),
    bindingUpdatedAt: text(row.theme_binding_updated_at, 80) || null,
    id,
    itemKey,
    linkedThemeId: text(row.linked_theme_id, 120) || null,
    name,
    status: text(row.status, 40),
    themeVersion: text(row.theme_version, 40) || null,
    visibility: text(row.visibility, 40)
  };
}

async function findThemePresetById(presetId: string, presets?: PlatformThemePresetRecord[]) {
  const cleaned = text(presetId, 120);
  if (!cleaned) return null;
  const registry = presets ?? (await listThemePresets());
  return registry.find((preset) => preset.id === cleaned) ?? null;
}

async function findThemePresetByKey(presetKey: string, presets?: PlatformThemePresetRecord[]) {
  const cleaned = text(presetKey, 120);
  if (!cleaned) return null;
  const registry = presets ?? (await listThemePresets());
  return registry.find((preset) => preset.presetKey === cleaned) ?? null;
}

async function persistMarketplaceThemeBinding(params: {
  bindingStatus: MarketplaceThemeBindingStatus;
  itemId: string;
  linkedThemeId: string | null;
  themeVersion: string | null;
}) {
  const admin = requireAdminClient();
  const now = new Date().toISOString();
  const { error } = await admin
    .from("marketplace_items" as never)
    .update({
      linked_theme_id: params.linkedThemeId,
      theme_binding_status: params.bindingStatus,
      theme_binding_updated_at: now,
      theme_version: params.themeVersion
    } as never)
    .eq("id" as never, params.itemId as never);

  if (error) {
    throw new Error(`Marketplace theme binding could not be saved: ${error.message}`);
  }

  return now;
}

async function recordMarketplaceThemeBindingAudit(params: {
  binding: MarketplaceThemeBindingVerification;
  userId: string;
}) {
  const admin = requireAdminClient();

  await admin.from("monitoring_events" as never).insert({
    entity_id: params.binding.itemId,
    entity_type: "admin_marketplace_management",
    event_status: "info",
    event_type: "admin_marketplace_verify_theme_binding",
    metadata: {
      binding_status: params.binding.bindingStatus,
      item_id: params.binding.itemId,
      item_key: params.binding.itemKey,
      item_name: params.binding.itemName,
      linked_theme_id: params.binding.linkedThemeId,
      note: "Super Admin marketplace theme binding verification. Binding only. No theme sales, installation, or purchases.",
      source_runtime: "marketplace_theme_binding_runtime",
      theme_key: params.binding.themeKey,
      theme_version: params.binding.themeVersion,
      verification_issues: params.binding.verificationIssues,
      verified: params.binding.verified
    },
    store_id: null,
    user_id: params.userId,
    workspace_id: null
  } as never);
}

export async function validateMarketplaceThemeReference(themeId: string) {
  await requireSuperAdmin();

  const preset = await findThemePresetById(themeId);

  if (!preset) {
    throw new Error("Platform theme preset was not found.");
  }

  return preset;
}

export async function verifyMarketplaceThemeBinding(
  itemId: string,
  options: { writeAudit?: boolean } = {}
): Promise<MarketplaceThemeBindingVerification> {
  const access = await requireSuperAdmin();
  const item = await loadMarketplaceThemeBindingItem(itemId);
  const preset = item.linkedThemeId ? await findThemePresetById(item.linkedThemeId) : null;
  const evaluation = evaluateMarketplaceThemeBinding({
    itemKey: item.itemKey,
    itemType: "theme",
    linkedThemeId: item.linkedThemeId,
    marketplaceStatus: item.status,
    marketplaceVisibility: item.visibility,
    storedBindingStatus: item.bindingStatus,
    preset,
    themeVersion: preset ? resolveThemeBindingVersion(preset, item.themeVersion) : item.themeVersion
  });

  const bindingUpdatedAt = await persistMarketplaceThemeBinding({
    bindingStatus: evaluation.bindingStatus,
    itemId: item.id,
    linkedThemeId: item.linkedThemeId,
    themeVersion: evaluation.themeVersion
  });

  const verification: MarketplaceThemeBindingVerification = {
    ...evaluation,
    bindingUpdatedAt,
    itemId: item.id,
    itemKey: item.itemKey,
    itemName: item.name,
    marketplaceStatus: item.status,
    marketplaceVisibility: item.visibility
  };

  if (options.writeAudit !== false) {
    await recordMarketplaceThemeBindingAudit({
      binding: verification,
      userId: access.user.id
    });
  }

  return verification;
}

export async function bindMarketplaceThemeItem(itemId: string, themeId: string) {
  const access = await requireSuperAdmin();
  const item = await loadMarketplaceThemeBindingItem(itemId);
  const preset = await validateMarketplaceThemeReference(themeId);
  const themeVersion = resolveThemeBindingVersion(preset, item.themeVersion);

  await persistMarketplaceThemeBinding({
    bindingStatus: "bound",
    itemId: item.id,
    linkedThemeId: preset.id,
    themeVersion
  });

  const verification = await verifyMarketplaceThemeBinding(item.id, { writeAudit: false });

  await recordMarketplaceThemeBindingAudit({
    binding: verification,
    userId: access.user.id
  });

  return verification;
}

export async function getMarketplaceThemeBindingSummary(
  itemId: string
): Promise<MarketplaceThemeBindingVerification | null> {
  await requireSuperAdmin();

  try {
    const item = await loadMarketplaceThemeBindingItem(itemId);
    const preset = item.linkedThemeId ? await findThemePresetById(item.linkedThemeId) : null;
    const evaluation = evaluateMarketplaceThemeBinding({
      itemKey: item.itemKey,
      itemType: "theme",
      linkedThemeId: item.linkedThemeId,
      marketplaceStatus: item.status,
      marketplaceVisibility: item.visibility,
      storedBindingStatus: item.bindingStatus,
      preset,
      themeVersion: preset ? resolveThemeBindingVersion(preset, item.themeVersion) : item.themeVersion
    });

    return {
      ...evaluation,
      bindingUpdatedAt: item.bindingUpdatedAt,
      itemId: item.id,
      itemKey: item.itemKey,
      itemName: item.name,
      marketplaceStatus: item.status,
      marketplaceVisibility: item.visibility
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes("requires a theme marketplace item")) {
      return null;
    }

    throw error;
  }
}

export async function ensureMarketplaceThemeBindings() {
  await requireSuperAdmin();

  const admin = requireAdminClient();
  const [presets, { data, error }] = await Promise.all([
    listThemePresets(),
    admin
      .from("marketplace_items" as never)
      .select(bindingItemSelect as never)
      .eq("item_type" as never, "theme" as never)
  ]);

  if (error) {
    throw new Error(`Marketplace theme items could not be loaded: ${error.message}`);
  }

  const rows = (Array.isArray(data) ? (data as unknown[]) : [])
    .map((row) => rowRecord(row))
    .filter((row): row is Record<string, unknown> => Boolean(row));

  for (const row of rows) {
    const id = text(row.id, 120);
    const itemKey = text(row.item_key, 160);
    let linkedThemeId = text(row.linked_theme_id, 120) || null;

    if (!id || !itemKey) continue;

    if (!linkedThemeId) {
      const preset = await findThemePresetByKey(resolvePresetKeyFromItemKey(itemKey), presets);
      linkedThemeId = preset?.id ?? null;
    }

    const preset = linkedThemeId ? await findThemePresetById(linkedThemeId, presets) : null;
    const evaluation = evaluateMarketplaceThemeBinding({
      itemKey,
      itemType: "theme",
      linkedThemeId,
      marketplaceStatus: text(row.status, 40),
      marketplaceVisibility: text(row.visibility, 40),
      storedBindingStatus: parseMarketplaceThemeBindingStatus(row.theme_binding_status),
      preset,
      themeVersion: preset
        ? resolveThemeBindingVersion(preset, text(row.theme_version, 40) || null)
        : text(row.theme_version, 40) || null
    });

    await persistMarketplaceThemeBinding({
      bindingStatus: evaluation.bindingStatus,
      itemId: id,
      linkedThemeId,
      themeVersion: evaluation.themeVersion
    });
  }
}

export async function getMarketplaceThemeBindingStats(): Promise<MarketplaceThemeBindingStats> {
  await ensureMarketplaceThemeBindings();

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("marketplace_items" as never)
    .select("theme_binding_status" as never)
    .eq("item_type" as never, "theme" as never);

  if (error) {
    throw new Error(`Marketplace theme binding stats could not be loaded: ${error.message}`);
  }

  const rows = (Array.isArray(data) ? (data as unknown[]) : [])
    .map((row) => rowRecord(row))
    .filter((row): row is Record<string, unknown> => Boolean(row));

  return rows.reduce<MarketplaceThemeBindingStats>(
    (stats, row) => {
      stats.totalThemeItems += 1;
      const status = parseMarketplaceThemeBindingStatus(row.theme_binding_status) ?? "unbound";

      if (status === "bound") stats.boundThemeItems += 1;
      if (status === "invalid") stats.invalidThemeItems += 1;
      if (status === "orphaned") stats.orphanedThemeItems += 1;
      if (status === "unbound") stats.unboundThemeItems += 1;

      return stats;
    },
    {
      boundThemeItems: 0,
      invalidThemeItems: 0,
      orphanedThemeItems: 0,
      totalThemeItems: 0,
      unboundThemeItems: 0,
      verifiedThemeItems: 0
    }
  );
}
