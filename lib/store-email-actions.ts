"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getWorkspaceDataContext } from "@/lib/workspaces/data-access";

const emailPath = "/dashboard/email";

function cleanText(value: FormDataEntryValue | null, maxLength = 500) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function formBoolean(value: FormDataEntryValue | null) {
  return value === "on" || value === "true";
}

function emailRedirect(storeId: string, status: string): never {
  const params = new URLSearchParams({ email: status, storeId });
  redirect(`${emailPath}?${params.toString()}`);
}

export async function saveStoreEmailSettings(formData: FormData) {
  const storeId = cleanText(formData.get("storeId"), 80);
  const senderName = cleanText(formData.get("senderName"), 160);
  const replyToEmail = cleanText(formData.get("replyToEmail"), 180).toLowerCase();

  if (!storeId) {
    redirect(`${emailPath}?email=missing-store`);
  }

  const { supabase, workspaceId } = await getWorkspaceDataContext({
    permission: "can_view_notifications",
    redirectTo: emailPath
  });

  const { error } = await supabase.from("store_email_settings" as never).upsert({
    enable_customer_welcome: formBoolean(formData.get("enableCustomerWelcome")),
    enable_low_stock_alert: formBoolean(formData.get("enableLowStockAlert")),
    enable_order_confirmation: formBoolean(formData.get("enableOrderConfirmation")),
    enable_order_status_update: formBoolean(formData.get("enableOrderStatusUpdate")),
    enable_review_request: formBoolean(formData.get("enableReviewRequest")),
    reply_to_email: replyToEmail || null,
    sender_name: senderName || null,
    store_id: storeId,
    workspace_id: workspaceId
  } as never, {
    onConflict: "workspace_id,store_id"
  });

  if (error) {
    console.error("[store-email] settings save failed", {
      code: error.code,
      message: error.message,
      storeId,
      workspaceId
    });
    emailRedirect(storeId, "settings-failed");
  }

  revalidatePath(emailPath);
  emailRedirect(storeId, "settings-saved");
}
