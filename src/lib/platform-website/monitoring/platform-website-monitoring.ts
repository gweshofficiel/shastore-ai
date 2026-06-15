import "server-only";

import { getPlatformAnalyticsSummary } from "@/src/lib/platform-website/analytics/platform-analytics-service";
import {
  getPlatformBlogPostCategoryIds,
  getPlatformBlogPostTagIds,
  listPlatformBlogPosts,
  type PlatformBlogPostRecord
} from "@/src/lib/platform-website/blog/platform-blog-service";
import { listCategories, type PlatformBlogCategoryRecord } from "@/src/lib/platform-website/blog/categories-service";
import { listTags, type PlatformBlogTagRecord } from "@/src/lib/platform-website/blog/tags-service";
import { listPageBlocks, type PlatformPageBlockRecord } from "@/src/lib/platform-website/platform-blocks-runtime";
import {
  ensurePlatformPagesRegistry,
  type PlatformPageRegistryRecord
} from "@/src/lib/platform-website/platform-pages-registry";
import { isConnectedPlatformRoute } from "@/src/lib/platform-website/public-page-resolver";
import {
  platformLocales,
  validatePlatformTranslations,
  type PlatformLocale
} from "@/src/lib/platform-website/platform-translations-runtime";

export type PlatformWebsiteMonitoringSeverity = "critical" | "high" | "low" | "medium";
export type PlatformWebsiteMonitoringIssueType =
  | "blog_taxonomy"
  | "broken_link"
  | "missing_content"
  | "route"
  | "seo"
  | "translation";
export type PlatformWebsiteMonitoringContentType =
  | "platform_blog_category"
  | "platform_blog_post"
  | "platform_blog_tag"
  | "platform_page"
  | "platform_page_block";

export type PlatformWebsiteMonitoringIssue = {
  contentId: string;
  contentLabel: string;
  contentType: PlatformWebsiteMonitoringContentType;
  detectedAt: string;
  issueType: PlatformWebsiteMonitoringIssueType;
  language: PlatformLocale | null;
  message: string;
  severity: PlatformWebsiteMonitoringSeverity;
  suggestedAction: string;
};

export type PlatformWebsiteMonitoringFilters = {
  contentType?: string | null;
  issueType?: string | null;
  language?: string | null;
  page?: string | null;
  severity?: string | null;
};

export type PlatformWebsiteMonitoringSummary = {
  cards: {
    brokenLinks: number;
    criticalIssues: number;
    missingContent: number;
    routeIssues: number;
    seoIssues: number;
    translationIssues: number;
  };
  detectedAt: string;
  filterOptions: {
    contentTypes: string[];
    issueTypes: string[];
    languages: string[];
    pages: string[];
    severities: string[];
  };
  filters: {
    contentType: string;
    issueType: string;
    language: string;
    page: string;
    severity: string;
  };
  issues: PlatformWebsiteMonitoringIssue[];
  source: {
    analyticsObservedViews: number;
    checkedBlocks: number;
    checkedPages: number;
    checkedPosts: number;
  };
  totalIssues: number;
};

const severities: PlatformWebsiteMonitoringSeverity[] = ["critical", "high", "medium", "low"];
const issueTypes: PlatformWebsiteMonitoringIssueType[] = [
  "missing_content",
  "seo",
  "translation",
  "route",
  "broken_link",
  "blog_taxonomy"
];
const contentTypes: PlatformWebsiteMonitoringContentType[] = [
  "platform_page",
  "platform_page_block",
  "platform_blog_post",
  "platform_blog_category",
  "platform_blog_tag"
];
const criticalRequiredRoutes = new Set(["/", "/pricing", "/blog"]);

function text(value: unknown, maxLength = 1000) {
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

function routePath(value: unknown) {
  const cleaned = text(value, 240);
  if (!cleaned || cleaned === "/") return "/";
  if (/^(?:https?:|data:|javascript:|mailto:|tel:)/i.test(cleaned)) return "";

  return (cleaned.startsWith("/") ? cleaned : `/${cleaned}`).replace(/\/+$/, "") || "/";
}

function validExternalUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" || url.protocol === "mailto:" || url.protocol === "tel:";
  } catch {
    return false;
  }
}

function validUrl(value: unknown) {
  const cleaned = text(value, 1000);
  if (!cleaned) return true;
  if (cleaned.startsWith("/")) return Boolean(routePath(cleaned));
  return validExternalUrl(cleaned);
}

function validOpenGraphImageUrl(value: unknown) {
  const cleaned = text(value, 1000);
  if (!cleaned) return true;
  if (cleaned.startsWith("/")) return true;
  return validExternalUrl(cleaned);
}

function bodyHasContent(body: Record<string, unknown>) {
  if (text(body.text ?? body.body ?? body.content, 5000)) return true;
  const sections = Array.isArray(body.sections) ? body.sections : [];

  return sections.some((section) => {
    if (!isRecord(section)) return false;
    return Boolean(text(section.heading ?? section.title ?? section.text ?? section.content ?? section.body, 5000));
  });
}

function translationBodyHasArabic(record: Record<string, unknown>) {
  if (text(record.content, 5000)) return true;
  if (isRecord(record.body)) return bodyHasContent(record.body);
  return false;
}

function translationRecord(value: Record<string, unknown>, locale: PlatformLocale) {
  const translations = isRecord(value.translations) ? value.translations : {};
  return isRecord(translations[locale]) ? translations[locale] : {};
}

function blockLabel(block: PlatformPageBlockRecord, page: PlatformPageRegistryRecord) {
  return `${page.title} / ${block.blockType}${block.title ? `: ${block.title}` : ""}`;
}

function addIssue(
  issues: PlatformWebsiteMonitoringIssue[],
  input: Omit<PlatformWebsiteMonitoringIssue, "detectedAt">,
  detectedAt: string
) {
  issues.push({
    ...input,
    detectedAt
  });
}

function countIssues(issues: PlatformWebsiteMonitoringIssue[], predicate: (issue: PlatformWebsiteMonitoringIssue) => boolean) {
  return issues.filter(predicate).length;
}

function duplicateValues<T>(
  values: T[],
  valueFor: (item: T) => string,
  labelFor: (item: T) => string
) {
  const seen = new Map<string, string[]>();

  for (const item of values) {
    const value = valueFor(item).toLowerCase();
    if (!value) continue;
    seen.set(value, [...(seen.get(value) ?? []), labelFor(item)]);
  }

  return [...seen.entries()].filter(([, labels]) => labels.length > 1);
}

function collectUrls(value: unknown, keys: string[] = [], results: Array<{ key: string; url: string }> = []) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectUrls(item, keys, results));
    return results;
  }

  if (!isRecord(value)) return results;

  for (const [key, item] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase();
    const nextKeys = [...keys, normalizedKey];
    if (
      typeof item === "string" &&
      (normalizedKey.includes("url") || normalizedKey === "href" || normalizedKey.includes("link"))
    ) {
      results.push({ key: nextKeys.join("."), url: item });
    } else if (isRecord(item) || Array.isArray(item)) {
      collectUrls(item, nextKeys, results);
    }
  }

  return results;
}

async function pageBlocks(pages: PlatformPageRegistryRecord[]) {
  const entries = await Promise.all(
    pages.map(async (page) => ({
      blocks: await listPageBlocks(page.id),
      page
    }))
  );

  return entries.flatMap((entry) => entry.blocks.map((block) => ({ block, page: entry.page })));
}

async function taxonomyRelations(posts: PlatformBlogPostRecord[]) {
  const rows = await Promise.all(
    posts.map(async (post) => ({
      categoryIds: await getPlatformBlogPostCategoryIds(post.id),
      post,
      tagIds: await getPlatformBlogPostTagIds(post.id)
    }))
  );

  return rows;
}

function normalizeFilters(filters?: PlatformWebsiteMonitoringFilters): PlatformWebsiteMonitoringSummary["filters"] {
  return {
    contentType: contentTypes.includes(filters?.contentType as PlatformWebsiteMonitoringContentType) ? String(filters?.contentType) : "all",
    issueType: issueTypes.includes(filters?.issueType as PlatformWebsiteMonitoringIssueType) ? String(filters?.issueType) : "all",
    language: platformLocales.includes(filters?.language as PlatformLocale) ? String(filters?.language) : "all",
    page: text(filters?.page, 120) || "all",
    severity: severities.includes(filters?.severity as PlatformWebsiteMonitoringSeverity) ? String(filters?.severity) : "all"
  };
}

function filterIssues(issues: PlatformWebsiteMonitoringIssue[], filters: PlatformWebsiteMonitoringSummary["filters"]) {
  return issues.filter((issue) => {
    if (filters.severity !== "all" && issue.severity !== filters.severity) return false;
    if (filters.issueType !== "all" && issue.issueType !== filters.issueType) return false;
    if (filters.contentType !== "all" && issue.contentType !== filters.contentType) return false;
    if (filters.language !== "all" && issue.language !== filters.language) return false;
    if (filters.page !== "all" && issue.contentId !== filters.page && issue.contentLabel !== filters.page) return false;
    return true;
  });
}

function checkPages(issues: PlatformWebsiteMonitoringIssue[], pages: PlatformPageRegistryRecord[], detectedAt: string) {
  const routeTargets = new Set(pages.map((page) => page.routePath));

  for (const page of pages) {
    const label = page.title || page.slug;
    const severity = criticalRequiredRoutes.has(page.routePath) ? "critical" : "high";

    if (!text(page.title, 180)) {
      addIssue(issues, {
        contentId: page.id,
        contentLabel: label,
        contentType: "platform_page",
        issueType: "missing_content",
        language: null,
        message: "Platform page is missing a title.",
        severity: "high",
        suggestedAction: "Add a clear title in the platform page editor."
      }, detectedAt);
    }

    if (!text(page.headline, 240)) {
      addIssue(issues, {
        contentId: page.id,
        contentLabel: label,
        contentType: "platform_page",
        issueType: "missing_content",
        language: null,
        message: "Platform page is missing a headline.",
        severity: "medium",
        suggestedAction: "Add a page headline before publishing."
      }, detectedAt);
    }

    if (!bodyHasContent(page.body)) {
      addIssue(issues, {
        contentId: page.id,
        contentLabel: label,
        contentType: "platform_page",
        issueType: "missing_content",
        language: null,
        message: "Platform page has no body content sections.",
        severity: page.status === "published" ? "high" : "medium",
        suggestedAction: "Add body content or published landing blocks."
      }, detectedAt);
    }

    if (!text(page.seoTitle, 180)) {
      addIssue(issues, {
        contentId: page.id,
        contentLabel: label,
        contentType: "platform_page",
        issueType: "seo",
        language: null,
        message: "Platform page is missing an SEO title.",
        severity: page.status === "published" ? "high" : "medium",
        suggestedAction: "Add an SEO title in the page editor."
      }, detectedAt);
    }

    if (!text(page.seoDescription, 500)) {
      addIssue(issues, {
        contentId: page.id,
        contentLabel: label,
        contentType: "platform_page",
        issueType: "seo",
        language: null,
        message: "Platform page is missing an SEO description.",
        severity: page.status === "published" ? "high" : "medium",
        suggestedAction: "Add an SEO description in the page editor."
      }, detectedAt);
    }

    if (!text(page.canonicalPath, 240)) {
      addIssue(issues, {
        contentId: page.id,
        contentLabel: label,
        contentType: "platform_page",
        issueType: "seo",
        language: null,
        message: "Platform page is missing a canonical path.",
        severity: "medium",
        suggestedAction: "Set a relative canonical path that matches the public route."
      }, detectedAt);
    }

    if (!text(page.openGraph.title, 180) || !text(page.openGraph.description, 300)) {
      addIssue(issues, {
        contentId: page.id,
        contentLabel: label,
        contentType: "platform_page",
        issueType: "seo",
        language: null,
        message: "Platform page is missing OpenGraph title or description.",
        severity: "medium",
        suggestedAction: "Complete OpenGraph metadata in the page editor."
      }, detectedAt);
    }

    if (!validOpenGraphImageUrl(page.openGraph.image_url)) {
      addIssue(issues, {
        contentId: page.id,
        contentLabel: label,
        contentType: "platform_page",
        issueType: "seo",
        language: null,
        message: "Platform page has an invalid OpenGraph image URL.",
        severity: "medium",
        suggestedAction: "Use a safe relative path or http/https image URL."
      }, detectedAt);
    }

    if (isConnectedPlatformRoute(page.routePath) && page.status !== "published") {
      addIssue(issues, {
        contentId: page.id,
        contentLabel: label,
        contentType: "platform_page",
        issueType: "route",
        language: null,
        message: page.status === "archived" ? "Required platform route is archived." : "Required platform route is not published.",
        severity: page.status === "archived" ? "critical" : severity,
        suggestedAction: "Review readiness and publish the required platform page when complete."
      }, detectedAt);
    }

    if (!routePath(page.routePath) || !isConnectedPlatformRoute(page.routePath)) {
      addIssue(issues, {
        contentId: page.id,
        contentLabel: label,
        contentType: "platform_page",
        issueType: "route",
        language: null,
        message: "Platform page has an invalid or disconnected route path.",
        severity: "high",
        suggestedAction: "Use one of the connected platform public routes."
      }, detectedAt);
    }

    const translations = validatePlatformTranslations(page);
    for (const locale of platformLocales) {
      const status = translations.locales[locale];
      if (status === "missing" || status === "partial" || status === "needs_review") {
        addIssue(issues, {
          contentId: page.id,
          contentLabel: label,
          contentType: "platform_page",
          issueType: "translation",
          language: locale,
          message: `Platform page ${locale} translation is ${status}.`,
          severity: locale === "en" && page.status === "published" ? "high" : "medium",
          suggestedAction: `Complete and mark the ${locale} translation ready.`
        }, detectedAt);
      }
    }

    const arabicRecord = translationRecord(page, "ar");
    if (!translationBodyHasArabic(arabicRecord)) {
      addIssue(issues, {
        contentId: page.id,
        contentLabel: label,
        contentType: "platform_page",
        issueType: "translation",
        language: "ar",
        message: "Arabic translation is missing RTL content.",
        severity: page.status === "published" ? "high" : "medium",
        suggestedAction: "Add Arabic body content and mark the translation ready after review."
      }, detectedAt);
    }

    for (const link of collectUrls(page.body)) {
      const target = routePath(link.url);
      if (target && link.url.startsWith("/") && !routeTargets.has(target)) {
        addIssue(issues, {
          contentId: page.id,
          contentLabel: label,
          contentType: "platform_page",
          issueType: "broken_link",
          language: null,
          message: `Internal link ${link.url} has no matching platform page target.`,
          severity: "medium",
          suggestedAction: "Update the link or add/publish the target platform page."
        }, detectedAt);
      }
    }
  }
}

function checkDuplicates(issues: PlatformWebsiteMonitoringIssue[], pages: PlatformPageRegistryRecord[], detectedAt: string) {
  for (const [value, labels] of duplicateValues(pages, (page) => text(page.seoTitle, 180), (page) => page.title)) {
    addIssue(issues, {
      contentId: value,
      contentLabel: labels.join(", "),
      contentType: "platform_page",
      issueType: "seo",
      language: null,
      message: "Duplicate SEO title detected across platform pages.",
      severity: "medium",
      suggestedAction: "Make SEO titles unique for each platform page."
    }, detectedAt);
  }

  for (const [value, labels] of duplicateValues(pages, (page) => text(page.canonicalPath, 240), (page) => page.title)) {
    addIssue(issues, {
      contentId: value,
      contentLabel: labels.join(", "),
      contentType: "platform_page",
      issueType: "seo",
      language: null,
      message: "Duplicate canonical path detected across platform pages.",
      severity: "high",
      suggestedAction: "Use a unique canonical path for each platform page."
    }, detectedAt);
  }
}

function checkBlocks(
  issues: PlatformWebsiteMonitoringIssue[],
  blocks: Array<{ block: PlatformPageBlockRecord; page: PlatformPageRegistryRecord }>,
  pages: PlatformPageRegistryRecord[],
  detectedAt: string
) {
  const routeTargets = new Set(pages.map((page) => page.routePath));

  for (const { block, page } of blocks) {
    const label = blockLabel(block, page);
    const urls = [...collectUrls(block.content), ...collectUrls(block.settings)];

    for (const link of urls) {
      const url = text(link.url, 1000);
      if (!validUrl(url)) {
        addIssue(issues, {
          contentId: block.id,
          contentLabel: label,
          contentType: "platform_page_block",
          issueType: "broken_link",
          language: null,
          message: `${block.blockType} block has invalid URL in ${link.key}.`,
          severity: block.status === "published" ? "high" : "medium",
          suggestedAction: "Replace the URL with a safe relative path or valid http/https URL."
        }, detectedAt);
      }

      const target = routePath(url);
      if (target && url.startsWith("/") && !routeTargets.has(target)) {
        addIssue(issues, {
          contentId: block.id,
          contentLabel: label,
          contentType: "platform_page_block",
          issueType: "broken_link",
          language: null,
          message: `Internal link ${url} has no matching platform page target.`,
          severity: block.status === "published" ? "high" : "medium",
          suggestedAction: "Update the block link or create the missing platform page target."
        }, detectedAt);
      }
    }

    if ((block.blockType === "cta" || block.blockType === "hero") && !urls.length) {
      addIssue(issues, {
        contentId: block.id,
        contentLabel: label,
        contentType: "platform_page_block",
        issueType: "broken_link",
        language: null,
        message: `${block.blockType} block has no CTA URL configured.`,
        severity: block.status === "published" ? "medium" : "low",
        suggestedAction: "Add a valid CTA URL in the landing page builder."
      }, detectedAt);
    }

    if (block.blockType === "footer" && !urls.length) {
      addIssue(issues, {
        contentId: block.id,
        contentLabel: label,
        contentType: "platform_page_block",
        issueType: "broken_link",
        language: null,
        message: "Footer block has no links configured.",
        severity: block.status === "published" ? "medium" : "low",
        suggestedAction: "Add safe footer links in the landing page builder."
      }, detectedAt);
    }
  }
}

async function checkBlog(
  issues: PlatformWebsiteMonitoringIssue[],
  posts: PlatformBlogPostRecord[],
  categories: PlatformBlogCategoryRecord[],
  tags: PlatformBlogTagRecord[],
  detectedAt: string
) {
  const activeCategoryIds = new Set(categories.filter((category) => category.status === "active").map((category) => category.id));
  const activeTagIds = new Set(tags.filter((tag) => tag.status === "active").map((tag) => tag.id));
  const relations = await taxonomyRelations(posts);

  for (const post of posts.filter((item) => item.status === "published")) {
    if (!text(post.title, 180)) {
      addIssue(issues, {
        contentId: post.id,
        contentLabel: post.slug,
        contentType: "platform_blog_post",
        issueType: "missing_content",
        language: null,
        message: "Published blog post is missing a title.",
        severity: "critical",
        suggestedAction: "Add a title or revert the post to draft."
      }, detectedAt);
    }

    if (!text(post.seoTitle, 70) || !text(post.seoDescription, 160)) {
      addIssue(issues, {
        contentId: post.id,
        contentLabel: post.title,
        contentType: "platform_blog_post",
        issueType: "seo",
        language: null,
        message: "Published blog post is missing SEO title or description.",
        severity: "high",
        suggestedAction: "Complete blog SEO fields in the post editor."
      }, detectedAt);
    }

    if (!text(post.excerpt, 500)) {
      addIssue(issues, {
        contentId: post.id,
        contentLabel: post.title,
        contentType: "platform_blog_post",
        issueType: "missing_content",
        language: null,
        message: "Published blog post is missing an excerpt.",
        severity: "medium",
        suggestedAction: "Add a safe excerpt for blog cards and SEO fallbacks."
      }, detectedAt);
    }
  }

  for (const relation of relations) {
    for (const categoryId of relation.categoryIds) {
      if (!activeCategoryIds.has(categoryId)) {
        addIssue(issues, {
          contentId: relation.post.id,
          contentLabel: relation.post.title,
          contentType: "platform_blog_post",
          issueType: "blog_taxonomy",
          language: null,
          message: "Blog post references a missing or archived category.",
          severity: relation.post.status === "published" ? "high" : "medium",
          suggestedAction: "Remove the stale category assignment or reactivate the category."
        }, detectedAt);
      }
    }

    for (const tagId of relation.tagIds) {
      if (!activeTagIds.has(tagId)) {
        addIssue(issues, {
          contentId: relation.post.id,
          contentLabel: relation.post.title,
          contentType: "platform_blog_post",
          issueType: "blog_taxonomy",
          language: null,
          message: "Blog post references a missing or archived tag.",
          severity: relation.post.status === "published" ? "high" : "medium",
          suggestedAction: "Remove the stale tag assignment or reactivate the tag."
        }, detectedAt);
      }
    }
  }
}

export async function getPlatformWebsiteMonitoring(
  rawFilters?: PlatformWebsiteMonitoringFilters
): Promise<PlatformWebsiteMonitoringSummary> {
  const detectedAt = new Date().toISOString();
  const filters = normalizeFilters(rawFilters);
  const [pages, posts, categories, tags, analytics] = await Promise.all([
    ensurePlatformPagesRegistry(),
    listPlatformBlogPosts(),
    listCategories(),
    listTags(),
    getPlatformAnalyticsSummary("last_30_days")
  ]);
  const blocks = await pageBlocks(pages);
  const issues: PlatformWebsiteMonitoringIssue[] = [];

  checkPages(issues, pages, detectedAt);
  checkDuplicates(issues, pages, detectedAt);
  checkBlocks(issues, blocks, pages, detectedAt);
  await checkBlog(issues, posts, categories, tags, detectedAt);

  const filteredIssues = filterIssues(issues, filters);

  return {
    cards: {
      brokenLinks: countIssues(issues, (issue) => issue.issueType === "broken_link" || issue.issueType === "blog_taxonomy"),
      criticalIssues: countIssues(issues, (issue) => issue.severity === "critical"),
      missingContent: countIssues(issues, (issue) => issue.issueType === "missing_content"),
      routeIssues: countIssues(issues, (issue) => issue.issueType === "route"),
      seoIssues: countIssues(issues, (issue) => issue.issueType === "seo"),
      translationIssues: countIssues(issues, (issue) => issue.issueType === "translation")
    },
    detectedAt,
    filterOptions: {
      contentTypes,
      issueTypes,
      languages: platformLocales,
      pages: pages.map((page) => page.title).sort((left, right) => left.localeCompare(right)),
      severities
    },
    filters,
    issues: filteredIssues,
    source: {
      analyticsObservedViews: analytics.pages.totalViews + analytics.blog.totalViews,
      checkedBlocks: blocks.length,
      checkedPages: pages.length,
      checkedPosts: posts.length
    },
    totalIssues: issues.length
  };
}
