import type { SupabaseClient } from "@supabase/supabase-js";

export type StorePaymentProvider = "paypal" | "stripe" | "youcan_pay";
export type StorePaymentProviderStatus =
  | "connected"
  | "disconnected"
  | "not_connected"
  | "pending"
  | "restricted";

export type StorePaymentProviderConnection = {
  account_reference: string | null;
  charges_enabled: boolean;
  config_status: "configured" | "invalid" | "not_configured";
  connected_at: string | null;
  connection_mode: "connect" | "manual";
  connection_status: StorePaymentProviderStatus;
  disconnected_at: string | null;
  environment: string | null;
  id: string;
  onboarding_completed_at: string | null;
  paypal_merchant_id: string | null;
  paypal_status: string | null;
  payouts_enabled: boolean;
  provider: StorePaymentProvider;
  public_key: string | null;
  publishable_key: string | null;
  store_id: string;
  stripe_account_id: string | null;
  workspace_id: string;
};

function isProvider(value: unknown): value is StorePaymentProvider {
  return value === "paypal" || value === "stripe" || value === "youcan_pay";
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

function configStatus(value: unknown): StorePaymentProviderConnection["config_status"] {
  return value === "configured" || value === "invalid" ? value : "not_configured";
}

function connectionMode(value: unknown): StorePaymentProviderConnection["connection_mode"] {
  return value === "manual" ? "manual" : "connect";
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
    account_reference: text(row.account_reference),
    charges_enabled: row.charges_enabled === true,
    config_status: configStatus(row.config_status),
    connected_at: text(row.connected_at),
    connection_mode: connectionMode(row.connection_mode),
    connection_status: normalizeStatus(row.connection_status),
    disconnected_at: text(row.disconnected_at),
    environment: text(row.environment),
    id: row.id,
    onboarding_completed_at: text(row.onboarding_completed_at),
    paypal_merchant_id: text(row.paypal_merchant_id),
    paypal_status: text(row.paypal_status),
    payouts_enabled: row.payouts_enabled === true,
    provider,
    public_key: text(row.public_key),
    publishable_key: text(row.publishable_key),
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
      "id, workspace_id, store_id, provider, connection_mode, config_status, connection_status, stripe_account_id, onboarding_completed_at, charges_enabled, payouts_enabled, paypal_merchant_id, paypal_status, connected_at, disconnected_at, environment, publishable_key, public_key, account_reference"
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
  return (
    (connection?.connection_mode === "connect" && Boolean(connection.stripe_account_id)) ||
    (connection?.connection_mode === "manual" &&
      connection.config_status === "configured" &&
      Boolean(connection.publishable_key))
  );
}

export function isPayPalReady(connection: StorePaymentProviderConnection | null) {
  return (
    (connection?.connection_status === "connected" && Boolean(connection.paypal_merchant_id)) ||
    (connection?.connection_mode === "manual" &&
      connection.config_status === "configured" &&
      Boolean(connection.publishable_key))
  );
}

export function isYouCanPayReady(connection: StorePaymentProviderConnection | null) {
  return (
    connection?.connection_mode === "manual" &&
    connection.config_status === "configured" &&
    Boolean(connection.public_key)
  );
}
