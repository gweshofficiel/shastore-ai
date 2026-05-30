"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveWorkspaceForUser } from "@/lib/workspaces/active-workspace";
import { assertStoreAccessInWorkspace } from "@/lib/workspaces/data-access";
import {
  getStoreThemePreset,
  themePresetPayload
} from "@/lib/store-theme-selection";

type ThemeSelectionAction = "activate" | "publish" | "select";

function cleanText(value: FormDataEntryValue | null, maxLength = 120) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function redirectWithThemeStatus(storeId: string, status: string): never {
  redirect(`/dashboard/stores/${encodeURIComponent(storeId)}?theme=${encodeURIComponent(status)}#themes`);
}

async function recordThemeSelectionLog({
  action,
  storeId,
  themeKey,
  workspaceId
}: {
  action: ThemeSelectionAction;
  storeId: string;
  themeKey: string;
  workspaceId: string;
}) {
  const admin = createAdminClient();

  if (!admin) {
    return;
  }

  await Promise.all([
    admin.from("theme_selection_logs" as never).insert({
      action,
      store_id: storeId,
      theme_key: themeKey,
      workspace_id: workspaceId
    } as never),
    admin.from("theme_runtime_logs" as never).insert({
      event: `theme_${action}`,
      message: `Theme ${themeKey} ${action} action completed.`,
      store_id: storeId,
      theme_key: themeKey,
      workspace_id: workspaceId
    } as never)
  ]);
}

async function requireThemeSelectionContext(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/dashboard/stores");
  }

  const storeId = cleanText(formData.get("storeId"), 80);
  const themeKey = cleanText(formData.get("themeKey"), 80);

  if (!storeId || !themeKey) {
    redirect("/dashboard/stores?error=Theme%20selection%20is%20missing.");
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
    redirectWithThemeStatus(storeId, "not-authorized");
  }

  return {
    storeId,
    supabase,
    themeKey,
    userId: user.id,
    workspaceId
  };
}

async function upsertTheme({
  isActive,
  status,
  storeId,
  supabase,
  themeKey,
  userId,
  workspaceId
}: {
  isActive: boolean;
  status: "draft" | "published";
  storeId: string;
  supabase: Awaited<ReturnType<typeof createClient>>;
  themeKey: string;
  userId: string;
  workspaceId: string;
}) {
  const preset = getStoreThemePreset(themeKey);
  const presetPayload = themePresetPayload(preset);
  const now = new Date().toISOString();
  const client = createAdminClient() ?? supabase;

  const { error } = await client.from("store_themes" as never).upsert(
    {
      ...presetPayload,
      is_active: isActive,
      owner_user_id: userId,
      published_at: status === "published" ? now : null,
      status,
      store_id: storeId,
      store_instance_id: storeId,
      theme_id: `shastore-${preset.themeKey}`,
      theme_key: preset.themeKey,
      updated_at: now,
      workspace_id: workspaceId
    } as never,
    { onConflict: "store_id,theme_key" }
  );

  if (error) {
    console.warn("[theme-selection] theme upsert failed", {
      code: error.code,
      message: error.message,
      storeId,
      themeKey
    });
    redirectWithThemeStatus(storeId, "save-failed");
  }
}

export async function selectStoreThemeAction(formData: FormData) {
  const context = await requireThemeSelectionContext(formData);

  await upsertTheme({
    ...context,
    isActive: false,
    status: "draft"
  });
  await recordThemeSelectionLog({
    action: "select",
    storeId: context.storeId,
    themeKey: context.themeKey,
    workspaceId: context.workspaceId
  });

  revalidatePath(`/dashboard/stores/${context.storeId}`);
  redirectWithThemeStatus(context.storeId, "selected");
}

export async function publishStoreThemeAction(formData: FormData) {
  const context = await requireThemeSelectionContext(formData);

  await upsertTheme({
    ...context,
    isActive: false,
    status: "published"
  });
  await recordThemeSelectionLog({
    action: "publish",
    storeId: context.storeId,
    themeKey: context.themeKey,
    workspaceId: context.workspaceId
  });

  revalidatePath(`/dashboard/stores/${context.storeId}`);
  redirectWithThemeStatus(context.storeId, "published");
}

export async function activateStoreThemeAction(formData: FormData) {
  const context = await requireThemeSelectionContext(formData);
  const client = createAdminClient() ?? context.supabase;

  await client
    .from("store_themes" as never)
    .update({ is_active: false } as never)
    .eq("store_id" as never, context.storeId as never)
    .eq("workspace_id" as never, context.workspaceId as never);

  await upsertTheme({
    ...context,
    isActive: true,
    status: "published"
  });
  await recordThemeSelectionLog({
    action: "activate",
    storeId: context.storeId,
    themeKey: context.themeKey,
    workspaceId: context.workspaceId
  });

  revalidatePath(`/dashboard/stores/${context.storeId}`);
  revalidatePath(`/store/${context.storeId}`);
  redirectWithThemeStatus(context.storeId, "activated");
}
