import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ensureTemplateRegistry,
  listTemplates,
  type TemplateRegistryRecord,
  type TemplateRegistryVisibility
} from "@/src/lib/templates/template-registry";
import { getPublishedTemplateVersion } from "@/src/lib/templates/template-versions";

export type TemplateRecommendationEligibility = {
  eligible: boolean;
  reasons: string[];
  requiresInternalConfirmation: boolean;
};

export type TemplateRecommendationRecord = {
  category: string | null;
  id: string;
  latestPublishedVersion: string | null;
  name: string;
  recommendationOrder: number | null;
  templateKey: string;
  visibility: TemplateRegistryVisibility;
};

export type TemplateRecommendationStats = {
  recommendedTemplates: number;
};

const catalogVisibilities: TemplateRegistryVisibility[] = ["owner", "reseller", "marketplace"];

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

function parseBadges(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value.map((item) => text(item, 80)).filter(Boolean);
}

function withRecommendedBadge(badges: string[], isRecommended: boolean) {
  const nextBadges = badges.filter((badge) => badge !== "recommended");

  if (isRecommended) {
    nextBadges.unshift("recommended");
  }

  return nextBadges;
}

function hasPackageSummary(template: TemplateRegistryRecord) {
  return isRecord(template.packageSummary) && Object.keys(template.packageSummary).length > 0;
}

function readRecommendationOrder(template: TemplateRegistryRecord) {
  const metadata = safeRecord(template.metadata);
  const order = metadata.recommendationOrder;

  if (typeof order === "number" && Number.isFinite(order)) {
    return Math.trunc(order);
  }

  return null;
}

function parseSortOrder(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.trunc(value));
  }

  const parsed = Number.parseInt(text(value, 20), 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : null;
}

async function requireSuperAdmin() {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can access template recommendation runtime.");
  }

  return access;
}

function requireAdminClient() {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for template recommendation runtime.");
  }

  return admin;
}

async function getRegistryTemplate(templateId: string): Promise<TemplateRegistryRecord | null> {
  await ensureTemplateRegistry();

  const cleanedTemplateId = text(templateId, 120);

  if (!cleanedTemplateId) return null;

  const templates = await listTemplates();
  return templates.find((template) => template.id === cleanedTemplateId) ?? null;
}

async function nextRecommendationOrder() {
  const templates = await listTemplates();
  const orders = templates
    .map((template) => readRecommendationOrder(template))
    .filter((order): order is number => typeof order === "number");

  return (orders.length ? Math.max(...orders) : 0) + 10;
}

export async function validateRecommendedTemplateEligibility(
  templateId: string,
  options?: { allowInternalVisibility?: boolean }
): Promise<TemplateRecommendationEligibility> {
  await requireSuperAdmin();

  const template = await getRegistryTemplate(templateId);
  const reasons: string[] = [];

  if (!template) {
    return {
      eligible: false,
      reasons: ["Template registry record was not found."],
      requiresInternalConfirmation: false
    };
  }

  if (template.status === "archived") {
    reasons.push("Archived templates cannot be recommended.");
  }

  if (template.status !== "active") {
    reasons.push("Only active templates can be recommended.");
  }

  if (!hasPackageSummary(template)) {
    reasons.push("Template package summary is required before recommending.");
  }

  const publishedVersion = await getPublishedTemplateVersion(template.id);

  if (!publishedVersion) {
    reasons.push("A published template version is required before recommending.");
  }

  const requiresInternalConfirmation = template.visibility === "internal";

  if (requiresInternalConfirmation && !options?.allowInternalVisibility) {
    reasons.push("Internal-only templates require explicit confirmation before recommendation.");
  }

  if (!catalogVisibilities.includes(template.visibility) && template.visibility !== "internal") {
    reasons.push("Template visibility must be owner, reseller, marketplace, or internal.");
  }

  return {
    eligible: reasons.length === 0,
    reasons,
    requiresInternalConfirmation
  };
}

export async function recommendTemplate(
  templateId: string,
  options?: { allowInternalVisibility?: boolean }
) {
  await requireSuperAdmin();

  const template = await getRegistryTemplate(templateId);

  if (!template) {
    throw new Error("Template registry record was not found.");
  }

  const eligibility = await validateRecommendedTemplateEligibility(templateId, options);

  if (!eligibility.eligible) {
    throw new Error(eligibility.reasons[0] ?? "Template is not eligible to be recommended.");
  }

  const recommendationOrder = readRecommendationOrder(template) ?? (await nextRecommendationOrder());
  const metadata = {
    ...safeRecord(template.metadata),
    recommendationOrder,
    recommendedAt: new Date().toISOString()
  };
  const nextBadges = withRecommendedBadge(template.badges, true);
  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("template_registry" as never)
    .update({
      badges: nextBadges,
      is_recommended: true,
      metadata
    } as never)
    .eq("id" as never, template.id as never)
    .select("badges, is_recommended, metadata")
    .single();

  if (error) {
    throw new Error(`Template could not be recommended: ${error.message}`);
  }

  const row = data as { badges?: unknown; is_recommended?: boolean | null; metadata?: unknown };

  return {
    badges: parseBadges(row.badges),
    isRecommended: row.is_recommended === true,
    previousRecommended: template.isRecommended,
    recommendationOrder: readRecommendationOrder({
      ...template,
      metadata: safeRecord(row.metadata)
    })
  };
}

export async function unrecommendTemplate(templateId: string) {
  await requireSuperAdmin();

  const template = await getRegistryTemplate(templateId);

  if (!template) {
    throw new Error("Template registry record was not found.");
  }

  const metadata = { ...safeRecord(template.metadata) };
  delete metadata.recommendedAt;

  const nextBadges = withRecommendedBadge(template.badges, false);
  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("template_registry" as never)
    .update({
      badges: nextBadges,
      is_recommended: false,
      metadata
    } as never)
    .eq("id" as never, template.id as never)
    .select("badges, is_recommended, metadata")
    .single();

  if (error) {
    throw new Error(`Template recommendation could not be removed: ${error.message}`);
  }

  const row = data as { badges?: unknown; is_recommended?: boolean | null };

  return {
    badges: parseBadges(row.badges),
    isRecommended: row.is_recommended === true,
    previousRecommended: template.isRecommended
  };
}

export async function updateRecommendationOrder(templateId: string, sortOrder: number) {
  await requireSuperAdmin();

  const template = await getRegistryTemplate(templateId);

  if (!template) {
    throw new Error("Template registry record was not found.");
  }

  if (!template.isRecommended) {
    throw new Error("Only recommended templates can have recommendation order updated.");
  }

  const parsedOrder = parseSortOrder(sortOrder);

  if (parsedOrder === null) {
    throw new Error("Recommendation order must be a valid non-negative number.");
  }

  const metadata = {
    ...safeRecord(template.metadata),
    recommendationOrder: parsedOrder
  };

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("template_registry" as never)
    .update({ metadata } as never)
    .eq("id" as never, template.id as never)
    .select("metadata")
    .single();

  if (error) {
    throw new Error(`Recommendation order could not be updated: ${error.message}`);
  }

  const row = data as { metadata?: unknown };

  return {
    previousOrder: readRecommendationOrder(template),
    recommendationOrder: readRecommendationOrder({
      ...template,
      metadata: safeRecord(row.metadata)
    })
  };
}

export async function listRecommendedTemplates(): Promise<TemplateRecommendationRecord[]> {
  await requireSuperAdmin();

  const templates = await listTemplates();
  const recommended = templates.filter((template) => template.isRecommended);

  const records = await Promise.all(
    recommended.map(async (template) => {
      const publishedVersion = await getPublishedTemplateVersion(template.id);

      return {
        category: template.category,
        id: template.id,
        latestPublishedVersion: publishedVersion?.versionNumber ?? null,
        name: template.name,
        recommendationOrder: readRecommendationOrder(template),
        templateKey: template.templateKey,
        visibility: template.visibility
      };
    })
  );

  return records.sort((left, right) => {
    const leftOrder = left.recommendationOrder ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = right.recommendationOrder ?? Number.MAX_SAFE_INTEGER;

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return left.name.localeCompare(right.name);
  });
}

export async function getRecommendedTemplateStats(): Promise<TemplateRecommendationStats> {
  await requireSuperAdmin();

  const templates = await listTemplates();

  return {
    recommendedTemplates: templates.filter((template) => template.isRecommended).length
  };
}
