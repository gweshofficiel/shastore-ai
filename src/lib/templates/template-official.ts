import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ensureTemplateRegistry,
  listTemplates,
  type TemplateRegistryRecord
} from "@/src/lib/templates/template-registry";
import { getPublishedTemplateVersion } from "@/src/lib/templates/template-versions";

export type TemplateOfficialEligibility = {
  eligible: boolean;
  reasons: string[];
};

export type TemplateOfficialRecord = {
  category: string | null;
  id: string;
  latestPublishedVersion: string | null;
  name: string;
  templateKey: string;
  visibility: string;
};

export type TemplateOfficialStats = {
  officialTemplates: number;
};

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

function parseBadges(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value.map((item) => text(item, 80)).filter(Boolean);
}

function withOfficialBadge(badges: string[], isOfficial: boolean) {
  const nextBadges = badges.filter((badge) => badge !== "official");

  if (isOfficial) {
    nextBadges.unshift("official");
  }

  return nextBadges;
}

function hasPackageSummary(template: TemplateRegistryRecord) {
  return isRecord(template.packageSummary) && Object.keys(template.packageSummary).length > 0;
}

async function requireSuperAdmin() {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can access template official runtime.");
  }

  return access;
}

function requireAdminClient() {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for template official runtime.");
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

export async function validateOfficialTemplateEligibility(templateId: string): Promise<TemplateOfficialEligibility> {
  await requireSuperAdmin();

  const template = await getRegistryTemplate(templateId);
  const reasons: string[] = [];

  if (!template) {
    return {
      eligible: false,
      reasons: ["Template registry record was not found."]
    };
  }

  if (template.status === "archived") {
    reasons.push("Archived templates cannot be marked official.");
  }

  if (template.status !== "active") {
    reasons.push("Only active templates can be marked official.");
  }

  if (!hasPackageSummary(template)) {
    reasons.push("Template package summary is required before marking official.");
  }

  const publishedVersion = await getPublishedTemplateVersion(template.id);

  if (!publishedVersion) {
    reasons.push("A published template version is required before marking official.");
  }

  return {
    eligible: reasons.length === 0,
    reasons
  };
}

export async function markTemplateOfficial(templateId: string) {
  await requireSuperAdmin();

  const template = await getRegistryTemplate(templateId);

  if (!template) {
    throw new Error("Template registry record was not found.");
  }

  const eligibility = await validateOfficialTemplateEligibility(templateId);

  if (!eligibility.eligible) {
    throw new Error(eligibility.reasons[0] ?? "Template is not eligible to be marked official.");
  }

  const nextBadges = withOfficialBadge(template.badges, true);
  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("template_registry" as never)
    .update({
      badges: nextBadges,
      is_official: true
    } as never)
    .eq("id" as never, template.id as never)
    .select("is_official, badges")
    .single();

  if (error) {
    throw new Error(`Template could not be marked official: ${error.message}`);
  }

  const row = data as { badges?: unknown; is_official?: boolean | null };

  return {
    badges: parseBadges(row.badges),
    isOfficial: row.is_official === true,
    previousOfficial: template.isOfficial
  };
}

export async function unmarkTemplateOfficial(templateId: string) {
  await requireSuperAdmin();

  const template = await getRegistryTemplate(templateId);

  if (!template) {
    throw new Error("Template registry record was not found.");
  }

  const nextBadges = withOfficialBadge(template.badges, false);
  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("template_registry" as never)
    .update({
      badges: nextBadges,
      is_official: false
    } as never)
    .eq("id" as never, template.id as never)
    .select("is_official, badges")
    .single();

  if (error) {
    throw new Error(`Template official flag could not be removed: ${error.message}`);
  }

  const row = data as { badges?: unknown; is_official?: boolean | null };

  return {
    badges: parseBadges(row.badges),
    isOfficial: row.is_official === true,
    previousOfficial: template.isOfficial
  };
}

export async function listOfficialTemplates(): Promise<TemplateOfficialRecord[]> {
  await requireSuperAdmin();

  const templates = await listTemplates();
  const officialTemplates = templates.filter((template) => template.isOfficial);

  const records = await Promise.all(
    officialTemplates.map(async (template) => {
      const publishedVersion = await getPublishedTemplateVersion(template.id);

      return {
        category: template.category,
        id: template.id,
        latestPublishedVersion: publishedVersion?.versionNumber ?? null,
        name: template.name,
        templateKey: template.templateKey,
        visibility: template.visibility
      };
    })
  );

  return records.sort((left, right) => left.name.localeCompare(right.name));
}

export async function getOfficialTemplateStats(): Promise<TemplateOfficialStats> {
  await requireSuperAdmin();

  const templates = await listTemplates();

  return {
    officialTemplates: templates.filter((template) => template.isOfficial).length
  };
}
