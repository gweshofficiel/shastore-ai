import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAssignedLicenseKeysForOrder } from "@/lib/digital-license-keys";
import { getPublicStorefrontPreview } from "@/lib/public-storefront-preview";

export type CustomerDownloadRow = {
  downloadStatus: string;
  fileName: string;
  licenseAssignedAt: string | null;
  licenseKey: string | null;
  orderId: string;
  orderNumber: string;
  orderSource: "orders" | "store_orders";
  productId: string;
  productName: string;
  purchasedAt: string;
};

type DigitalProductRow = {
  digital_delivery_enabled?: boolean | null;
  digital_file_bucket?: string | null;
  digital_file_name?: string | null;
  digital_file_path?: string | null;
  digital_file_type?: string | null;
  id: string;
  product_type?: string | null;
  requires_shipping?: boolean | null;
  title?: string | null;
  name?: string | null;
};

type StoreOrderRow = {
  created_at: string;
  customer_email?: string | null;
  customer_phone: string | null;
  digital_delivery_status?: string | null;
  has_digital_items?: boolean | null;
  id: string;
  items?: unknown;
  order_status?: string | null;
  payment_status?: string | null;
  store_id: string | null;
};

type DraftOrderRow = {
  created_at: string;
  customer_email?: string | null;
  customer_phone: string | null;
  digital_delivery_status?: string | null;
  has_digital_items?: boolean | null;
  id: string;
  order_status?: string | null;
  payment_status?: string | null;
  store_id: string | null;
  store_instance_id?: string | null;
};

function normalizePhone(value: string | null | undefined) {
  return (value ?? "").replace(/\D/g, "");
}

function orderReference(id: string) {
  return id.slice(0, 8).toUpperCase();
}

function isPaidOrCompleted(order: { order_status?: string | null; payment_status?: string | null }) {
  const orderStatus = String(order.order_status ?? "").toLowerCase();
  const paymentStatus = String(order.payment_status ?? "").toLowerCase();

  return (
    ["paid", "captured", "succeeded", "completed"].includes(paymentStatus) ||
    ["paid", "completed", "fulfilled", "delivered"].includes(orderStatus)
  );
}

function jsonItems(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item))) : [];
}

function productIdFromItem(item: Record<string, unknown>) {
  return typeof item.product_id === "string"
    ? item.product_id
    : typeof item.id === "string"
      ? item.id
      : null;
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

async function loadDigitalProducts(admin: SupabaseClient, productIds: string[]) {
  if (!productIds.length) {
    return new Map<string, DigitalProductRow>();
  }

  const { data } = await admin
    .from("store_products" as never)
    .select("id, title, name, product_type, requires_shipping, digital_file_name, digital_file_path, digital_file_bucket, digital_file_type, digital_delivery_enabled")
    .in("id" as never, Array.from(new Set(productIds)) as never);

  return new Map(
    ((data ?? []) as unknown as DigitalProductRow[])
      .filter((product) => product.product_type === "digital" && product.digital_delivery_enabled === true)
      .map((product) => [product.id, product])
  );
}

export async function loadCustomerDownloads({
  phone,
  slug
}: {
  phone: string;
  slug: string;
}) {
  const admin = createAdminClient();
  const lookupPhone = normalizePhone(phone);
  const preview = await getPublicStorefrontPreview(slug);

  if (!admin || !preview || !lookupPhone) {
    return [];
  }

  const storeInstanceIds = await getStoreInstanceIds(admin, preview.store.id, slug);
  const [ordersResult, storeOrdersResult] = await Promise.all([
    admin
      .from("orders" as never)
      .select("id, store_id, store_instance_id, customer_email, customer_phone, created_at, order_status, payment_status, has_digital_items, digital_delivery_status")
      .order("created_at" as never, { ascending: false } as never)
      .limit(100),
    admin
      .from("store_orders" as never)
      .select("id, store_id, customer_email, customer_phone, created_at, order_status, payment_status, items, has_digital_items, digital_delivery_status")
      .eq("store_id" as never, preview.store.id as never)
      .order("created_at" as never, { ascending: false } as never)
      .limit(100)
  ]);
  const draftOrders = ((ordersResult.data ?? []) as unknown as DraftOrderRow[]).filter((order) => {
    const rowStoreId = order.store_id ?? order.store_instance_id ?? "";
    return (
      storeInstanceIds.includes(rowStoreId) &&
      normalizePhone(order.customer_phone) === lookupPhone &&
      order.has_digital_items === true &&
      isPaidOrCompleted(order)
    );
  });
  const storeOrders = ((storeOrdersResult.data ?? []) as unknown as StoreOrderRow[]).filter((order) => (
    normalizePhone(order.customer_phone) === lookupPhone &&
    order.has_digital_items === true &&
    isPaidOrCompleted(order)
  ));
  const orderItemRows = draftOrders.length
    ? await admin
        .from("order_items" as never)
        .select("order_id, product_id, digital_delivery_status, digital_file_name")
        .in("order_id" as never, draftOrders.map((order) => order.id) as never)
    : { data: [] };
  const productIds = [
    ...((orderItemRows.data ?? []) as unknown as Array<{ product_id?: string | null }>).map((item) => item.product_id).filter(Boolean),
    ...storeOrders.flatMap((order) => jsonItems(order.items).map(productIdFromItem).filter(Boolean))
  ] as string[];
  const productsById = await loadDigitalProducts(admin, productIds);
  const downloads: CustomerDownloadRow[] = [];

  for (const order of draftOrders) {
    const itemsForOrder = ((orderItemRows.data ?? []) as unknown as Array<{ digital_delivery_status?: string | null; digital_file_name?: string | null; order_id?: string | null; product_id?: string | null }>)
      .filter((item) => item.order_id === order.id && item.product_id);
    const licensesByProduct = await getAssignedLicenseKeysForOrder({
      customerEmail: order.customer_email ?? null,
      orderId: order.id,
      orderSource: "orders",
      productIds: itemsForOrder.map((item) => item.product_id as string),
      storeId: preview.store.id,
      supabase: admin
    });

    for (const item of itemsForOrder) {
      if (item.order_id !== order.id || !item.product_id) {
        continue;
      }

      const product = productsById.get(item.product_id);
      if (!product) {
        continue;
      }

      const license = licensesByProduct.get(item.product_id);
      downloads.push({
        downloadStatus: item.digital_delivery_status ?? order.digital_delivery_status ?? "pending",
        fileName: item.digital_file_name ?? product.digital_file_name ?? "Digital file",
        licenseAssignedAt: license?.assignedAt ?? null,
        licenseKey: license?.keyValue ?? null,
        orderId: order.id,
        orderNumber: orderReference(order.id),
        orderSource: "orders",
        productId: product.id,
        productName: product.title?.trim() || product.name?.trim() || "Digital product",
        purchasedAt: order.created_at
      });
    }
  }

  for (const order of storeOrders) {
    const itemsForOrder = jsonItems(order.items);
    const licensesByProduct = await getAssignedLicenseKeysForOrder({
      customerEmail: order.customer_email ?? null,
      orderId: order.id,
      orderSource: "store_orders",
      productIds: itemsForOrder.map(productIdFromItem).filter(Boolean) as string[],
      storeId: preview.store.id,
      supabase: admin
    });

    for (const item of itemsForOrder) {
      const productId = productIdFromItem(item);
      if (!productId) {
        continue;
      }

      const product = productsById.get(productId);
      if (!product) {
        continue;
      }

      const license = licensesByProduct.get(productId);
      downloads.push({
        downloadStatus: typeof item.digitalDeliveryStatus === "string" ? item.digitalDeliveryStatus : order.digital_delivery_status ?? "pending",
        fileName: (typeof item.digitalFileName === "string" && item.digitalFileName) || product.digital_file_name || "Digital file",
        licenseAssignedAt: license?.assignedAt ?? null,
        licenseKey: license?.keyValue ?? null,
        orderId: order.id,
        orderNumber: orderReference(order.id),
        orderSource: "store_orders",
        productId: product.id,
        productName: product.title?.trim() || product.name?.trim() || "Digital product",
        purchasedAt: order.created_at
      });
    }
  }

  return downloads.sort((left, right) => new Date(right.purchasedAt).getTime() - new Date(left.purchasedAt).getTime());
}

function parseR2Path(value: string) {
  if (!value.startsWith("r2://")) {
    return null;
  }

  const withoutProtocol = value.slice("r2://".length);
  const [bucket, ...pathParts] = withoutProtocol.split("/");
  const path = pathParts.join("/");

  return bucket && path ? { bucket, path } : null;
}

export async function createCustomerDownloadUrl({
  orderId,
  phone,
  productId,
  slug,
  source
}: {
  orderId: string;
  phone: string;
  productId: string;
  slug: string;
  source: "orders" | "store_orders";
}) {
  const admin = createAdminClient();
  const preview = await getPublicStorefrontPreview(slug);
  const lookupPhone = normalizePhone(phone);

  if (!admin || !preview || !lookupPhone || !orderId || !productId) {
    return { error: "Download access could not be verified.", url: null };
  }

  const downloads = await loadCustomerDownloads({ phone, slug });
  const match = downloads.find((download) => (
    download.orderId === orderId &&
    download.orderSource === source &&
    download.productId === productId
  ));

  if (!match) {
    return { error: "This download is not available for this customer/order.", url: null };
  }

  const { data: product } = await admin
    .from("store_products" as never)
    .select("digital_file_bucket, digital_file_path")
    .eq("id" as never, productId as never)
    .eq("store_id" as never, preview.store.id as never)
    .eq("product_type" as never, "digital" as never)
    .maybeSingle();
  const productRow = product as { digital_file_bucket?: string | null; digital_file_path?: string | null } | null;
  const rawPath = productRow?.digital_file_path?.trim();
  const parsedR2 = rawPath ? parseR2Path(rawPath) : null;
  const bucket = productRow?.digital_file_bucket?.trim() || parsedR2?.bucket || "";
  const storagePath = parsedR2?.path || rawPath || "";

  if (!bucket || !storagePath || /^https?:\/\//i.test(storagePath)) {
    return { error: "Secure download signing is not configured for this file yet.", url: null };
  }

  const { data, error } = await admin.storage.from(bucket).createSignedUrl(storagePath, 60);

  if (error || !data?.signedUrl) {
    return { error: "Secure download link could not be generated.", url: null };
  }

  return { error: null, url: data.signedUrl };
}
