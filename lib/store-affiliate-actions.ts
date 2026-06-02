"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  normalizeAffiliateCode,
  normalizeAffiliateEmail
} from "@/lib/store-affiliates";
import { getWorkspaceDataContext } from "@/lib/workspaces/data-access";

const affiliatesPath = "/dashboard/affiliates";

function cleanText(value: FormDataEntryValue | null, maxLength = 500) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function redirectWith(status: string, storeId: string): never {
  const params = new URLSearchParams({ affiliates: status });

  if (storeId) {
    params.set("storeId", storeId);
  }

  redirect(`${affiliatesPath}?${params.toString()}`);
}

export async function createStoreAffiliateAction(formData: FormData) {
  const storeId = cleanText(formData.get("storeId"), 80);
  const name = cleanText(formData.get("name"), 160);
  const email = normalizeAffiliateEmail(formData.get("email"));
  const code = normalizeAffiliateCode(formData.get("code"));
  const status = cleanText(formData.get("status"), 40) === "disabled" ? "disabled" : "active";
  const commissionRate = Number(cleanText(formData.get("commissionRate"), 40));

  if (!storeId || !name || !email || !code || !Number.isFinite(commissionRate) || commissionRate < 0 || commissionRate > 100) {
    redirectWith("invalid", storeId);
  }

  const { supabase, workspaceId } = await getWorkspaceDataContext({
    permission: "can_edit_stores",
    redirectTo: affiliatesPath
  });
  const { data: store } = await supabase
    .from("stores")
    .select("id")
    .eq("id", storeId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (!store) {
    redirectWith("access-denied", storeId);
  }

  const { error } = await supabase.from("store_affiliates" as never).insert({
    code,
    commission_rate: Number(commissionRate.toFixed(2)),
    email,
    name,
    normalized_email: email,
    status,
    store_id: storeId,
    workspace_id: workspaceId
  } as never);

  if (error) {
    const message = error.message.toLowerCase();

    if (error.code === "23505" || message.includes("duplicate")) {
      redirectWith("duplicate", storeId);
    }

    console.error("[affiliates] create failed", {
      code: error.code,
      message: error.message,
      storeId,
      workspaceId
    });
    redirectWith("create-failed", storeId);
  }

  revalidatePath(affiliatesPath);
  redirectWith("created", storeId);
}
