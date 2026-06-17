import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ensureTemplateRegistry,
  listTemplates,
  type TemplateRegistryStatus
} from "@/src/lib/templates/template-registry";

export type TemplateActivationStatus = TemplateRegistryStatus;

export type TemplateActivationStats = {
  activeTemplates: number;
  archivedTemplates: number;
  draftTemplates: number;
};

const statuses: TemplateActivationStatus[] = ["active", "draft", "archived"];

const allowedTransitions: Record<TemplateActivationStatus, TemplateActivationStatus[]> = {
  active: ["draft", "archived"],
  archived: ["draft"],
  draft: ["active", "archived"]
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

function parseStatus(value: unknown): TemplateActivationStatus | null {
  const cleaned = text(value, 40);
  return statuses.includes(cleaned as TemplateActivationStatus) ? (cleaned as TemplateActivationStatus) : null;
}

async function requireSuperAdmin() {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can access template activation.");
  }

  return access;
}

function requireAdminClient() {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for template activation.");
  }

  return admin;
}

export function validateTemplateStatusTransition(currentStatus: string, nextStatus: string) {
  const current = parseStatus(currentStatus);
  const next = parseStatus(nextStatus);

  if (!current || !next) {
    return false;
  }

  if (current === next) {
    return true;
  }

  return allowedTransitions[current].includes(next);
}

async function getTemplateStatus(templateId: string): Promise<TemplateActivationStatus | null> {
  await ensureTemplateRegistry();

  const cleanedTemplateId = text(templateId, 120);

  if (!cleanedTemplateId) return null;

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("template_registry" as never)
    .select("status")
    .eq("id" as never, cleanedTemplateId as never)
    .maybeSingle();

  if (error) {
    throw new Error(`Template status could not be loaded: ${error.message}`);
  }

  if (!data || typeof data !== "object") return null;

  return parseStatus((data as { status?: unknown }).status);
}

async function transitionTemplateStatus(
  templateId: string,
  nextStatus: TemplateActivationStatus
): Promise<{ previousStatus: TemplateActivationStatus | null; status: TemplateActivationStatus }> {
  await requireSuperAdmin();

  const cleanedTemplateId = text(templateId, 120);

  if (!cleanedTemplateId) {
    throw new Error("Template id is required.");
  }

  const previousStatus = await getTemplateStatus(cleanedTemplateId);

  if (!previousStatus) {
    throw new Error("Template status could not be resolved.");
  }

  if (!validateTemplateStatusTransition(previousStatus, nextStatus)) {
    throw new Error(`Invalid template status transition: ${previousStatus} -> ${nextStatus}.`);
  }

  if (previousStatus === nextStatus) {
    return { previousStatus, status: nextStatus };
  }

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("template_registry" as never)
    .update({ status: nextStatus } as never)
    .eq("id" as never, cleanedTemplateId as never)
    .select("status")
    .single();

  if (error) {
    throw new Error(`Template status could not be updated: ${error.message}`);
  }

  const savedStatus = parseStatus((data as { status?: unknown } | null)?.status);

  if (!savedStatus) {
    throw new Error("Updated template status could not be verified.");
  }

  return {
    previousStatus,
    status: savedStatus
  };
}

export async function activateTemplate(templateId: string) {
  return transitionTemplateStatus(templateId, "active");
}

export async function markTemplateDraft(templateId: string) {
  return transitionTemplateStatus(templateId, "draft");
}

export async function archiveTemplate(templateId: string) {
  return transitionTemplateStatus(templateId, "archived");
}

export async function getTemplateActivationStats(): Promise<TemplateActivationStats> {
  await requireSuperAdmin();

  const templates = await listTemplates();

  return {
    activeTemplates: templates.filter((template) => template.status === "active").length,
    archivedTemplates: templates.filter((template) => template.status === "archived").length,
    draftTemplates: templates.filter((template) => template.status === "draft").length
  };
}
