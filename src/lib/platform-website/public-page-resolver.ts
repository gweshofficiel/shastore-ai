import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type PublicPlatformPage = {
  body: Record<string, unknown>;
  canonicalPath: string | null;
  headline: string;
  id: string;
  openGraph: Record<string, unknown>;
  routePath: string;
  seoDescription: string | null;
  seoTitle: string | null;
  slug: string;
  subtitle: string | null;
  title: string;
  translations: Record<string, unknown>;
};

type PublicPlatformPageRow = {
  body?: unknown;
  canonical_path?: string | null;
  headline?: string | null;
  id?: string | null;
  open_graph?: unknown;
  route_path?: string | null;
  seo_description?: string | null;
  seo_title?: string | null;
  slug?: string | null;
  status?: string | null;
  subtitle?: string | null;
  title?: string | null;
  translations?: unknown;
};

const connectedPlatformRoutes = new Set([
  "/",
  "/about",
  "/affiliates",
  "/blog",
  "/careers",
  "/contact",
  "/features",
  "/legal",
  "/pricing",
  "/reseller"
]);

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

function normalizePath(path: string) {
  const cleaned = text(path, 240);

  if (!cleaned || cleaned === "/") {
    return "/";
  }

  const relative = cleaned.startsWith("/") ? cleaned : `/${cleaned}`;

  return relative.replace(/\/+$/, "") || "/";
}

function jsonRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function parsePublicPage(row: unknown): PublicPlatformPage | null {
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    return null;
  }

  const value = row as PublicPlatformPageRow;
  const id = text(value.id, 120);
  const slug = text(value.slug, 120);
  const title = text(value.title, 180);
  const routePath = normalizePath(text(value.route_path, 240));
  const seoTitle = text(value.seo_title, 180);
  const seoDescription = text(value.seo_description, 500);

  if (!id || !slug || !title || !connectedPlatformRoutes.has(routePath)) {
    return null;
  }

  return {
    body: jsonRecord(value.body),
    canonicalPath: text(value.canonical_path, 240) ? normalizePath(text(value.canonical_path, 240)) : null,
    headline: text(value.headline, 240) || title,
    id,
    openGraph: jsonRecord(value.open_graph),
    routePath,
    seoDescription: seoDescription || null,
    seoTitle: seoTitle || null,
    slug,
    subtitle: text(value.subtitle, 500) || null,
    title,
    translations: jsonRecord(value.translations)
  };
}

async function readPublishedPlatformPage(column: "route_path" | "slug", value: string) {
  const admin = createAdminClient();

  if (!admin) {
    return null;
  }

  const { data, error } = await admin
    .from("platform_pages" as never)
    .select("id, slug, title, route_path, headline, subtitle, body, seo_title, seo_description, canonical_path, open_graph, translations, status")
    .eq(column as never, value as never)
    .eq("status" as never, "published" as never)
    .maybeSingle();

  if (error) {
    throw new Error(`Published platform page could not be loaded: ${error.message}`);
  }

  return parsePublicPage(data);
}

export function isConnectedPlatformRoute(path: string) {
  return connectedPlatformRoutes.has(normalizePath(path));
}

export async function getPublishedPlatformPageBySlug(slug: string) {
  const cleanedSlug = text(slug, 120);

  if (!cleanedSlug) {
    return null;
  }

  return readPublishedPlatformPage("slug", cleanedSlug);
}

export async function resolvePlatformPageRoute(path: string) {
  const routePath = normalizePath(path);

  if (!connectedPlatformRoutes.has(routePath)) {
    return null;
  }

  return readPublishedPlatformPage("route_path", routePath);
}

