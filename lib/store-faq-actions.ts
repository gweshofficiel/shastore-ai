"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  assertStoreAccessInWorkspace,
  getWorkspaceDataContext
} from "@/lib/workspaces/data-access";

const faqPath = "/dashboard/faq";

type WorkspaceStoreRow = {
  id: string;
  slug?: string | null;
};

type FaqStatus = "draft" | "published";

function cleanText(value: FormDataEntryValue | null, maxLength = 4000) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanSortOrder(value: FormDataEntryValue | null) {
  const text = cleanText(value, 20);

  if (!text) {
    return null;
  }

  const sortOrder = Number.parseInt(text, 10);
  return Number.isFinite(sortOrder) ? sortOrder : null;
}

function faqStatus(value: FormDataEntryValue | null): FaqStatus {
  return cleanText(value, 20) === "published" ? "published" : "draft";
}

function faqRedirect(storeId: string, status: string, extra?: Record<string, string | null | undefined>): never {
  const params = new URLSearchParams({ faq: status, storeId });

  for (const [key, value] of Object.entries(extra ?? {})) {
    if (value) {
      params.set(key, value);
    }
  }

  redirect(`${faqPath}?${params.toString()}`);
}

async function requireWorkspaceStore(formData: FormData) {
  const storeId = cleanText(formData.get("storeId"), 80);

  if (!storeId) {
    redirect(`${faqPath}?faq=missing-store`);
  }

  const { supabase, user, workspaceId } = await getWorkspaceDataContext({
    permission: "can_edit_stores",
    redirectTo: faqPath
  });
  const access = await assertStoreAccessInWorkspace({
    permission: "can_edit_stores",
    storeId,
    supabase,
    userId: user.id,
    workspaceId
  });

  if (!access.allowed) {
    redirect(`${faqPath}?faq=not-authorized`);
  }

  return {
    store: access.store as WorkspaceStoreRow,
    storeId,
    supabase,
    user,
    workspaceId
  };
}

function faqPayload(formData: FormData) {
  const answer = cleanText(formData.get("answer"), 8000);
  const question = cleanText(formData.get("question"), 500);

  if (!question || !answer) {
    return null;
  }

  return {
    answer,
    question,
    sort_order: cleanSortOrder(formData.get("sortOrder")),
    status: faqStatus(formData.get("status"))
  };
}

function revalidateFaqPaths(store: WorkspaceStoreRow) {
  revalidatePath(faqPath);

  if (store.slug) {
    revalidatePath(`/store/${store.slug}`);
    revalidatePath(`/store/${store.slug}/faq`);
  }
}

export async function createStoreFaq(formData: FormData) {
  const { store, storeId, supabase, user, workspaceId } = await requireWorkspaceStore(formData);
  const payload = faqPayload(formData);

  if (!payload) {
    faqRedirect(storeId, "missing-fields");
  }

  const { data, error } = await supabase
    .from("store_faqs" as never)
    .insert({
      ...payload,
      created_by: user.id,
      store_id: storeId,
      workspace_id: workspaceId
    } as never)
    .select("id")
    .single();

  if (error) {
    faqRedirect(storeId, "create-failed");
  }

  const faq = data as unknown as { id: string };
  revalidateFaqPaths(store);
  faqRedirect(storeId, "created", { edit: faq.id });
}

export async function updateStoreFaq(formData: FormData) {
  const { store, storeId, supabase, workspaceId } = await requireWorkspaceStore(formData);
  const faqId = cleanText(formData.get("faqId"), 80);
  const payload = faqPayload(formData);

  if (!faqId || !payload) {
    faqRedirect(storeId, "update-failed");
  }

  const { error } = await supabase
    .from("store_faqs" as never)
    .update({
      ...payload,
      updated_at: new Date().toISOString()
    } as never)
    .eq("id" as never, faqId as never)
    .eq("store_id" as never, storeId as never)
    .eq("workspace_id" as never, workspaceId as never);

  if (error) {
    faqRedirect(storeId, "update-failed");
  }

  revalidateFaqPaths(store);
  faqRedirect(storeId, "updated", { edit: faqId });
}

export async function setStoreFaqStatus(formData: FormData) {
  const { store, storeId, supabase, workspaceId } = await requireWorkspaceStore(formData);
  const faqId = cleanText(formData.get("faqId"), 80);
  const status = faqStatus(formData.get("status"));

  if (!faqId) {
    faqRedirect(storeId, "status-failed");
  }

  const { error } = await supabase
    .from("store_faqs" as never)
    .update({
      status,
      updated_at: new Date().toISOString()
    } as never)
    .eq("id" as never, faqId as never)
    .eq("store_id" as never, storeId as never)
    .eq("workspace_id" as never, workspaceId as never);

  if (error) {
    faqRedirect(storeId, "status-failed");
  }

  revalidateFaqPaths(store);
  faqRedirect(storeId, status === "published" ? "published" : "unpublished");
}

export async function deleteStoreFaq(formData: FormData) {
  const { store, storeId, supabase, workspaceId } = await requireWorkspaceStore(formData);
  const faqId = cleanText(formData.get("faqId"), 80);

  if (!faqId) {
    faqRedirect(storeId, "delete-failed");
  }

  const { error } = await supabase
    .from("store_faqs" as never)
    .delete()
    .eq("id" as never, faqId as never)
    .eq("store_id" as never, storeId as never)
    .eq("workspace_id" as never, workspaceId as never);

  if (error) {
    faqRedirect(storeId, "delete-failed");
  }

  revalidateFaqPaths(store);
  faqRedirect(storeId, "deleted");
}
