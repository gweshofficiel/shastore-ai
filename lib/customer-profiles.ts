import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeCustomerPhone } from "@/lib/customer-account";

export type CustomerProfile = {
  email: string;
  id: string;
  name: string | null;
  phone: string;
  user_id: string;
};

export type CustomerLinkedStore = {
  currency: string;
  latestActivityAt: string | null;
  linkId: string;
  ordersCount: number;
  storeId: string;
  storeName: string;
  storeSlug: string | null;
  totalSpent: number;
};

function normalizeEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function fallbackName(email: string) {
  return email.split("@")[0]?.replace(/[._-]+/g, " ").trim() || "Customer";
}

function toCustomerProfile(row: Record<string, unknown>): CustomerProfile {
  return {
    email: String(row.email ?? ""),
    id: String(row.id),
    name: typeof row.name === "string" ? row.name : null,
    phone: String(row.phone ?? ""),
    user_id: String(row.user_id)
  };
}

export async function ensureCustomerProfileForUser({
  email,
  name,
  phone,
  userId
}: {
  email: string | null | undefined;
  name?: string | null;
  phone: string | null | undefined;
  userId: string;
}) {
  const admin = createAdminClient();
  const normalizedEmail = normalizeEmail(email);
  const normalizedPhone = normalizeCustomerPhone(phone);

  if (!admin || !normalizedEmail || !normalizedPhone) {
    console.warn("[customer-profile] profile creation unavailable", {
      hasAdminClient: Boolean(admin),
      hasEmail: Boolean(normalizedEmail),
      hasPhone: Boolean(normalizedPhone),
      userId
    });
    return null;
  }

  const { data, error } = await admin
    .from("customer_profiles" as never)
    .upsert(
      {
        email: normalizedEmail,
        name: name?.trim() || fallbackName(normalizedEmail),
        phone: normalizedPhone,
        user_id: userId
      } as never,
      { onConflict: "user_id" } as never
    )
    .select("*")
    .single();

  if (error) {
    console.warn("[customer-profile] profile upsert failed", {
      code: error.code,
      message: error.message,
      userId
    });
    return null;
  }

  return toCustomerProfile(data as unknown as Record<string, unknown>);
}

export async function getCustomerProfileForUser(userId: string) {
  const admin = createAdminClient();

  if (!admin) {
    return null;
  }

  const { data, error } = await admin
    .from("customer_profiles" as never)
    .select("*")
    .eq("user_id" as never, userId as never)
    .maybeSingle();

  if (error) {
    console.warn("[customer-profile] profile lookup failed", {
      code: error.code,
      message: error.message,
      userId
    });
    return null;
  }

  return data ? toCustomerProfile(data as unknown as Record<string, unknown>) : null;
}

export function customerNameFromUser(user: User) {
  return typeof user.user_metadata?.name === "string"
    ? user.user_metadata.name
    : typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : null;
}

export async function linkStoreCustomersForUser({
  email,
  phone,
  userId
}: {
  email: string;
  phone: string;
  userId: string;
}) {
  const admin = createAdminClient();
  const normalizedEmail = normalizeEmail(email);
  const normalizedPhone = normalizeCustomerPhone(phone);

  if (!admin || (!normalizedEmail && !normalizedPhone)) {
    return;
  }

  const profile = await getCustomerProfileForUser(userId);
  const { data, error } = await admin
    .from("store_customers" as never)
    .select("id, workspace_id, store_id, total_orders, total_spent, last_order_at, metadata")
    .or(
      [
        normalizedEmail ? `normalized_email.eq.${normalizedEmail}` : "",
        normalizedPhone ? `normalized_phone.eq.${normalizedPhone}` : ""
      ].filter(Boolean).join(",")
    );

  if (error) {
    console.warn("[customer-profile] store customer lookup failed", {
      code: error.code,
      message: error.message,
      userId
    });
    return;
  }

  for (const row of (data ?? []) as unknown as Array<{
    id: string;
    last_order_at?: string | null;
    metadata?: Record<string, unknown> | null;
    store_id?: string | null;
    total_orders?: number | null;
    total_spent?: number | string | null;
    workspace_id?: string | null;
  }>) {
    await admin
      .from("store_customers" as never)
      .update({
        customer_auth_user_id: userId,
        customer_profile_id: profile?.id ?? null,
        metadata: {
          ...(row.metadata ?? {}),
          auth_user_id: userId,
          auth_linked_at: new Date().toISOString(),
          auth_link_source: "customer_account"
        }
      } as never)
      .eq("id" as never, row.id as never);

    if (profile && row.store_id) {
      await admin.from("customer_store_links" as never).upsert(
        {
          customer_auth_user_id: userId,
          customer_profile_id: profile.id,
          latest_order_at: row.last_order_at ?? null,
          metadata: {
            source: "store_customer_auto_link"
          },
          orders_count: row.total_orders ?? 0,
          store_customer_id: row.id,
          store_id: row.store_id,
          workspace_id: row.workspace_id ?? null
        } as never,
        { onConflict: "customer_profile_id,store_id" } as never
      );
    }
  }
}

async function orderStatsForStore({
  profileId,
  storeId,
  userId
}: {
  profileId: string;
  storeId: string;
  userId: string;
}) {
  const admin = createAdminClient();

  if (!admin) {
    return { latestOrderAt: null, ordersCount: 0, totalSpent: 0 };
  }

  const [ordersResult, storeOrdersResult] = await Promise.all([
    admin
      .from("orders" as never)
      .select("created_at, total, total_amount")
      .or(`customer_auth_user_id.eq.${userId},customer_profile_id.eq.${profileId}`)
      .or(`store_id.eq.${storeId},store_instance_id.eq.${storeId}`),
    admin
      .from("store_orders" as never)
      .select("created_at, total, total_amount")
      .or(`customer_auth_user_id.eq.${userId},customer_profile_id.eq.${profileId}`)
      .eq("store_id" as never, storeId as never)
  ]);
  const rows = [
    ...((ordersResult.data ?? []) as unknown as Array<{ created_at?: string | null; total?: number | string | null; total_amount?: number | string | null }>),
    ...((storeOrdersResult.data ?? []) as unknown as Array<{ created_at?: string | null; total?: number | string | null; total_amount?: number | string | null }>)
  ];

  return {
    latestOrderAt: rows
      .map((row) => row.created_at)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) ?? null,
    ordersCount: rows.length,
    totalSpent: rows.reduce((sum, row) => {
      const value = row.total_amount ?? row.total ?? 0;
      const amount = typeof value === "number" ? value : Number.parseFloat(String(value));
      return sum + (Number.isFinite(amount) ? amount : 0);
    }, 0)
  };
}

export async function linkCustomerStoreIdentity({
  customerEmail,
  customerName,
  customerPhone,
  orderCreatedAt,
  orderId,
  orderSource,
  profileId,
  storeId,
  userId,
  workspaceId
}: {
  customerEmail: string;
  customerName: string;
  customerPhone: string;
  orderCreatedAt?: string | null;
  orderId: string;
  orderSource: "orders" | "store_orders";
  profileId: string;
  storeId: string;
  userId: string;
  workspaceId: string | null;
}) {
  const admin = createAdminClient();
  const normalizedEmail = normalizeEmail(customerEmail);
  const normalizedPhone = normalizeCustomerPhone(customerPhone);

  if (!admin || !storeId) {
    return;
  }

  const profile = await getCustomerProfileForUser(userId);
  const { data: existingRows } = await admin
    .from("store_customers" as never)
    .select("id, metadata")
    .eq("store_id" as never, storeId as never)
    .or(
      [
        `customer_auth_user_id.eq.${userId}`,
        `customer_profile_id.eq.${profileId}`,
        normalizedEmail ? `normalized_email.eq.${normalizedEmail}` : "",
        normalizedPhone ? `normalized_phone.eq.${normalizedPhone}` : ""
      ].filter(Boolean).join(",")
    );
  const existing = ((existingRows ?? []) as unknown as Array<{ id: string; metadata?: Record<string, unknown> | null }>)[0] ?? null;
  const storeCustomerPayload = {
    customer_auth_user_id: userId,
    customer_profile_id: profileId,
    email: normalizedEmail || customerEmail || profile?.email || null,
    metadata: {
      ...(existing?.metadata ?? {}),
      auth_link_source: "authenticated_order",
      auth_user_id: userId,
      last_order_id: orderId,
      last_order_source: orderSource
    },
    name: customerName || profile?.name || "Customer",
    phone: normalizedPhone || customerPhone || profile?.phone || "",
    status: "active",
    store_id: storeId,
    updated_at: new Date().toISOString(),
    workspace_id: workspaceId
  };
  const storeCustomerResult = existing
    ? await admin
        .from("store_customers" as never)
        .update(storeCustomerPayload as never)
        .eq("id" as never, existing.id as never)
        .select("id")
        .maybeSingle()
    : await admin
        .from("store_customers" as never)
        .insert({ ...storeCustomerPayload, created_at: new Date().toISOString() } as never)
        .select("id")
        .maybeSingle();
  const storeCustomerId = ((storeCustomerResult.data as { id?: string } | null)?.id ?? existing?.id) || null;

  if (storeCustomerResult.error) {
    console.warn("[customer-identity] store customer link failed", {
      code: storeCustomerResult.error.code,
      message: storeCustomerResult.error.message,
      orderId,
      storeId,
      userId
    });
  }

  await admin
    .from(orderSource as never)
    .update({
      customer_auth_user_id: userId,
      customer_profile_id: profileId
    } as never)
    .eq("id" as never, orderId as never);

  const stats = await orderStatsForStore({ profileId, storeId, userId });
  const { error } = await admin.from("customer_store_links" as never).upsert(
    {
      customer_auth_user_id: userId,
      customer_profile_id: profileId,
      latest_order_at: stats.latestOrderAt ?? orderCreatedAt ?? new Date().toISOString(),
      metadata: {
        last_order_id: orderId,
        last_order_source: orderSource,
        source: "authenticated_order"
      },
      orders_count: Math.max(stats.ordersCount, 1),
      store_customer_id: storeCustomerId,
      store_id: storeId,
      workspace_id: workspaceId
    } as never,
    { onConflict: "customer_profile_id,store_id" } as never
  );

  if (error) {
    console.warn("[customer-identity] customer store link upsert failed", {
      code: error.code,
      message: error.message,
      orderId,
      storeId,
      userId
    });
  }
}

export async function getCustomerLinkedStores(userId: string): Promise<CustomerLinkedStore[]> {
  const admin = createAdminClient();
  const profile = await getCustomerProfileForUser(userId);

  if (!admin || !profile) {
    return [];
  }

  const { data, error } = await admin
    .from("customer_store_links" as never)
    .select("id, store_id, orders_count, latest_order_at, stores(name, slug, currency)")
    .eq("customer_auth_user_id" as never, userId as never)
    .eq("status" as never, "active" as never)
    .order("latest_order_at" as never, { ascending: false, nullsFirst: false } as never);

  if (error) {
    console.warn("[customer-identity] linked stores lookup failed", {
      code: error.code,
      message: error.message,
      userId
    });
    return [];
  }

  return ((data ?? []) as unknown as Array<{
    id: string;
    latest_order_at?: string | null;
    orders_count?: number | null;
    store_id: string;
    stores?: { currency?: string | null; name?: string | null; slug?: string | null } | null;
  }>).map((row) => ({
    currency: row.stores?.currency ?? "USD",
    latestActivityAt: row.latest_order_at ?? null,
    linkId: row.id,
    ordersCount: row.orders_count ?? 0,
    storeId: row.store_id,
    storeName: row.stores?.name ?? "Store account",
    storeSlug: row.stores?.slug ?? null,
    totalSpent: 0
  }));
}
