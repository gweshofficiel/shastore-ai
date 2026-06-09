import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getStorePaymentProviderConnections,
  isPayPalReady,
  isYouCanPayReady,
  providerConnectionByName
} from "@/lib/store-payment-provider-connections";

export type StorePaymentMethod = "cod" | "paypal" | "stripe" | "whatsapp" | "youcan_pay";
type ConfigurableStorePaymentMethod = Exclude<StorePaymentMethod, "stripe">;
export type PublicStorePaymentMethodKey = ConfigurableStorePaymentMethod | "card";

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
  method: PublicStorePaymentMethodKey;
  provider_internal?: StorePaymentMethod;
};

export const storePaymentMethodOptions: Array<{
  defaultDisplayName: string;
  defaultEnabled?: boolean;
  description: string;
  method: ConfigurableStorePaymentMethod;
  title: string;
}> = [
  {
    defaultDisplayName: "Cash on Delivery",
    defaultEnabled: true,
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
    description: "Let customers pay through the store's connected PayPal merchant account.",
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

  const enabledMethodNames = new Set<ConfigurableStorePaymentMethod>();
  const configuredMethods = ((data ?? []) as unknown[])
    .map((value): PublicStorePaymentMethod | null => {
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
      }

      const row = value as Record<string, unknown>;
      const method = row.method;

      if (!isConfigurablePaymentMethod(method)) {
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
      if (method.method !== "card") {
        enabledMethodNames.add(method.method);
      }
      return method.method !== "paypal" && method.method !== "youcan_pay";
    });
  const hasPersistedMethods = ((data ?? []) as unknown[]).length > 0;

  if (!hasPersistedMethods) {
    configuredMethods.push({
      displayName: "Cash on Delivery",
      instructions: "Pay when your order is delivered.",
      method: "cod"
    });
    enabledMethodNames.add("cod");
  }

  const paypalConnection = providerConnectionByName(providerConnections, "paypal");
  const youCanConnection = providerConnectionByName(providerConnections, "youcan_pay");
  const providerMethods: PublicStorePaymentMethod[] = [];

  // C2 keeps card checkout inactive. Stripe readiness is visible in owner/admin surfaces only.
  if (enabledMethodNames.has("paypal") && isPayPalReady(paypalConnection)) {
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

  return [...configuredMethods, ...providerMethods];
}

export function defaultPaymentDisplayName(method: StorePaymentMethod) {
  return defaultLabels.get(method) || method;
}
