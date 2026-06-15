import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";

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

function slug(value: unknown) {
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
  const postSlug = slug(value.slug);

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
  const postSlug = slug(input.slug) || slug(title);

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
  const cleanedSlug = slug(postSlug);

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

export async function archivePlatformBlogPost(postId: string) {
  await requireSuperAdmin();
  const cleanedPostId = text(postId, 120);

  if (!cleanedPostId) {
    throw new Error("Platform blog post id is required.");
  }

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("platform_blog_posts" as never)
    .update({ status: "archived" } as never)
    .eq("id" as never, cleanedPostId as never)
    .select(postSelect())
    .single();

  if (error) {
    throw new Error(`Platform blog post could not be archived: ${error.message}`);
  }

  return parsePost(data);
}
