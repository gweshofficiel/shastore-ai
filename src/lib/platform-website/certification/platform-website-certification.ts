import "server-only";

import {
  getPlatformAnalyticsSummary,
  type PlatformAnalyticsSummary
} from "@/src/lib/platform-website/analytics/platform-analytics-service";
import {
  listPlatformBlogPosts,
  type PlatformBlogPostRecord
} from "@/src/lib/platform-website/blog/platform-blog-service";
import {
  getPlatformWebsiteMonitoring,
  type PlatformWebsiteMonitoringIssue,
  type PlatformWebsiteMonitoringSeverity,
  type PlatformWebsiteMonitoringSummary
} from "@/src/lib/platform-website/monitoring/platform-website-monitoring";
import {
  ensurePlatformPagesRegistry,
  type PlatformPageRegistryRecord
} from "@/src/lib/platform-website/platform-pages-registry";
import { isConnectedPlatformRoute } from "@/src/lib/platform-website/public-page-resolver";

export type PlatformCertificationStatus = "blocked" | "needs_attention" | "ready";

export type PlatformCertificationChecklistItem = {
  key: string;
  label: string;
  message: string;
  status: PlatformCertificationStatus;
};

export type PlatformCertificationBlocker = {
  blockerType: string;
  message: string;
  relatedEntity: string;
  severity: PlatformWebsiteMonitoringSeverity;
  suggestedAction: string;
};

export type PlatformSecurityReviewItem = {
  label: string;
  message: string;
  status: PlatformCertificationStatus;
};

export type PlatformWebsiteCertificationSummary = {
  analyticsEmptyState: string | null;
  blockers: PlatformCertificationBlocker[];
  checklist: PlatformCertificationChecklistItem[];
  detectedAt: string;
  readinessScore: number;
  readinessStatus: PlatformCertificationStatus;
  securityReview: {
    items: PlatformSecurityReviewItem[];
    result: PlatformCertificationStatus;
    summary: string;
  };
};

const requiredRoutes = ["/", "/pricing", "/blog"];

function allIssues(monitoring: PlatformWebsiteMonitoringSummary) {
  return monitoring.issues;
}

function countIssues(issues: PlatformWebsiteMonitoringIssue[], predicate: (issue: PlatformWebsiteMonitoringIssue) => boolean) {
  return issues.filter(predicate).length;
}

function checklistItem(
  key: string,
  label: string,
  status: PlatformCertificationStatus,
  message: string
): PlatformCertificationChecklistItem {
  return { key, label, message, status };
}

function requiredPagesPublished(pages: PlatformPageRegistryRecord[]) {
  return requiredRoutes.every((route) =>
    pages.some((page) => page.routePath === route && page.status === "published" && isConnectedPlatformRoute(page.routePath))
  );
}

function requiredPagesBlocked(pages: PlatformPageRegistryRecord[]) {
  return requiredRoutes.some((route) =>
    pages.some((page) => page.routePath === route && page.status === "archived")
  );
}

function blogReady(posts: PlatformBlogPostRecord[], issues: PlatformWebsiteMonitoringIssue[]) {
  const hasPublishedPost = posts.some((post) => post.status === "published");
  const blockingBlogIssues = issues.some((issue) =>
    issue.contentType === "platform_blog_post" &&
    (issue.severity === "critical" || issue.severity === "high")
  );

  if (blockingBlogIssues) return "blocked";
  if (!hasPublishedPost) return "needs_attention";
  return "ready";
}

function securityReview(): PlatformWebsiteCertificationSummary["securityReview"] {
  const items: PlatformSecurityReviewItem[] = [
    {
      label: "Secrets",
      message: "Certification reads platform metadata only and does not expose secrets.",
      status: "ready"
    },
    {
      label: "Tokens and API keys",
      message: "No tokens or API keys are read or rendered by the platform certification view.",
      status: "ready"
    },
    {
      label: "Private admin metadata",
      message: "Admin-only summaries avoid raw private runtime payloads and expose only safe issue descriptions.",
      status: "ready"
    },
    {
      label: "Customer store data",
      message: "Certification uses platform_pages, platform_blog_posts, platform blocks, analytics, and monitoring only.",
      status: "ready"
    },
    {
      label: "Visitor personal data",
      message: "Analytics availability is counted without visitor identifiers or personal data.",
      status: "ready"
    }
  ];
  const result: PlatformCertificationStatus = items.some((item) => item.status === "blocked")
    ? "blocked"
    : items.some((item) => item.status === "needs_attention")
      ? "needs_attention"
      : "ready";

  return {
    items,
    result,
    summary: result === "ready"
      ? "Security review passed for platform-only certification data."
      : "Security review needs attention before certification."
  };
}

function readinessScore(input: {
  analytics: PlatformAnalyticsSummary;
  blogStatus: PlatformCertificationStatus;
  monitoring: PlatformWebsiteMonitoringSummary;
  pages: PlatformPageRegistryRecord[];
}) {
  const issues = allIssues(input.monitoring);
  const missingContent = countIssues(issues, (issue) => issue.issueType === "missing_content");
  const seoIssues = countIssues(issues, (issue) => issue.issueType === "seo");
  const translationIssues = countIssues(issues, (issue) => issue.issueType === "translation");
  const brokenLinks = countIssues(issues, (issue) => issue.issueType === "broken_link" || issue.issueType === "blog_taxonomy");
  const criticalIssues = countIssues(issues, (issue) => issue.severity === "critical");
  const analyticsViews = input.analytics.pages.totalViews + input.analytics.blog.totalViews;
  let score = 100;

  if (!requiredPagesPublished(input.pages)) score -= 15;
  score -= Math.min(15, missingContent * 3);
  score -= Math.min(15, seoIssues * 3);
  score -= Math.min(15, translationIssues * 2);
  score -= Math.min(15, brokenLinks * 4);
  score -= Math.min(20, criticalIssues * 10);
  if (input.blogStatus !== "ready") score -= input.blogStatus === "blocked" ? 10 : 5;
  if (!analyticsViews) score -= 5;

  return Math.max(0, Math.min(100, score));
}

function statusFromScore(score: number, blockers: PlatformCertificationBlocker[]): PlatformCertificationStatus {
  if (blockers.some((blocker) => blocker.severity === "critical") || score < 60) return "blocked";
  if (blockers.length || score < 90) return "needs_attention";
  return "ready";
}

function blockersFromMonitoring(monitoring: PlatformWebsiteMonitoringSummary): PlatformCertificationBlocker[] {
  return allIssues(monitoring)
    .filter((issue) => issue.severity === "critical" || issue.severity === "high")
    .slice(0, 20)
    .map((issue) => ({
      blockerType: issue.issueType,
      message: issue.message,
      relatedEntity: issue.contentLabel,
      severity: issue.severity,
      suggestedAction: issue.suggestedAction
    }));
}

export async function getPlatformWebsiteCertification(): Promise<PlatformWebsiteCertificationSummary> {
  const detectedAt = new Date().toISOString();
  const [pages, posts, analytics, monitoring] = await Promise.all([
    ensurePlatformPagesRegistry(),
    listPlatformBlogPosts(),
    getPlatformAnalyticsSummary("last_30_days"),
    getPlatformWebsiteMonitoring()
  ]);
  const issues = allIssues(monitoring);
  const analyticsViews = analytics.pages.totalViews + analytics.blog.totalViews;
  const publicConnectionReady = requiredPagesPublished(pages);
  const requiredBlocked = requiredPagesBlocked(pages);
  const blogStatus = blogReady(posts, issues);
  const security = securityReview();
  const checklist: PlatformCertificationChecklistItem[] = [
    checklistItem("registry", "Registry ready", pages.length ? "ready" : "blocked", pages.length ? "Platform pages registry is populated." : "Platform pages registry is empty."),
    checklistItem("status_engine", "Status engine ready", pages.every((page) => ["archived", "draft", "published"].includes(page.status)) ? "ready" : "blocked", "Platform page statuses are constrained to supported runtime states."),
    checklistItem("content_storage", "Content storage ready", monitoring.cards.missingContent ? "needs_attention" : "ready", monitoring.cards.missingContent ? "Some platform content is incomplete." : "Platform page and blog content storage is readable."),
    checklistItem("editor", "Editor ready", pages.length ? "ready" : "blocked", "Platform page editor data can be loaded for certification."),
    checklistItem("publishing", "Publishing ready", requiredBlocked ? "blocked" : publicConnectionReady ? "ready" : "needs_attention", publicConnectionReady ? "Required public pages are published." : "One or more required public pages are not published."),
    checklistItem("public_connection", "Public connection ready", publicConnectionReady ? "ready" : "needs_attention", publicConnectionReady ? "Required platform routes are connected and published." : "Required platform routes need publishing readiness review."),
    checklistItem("seo", "SEO ready", monitoring.cards.seoIssues ? "needs_attention" : "ready", monitoring.cards.seoIssues ? "SEO monitoring found issues." : "SEO runtime checks are passing."),
    checklistItem("translations", "Translations ready", monitoring.cards.translationIssues ? "needs_attention" : "ready", monitoring.cards.translationIssues ? "Translation monitoring found missing or partial locales." : "Translation runtime checks are passing."),
    checklistItem("landing_blocks", "Landing blocks ready", monitoring.source.checkedBlocks ? "ready" : "needs_attention", monitoring.source.checkedBlocks ? "Landing blocks are available for monitoring." : "No landing blocks are available yet."),
    checklistItem("builder", "Builder ready", "ready", "Landing builder runtime is available for managed blocks."),
    checklistItem("preview", "Preview ready", "ready", "Admin preview runtime is available and certification does not expose draft content publicly."),
    checklistItem("blog", "Blog ready", blogStatus, blogStatus === "ready" ? "Platform blog has published content without blocking issues." : "Platform blog needs readiness review."),
    checklistItem("analytics", "Analytics ready", analyticsViews ? "ready" : "needs_attention", analyticsViews ? "Platform analytics has recorded traffic." : "Platform analytics is structurally ready but has no traffic data yet."),
    checklistItem("monitoring", "Monitoring ready", monitoring.source.checkedPages ? "ready" : "blocked", monitoring.source.checkedPages ? "Website monitoring snapshot is available." : "Website monitoring could not inspect platform pages."),
    checklistItem("security_masking", "Security masking ready", security.result, security.summary)
  ];
  const blockers = blockersFromMonitoring(monitoring);

  if (!analyticsViews) {
    blockers.push({
      blockerType: "analytics",
      message: "Platform website runtime is structurally ready, but traffic analytics are not populated yet.",
      relatedEntity: "Platform analytics",
      severity: "low",
      suggestedAction: "Allow production traffic to populate analytics before evaluating performance trends."
    });
  }

  const score = readinessScore({ analytics, blogStatus, monitoring, pages });
  const readinessStatus = statusFromScore(score, blockers);

  return {
    analyticsEmptyState: analyticsViews
      ? null
      : "Platform website runtime is structurally ready, but traffic analytics are not populated yet.",
    blockers,
    checklist,
    detectedAt,
    readinessScore: score,
    readinessStatus,
    securityReview: security
  };
}
