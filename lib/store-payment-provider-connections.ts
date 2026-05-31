import type { SupabaseClient } from "@supabase/supabase-js";

export type StorePaymentProvider = "paypal" | "stripe";
export type StorePaymentProviderStatus =
  | "connected"
  | "disconnected"
  | "not_connected"
  | "pending"
  | "restricted";

export type StorePaymentProviderConnection = {
  charges_enabled: boolean;
  connected_at: string | null;
  connection_status: StorePaymentProviderStatus;
  disconnected_at: string | null;
  id: string;
  onboarding_completed_at: string | null;
  paypal_merchant_id: string | null;
  paypal_status: string | null;
  payouts_enabled: boolean;
  provider: StorePaymentProvider;
  store_id: string;
  stripe_account_id: string | null;
  workspace_id: string;
};

function isProvider(value: unknown): value is StorePaymentProvider {
  return value === "paypal" || value === "stripe";
}

function normalizeStatus(value: unknown): StorePaymentProviderStatus {
  return value === "connected" ||
    value === "disconnected" ||
    value === "pending" ||
    value === "restricted"
    ? value
    : "not_connected";
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function normalizeProviderConnection(value: unknown): StorePaymentProviderConnection | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const row = value as Record<string, unknown>;
  const provider = row.provider;

  if (
    typeof row.id !== "string" ||
    typeof row.store_id !== "string" ||
    typeof row.workspace_id !== "string" ||
    !isProvider(provider)
  ) {
    return null;
  }

  return {
    charges_enabled: row.charges_enabled === true,
    connected_at: text(row.connected_at),
    connection_status: normalizeStatus(row.connection_status),
    disconnected_at: text(row.disconnected_at),
    id: row.id,
    onboarding_completed_at: text(row.onboarding_completed_at),
    paypal_merchant_id: text(row.paypal_merchant_id),
    paypal_status: text(row.paypal_status),
    payouts_enabled: row.payouts_enabled === true,
    provider,
    store_id: row.store_id,
    stripe_account_id: text(row.stripe_account_id),
    workspace_id: row.workspace_id
  };
}

export async function getStorePaymentProviderConnections(
  client: SupabaseClient,
  storeId: string
) {
  const { data, error } = await client
    .from("store_payment_provider_connections" as never)
    .select(
      "id, workspace_id, store_id, provider, connection_status, stripe_account_id, onboarding_completed_at, charges_enabled, payouts_enabled, paypal_merchant_id, paypal_status, connected_at, disconnected_at"
    )
    .eq("store_id", storeId)
    .order("provider" as never, { ascending: true } as never);

  if (error) {
    console.warn("[store-payment-providers] provider connections failed", {
      code: error.code,
      message: error.message,
      storeId
    });
    return [];
  }

  return ((data ?? []) as unknown[])
    .map(normalizeProviderConnection)
    .filter((row): row is StorePaymentProviderConnection => Boolean(row));
}

export function providerConnectionByName(
  connections: StorePaymentProviderConnection[],
  provider: StorePaymentProvider
) {
  return connections.find((connection) => connection.provider === provider) ?? null;
}

export function isStripeReady(connection: StorePaymentProviderConnection | null) {
  return connection?.connection_status === "connected" && connection.charges_enabled;
}

export function isPayPalReady(connection: StorePaymentProviderConnection | null) {
  return connection?.connection_status === "connected" && Boolean(connection.paypal_merchant_id);
}
