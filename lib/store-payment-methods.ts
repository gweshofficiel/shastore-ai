import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getStorePaymentProviderConnections,
  isPayPalReady,
  isStripeReady,
  isYouCanPayReady,
  providerConnectionByName
} from "@/lib/store-payment-provider-connections";

export type StorePaymentMethod = "cod" | "paypal" | "stripe" | "whatsapp" | "youcan_pay";
type ConfigurableStorePaymentMethod = Exclude<StorePaymentMethod, "stripe">;

export type StorePaymentMethodRow = {
  config: Record<string, unknown>;
  display_name: string | null;
  id: string;
  instructions: string | null;
  is_enabled: boolean;
  method: ConfigurableStorePaymentMethod;
  store_id: string;
  workspace_id: string;
};

export type PublicStorePaymentMethod = {
  displayName: string;
  instructions: string | null;
  method: StorePaymentMethod;
};

export const storePaymentMethodOptions: Array<{
  defaultDisplayName: string;
  description: string;
  method: ConfigurableStorePaymentMethod;
  title: string;
}> = [
  {
    defaultDisplayName: "Cash on Delivery",
    description: "Let customers place orders and pay when the seller delivers.",
    method: "cod",
    title: "Cash on Delivery"
  },
  {
    defaultDisplayName: "WhatsApp Orders",
    description: "Create the order and open WhatsApp with a prepared message.",
    method: "whatsapp",
    title: "WhatsApp Orders"
  },
  {
    defaultDisplayName: "PayPal",
    description: "Foundation placeholder for future seller-owned PayPal checkout.",
    method: "paypal",
    title: "PayPal"
  },
  {
    defaultDisplayName: "YouCan Pay",
    description: "Foundation placeholder for future seller-owned YouCan Pay checkout.",
    method: "youcan_pay",
    title: "YouCan Pay"
  }
];

const defaultLabels = new Map<StorePaymentMethod, string>([
  ...storePaymentMethodOptions.map(
    (option) => [option.method, option.defaultDisplayName] as [StorePaymentMethod, string]
  ),
  ["stripe", "Credit / Debit Card"]
]);

function isPaymentMethod(value: unknown): value is StorePaymentMethod {
  return value === "cod" || value === "paypal" || value === "stripe" || value === "whatsapp" || value === "youcan_pay";
}

function isConfigurablePaymentMethod(value: unknown): value is ConfigurableStorePaymentMethod {
  return value === "cod" || value === "paypal" || value === "whatsapp" || value === "youcan_pay";
}

function normalizeConfig(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizePaymentRow(value: unknown): StorePaymentMethodRow | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const row = value as Record<string, unknown>;
  const method = row.method;

  if (
    typeof row.id !== "string" ||
    typeof row.store_id !== "string" ||
    typeof row.workspace_id !== "string" ||
    !isConfigurablePaymentMethod(method)
  ) {
    return null;
  }

  return {
    config: normalizeConfig(row.config),
    display_name: typeof row.display_name === "string" ? row.display_name : null,
    id: row.id,
    instructions: typeof row.instructions === "string" ? row.instructions : null,
    is_enabled: row.is_enabled === true,
    method,
    store_id: row.store_id,
    workspace_id: row.workspace_id
  };
}

export async function getStorePaymentMethods(client: SupabaseClient, storeId: string) {
  const { data, error } = await client
    .from("store_payment_methods" as never)
    .select("id, workspace_id, store_id, method, is_enabled, display_name, instructions, config")
    .eq("store_id", storeId)
    .order("method" as never, { ascending: true } as never);

  if (error) {
    console.warn("[store-payments] store payment methods failed", {
      code: error.code,
      message: error.message,
      storeId
    });
    return [];
  }

  return ((data ?? []) as unknown[])
    .map(normalizePaymentRow)
    .filter((row): row is StorePaymentMethodRow => Boolean(row));
}

export async function getEnabledPublicStorePaymentMethods(client: SupabaseClient, storeId: string) {
  const [{ data, error }, providerConnections] = await Promise.all([
    client
      .from("store_payment_methods" as never)
      .select("method, display_name, instructions")
      .eq("store_id", storeId)
      .eq("is_enabled", true)
      .order("method" as never, { ascending: true } as never),
    getStorePaymentProviderConnections(client, storeId)
  ]);

  if (error) {
    console.warn("[store-payments] enabled public methods failed", {
      code: error.code,
      message: error.message,
      storeId
    });
    return [];
  }

  const enabledMethodNames = new Set<StorePaymentMethod>();
  const configuredMethods = ((data ?? []) as unknown[])
    .map((value): PublicStorePaymentMethod | null => {
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
      }

      const row = value as Record<string, unknown>;
      const method = row.method;

      if (!isPaymentMethod(method)) {
        return null;
      }

      return {
        displayName:
          typeof row.display_name === "string" && row.display_name.trim()
            ? row.display_name
            : defaultLabels.get(method) || method,
        instructions: typeof row.instructions === "string" ? row.instructions : null,
        method
      };
    })
    .filter((method): method is PublicStorePaymentMethod => Boolean(method))
    .filter((method) => {
      enabledMethodNames.add(method.method);
      return method.method !== "paypal" && method.method !== "youcan_pay";
    });

  const stripeConnection = providerConnectionByName(providerConnections, "stripe");
  const paypalConnection = providerConnectionByName(providerConnections, "paypal");
  const youCanConnection = providerConnectionByName(providerConnections, "youcan_pay");
  const providerMethods: PublicStorePaymentMethod[] = [];

  if (isStripeReady(stripeConnection)) {
    providerMethods.push({
      displayName: "Credit / Debit Card",
      instructions: "Pay securely by card. Payment processing will use this store's connected Stripe account.",
      method: "stripe"
    });
  }

  if (isPayPalReady(paypalConnection)) {
    providerMethods.push({
      displayName: "PayPal",
      instructions: "Pay with this store's connected PayPal merchant account.",
      method: "paypal"
    });
  }

  if (enabledMethodNames.has("youcan_pay") && isYouCanPayReady(youCanConnection)) {
    providerMethods.push({
      displayName: "YouCan Pay",
      instructions: "Pay with this store's configured YouCan Pay account.",
      method: "youcan_pay"
    });
  }

  return [...providerMethods, ...configuredMethods];
}

export function defaultPaymentDisplayName(method: StorePaymentMethod) {
  return defaultLabels.get(method) || method;
}
