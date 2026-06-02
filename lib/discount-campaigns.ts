import type { SupabaseClient } from "@supabase/supabase-js";

export type DiscountCampaignType = "fixed" | "free_shipping" | "percentage";
export type DiscountCampaignStatus = "active" | "draft" | "expired";
export type DiscountCampaignSegment =
  | "all_customers"
  | "digital_product_customers"
  | "new_customers"
  | "returning_customers"
  | "vip_customers";

export type DiscountCampaignCartItem = {
  categoryId?: string | null;
  productId: string;
  quantity: number;
  subtotal: number;
};

export type DiscountCampaignRow = {
  discount_type: DiscountCampaignType;
  discount_value: number | string;
  ends_at?: string | null;
  id: string;
  name: string;
  starts_at?: string | null;
  status: DiscountCampaignStatus | string;
  store_id: string;
  workspace_id: string;
};

type DiscountCampaignRuleRow = {
  campaign_id: string;
  rule_type: "all_products" | "category" | "customer_segment" | "product";
  rule_value?: string | null;
};

type CustomerRow = {
  email?: string | null;
  id: string;
  normalized_email?: string | null;
  segment?: string | null;
  total_orders?: number | null;
  total_spent?: number | string | null;
};

export type AppliedDiscountCampaign = {
  campaign: DiscountCampaignRow;
  discountAmount: number;
  discountLabel: string;
  freeShipping: boolean;
};

function money(value: number | string | null | undefined) {
  const amount = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(amount) ? Math.max(0, Number(amount.toFixed(2))) : 0;
}

function cleanEmail(value: string | null | undefined) {
  const email = (value ?? "").trim().toLowerCase();
  return email.includes("@") ? email : "";
}

function numericValue(value: number | string | null | undefined) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function formatDiscountLabel(campaign: DiscountCampaignRow) {
  if (campaign.discount_type === "free_shipping") {
    return "Free shipping";
  }

  if (campaign.discount_type === "percentage") {
    return `${money(campaign.discount_value)}% off`;
  }

  return `${money(campaign.discount_value).toFixed(2)} off`;
}

function calculateDiscount(campaign: DiscountCampaignRow, eligibleSubtotal: number, shippingAmount: number) {
  if (campaign.discount_type === "free_shipping") {
    return money(shippingAmount);
  }

  const value = money(campaign.discount_value);
  const rawDiscount =
    campaign.discount_type === "percentage" ? eligibleSubtotal * Math.min(value, 100) / 100 : value;

  return Math.min(eligibleSubtotal, Math.max(0, Number(rawDiscount.toFixed(2))));
}

function customerMatchesSegment(customer: CustomerRow | null, segment: string, digitalCustomerIds: Set<string>) {
  if (segment === "all_customers") {
    return true;
  }

  if (!customer) {
    return false;
  }

  if (segment === "new_customers") {
    return (customer.segment ?? "new") === "new" || (customer.total_orders ?? 0) <= 1;
  }

  if (segment === "returning_customers") {
    return (customer.segment === "returning" || (customer.total_orders ?? 0) >= 2) && customer.segment !== "vip";
  }

  if (segment === "vip_customers") {
    return customer.segment === "vip" || (customer.total_orders ?? 0) >= 10 || numericValue(customer.total_spent) >= 1000;
  }

  return digitalCustomerIds.has(customer.id);
}

function storeOrderHasDigitalItems(value: unknown) {
  if (!Array.isArray(value)) {
    return false;
  }

  return value.some((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return false;
    }

    const record = item as Record<string, unknown>;
    return (
      record.productType === "digital" ||
      record.product_type === "digital" ||
      Boolean(record.digitalDeliveryStatus) ||
      Boolean(record.digitalFileName)
    );
  });
}

async function customerForEmail({
  customerEmail,
  storeId,
  supabase,
  workspaceId
}: {
  customerEmail?: string | null;
  storeId: string;
  supabase: SupabaseClient;
  workspaceId?: string | null;
}) {
  const email = cleanEmail(customerEmail);

  if (!email) {
    return null;
  }

  let query = supabase
    .from("store_customers" as never)
    .select("id, email, normalized_email, segment, total_orders, total_spent")
    .eq("store_id" as never, storeId as never)
    .or(`normalized_email.eq.${email},email.eq.${email}` as never)
    .limit(1);

  if (workspaceId) {
    query = query.eq("workspace_id" as never, workspaceId as never);
  }

  const { data } = await query.maybeSingle();
  return (data as CustomerRow | null) ?? null;
}

async function digitalCustomerIdsForStore({
  storeId,
  supabase,
  workspaceId
}: {
  storeId: string;
  supabase: SupabaseClient;
  workspaceId?: string | null;
}) {
  let customerQuery = supabase
    .from("store_customers" as never)
    .select("id, email, normalized_email")
    .eq("store_id" as never, storeId as never);

  if (workspaceId) {
    customerQuery = customerQuery.eq("workspace_id" as never, workspaceId as never);
  }

  const { data: customers } = await customerQuery;
  const emailToCustomerId = new Map(
    ((customers ?? []) as unknown as CustomerRow[])
      .map((customer) => [cleanEmail(customer.normalized_email || customer.email), customer.id] as const)
      .filter(([email]) => Boolean(email))
  );
  let orderQuery = supabase
    .from("store_orders" as never)
    .select("customer_email, items")
    .eq("store_id" as never, storeId as never);

  if (workspaceId) {
    orderQuery = orderQuery.eq("workspace_id" as never, workspaceId as never);
  }

  const { data: orders } = await orderQuery;
  const customerIds = new Set<string>();

  for (const order of (orders ?? []) as unknown as Array<{ customer_email?: string | null; items?: unknown }>) {
    if (!storeOrderHasDigitalItems(order.items)) {
      continue;
    }

    const customerId = emailToCustomerId.get(cleanEmail(order.customer_email));

    if (customerId) {
      customerIds.add(customerId);
    }
  }

  return customerIds;
}

function eligibleSubtotalForCampaign({
  campaign,
  items,
  rulesByCampaign
}: {
  campaign: DiscountCampaignRow;
  items: DiscountCampaignCartItem[];
  rulesByCampaign: Map<string, DiscountCampaignRuleRow[]>;
}) {
  const rules = rulesByCampaign.get(campaign.id) ?? [];
  const productIds = new Set(
    rules.filter((rule) => rule.rule_type === "product" && rule.rule_value).map((rule) => rule.rule_value as string)
  );
  const categoryIds = new Set(
    rules.filter((rule) => rule.rule_type === "category" && rule.rule_value).map((rule) => rule.rule_value as string)
  );
  const appliesToAllProducts = rules.some((rule) => rule.rule_type === "all_products") || (!productIds.size && !categoryIds.size);

  return money(
    items.reduce((sum, item) => {
      if (
        appliesToAllProducts ||
        productIds.has(item.productId) ||
        (item.categoryId && categoryIds.has(item.categoryId))
      ) {
        return sum + money(item.subtotal);
      }

      return sum;
    }, 0)
  );
}

export async function findActiveDiscountCampaignForCart(
  supabase: SupabaseClient,
  input: {
    customerEmail?: string | null;
    items: DiscountCampaignCartItem[];
    shippingAmount?: number;
    storeId: string;
    workspaceId?: string | null;
  }
): Promise<AppliedDiscountCampaign | null> {
  if (!input.storeId || !input.items.length) {
    return null;
  }

  const now = new Date().toISOString();
  let campaignQuery = supabase
    .from("discount_campaigns" as never)
    .select("id, workspace_id, store_id, name, discount_type, discount_value, status, starts_at, ends_at")
    .eq("store_id" as never, input.storeId as never)
    .eq("status" as never, "active" as never)
    .or(`starts_at.is.null,starts_at.lte.${now}` as never)
    .or(`ends_at.is.null,ends_at.gte.${now}` as never)
    .order("created_at" as never, { ascending: false } as never);

  if (input.workspaceId) {
    campaignQuery = campaignQuery.eq("workspace_id" as never, input.workspaceId as never);
  }

  const { data: campaigns, error } = await campaignQuery;

  if (error || !campaigns?.length) {
    return null;
  }

  const campaignRows = campaigns as unknown as DiscountCampaignRow[];
  const campaignIds = campaignRows.map((campaign) => campaign.id);
  let rulesQuery = supabase
    .from("discount_campaign_rules" as never)
    .select("campaign_id, rule_type, rule_value")
    .in("campaign_id" as never, campaignIds as never);

  if (input.workspaceId) {
    rulesQuery = rulesQuery.eq("workspace_id" as never, input.workspaceId as never);
  }

  const { data: rules } = await rulesQuery.eq("store_id" as never, input.storeId as never);
  const rulesByCampaign = new Map<string, DiscountCampaignRuleRow[]>();

  for (const rule of (rules ?? []) as unknown as DiscountCampaignRuleRow[]) {
    rulesByCampaign.set(rule.campaign_id, [...(rulesByCampaign.get(rule.campaign_id) ?? []), rule]);
  }

  const segmentValues = new Set(
    ((rules ?? []) as unknown as DiscountCampaignRuleRow[])
      .filter((rule) => rule.rule_type === "customer_segment" && rule.rule_value)
      .map((rule) => rule.rule_value as string)
  );
  const customer = segmentValues.size
    ? await customerForEmail({
        customerEmail: input.customerEmail,
        storeId: input.storeId,
        supabase,
        workspaceId: input.workspaceId
      })
    : null;
  const digitalCustomerIds = segmentValues.has("digital_product_customers")
    ? await digitalCustomerIdsForStore({
        storeId: input.storeId,
        supabase,
        workspaceId: input.workspaceId
      })
    : new Set<string>();
  let best: AppliedDiscountCampaign | null = null;

  for (const campaign of campaignRows) {
    const campaignRules = rulesByCampaign.get(campaign.id) ?? [];
    const segmentRules = campaignRules.filter((rule) => rule.rule_type === "customer_segment" && rule.rule_value);
    const matchesSegment =
      !segmentRules.length ||
      segmentRules.some((rule) => customerMatchesSegment(customer, rule.rule_value as string, digitalCustomerIds));

    if (!matchesSegment) {
      continue;
    }

    const eligibleSubtotal = eligibleSubtotalForCampaign({
      campaign,
      items: input.items,
      rulesByCampaign
    });
    const discountAmount = calculateDiscount(campaign, eligibleSubtotal, money(input.shippingAmount));

    if (discountAmount <= 0) {
      continue;
    }

    const applied = {
      campaign,
      discountAmount,
      discountLabel: formatDiscountLabel(campaign),
      freeShipping: campaign.discount_type === "free_shipping"
    };

    if (!best || applied.discountAmount > best.discountAmount) {
      best = applied;
    }
  }

  return best;
}
