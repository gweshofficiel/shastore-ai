import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureTemplateRegistry, listTemplates } from "@/src/lib/templates/template-registry";
import { getPublishedTemplateVersion } from "@/src/lib/templates/template-versions";

export type TemplatePackageReadinessStatus = "draft" | "invalid" | "needs_attention" | "ready";

export type TemplatePackageTriState = boolean | "unknown";

export type TemplatePackageContents = {
  ai_support_enabled: boolean;
  blog_posts_count: number;
  categories_count: number;
  checkout_ready: TemplatePackageTriState;
  domain_ready: boolean;
  faq_count: number;
  navigation_ready: TemplatePackageTriState;
  pages_count: number;
  products_count: number;
  theme_ready: TemplatePackageTriState;
};

export type TemplatePackageRecord = {
  contents: TemplatePackageContents;
  createdAt: string | null;
  id: string;
  packageKey: string;
  packageName: string;
  packageSummary: Record<string, unknown>;
  readinessStatus: TemplatePackageReadinessStatus;
  templateId: string;
  updatedAt: string | null;
  versionId: string | null;
};

export type TemplatePackageValidation = {
  issues: string[];
  ready: boolean;
  valid: boolean;
};

export type TemplatePackageStats = {
  draftPackages: number;
  invalidPackages: number;
  needsAttentionPackages: number;
  readyPackages: number;
  totalPackages: number;
};

export type UpdateTemplatePackageMetadataInput = {
  contents?: Partial<TemplatePackageContents>;
  packageName?: string;
};

type TemplatePackageRow = {
  contents?: unknown;
  created_at?: string | null;
  id?: string | null;
  package_key?: string | null;
  package_name?: string | null;
  package_summary?: unknown;
  readiness_status?: string | null;
  template_id?: string | null;
  updated_at?: string | null;
  version_id?: string | null;
};

const readinessStatuses: TemplatePackageReadinessStatus[] = ["draft", "ready", "needs_attention", "invalid"];

const packageSelect =
  "id, template_id, version_id, package_key, package_name, package_summary, contents, readiness_status, created_at, updated_at";

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

function safeRecord(value: unknown) {
  return isRecord(value) ? value : {};
}

function parseCount(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

function parseTriState(value: unknown): TemplatePackageTriState {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return "unknown";
}

function parseReadinessStatus(value: unknown): TemplatePackageReadinessStatus {
  const cleaned = text(value, 40);
  return readinessStatuses.includes(cleaned as TemplatePackageReadinessStatus)
    ? (cleaned as TemplatePackageReadinessStatus)
    : "draft";
}

function parseContents(value: unknown): TemplatePackageContents {
  const record = safeRecord(value);

  return {
    ai_support_enabled: record.ai_support_enabled === true,
    blog_posts_count: parseCount(record.blog_posts_count),
    categories_count: parseCount(record.categories_count),
    checkout_ready: parseTriState(record.checkout_ready),
    domain_ready: record.domain_ready === true,
    faq_count: parseCount(record.faq_count),
    navigation_ready: parseTriState(record.navigation_ready),
    pages_count: parseCount(record.pages_count),
    products_count: parseCount(record.products_count),
    theme_ready: parseTriState(record.theme_ready)
  };
}

function contentsFromRegistrySummary(summary: Record<string, unknown>): TemplatePackageContents {
  return {
    ai_support_enabled: summary.aiVisualSupport === true,
    blog_posts_count: parseCount(summary.blogCount),
    categories_count: parseCount(summary.categoriesCount),
    checkout_ready: "unknown",
    domain_ready: text(summary.domainEmailReadiness, 40) === "ready",
    faq_count: parseCount(summary.faqCount),
    navigation_ready: "unknown",
    pages_count: parseCount(summary.pagesCount),
    products_count: parseCount(summary.productsCount),
    theme_ready: "unknown"
  };
}

function registrySummaryFromContents(contents: TemplatePackageContents) {
  return {
    aiVisualSupport: contents.ai_support_enabled,
    blogCount: contents.blog_posts_count,
    categoriesCount: contents.categories_count,
    domainEmailReadiness: contents.domain_ready ? "ready" : "placeholder",
    faqCount: contents.faq_count,
    pagesCount: contents.pages_count,
    productsCount: contents.products_count
  };
}

function triStateReady(value: TemplatePackageTriState) {
  return value === true || value === "unknown";
}

function parseRecord(row: unknown): TemplatePackageRecord | null {
  if (!isRecord(row)) return null;

  const value = row as TemplatePackageRow;
  const id = text(value.id, 120);
  const templateId = text(value.template_id, 120);
  const packageKey = text(value.package_key, 120);
  const packageName = text(value.package_name, 240);

  if (!id || !templateId || !packageKey || !packageName) return null;

  return {
    contents: parseContents(value.contents),
    createdAt: text(value.created_at, 80) || null,
    id,
    packageKey,
    packageName,
    packageSummary: safeRecord(value.package_summary) as Record<string, unknown>,
    readinessStatus: parseReadinessStatus(value.readiness_status),
    templateId,
    updatedAt: text(value.updated_at, 80) || null,
    versionId: text(value.version_id, 120) || null
  };
}

async function requireSuperAdmin() {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can access template package runtime.");
  }

  return access;
}

function requireAdminClient() {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for template package runtime.");
  }

  return admin;
}

function computeReadinessStatus(validation: TemplatePackageValidation): TemplatePackageReadinessStatus {
  if (!validation.valid) return "invalid";
  if (validation.ready) return "ready";
  if (validation.issues.length) return "needs_attention";
  return "draft";
}

export async function validateTemplatePackage(templateId: string): Promise<TemplatePackageValidation> {
  await requireSuperAdmin();
  await ensureTemplateRegistry();

  const cleanedTemplateId = text(templateId, 120);
  const issues: string[] = [];

  if (!cleanedTemplateId) {
    return { issues: ["Template id is required."], ready: false, valid: false };
  }

  const templates = await listTemplates();
  const template = templates.find((item) => item.id === cleanedTemplateId);

  if (!template) {
    return { issues: ["Template registry record was not found."], ready: false, valid: false };
  }

  if (template.status === "archived") {
    issues.push("Archived templates cannot have a ready package runtime.");
  }

  const publishedVersion = await getPublishedTemplateVersion(template.id);

  if (!publishedVersion) {
    issues.push("A published template version is required for package readiness.");
  }

  const pkg = await getTemplatePackage(template.id);
  const summary = pkg?.packageSummary ?? template.packageSummary;
  const contents = pkg?.contents ?? contentsFromRegistrySummary(safeRecord(summary) as Record<string, unknown>);

  if (!isRecord(summary) || !Object.keys(summary).length) {
    issues.push("Package summary metadata is required.");
  }

  if (contents.pages_count <= 0) {
    issues.push("At least one page is required for package readiness.");
  }

  if (!triStateReady(contents.theme_ready)) {
    issues.push("Theme readiness must be true or explicitly unknown.");
  }

  if (!triStateReady(contents.navigation_ready)) {
    issues.push("Navigation readiness must be true or explicitly unknown.");
  }

  const ready =
    template.status !== "archived" &&
    Boolean(publishedVersion) &&
    isRecord(summary) &&
    Object.keys(summary).length > 0 &&
    contents.pages_count > 0 &&
    triStateReady(contents.theme_ready) &&
    triStateReady(contents.navigation_ready);

  return {
    issues,
    ready,
    valid: template.status !== "archived"
  };
}

async function seedMissingPackages() {
  const admin = requireAdminClient();
  const templates = await listTemplates();
  const { data, error } = await admin.from("template_packages" as never).select("template_id, package_key");

  if (error) {
    throw new Error(`Template packages could not be inspected: ${error.message}`);
  }

  const existingKeys = new Set(
    (Array.isArray(data) ? (data as unknown[]) : [])
      .map((row) => {
        const record = safeRecord(row);
        const templateId = text(record.template_id, 120);
        const packageKey = text(record.package_key, 120);
        return templateId && packageKey ? `${templateId}:${packageKey}` : "";
      })
      .filter(Boolean)
  );

  const missing = [];

  for (const template of templates) {
    const packageKey = `${template.templateKey}-package`;
    const key = `${template.id}:${packageKey}`;

    if (existingKeys.has(key)) continue;

    const publishedVersion = await getPublishedTemplateVersion(template.id);
    const contents = contentsFromRegistrySummary(template.packageSummary as unknown as Record<string, unknown>);
    const readinessStatus: TemplatePackageReadinessStatus =
      template.status === "archived"
        ? "invalid"
        : contents.pages_count > 0 && publishedVersion
          ? "ready"
          : contents.pages_count > 0
            ? "needs_attention"
            : "draft";

    missing.push({
      contents,
      package_key: packageKey,
      package_name: `${template.name} Package`,
      package_summary: registrySummaryFromContents(contents),
      readiness_status: readinessStatus,
      template_id: template.id,
      version_id: publishedVersion?.id ?? null
    });
  }

  if (!missing.length) return;

  const { error: insertError } = await admin.from("template_packages" as never).insert(missing as never);

  if (insertError) {
    throw new Error(`Template packages could not be seeded: ${insertError.message}`);
  }
}

async function ensureTemplatePackages() {
  await requireSuperAdmin();
  await ensureTemplateRegistry();
  await seedMissingPackages();
}

async function loadAllPackages(): Promise<TemplatePackageRecord[]> {
  await ensureTemplatePackages();

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("template_packages" as never)
    .select(packageSelect)
    .order("updated_at" as never, { ascending: false });

  if (error) {
    throw new Error(`Template packages could not be loaded: ${error.message}`);
  }

  return (Array.isArray(data) ? (data as unknown[]) : [])
    .map((row) => parseRecord(row))
    .filter((pkg): pkg is TemplatePackageRecord => Boolean(pkg));
}

export async function getTemplatePackage(templateId: string): Promise<TemplatePackageRecord | null> {
  const cleanedTemplateId = text(templateId, 120);

  if (!cleanedTemplateId) return null;

  const packages = await loadAllPackages();
  return packages.find((pkg) => pkg.templateId === cleanedTemplateId) ?? null;
}

export async function listTemplatePackages(): Promise<TemplatePackageRecord[]> {
  return loadAllPackages();
}

export async function updateTemplatePackageMetadata(templateId: string, input: UpdateTemplatePackageMetadataInput) {
  await requireSuperAdmin();

  const template = (await listTemplates()).find((item) => item.id === text(templateId, 120));

  if (!template) {
    throw new Error("Template registry record was not found.");
  }

  const existing = await getTemplatePackage(template.id);

  if (!existing) {
    throw new Error("Template package record was not found.");
  }

  const nextContents: TemplatePackageContents = {
    ...existing.contents,
    ...(input.contents ?? {})
  };
  const nextPackageName = text(input.packageName, 240) || existing.packageName;
  const nextSummary = registrySummaryFromContents(nextContents);
  const validation = await validateTemplatePackage(template.id);
  const readinessStatus = computeReadinessStatus({
    ...validation,
    ready:
      validation.ready &&
      nextContents.pages_count > 0 &&
      triStateReady(nextContents.theme_ready) &&
      triStateReady(nextContents.navigation_ready)
  });
  const publishedVersion = await getPublishedTemplateVersion(template.id);

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("template_packages" as never)
    .update({
      contents: nextContents,
      package_name: nextPackageName,
      package_summary: nextSummary,
      readiness_status: readinessStatus,
      version_id: publishedVersion?.id ?? existing.versionId
    } as never)
    .eq("id" as never, existing.id as never)
    .select(packageSelect)
    .single();

  if (error) {
    throw new Error(`Template package metadata could not be updated: ${error.message}`);
  }

  const parsed = parseRecord(data);

  if (!parsed) {
    throw new Error("Updated template package could not be parsed.");
  }

  if (template.status !== "archived") {
    const { error: registryError } = await admin
      .from("template_registry" as never)
      .update({ package_summary: nextSummary } as never)
      .eq("id" as never, template.id as never);

    if (registryError) {
      throw new Error(`Template registry package summary could not be synced: ${registryError.message}`);
    }
  }

  return {
    package: parsed,
    validation: await validateTemplatePackage(template.id)
  };
}

export async function getTemplatePackageStats(): Promise<TemplatePackageStats> {
  const packages = await loadAllPackages();

  return {
    draftPackages: packages.filter((pkg) => pkg.readinessStatus === "draft").length,
    invalidPackages: packages.filter((pkg) => pkg.readinessStatus === "invalid").length,
    needsAttentionPackages: packages.filter((pkg) => pkg.readinessStatus === "needs_attention").length,
    readyPackages: packages.filter((pkg) => pkg.readinessStatus === "ready").length,
    totalPackages: packages.length
  };
}
