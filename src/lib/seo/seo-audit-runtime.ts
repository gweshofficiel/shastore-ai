import "server-only";

import { isAnalyticsConnected } from "@/src/lib/seo/seo-analytics-runtime";
import { mapCanonicalRuntimeToAdminFields } from "@/src/lib/seo/seo-canonical-runtime";
import {
  listIndexingWarnings
} from "@/src/lib/seo/seo-indexing-warning-runtime";
import { mapMetaDescriptionRuntimeToAdminFields } from "@/src/lib/seo/seo-meta-description-runtime";
import { mapMetaTitleRuntimeToAdminFields } from "@/src/lib/seo/seo-meta-title-runtime";
import { mapOpenGraphRuntimeToAdminFields } from "@/src/lib/seo/seo-open-graph-runtime";
import { mapSeoLanguageRuntimeToAdminFields } from "@/src/lib/seo/seo-language-runtime";
import { listSeoPages } from "@/src/lib/seo/seo-page-runtime";
import { mapRobotsRuntimeToAdminFields } from "@/src/lib/seo/seo-robots-runtime";
import { isSearchConsoleConnected } from "@/src/lib/seo/seo-search-console-runtime";
import { mapSitemapRuntimeToAdminFields } from "@/src/lib/seo/seo-sitemap-runtime";
import { mapStructuredDataRuntimeToAdminFields } from "@/src/lib/seo/seo-structured-data-runtime";

export type SeoAuditRuntimeStatus = "audit_ready" | "incomplete" | "needs_review" | "placeholder";

export type SeoAuditSnapshot = {
  analyticsConnected: boolean;
  canonicalReady: number;
  generatedAt: string;
  indexingWarningCount: number;
  languageReady: number;
  missingMetaDescriptions: number;
  missingMetaTitles: number;
  openGraphReady: number;
  readOnly: true;
  robotsStatus: "ready" | "warning";
  searchConsoleConnected: boolean;
  sitemapStatus: "ready" | "warning";
  structuredDataStatus: "placeholder" | "ready";
  totalPublicSeoPages: number;
};

export type SeoAuditSummary = {
  readOnly: true;
  runtimeStatus: SeoAuditRuntimeStatus;
  summary: string;
};

export type SeoAuditRuntimeValidation = {
  isValid: boolean;
  issues: string[];
};

export const SEO_AUDIT_EXPORT_HOOK_LABEL = "SEO audit export" as const;

export async function runSeoAuditSnapshot(): Promise<SeoAuditSnapshot> {
  const [
    seoPages,
    sitemapRuntime,
    robotsRuntime,
    structuredDataRuntime,
    indexingWarnings
  ] = await Promise.all([
    listSeoPages(),
    mapSitemapRuntimeToAdminFields(),
    mapRobotsRuntimeToAdminFields(),
    Promise.resolve(mapStructuredDataRuntimeToAdminFields()),
    listIndexingWarnings()
  ]);

  const pageChecks = seoPages.map((page) => ({
    canonical: mapCanonicalRuntimeToAdminFields(page),
    language: mapSeoLanguageRuntimeToAdminFields(page),
    metaDescription: mapMetaDescriptionRuntimeToAdminFields(page),
    metaTitle: mapMetaTitleRuntimeToAdminFields(page),
    openGraph: mapOpenGraphRuntimeToAdminFields(page)
  }));

  return {
    analyticsConnected: isAnalyticsConnected(),
    canonicalReady: pageChecks.filter((page) => page.canonical.canonicalStatus === "ready").length,
    generatedAt: new Date().toISOString(),
    indexingWarningCount: indexingWarnings.length,
    languageReady: pageChecks.filter((page) => page.language.languageStatus === "ready").length,
    missingMetaDescriptions: pageChecks.filter((page) => page.metaDescription.metaDescriptionStatus === "missing")
      .length,
    missingMetaTitles: pageChecks.filter((page) => page.metaTitle.metaTitleStatus === "missing").length,
    openGraphReady: pageChecks.filter((page) => page.openGraph.openGraphStatus === "ready").length,
    readOnly: true,
    robotsStatus: robotsRuntime.status,
    searchConsoleConnected: isSearchConsoleConnected(),
    sitemapStatus: sitemapRuntime.status,
    structuredDataStatus: structuredDataRuntime.structuredDataStatus,
    totalPublicSeoPages: seoPages.length
  };
}

export function getSeoAuditSummary(snapshot: SeoAuditSnapshot): SeoAuditSummary {
  const runtimeStatus = getSeoAuditRuntimeStatus(snapshot);

  return {
    readOnly: true,
    runtimeStatus,
    summary: [
      `${snapshot.totalPublicSeoPages} public SEO page(s)`,
      `${snapshot.missingMetaTitles} missing title(s)`,
      `${snapshot.missingMetaDescriptions} missing description(s)`,
      `${snapshot.canonicalReady} canonical ready`,
      `${snapshot.openGraphReady} Open Graph ready`,
      `${snapshot.languageReady} language ready`,
      `sitemap ${snapshot.sitemapStatus}`,
      `robots ${snapshot.robotsStatus}`,
      `structured data ${snapshot.structuredDataStatus}`,
      snapshot.searchConsoleConnected ? "Search Console connected" : "Search Console not connected",
      snapshot.analyticsConnected ? "Analytics connected" : "Analytics not connected",
      `${snapshot.indexingWarningCount} indexing warning(s)`
    ].join("; ")
  };
}

export function getSeoAuditRuntimeStatus(snapshot: SeoAuditSnapshot): SeoAuditRuntimeStatus {
  if (!snapshot.readOnly || snapshot.totalPublicSeoPages < 1) {
    return "placeholder";
  }

  if (snapshot.missingMetaTitles > 0 || snapshot.missingMetaDescriptions > 0) {
    return "incomplete";
  }

  if (snapshot.sitemapStatus === "warning" || snapshot.robotsStatus === "warning") {
    return "needs_review";
  }

  if (snapshot.structuredDataStatus === "placeholder") {
    return "needs_review";
  }

  if (snapshot.indexingWarningCount > 0) {
    return "needs_review";
  }

  if (snapshot.canonicalReady < snapshot.totalPublicSeoPages) {
    return "needs_review";
  }

  return "audit_ready";
}

export function validateSeoAuditRuntime(snapshot: SeoAuditSnapshot): SeoAuditRuntimeValidation {
  const issues: string[] = [];

  if (!snapshot.readOnly) {
    issues.push("SEO audit runtime must remain read-only.");
  }

  if (!snapshot.generatedAt) {
    issues.push("SEO audit snapshot must include a generatedAt timestamp.");
  }

  if (snapshot.totalPublicSeoPages < 0) {
    issues.push("SEO audit snapshot totalPublicSeoPages must be non-negative.");
  }

  if (snapshot.missingMetaTitles < 0 || snapshot.missingMetaDescriptions < 0) {
    issues.push("SEO audit snapshot missing meta counts must be non-negative.");
  }

  return {
    isValid: issues.length === 0,
    issues
  };
}

export async function mapSeoAuditRuntimeToAdminFields() {
  const snapshot = await runSeoAuditSnapshot();
  const validation = validateSeoAuditRuntime(snapshot);
  const auditSummary = getSeoAuditSummary(snapshot);

  return {
    exportHookLabel: SEO_AUDIT_EXPORT_HOOK_LABEL,
    exportPlaceholderStatus: "placeholder" as const,
    readOnly: true,
    runtimeStatus: validation.isValid ? auditSummary.runtimeStatus : "placeholder",
    snapshot,
    summary: validation.isValid
      ? auditSummary.summary
      : "SEO audit runtime validation requires safe read-only defaults."
  };
}

// SEO-20+ placeholders: SEO audit export, editor, and AI generation stay disconnected.
export const SEO_AUDIT_FUTURE_HOOKS = [
  "seo_audit_export",
  "seo_editor",
  "seo_ai_generator"
] as const;
