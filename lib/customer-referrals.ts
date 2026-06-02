import type { SupabaseClient } from "@supabase/supabase-js";

export type ReferralCodeRow = {
  code: string;
  customer_id: string;
  id: string;
  status: string;
  store_id: string;
  workspace_id: string;
};

export type ReferralRow = {
  created_at: string;
  id: string;
  referral_code: string;
  referred_email?: string | null;
  referred_order_id?: string | null;
  referred_order_source?: "orders" | "store_orders" | null;
  referred_phone?: string | null;
  status: "cancelled" | "pending" | "qualified" | "rewarded";
};

export type CustomerReferralOverview = {
  code: string | null;
  referralLink: string | null;
  referrals: ReferralRow[];
};

function normalizePhone(value: string | null | undefined) {
  return (value ?? "").replace(/[^0-9+]/g, "");
}

function normalizeEmail(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

export function normalizeReferralCode(value: FormDataEntryValue | string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 40);
}

function randomCodePart() {
  return Math.random().toString(36).replace(/[^a-z0-9]/gi, "").slice(2, 8).toUpperCase();
}

function fallbackReferralCode(customerId: string) {
  return `REF-${customerId.replace(/[^a-z0-9]/gi, "").slice(0, 6).toUpperCase()}-${randomCodePart()}`.slice(0, 40);
}

async function customerByPhone({
  phone,
  storeId,
  supabase,
  workspaceId
}: {
  phone: string;
  storeId: string;
  supabase: SupabaseClient;
  workspaceId: string | null;
}) {
  const normalizedPhone = normalizePhone(phone);

  if (!workspaceId || !normalizedPhone) {
    return null;
  }

  const { data } = await supabase
    .from("store_customers" as never)
    .select("id, workspace_id, store_id, name, email, phone, normalized_email, normalized_phone")
    .eq("workspace_id" as never, workspaceId as never)
    .eq("store_id" as never, storeId as never)
    .eq("normalized_phone" as never, normalizedPhone as never)
    .maybeSingle();

  return data as {
    email?: string | null;
    id: string;
    name?: string | null;
    normalized_email?: string | null;
    normalized_phone?: string | null;
    phone?: string | null;
    store_id: string;
    workspace_id: string;
  } | null;
}

async function customerForOrder({
  customerEmail,
  customerName,
  customerPhone,
  storeId,
  supabase,
  workspaceId
}: {
  customerEmail?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  storeId: string;
  supabase: SupabaseClient;
  workspaceId: string | null;
}) {
  const normalizedPhone = normalizePhone(customerPhone);
  const normalizedEmail = normalizeEmail(customerEmail);

  if (!workspaceId || (!normalizedPhone && !normalizedEmail)) {
    return null;
  }

  const selectCustomer = "id, workspace_id, store_id, name, email, phone, normalized_email, normalized_phone";
  const phoneResult = normalizedPhone
    ? await supabase
        .from("store_customers" as never)
        .select(selectCustomer)
        .eq("workspace_id" as never, workspaceId as never)
        .eq("store_id" as never, storeId as never)
        .eq("normalized_phone" as never, normalizedPhone as never)
        .maybeSingle()
    : { data: null };
  const emailResult = !phoneResult.data && normalizedEmail
    ? await supabase
        .from("store_customers" as never)
        .select(selectCustomer)
        .eq("workspace_id" as never, workspaceId as never)
        .eq("store_id" as never, storeId as never)
        .eq("normalized_email" as never, normalizedEmail as never)
        .maybeSingle()
    : { data: null };
  const existing = phoneResult.data ?? emailResult.data;

  if (existing) {
    return existing as {
      email?: string | null;
      id: string;
      normalized_email?: string | null;
      normalized_phone?: string | null;
      phone?: string | null;
      store_id: string;
      workspace_id: string;
    };
  }

  const { data: created } = await supabase
    .from("store_customers" as never)
    .insert({
      email: normalizedEmail || null,
      name: customerName?.trim() || "Customer",
      normalized_email: normalizedEmail || null,
      normalized_phone: normalizedPhone || null,
      phone: customerPhone || null,
      store_id: storeId,
      workspace_id: workspaceId
    } as never)
    .select("id, workspace_id, store_id, name, email, phone, normalized_email, normalized_phone")
    .maybeSingle();

  return created as {
    email?: string | null;
    id: string;
    normalized_email?: string | null;
    normalized_phone?: string | null;
    phone?: string | null;
    store_id: string;
    workspace_id: string;
  } | null;
}

export async function getOrCreateCustomerReferralCode({
  customerId,
  storeId,
  supabase,
  workspaceId
}: {
  customerId: string;
  storeId: string;
  supabase: SupabaseClient;
  workspaceId: string;
}) {
  const { data: existing } = await supabase
    .from("store_customer_referral_codes" as never)
    .select("id, workspace_id, store_id, customer_id, code, status")
    .eq("workspace_id" as never, workspaceId as never)
    .eq("store_id" as never, storeId as never)
    .eq("customer_id" as never, customerId as never)
    .maybeSingle();

  if (existing) {
    return existing as ReferralCodeRow;
  }

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = fallbackReferralCode(customerId);
    const { data, error } = await supabase
      .from("store_customer_referral_codes" as never)
      .insert({
        code,
        customer_id: customerId,
        status: "active",
        store_id: storeId,
        workspace_id: workspaceId
      } as never)
      .select("id, workspace_id, store_id, customer_id, code, status")
      .maybeSingle();

    if (!error && data) {
      return data as ReferralCodeRow;
    }
  }

  return null;
}

export async function loadCustomerReferralOverview({
  baseUrl,
  phone,
  slug,
  storeId,
  supabase,
  workspaceId
}: {
  baseUrl: string;
  phone: string;
  slug: string;
  storeId: string;
  supabase: SupabaseClient;
  workspaceId: string | null;
}): Promise<CustomerReferralOverview> {
  const customer = await customerByPhone({ phone, storeId, supabase, workspaceId });

  if (!customer || !workspaceId) {
    return { code: null, referralLink: null, referrals: [] };
  }

  const code = await getOrCreateCustomerReferralCode({
    customerId: customer.id,
    storeId,
    supabase,
    workspaceId
  });

  if (!code) {
    return { code: null, referralLink: null, referrals: [] };
  }

  const { data: referrals } = await supabase
    .from("store_referrals" as never)
    .select("id, referral_code, referred_email, referred_phone, referred_order_source, referred_order_id, status, created_at")
    .eq("workspace_id" as never, workspaceId as never)
    .eq("store_id" as never, storeId as never)
    .eq("referrer_customer_id" as never, customer.id as never)
    .order("created_at" as never, { ascending: false } as never)
    .limit(50);

  const origin = baseUrl.replace(/\/$/, "");

  return {
    code: code.code,
    referralLink: `${origin}/store/${encodeURIComponent(slug)}?ref=${encodeURIComponent(code.code)}`,
    referrals: (referrals ?? []) as unknown as ReferralRow[]
  };
}

export async function recordReferralForOrder(
  supabase: SupabaseClient,
  input: {
    customerEmail?: string | null;
    customerName?: string | null;
    customerPhone?: string | null;
    orderId: string;
    orderSource: "orders" | "store_orders";
    referralCode?: string | null;
    storeId: string;
    workspaceId?: string | null;
  }
) {
  const code = normalizeReferralCode(input.referralCode);
  const workspaceId = input.workspaceId ?? null;

  if (!code || !workspaceId) {
    return null;
  }

  const { data: codeRow } = await supabase
    .from("store_customer_referral_codes" as never)
    .select("id, workspace_id, store_id, customer_id, code, status")
    .eq("workspace_id" as never, workspaceId as never)
    .eq("store_id" as never, input.storeId as never)
    .eq("code" as never, code as never)
    .eq("status" as never, "active" as never)
    .maybeSingle();
  const referralCode = codeRow as ReferralCodeRow | null;

  if (!referralCode) {
    return null;
  }

  const referredCustomer = await customerForOrder({
    customerEmail: input.customerEmail,
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    storeId: input.storeId,
    supabase,
    workspaceId
  });

  if (referredCustomer?.id === referralCode.customer_id) {
    return null;
  }

  const { data: existingReferral } = await supabase
    .from("store_referrals" as never)
    .select("id")
    .eq("store_id" as never, input.storeId as never)
    .eq("referred_order_source" as never, input.orderSource as never)
    .eq("referred_order_id" as never, input.orderId as never)
    .maybeSingle();

  if (existingReferral) {
    return (existingReferral as { id: string }).id;
  }

  const { data: referral, error } = await supabase
    .from("store_referrals" as never)
    .insert({
      metadata: {
        source: "checkout_order"
      },
      referral_code: referralCode.code,
      referral_code_id: referralCode.id,
      referred_customer_id: referredCustomer?.id ?? null,
      referred_email: normalizeEmail(input.customerEmail) || null,
      referred_order_id: input.orderId,
      referred_order_source: input.orderSource,
      referred_phone: normalizePhone(input.customerPhone) || null,
      referrer_customer_id: referralCode.customer_id,
      reward_status: "ready",
      status: "qualified",
      store_id: input.storeId,
      workspace_id: workspaceId
    } as never)
    .select("id")
    .maybeSingle();

  if (error || !referral) {
    console.warn("[referrals] referral attribution failed", {
      code: error?.code,
      message: error?.message,
      orderId: input.orderId,
      storeId: input.storeId
    });
    return null;
  }

  return (referral as { id: string }).id;
}
