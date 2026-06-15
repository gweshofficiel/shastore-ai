import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";

export type PlatformPageStatus = "archived" | "draft" | "published";
export type PlatformPageReadinessStatus = "needs_attention" | "placeholder" | "ready";
export type PlatformPageSeoStatus = "missing" | "placeholder" | "ready";

export type PlatformPageRegistryRecord = {
  createdAt: string | null;
  id: string;
  isSystem: boolean;
  languageStatus: Record<string, string>;
  pageType: string;
  readinessStatus: PlatformPageReadinessStatus;
  routePath: string;
  seoStatus: PlatformPageSeoStatus;
  slug: string;
  sortOrder: number;
  status: PlatformPageStatus;
  title: string;
  updatedAt: string | null;
};

type PlatformPageRow = {
  created_at?: string | null;
  id?: string | null;
  is_system?: boolean | null;
  language_status?: unknown;
  page_type?: string | null;
  readiness_status?: string | null;
  route_path?: string | null;
  seo_status?: string | null;
  slug?: string | null;
  sort_order?: number | null;
  status?: string | null;
  title?: string | null;
  updated_at?: string | null;
};

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;

const systemPlatformPages = [
  {
    language_status: { Arabic: "placeholder", English: "ready", French: "placeholder" },
    page_type: "homepage",
    readiness_status: "ready",
    route_path: "/",
    seo_status: "placeholder",
    slug: "homepage",
    sort_order: 10,
    status: "published",
    title: "Homepage"
  },
  {
    language_status: { Arabic: "placeholder", English: "ready", French: "placeholder" },
    page_type: "pricing",
    readiness_status: "ready",
    route_path: "/pricing",
    seo_status: "placeholder",
    slug: "pricing",
    sort_order: 20,
    status: "published",
    title: "Pricing Page"
  },
  {
    language_status: { Arabic: "placeholder", English: "placeholder", French: "placeholder" },
    page_type: "features",
    readiness_status: "placeholder",
    route_path: "/features",
    seo_status: "placeholder",
    slug: "features",
    sort_order: 30,
    status: "draft",
    title: "Features Page"
  },
  {
    language_status: { Arabic: "placeholder", English: "placeholder", French: "placeholder" },
    page_type: "about",
    readiness_status: "placeholder",
    route_path: "/about",
    seo_status: "placeholder",
    slug: "about",
    sort_order: 40,
    status: "draft",
    title: "About Us"
  },
  {
    language_status: { Arabic: "placeholder", English: "placeholder", French: "placeholder" },
    page_type: "contact",
    readiness_status: "placeholder",
    route_path: "/contact",
    seo_status: "placeholder",
    slug: "contact",
    sort_order: 50,
    status: "draft",
    title: "Contact Us"
  },
  {
    language_status: { Arabic: "placeholder", English: "placeholder", French: "placeholder" },
    page_type: "blog",
    readiness_status: "placeholder",
    route_path: "/blog",
    seo_status: "placeholder",
    slug: "blog",
    sort_order: 60,
    status: "draft",
    title: "Blog"
  },
  {
    language_status: { Arabic: "placeholder", English: "placeholder", French: "placeholder" },
    page_type: "affiliates",
    readiness_status: "placeholder",
    route_path: "/affiliates",
    seo_status: "placeholder",
    slug: "affiliates",
    sort_order: 70,
    status: "draft",
    title: "Affiliates Page"
  },
  {
    language_status: { Arabic: "placeholder", English: "ready", French: "placeholder" },
    page_type: "reseller",
    readiness_status: "ready",
    route_path: "/reseller",
    seo_status: "placeholder",
    slug: "reseller",
    sort_order: 80,
    status: "published",
    title: "Reseller Program Page"
  },
  {
    language_status: { Arabic: "placeholder", English: "placeholder", French: "placeholder" },
    page_type: "careers",
    readiness_status: "placeholder",
    route_path: "/careers",
    seo_status: "placeholder",
    slug: "careers",
    sort_order: 90,
    status: "draft",
    title: "Careers Page"
  },
  {
    language_status: { Arabic: "placeholder", English: "placeholder", French: "placeholder" },
    page_type: "legal",
    readiness_status: "needs_attention",
    route_path: "/legal",
    seo_status: "missing",
    slug: "legal",
    sort_order: 100,
    status: "draft",
    title: "Legal Pages"
  }
] satisfies Array<{
  language_status: Record<string, string>;
  page_type: string;
  readiness_status: PlatformPageReadinessStatus;
  route_path: string;
  seo_status: PlatformPageSeoStatus;
  slug: string;
  sort_order: number;
  status: PlatformPageStatus;
  title: string;
}>;

function text(value: unknown, maxLength = 240) {
  return typeof value === "string" && value.trim()
    ? value.trim().replace(/\s+/g, " ").slice(0, maxLength)
    : "";
}

function languageStatus(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([language, status]) => [text(language, 40), text(status, 40)])
      .filter(([language, status]) => language && status)
  );
}

function parsePlatformPage(row: unknown): PlatformPageRegistryRecord | null {
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    return null;
  }

  const value = row as PlatformPageRow;
  const id = text(value.id, 120);
  const slug = text(value.slug, 120);
  const title = text(value.title, 180);
  const routePath = text(value.route_path, 200);
  const status = text(value.status, 40) as PlatformPageStatus;
  const readinessStatus = text(value.readiness_status, 40) as PlatformPageReadinessStatus;
  const seoStatus = text(value.seo_status, 40) as PlatformPageSeoStatus;

  if (!id || !slug || !title || !routePath || !status || !readinessStatus || !seoStatus) {
    return null;
  }

  return {
    createdAt: text(value.created_at, 80) || null,
    id,
    isSystem: value.is_system !== false,
    languageStatus: languageStatus(value.language_status),
    pageType: text(value.page_type, 120) || "platform_page",
    readinessStatus,
    routePath,
    seoStatus,
    slug,
    sortOrder: typeof value.sort_order === "number" ? value.sort_order : 0,
    status,
    title,
    updatedAt: text(value.updated_at, 80) || null
  };
}

async function requireSuperAdmin() {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can access platform website page registry.");
  }
}

function requireAdminClient() {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for platform website page registry.");
  }

  return admin;
}

async function readRegistryRows(admin: AdminClient) {
  const { data, error } = await admin
    .from("platform_pages" as never)
    .select("*")
    .order("sort_order", { ascending: true })
    .order("route_path", { ascending: true });

  if (error) {
    throw new Error(`Platform pages registry could not be loaded: ${error.message}`);
  }

  return (data ?? [])
    .map(parsePlatformPage)
    .filter((page): page is PlatformPageRegistryRecord => Boolean(page));
}

export async function ensurePlatformPagesRegistry() {
  await requireSuperAdmin();
  const admin = requireAdminClient();

  const { error } = await admin
    .from("platform_pages" as never)
    .upsert(
      systemPlatformPages.map((page) => ({
        ...page,
        is_system: true
      })) as never,
      { ignoreDuplicates: true, onConflict: "slug" }
    );

  if (error) {
    throw new Error(`Platform pages registry seed failed: ${error.message}`);
  }

  return readRegistryRows(admin);
}

export async function listPlatformPages() {
  await requireSuperAdmin();
  const admin = requireAdminClient();
  const pages = await readRegistryRows(admin);

  if (pages.length >= systemPlatformPages.length) {
    return pages;
  }

  return ensurePlatformPagesRegistry();
}

export async function getPlatformPageBySlug(slug: string) {
  await requireSuperAdmin();
  const admin = requireAdminClient();
  const cleanedSlug = text(slug, 120);

  if (!cleanedSlug) {
    return null;
  }

  const { data, error } = await admin
    .from("platform_pages" as never)
    .select("*")
    .eq("slug" as never, cleanedSlug as never)
    .maybeSingle();

  if (error) {
    throw new Error(`Platform page registry lookup failed: ${error.message}`);
  }

  return parsePlatformPage(data);
}
