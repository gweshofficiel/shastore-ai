import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";

export type PlatformContentStatus = "draft_ready" | "needs_attention" | "placeholder" | "ready";

export type PlatformPageContentInput = {
  body?: unknown;
  canonicalPath?: string | null;
  contentStatus?: PlatformContentStatus;
  headline?: string | null;
  openGraph?: unknown;
  seoDescription?: string | null;
  seoTitle?: string | null;
  subtitle?: string | null;
  title?: string;
  translations?: unknown;
};

export type PlatformPageContentRecord = {
  body: Record<string, unknown>;
  canonicalPath: string | null;
  contentStatus: PlatformContentStatus;
  headline: string | null;
  id: string;
  openGraph: Record<string, unknown>;
  seoDescription: string | null;
  seoTitle: string | null;
  slug: string;
  subtitle: string | null;
  translations: Record<"ar" | "en" | "fr", Record<string, unknown>>;
};

export type PlatformPageEditorRecord = PlatformPageContentRecord & {
  pageType: string;
  routePath: string;
  status: "archived" | "draft" | "published";
  title: string;
  updatedAt: string | null;
};

type PlatformContentRow = {
  body?: unknown;
  canonical_path?: string | null;
  content_status?: string | null;
  headline?: string | null;
  id?: string | null;
  open_graph?: unknown;
  seo_description?: string | null;
  seo_title?: string | null;
  slug?: string | null;
  status?: string | null;
  subtitle?: string | null;
  page_type?: string | null;
  route_path?: string | null;
  translations?: unknown;
  title?: string | null;
  updated_at?: string | null;
};

const contentStatuses: PlatformContentStatus[] = ["placeholder", "draft_ready", "ready", "needs_attention"];
const translationLanguages = ["ar", "en", "fr"] as const;

function text(value: unknown, maxLength = 2000) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/\bjavascript:/gi, "")
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

function safeTranslations(value: unknown) {
  const source = isRecord(value) ? value : {};

  return Object.fromEntries(
    translationLanguages.map((language) => [
      language,
      safeJsonRecord(source[language])
    ])
  ) as Record<"ar" | "en" | "fr", Record<string, unknown>>;
}

function isContentStatus(value: unknown): value is PlatformContentStatus {
  return contentStatuses.includes(value as PlatformContentStatus);
}

function parsePublishStatus(value: unknown): PlatformPageEditorRecord["status"] {
  return value === "archived" || value === "published" ? value : "draft";
}

function parseContentRow(row: unknown): PlatformPageContentRecord | null {
  if (!isRecord(row)) {
    return null;
  }

  const value = row as PlatformContentRow;
  const id = text(value.id, 120);
  const slug = text(value.slug, 120);
  const contentStatus = text(value.content_status, 40);

  if (!id || !slug || !isContentStatus(contentStatus)) {
    return null;
  }

  return {
    body: safeJsonRecord(value.body),
    canonicalPath: nullableText(value.canonical_path, 240),
    contentStatus,
    headline: nullableText(value.headline, 240),
    id,
    openGraph: safeJsonRecord(value.open_graph),
    seoDescription: nullableText(value.seo_description, 500),
    seoTitle: nullableText(value.seo_title, 180),
    slug,
    subtitle: nullableText(value.subtitle, 500),
    translations: safeTranslations(value.translations)
  };
}

function parseEditorRow(row: unknown): PlatformPageEditorRecord | null {
  const content = parseContentRow(row);

  if (!content || !isRecord(row)) {
    return null;
  }

  const value = row as PlatformContentRow;
  const title = text(value.title, 180);
  const routePath = text(value.route_path, 240);

  if (!title || !routePath) {
    return null;
  }

  return {
    ...content,
    pageType: text(value.page_type, 120) || "platform_page",
    routePath,
    status: parsePublishStatus(value.status),
    title,
    updatedAt: text(value.updated_at, 80) || null
  };
}

async function requireSuperAdmin() {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can manage platform website content.");
  }
}

function requireAdminClient() {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for platform website content.");
  }

  return admin;
}

export function validatePlatformPageContent(input: unknown): PlatformPageContentInput {
  if (!isRecord(input)) {
    throw new Error("Platform page content input must be an object.");
  }

  if ("slug" in input) {
    throw new Error("Platform page slug cannot be changed from content storage.");
  }

  if ("status" in input) {
    throw new Error("Platform page publish status cannot be changed from content storage.");
  }

  const contentStatus = input.contentStatus ?? input.content_status;

  if (contentStatus !== undefined && !isContentStatus(contentStatus)) {
    throw new Error("Invalid platform page content status.");
  }

  return {
    body: "body" in input ? safeJsonRecord(input.body) : undefined,
    canonicalPath: "canonicalPath" in input ? nullableText(input.canonicalPath, 240) : undefined,
    contentStatus: isContentStatus(contentStatus) ? contentStatus : undefined,
    headline: "headline" in input ? nullableText(input.headline, 240) : undefined,
    openGraph: "openGraph" in input ? safeJsonRecord(input.openGraph) : undefined,
    seoDescription: "seoDescription" in input ? nullableText(input.seoDescription, 500) : undefined,
    seoTitle: "seoTitle" in input ? nullableText(input.seoTitle, 180) : undefined,
    subtitle: "subtitle" in input ? nullableText(input.subtitle, 500) : undefined,
    title: "title" in input ? text(input.title, 180) : undefined,
    translations: "translations" in input ? safeTranslations(input.translations) : undefined
  };
}

export function validatePlatformPageEditorDraft(input: unknown): PlatformPageContentInput & { title: string } {
  const content = validatePlatformPageContent(input);

  if (!content.title) {
    throw new Error("Platform page title is required.");
  }

  if (content.seoTitle && content.seoTitle.length > 70) {
    throw new Error("SEO title must be 70 characters or fewer.");
  }

  if (content.seoDescription && content.seoDescription.length > 160) {
    throw new Error("SEO description must be 160 characters or fewer.");
  }

  if (content.canonicalPath && (!content.canonicalPath.startsWith("/") || content.canonicalPath.startsWith("//"))) {
    throw new Error("Canonical path must be a relative platform path.");
  }

  if (content.canonicalPath && /^(?:https?:|javascript:|data:)/i.test(content.canonicalPath)) {
    throw new Error("Canonical path must not be an absolute or executable URL.");
  }

  return {
    ...content,
    title: content.title
  };
}

export async function getPlatformPageContent(slug: string) {
  await requireSuperAdmin();
  const cleanedSlug = text(slug, 120);

  if (!cleanedSlug) {
    return null;
  }

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("platform_pages" as never)
    .select("id, slug, headline, subtitle, body, seo_title, seo_description, canonical_path, open_graph, translations, content_status")
    .eq("slug" as never, cleanedSlug as never)
    .maybeSingle();

  if (error) {
    throw new Error(`Platform page content could not be loaded: ${error.message}`);
  }

  return parseContentRow(data);
}

export async function getPlatformPageEditorContent(pageId: string) {
  await requireSuperAdmin();
  const cleanedPageId = text(pageId, 120);

  if (!cleanedPageId) {
    return null;
  }

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("platform_pages" as never)
    .select("id, slug, title, status, route_path, page_type, headline, subtitle, body, seo_title, seo_description, canonical_path, open_graph, translations, content_status, updated_at")
    .eq("id" as never, cleanedPageId as never)
    .maybeSingle();

  if (error) {
    throw new Error(`Platform page editor content could not be loaded: ${error.message}`);
  }

  return parseEditorRow(data);
}

export async function updatePlatformPageContent(pageId: string, input: unknown) {
  await requireSuperAdmin();
  const cleanedPageId = text(pageId, 120);

  if (!cleanedPageId) {
    throw new Error("Platform page id is required.");
  }

  const content = validatePlatformPageContent(input);
  const update: Record<string, unknown> = {};

  if (content.headline !== undefined) update.headline = content.headline;
  if (content.subtitle !== undefined) update.subtitle = content.subtitle;
  if (content.body !== undefined) update.body = content.body;
  if (content.seoTitle !== undefined) update.seo_title = content.seoTitle;
  if (content.seoDescription !== undefined) update.seo_description = content.seoDescription;
  if (content.canonicalPath !== undefined) update.canonical_path = content.canonicalPath;
  if (content.openGraph !== undefined) update.open_graph = content.openGraph;
  if (content.translations !== undefined) update.translations = content.translations;
  if (content.contentStatus !== undefined) update.content_status = content.contentStatus;
  if (content.title !== undefined) update.title = content.title;

  if (!Object.keys(update).length) {
    throw new Error("No platform page content fields were provided.");
  }

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("platform_pages" as never)
    .update(update as never)
    .eq("id" as never, cleanedPageId as never)
    .select("id, slug, headline, subtitle, body, seo_title, seo_description, canonical_path, open_graph, translations, content_status")
    .single();

  if (error) {
    throw new Error(`Platform page content could not be updated: ${error.message}`);
  }

  return parseContentRow(data);
}
