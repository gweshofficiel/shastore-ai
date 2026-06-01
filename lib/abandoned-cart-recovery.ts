import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAppBaseUrl } from "@/lib/deployment/config";
import { getUserWorkspaceRole, hasPermission } from "@/lib/permissions/rbac";
import { queueStoreEmailEventSafe } from "@/lib/store-email-queue";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

const ABANDONED_CART_THRESHOLD_MINUTES = 30;

type CartItemSnapshot = {
  price?: number | string | null;
  productId?: string;
  quantity?: number;
  title?: string;
  variantName?: string | null;
};

function cleanText(value: unknown, maxLength = 240) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanEmail(value: unknown) {
  const email = cleanText(value, 180).toLowerCase();
  return email.includes("@") ? email : "";
}

function isSafeSessionId(value: string) {
  return /^[a-zA-Z0-9_-]{16,160}$/.test(value);
}

function numericValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^0-9.-]+/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

export function cartRecoveryUrl({
  cartId,
  slug
}: {
  cartId: string;
  slug: string;
}) {
  const baseUrl = getAppBaseUrl().replace(/\/$/, "");
  return `${baseUrl}/store/${slug}/cart?recovery=${encodeURIComponent(cartId)}`;
}

export function productSummaryForCartRecovery(items: CartItemSnapshot[]) {
  if (!items.length) {
    return "Cart items unavailable";
  }

  return items
    .slice(0, 8)
    .map((item) => `${item.title || "Product"} x${item.quantity ?? 1}`)
    .join(", ");
}

export function sanitizeCartItems(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as Record<string, unknown>;
      const title = cleanText(record.title, 180);
      const productId = cleanText(record.productId ?? record.id, 80);
      const quantity = Math.max(1, Math.min(99, Math.floor(numericValue(record.quantity) || 1)));
      const price = Number(numericValue(record.price).toFixed(2));

      if (!title || !productId) {
        return null;
      }

      return {
        price,
        productId,
        quantity,
        title,
        variantName: cleanText(record.variantName, 120) || null
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .slice(0, 100);
}

export async function markDueAbandonedCartsSafe({
  storeId,
  workspaceId
}: {
  storeId: string;
  workspaceId: string;
}) {
  const admin = createAdminClient();

  if (!admin) {
    return;
  }

  const cutoff = new Date(Date.now() - ABANDONED_CART_THRESHOLD_MINUTES * 60_000).toISOString();

  await admin
    .from("store_abandoned_carts" as never)
    .update({ abandoned_at: new Date().toISOString() } as never)
    .eq("workspace_id" as never, workspaceId as never)
    .eq("store_id" as never, storeId as never)
    .eq("recovery_status" as never, "pending" as never)
    .is("abandoned_at" as never, null)
    .lt("last_activity_at" as never, cutoff as never)
    .gt("items_count" as never, 0 as never);
}

export async function markAbandonedCartRecoveredSafe({
  orderId,
  sessionId,
  storeId,
  workspaceId
}: {
  orderId: string;
  sessionId?: string | null;
  storeId: string;
  workspaceId?: string | null;
}) {
  const cleanSessionId = cleanText(sessionId, 180);

  if (!isSafeSessionId(cleanSessionId)) {
    return false;
  }

  const admin = createAdminClient();

  if (!admin) {
    return false;
  }

  let query = admin
    .from("store_abandoned_carts" as never)
    .update({
      recovered_at: new Date().toISOString(),
      recovered_order_id: orderId,
      recovery_status: "recovered"
    } as never)
    .eq("store_id" as never, storeId as never)
    .eq("session_id" as never, cleanSessionId as never)
    .neq("recovery_status" as never, "recovered" as never);

  if (workspaceId) {
    query = query.eq("workspace_id" as never, workspaceId as never);
  }

  const { error } = await query;

  if (!error) {
    revalidatePath("/dashboard/abandoned-carts");
  }

  return !error;
}

export async function sendAbandonedCartRecoveryEmailAction(formData: FormData) {
  const cartId = cleanText(formData.get("cartId"), 80);
  const returnTo = cleanText(formData.get("returnTo"), 240) || "/dashboard/abandoned-carts";
  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user || !cartId) {
    redirect(`${returnTo}?carts=not-authorized`);
  }

  const { data: cartRow } = await supabase
    .from("store_abandoned_carts" as never)
    .select("id, workspace_id, store_id, customer_email, customer_phone, currency, estimated_total, items, recovery_status")
    .eq("id" as never, cartId as never)
    .maybeSingle();
  const cart = cartRow as {
    currency: string;
    customer_email: string | null;
    customer_phone: string | null;
    estimated_total: number | string;
    id: string;
    items: Json;
    recovery_status: string;
    store_id: string;
    workspace_id: string;
  } | null;

  if (!cart) {
    redirect(`${returnTo}?carts=missing-cart`);
  }

  const role = await getUserWorkspaceRole(supabase, cart.workspace_id, user.id);

  if (!hasPermission(role, "can_view_orders")) {
    redirect(`${returnTo}?carts=not-authorized`);
  }

  const email = cleanEmail(cart.customer_email);

  if (!email) {
    redirect(`${returnTo}?carts=missing-email`);
  }

  if (cart.recovery_status === "email_sent" || cart.recovery_status === "recovered") {
    redirect(`${returnTo}?carts=duplicate`);
  }

  const { data: storeRow } = await supabase
    .from("stores")
    .select("slug, name")
    .eq("id", cart.store_id)
    .eq("workspace_id" as never, cart.workspace_id as never)
    .maybeSingle();
  const store = storeRow as { name: string | null; slug: string | null } | null;
  const slug = store?.slug ?? cart.store_id;
  const items = sanitizeCartItems(cart.items);
  const queued = await queueStoreEmailEventSafe({
    metadata: {
      cartId: cart.id,
      cartRecoveryUrl: cartRecoveryUrl({ cartId: cart.id, slug }),
      currency: cart.currency,
      customerPhone: cart.customer_phone,
      estimatedTotal: numericValue(cart.estimated_total),
      productsSummary: productSummaryForCartRecovery(items),
      storeName: store?.name ?? "Store"
    },
    recipient: email,
    storeId: cart.store_id,
    templateKey: "abandoned_cart_recovery",
    workspaceId: cart.workspace_id
  });

  if (!queued) {
    redirect(`${returnTo}?carts=email-failed`);
  }

  const admin = createAdminClient();
  await admin
    ?.from("store_abandoned_carts" as never)
    .update({
      recovery_email_sent_at: new Date().toISOString(),
      recovery_status: "email_sent"
    } as never)
    .eq("id" as never, cart.id as never)
    .eq("recovery_status" as never, "pending" as never);

  revalidatePath("/dashboard/abandoned-carts");
  redirect(`${returnTo}?carts=email-sent`);
}
