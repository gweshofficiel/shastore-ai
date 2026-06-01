"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  defaultStoreFooterLinkSettings,
  storeFooterLinkOptions,
  type StoreFooterLinkSettings
} from "@/lib/store-footer-links";
import {
  assertStoreAccessInWorkspace,
  getWorkspaceDataContext
} from "@/lib/workspaces/data-access";

const footerLinksPath = "/dashboard/footer-links";

type WorkspaceStoreRow = {
  id: string;
  slug?: string | null;
};

function cleanText(value: FormDataEntryValue | null, maxLength = 4000) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function dashboardRedirect(storeId: string, status: string): never {
  const params = new URLSearchParams({ footer: status, storeId });
  redirect(`${footerLinksPath}?${params.toString()}`);
}

async function requireWorkspaceStore(formData: FormData) {
  const storeId = cleanText(formData.get("storeId"), 80);

  if (!storeId) {
    redirect(`${footerLinksPath}?footer=missing-store`);
  }

  const { supabase, user, workspaceId } = await getWorkspaceDataContext({
    permission: "can_edit_stores",
    redirectTo: footerLinksPath
  });
  const access = await assertStoreAccessInWorkspace({
    permission: "can_edit_stores",
    storeId,
    supabase,
    userId: user.id,
    workspaceId
  });

  if (!access.allowed) {
    dashboardRedirect(storeId, "not-authorized");
  }

  return {
    store: access.store as WorkspaceStoreRow,
    storeId,
    supabase,
    workspaceId
  };
}

function footerSettingsPayload(formData: FormData): StoreFooterLinkSettings {
  return storeFooterLinkOptions.reduce<StoreFooterLinkSettings>(
    (settings, option) => ({
      ...settings,
      [option.key]: formData.get(option.key) === "on"
    }),
    { ...defaultStoreFooterLinkSettings }
  );
}

function revalidateFooterPaths(store: WorkspaceStoreRow) {
  revalidatePath(footerLinksPath);

  if (store.slug) {
    revalidatePath(`/store/${store.slug}`);
  }
}

export async function updateStoreFooterLinkSettings(formData: FormData) {
  const { store, storeId, supabase, workspaceId } = await requireWorkspaceStore(formData);
  const footerLinkSettings = footerSettingsPayload(formData);

  const { error } = await supabase
    .from("stores" as never)
    .update({
      footer_link_settings: footerLinkSettings
    } as never)
    .eq("id" as never, storeId as never)
    .eq("workspace_id" as never, workspaceId as never);

  if (error) {
    dashboardRedirect(storeId, "save-failed");
  }

  revalidateFooterPaths(store);
  dashboardRedirect(storeId, "saved");
}
