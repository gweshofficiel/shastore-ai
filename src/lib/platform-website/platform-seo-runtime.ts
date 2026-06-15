import "server-only";

import type { Metadata } from "next";
import { getAppBaseUrl } from "@/lib/deployment/config";
import type { PublicPlatformPage } from "@/src/lib/platform-website/public-page-resolver";

export type PlatformSeoValidation = {
  isReady: boolean;
  missingCanonical: boolean;
  missingDescription: boolean;
  missingOpenGraph: boolean;
  missingTitle: boolean;
};

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

function path(value: unknown) {
  const cleaned = text(value, 240);

  if (!cleaned || cleaned === "/") {
    return "/";
  }

  if (/^(?:https?:|javascript:|data:)/i.test(cleaned)) {
    return "/";
  }

  const relative = cleaned.startsWith("/") ? cleaned : `/${cleaned}`;

  return relative.replace(/\/+$/, "") || "/";
}

function openGraphText(page: PublicPlatformPage, key: "description" | "image_url" | "title", fallback: string) {
  return text(page.openGraph[key], key === "image_url" ? 1000 : 300) || fallback;
}

export function validatePlatformSeo(page: PublicPlatformPage): PlatformSeoValidation {
  const missingTitle = !text(page.seoTitle, 180);
  const missingDescription = !text(page.seoDescription, 500);
  const missingCanonical = !text(page.canonicalPath, 240);
  const missingOpenGraph = !text(page.openGraph.title, 180) ||
    !text(page.openGraph.description, 300) ||
    !text(page.openGraph.image_url, 1000);

  return {
    isReady: !missingTitle && !missingDescription && !missingCanonical && !missingOpenGraph,
    missingCanonical,
    missingDescription,
    missingOpenGraph,
    missingTitle
  };
}

export function getPlatformCanonicalUrl(page: PublicPlatformPage) {
  const baseUrl = getAppBaseUrl().replace(/\/+$/, "");
  const canonicalPath = path(page.canonicalPath || page.routePath);

  return `${baseUrl}${canonicalPath}`;
}

export function buildPlatformPageMetadata(page: PublicPlatformPage): Metadata {
  const title = text(page.seoTitle, 180) || page.title;
  const description = text(page.seoDescription, 500) ||
    text(page.subtitle, 500) ||
    `SHASTORE AI platform page: ${page.title}.`;
  const canonicalUrl = getPlatformCanonicalUrl(page);
  const openGraphTitle = openGraphText(page, "title", title);
  const openGraphDescription = openGraphText(page, "description", description);
  const openGraphImage = openGraphText(page, "image_url", "");

  return {
    alternates: {
      canonical: canonicalUrl
    },
    description,
    openGraph: {
      description: openGraphDescription,
      images: openGraphImage ? [{ url: openGraphImage }] : undefined,
      title: openGraphTitle,
      type: "website",
      url: canonicalUrl
    },
    robots: {
      follow: true,
      index: true
    },
    title
  };
}

export function unpublishedPlatformPageMetadata(): Metadata {
  return {
    robots: {
      follow: false,
      index: false
    }
  };
}
