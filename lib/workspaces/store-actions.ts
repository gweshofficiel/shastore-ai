"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createStoreForUser } from "@/lib/stores/ownership";
import { fetchStoresForAuthUser } from "@/lib/stores/user-stores";
import { getWorkspaceDataContext, assertStoreInWorkspace } from "@/lib/workspaces/data-access";

function cleanText(value: FormDataEntryValue | null, maxLength = 240) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function listStores() {
  const { supabase, user, workspaceId } = await getWorkspaceDataContext({
    permission: "can_view_stores",
    redirectTo: "/dashboard/stores"
  });
  const result = await fetchStoresForAuthUser(supabase, user.id, workspaceId);

  console.log("[workspace-store-access] stores listed", {
    count: result.stores.length,
    userId: user.id,
    workspaceId
  });

  return result;
}

export async function createStore(formData: FormData) {
  const { supabase, user, workspaceId } = await getWorkspaceDataContext({
    permission: "can_edit_stores",
    redirectTo: "/dashboard/stores"
  });
  const name = cleanText(formData.get("name") ?? formData.get("storeName"), 160);
  const description = cleanText(formData.get("description") ?? formData.get("storeDescription"), 1000);
  const templateId = cleanText(formData.get("templateId"), 120) || "modern-store";

  if (!name) {
    redirect("/dashboard/stores?error=Store%20name%20is%20required.");
  }

  const store = await createStoreForUser(supabase, user.id, {
    description,
    name,
    templateId,
    workspaceId
  });
  const storeId = (store as { id?: string } | null)?.id ?? null;

  console.info("[workspace-store-created] store created", {
    storeId,
    userId: user.id,
    workspaceId
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/stores");
  redirect(`/dashboard/stores${storeId ? `/${storeId}` : ""}`);
}

export async function updateStore(formData: FormData) {
  const { supabase, user, workspaceId } = await getWorkspaceDataContext({
    permission: "can_edit_stores",
    redirectTo: "/dashboard/stores"
  });
  const storeId = cleanText(formData.get("storeId"), 120);
  const name = cleanText(formData.get("name") ?? formData.get("storeName"), 160);
  const description = cleanText(formData.get("description") ?? formData.get("storeDescription"), 1000);

  if (!storeId || !(await assertStoreInWorkspace(supabase, storeId, workspaceId, user.id))) {
    console.warn("[workspace-store-access-denied] update store outside active workspace", {
      storeId,
      userId: user.id,
      workspaceId
    });
    redirect("/dashboard/stores?error=Store%20access%20denied.");
  }

  const payload: Record<string, string> = {};

  if (name) {
    payload.name = name;
    payload.store_name = name;
  }

  if (description) {
    payload.description = description;
  }

  const { error } = await supabase
    .from("stores")
    .update({ ...payload, updated_at: new Date().toISOString() } as never)
    .eq("id", storeId)
    .eq("workspace_id" as never, workspaceId as never);

  if (error) {
    console.warn("[workspace-security-block] store update blocked", {
      message: error.message,
      storeId,
      userId: user.id,
      workspaceId
    });
    redirect("/dashboard/stores?error=Store%20could%20not%20be%20updated.");
  }

  console.log("[workspace-store-access] store updated", { storeId, userId: user.id, workspaceId });
  revalidatePath("/dashboard/stores");
  revalidatePath(`/dashboard/stores/${storeId}`);
  redirect(`/dashboard/stores/${storeId}?saved=true`);
}

export async function deleteStore(formData: FormData) {
  const { supabase, user, workspaceId } = await getWorkspaceDataContext({
    permission: "can_edit_stores",
    redirectTo: "/dashboard/stores"
  });
  const storeId = cleanText(formData.get("storeId"), 120);

  if (!storeId || !(await assertStoreInWorkspace(supabase, storeId, workspaceId, user.id))) {
    console.warn("[workspace-store-access-denied] delete store outside active workspace", {
      storeId,
      userId: user.id,
      workspaceId
    });
    redirect("/dashboard/stores?error=Store%20access%20denied.");
  }

  const { error } = await supabase
    .from("stores")
    .delete()
    .eq("id", storeId)
    .eq("workspace_id" as never, workspaceId as never);

  if (error) {
    console.warn("[workspace-security-block] store delete blocked", {
      message: error.message,
      storeId,
      userId: user.id,
      workspaceId
    });
    redirect("/dashboard/stores?error=Store%20could%20not%20be%20deleted.");
  }

  console.log("[workspace-store-access] store deleted", { storeId, userId: user.id, workspaceId });
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/stores");
  redirect("/dashboard/stores?deleted=true");
}
