import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";

export type PlatformThemeSectionType =
  | "color"
  | "custom"
  | "favicon"
  | "language"
  | "logo"
  | "mode"
  | "preview"
  | "typography";

export type PlatformThemeSectionStatus = "disabled" | "needs_attention" | "placeholder" | "ready";

export type PlatformThemeRegistrySection = {
  createdAt: string | null;
  description: string | null;
  id: string;
  isSystem: boolean;
  sectionKey: string;
  sectionLabel: string;
  sectionType: PlatformThemeSectionType;
  sortOrder: number;
  status: PlatformThemeSectionStatus;
  updatedAt: string | null;
  value: Record<string, unknown>;
};

type PlatformThemeRegistryRow = {
  created_at?: string | null;
  description?: string | null;
  id?: string | null;
  is_system?: boolean | null;
  section_key?: string | null;
  section_label?: string | null;
  section_type?: string | null;
  sort_order?: number | null;
  status?: string | null;
  updated_at?: string | null;
  value?: unknown;
};

const sectionTypes: PlatformThemeSectionType[] = [
  "logo",
  "favicon",
  "color",
  "typography",
  "mode",
  "language",
  "preview",
  "custom"
];
const sectionStatuses: PlatformThemeSectionStatus[] = ["ready", "placeholder", "needs_attention", "disabled"];

const seedSections = [
  {
    description: "Text/logo mark for SHASTORE SaaS interface and public platform website.",
    section_key: "platform_logo",
    section_label: "Platform logo",
    section_type: "logo",
    sort_order: 10,
    status: "ready",
    value: { text: "SHASTORE AI" }
  },
  {
    description: "Favicon placeholder only; upload workflow is not connected yet.",
    section_key: "favicon",
    section_label: "Favicon",
    section_type: "favicon",
    sort_order: 20,
    status: "placeholder",
    value: { text: "Platform favicon placeholder" }
  },
  {
    description: "Primary platform brand color for admin/public chrome.",
    section_key: "primary_color",
    section_label: "Primary color",
    section_type: "color",
    sort_order: 30,
    status: "ready",
    value: { hex: "#0f172a" }
  },
  {
    description: "Secondary platform brand color for links and supporting CTAs.",
    section_key: "secondary_color",
    section_label: "Secondary color",
    section_type: "color",
    sort_order: 40,
    status: "ready",
    value: { hex: "#2563eb" }
  },
  {
    description: "Accent color reserved for highlights and marketing moments.",
    section_key: "accent_color",
    section_label: "Accent color",
    section_type: "color",
    sort_order: 50,
    status: "ready",
    value: { hex: "#f97316" }
  },
  {
    description: "Platform typography stack for SaaS UI and marketing pages.",
    section_key: "typography",
    section_label: "Typography",
    section_type: "typography",
    sort_order: 60,
    status: "ready",
    value: { stack: "Inter / system sans" }
  },
  {
    description: "Dark mode is reserved and does not change live UI yet.",
    section_key: "dark_mode",
    section_label: "Dark mode placeholder",
    section_type: "mode",
    sort_order: 70,
    status: "placeholder",
    value: { mode: "placeholder" }
  },
  {
    description: "Light mode is the current platform baseline.",
    section_key: "light_mode",
    section_label: "Light mode placeholder",
    section_type: "mode",
    sort_order: 80,
    status: "placeholder",
    value: { mode: "placeholder" }
  }
] satisfies Array<{
  description: string;
  section_key: string;
  section_label: string;
  section_type: PlatformThemeSectionType;
  sort_order: number;
  status: PlatformThemeSectionStatus;
  value: Record<string, unknown>;
}>;

function text(value: unknown, maxLength = 240) {
  return typeof value === "string" && value.trim()
    ? value.trim().replace(/\s+/g, " ").slice(0, maxLength)
    : "";
}

function jsonRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function parseSectionType(value: unknown): PlatformThemeSectionType {
  const cleaned = text(value, 40);
  return sectionTypes.includes(cleaned as PlatformThemeSectionType) ? cleaned as PlatformThemeSectionType : "custom";
}

function parseStatus(value: unknown): PlatformThemeSectionStatus {
  const cleaned = text(value, 40);
  return sectionStatuses.includes(cleaned as PlatformThemeSectionStatus) ? cleaned as PlatformThemeSectionStatus : "placeholder";
}

function parseSection(row: unknown): PlatformThemeRegistrySection | null {
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    return null;
  }

  const value = row as PlatformThemeRegistryRow;
  const id = text(value.id, 120);
  const sectionKey = text(value.section_key, 120);
  const sectionLabel = text(value.section_label, 180);

  if (!id || !sectionKey || !sectionLabel) {
    return null;
  }

  return {
    createdAt: text(value.created_at, 80) || null,
    description: text(value.description, 500) || null,
    id,
    isSystem: value.is_system !== false,
    sectionKey,
    sectionLabel,
    sectionType: parseSectionType(value.section_type),
    sortOrder: typeof value.sort_order === "number" ? value.sort_order : 0,
    status: parseStatus(value.status),
    updatedAt: text(value.updated_at, 80) || null,
    value: jsonRecord(value.value)
  };
}

async function requireSuperAdmin() {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can access platform theme registry.");
  }
}

function requireAdminClient() {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for platform theme registry.");
  }

  return admin;
}

function sectionSelect() {
  return "id, section_key, section_label, section_type, value, status, description, sort_order, is_system, created_at, updated_at";
}

export async function ensurePlatformThemeRegistry() {
  await requireSuperAdmin();
  const admin = requireAdminClient();
  const { data: existing, error: existingError } = await admin
    .from("platform_theme_registry" as never)
    .select("section_key");

  if (existingError) {
    throw new Error(`Platform theme registry could not be inspected: ${existingError.message}`);
  }

  const existingKeys = new Set(
    (Array.isArray(existing) ? existing as unknown[] : [])
      .map((row) => {
        const value = jsonRecord(row);
        return text(value.section_key, 120);
      })
      .filter(Boolean)
  );
  const missingSections = seedSections.filter((section) => !existingKeys.has(section.section_key));

  if (missingSections.length) {
    const { error } = await admin
      .from("platform_theme_registry" as never)
      .insert(missingSections.map((section) => ({
        ...section,
        is_system: true
      })) as never);

    if (error) {
      throw new Error(`Platform theme registry could not be seeded: ${error.message}`);
    }
  }

  return listPlatformThemeSections();
}

export async function listPlatformThemeSections() {
  await requireSuperAdmin();
  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("platform_theme_registry" as never)
    .select(sectionSelect())
    .order("sort_order" as never, { ascending: true })
    .order("section_label" as never, { ascending: true });

  if (error) {
    throw new Error(`Platform theme sections could not be loaded: ${error.message}`);
  }

  return (Array.isArray(data) ? data : [])
    .map((row) => parseSection(row))
    .filter((section): section is PlatformThemeRegistrySection => Boolean(section));
}

export async function getPlatformThemeSection(sectionKey: string) {
  await requireSuperAdmin();
  const cleanedKey = text(sectionKey, 120);

  if (!cleanedKey) {
    return null;
  }

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("platform_theme_registry" as never)
    .select(sectionSelect())
    .eq("section_key" as never, cleanedKey as never)
    .maybeSingle();

  if (error) {
    throw new Error(`Platform theme section could not be loaded: ${error.message}`);
  }

  return parseSection(data);
}
