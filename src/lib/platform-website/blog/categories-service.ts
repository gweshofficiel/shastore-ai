import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlatformPageFallbackLocale } from "@/src/lib/platform-website/platform-translations-runtime";
import { normalizePlatformBlogSlug } from "@/src/lib/platform-website/blog/platform-blog-service";

export type PlatformBlogCategoryStatus = "active" | "archived";

export type PlatformBlogCategoryRecord = {
  createdAt: string | null;
  description: string | null;
  id: string;
  name: string;
  postCount: number;
  seoDescription: string | null;
  seoTitle: string | null;
  slug: string;
  status: PlatformBlogCategoryStatus;
  translations: Record<string, unknown>;
  updatedAt: string | null;
};

export type PlatformBlogCategoryInput = {
  description?: string | null;
  name?: string | null;
  seoDescription?: string | null;
  seoTitle?: string | null;
  slug?: string | null;
  translations?: unknown;
};

type CategoryRow = {
  created_at?: string | null;
  description?: string | null;
  id?: string | null;
  name?: string | null;
  seo_description?: string | null;
  seo_title?: string | null;
  slug?: string | null;
  status?: string | null;
  translations?: unknown;
  updated_at?: string | null;
};

function text(value: unknown, maxLength = 2000) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/\bjavascript:/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function nullableText(value: unknown, maxLength = 2000) {
  const cleaned = text(value, maxLength);

  return cleaned || null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function safeJson(value: unknown, depth = 0): unknown {
  if (depth > 8) return null;
  if (typeof value === "string") return text(value, 5000);
  if (typeof value === "number" || typeof value === "boolean" || value === null) return value;
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => safeJson(item, depth + 1));
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 100)
        .map(([key, item]) => [text(key, 120), safeJson(item, depth + 1)])
        .filter(([key]) => Boolean(key))
    );
  }

  return null;
}

function safeJsonRecord(value: unknown) {
  const sanitized = safeJson(value);

  return isRecord(sanitized) ? sanitized : {};
}

function parseStatus(value: unknown): PlatformBlogCategoryStatus {
  return value === "archived" ? "archived" : "active";
}

function parseCategory(row: unknown, postCount = 0): PlatformBlogCategoryRecord | null {
  if (!isRecord(row)) return null;

  const value = row as CategoryRow;
  const id = text(value.id, 120);
  const name = text(value.name, 120);
  const slug = normalizePlatformBlogSlug(value.slug);

  if (!id || !name || !slug) return null;

  return {
    createdAt: text(value.created_at, 80) || null,
    description: nullableText(value.description, 500),
    id,
    name,
    postCount,
    seoDescription: nullableText(value.seo_description, 160),
    seoTitle: nullableText(value.seo_title, 70),
    slug,
    status: parseStatus(value.status),
    translations: safeJsonRecord(value.translations),
    updatedAt: text(value.updated_at, 80) || null
  };
}

async function requireSuperAdmin() {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can manage platform blog categories.");
  }
}

function requireAdminClient() {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for platform blog categories.");
  }

  return admin;
}

function categorySelect() {
  return "id, slug, name, description, seo_title, seo_description, translations, status, created_at, updated_at";
}

async function categoryPostCounts() {
  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("platform_blog_post_categories" as never)
    .select("category_id");

  if (error) {
    throw new Error(`Platform blog category counts could not be loaded: ${error.message}`);
  }

  return (Array.isArray(data) ? data : []).reduce<Record<string, number>>((counts, row) => {
    const value: Record<string, unknown> = isRecord(row) ? row : {};
    const categoryId = text(value.category_id, 120);

    if (categoryId) counts[categoryId] = (counts[categoryId] ?? 0) + 1;

    return counts;
  }, {});
}

function normalizeInput(input: PlatformBlogCategoryInput, requireName: boolean) {
  const name = nullableText(input.name, 120);
  const rawSlug = text(input.slug, 120);
  const slug = normalizePlatformBlogSlug(input.slug) || normalizePlatformBlogSlug(name);

  if (requireName && !name) throw new Error("Category name is required.");
  if (input.name !== undefined && !name) throw new Error("Category name cannot be empty.");
  if (requireName && !slug) throw new Error("Category slug is required.");
  if (input.slug !== undefined && !slug) throw new Error("Category slug cannot be empty.");
  if (rawSlug && rawSlug !== slug) throw new Error("Category slug must be URL-safe lowercase text with hyphens.");

  const update: Record<string, unknown> = {};

  if (input.name !== undefined) update.name = name;
  if (input.slug !== undefined || requireName) update.slug = slug;
  if (input.description !== undefined) update.description = nullableText(input.description, 500);
  if (input.seoTitle !== undefined) update.seo_title = nullableText(input.seoTitle, 70);
  if (input.seoDescription !== undefined) update.seo_description = nullableText(input.seoDescription, 160);
  if (input.translations !== undefined) update.translations = safeJsonRecord(input.translations);

  return update;
}

async function ensureUniqueSlug(slug: string, currentId?: string) {
  const admin = requireAdminClient();
  const query = admin
    .from("platform_blog_categories" as never)
    .select("id")
    .eq("slug" as never, slug as never);
  const { data, error } = currentId
    ? await query.neq("id" as never, currentId as never).maybeSingle()
    : await query.maybeSingle();

  if (error) throw new Error(`Category slug could not be validated: ${error.message}`);
  if (data) throw new Error("Category slug must be unique.");
}

export async function listCategories() {
  await requireSuperAdmin();
  const admin = requireAdminClient();
  const [counts, result] = await Promise.all([
    categoryPostCounts(),
    admin.from("platform_blog_categories" as never).select(categorySelect()).order("created_at" as never, { ascending: false })
  ]);

  if (result.error) throw new Error(`Platform blog categories could not be loaded: ${result.error.message}`);

  return (Array.isArray(result.data) ? result.data : [])
    .map((row) => {
      const value: Record<string, unknown> = isRecord(row) ? row : {};
      const id = text(value.id, 120);
      return parseCategory(row, counts[id] ?? 0);
    })
    .filter((category): category is PlatformBlogCategoryRecord => Boolean(category));
}

export async function listActiveCategories() {
  const admin = createAdminClient();

  if (!admin) return [];

  const { data, error } = await admin
    .from("platform_blog_categories" as never)
    .select(categorySelect())
    .eq("status" as never, "active" as never)
    .order("name" as never, { ascending: true });

  if (error) throw new Error(`Active platform blog categories could not be loaded: ${error.message}`);

  return (Array.isArray(data) ? data : [])
    .map((row) => parseCategory(row))
    .filter((category): category is PlatformBlogCategoryRecord => Boolean(category));
}

export async function getActiveCategoryBySlug(categorySlug: string) {
  const slug = normalizePlatformBlogSlug(categorySlug);

  if (!slug) return null;

  const admin = createAdminClient();

  if (!admin) return null;

  const { data, error } = await admin
    .from("platform_blog_categories" as never)
    .select(categorySelect())
    .eq("slug" as never, slug as never)
    .eq("status" as never, "active" as never)
    .maybeSingle();

  if (error) throw new Error(`Active platform blog category could not be loaded: ${error.message}`);

  return parseCategory(data);
}

export async function createCategory(input: PlatformBlogCategoryInput) {
  await requireSuperAdmin();
  const update = normalizeInput(input, true);
  await ensureUniqueSlug(String(update.slug ?? ""));
  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("platform_blog_categories" as never)
    .insert({
      ...update,
      status: "active",
      translations: update.translations ?? {}
    } as never)
    .select(categorySelect())
    .single();

  if (error) throw new Error(`Platform blog category could not be created: ${error.message}`);

  return parseCategory(data);
}

export async function updateCategory(categoryId: string, input: PlatformBlogCategoryInput) {
  await requireSuperAdmin();
  const id = text(categoryId, 120);
  if (!id) throw new Error("Category id is required.");
  const update = normalizeInput(input, false);
  if (!Object.keys(update).length) throw new Error("No category fields were provided.");
  if (typeof update.slug === "string") await ensureUniqueSlug(update.slug, id);
  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("platform_blog_categories" as never)
    .update(update as never)
    .eq("id" as never, id as never)
    .select(categorySelect())
    .single();

  if (error) throw new Error(`Platform blog category could not be updated: ${error.message}`);

  return parseCategory(data);
}

export async function archiveCategory(categoryId: string) {
  await requireSuperAdmin();
  const id = text(categoryId, 120);
  if (!id) throw new Error("Category id is required.");
  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("platform_blog_categories" as never)
    .update({ status: "archived" } as never)
    .eq("id" as never, id as never)
    .select(categorySelect())
    .single();

  if (error) throw new Error(`Platform blog category could not be archived: ${error.message}`);

  return parseCategory(data);
}

export function translateCategory(category: PlatformBlogCategoryRecord, locale: string | null | undefined) {
  const requestedLocale = getPlatformPageFallbackLocale(locale);
  const record = isRecord(category.translations[requestedLocale])
    ? category.translations[requestedLocale] as Record<string, unknown>
    : {};

  return {
    ...category,
    description: text(record.description, 500) || category.description,
    name: text(record.name, 120) || category.name,
    seoDescription: text(record.seoDescription ?? record.seo_description, 160) || category.seoDescription,
    seoTitle: text(record.seoTitle ?? record.seo_title, 70) || category.seoTitle
  };
}
