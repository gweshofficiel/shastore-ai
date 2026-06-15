import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PlatformPageStatus } from "@/src/lib/platform-website/platform-pages-registry";

type PlatformPageStatusResult = {
  id: string;
  nextStatus: PlatformPageStatus;
  previousStatus: PlatformPageStatus;
};

const platformPageStatuses: PlatformPageStatus[] = ["draft", "published", "archived"];

const allowedTransitions: Record<PlatformPageStatus, PlatformPageStatus[]> = {
  archived: ["draft"],
  draft: ["published", "archived"],
  published: ["draft", "archived"]
};

function isPlatformPageStatus(value: unknown): value is PlatformPageStatus {
  return platformPageStatuses.includes(value as PlatformPageStatus);
}

function cleanId(value: string) {
  return value.trim().slice(0, 120);
}

async function requireSuperAdmin() {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can change platform page status.");
  }

  return access;
}

function requireAdminClient() {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for platform page status changes.");
  }

  return admin;
}

export function validatePlatformPageStatusTransition(currentStatus: unknown, nextStatus: unknown) {
  if (!isPlatformPageStatus(currentStatus) || !isPlatformPageStatus(nextStatus)) {
    return false;
  }

  return allowedTransitions[currentStatus].includes(nextStatus);
}

async function changePlatformPageStatus(pageId: string, nextStatus: PlatformPageStatus): Promise<PlatformPageStatusResult> {
  await requireSuperAdmin();
  const id = cleanId(pageId);

  if (!id) {
    throw new Error("Platform page id is required.");
  }

  const admin = requireAdminClient();
  const { data: existing, error: readError } = await admin
    .from("platform_pages" as never)
    .select("id, status")
    .eq("id" as never, id as never)
    .maybeSingle();

  if (readError) {
    throw new Error(`Platform page status could not be loaded: ${readError.message}`);
  }

  const existingRow = existing as { status?: unknown } | null;
  const currentStatus = typeof existingRow?.status === "string"
    ? existingRow.status
    : null;

  if (!currentStatus) {
    throw new Error("Platform page was not found.");
  }

  if (!validatePlatformPageStatusTransition(currentStatus, nextStatus)) {
    throw new Error(`Invalid platform page status transition: ${currentStatus} -> ${nextStatus}.`);
  }

  const { error: updateError } = await admin
    .from("platform_pages" as never)
    .update({ status: nextStatus } as never)
    .eq("id" as never, id as never);

  if (updateError) {
    throw new Error(`Platform page status could not be updated: ${updateError.message}`);
  }

  return {
    id,
    nextStatus,
    previousStatus: currentStatus as PlatformPageStatus
  };
}

export function publishPlatformPage(pageId: string) {
  return changePlatformPageStatus(pageId, "published");
}

export function markPlatformPageDraft(pageId: string) {
  return changePlatformPageStatus(pageId, "draft");
}

export function archivePlatformPage(pageId: string) {
  return changePlatformPageStatus(pageId, "archived");
}
