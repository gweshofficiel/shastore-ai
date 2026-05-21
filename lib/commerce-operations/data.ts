import { createClient } from "@/lib/supabase/server";
import type {
  CommerceOperationsData,
  CommerceOperationsScope,
  DeliveryAgent,
  SellerCommerceSettings,
  ShippingMethod
} from "@/lib/commerce-operations/types";

function isMissingCommerceOperationsTable(error: { code?: string; message?: string } | null) {
  const message = (error?.message ?? "").toLowerCase();

  return (
    error?.code === "PGRST205" ||
    error?.code === "PGRST204" ||
    message.includes("seller_commerce_settings") ||
    message.includes("shipping_methods") ||
    message.includes("delivery_agents") ||
    message.includes("could not find the table")
  );
}

export async function getCommerceOperationsData(
  scope: CommerceOperationsScope
): Promise<CommerceOperationsData> {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { agents: [], ready: true, settings: null, shippingMethods: [] };
  }

  const [settingsResult, shippingResult, agentsResult] = await Promise.all([
    supabase
      .from("seller_commerce_settings" as never)
      .select("*")
      .eq("user_id", user.id)
      .eq("dashboard_scope", scope)
      .maybeSingle(),
    supabase
      .from("shipping_methods" as never)
      .select("*")
      .eq("user_id", user.id)
      .eq("dashboard_scope", scope)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false }),
    supabase
      .from("delivery_agents" as never)
      .select("*")
      .eq("user_id", user.id)
      .eq("dashboard_scope", scope)
      .order("created_at", { ascending: false })
  ]);

  const errors = [settingsResult.error, shippingResult.error, agentsResult.error].filter(Boolean);

  return {
    agents: (agentsResult.data ?? []) as DeliveryAgent[],
    ready: errors.length === 0 || errors.every((error) => !isMissingCommerceOperationsTable(error)),
    settings: (settingsResult.data as SellerCommerceSettings | null) ?? null,
    shippingMethods: (shippingResult.data ?? []) as ShippingMethod[]
  };
}

export function commerceOperationsMigrationMessage() {
  return "Apply supabase/migrations/commerce-settings-shipping-foundation-safe.sql to enable commerce operations, shipping methods, and delivery agents.";
}
