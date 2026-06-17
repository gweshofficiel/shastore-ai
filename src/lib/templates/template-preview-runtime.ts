import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import {
  getTemplatePackage,
  type TemplatePackageContents,
  type TemplatePackageReadinessStatus
} from "@/src/lib/templates/template-package-runtime";
import {
  listTemplates,
  type TemplateRegistryPackageSummary,
  type TemplateRegistryRecord,
  type TemplateRegistryStatus,
  type TemplateRegistryVisibility
} from "@/src/lib/templates/template-registry";
import { getPublishedTemplateVersion } from "@/src/lib/templates/template-versions";
import {
  listPublishedTemplateScreenshots,
  screenshotTypeLabel
} from "@/src/lib/templates/template-screenshot-storage";

export type TemplatePreviewReadiness = "invalid" | "needs_attention" | "ready";

export type TemplatePreviewScreenshot = {
  gradient: string;
  imageUrl: string | null;
  label: string;
};

export type TemplatePreviewMockSectionKind =
  | "blog"
  | "categories"
  | "checkout"
  | "faq"
  | "hero"
  | "navigation"
  | "pages"
  | "products";

export type TemplatePreviewMockSection = {
  id: string;
  itemCount: number;
  kind: TemplatePreviewMockSectionKind;
  label: string;
};

export type TemplatePreviewModel = {
  badges: {
    labels: string[];
    official: boolean;
    premium: boolean;
    recommended: boolean;
  };
  category: string | null;
  industry: string | null;
  mockSections: TemplatePreviewMockSection[];
  name: string;
  package: {
    contents: TemplatePackageContents;
    packageKey: string;
    packageName: string;
    readinessStatus: TemplatePackageReadinessStatus | "missing";
    summary: TemplateRegistryPackageSummary;
  };
  previewReadiness: TemplatePreviewReadiness;
  readinessIssues: string[];
  registryId: string;
  screenshots: TemplatePreviewScreenshot[];
  slug: string;
  status: TemplateRegistryStatus;
  storeTemplateId: string | null;
  templateKey: string;
  version: {
    number: string;
    publishedAt: string | null;
    status: string | null;
  };
  visibility: TemplateRegistryVisibility;
};

export type TemplatePreview = {
  generatedAt: string;
  model: TemplatePreviewModel;
};

const categoryGradients: Record<string, string[]> = {
  beauty: [
    "linear-gradient(135deg,#fff1f2,#fb7185 52%,#881337)",
    "linear-gradient(135deg,#fdf2f8,#f472b6 48%,#831843)"
  ],
  electronics: [
    "linear-gradient(135deg,#0f172a,#2563eb 52%,#020617)",
    "linear-gradient(135deg,#111827,#38bdf8 48%,#0c4a6e)"
  ],
  fashion: [
    "linear-gradient(135deg,#18181b,#a855f7 50%,#3b0764)",
    "linear-gradient(135deg,#faf5ff,#c084fc 45%,#581c87)"
  ],
  food: [
    "linear-gradient(135deg,#431407,#ea580c 50%,#7c2d12)",
    "linear-gradient(135deg,#fff7ed,#fb923c 48%,#9a3412)"
  ],
  general: [
    "linear-gradient(135deg,#f8fafc,#2563eb 52%,#020617)",
    "linear-gradient(135deg,#0f172a,#64748b 48%,#1e293b)"
  ],
  jewelry: [
    "linear-gradient(135deg,#080705,#c6a15b 48%,#f7f3ea)",
    "linear-gradient(135deg,#1c1917,#d4af37 50%,#44403c)"
  ],
  "multi-purpose": [
    "linear-gradient(135deg,#0f172a,#2563eb 52%,#020617)",
    "linear-gradient(135deg,#ecfccb,#84cc16 48%,#365314)"
  ],
  perfume: [
    "linear-gradient(135deg,#1e1b4b,#a78bfa 50%,#312e81)",
    "linear-gradient(135deg,#fdf4ff,#e879f9 45%,#701a75)"
  ]
};

const defaultGradients = categoryGradients.general;

function text(value: unknown, maxLength = 500) {
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

function isSafeUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function gradientsForCategory(category: string | null) {
  const key = text(category, 80).toLowerCase();
  return categoryGradients[key] ?? defaultGradients;
}

function storeTemplateIdFromMetadata(metadata: Record<string, unknown>) {
  return text(metadata.storeTemplateId, 120) || null;
}

function contentsFromSummary(summary: TemplateRegistryPackageSummary): TemplatePackageContents {
  return {
    ai_support_enabled: summary.aiVisualSupport,
    blog_posts_count: summary.blogCount,
    categories_count: summary.categoriesCount,
    checkout_ready: "unknown",
    domain_ready: summary.domainEmailReadiness === "ready",
    faq_count: summary.faqCount,
    navigation_ready: "unknown",
    pages_count: summary.pagesCount,
    products_count: summary.productsCount,
    theme_ready: "unknown"
  };
}

function buildMetadataScreenshots(template: TemplateRegistryRecord): TemplatePreviewScreenshot[] {
  const gradients = gradientsForCategory(template.category);
  const metadata = template.metadata;
  const urls: string[] = [];

  const previewImage = text(metadata.previewImage, 500);

  if (previewImage && isSafeUrl(previewImage)) {
    urls.push(previewImage);
  }

  const screenshots = Array.isArray(metadata.screenshots) ? metadata.screenshots : [];

  for (const item of screenshots) {
    if (typeof item === "string" && isSafeUrl(item)) {
      urls.push(item);
      continue;
    }

    if (isRecord(item)) {
      const url = text(item.url, 500);

      if (url && isSafeUrl(url)) {
        urls.push(url);
      }
    }
  }

  const labels = ["Home", "Catalog", "Product detail", "Mobile"];

  if (!urls.length) {
    return labels.map((label, index) => ({
      gradient: gradients[index % gradients.length],
      imageUrl: null,
      label
    }));
  }

  return urls.slice(0, 4).map((url, index) => ({
    gradient: gradients[0],
    imageUrl: url,
    label: labels[index] ?? `Screen ${index + 1}`
  }));
}

async function buildPreviewScreenshots(template: TemplateRegistryRecord): Promise<TemplatePreviewScreenshot[]> {
  const gradients = gradientsForCategory(template.category);

  try {
    const published = await listPublishedTemplateScreenshots(template.id);
    const withUrls = published.filter((screenshot) => screenshot.previewUrl);

    if (withUrls.length) {
      return withUrls.map((screenshot) => ({
        gradient: gradients[0],
        imageUrl: screenshot.previewUrl,
        label: screenshotTypeLabel(screenshot.screenshotType)
      }));
    }
  } catch {
    // Fall back to registry metadata or gradient placeholders.
  }

  return buildMetadataScreenshots(template);
}

function buildMockSections(contents: TemplatePackageContents): TemplatePreviewMockSection[] {
  const sections: TemplatePreviewMockSection[] = [
    { id: "hero", itemCount: 1, kind: "hero", label: "Hero" },
    {
      id: "navigation",
      itemCount: Math.max(3, Math.min(contents.pages_count, 8)),
      kind: "navigation",
      label: "Navigation"
    }
  ];

  if (contents.products_count > 0) {
    sections.push({
      id: "products",
      itemCount: Math.min(contents.products_count, 12),
      kind: "products",
      label: "Products"
    });
  }

  if (contents.categories_count > 0) {
    sections.push({
      id: "categories",
      itemCount: Math.min(contents.categories_count, 8),
      kind: "categories",
      label: "Categories"
    });
  }

  if (contents.pages_count > 0) {
    sections.push({
      id: "pages",
      itemCount: Math.min(contents.pages_count, 6),
      kind: "pages",
      label: "Pages"
    });
  }

  if (contents.blog_posts_count > 0) {
    sections.push({
      id: "blog",
      itemCount: Math.min(contents.blog_posts_count, 4),
      kind: "blog",
      label: "Blog"
    });
  }

  if (contents.faq_count > 0) {
    sections.push({
      id: "faq",
      itemCount: Math.min(contents.faq_count, 5),
      kind: "faq",
      label: "FAQ"
    });
  }

  sections.push({
    id: "checkout",
    itemCount: 1,
    kind: "checkout",
    label: "Checkout"
  });

  return sections;
}

async function requireSuperAdmin() {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can access template preview runtime.");
  }

  return access;
}

async function findRegistryTemplate(identifier: string): Promise<TemplateRegistryRecord | null> {
  const cleaned = text(identifier, 120);

  if (!cleaned) return null;

  const templates = await listTemplates();

  return (
    templates.find(
      (template) =>
        template.id === cleaned ||
        template.slug === cleaned ||
        template.templateKey === cleaned ||
        storeTemplateIdFromMetadata(template.metadata) === cleaned
    ) ?? null
  );
}

export async function validateTemplatePreviewReadiness(templateId: string): Promise<{
  issues: string[];
  readiness: TemplatePreviewReadiness;
}> {
  await requireSuperAdmin();

  const template = await findRegistryTemplate(templateId);

  if (!template) {
    return { issues: ["Template registry record was not found."], readiness: "invalid" };
  }

  const issues: string[] = [];
  const pkg = await getTemplatePackage(template.id);
  const publishedVersion = await getPublishedTemplateVersion(template.id);

  if (template.status === "archived") {
    issues.push("Archived templates have invalid preview readiness.");
    return { issues, readiness: "invalid" };
  }

  if (pkg?.readinessStatus === "invalid") {
    issues.push("Package runtime is invalid.");
    return { issues, readiness: "invalid" };
  }

  if (!publishedVersion) {
    issues.push("A published template version is required for a ready preview.");
  }

  if (template.status !== "active") {
    issues.push(`Template status is ${template.status}.`);
  }

  if (!pkg) {
    issues.push("Template package metadata is missing.");
  } else if (pkg.readinessStatus === "needs_attention") {
    issues.push("Package metadata needs attention.");
  } else if (pkg.readinessStatus === "draft") {
    issues.push("Package metadata is still draft.");
  }

  const ready =
    template.status === "active" && Boolean(publishedVersion) && pkg?.readinessStatus === "ready";

  if (ready) {
    return { issues: [], readiness: "ready" };
  }

  return { issues, readiness: "needs_attention" };
}

export async function buildTemplatePreviewModel(templateId: string): Promise<TemplatePreviewModel | null> {
  await requireSuperAdmin();

  const template = await findRegistryTemplate(templateId);

  if (!template) return null;

  const [pkg, publishedVersion, readiness] = await Promise.all([
    getTemplatePackage(template.id),
    getPublishedTemplateVersion(template.id),
    validateTemplatePreviewReadiness(template.id)
  ]);

  const contents = pkg?.contents ?? contentsFromSummary(template.packageSummary);
  const premium =
    template.badges.includes("premium") ||
    template.badges.includes("ready-to-use") ||
    template.packageSummary.domainEmailReadiness === "ready";

  return {
    badges: {
      labels: template.badges,
      official: template.isOfficial,
      premium,
      recommended: template.isRecommended
    },
    category: template.category,
    industry: template.industry,
    mockSections: buildMockSections(contents),
    name: template.name,
    package: {
      contents,
      packageKey: pkg?.packageKey ?? `${template.templateKey}-package`,
      packageName: pkg?.packageName ?? `${template.name} Package`,
      readinessStatus: pkg?.readinessStatus ?? "missing",
      summary: template.packageSummary
    },
    previewReadiness: readiness.readiness,
    readinessIssues: readiness.issues,
    registryId: template.id,
    screenshots: await buildPreviewScreenshots(template),
    slug: template.slug,
    status: template.status,
    storeTemplateId: storeTemplateIdFromMetadata(template.metadata),
    templateKey: template.templateKey,
    version: {
      number: publishedVersion?.versionNumber ?? template.version,
      publishedAt: publishedVersion?.publishedAt ?? null,
      status: publishedVersion?.status ?? null
    },
    visibility: template.visibility
  };
}

export async function getTemplatePreview(templateId: string): Promise<TemplatePreview | null> {
  await requireSuperAdmin();

  const model = await buildTemplatePreviewModel(templateId);

  if (!model) return null;

  return {
    generatedAt: new Date().toISOString(),
    model
  };
}

export async function getTemplatePreviewBySlug(slug: string): Promise<TemplatePreview | null> {
  await requireSuperAdmin();

  const template = await findRegistryTemplate(slug);

  if (!template) return null;

  return getTemplatePreview(template.id);
}
