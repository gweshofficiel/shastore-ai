"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertStoreInWorkspace, getWorkspaceDataContext } from "@/lib/workspaces/data-access";
import type { DiscountCampaignType } from "@/lib/discount-campaigns";

const dashboardPath = "/dashboard/discount-campaigns";

function cleanText(value: FormDataEntryValue | null, maxLength = 240) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanMoney(value: FormDataEntryValue | null) {
  const text = cleanText(value, 40);
  const amount = Number(text || 0);
  return Number.isFinite(amount) ? Math.max(0, Number(amount.toFixed(2))) : 0;
}

function cleanDateTime(value: FormDataEntryValue | null) {
  const text = cleanText(value, 80);

  if (!text) {
    return null;
  }

  const date = new Date(text);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function discountCampaignsRedirect(status: string, storeId?: string | null): never {
  const params = new URLSearchParams({ discounts: status });

  if (storeId) {
    params.set("storeId", storeId);
  }

  redirect(`${dashboardPath}?${params.toString()}`);
}

function cleanIdList(values: FormDataEntryValue[]) {
  return [...new Set(values.map((value) => cleanText(value, 120)).filter(Boolean))];
}

function normalizeDiscountType(value: FormDataEntryValue | null): DiscountCampaignType {
  const type = cleanText(value, 40);
  return type === "fixed" || type === "free_shipping" ? type : "percentage";
}

function normalizeStatus(value: FormDataEntryValue | null) {
  const status = cleanText(value, 40);
  return status === "active" || status === "expired" ? status : "draft";
}

function normalizeSegment(value: string) {
  return value === "new_customers" ||
    value === "returning_customers" ||
    value === "vip_customers" ||
    value === "digital_product_customers"
    ? value
    : "all_customers";
}

export async function createDiscountCampaignAction(formData: FormData) {
  const { supabase, user, workspaceId } = await getWorkspaceDataContext({
    permission: "can_edit_stores",
    redirectTo: dashboardPath
  });
  const storeId = cleanText(formData.get("storeId"), 120);
  const name = cleanText(formData.get("name"), 180);
  const discountType = normalizeDiscountType(formData.get("discountType"));
  const discountValue = discountType === "free_shipping" ? 0 : cleanMoney(formData.get("discountValue"));
  const startsAt = cleanDateTime(formData.get("startsAt"));
  const endsAt = cleanDateTime(formData.get("endsAt"));
  const status = normalizeStatus(formData.get("status"));
  const targetProducts = cleanIdList(formData.getAll("productIds"));
  const targetCategories = cleanIdList(formData.getAll("categoryIds"));
  const targetSegments = cleanIdList(formData.getAll("customerSegments")).map(normalizeSegment);
  const allProducts = formData.get("allProducts") === "on" || (!targetProducts.length && !targetCategories.length);

  if (!storeId || !(await assertStoreInWorkspace(supabase, storeId, workspaceId, user.id))) {
    discountCampaignsRedirect("access-denied", storeId);
  }

  if (!name || (discountType !== "free_shipping" && discountValue <= 0)) {
    discountCampaignsRedirect("invalid", storeId);
  }

  if (discountType === "percentage" && discountValue > 100) {
    discountCampaignsRedirect("invalid-percentage", storeId);
  }

  const { data: campaignRow, error } = await supabase
    .from("discount_campaigns" as never)
    .insert({
      created_by: user.id,
      discount_type: discountType,
      discount_value: discountValue,
      ends_at: endsAt,
      name,
      starts_at: startsAt,
      status,
      store_id: storeId,
      workspace_id: workspaceId
    } as never)
    .select("id")
    .maybeSingle();

  if (error || !campaignRow) {
    discountCampaignsRedirect("create-failed", storeId);
  }

  const campaignId = (campaignRow as { id: string }).id;
  const ruleRows = [
    ...(allProducts
      ? [{ campaign_id: campaignId, rule_type: "all_products", rule_value: null, store_id: storeId, workspace_id: workspaceId }]
      : []),
    ...targetProducts.map((productId) => ({
      campaign_id: campaignId,
      rule_type: "product",
      rule_value: productId,
      store_id: storeId,
      workspace_id: workspaceId
    })),
    ...targetCategories.map((categoryId) => ({
      campaign_id: campaignId,
      rule_type: "category",
      rule_value: categoryId,
      store_id: storeId,
      workspace_id: workspaceId
    })),
    ...targetSegments.map((segment) => ({
      campaign_id: campaignId,
      rule_type: "customer_segment",
      rule_value: segment,
      store_id: storeId,
      workspace_id: workspaceId
    }))
  ];

  if (ruleRows.length) {
    const { error: rulesError } = await supabase.from("discount_campaign_rules" as never).insert(ruleRows as never);

    if (rulesError) {
      await supabase.from("discount_campaigns" as never).delete().eq("id" as never, campaignId as never);
      discountCampaignsRedirect("create-failed", storeId);
    }
  }

  revalidatePath(dashboardPath);
  discountCampaignsRedirect("created", storeId);
}

export async function updateDiscountCampaignStatusAction(formData: FormData) {
  const { supabase, user, workspaceId } = await getWorkspaceDataContext({
    permission: "can_edit_stores",
    redirectTo: dashboardPath
  });
  const campaignId = cleanText(formData.get("campaignId"), 120);
  const storeId = cleanText(formData.get("storeId"), 120);
  const status = normalizeStatus(formData.get("status"));

  if (!campaignId || !storeId || !(await assertStoreInWorkspace(supabase, storeId, workspaceId, user.id))) {
    discountCampaignsRedirect("access-denied", storeId);
  }

  const { error } = await supabase
    .from("discount_campaigns" as never)
    .update({ status } as never)
    .eq("id" as never, campaignId as never)
    .eq("store_id" as never, storeId as never)
    .eq("workspace_id" as never, workspaceId as never);

  if (error) {
    discountCampaignsRedirect("update-failed", storeId);
  }

  revalidatePath(dashboardPath);
  discountCampaignsRedirect("updated", storeId);
}
