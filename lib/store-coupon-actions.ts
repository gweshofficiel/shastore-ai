"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { normalizeCouponCode } from "@/lib/store-coupons";
import { assertStoreInWorkspace, getWorkspaceDataContext } from "@/lib/workspaces/data-access";

function cleanText(value: FormDataEntryValue | null, maxLength = 240) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanMoney(value: FormDataEntryValue | null) {
  const text = cleanText(value, 40);
  if (!text) {
    return 0;
  }

  const amount = Number(text);
  return Number.isFinite(amount) ? Math.max(0, Number(amount.toFixed(2))) : 0;
}

function cleanInteger(value: FormDataEntryValue | null) {
  const text = cleanText(value, 20);
  if (!text) {
    return null;
  }

  const amount = Number.parseInt(text, 10);
  return Number.isFinite(amount) ? Math.max(0, amount) : null;
}

function cleanDateTime(value: FormDataEntryValue | null) {
  const text = cleanText(value, 80);
  if (!text) {
    return null;
  }

  const date = new Date(text);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function couponsRedirect(status: string, storeId?: string | null): never {
  const params = new URLSearchParams({ coupons: status });
  if (storeId) {
    params.set("storeId", storeId);
  }

  redirect(`/dashboard/coupons?${params.toString()}`);
}

export async function createStoreCouponAction(formData: FormData) {
  const { supabase, user, workspaceId } = await getWorkspaceDataContext({
    permission: "can_edit_stores",
    redirectTo: "/dashboard/coupons"
  });
  const storeId = cleanText(formData.get("storeId"), 120);
  const code = normalizeCouponCode(formData.get("code"));
  const discountType = cleanText(formData.get("discountType"), 20) === "fixed" ? "fixed" : "percentage";
  const discountValue = cleanMoney(formData.get("discountValue"));
  const minimumOrderAmount = cleanMoney(formData.get("minimumOrderAmount"));
  const usageLimit = cleanInteger(formData.get("usageLimit"));
  const startsAt = cleanDateTime(formData.get("startsAt"));
  const endsAt = cleanDateTime(formData.get("endsAt"));
  const status = cleanText(formData.get("status"), 20) === "inactive" ? "inactive" : "active";

  if (!storeId || !(await assertStoreInWorkspace(supabase, storeId, workspaceId, user.id))) {
    couponsRedirect("access-denied");
  }

  if (!code || discountValue <= 0) {
    couponsRedirect("invalid", storeId);
  }

  if (discountType === "percentage" && discountValue > 100) {
    couponsRedirect("invalid-percentage", storeId);
  }

  const { error } = await supabase.from("store_coupons" as never).insert({
    code,
    created_by: user.id,
    discount_type: discountType,
    discount_value: discountValue,
    ends_at: endsAt,
    minimum_order_amount: minimumOrderAmount,
    starts_at: startsAt,
    status,
    store_id: storeId,
    usage_limit: usageLimit,
    workspace_id: workspaceId
  } as never);

  if (error) {
    console.warn("[store-coupons] create failed", {
      code: error.code,
      message: error.message,
      storeId,
      workspaceId
    });
    couponsRedirect(error.code === "23505" ? "duplicate" : "create-failed", storeId);
  }

  revalidatePath("/dashboard/coupons");
  couponsRedirect("created", storeId);
}

export async function updateStoreCouponStatusAction(formData: FormData) {
  const { supabase, user, workspaceId } = await getWorkspaceDataContext({
    permission: "can_edit_stores",
    redirectTo: "/dashboard/coupons"
  });
  const couponId = cleanText(formData.get("couponId"), 120);
  const storeId = cleanText(formData.get("storeId"), 120);
  const nextStatus = cleanText(formData.get("status"), 20) === "inactive" ? "inactive" : "active";

  if (!couponId || !storeId || !(await assertStoreInWorkspace(supabase, storeId, workspaceId, user.id))) {
    couponsRedirect("access-denied", storeId);
  }

  const { error } = await supabase
    .from("store_coupons" as never)
    .update({ status: nextStatus } as never)
    .eq("id" as never, couponId as never)
    .eq("store_id" as never, storeId as never)
    .eq("workspace_id" as never, workspaceId as never);

  if (error) {
    console.warn("[store-coupons] status update failed", {
      code: error.code,
      couponId,
      message: error.message,
      storeId,
      workspaceId
    });
    couponsRedirect("update-failed", storeId);
  }

  revalidatePath("/dashboard/coupons");
  couponsRedirect("updated", storeId);
}
