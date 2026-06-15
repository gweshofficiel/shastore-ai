import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlatformPageFallbackLocale } from "@/src/lib/platform-website/platform-translations-runtime";
import { normalizePlatformBlogSlug } from "@/src/lib/platform-website/blog/platform-blog-service";

export type PlatformBlogTagStatus = "active" | "archived";

export type PlatformBlogTagRecord = {
  createdAt: string | null;
  id: string;
  name: string;
  postCount: number;
  slug: string;
  status: PlatformBlogTagStatus;
  translations: Record<string, unknown>;
  updatedAt: string | null;
};

export type PlatformBlogTagInput = {
  name?: string | null;
  slug?: string | null;
  translations?: unknown;
};

type TagRow = {
  created_at?: string | null;
  id?: string | null;
  name?: string | null;
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

function parseStatus(value: unknown): PlatformBlogTagStatus {
  return value === "archived" ? "archived" : "active";
}

function parseTag(row: unknown, postCount = 0): PlatformBlogTagRecord | null {
  if (!isRecord(row)) return null;

  const value = row as TagRow;
  const id = text(value.id, 120);
  const name = text(value.name, 120);
  const slug = normalizePlatformBlogSlug(value.slug);

  if (!id || !name || !slug) return null;

  return {
    createdAt: text(value.created_at, 80) || null,
    id,
    name,
    postCount,
    slug,
    status: parseStatus(value.status),
    translations: safeJsonRecord(value.translations),
    updatedAt: text(value.updated_at, 80) || null
  };
}

async function requireSuperAdmin() {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can manage platform blog tags.");
  }
}

function requireAdminClient() {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for platform blog tags.");
  }

  return admin;
}

function tagSelect() {
  return "id, slug, name, translations, status, created_at, updated_at";
}

async function tagPostCounts() {
  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("platform_blog_post_tags" as never)
    .select("tag_id");

  if (error) {
    throw new Error(`Platform blog tag counts could not be loaded: ${error.message}`);
  }

  return (Array.isArray(data) ? data : []).reduce<Record<string, number>>((counts, row) => {
    const value: Record<string, unknown> = isRecord(row) ? row : {};
    const tagId = text(value.tag_id, 120);

    if (tagId) counts[tagId] = (counts[tagId] ?? 0) + 1;

    return counts;
  }, {});
}

function normalizeInput(input: PlatformBlogTagInput, requireName: boolean) {
  const name = text(input.name, 120) || null;
  const rawSlug = text(input.slug, 120);
  const slug = normalizePlatformBlogSlug(input.slug) || normalizePlatformBlogSlug(name);

  if (requireName && !name) throw new Error("Tag name is required.");
  if (input.name !== undefined && !name) throw new Error("Tag name cannot be empty.");
  if (requireName && !slug) throw new Error("Tag slug is required.");
  if (input.slug !== undefined && !slug) throw new Error("Tag slug cannot be empty.");
  if (rawSlug && rawSlug !== slug) throw new Error("Tag slug must be URL-safe lowercase text with hyphens.");

  const update: Record<string, unknown> = {};

  if (input.name !== undefined) update.name = name;
  if (input.slug !== undefined || requireName) update.slug = slug;
  if (input.translations !== undefined) update.translations = safeJsonRecord(input.translations);

  return update;
}

async function ensureUniqueSlug(slug: string, currentId?: string) {
  const admin = requireAdminClient();
  const query = admin
    .from("platform_blog_tags" as never)
    .select("id")
    .eq("slug" as never, slug as never);
  const { data, error } = currentId
    ? await query.neq("id" as never, currentId as never).maybeSingle()
    : await query.maybeSingle();

  if (error) throw new Error(`Tag slug could not be validated: ${error.message}`);
  if (data) throw new Error("Tag slug must be unique.");
}

export async function listTags() {
  await requireSuperAdmin();
  const admin = requireAdminClient();
  const [counts, result] = await Promise.all([
    tagPostCounts(),
    admin.from("platform_blog_tags" as never).select(tagSelect()).order("created_at" as never, { ascending: false })
  ]);

  if (result.error) throw new Error(`Platform blog tags could not be loaded: ${result.error.message}`);

  return (Array.isArray(result.data) ? result.data : [])
    .map((row) => {
      const value: Record<string, unknown> = isRecord(row) ? row : {};
      const id = text(value.id, 120);
      return parseTag(row, counts[id] ?? 0);
    })
    .filter((tag): tag is PlatformBlogTagRecord => Boolean(tag));
}

export async function listActiveTags() {
  const admin = createAdminClient();

  if (!admin) return [];

  const { data, error } = await admin
    .from("platform_blog_tags" as never)
    .select(tagSelect())
    .eq("status" as never, "active" as never)
    .order("name" as never, { ascending: true });

  if (error) throw new Error(`Active platform blog tags could not be loaded: ${error.message}`);

  return (Array.isArray(data) ? data : [])
    .map((row) => parseTag(row))
    .filter((tag): tag is PlatformBlogTagRecord => Boolean(tag));
}

export async function getActiveTagBySlug(tagSlug: string) {
  const slug = normalizePlatformBlogSlug(tagSlug);

  if (!slug) return null;

  const admin = createAdminClient();

  if (!admin) return null;

  const { data, error } = await admin
    .from("platform_blog_tags" as never)
    .select(tagSelect())
    .eq("slug" as never, slug as never)
    .eq("status" as never, "active" as never)
    .maybeSingle();

  if (error) throw new Error(`Active platform blog tag could not be loaded: ${error.message}`);

  return parseTag(data);
}

export async function createTag(input: PlatformBlogTagInput) {
  await requireSuperAdmin();
  const update = normalizeInput(input, true);
  await ensureUniqueSlug(String(update.slug ?? ""));
  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("platform_blog_tags" as never)
    .insert({
      ...update,
      status: "active",
      translations: update.translations ?? {}
    } as never)
    .select(tagSelect())
    .single();

  if (error) throw new Error(`Platform blog tag could not be created: ${error.message}`);

  return parseTag(data);
}

export async function updateTag(tagId: string, input: PlatformBlogTagInput) {
  await requireSuperAdmin();
  const id = text(tagId, 120);
  if (!id) throw new Error("Tag id is required.");
  const update = normalizeInput(input, false);
  if (!Object.keys(update).length) throw new Error("No tag fields were provided.");
  if (typeof update.slug === "string") await ensureUniqueSlug(update.slug, id);
  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("platform_blog_tags" as never)
    .update(update as never)
    .eq("id" as never, id as never)
    .select(tagSelect())
    .single();

  if (error) throw new Error(`Platform blog tag could not be updated: ${error.message}`);

  return parseTag(data);
}

export async function archiveTag(tagId: string) {
  await requireSuperAdmin();
  const id = text(tagId, 120);
  if (!id) throw new Error("Tag id is required.");
  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("platform_blog_tags" as never)
    .update({ status: "archived" } as never)
    .eq("id" as never, id as never)
    .select(tagSelect())
    .single();

  if (error) throw new Error(`Platform blog tag could not be archived: ${error.message}`);

  return parseTag(data);
}

export function translateTag(tag: PlatformBlogTagRecord, locale: string | null | undefined) {
  const requestedLocale = getPlatformPageFallbackLocale(locale);
  const record = isRecord(tag.translations[requestedLocale])
    ? tag.translations[requestedLocale] as Record<string, unknown>
    : {};

  return {
    ...tag,
    name: text(record.name, 120) || tag.name
  };
}
