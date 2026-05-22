"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

type ClaimedStoreRow = {
  access_role?: string | null;
  id: string;
};

type SellerOrderStatus =
  | "pending"
  | "paid"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded";

const ordersPath = "/dashboard/orders";
const allowedStatuses = new Set<SellerOrderStatus>([
  "pending",
  "paid",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded"
]);

const statusMap: Record<
  SellerOrderStatus,
  {
    fulfillment_status: "pending" | "processing" | "shipped" | "delivered" | "cancelled";
    order_status: SellerOrderStatus;
    payment_status: "pending" | "paid" | "refunded";
  }
> = {
  cancelled: {
    fulfillment_status: "cancelled",
    order_status: "cancelled",
    payment_status: "pending"
  },
  delivered: {
    fulfillment_status: "delivered",
    order_status: "delivered",
    payment_status: "paid"
  },
  paid: {
    fulfillment_status: "pending",
    order_status: "paid",
    payment_status: "paid"
  },
  pending: {
    fulfillment_status: "pending",
    order_status: "pending",
    payment_status: "pending"
  },
  processing: {
    fulfillment_status: "processing",
    order_status: "processing",
    payment_status: "paid"
  },
  refunded: {
    fulfillment_status: "cancelled",
    order_status: "refunded",
    payment_status: "refunded"
  },
  shipped: {
    fulfillment_status: "shipped",
    order_status: "shipped",
    payment_status: "paid"
  }
};

function cleanText(value: FormDataEntryValue | null, maxLength = 1000) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function ordersRedirect(storeId?: string, orderId?: string, status?: string): never {
  const params = new URLSearchParams();

  if (storeId) {
    params.set("storeId", storeId);
  }

  if (orderId) {
    params.set("orderId", orderId);
  }

  if (status) {
    params.set("orders", status);
  }

  const search = params.toString();
  redirect(search ? `${ordersPath}?${search}` : ordersPath);
}

async function getClaimedStore(supabase: SupabaseClient, storeId: string) {
  const { data, error } = await supabase.rpc(
    "get_claimed_store_instances_for_current_user" as never
  );

  if (error || !Array.isArray(data)) {
    return null;
  }

  return (
    (data as ClaimedStoreRow[]).find(
      (store) =>
        store.id === storeId &&
        (!store.access_role || store.access_role === "owner" || store.access_role === "admin")
    ) ?? null
  );
}

async function requireClaimedStore(formData: FormData) {
  const storeId = cleanText(formData.get("storeId"), 80);
  const orderId = cleanText(formData.get("orderId"), 80);

  if (!storeId || !orderId) {
    ordersRedirect(storeId, orderId, "missing-order");
  }

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(ordersPath)}`);
  }

  const claimedStore = await getClaimedStore(supabase, storeId);

  if (!claimedStore) {
    ordersRedirect(storeId, orderId, "not-authorized");
  }

  return { orderId, storeId, supabase };
}

export async function updateStoreOwnerOrderStatus(formData: FormData) {
  const { orderId, storeId, supabase } = await requireClaimedStore(formData);
  const rawStatus = cleanText(formData.get("status"), 40) as SellerOrderStatus;

  if (!allowedStatuses.has(rawStatus)) {
    ordersRedirect(storeId, orderId, "invalid-status");
  }

  const { error } = await supabase
    .from("orders" as never)
    .update(statusMap[rawStatus] as never)
    .eq("id", orderId)
    .eq("store_instance_id", storeId);

  if (error) {
    console.error("[orders-foundation] update order status failed", {
      code: error.code,
      message: error.message,
      orderId,
      storeId
    });
    ordersRedirect(storeId, orderId, "status-failed");
  }

  revalidatePath(ordersPath);
  ordersRedirect(storeId, orderId, "status-updated");
}
