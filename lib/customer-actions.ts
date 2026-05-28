"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getWorkspaceDataContext } from "@/lib/workspaces/data-access";

const customersPath = "/dashboard/customers";
const customerStatuses = new Set(["new", "active", "returning", "vip"]);

function cleanText(value: FormDataEntryValue | null, maxLength = 1000) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function parseTags(value: FormDataEntryValue | null) {
  return Array.from(
    new Set(
      cleanText(value, 500)
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
        .slice(0, 12)
    )
  );
}

function customerRedirect(customerId: string, storeId: string, status: string): never {
  const params = new URLSearchParams({ customer: status, storeId });
  redirect(`/dashboard/customers/${customerId}?${params.toString()}`);
}

export async function saveStoreCustomerDetails(formData: FormData) {
  const customerId = cleanText(formData.get("customerId"), 80);
  const storeId = cleanText(formData.get("storeId"), 80);
  const status = cleanText(formData.get("status"), 40).toLowerCase();
  const tags = parseTags(formData.get("tags"));
  const note = cleanText(formData.get("note"), 2000);

  if (!customerId || !storeId) {
    redirect(`${customersPath}?customers=missing-customer`);
  }

  const { supabase, user, workspaceId } = await getWorkspaceDataContext({
    permission: "can_view_customers",
    redirectTo: `${customersPath}/${customerId}?storeId=${storeId}`
  });

  if (!customerStatuses.has(status)) {
    customerRedirect(customerId, storeId, "invalid-status");
  }

  const { data: customer, error: lookupError } = await supabase
    .from("store_customers" as never)
    .select("id")
    .eq("id" as never, customerId as never)
    .eq("store_id" as never, storeId as never)
    .eq("workspace_id" as never, workspaceId as never)
    .maybeSingle();

  if (lookupError || !customer) {
    customerRedirect(customerId, storeId, "not-found");
  }

  const { error: updateError } = await supabase
    .from("store_customers" as never)
    .update({
      status,
      tags,
      updated_at: new Date().toISOString()
    } as never)
    .eq("id" as never, customerId as never)
    .eq("store_id" as never, storeId as never)
    .eq("workspace_id" as never, workspaceId as never);

  if (updateError) {
    console.error("[customers] customer update failed", {
      code: updateError.code,
      customerId,
      message: updateError.message,
      storeId,
      workspaceId
    });
    customerRedirect(customerId, storeId, "update-failed");
  }

  if (note) {
    const { error: noteError } = await supabase.from("customer_notes" as never).insert({
      author_user_id: user.id,
      customer_id: customerId,
      note,
      store_id: storeId,
      tags,
      workspace_id: workspaceId
    } as never);

    if (noteError) {
      console.error("[customers] customer note insert failed", {
        code: noteError.code,
        customerId,
        message: noteError.message,
        storeId,
        workspaceId
      });
      customerRedirect(customerId, storeId, "note-failed");
    }
  }

  revalidatePath(customersPath);
  revalidatePath(`${customersPath}/${customerId}`);
  customerRedirect(customerId, storeId, "saved");
}
