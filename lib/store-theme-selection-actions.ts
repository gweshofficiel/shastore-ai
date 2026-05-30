"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
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
type ThemeSelectionClient = Awaited<ReturnType<typeof createClient>>;

function cleanText(value: FormDataEntryValue | null, maxLength = 120) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function redirectWithThemeStatus(storeId: string, status: string): never {
  redirect(`/dashboard/stores/${encodeURIComponent(storeId)}?theme=${encodeURIComponent(status)}#themes`);
}

function redirectWithThemeSaveError(
  storeId: string,
  error: { code?: string | null; details?: string | null; hint?: string | null; message: string }
): never {
  console.error("[theme-selection] theme save failed", {
    code: error.code,
    details: error.details,
    hint: error.hint,
    message: error.message,
    storeId
  });
  const themeError = encodeURIComponent(error.message.slice(0, 280));
  redirect(
    `/dashboard/stores/${encodeURIComponent(storeId)}?theme=save-failed&themeError=${themeError}#themes`
  );
}

function themeSelectionClient(supabase: ThemeSelectionClient) {
  return createAdminClient() ?? supabase;
}

async function resolveStoreThemeInstanceId(client: SupabaseClient, storeId: string) {
  const { data, error } = await client
    .from("store_instances" as never)
    .select("id")
    .eq("id" as never, storeId as never)
    .maybeSingle();

  if (error) {
    console.warn("[theme-selection] store instance lookup failed", {
      code: error.code,
      message: error.message,
      storeId
    });
    return null;
  }

  return (data as { id?: string | null } | null)?.id ?? null;
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
  supabase: ThemeSelectionClient;
  themeKey: string;
  userId: string;
  workspaceId: string;
}) {
  const preset = getStoreThemePreset(themeKey);
  const presetPayload = themePresetPayload(preset);
  const now = new Date().toISOString();
  const client = themeSelectionClient(supabase);
  const storeInstanceId = await resolveStoreThemeInstanceId(client, storeId);
  const row = {
    ...presetPayload,
    is_active: isActive,
    owner_user_id: userId,
    published_at: status === "published" ? now : null,
    status,
    store_id: storeId,
    theme_id: `shastore-${preset.themeKey}`,
    theme_key: preset.themeKey,
    updated_at: now,
    workspace_id: workspaceId,
    ...(storeInstanceId ? { store_instance_id: storeInstanceId } : {})
  };

  const { error } = await client.from("store_themes" as never).upsert(row as never, {
    onConflict: "store_id,theme_key"
  });

  if (error) {
    redirectWithThemeSaveError(storeId, error);
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
  const client = themeSelectionClient(context.supabase);

  const { error: deactivateError } = await client
    .from("store_themes" as never)
    .update({ is_active: false, updated_at: new Date().toISOString() } as never)
    .eq("store_id" as never, context.storeId as never);

  if (deactivateError) {
    redirectWithThemeSaveError(context.storeId, deactivateError);
  }

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
