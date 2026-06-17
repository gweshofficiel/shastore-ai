import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";

export type TemplateRegistryStatus = "active" | "archived" | "draft";
export type TemplateRegistryVisibility = "internal" | "marketplace" | "owner" | "reseller";

export type TemplateRegistryPackageSummary = {
  aiVisualSupport: boolean;
  blogCount: number;
  categoriesCount: number;
  domainEmailReadiness: "placeholder" | "ready";
  faqCount: number;
  pagesCount: number;
  productsCount: number;
};

export type TemplateRegistryRecord = {
  badges: string[];
  category: string | null;
  createdAt: string | null;
  id: string;
  industry: string | null;
  isOfficial: boolean;
  isRecommended: boolean;
  metadata: Record<string, unknown>;
  name: string;
  packageSummary: TemplateRegistryPackageSummary;
  slug: string;
  status: TemplateRegistryStatus;
  templateKey: string;
  updatedAt: string | null;
  version: string;
  visibility: TemplateRegistryVisibility;
};

export type TemplateRegistryStats = {
  activeTemplates: number;
  archivedTemplates: number;
  draftTemplates: number;
  hiddenInternal: number;
  officialTemplates: number;
  ownerVisible: number;
  resellerVisible: number;
  totalTemplates: number;
};

type TemplateRegistryRow = {
  badges?: unknown;
  category?: string | null;
  created_at?: string | null;
  id?: string | null;
  industry?: string | null;
  is_official?: boolean | null;
  is_recommended?: boolean | null;
  metadata?: unknown;
  name?: string | null;
  package_summary?: unknown;
  slug?: string | null;
  status?: string | null;
  template_key?: string | null;
  updated_at?: string | null;
  version?: string | null;
  visibility?: string | null;
};

const statuses: TemplateRegistryStatus[] = ["active", "draft", "archived"];
const visibilities: TemplateRegistryVisibility[] = ["owner", "reseller", "marketplace", "internal"];

const seedTemplates = [
  {
    badges: ["official", "recommended", "premium", "ready-to-use"],
    category: "multi-purpose",
    industry: "multi-purpose",
    is_official: true,
    is_recommended: true,
    metadata: { source: "template_registry_seed", storeTemplateId: "shastore-flagship-premium" },
    name: "SHASTORE Flagship Premium",
    package_summary: {
      aiVisualSupport: true,
      blogCount: 2,
      categoriesCount: 8,
      domainEmailReadiness: "ready",
      faqCount: 4,
      pagesCount: 9,
      productsCount: 6
    },
    slug: "shastore-flagship-premium",
    status: "active",
    template_key: "shastore-flagship-premium",
    version: "1",
    visibility: "marketplace"
  },
  {
    badges: ["starter"],
    category: "multi-purpose",
    industry: "multi-purpose",
    is_official: false,
    is_recommended: false,
    metadata: { source: "template_registry_seed", storeTemplateId: "multi-purpose-starter" },
    name: "Multi-purpose Starter",
    package_summary: {
      aiVisualSupport: true,
      blogCount: 0,
      categoriesCount: 0,
      domainEmailReadiness: "placeholder",
      faqCount: 0,
      pagesCount: 1,
      productsCount: 0
    },
    slug: "multi-purpose-starter",
    status: "active",
    template_key: "multi-purpose-starter",
    version: "1",
    visibility: "owner"
  },
  {
    badges: ["starter"],
    category: "fashion",
    industry: "fashion",
    is_official: false,
    is_recommended: false,
    metadata: { source: "template_registry_seed", storeTemplateId: "fashion-starter" },
    name: "Fashion Starter",
    package_summary: {
      aiVisualSupport: true,
      blogCount: 0,
      categoriesCount: 0,
      domainEmailReadiness: "placeholder",
      faqCount: 0,
      pagesCount: 1,
      productsCount: 0
    },
    slug: "fashion-starter",
    status: "active",
    template_key: "fashion-starter",
    version: "1",
    visibility: "owner"
  },
  {
    badges: ["starter"],
    category: "electronics",
    industry: "electronics",
    is_official: false,
    is_recommended: false,
    metadata: { source: "template_registry_seed", storeTemplateId: "electronics-starter" },
    name: "Electronics Starter",
    package_summary: {
      aiVisualSupport: true,
      blogCount: 0,
      categoriesCount: 0,
      domainEmailReadiness: "placeholder",
      faqCount: 0,
      pagesCount: 1,
      productsCount: 0
    },
    slug: "electronics-starter",
    status: "active",
    template_key: "electronics-starter",
    version: "1",
    visibility: "owner"
  },
  {
    badges: ["starter"],
    category: "beauty",
    industry: "beauty",
    is_official: false,
    is_recommended: false,
    metadata: { source: "template_registry_seed", storeTemplateId: "beauty-starter" },
    name: "Beauty Starter",
    package_summary: {
      aiVisualSupport: true,
      blogCount: 0,
      categoriesCount: 0,
      domainEmailReadiness: "placeholder",
      faqCount: 0,
      pagesCount: 1,
      productsCount: 0
    },
    slug: "beauty-starter",
    status: "active",
    template_key: "beauty-starter",
    version: "1",
    visibility: "owner"
  },
  {
    badges: ["starter"],
    category: "perfume",
    industry: "perfume",
    is_official: false,
    is_recommended: false,
    metadata: { source: "template_registry_seed", storeTemplateId: "perfume-starter" },
    name: "Perfume Starter",
    package_summary: {
      aiVisualSupport: true,
      blogCount: 0,
      categoriesCount: 0,
      domainEmailReadiness: "placeholder",
      faqCount: 0,
      pagesCount: 1,
      productsCount: 0
    },
    slug: "perfume-starter",
    status: "active",
    template_key: "perfume-starter",
    version: "1",
    visibility: "owner"
  },
  {
    badges: ["starter"],
    category: "restaurant",
    industry: "restaurant",
    is_official: false,
    is_recommended: false,
    metadata: { source: "template_registry_seed", storeTemplateId: "restaurant-starter" },
    name: "Restaurant Starter",
    package_summary: {
      aiVisualSupport: true,
      blogCount: 0,
      categoriesCount: 0,
      domainEmailReadiness: "placeholder",
      faqCount: 0,
      pagesCount: 1,
      productsCount: 0
    },
    slug: "restaurant-starter",
    status: "active",
    template_key: "restaurant-starter",
    version: "1",
    visibility: "owner"
  },
  {
    badges: ["starter"],
    category: "jewelry",
    industry: "jewelry",
    is_official: false,
    is_recommended: false,
    metadata: { source: "template_registry_seed", storeTemplateId: "jewelry-starter" },
    name: "Jewelry Starter",
    package_summary: {
      aiVisualSupport: true,
      blogCount: 0,
      categoriesCount: 0,
      domainEmailReadiness: "placeholder",
      faqCount: 0,
      pagesCount: 1,
      productsCount: 0
    },
    slug: "jewelry-starter",
    status: "active",
    template_key: "jewelry-starter",
    version: "1",
    visibility: "owner"
  },
  {
    badges: ["starter"],
    category: "general",
    industry: "general",
    is_official: false,
    is_recommended: false,
    metadata: { source: "template_registry_seed", storeTemplateId: "general-starter" },
    name: "General Starter",
    package_summary: {
      aiVisualSupport: true,
      blogCount: 0,
      categoriesCount: 0,
      domainEmailReadiness: "placeholder",
      faqCount: 0,
      pagesCount: 1,
      productsCount: 0
    },
    slug: "general-starter",
    status: "active",
    template_key: "general-starter",
    version: "1",
    visibility: "owner"
  },
  {
    badges: ["recommended", "premium"],
    category: "premium",
    industry: "premium",
    is_official: false,
    is_recommended: true,
    metadata: { source: "template_registry_seed", storeTemplateId: "aurora-pro" },
    name: "Aurora Pro",
    package_summary: {
      aiVisualSupport: true,
      blogCount: 0,
      categoriesCount: 0,
      domainEmailReadiness: "placeholder",
      faqCount: 0,
      pagesCount: 1,
      productsCount: 0
    },
    slug: "aurora-pro",
    status: "active",
    template_key: "aurora-pro",
    version: "1",
    visibility: "marketplace"
  }
] as const;

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

function parseStatus(value: unknown): TemplateRegistryStatus {
  const cleaned = text(value, 40);
  return statuses.includes(cleaned as TemplateRegistryStatus) ? cleaned as TemplateRegistryStatus : "active";
}

function parseVisibility(value: unknown): TemplateRegistryVisibility {
  const cleaned = text(value, 40);
  return visibilities.includes(cleaned as TemplateRegistryVisibility)
    ? cleaned as TemplateRegistryVisibility
    : "owner";
}

function parseBadges(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value.map((item) => text(item, 80)).filter(Boolean);
}

function parsePackageSummary(value: unknown): TemplateRegistryPackageSummary {
  const record = safeRecord(value);

  return {
    aiVisualSupport: record.aiVisualSupport === true,
    blogCount: typeof record.blogCount === "number" && Number.isFinite(record.blogCount) ? record.blogCount : 0,
    categoriesCount:
      typeof record.categoriesCount === "number" && Number.isFinite(record.categoriesCount) ? record.categoriesCount : 0,
    domainEmailReadiness: text(record.domainEmailReadiness, 40) === "ready" ? "ready" : "placeholder",
    faqCount: typeof record.faqCount === "number" && Number.isFinite(record.faqCount) ? record.faqCount : 0,
    pagesCount: typeof record.pagesCount === "number" && Number.isFinite(record.pagesCount) ? record.pagesCount : 0,
    productsCount:
      typeof record.productsCount === "number" && Number.isFinite(record.productsCount) ? record.productsCount : 0
  };
}

function parseRecord(row: unknown): TemplateRegistryRecord | null {
  if (!isRecord(row)) return null;

  const value = row as TemplateRegistryRow;
  const id = text(value.id, 120);
  const templateKey = text(value.template_key, 120);
  const name = text(value.name, 240);
  const slug = text(value.slug, 120);

  if (!id || !templateKey || !name || !slug) return null;

  return {
    badges: parseBadges(value.badges),
    category: text(value.category, 120) || null,
    createdAt: text(value.created_at, 80) || null,
    id,
    industry: text(value.industry, 120) || null,
    isOfficial: value.is_official === true,
    isRecommended: value.is_recommended === true,
    metadata: safeRecord(value.metadata),
    name,
    packageSummary: parsePackageSummary(value.package_summary),
    slug,
    status: parseStatus(value.status),
    templateKey,
    updatedAt: text(value.updated_at, 80) || null,
    version: text(value.version, 40) || "1",
    visibility: parseVisibility(value.visibility)
  };
}

function registrySelect() {
  return "id, template_key, name, slug, category, industry, status, visibility, version, badges, package_summary, metadata, is_official, is_recommended, created_at, updated_at";
}

async function requireSuperAdmin() {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can access the template registry.");
  }
}

function requireAdminClient() {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for the template registry.");
  }

  return admin;
}

async function seedMissingTemplates() {
  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("template_registry" as never)
    .select("template_key");

  if (error) {
    throw new Error(`Template registry could not be inspected: ${error.message}`);
  }

  const existingKeys = new Set(
    (Array.isArray(data) ? (data as unknown[]) : [])
      .map((row) => text(safeRecord(row).template_key, 120))
      .filter(Boolean)
  );
  const missing = seedTemplates.filter((template) => !existingKeys.has(template.template_key));

  if (!missing.length) return;

  const { error: insertError } = await admin.from("template_registry" as never).insert(missing as never);

  if (insertError) {
    throw new Error(`Template registry could not be seeded: ${insertError.message}`);
  }
}

export async function ensureTemplateRegistry() {
  await requireSuperAdmin();
  await seedMissingTemplates();
}

export async function listTemplates(): Promise<TemplateRegistryRecord[]> {
  await ensureTemplateRegistry();

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("template_registry" as never)
    .select(registrySelect())
    .order("name" as never, { ascending: true });

  if (error) {
    throw new Error(`Template registry could not be loaded: ${error.message}`);
  }

  return (Array.isArray(data) ? (data as unknown[]) : [])
    .map((row) => parseRecord(row))
    .filter((template): template is TemplateRegistryRecord => Boolean(template));
}

export async function getTemplateByKey(templateKey: string): Promise<TemplateRegistryRecord | null> {
  await ensureTemplateRegistry();

  const cleanedKey = text(templateKey, 120);

  if (!cleanedKey) return null;

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("template_registry" as never)
    .select(registrySelect())
    .eq("template_key" as never, cleanedKey as never)
    .maybeSingle();

  if (error) {
    throw new Error(`Template registry record could not be loaded: ${error.message}`);
  }

  return parseRecord(data);
}

export async function getTemplateBySlug(slug: string): Promise<TemplateRegistryRecord | null> {
  await ensureTemplateRegistry();

  const cleanedSlug = text(slug, 120);

  if (!cleanedSlug) return null;

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("template_registry" as never)
    .select(registrySelect())
    .eq("slug" as never, cleanedSlug as never)
    .maybeSingle();

  if (error) {
    throw new Error(`Template registry record could not be loaded: ${error.message}`);
  }

  return parseRecord(data);
}

export async function getTemplateRegistryStats(): Promise<TemplateRegistryStats> {
  const templates = await listTemplates();

  return {
    activeTemplates: templates.filter((template) => template.status === "active").length,
    archivedTemplates: templates.filter((template) => template.status === "archived").length,
    draftTemplates: templates.filter((template) => template.status === "draft").length,
    hiddenInternal: templates.filter((template) => template.visibility === "internal").length,
    officialTemplates: templates.filter((template) => template.isOfficial).length,
    ownerVisible: templates.filter(
      (template) => template.visibility === "owner" || template.visibility === "marketplace"
    ).length,
    resellerVisible: templates.filter((template) => template.visibility === "reseller").length,
    totalTemplates: templates.length
  };
}
