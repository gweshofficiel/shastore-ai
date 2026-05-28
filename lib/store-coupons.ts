import type { SupabaseClient } from "@supabase/supabase-js";

export type CouponDiscountType = "percentage" | "fixed";

export type StoreCouponRow = {
  code: string;
  discount_type: CouponDiscountType;
  discount_value: number | string;
  ends_at?: string | null;
  id: string;
  minimum_order_amount?: number | string | null;
  starts_at?: string | null;
  status: string;
  store_id: string;
  usage_limit?: number | null;
  used_count: number;
  workspace_id: string;
};

export type CouponValidationResult =
  | {
      coupon: StoreCouponRow;
      discountAmount: number;
      ok: true;
    }
  | {
      error: string;
      ok: false;
    };

export function normalizeCouponCode(value: FormDataEntryValue | string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 40);
}

function money(value: number | string | null | undefined) {
  const amount = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(amount) ? Math.max(0, Number(amount.toFixed(2))) : 0;
}

function calculateDiscount(coupon: StoreCouponRow, subtotal: number) {
  const value = money(coupon.discount_value);
  const rawDiscount =
    coupon.discount_type === "percentage" ? subtotal * Math.min(value, 100) / 100 : value;

  return Math.min(subtotal, Math.max(0, Number(rawDiscount.toFixed(2))));
}

export async function validateStoreCoupon(
  supabase: SupabaseClient,
  input: {
    code: string;
    storeId: string;
    subtotal: number;
    workspaceId?: string | null;
  }
): Promise<CouponValidationResult> {
  const code = normalizeCouponCode(input.code);
  const subtotal = money(input.subtotal);

  if (!code) {
    return { error: "Enter a coupon code.", ok: false };
  }

  if (!input.storeId || subtotal <= 0) {
    return { error: "Coupon cannot be applied to this cart.", ok: false };
  }

  const { data, error } = await supabase
    .from("store_coupons" as never)
    .select("id, store_id, workspace_id, code, discount_type, discount_value, status, usage_limit, used_count, minimum_order_amount, starts_at, ends_at")
    .eq("store_id" as never, input.storeId as never)
    .eq("code" as never, code as never)
    .maybeSingle();

  if (error) {
    console.warn("[store-coupons] validation failed", {
      code: error.code,
      message: error.message,
      storeId: input.storeId
    });
    return { error: "Coupon could not be validated.", ok: false };
  }

  const coupon = data as StoreCouponRow | null;

  if (!coupon || (input.workspaceId && coupon.workspace_id !== input.workspaceId)) {
    return { error: "Coupon is not valid for this store.", ok: false };
  }

  if (coupon.status !== "active") {
    return { error: "Coupon is inactive.", ok: false };
  }

  const now = Date.now();
  if (coupon.starts_at && new Date(coupon.starts_at).getTime() > now) {
    return { error: "Coupon is not active yet.", ok: false };
  }

  if (coupon.ends_at && new Date(coupon.ends_at).getTime() < now) {
    return { error: "Coupon has expired.", ok: false };
  }

  if (coupon.usage_limit !== null && coupon.usage_limit !== undefined && coupon.used_count >= coupon.usage_limit) {
    return { error: "Coupon usage limit has been reached.", ok: false };
  }

  const minimumOrderAmount = money(coupon.minimum_order_amount);
  if (subtotal < minimumOrderAmount) {
    return { error: `Minimum order amount is ${minimumOrderAmount.toFixed(2)}.`, ok: false };
  }

  const discountAmount = calculateDiscount(coupon, subtotal);
  if (discountAmount <= 0) {
    return { error: "Coupon does not apply a discount to this cart.", ok: false };
  }

  return { coupon, discountAmount, ok: true };
}

export async function incrementCouponUsage(
  supabase: SupabaseClient,
  coupon: StoreCouponRow
) {
  const { data, error } = await supabase.rpc("increment_store_coupon_usage" as never, {
    coupon_id_input: coupon.id
  } as never);

  if (error) {
    console.warn("[store-coupons] usage increment failed", {
      code: error.code,
      couponId: coupon.id,
      message: error.message
    });
  }

  return data === true;
}

