import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  archivePlatformPage as archivePlatformPageStatus,
  markPlatformPageDraft,
  publishPlatformPage as publishPlatformPageStatus
} from "@/src/lib/platform-website/platform-page-status";
import type { PlatformPageContentStatus, PlatformPageStatus } from "@/src/lib/platform-website/platform-pages-registry";

export type PlatformPublishingReadiness = {
  contentReady: boolean;
  isReady: boolean;
  missingFields: string[];
  routeReady: boolean;
  seoReady: boolean;
};

export type PlatformPublishingWorkflowResult = {
  id: string;
  message: string;
  nextStatus: PlatformPageStatus;
  previousStatus: PlatformPageStatus;
  readiness: PlatformPublishingReadiness;
};

type PlatformPublishingRow = {
  content_status?: string | null;
  id?: string | null;
  route_path?: string | null;
  seo_description?: string | null;
  seo_title?: string | null;
  status?: string | null;
  title?: string | null;
};

function text(value: unknown, maxLength = 240) {
  return typeof value === "string" && value.trim()
    ? value.trim().replace(/\s+/g, " ").slice(0, maxLength)
    : "";
}

function isPlatformPageStatus(value: unknown): value is PlatformPageStatus {
  return value === "archived" || value === "draft" || value === "published";
}

function isContentReady(status: string) {
  return status === "draft_ready" || status === "needs_attention" || status === "ready";
}

async function requireSuperAdmin() {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can manage platform website publishing.");
  }
}

function requireAdminClient() {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for platform website publishing.");
  }

  return admin;
}

async function readPublishingRow(pageId: string) {
  await requireSuperAdmin();
  const id = text(pageId, 120);

  if (!id) {
    throw new Error("Platform page id is required.");
  }

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("platform_pages" as never)
    .select("id, title, route_path, status, content_status, seo_title, seo_description")
    .eq("id" as never, id as never)
    .maybeSingle();

  if (error) {
    throw new Error(`Platform publishing state could not be loaded: ${error.message}`);
  }

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Platform page was not found.");
  }

  return data as PlatformPublishingRow;
}

export async function validatePublishingReadiness(pageId: string): Promise<PlatformPublishingReadiness> {
  const row = await readPublishingRow(pageId);
  const title = text(row.title, 180);
  const routePath = text(row.route_path, 240);
  const contentStatus = text(row.content_status, 40) as PlatformPageContentStatus;
  const seoTitle = text(row.seo_title, 180);
  const seoDescription = text(row.seo_description, 500);
  const missingFields = [
    !title ? "title" : null,
    !routePath ? "route_path" : null,
    !isContentReady(contentStatus) ? "content_status" : null,
    !seoTitle ? "seo_title" : null,
    !seoDescription ? "seo_description" : null
  ].filter((field): field is string => Boolean(field));

  return {
    contentReady: isContentReady(contentStatus),
    isReady: missingFields.length === 0,
    missingFields,
    routeReady: Boolean(routePath),
    seoReady: Boolean(seoTitle && seoDescription)
  };
}

export async function publishPlatformPage(pageId: string): Promise<PlatformPublishingWorkflowResult> {
  const readiness = await validatePublishingReadiness(pageId);

  if (!readiness.isReady) {
    throw new Error(`Cannot publish: missing fields (${readiness.missingFields.join(", ")}).`);
  }

  const result = await publishPlatformPageStatus(pageId);

  return {
    ...result,
    message: "Published",
    readiness
  };
}

export async function archivePlatformPage(pageId: string): Promise<PlatformPublishingWorkflowResult> {
  const row = await readPublishingRow(pageId);
  const previousStatus = isPlatformPageStatus(row.status) ? row.status : "draft";
  const result = await archivePlatformPageStatus(pageId);
  const readiness = await validatePublishingReadiness(pageId);

  return {
    ...result,
    message: "Archived",
    previousStatus,
    readiness
  };
}

export async function revertPlatformPageToDraft(pageId: string): Promise<PlatformPublishingWorkflowResult> {
  const row = await readPublishingRow(pageId);
  const previousStatus = isPlatformPageStatus(row.status) ? row.status : "draft";
  const result = await markPlatformPageDraft(pageId);
  const readiness = await validatePublishingReadiness(pageId);

  return {
    ...result,
    message: "Reverted to draft",
    previousStatus,
    readiness
  };
}
