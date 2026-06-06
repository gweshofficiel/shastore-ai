"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordStoreAuditLogSafe } from "@/lib/audit/store-audit";
import {
  applySafeTemplateUpdateToStoreData,
  getTemplateUpdatePlan
} from "@/lib/storefront/template-update-system";
import {
  assertStoreAccessInWorkspace,
  getWorkspaceDataContext
} from "@/lib/workspaces/data-access";

function cleanStoreId(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim().slice(0, 120) : "";
}

function storePath(storeId: string) {
  return `/dashboard/stores/${encodeURIComponent(storeId)}`;
}

function templateUpdateRedirect(storeId: string, status: string): never {
  redirect(`${storePath(storeId)}?templateUpdate=${encodeURIComponent(status)}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

async function requireTemplateUpdateStore(formData: FormData) {
  const storeId = cleanStoreId(formData.get("storeId"));

  if (!storeId) {
    redirect("/dashboard/stores?error=missing-store");
  }

  const { supabase, user, workspaceId } = await getWorkspaceDataContext({
    permission: "can_edit_stores",
    redirectTo: storePath(storeId)
  });
  const access = await assertStoreAccessInWorkspace({
    permission: "can_edit_stores",
    storeId,
    supabase,
    userId: user.id,
    workspaceId
  });

  if (!access.allowed) {
    templateUpdateRedirect(storeId, "not-authorized");
  }

  const { data, error } = await supabase
    .from("stores" as never)
    .select("id, template_id, store_data")
    .eq("id" as never, storeId as never)
    .eq("workspace_id" as never, workspaceId as never)
    .maybeSingle();

  if (error || !isRecord(data)) {
    templateUpdateRedirect(storeId, "store-missing");
  }

  const store = data as Record<string, unknown>;
  const storeData = isRecord(store.store_data) ? store.store_data : {};
  const templateId = typeof store.template_id === "string" && store.template_id.trim()
    ? store.template_id
    : "legacy-store";
  const plan = getTemplateUpdatePlan({
    fallbackTemplateId: templateId,
    storeData
  });

  return {
    plan,
    storeData,
    storeId,
    supabase,
    user,
    workspaceId
  };
}

export async function checkTemplateUpdateAction(formData: FormData) {
  const { plan, storeId } = await requireTemplateUpdateStore(formData);
  templateUpdateRedirect(storeId, plan.status === "update_available" ? "available" : plan.status);
}

export async function previewTemplateUpdateAction(formData: FormData) {
  const { plan, storeId } = await requireTemplateUpdateStore(formData);
  templateUpdateRedirect(storeId, plan.status === "update_available" ? "preview" : plan.status);
}

export async function applySafeTemplateUpdateAction(formData: FormData) {
  const { plan, storeData, storeId, supabase, user, workspaceId } =
    await requireTemplateUpdateStore(formData);

  if (plan.status !== "update_available") {
    templateUpdateRedirect(storeId, plan.status);
  }

  const now = new Date().toISOString();
  const { nextStoreData, updateRecord } = applySafeTemplateUpdateToStoreData({
    actorUserId: user.id,
    now,
    plan,
    storeData
  });

  if (!updateRecord) {
    templateUpdateRedirect(storeId, "skipped");
  }

  const { error } = await supabase
    .from("stores" as never)
    .update({
      store_data: nextStoreData,
      updated_at: now
    } as never)
    .eq("id" as never, storeId as never)
    .eq("workspace_id" as never, workspaceId as never);

  if (error) {
    templateUpdateRedirect(storeId, "failed");
  }

  await recordStoreAuditLogSafe({
    action: "store_updated",
    actorUserId: user.id,
    metadata: {
      newVersion: updateRecord.newVersion,
      packageId: updateRecord.packageId,
      previousVersion: updateRecord.previousVersion,
      source: "template_update_system",
      updateStatus: updateRecord.updateStatus
    },
    storeId,
    supabase
  });

  revalidatePath(storePath(storeId));
  revalidatePath("/dashboard/stores");
  templateUpdateRedirect(storeId, "applied");
}
