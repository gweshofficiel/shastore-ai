"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspaceForUser } from "@/lib/workspaces/active-workspace";
import { assertStoreAccessInWorkspace } from "@/lib/workspaces/data-access";

const mediaBucket = "product-images";
const maxMediaFileSize = 8 * 1024 * 1024;
const allowedMediaMimeTypes = new Set([
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/svg+xml",
  "image/webp",
  "image/x-icon"
]);

function cleanText(value: FormDataEntryValue | null, maxLength = 500) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function mediaRedirect(storeId: string, status: string): never {
  redirect(`/dashboard/stores/${encodeURIComponent(storeId)}?media=${encodeURIComponent(status)}#media-library`);
}

function mediaFailureRedirect(
  storeId: string,
  status: string,
  error: { code?: string | null; details?: string | null; hint?: string | null; message?: string | null }
): never {
  const message = error.message || "Media action failed.";
  console.error("[media-library] action failed", {
    code: error.code,
    details: error.details,
    hint: error.hint,
    message,
    status,
    storeId
  });
  redirect(
    `/dashboard/stores/${encodeURIComponent(storeId)}?media=${encodeURIComponent(status)}&mediaError=${encodeURIComponent(message.slice(0, 280))}#media-library`
  );
}

function safeExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
}

function usageType(value: string) {
  if (value === "logo" || value === "favicon" || value === "product" || value === "theme") {
    return value;
  }

  return "library";
}

async function requireStoreMediaContext(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/dashboard/stores");
  }

  const storeId = cleanText(formData.get("storeId"), 80);

  if (!storeId) {
    redirect("/dashboard/stores?error=Store%20not%20found.");
  }

  const selection = await getActiveWorkspaceForUser({ supabase, userId: user.id });
  const workspaceId = selection.activeWorkspaceId;
  const access = await assertStoreAccessInWorkspace({
    permission: "edit_store",
    storeId,
    supabase,
    userId: user.id,
    workspaceId
  });

  if (!access.allowed || !access.store) {
    mediaRedirect(storeId, "not-authorized");
  }

  return { store: access.store, storeId, supabase, user, workspaceId };
}

async function recordMediaLog({
  action,
  mediaId,
  storeId,
  workspaceId
}: {
  action: string;
  mediaId?: string | null;
  storeId: string;
  workspaceId: string;
}) {
  const admin = createAdminClient();

  if (!admin) {
    return;
  }

  const { error } = await admin.from("media_logs" as never).insert({
    action,
    media_id: mediaId ?? null,
    store_id: storeId,
    workspace_id: workspaceId
  } as never);

  if (error) {
    console.warn("[media-library] log insert failed", {
      action,
      code: error.code,
      message: error.message,
      storeId
    });
  }
}

export async function uploadStoreMediaAction(formData: FormData) {
  const { storeId, supabase, user, workspaceId } = await requireStoreMediaContext(formData);
  const file = formData.get("mediaFile");
  const requestedUsageType = usageType(cleanText(formData.get("usageType"), 40));

  if (!(file instanceof File) || file.size === 0) {
    mediaRedirect(storeId, "missing-file");
  }

  if (!allowedMediaMimeTypes.has(file.type) || file.size > maxMediaFileSize) {
    mediaRedirect(storeId, "invalid-file");
  }

  const extension = safeExtension(file.name);
  const storageKey = `${user.id}/store-media/${storeId}/${requestedUsageType}-${randomUUID()}.${extension}`;
  const { error: uploadError } = await supabase.storage.from(mediaBucket).upload(storageKey, file, {
    cacheControl: "31536000",
    contentType: file.type,
    upsert: false
  });

  if (uploadError) {
    console.error("[media-library] upload failed", {
      bucket: mediaBucket,
      message: uploadError.message,
      storageKey,
      storeId
    });
    mediaFailureRedirect(storeId, "upload-failed", uploadError);
  }

  const {
    data: { publicUrl }
  } = supabase.storage.from(mediaBucket).getPublicUrl(storageKey);

  const client = createAdminClient() ?? supabase;
  const { data: mediaRow, error: insertError } = await client
    .from("store_media" as never)
    .insert({
      created_by: user.id,
      file_name: file.name.slice(0, 240),
      file_type: "image",
      file_url: publicUrl,
      mime_type: file.type,
      size_bytes: file.size,
      storage_key: storageKey,
      store_id: storeId,
      usage_type: requestedUsageType,
      workspace_id: workspaceId
    } as never)
    .select("id")
    .maybeSingle();

  if (insertError) {
    await supabase.storage.from(mediaBucket).remove([storageKey]);
    mediaFailureRedirect(storeId, "save-failed", insertError);
  }

  await recordMediaLog({
    action: "uploaded",
    mediaId: (mediaRow as { id?: string | null } | null)?.id,
    storeId,
    workspaceId
  });

  revalidatePath(`/dashboard/stores/${storeId}`);
  mediaRedirect(storeId, "uploaded");
}

export async function deleteStoreMediaAction(formData: FormData) {
  const { storeId, supabase, workspaceId } = await requireStoreMediaContext(formData);
  const mediaId = cleanText(formData.get("mediaId"), 80);
  const confirmed = formData.get("confirmDelete") === "true";

  if (!mediaId) {
    mediaRedirect(storeId, "delete-failed");
  }

  const client = createAdminClient() ?? supabase;
  const { data: media, error: mediaError } = await client
    .from("store_media" as never)
    .select("id, file_url, storage_key")
    .eq("id" as never, mediaId as never)
    .eq("store_id" as never, storeId as never)
    .eq("workspace_id" as never, workspaceId as never)
    .maybeSingle();

  if (mediaError || !media) {
    mediaFailureRedirect(storeId, "delete-failed", mediaError ?? { message: "Media record was not found." });
  }

  const mediaRecord = media as { file_url?: string | null; id: string; storage_key?: string | null };
  const [{ count: productCount }, { count: themeCount }] = await Promise.all([
    client
      .from("store_products" as never)
      .select("id", { count: "exact", head: true })
      .eq("store_id" as never, storeId as never)
      .eq("workspace_id" as never, workspaceId as never)
      .eq("image_url" as never, mediaRecord.file_url as never),
    client
      .from("store_theme_settings" as never)
      .select("store_id", { count: "exact", head: true })
      .eq("store_id" as never, storeId as never)
      .contains("settings" as never, { logoUrl: mediaRecord.file_url } as never)
  ]);

  if (!confirmed && ((productCount ?? 0) > 0 || (themeCount ?? 0) > 0)) {
    mediaRedirect(storeId, "in-use");
  }

  if (mediaRecord.storage_key) {
    await supabase.storage.from(mediaBucket).remove([mediaRecord.storage_key]);
  }

  const { error: deleteError } = await client
    .from("store_media" as never)
    .delete()
    .eq("id" as never, mediaRecord.id as never)
    .eq("store_id" as never, storeId as never)
    .eq("workspace_id" as never, workspaceId as never);

  if (deleteError) {
    mediaFailureRedirect(storeId, "delete-failed", deleteError);
  }

  await recordMediaLog({ action: "deleted", mediaId, storeId, workspaceId });

  revalidatePath(`/dashboard/stores/${storeId}`);
  mediaRedirect(storeId, "deleted");
}
