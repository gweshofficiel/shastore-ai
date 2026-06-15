import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getPlatformTranslationStatus,
  isPlatformLocale,
  platformLocales,
  validatePlatformTranslations,
  type PlatformLocale,
  type PlatformTranslationReadiness
} from "@/src/lib/platform-website/platform-translations-runtime";

export type PlatformTranslationInput = {
  body?: unknown;
  headline?: string | null;
  openGraph?: unknown;
  seoDescription?: string | null;
  seoTitle?: string | null;
  status?: Exclude<PlatformTranslationReadiness, "missing">;
  subtitle?: string | null;
  title?: string | null;
};

export type PlatformTranslationEditorRecord = {
  body: Record<string, unknown>;
  headline: string | null;
  locale: PlatformLocale;
  missingFields: string[];
  openGraph: Record<string, unknown>;
  pageId: string;
  pageTitle: string;
  routePath: string;
  seoDescription: string | null;
  seoTitle: string | null;
  slug: string;
  status: PlatformTranslationReadiness;
  subtitle: string | null;
  title: string | null;
  updatedAt: string | null;
};

type PlatformTranslationRow = {
  id?: string | null;
  route_path?: string | null;
  slug?: string | null;
  title?: string | null;
  translations?: unknown;
  updated_at?: string | null;
};

const translationStatuses: Array<Exclude<PlatformTranslationReadiness, "missing">> = ["needs_review", "partial", "ready"];

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

function translationRecord(translations: unknown, locale: PlatformLocale) {
  const source = isRecord(translations) ? translations : {};

  return safeJsonRecord(source[locale]);
}

function translationText(record: Record<string, unknown>, camelKey: string, snakeKey: string, maxLength = 2000) {
  return nullableText(record[camelKey] ?? record[snakeKey], maxLength);
}

function parsePageRow(row: unknown, locale: PlatformLocale): PlatformTranslationEditorRecord | null {
  if (!isRecord(row)) {
    return null;
  }

  const value = row as PlatformTranslationRow;
  const pageId = text(value.id, 120);
  const slug = text(value.slug, 120);
  const pageTitle = text(value.title, 180);
  const routePath = text(value.route_path, 240);

  if (!pageId || !slug || !pageTitle || !routePath) {
    return null;
  }

  const record = translationRecord(value.translations, locale);
  const validation = validatePlatformTranslations({ translations: value.translations });
  const openGraph = safeJsonRecord(record.openGraph ?? record.open_graph);

  return {
    body: safeJsonRecord(record.body),
    headline: translationText(record, "headline", "headline", 240),
    locale,
    missingFields: validation.missingFields[locale],
    openGraph,
    pageId,
    pageTitle,
    routePath,
    seoDescription: translationText(record, "seoDescription", "seo_description", 500),
    seoTitle: translationText(record, "seoTitle", "seo_title", 180),
    slug,
    status: getPlatformTranslationStatus({ translations: value.translations })[locale],
    subtitle: translationText(record, "subtitle", "subtitle", 500),
    title: translationText(record, "title", "title", 180),
    updatedAt: text(value.updated_at, 80) || null
  };
}

async function requireSuperAdmin() {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can manage platform website translations.");
  }
}

function requireAdminClient() {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for platform website translations.");
  }

  return admin;
}

async function readTranslationRow(pageId: string) {
  await requireSuperAdmin();
  const id = text(pageId, 120);

  if (!id) {
    throw new Error("Platform page id is required.");
  }

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("platform_pages" as never)
    .select("id, slug, title, route_path, translations, updated_at")
    .eq("id" as never, id as never)
    .maybeSingle();

  if (error) {
    throw new Error(`Platform translation content could not be loaded: ${error.message}`);
  }

  if (!data) {
    throw new Error("Platform page was not found.");
  }

  return data as PlatformTranslationRow;
}

export function validatePlatformTranslationInput(locale: string, input: unknown): PlatformTranslationInput {
  if (!isPlatformLocale(locale)) {
    throw new Error("Platform translation locale must be en, ar, or fr.");
  }

  if (!isRecord(input)) {
    throw new Error("Platform translation input must be an object.");
  }

  const status = text(input.status, 40) || "partial";

  if (!translationStatuses.includes(status as Exclude<PlatformTranslationReadiness, "missing">)) {
    throw new Error("Invalid platform translation status.");
  }

  const title = nullableText(input.title, 180);
  const seoTitle = nullableText(input.seoTitle ?? input.seo_title, 70);
  const seoDescription = nullableText(input.seoDescription ?? input.seo_description, 160);

  if (status === "ready" && !title) {
    throw new Error("Translation title is required before marking ready.");
  }

  if (seoTitle && seoTitle.length > 70) {
    throw new Error("Translation SEO title must be 70 characters or fewer.");
  }

  if (seoDescription && seoDescription.length > 160) {
    throw new Error("Translation SEO description must be 160 characters or fewer.");
  }

  return {
    body: "body" in input ? safeJsonRecord(input.body) : undefined,
    headline: "headline" in input ? nullableText(input.headline, 240) : undefined,
    openGraph: "openGraph" in input ? safeJsonRecord(input.openGraph) : undefined,
    seoDescription,
    seoTitle,
    status: status as Exclude<PlatformTranslationReadiness, "missing">,
    subtitle: "subtitle" in input ? nullableText(input.subtitle, 500) : undefined,
    title
  };
}

export async function getPlatformTranslationEditorContent(pageId: string, locale: string) {
  if (!isPlatformLocale(locale)) {
    return null;
  }

  const row = await readTranslationRow(pageId);

  return parsePageRow(row, locale);
}

export async function updatePlatformPageTranslation(pageId: string, locale: string, input: unknown) {
  if (!isPlatformLocale(locale)) {
    throw new Error("Platform translation locale must be en, ar, or fr.");
  }

  const row = await readTranslationRow(pageId);
  const content = validatePlatformTranslationInput(locale, input);
  const translations = isRecord(row.translations) ? safeJsonRecord(row.translations) : {};
  const existing = translationRecord(translations, locale);
  const nextLocaleRecord = {
    ...existing,
    ...(content.body !== undefined ? { body: content.body } : {}),
    ...(content.headline !== undefined ? { headline: content.headline } : {}),
    ...(content.openGraph !== undefined ? { open_graph: content.openGraph } : {}),
    ...(content.seoDescription !== undefined ? { seo_description: content.seoDescription } : {}),
    ...(content.seoTitle !== undefined ? { seo_title: content.seoTitle } : {}),
    ...(content.status ? { status: content.status } : {}),
    ...(content.subtitle !== undefined ? { subtitle: content.subtitle } : {}),
    ...(content.title !== undefined ? { title: content.title } : {})
  };
  const nextTranslations = Object.fromEntries(
    platformLocales.map((language) => [
      language,
      language === locale ? nextLocaleRecord : translationRecord(translations, language)
    ])
  );
  const admin = requireAdminClient();
  const { error } = await admin
    .from("platform_pages" as never)
    .update({ translations: nextTranslations } as never)
    .eq("id" as never, text(pageId, 120) as never);

  if (error) {
    throw new Error(`Platform translation could not be saved: ${error.message}`);
  }

  return getPlatformTranslationEditorContent(pageId, locale);
}
