import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { loadCustomerDownloads } from "@/lib/customer-downloads";
import { loadCustomerLoyalty } from "@/lib/customer-loyalty";
import { getCustomerProfileForUser } from "@/lib/customer-profiles";
import { getPublicStorefrontPreview } from "@/lib/public-storefront-preview";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

export type CustomerAccountOrderSummary = {
  createdAt: string;
  currency: string;
  customerEmail: string | null;
  customerName: string;
  fulfillmentStatus: string;
  id: string;
  itemCount: number;
  orderStatus: string;
  paymentStatus: string;
  source: "orders" | "store_orders";
  total: number | string;
};

export type CustomerAccountProfile = {
  email: string | null;
  id: string | null;
  loyaltyTier: string | null;
  name: string;
  phone: string;
  preferredContact: string | null;
  segment: string | null;
  totalOrders: number;
  totalSpent: number;
};

export type CustomerAccountPortal = {
  downloads: Awaited<ReturnType<typeof loadCustomerDownloads>>;
  licenseCount: number;
  loyalty: Awaited<ReturnType<typeof loadCustomerLoyalty>>;
  orders: CustomerAccountOrderSummary[];
  profile: CustomerAccountProfile | null;
};

function cleanText(value: FormDataEntryValue | string | null | undefined, maxLength = 500) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export function normalizeCustomerPhone(value: string | null | undefined) {
  return (value ?? "").replace(/\D/g, "").slice(0, 40);
}

function normalizeEmail(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase().slice(0, 180);
}

function metadataAuthUserId(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const authUserId = (value as Record<string, unknown>).auth_user_id;
  return typeof authUserId === "string" ? authUserId : null;
}

export function numericValue(value: number | string | null | undefined) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

export function formatAccountMoney(amount: number | string, currency = "USD") {
  return new Intl.NumberFormat("en", {
    currency,
    style: "currency"
  }).format(numericValue(amount));
}

export function formatAccountDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

export function orderReference(id: string) {
  return id.slice(0, 8).toUpperCase();
}

export function accountStatusLabel(status: string | null | undefined) {
  const labels: Record<string, string> = {
    cancelled: "Cancelled",
    delivered: "Delivered",
    none: "Not available",
    out_for_delivery: "Out for Delivery",
    paid: "Paid",
    pending: "Pending",
    preparing: "Preparing",
    processing: "Processing",
    ready: "Ready",
    ready_for_pickup: "Ready for Pickup",
    refunded: "Refunded",
    returned: "Returned",
    shipped: "Shipped",
    unfulfilled: "Pending"
  };
  const normalized = status?.trim() || "pending";

  return labels[normalized] ?? normalized.replaceAll("_", " ");
}

function jsonItems(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item))) : [];
}

function itemCount(value: unknown) {
  return jsonItems(value).reduce((total, item) => {
    const quantity = typeof item.quantity === "number" ? item.quantity : 1;
    return total + Math.max(1, quantity);
  }, 0);
}

async function getStoreInstanceIds(admin: SupabaseClient, storeId: string, slug: string) {
  const ids = new Set([storeId]);
  const { data } = await admin
    .from("store_instances" as never)
    .select("id")
    .or(`id.eq.${storeId},internal_slug.eq.${slug}`);

  for (const row of (data ?? []) as unknown as Array<{ id?: string | null }>) {
    if (row.id) {
      ids.add(row.id);
    }
  }

  return Array.from(ids);
}

async function loadCustomerProfile({
  admin,
  phone,
  storeId,
  workspaceId
}: {
  admin: SupabaseClient;
  phone: string;
  storeId: string;
  workspaceId: string | null;
}) {
  const normalizedPhone = normalizeCustomerPhone(phone);

  if (!workspaceId || !normalizedPhone) {
    return null;
  }

  const { data } = await admin
    .from("store_customers" as never)
    .select("id, name, email, phone, segment, loyalty_tier, total_orders, total_spent, metadata")
    .eq("workspace_id" as never, workspaceId as never)
    .eq("store_id" as never, storeId as never)
    .eq("normalized_phone" as never, normalizedPhone as never)
    .maybeSingle();
  const row = data as {
    email?: string | null;
    id: string;
    loyalty_tier?: string | null;
    metadata?: Json;
    name?: string | null;
    phone?: string | null;
    segment?: string | null;
    total_orders?: number | null;
    total_spent?: number | string | null;
  } | null;

  if (!row) {
    return null;
  }

  const metadata = row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
    ? row.metadata as Record<string, Json | undefined>
    : {};

  return {
    email: row.email ?? null,
    id: row.id,
    loyaltyTier: row.loyalty_tier ?? null,
    name: row.name?.trim() || "Customer",
    phone: row.phone || phone,
    preferredContact: typeof metadata.preferredContact === "string" ? metadata.preferredContact : null,
    segment: row.segment ?? null,
    totalOrders: row.total_orders ?? 0,
    totalSpent: numericValue(row.total_spent)
  };
}

async function loadAuthenticatedStoreCustomerProfile({
  admin,
  email,
  phone,
  storeId,
  userId,
  workspaceId
}: {
  admin: SupabaseClient;
  email: string;
  phone: string;
  storeId: string;
  userId: string;
  workspaceId: string | null;
}) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedPhone = normalizeCustomerPhone(phone);

  if (!workspaceId) {
    return null;
  }

  const { data } = await admin
    .from("store_customers" as never)
    .select("id, name, email, phone, segment, loyalty_tier, total_orders, total_spent, metadata")
    .eq("workspace_id" as never, workspaceId as never)
    .eq("store_id" as never, storeId as never);

  const row = ((data ?? []) as unknown as Array<{
    email?: string | null;
    id: string;
    loyalty_tier?: string | null;
    metadata?: Json;
    name?: string | null;
    normalized_email?: string | null;
    normalized_phone?: string | null;
    phone?: string | null;
    segment?: string | null;
    total_orders?: number | null;
    total_spent?: number | string | null;
  }>).find((candidate) => {
    const candidateMetadata = candidate.metadata && typeof candidate.metadata === "object" && !Array.isArray(candidate.metadata)
      ? candidate.metadata as Record<string, Json | undefined>
      : {};
    return (
      metadataAuthUserId(candidateMetadata) === userId ||
      normalizeEmail(candidate.email) === normalizedEmail ||
      normalizeCustomerPhone(candidate.phone) === normalizedPhone
    );
  }) ?? null;

  if (!row) {
    return null;
  }

  const metadata = row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
    ? row.metadata as Record<string, Json | undefined>
    : {};

  return {
    email: row.email ?? email,
    id: row.id,
    loyaltyTier: row.loyalty_tier ?? null,
    name: row.name?.trim() || "Customer",
    phone: row.phone || phone,
    preferredContact: typeof metadata.preferredContact === "string" ? metadata.preferredContact : null,
    segment: row.segment ?? null,
    totalOrders: row.total_orders ?? 0,
    totalSpent: numericValue(row.total_spent)
  };
}

async function loadCustomerOrders({
  admin,
  phone,
  slug,
  storeCurrency,
  storeId
}: {
  admin: SupabaseClient;
  phone: string;
  slug: string;
  storeCurrency: string;
  storeId: string;
}) {
  const normalizedPhone = normalizeCustomerPhone(phone);

  if (!normalizedPhone) {
    return [];
  }

  const storeInstanceIds = await getStoreInstanceIds(admin, storeId, slug);
  const [ordersResult, orderItemsResult, storeOrdersResult] = await Promise.all([
    admin
      .from("orders" as never)
      .select("id, store_id, store_instance_id, customer_name, customer_email, customer_phone, created_at, currency, total, total_amount, order_status, payment_status, fulfillment_status")
      .order("created_at" as never, { ascending: false } as never)
      .limit(100),
    admin
      .from("order_items" as never)
      .select("order_id, quantity")
      .limit(500),
    admin
      .from("store_orders")
      .select("id, store_id, customer_name, customer_email, customer_phone, created_at, items, total, total_amount, order_status, payment_status, fulfillment_status")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false })
      .limit(100)
  ]);
  const itemCounts = new Map<string, number>();

  for (const item of (orderItemsResult.data ?? []) as unknown as Array<{ order_id?: string | null; quantity?: number | null }>) {
    if (!item.order_id) {
      continue;
    }
    itemCounts.set(item.order_id, (itemCounts.get(item.order_id) ?? 0) + Math.max(1, item.quantity ?? 1));
  }

  const orders = ((ordersResult.data ?? []) as unknown as Array<{
    created_at: string;
    currency: string | null;
    customer_email?: string | null;
    customer_name?: string | null;
    customer_phone: string | null;
    fulfillment_status: string | null;
    id: string;
    order_status: string | null;
    payment_status: string | null;
    store_id: string | null;
    store_instance_id: string | null;
    total: number | string;
    total_amount?: number | string | null;
  }>)
    .filter((order) => {
      const rowStoreId = order.store_id ?? order.store_instance_id ?? "";
      return storeInstanceIds.includes(rowStoreId) && normalizeCustomerPhone(order.customer_phone) === normalizedPhone;
    })
    .map((order): CustomerAccountOrderSummary => ({
      createdAt: order.created_at,
      currency: order.currency ?? storeCurrency,
      customerEmail: order.customer_email ?? null,
      customerName: order.customer_name?.trim() || "Customer",
      fulfillmentStatus: order.fulfillment_status ?? "pending",
      id: order.id,
      itemCount: itemCounts.get(order.id) ?? 0,
      orderStatus: order.order_status ?? "draft",
      paymentStatus: order.payment_status ?? "pending",
      source: "orders",
      total: order.total_amount ?? order.total
    }));
  const storeOrders = ((storeOrdersResult.data ?? []) as unknown as Array<{
    created_at: string;
    customer_email?: string | null;
    customer_name?: string | null;
    customer_phone: string | null;
    fulfillment_status: string | null;
    id: string;
    items?: unknown;
    order_status: string | null;
    payment_status: string | null;
    total: number | string;
    total_amount?: number | string | null;
  }>)
    .filter((order) => normalizeCustomerPhone(order.customer_phone) === normalizedPhone)
    .map((order): CustomerAccountOrderSummary => ({
      createdAt: order.created_at,
      currency: storeCurrency,
      customerEmail: order.customer_email ?? null,
      customerName: order.customer_name?.trim() || "Customer",
      fulfillmentStatus: order.fulfillment_status ?? "pending",
      id: order.id,
      itemCount: itemCount(order.items),
      orderStatus: order.order_status ?? "draft",
      paymentStatus: order.payment_status ?? "pending",
      source: "store_orders",
      total: order.total_amount ?? order.total
    }));

  return [...orders, ...storeOrders]
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, 50);
}

async function loadAuthenticatedCustomerOrders({
  admin,
  email,
  phone,
  slug,
  storeCurrency,
  storeId,
  userId
}: {
  admin: SupabaseClient;
  email: string;
  phone: string;
  slug: string;
  storeCurrency: string;
  storeId: string;
  userId: string;
}) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedPhone = normalizeCustomerPhone(phone);
  const storeInstanceIds = await getStoreInstanceIds(admin, storeId, slug);
  const [ordersResult, orderItemsResult, storeOrdersResult] = await Promise.all([
    admin
      .from("orders" as never)
      .select("id, store_id, store_instance_id, customer_auth_user_id, customer_name, customer_email, customer_phone, created_at, currency, total, total_amount, order_status, payment_status, fulfillment_status")
      .order("created_at" as never, { ascending: false } as never)
      .limit(100),
    admin
      .from("order_items" as never)
      .select("order_id, quantity")
      .limit(500),
    admin
      .from("store_orders")
      .select("id, store_id, customer_auth_user_id, customer_name, customer_email, customer_phone, created_at, items, total, total_amount, order_status, payment_status, fulfillment_status")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false })
      .limit(100)
  ]);
  const itemCounts = new Map<string, number>();

  for (const item of (orderItemsResult.data ?? []) as unknown as Array<{ order_id?: string | null; quantity?: number | null }>) {
    if (item.order_id) {
      itemCounts.set(item.order_id, (itemCounts.get(item.order_id) ?? 0) + Math.max(1, item.quantity ?? 1));
    }
  }

  const matchesIdentity = (order: { customer_auth_user_id?: string | null; customer_email?: string | null; customer_phone?: string | null }) =>
    order.customer_auth_user_id === userId ||
    (!!normalizedEmail && normalizeEmail(order.customer_email) === normalizedEmail) ||
    (!!normalizedPhone && normalizeCustomerPhone(order.customer_phone) === normalizedPhone);

  const orders = ((ordersResult.data ?? []) as unknown as Array<{
    created_at: string;
    currency: string | null;
    customer_auth_user_id?: string | null;
    customer_email?: string | null;
    customer_name?: string | null;
    customer_phone: string | null;
    fulfillment_status: string | null;
    id: string;
    order_status: string | null;
    payment_status: string | null;
    store_id: string | null;
    store_instance_id: string | null;
    total: number | string;
    total_amount?: number | string | null;
  }>)
    .filter((order) => {
      const rowStoreId = order.store_id ?? order.store_instance_id ?? "";
      return storeInstanceIds.includes(rowStoreId) && matchesIdentity(order);
    })
    .map((order): CustomerAccountOrderSummary => ({
      createdAt: order.created_at,
      currency: order.currency ?? storeCurrency,
      customerEmail: order.customer_email ?? null,
      customerName: order.customer_name?.trim() || "Customer",
      fulfillmentStatus: order.fulfillment_status ?? "pending",
      id: order.id,
      itemCount: itemCounts.get(order.id) ?? 0,
      orderStatus: order.order_status ?? "draft",
      paymentStatus: order.payment_status ?? "pending",
      source: "orders",
      total: order.total_amount ?? order.total
    }));
  const storeOrders = ((storeOrdersResult.data ?? []) as unknown as Array<{
    created_at: string;
    customer_auth_user_id?: string | null;
    customer_email?: string | null;
    customer_name?: string | null;
    customer_phone: string | null;
    fulfillment_status: string | null;
    id: string;
    items?: unknown;
    order_status: string | null;
    payment_status: string | null;
    total: number | string;
    total_amount?: number | string | null;
  }>)
    .filter(matchesIdentity)
    .map((order): CustomerAccountOrderSummary => ({
      createdAt: order.created_at,
      currency: storeCurrency,
      customerEmail: order.customer_email ?? null,
      customerName: order.customer_name?.trim() || "Customer",
      fulfillmentStatus: order.fulfillment_status ?? "pending",
      id: order.id,
      itemCount: itemCount(order.items),
      orderStatus: order.order_status ?? "draft",
      paymentStatus: order.payment_status ?? "pending",
      source: "store_orders",
      total: order.total_amount ?? order.total
    }));

  return [...orders, ...storeOrders]
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, 50);
}

export async function loadCustomerAccountPortal({
  phone,
  slug
}: {
  phone: string;
  slug: string;
}): Promise<CustomerAccountPortal> {
  const admin = createAdminClient();
  const preview = await getPublicStorefrontPreview(slug);

  if (!admin || !preview || !normalizeCustomerPhone(phone)) {
    return {
      downloads: [],
      licenseCount: 0,
      loyalty: { history: [], points: 0 },
      orders: [],
      profile: null
    };
  }

  const [orders, downloads, loyalty, profile] = await Promise.all([
    loadCustomerOrders({
      admin,
      phone,
      slug: preview.store.slug,
      storeCurrency: preview.store.currency,
      storeId: preview.store.id
    }),
    loadCustomerDownloads({ phone, slug: preview.store.slug }),
    loadCustomerLoyalty({
      phone,
      storeId: preview.store.id,
      supabase: admin,
      workspaceId: preview.store.workspaceId
    }),
    loadCustomerProfile({
      admin,
      phone,
      storeId: preview.store.id,
      workspaceId: preview.store.workspaceId
    })
  ]);

  return {
    downloads,
    licenseCount: downloads.filter((download) => Boolean(download.licenseKey)).length,
    loyalty,
    orders,
    profile
  };
}

export async function loadAuthenticatedCustomerAccountPortal({
  slug,
  userId
}: {
  slug: string;
  userId: string;
}): Promise<CustomerAccountPortal> {
  const admin = createAdminClient();
  const preview = await getPublicStorefrontPreview(slug);
  const customerProfile = await getCustomerProfileForUser(userId);

  if (!admin || !preview || !customerProfile) {
    return {
      downloads: [],
      licenseCount: 0,
      loyalty: { history: [], points: 0 },
      orders: [],
      profile: null
    };
  }

  const [orders, downloads, loyalty, profile] = await Promise.all([
    loadAuthenticatedCustomerOrders({
      admin,
      email: customerProfile.email,
      phone: customerProfile.phone,
      slug: preview.store.slug,
      storeCurrency: preview.store.currency,
      storeId: preview.store.id,
      userId
    }),
    loadCustomerDownloads({ phone: customerProfile.phone, slug: preview.store.slug }),
    loadCustomerLoyalty({
      phone: customerProfile.phone,
      storeId: preview.store.id,
      supabase: admin,
      workspaceId: preview.store.workspaceId
    }),
    loadAuthenticatedStoreCustomerProfile({
      admin,
      email: customerProfile.email,
      phone: customerProfile.phone,
      storeId: preview.store.id,
      userId,
      workspaceId: preview.store.workspaceId
    })
  ]);

  return {
    downloads,
    licenseCount: downloads.filter((download) => Boolean(download.licenseKey)).length,
    loyalty,
    orders,
    profile: profile ?? {
      email: customerProfile.email,
      id: customerProfile.id,
      loyaltyTier: null,
      name: customerProfile.name ?? "Customer",
      phone: customerProfile.phone,
      preferredContact: "email",
      segment: null,
      totalOrders: orders.length,
      totalSpent: orders.reduce((sum, order) => sum + numericValue(order.total), 0)
    }
  };
}

export async function updateCustomerAccountProfile(formData: FormData) {
  "use server";

  const slug = cleanText(formData.get("slug"), 120).toLowerCase();
  const currentPhone = cleanText(formData.get("currentPhone"), 80);
  const name = cleanText(formData.get("name"), 160) || "Customer";
  const email = normalizeEmail(cleanText(formData.get("email"), 180)) || null;
  const nextPhone = cleanText(formData.get("phone"), 80);
  const preferredContact = cleanText(formData.get("preferredContact"), 40);
  const normalizedCurrentPhone = normalizeCustomerPhone(currentPhone);
  const normalizedNextPhone = normalizeCustomerPhone(nextPhone || currentPhone);

  if (!slug || !normalizedCurrentPhone || !normalizedNextPhone) {
    redirect(`/store/${slug || ""}/account?profile=invalid`);
  }

  const admin = createAdminClient();
  const preview = await getPublicStorefrontPreview(slug);

  if (!admin || !preview?.store.workspaceId) {
    redirect(`/store/${slug}/account?phone=${encodeURIComponent(currentPhone)}&profile=unavailable`);
  }

  const { data: existingCustomer } = await admin
    .from("store_customers" as never)
    .select("id, metadata")
    .eq("workspace_id" as never, preview.store.workspaceId as never)
    .eq("store_id" as never, preview.store.id as never)
    .eq("normalized_phone" as never, normalizedCurrentPhone as never)
    .maybeSingle();
  const existing = existingCustomer as { id: string; metadata?: Json } | null;
  const metadata = existing?.metadata && typeof existing.metadata === "object" && !Array.isArray(existing.metadata)
    ? existing.metadata as Record<string, Json | undefined>
    : {};
  const payload = {
    email,
    metadata: {
      ...metadata,
      preferredContact: ["email", "phone", "whatsapp"].includes(preferredContact) ? preferredContact : "phone",
      source: "customer_account_portal"
    },
    name,
    phone: normalizedNextPhone,
    status: "active",
    store_id: preview.store.id,
    updated_at: new Date().toISOString(),
    workspace_id: preview.store.workspaceId
  };
  const result = existing?.id
    ? await admin
        .from("store_customers" as never)
        .update(payload as never)
        .eq("id" as never, existing.id as never)
        .eq("workspace_id" as never, preview.store.workspaceId as never)
        .eq("store_id" as never, preview.store.id as never)
    : await admin
        .from("store_customers" as never)
        .insert({ ...payload, created_at: new Date().toISOString() } as never);

  if (result.error) {
    redirect(`/store/${slug}/account?phone=${encodeURIComponent(currentPhone)}&profile=save-failed`);
  }

  revalidatePath(`/store/${slug}/account`);
  redirect(`/store/${slug}/account?phone=${encodeURIComponent(normalizedNextPhone)}&profile=saved`);
}
