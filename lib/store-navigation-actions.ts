"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  standardNavigationHref,
  storefrontStandardNavigationOptions,
  type StorefrontStandardNavigationKey
} from "@/lib/storefront/navigation";
import {
  assertStoreAccessInWorkspace,
  getWorkspaceDataContext
} from "@/lib/workspaces/data-access";

const navigationPath = "/dashboard/navigation";

type WorkspaceStoreRow = {
  id: string;
  slug?: string | null;
};

type NavigationLocation = "footer" | "header";
type NavigationLinkType = "category" | "custom" | "home" | "page" | "product";

function cleanText(value: FormDataEntryValue | null, maxLength = 1000) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanOptionalText(value: FormDataEntryValue | null, maxLength = 1000) {
  const text = cleanText(value, maxLength);
  return text || null;
}

function navigationRedirect(storeId: string, status: string): never {
  const params = new URLSearchParams({ navigation: status, storeId });
  redirect(`${navigationPath}?${params.toString()}`);
}

async function requireWorkspaceStore(formData: FormData) {
  const storeId = cleanText(formData.get("storeId"), 80);

  if (!storeId) {
    redirect(`${navigationPath}?navigation=missing-store`);
  }

  const { supabase, user, workspaceId } = await getWorkspaceDataContext({
    permission: "can_edit_stores",
    redirectTo: navigationPath
  });
  const access = await assertStoreAccessInWorkspace({
    permission: "can_edit_stores",
    storeId,
    supabase,
    userId: user.id,
    workspaceId
  });

  if (!access.allowed) {
    redirect(`${navigationPath}?navigation=not-authorized`);
  }

  return {
    store: access.store as WorkspaceStoreRow,
    storeId,
    supabase,
    workspaceId
  };
}

function navigationLocation(value: FormDataEntryValue | null): NavigationLocation {
  return cleanText(value, 20) === "footer" ? "footer" : "header";
}

function navigationLinkType(value: FormDataEntryValue | null): NavigationLinkType {
  const type = cleanText(value, 20);
  return type === "category" || type === "custom" || type === "home" || type === "page" || type === "product"
    ? type
    : "home";
}

function safeCustomUrl(value: FormDataEntryValue | null) {
  const url = cleanOptionalText(value, 500);

  if (
    !url ||
    url.startsWith("/") ||
    url.startsWith("https://") ||
    url.startsWith("http://") ||
    url.startsWith("mailto:") ||
    url.startsWith("tel:")
  ) {
    return url;
  }

  return null;
}

function navigationPayload(formData: FormData) {
  const label = cleanText(formData.get("label"), 120);
  const linkType = navigationLinkType(formData.get("linkType"));
  const sortOrder = Number.parseInt(cleanText(formData.get("sortOrder"), 8) || "0", 10);

  if (!label) {
    return null;
  }

  return {
    category_id: linkType === "category" ? cleanOptionalText(formData.get("categoryId"), 80) : null,
    custom_url: linkType === "custom" ? safeCustomUrl(formData.get("customUrl")) : null,
    is_enabled: formData.get("isEnabled") !== null,
    label,
    link_type: linkType,
    location: navigationLocation(formData.get("location")),
    page_id: linkType === "page" ? cleanOptionalText(formData.get("pageId"), 80) : null,
    product_id: linkType === "product" ? cleanOptionalText(formData.get("productId"), 80) : null,
    sort_order: Number.isFinite(sortOrder) ? sortOrder : 0
  };
}

function standardEnabled(formData: FormData, key: StorefrontStandardNavigationKey) {
  return formData.get(`standard.${key}.enabled`) === "on";
}

function standardSortOrder(formData: FormData, key: StorefrontStandardNavigationKey, fallback: number) {
  const parsed = Number.parseInt(
    cleanText(formData.get(`standard.${key}.sortOrder`), 8) || String(fallback),
    10
  );

  return Number.isFinite(parsed) ? parsed : fallback;
}

function standardLabel(formData: FormData, key: StorefrontStandardNavigationKey, fallback: string) {
  return cleanText(formData.get(`standard.${key}.label`), 120) || fallback;
}

function revalidateNavigationPaths(store: WorkspaceStoreRow, storeId: string) {
  revalidatePath(navigationPath);
  revalidatePath(`/dashboard/stores/${storeId}`);

  if (store.slug) {
    revalidatePath(`/store/${store.slug}`);
    revalidatePath(`/s/${store.slug}`);
  }
}

export async function createStoreNavigationLink(formData: FormData) {
  const { store, storeId, supabase, workspaceId } = await requireWorkspaceStore(formData);
  const payload = navigationPayload(formData);

  if (!payload) {
    navigationRedirect(storeId, "missing-label");
  }

  const { error } = await supabase.from("store_navigation_links" as never).insert({
    ...payload,
    store_id: storeId,
    workspace_id: workspaceId
  } as never);

  if (error) {
    console.error("[store-navigation] create failed", {
      code: error.code,
      message: error.message,
      storeId
    });
    navigationRedirect(storeId, "create-failed");
  }

  revalidateNavigationPaths(store, storeId);
  navigationRedirect(storeId, "created");
}

export async function saveStandardStoreNavigationLinks(formData: FormData) {
  const { store, storeId, supabase, workspaceId } = await requireWorkspaceStore(formData);
  const storeSlug = cleanText(formData.get("storeSlug"), 160) || store.slug || "";

  if (!storeSlug) {
    navigationRedirect(storeId, "update-failed");
  }

  const { data, error: loadError } = await supabase
    .from("store_navigation_links" as never)
    .select("id, custom_url")
    .eq("workspace_id" as never, workspaceId as never)
    .eq("store_id" as never, storeId as never)
    .eq("location" as never, "header" as never)
    .eq("link_type" as never, "custom" as never);

  if (loadError) {
    navigationRedirect(storeId, "update-failed");
  }

  const existingRows = ((data ?? []) as Array<{ custom_url?: string | null; id: string }>);

  for (const option of storefrontStandardNavigationOptions) {
    const href = standardNavigationHref(option.key, storeSlug);
    const existing = existingRows.find((row) => row.custom_url === href);
    const payload = {
      custom_url: href,
      is_enabled: standardEnabled(formData, option.key),
      label: standardLabel(formData, option.key, option.label),
      link_type: "custom",
      location: "header",
      sort_order: standardSortOrder(formData, option.key, option.defaultSortOrder),
      updated_at: new Date().toISOString()
    };
    const result = existing
      ? await supabase
          .from("store_navigation_links" as never)
          .update(payload as never)
          .eq("id" as never, existing.id as never)
          .eq("workspace_id" as never, workspaceId as never)
          .eq("store_id" as never, storeId as never)
      : await supabase.from("store_navigation_links" as never).insert({
          ...payload,
          store_id: storeId,
          workspace_id: workspaceId
        } as never);

    if (result.error) {
      navigationRedirect(storeId, "update-failed");
    }
  }

  revalidateNavigationPaths(store, storeId);
  navigationRedirect(storeId, "updated");
}

export async function updateStoreNavigationLink(formData: FormData) {
  const { store, storeId, supabase, workspaceId } = await requireWorkspaceStore(formData);
  const linkId = cleanText(formData.get("linkId"), 80);
  const payload = navigationPayload(formData);

  if (!linkId || !payload) {
    navigationRedirect(storeId, "update-failed");
  }

  const { error } = await supabase
    .from("store_navigation_links" as never)
    .update({
      ...payload,
      updated_at: new Date().toISOString()
    } as never)
    .eq("id", linkId)
    .eq("store_id", storeId)
    .eq("workspace_id" as never, workspaceId as never);

  if (error) {
    console.error("[store-navigation] update failed", {
      code: error.code,
      linkId,
      message: error.message,
      storeId
    });
    navigationRedirect(storeId, "update-failed");
  }

  revalidateNavigationPaths(store, storeId);
  navigationRedirect(storeId, "updated");
}

export async function setStoreNavigationLinkEnabled(formData: FormData) {
  const { store, storeId, supabase, workspaceId } = await requireWorkspaceStore(formData);
  const linkId = cleanText(formData.get("linkId"), 80);
  const isEnabled = cleanText(formData.get("isEnabled"), 10) === "true";

  if (!linkId) {
    navigationRedirect(storeId, "update-failed");
  }

  const { error } = await supabase
    .from("store_navigation_links" as never)
    .update({
      is_enabled: isEnabled,
      updated_at: new Date().toISOString()
    } as never)
    .eq("id", linkId)
    .eq("store_id", storeId)
    .eq("workspace_id" as never, workspaceId as never);

  if (error) {
    console.error("[store-navigation] toggle failed", {
      code: error.code,
      linkId,
      message: error.message,
      storeId
    });
    navigationRedirect(storeId, "update-failed");
  }

  revalidateNavigationPaths(store, storeId);
  navigationRedirect(storeId, isEnabled ? "enabled" : "disabled");
}

export async function deleteStoreNavigationLink(formData: FormData) {
  const { store, storeId, supabase, workspaceId } = await requireWorkspaceStore(formData);
  const linkId = cleanText(formData.get("linkId"), 80);

  if (!linkId) {
    navigationRedirect(storeId, "delete-failed");
  }

  const { error } = await supabase
    .from("store_navigation_links" as never)
    .delete()
    .eq("id", linkId)
    .eq("store_id", storeId)
    .eq("workspace_id" as never, workspaceId as never);

  if (error) {
    console.error("[store-navigation] delete failed", {
      code: error.code,
      linkId,
      message: error.message,
      storeId
    });
    navigationRedirect(storeId, "delete-failed");
  }

  revalidateNavigationPaths(store, storeId);
  navigationRedirect(storeId, "deleted");
}
