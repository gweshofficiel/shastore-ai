import type { SupabaseClient } from "@supabase/supabase-js";
import type { Json } from "@/types/database";

export type StoreAffiliateRow = {
  code: string;
  commission_rate: number | string;
  email: string;
  id: string;
  name: string;
  status: "active" | "disabled";
  store_id: string;
  workspace_id: string;
};

export function normalizeAffiliateCode(value: FormDataEntryValue | string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 40);
}

export function normalizeAffiliateEmail(value: FormDataEntryValue | string | null | undefined) {
  return String(value ?? "").trim().toLowerCase().slice(0, 180);
}

export function affiliateCommissionAmount(orderTotal: number | string | null | undefined, commissionRate: number | string | null | undefined) {
  const total = typeof orderTotal === "number" ? orderTotal : Number(orderTotal ?? 0);
  const rate = typeof commissionRate === "number" ? commissionRate : Number(commissionRate ?? 0);

  if (!Number.isFinite(total) || !Number.isFinite(rate)) {
    return 0;
  }

  return Number(Math.max(0, (total * rate) / 100).toFixed(2));
}

export async function findActiveAffiliateByCode({
  affiliateCode,
  storeId,
  supabase,
  workspaceId
}: {
  affiliateCode?: string | null;
  storeId: string;
  supabase: SupabaseClient;
  workspaceId?: string | null;
}) {
  const code = normalizeAffiliateCode(affiliateCode);

  if (!code || !workspaceId) {
    return null;
  }

  const { data } = await supabase
    .from("store_affiliates" as never)
    .select("id, workspace_id, store_id, name, email, code, commission_rate, status")
    .eq("workspace_id" as never, workspaceId as never)
    .eq("store_id" as never, storeId as never)
    .eq("code" as never, code as never)
    .eq("status" as never, "active" as never)
    .maybeSingle();

  return data as StoreAffiliateRow | null;
}

export async function recordAffiliateVisit(
  supabase: SupabaseClient,
  input: {
    affiliateCode?: string | null;
    landingPath?: string | null;
    metadata?: Json;
    storeId: string;
    visitorId?: string | null;
    workspaceId?: string | null;
  }
) {
  const affiliate = await findActiveAffiliateByCode({
    affiliateCode: input.affiliateCode,
    storeId: input.storeId,
    supabase,
    workspaceId: input.workspaceId
  });

  if (!affiliate) {
    return null;
  }

  const { data, error } = await supabase
    .from("store_affiliate_visits" as never)
    .insert({
      affiliate_code: affiliate.code,
      affiliate_id: affiliate.id,
      landing_path: input.landingPath?.trim().slice(0, 500) || null,
      metadata: input.metadata ?? {},
      store_id: input.storeId,
      visitor_id: input.visitorId?.trim().slice(0, 120) || null,
      workspace_id: input.workspaceId
    } as never)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    console.warn("[affiliates] visit tracking failed", {
      code: error?.code,
      message: error?.message,
      storeId: input.storeId
    });
    return null;
  }

  return (data as { id: string }).id;
}

export async function recordAffiliateOrderForCheckout(
  supabase: SupabaseClient,
  input: {
    affiliateCode?: string | null;
    orderId: string;
    orderSource: "orders" | "store_orders";
    orderTotal: number | string | null | undefined;
    storeId: string;
    workspaceId?: string | null;
  }
) {
  const affiliate = await findActiveAffiliateByCode({
    affiliateCode: input.affiliateCode,
    storeId: input.storeId,
    supabase,
    workspaceId: input.workspaceId
  });

  if (!affiliate || !input.workspaceId) {
    return null;
  }

  const { data: existing } = await supabase
    .from("store_affiliate_orders" as never)
    .select("id")
    .eq("store_id" as never, input.storeId as never)
    .eq("order_source" as never, input.orderSource as never)
    .eq("order_id" as never, input.orderId as never)
    .maybeSingle();

  if (existing) {
    return { affiliateId: affiliate.id, affiliateOrderId: (existing as { id: string }).id };
  }

  const commissionAmount = affiliateCommissionAmount(input.orderTotal, affiliate.commission_rate);
  const { data, error } = await supabase
    .from("store_affiliate_orders" as never)
    .insert({
      affiliate_code: affiliate.code,
      affiliate_id: affiliate.id,
      commission_amount: commissionAmount,
      commission_rate: Number(affiliate.commission_rate),
      metadata: {
        source: "checkout_order"
      },
      order_id: input.orderId,
      order_source: input.orderSource,
      order_total: input.orderTotal ?? 0,
      status: "pending",
      store_id: input.storeId,
      workspace_id: input.workspaceId
    } as never)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    console.warn("[affiliates] order attribution failed", {
      code: error?.code,
      message: error?.message,
      orderId: input.orderId,
      storeId: input.storeId
    });
    return null;
  }

  return { affiliateId: affiliate.id, affiliateOrderId: (data as { id: string }).id };
}
