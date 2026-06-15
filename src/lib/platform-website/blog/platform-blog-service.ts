import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { getAppBaseUrl } from "@/lib/deployment/config";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getPlatformPageFallbackLocale,
  isPlatformLocale,
  type PlatformLocale
} from "@/src/lib/platform-website/platform-translations-runtime";

export type PlatformBlogPostStatus = "archived" | "draft" | "published";

export type PlatformBlogPostRecord = {
  authorName: string;
  content: Record<string, unknown>;
  coverImageUrl: string | null;
  createdAt: string | null;
  excerpt: string;
  id: string;
  publishedAt: string | null;
  seoDescription: string | null;
  seoTitle: string | null;
  slug: string;
  status: PlatformBlogPostStatus;
  title: string;
  translations: Record<string, unknown>;
  updatedAt: string | null;
};

export type PlatformBlogDraftInput = {
  authorName?: string | null;
  content?: unknown;
  coverImageUrl?: string | null;
  excerpt?: string | null;
  seoDescription?: string | null;
  seoTitle?: string | null;
  slug?: string | null;
  title?: string | null;
  translations?: unknown;
};

export type PlatformTranslatedBlogPost = PlatformBlogPostRecord & {
  direction: "ltr" | "rtl";
  fallbackLocale: PlatformLocale | "base";
  locale: PlatformLocale;
  requestedLocale: PlatformLocale;
};

type PlatformBlogPostRow = {
  author_name?: string | null;
  content?: unknown;
  cover_image_url?: string | null;
  created_at?: string | null;
  excerpt?: string | null;
  id?: string | null;
  published_at?: string | null;
  seo_description?: string | null;
  seo_title?: string | null;
  slug?: string | null;
  status?: string | null;
  title?: string | null;
  translations?: unknown;
  updated_at?: string | null;
};

const statuses: PlatformBlogPostStatus[] = ["draft", "published", "archived"];

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

export function normalizePlatformBlogSlug(value: unknown) {
  return text(value, 120)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function safeJson(value: unknown, depth = 0): unknown {
  if (depth > 8) {
    return null;
  }

  if (typeof value === "string") {
    return text(value, 5000);
  }

  if (typeof value === "number" || typeof value === "boolean" || value === null) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 100).map((item) => safeJson(item, depth + 1));
  }

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

function translationRecord(post: Pick<PlatformBlogPostRecord, "translations">, locale: PlatformLocale) {
  return isRecord(post.translations[locale]) ? post.translations[locale] as Record<string, unknown> : {};
}

function translationText(record: Record<string, unknown>, camelKey: string, snakeKey: string, maxLength = 2000) {
  return text(record[camelKey] ?? record[snakeKey], maxLength);
}

function hasReadyTranslation(record: Record<string, unknown>) {
  return text(record.status, 40) === "ready";
}

function parseStatus(value: unknown): PlatformBlogPostStatus {
  return statuses.includes(value as PlatformBlogPostStatus) ? value as PlatformBlogPostStatus : "draft";
}

function parsePost(row: unknown): PlatformBlogPostRecord | null {
  if (!isRecord(row)) {
    return null;
  }

  const value = row as PlatformBlogPostRow;
  const id = text(value.id, 120);
  const title = text(value.title, 180);
  const postSlug = normalizePlatformBlogSlug(value.slug);

  if (!id || !title || !postSlug) {
    return null;
  }

  return {
    authorName: text(value.author_name, 120) || "SHASTORE AI",
    content: safeJsonRecord(value.content),
    coverImageUrl: nullableText(value.cover_image_url, 1000),
    createdAt: text(value.created_at, 80) || null,
    excerpt: text(value.excerpt, 500),
    id,
    publishedAt: text(value.published_at, 80) || null,
    seoDescription: nullableText(value.seo_description, 160),
    seoTitle: nullableText(value.seo_title, 70),
    slug: postSlug,
    status: parseStatus(value.status),
    title,
    translations: safeJsonRecord(value.translations),
    updatedAt: text(value.updated_at, 80) || null
  };
}

async function requireSuperAdmin() {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can manage platform blog posts.");
  }
}

function requireAdminClient() {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for platform blog posts.");
  }

  return admin;
}

function postSelect() {
  return "id, slug, title, excerpt, content, status, author_name, cover_image_url, seo_title, seo_description, translations, published_at, created_at, updated_at";
}

function normalizeDraftInput(input: PlatformBlogDraftInput, options: { requireTitle?: boolean }) {
  const title = nullableText(input.title, 180);
  const rawSlug = text(input.slug, 120);
  const postSlug = normalizePlatformBlogSlug(input.slug) || normalizePlatformBlogSlug(title);

  if (options.requireTitle && !title) {
    throw new Error("Platform blog draft title is required.");
  }

  if (input.title !== undefined && !title) {
    throw new Error("Platform blog draft title cannot be empty.");
  }

  if (options.requireTitle && !postSlug) {
    throw new Error("Platform blog draft slug is required.");
  }

  if (input.slug !== undefined && !postSlug) {
    throw new Error("Platform blog draft slug cannot be empty.");
  }

  if (rawSlug && rawSlug !== postSlug) {
    throw new Error("Platform blog slug must be URL-safe lowercase text with hyphens.");
  }

  const update: Record<string, unknown> = {};

  if (input.title !== undefined) update.title = title;
  if (input.slug !== undefined || options.requireTitle) update.slug = postSlug;
  if (input.excerpt !== undefined) update.excerpt = text(input.excerpt, 500);
  if (input.content !== undefined) update.content = safeJsonRecord(input.content);
  if (input.authorName !== undefined) update.author_name = text(input.authorName, 120) || "SHASTORE AI";
  if (input.coverImageUrl !== undefined) update.cover_image_url = nullableText(input.coverImageUrl, 1000);
  if (input.seoTitle !== undefined) update.seo_title = nullableText(input.seoTitle, 70);
  if (input.seoDescription !== undefined) update.seo_description = nullableText(input.seoDescription, 160);
  if (input.translations !== undefined) update.translations = safeJsonRecord(input.translations);

  return update;
}

async function ensureUniqueSlug(postSlug: string, currentPostId?: string) {
  const admin = requireAdminClient();
  const query = admin
    .from("platform_blog_posts" as never)
    .select("id")
    .eq("slug" as never, postSlug as never);
  const { data, error } = currentPostId
    ? await query.neq("id" as never, currentPostId as never).maybeSingle()
    : await query.maybeSingle();

  if (error) {
    throw new Error(`Platform blog slug could not be validated: ${error.message}`);
  }

  if (data) {
    throw new Error("Platform blog slug must be unique.");
  }
}

async function readPostById(postId: string) {
  const cleanedPostId = text(postId, 120);

  if (!cleanedPostId) {
    throw new Error("Platform blog post id is required.");
  }

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("platform_blog_posts" as never)
    .select(postSelect())
    .eq("id" as never, cleanedPostId as never)
    .maybeSingle();

  if (error) {
    throw new Error(`Platform blog post could not be loaded: ${error.message}`);
  }

  return parsePost(data);
}

export async function listPlatformBlogPosts() {
  await requireSuperAdmin();
  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("platform_blog_posts" as never)
    .select(postSelect())
    .order("created_at" as never, { ascending: false })
    .limit(50);

  if (error) {
    throw new Error(`Platform blog posts could not be loaded: ${error.message}`);
  }

  return (Array.isArray(data) ? data : [])
    .map((row) => parsePost(row))
    .filter((post): post is PlatformBlogPostRecord => Boolean(post));
}

export async function getPlatformBlogPostBySlug(postSlug: string) {
  await requireSuperAdmin();
  const cleanedSlug = normalizePlatformBlogSlug(postSlug);

  if (!cleanedSlug) {
    return null;
  }

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("platform_blog_posts" as never)
    .select(postSelect())
    .eq("slug" as never, cleanedSlug as never)
    .maybeSingle();

  if (error) {
    throw new Error(`Platform blog post could not be loaded: ${error.message}`);
  }

  return parsePost(data);
}

export async function createPlatformBlogDraft(input: PlatformBlogDraftInput) {
  await requireSuperAdmin();
  const update = normalizeDraftInput(input, { requireTitle: true });
  await ensureUniqueSlug(String(update.slug ?? ""));
  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("platform_blog_posts" as never)
    .insert({
      ...update,
      content: update.content ?? {},
      status: "draft",
      translations: update.translations ?? {}
    } as never)
    .select(postSelect())
    .single();

  if (error) {
    throw new Error(`Platform blog draft could not be created: ${error.message}`);
  }

  return parsePost(data);
}

export async function updatePlatformBlogDraft(postId: string, input: PlatformBlogDraftInput) {
  await requireSuperAdmin();
  const cleanedPostId = text(postId, 120);

  if (!cleanedPostId) {
    throw new Error("Platform blog post id is required.");
  }

  const update = normalizeDraftInput(input, {});

  if (!Object.keys(update).length) {
    throw new Error("No platform blog draft fields were provided.");
  }

  if (typeof update.slug === "string") {
    await ensureUniqueSlug(update.slug, cleanedPostId);
  }

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("platform_blog_posts" as never)
    .update(update as never)
    .eq("id" as never, cleanedPostId as never)
    .neq("status" as never, "archived" as never)
    .select(postSelect())
    .single();

  if (error) {
    throw new Error(`Platform blog draft could not be updated: ${error.message}`);
  }

  return parsePost(data);
}

export async function getPlatformBlogPostForAdmin(postId: string) {
  await requireSuperAdmin();

  return readPostById(postId);
}

export async function publishPlatformBlogPost(postId: string) {
  await requireSuperAdmin();
  const current = await readPostById(postId);

  if (!current) {
    throw new Error("Platform blog post was not found.");
  }

  if (current.status !== "draft") {
    throw new Error("Only draft platform blog posts can be published.");
  }

  if (!current.title || !current.slug) {
    throw new Error("Title and slug are required before publishing.");
  }

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("platform_blog_posts" as never)
    .update({
      published_at: current.publishedAt ?? new Date().toISOString(),
      status: "published"
    } as never)
    .eq("id" as never, current.id as never)
    .select(postSelect())
    .single();

  if (error) {
    throw new Error(`Platform blog post could not be published: ${error.message}`);
  }

  return parsePost(data);
}

export async function archivePlatformBlogPost(postId: string) {
  await requireSuperAdmin();
  const current = await readPostById(postId);

  if (!current) {
    throw new Error("Platform blog post was not found.");
  }

  if (current.status !== "published") {
    throw new Error("Only published platform blog posts can be archived.");
  }

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("platform_blog_posts" as never)
    .update({ status: "archived" } as never)
    .eq("id" as never, current.id as never)
    .select(postSelect())
    .single();

  if (error) {
    throw new Error(`Platform blog post could not be archived: ${error.message}`);
  }

  return parsePost(data);
}

export async function revertPlatformBlogPostToDraft(postId: string) {
  await requireSuperAdmin();
  const current = await readPostById(postId);

  if (!current) {
    throw new Error("Platform blog post was not found.");
  }

  if (current.status !== "archived") {
    throw new Error("Only archived platform blog posts can be reverted to draft.");
  }

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("platform_blog_posts" as never)
    .update({ status: "draft" } as never)
    .eq("id" as never, current.id as never)
    .select(postSelect())
    .single();

  if (error) {
    throw new Error(`Platform blog post could not be reverted to draft: ${error.message}`);
  }

  return parsePost(data);
}

export async function listPublishedPlatformBlogPosts() {
  const admin = createAdminClient();

  if (!admin) {
    return [];
  }

  const { data, error } = await admin
    .from("platform_blog_posts" as never)
    .select(postSelect())
    .eq("status" as never, "published" as never)
    .order("published_at" as never, { ascending: false, nullsFirst: false } as never)
    .order("created_at" as never, { ascending: false })
    .limit(100);

  if (error) {
    throw new Error(`Published platform blog posts could not be loaded: ${error.message}`);
  }

  return (Array.isArray(data) ? data : [])
    .map((row) => parsePost(row))
    .filter((post): post is PlatformBlogPostRecord => Boolean(post));
}

export async function getPublishedPlatformBlogPostBySlug(postSlug: string) {
  const cleanedSlug = normalizePlatformBlogSlug(postSlug);

  if (!cleanedSlug) {
    return null;
  }

  const admin = createAdminClient();

  if (!admin) {
    return null;
  }

  const { data, error } = await admin
    .from("platform_blog_posts" as never)
    .select(postSelect())
    .eq("slug" as never, cleanedSlug as never)
    .eq("status" as never, "published" as never)
    .maybeSingle();

  if (error) {
    throw new Error(`Published platform blog post could not be loaded: ${error.message}`);
  }

  return parsePost(data);
}

export function translatePlatformBlogPost(
  post: PlatformBlogPostRecord,
  locale: string | null | undefined
): PlatformTranslatedBlogPost {
  const requestedLocale = getPlatformPageFallbackLocale(locale);
  const requestedRecord = translationRecord(post, requestedLocale);
  const englishRecord = translationRecord(post, "en");
  const fallbackLocale: PlatformLocale | "base" = hasReadyTranslation(requestedRecord)
    ? requestedLocale
    : hasReadyTranslation(englishRecord)
      ? "en"
      : "base";
  const record = fallbackLocale === "base"
    ? {}
    : fallbackLocale === requestedLocale
      ? requestedRecord
      : englishRecord;
  const title = translationText(record, "title", "title", 180) || post.title;
  const excerpt = translationText(record, "excerpt", "excerpt", 500) || post.excerpt;
  const seoTitle = translationText(record, "seoTitle", "seo_title", 70) || post.seoTitle;
  const seoDescription = translationText(record, "seoDescription", "seo_description", 160) || post.seoDescription;
  const translatedContent = isRecord(record.content) || isRecord(record.body)
    ? safeJsonRecord(record.content ?? record.body)
    : post.content;

  return {
    ...post,
    content: translatedContent,
    direction: requestedLocale === "ar" ? "rtl" : "ltr",
    excerpt,
    fallbackLocale,
    locale: requestedLocale,
    requestedLocale,
    seoDescription,
    seoTitle,
    title
  };
}

export function platformBlogCanonicalPath(postOrPath: PlatformBlogPostRecord | string, locale?: string | null) {
  const prefix = locale && isPlatformLocale(locale) ? `/${locale}` : "";

  if (typeof postOrPath === "string") {
    return `${prefix}${postOrPath.startsWith("/") ? postOrPath : `/${postOrPath}`}`;
  }

  return `${prefix}/blog/${postOrPath.slug}`;
}

export function platformBlogCanonicalUrl(postOrPath: PlatformBlogPostRecord | string, locale?: string | null) {
  const baseUrl = getAppBaseUrl().replace(/\/+$/, "");

  return `${baseUrl}${platformBlogCanonicalPath(postOrPath, locale)}`;
}
