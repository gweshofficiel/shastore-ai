"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function cleanText(value: FormDataEntryValue | null, maxLength = 120) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function redirectToStore(storeId: string, status: string): never {
  redirect(`/dashboard/stores/${storeId}?storefront=${encodeURIComponent(status)}`);
}

async function updateStorefrontPublication(formData: FormData, publishStore: boolean) {
  const storeId = cleanText(formData.get("storeId"));

  if (!storeId) {
    redirect("/dashboard/stores?error=missing-store");
  }

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/dashboard/stores/${storeId}`)}`);
  }

  const { data, error } = await supabase.rpc(
    "set_storefront_publication_state" as never,
    {
      candidate_store_instance_id: storeId,
      publish_store: publishStore
    } as never
  );

  if (error) {
    console.error("[store-publishing] publication state update failed", {
      code: error.code,
      message: error.message,
      publishStore,
      storeId
    });
    redirectToStore(storeId, publishStore ? "publish-failed" : "unpublish-failed");
  }

  const result = data as { slug?: unknown } | null;
  const slug = typeof result?.slug === "string" ? result.slug : null;

  revalidatePath(`/dashboard/stores/${storeId}`);
  revalidatePath("/dashboard/stores");

  if (slug) {
    revalidatePath(`/store/${slug}`);
  }

  redirectToStore(storeId, publishStore ? "published" : "unpublished");
}

export async function publishOwnedStorefront(formData: FormData) {
  await updateStorefrontPublication(formData, true);
}

export async function unpublishOwnedStorefront(formData: FormData) {
  await updateStorefrontPublication(formData, false);
}
