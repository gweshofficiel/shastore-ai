import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ensureTemplateRegistry,
  listTemplates,
  type TemplateRegistryRecord,
  type TemplateRegistryVisibility
} from "@/src/lib/templates/template-registry";

export type TemplateVisibility = TemplateRegistryVisibility;

export type TemplateVisibilityStats = {
  hiddenInternal: number;
  marketplaceVisible: number;
  ownerVisible: number;
  resellerVisible: number;
};

const visibilities: TemplateVisibility[] = ["owner", "reseller", "marketplace", "internal"];

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

function parseVisibility(value: unknown): TemplateVisibility | null {
  const cleaned = text(value, 40);
  return visibilities.includes(cleaned as TemplateVisibility) ? (cleaned as TemplateVisibility) : null;
}

async function requireSuperAdmin() {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can access template visibility.");
  }

  return access;
}

function requireAdminClient() {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for template visibility.");
  }

  return admin;
}

export function validateTemplateVisibility(visibility: string): visibility is TemplateVisibility {
  return parseVisibility(visibility) !== null;
}

export async function getTemplateVisibility(templateId: string): Promise<TemplateVisibility | null> {
  await requireSuperAdmin();
  await ensureTemplateRegistry();

  const cleanedTemplateId = text(templateId, 120);

  if (!cleanedTemplateId) return null;

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("template_registry" as never)
    .select("visibility")
    .eq("id" as never, cleanedTemplateId as never)
    .maybeSingle();

  if (error) {
    throw new Error(`Template visibility could not be loaded: ${error.message}`);
  }

  if (!data || typeof data !== "object") return null;

  return parseVisibility((data as { visibility?: unknown }).visibility);
}

export async function setTemplateVisibility(
  templateId: string,
  visibility: string
): Promise<{ previousVisibility: TemplateVisibility | null; visibility: TemplateVisibility }> {
  await requireSuperAdmin();

  const cleanedTemplateId = text(templateId, 120);
  const nextVisibility = parseVisibility(visibility);

  if (!cleanedTemplateId) {
    throw new Error("Template id is required.");
  }

  if (!nextVisibility) {
    throw new Error("Visibility must be owner, reseller, marketplace, or internal.");
  }

  const previousVisibility = await getTemplateVisibility(cleanedTemplateId);

  if (previousVisibility === nextVisibility) {
    return { previousVisibility, visibility: nextVisibility };
  }

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("template_registry" as never)
    .update({ visibility: nextVisibility } as never)
    .eq("id" as never, cleanedTemplateId as never)
    .select("visibility")
    .single();

  if (error) {
    throw new Error(`Template visibility could not be updated: ${error.message}`);
  }

  const savedVisibility = parseVisibility((data as { visibility?: unknown } | null)?.visibility);

  if (!savedVisibility) {
    throw new Error("Updated template visibility could not be verified.");
  }

  return {
    previousVisibility,
    visibility: savedVisibility
  };
}

export async function listTemplatesByVisibility(visibility: string): Promise<TemplateRegistryRecord[]> {
  await requireSuperAdmin();

  const cleanedVisibility = parseVisibility(visibility);

  if (!cleanedVisibility) {
    throw new Error("Visibility must be owner, reseller, marketplace, or internal.");
  }

  const templates = await listTemplates();
  return templates.filter((template) => template.visibility === cleanedVisibility);
}

export async function getTemplateVisibilityStats(): Promise<TemplateVisibilityStats> {
  await requireSuperAdmin();

  const templates = await listTemplates();

  return {
    hiddenInternal: templates.filter((template) => template.visibility === "internal").length,
    marketplaceVisible: templates.filter((template) => template.visibility === "marketplace").length,
    ownerVisible: templates.filter((template) => template.visibility === "owner").length,
    resellerVisible: templates.filter((template) => template.visibility === "reseller").length
  };
}
