"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUserWorkspaceRole, hasPermission } from "@/lib/permissions/rbac";
import { createClient } from "@/lib/supabase/server";

function cleanText(value: FormDataEntryValue | null, maxLength = 160) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function redirectWithNotice(returnTo: string, notice: string): never {
  const separator = returnTo.includes("?") ? "&" : "?";
  redirect(`${returnTo}${separator}stock=${notice}`);
}

export async function updateBackInStockRequestStatusAction(formData: FormData) {
  const requestId = cleanText(formData.get("requestId"), 80);
  const returnTo = cleanText(formData.get("returnTo"), 240) || "/dashboard/back-in-stock";
  const status = cleanText(formData.get("status"), 20);

  if (!requestId || !["cancelled", "notified", "pending"].includes(status)) {
    redirectWithNotice(returnTo, "request-invalid");
  }

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirectWithNotice(returnTo, "not-authorized");
  }

  const { data: request } = await supabase
    .from("store_back_in_stock_requests" as never)
    .select("id, workspace_id")
    .eq("id" as never, requestId as never)
    .maybeSingle();
  const requestRow = request as { id: string; workspace_id: string | null } | null;

  if (!requestRow?.workspace_id) {
    redirectWithNotice(returnTo, "request-missing");
  }

  const role = await getUserWorkspaceRole(supabase, requestRow.workspace_id, user.id);

  if (!hasPermission(role, "manage_products")) {
    redirectWithNotice(returnTo, "not-authorized");
  }

  const now = new Date().toISOString();
  const updatePayload = {
    cancelled_at: status === "cancelled" ? now : null,
    notification_status: status,
    notified_at: status === "notified" ? now : null,
    updated_at: now
  };
  const { error } = await supabase
    .from("store_back_in_stock_requests" as never)
    .update(updatePayload as never)
    .eq("id" as never, requestId as never)
    .eq("workspace_id" as never, requestRow.workspace_id as never);

  if (error) {
    redirectWithNotice(returnTo, "update-failed");
  }

  revalidatePath("/dashboard/back-in-stock");
  redirectWithNotice(returnTo, "status-updated");
}
