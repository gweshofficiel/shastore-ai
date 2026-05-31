import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  getStorePaymentProviderConnections,
  providerConnectionByName,
  type StorePaymentProviderConnection
} from "@/lib/store-payment-provider-connections";
import {
  saveManualPaymentProviderConfigs,
  saveStorePaymentMethods
} from "@/lib/store-payment-method-actions";
import {
  defaultPaymentDisplayName,
  getStorePaymentMethods,
  storePaymentMethodOptions,
  type StorePaymentMethod,
  type StorePaymentMethodRow
} from "@/lib/store-payment-methods";
import { createClient } from "@/lib/supabase/server";
import { getUserWorkspaceRole, hasPermission } from "@/lib/permissions/rbac";
import { fetchStoresForAuthUser, type UserStoreRow } from "@/lib/stores/user-stores";
import { getActiveWorkspaceForUser } from "@/lib/workspaces/active-workspace";

export const dynamic = "force-dynamic";

function Toggle({
  checked,
  description,
  disabled = false,
  label,
  name
}: {
  checked: boolean;
  description: string;
  disabled?: boolean;
  label: string;
  name: string;
}) {
  return (
    <label className="flex items-start gap-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
      <input
        className="mt-1 h-5 w-5 rounded border-slate-300 text-ink"
        defaultChecked={checked}
        disabled={disabled}
        name={name}
        type="checkbox"
      />
      <span>
        <span className="block font-bold text-ink">{label}</span>
        <span className="mt-1 block text-sm leading-6 text-muted">{description}</span>
      </span>
    </label>
  );
}

type PaymentsData = {
  activeStore: UserStoreRow | null;
  error: string | null;
  methods: StorePaymentMethodRow[];
  providerConnections: StorePaymentProviderConnection[];
  stores: UserStoreRow[];
};

async function getPaymentsData(selectedStoreId?: string): Promise<PaymentsData> {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { activeStore: null, error: "Sign in to manage store payments.", methods: [], providerConnections: [], stores: [] };
  }

  const selection = await getActiveWorkspaceForUser({ supabase, userId: user.id });
  const role = await getUserWorkspaceRole(supabase, selection.activeWorkspaceId, user.id);

  if (!hasPermission(role, "can_manage_payments")) {
    return { activeStore: null, error: "You do not have permission to manage payments.", methods: [], providerConnections: [], stores: [] };
  }

  const { stores, error: storesError } = await fetchStoresForAuthUser(supabase, user.id, selection.activeWorkspaceId);

  if (storesError) {
    return { activeStore: null, error: "Stores could not be loaded. Please try again.", methods: [], providerConnections: [], stores: [] };
  }

  const activeStore = stores.find((store) => store.id === selectedStoreId) ?? stores[0] ?? null;

  if (!activeStore) {
    return { activeStore: null, error: null, methods: [], providerConnections: [], stores };
  }

  const [methods, providerConnections] = await Promise.all([
    getStorePaymentMethods(supabase, activeStore.id),
    getStorePaymentProviderConnections(supabase, activeStore.id)
  ]);

  return { activeStore, error: null, methods, providerConnections, stores };
}

function methodConfigValue(method: StorePaymentMethodRow | undefined, key: string) {
  const value = method?.config[key];
  return typeof value === "string" ? value : "";
}

function methodByName(methods: StorePaymentMethodRow[], method: StorePaymentMethod) {
  return methods.find((item) => item.method === method);
}

function statusMessage(value: string | undefined) {
  const messages: Record<string, string> = {
    "missing-store": "Choose a store before managing payment methods.",
    "not-authorized": "You do not have permission to manage that store.",
    saved: "Store payment methods saved.",
    "save-failed": "Store payment methods could not be saved. Confirm the migration has been applied.",
    "manual-config-empty": "Enter at least one provider config value before saving.",
    "manual-config-failed": "Manual provider config could not be saved.",
    "manual-config-missing-encryption": "Manual provider secrets cannot be saved until the encryption key env var is configured.",
    "manual-config-saved": "Manual provider configuration saved.",
    "stripe-connected": "Stripe account connected.",
    "stripe-connect-failed": "Stripe Connect could not be started. Confirm store payment Stripe Connect env vars are configured.",
    "stripe-connect-missing-env": "Stripe Connect could not start because required env vars are missing.",
    "stripe-connect-platform-not-enabled": "Stripe Connect is not fully enabled for this platform Stripe account. Open Stripe Dashboard → Connect and complete platform onboarding for the same account/key used in STORE_PAYMENTS_STRIPE_SECRET_KEY.",
    "stripe-disconnected": "Stripe account disconnected.",
    "stripe-disconnect-failed": "Stripe account could not be disconnected.",
    "stripe-not-connected": "Stripe is not connected for this store.",
    "stripe-pending": "Stripe onboarding is pending.",
    "stripe-refresh-failed": "Stripe status could not be refreshed.",
    "stripe-refresh-required": "Stripe onboarding needs to be restarted.",
    "stripe-restricted": "Stripe account is restricted. Complete Stripe requirements.",
    "paypal-connected": "PayPal account connected.",
    "paypal-connect-config-missing": "PayPal partner onboarding URL is not configured.",
    "paypal-disconnected": "PayPal account disconnected.",
    "paypal-disconnect-failed": "PayPal account could not be disconnected.",
    "paypal-pending": "PayPal onboarding is pending."
  };

  return value ? messages[value] : null;
}

function missingEnvMessage(value: string | undefined) {
  if (!value) {
    return null;
  }

  return `Missing environment variable: ${value}`;
}

function providerStatusLabel(connection: StorePaymentProviderConnection | null) {
  if (!connection || connection.connection_status === "disconnected") {
    return "Not Connected";
  }

  if (connection.connection_status === "connected") {
    return "Connected";
  }

  if (connection.connection_status === "restricted") {
    return "Restricted";
  }

  return "Pending";
}

function ProviderConnectionCard({
  connection,
  provider,
  storeId
}: {
  connection: StorePaymentProviderConnection | null;
  provider: "paypal" | "stripe";
  storeId: string;
}) {
  const title = provider === "stripe" ? "Stripe" : "PayPal";
  const description =
    provider === "stripe"
      ? "Connect a seller-owned Stripe account through Stripe Connect onboarding. Platform subscription billing is not used here."
      : "Connect a seller-owned PayPal merchant account through partner onboarding. No manual secret keys are exposed.";
  const connectPath = `/api/store-payments/${provider}/connect`;
  const refreshPath = `/api/store-payments/${provider}/refresh`;
  const disconnectPath = `/api/store-payments/${provider}/disconnect`;

  return (
    <Card className="p-6 lg:p-8">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
        Provider connection
      </p>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-[-0.03em] text-ink">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-slate-600">
          {providerStatusLabel(connection)}
        </span>
      </div>
      <div className="mt-5 grid gap-2 text-sm font-semibold text-muted">
        {provider === "stripe" ? (
          <>
            <p>Charges enabled: {connection?.charges_enabled ? "Yes" : "No"}</p>
            <p>Payouts enabled: {connection?.payouts_enabled ? "Yes" : "No"}</p>
            <p>Stripe account: {connection?.stripe_account_id ? "Stored securely" : "Not stored"}</p>
            <p>Manual status: {connection?.config_status ?? "not_configured"}</p>
          </>
        ) : (
          <>
            <p>PayPal status: {connection?.paypal_status ?? "not_connected"}</p>
            <p>PayPal merchant: {connection?.paypal_merchant_id ? "Stored securely" : "Not stored"}</p>
            <p>Manual status: {connection?.config_status ?? "not_configured"}</p>
          </>
        )}
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <form action={connectPath} method="post">
          <input name="storeId" type="hidden" value={storeId} />
          <Button type="submit">{connection?.connection_status === "connected" ? `Reconnect ${title}` : `Connect ${title}`}</Button>
        </form>
        <form action={refreshPath} method="post">
          <input name="storeId" type="hidden" value={storeId} />
          <Button type="submit" variant="secondary">Refresh Status</Button>
        </form>
        <form action={disconnectPath} method="post">
          <input name="storeId" type="hidden" value={storeId} />
          <Button disabled={!connection || connection.connection_status === "disconnected"} type="submit" variant="ghost">
            Disconnect
          </Button>
        </form>
      </div>
    </Card>
  );
}

function ManualProviderConfigForm({
  paypalConnection,
  stripeConnection,
  storeId,
  youcanConnection
}: {
  paypalConnection: StorePaymentProviderConnection | null;
  stripeConnection: StorePaymentProviderConnection | null;
  storeId: string;
  youcanConnection: StorePaymentProviderConnection | null;
}) {
  return (
    <form action={saveManualPaymentProviderConfigs} className="grid gap-6">
      <input name="storeId" type="hidden" value={storeId} />
      <Card className="border-amber-200 bg-amber-50 p-5">
        <p className="text-sm font-bold leading-6 text-amber-900">
          Advanced manual API configuration stores secret values server-side only. Leave secret fields blank to keep existing encrypted secrets. These credentials are never platform billing credentials.
        </p>
      </Card>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-6">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
            Advanced
          </p>
          <h3 className="mt-3 text-xl font-black text-ink">Manual Stripe API</h3>
          <p className="mt-2 text-sm leading-6 text-muted">
            Recommended path is Stripe Connect. Use manual keys only for controlled testing.
          </p>
          <div className="mt-5 grid gap-4">
            <Input
              defaultValue={stripeConnection?.publishable_key ?? ""}
              id="stripeManualPublishableKey"
              label="Publishable key"
              name="stripeManualPublishableKey"
              placeholder="pk_test_..."
            />
            <Input
              id="stripeManualSecretKey"
              label={stripeConnection?.config_status === "configured" ? "Secret key (stored, leave blank to keep)" : "Secret key"}
              name="stripeManualSecretKey"
              placeholder="sk_test_..."
              type="password"
            />
            <Input
              id="stripeManualWebhookSecret"
              label="Webhook secret optional"
              name="stripeManualWebhookSecret"
              placeholder="whsec_..."
              type="password"
            />
          </div>
        </Card>
        <Card className="p-6">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
            Sandbox / Live
          </p>
          <h3 className="mt-3 text-xl font-black text-ink">Manual PayPal API</h3>
          <p className="mt-2 text-sm leading-6 text-muted">
            Use this when partner onboarding is not available yet.
          </p>
          <div className="mt-5 grid gap-4">
            <Input
              defaultValue={paypalConnection?.publishable_key ?? ""}
              id="paypalManualClientId"
              label="Client ID"
              name="paypalManualClientId"
            />
            <Input
              id="paypalManualClientSecret"
              label={paypalConnection?.config_status === "configured" ? "Client secret (stored, leave blank to keep)" : "Client secret"}
              name="paypalManualClientSecret"
              type="password"
            />
            <Input
              defaultValue={paypalConnection?.paypal_merchant_id ?? ""}
              id="paypalManualMerchantId"
              label="Merchant ID optional"
              name="paypalManualMerchantId"
            />
            <label className="grid gap-2 text-sm font-semibold text-ink">
              Environment
              <select className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm" defaultValue={paypalConnection?.environment === "live" ? "live" : "sandbox"} name="paypalEnvironment">
                <option value="sandbox">Sandbox</option>
                <option value="live">Live</option>
              </select>
            </label>
          </div>
        </Card>
        <Card className="p-6">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
            Test / Live
          </p>
          <h3 className="mt-3 text-xl font-black text-ink">YouCan Pay API</h3>
          <p className="mt-2 text-sm leading-6 text-muted">
            Configure YouCan Pay API keys for checkout readiness. Enable the YouCan Pay method below too.
          </p>
          <div className="mt-5 grid gap-4">
            <Input
              defaultValue={youcanConnection?.public_key ?? ""}
              id="youcanManualPublicKey"
              label="Public key"
              name="youcanManualPublicKey"
            />
            <Input
              id="youcanManualPrivateKey"
              label={youcanConnection?.config_status === "configured" ? "Private key (stored, leave blank to keep)" : "Private key"}
              name="youcanManualPrivateKey"
              type="password"
            />
            <Input
              defaultValue={youcanConnection?.account_reference ?? ""}
              id="youcanManualAccountId"
              label="Store ID / account ID"
              name="youcanManualAccountId"
            />
            <label className="grid gap-2 text-sm font-semibold text-ink">
              Environment
              <select className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm" defaultValue={youcanConnection?.environment === "live" ? "live" : "test"} name="youcanEnvironment">
                <option value="test">Test</option>
                <option value="live">Live</option>
              </select>
            </label>
          </div>
        </Card>
      </div>
      <div>
        <Button type="submit">Save advanced provider config</Button>
      </div>
    </form>
  );
}

export default async function PaymentsPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; missing?: string; payments?: string; storeId?: string }>;
}) {
  const params = await searchParams;
  const { activeStore, error, methods, providerConnections, stores } = await getPaymentsData(params.storeId);
  const message = statusMessage(params.payments);
  const missingMessage = missingEnvMessage(params.missing);
  const stripeConnection = providerConnectionByName(providerConnections, "stripe");
  const paypalConnection = providerConnectionByName(providerConnections, "paypal");
  const youcanConnection = providerConnectionByName(providerConnections, "youcan_pay");

  return (
    <div className="grid gap-6 lg:gap-8">
      <PageHeader
        description="Configure store-owned customer payment methods. These settings are separate from SHASTORE AI platform billing."
        title="Payments"
      />
      {message ? (
        <Card className="border-emerald-200 bg-emerald-50 p-5">
          <p className="text-sm font-bold text-emerald-700">{message}</p>
        </Card>
      ) : null}
      {params.error || error ? (
        <Card className="border-red-200 bg-red-50 p-5">
          <p className="text-sm font-bold text-red-700">{params.error || error}</p>
        </Card>
      ) : null}
      {missingMessage ? (
        <Card className="border-red-200 bg-red-50 p-5">
          <p className="text-sm font-bold text-red-700">{missingMessage}</p>
        </Card>
      ) : null}
      {stores.length ? (
        <Card className="grid gap-4 p-5 lg:grid-cols-[1fr_auto] lg:items-end">
          <form className="grid gap-2" method="get">
            <label className="text-sm font-semibold text-ink" htmlFor="storeId">
              Active store
            </label>
            <select
              className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink shadow-sm"
              defaultValue={activeStore?.id}
              id="storeId"
              name="storeId"
            >
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.store_name || store.name || store.slug || store.id}
                </option>
              ))}
            </select>
            <Button type="submit" variant="secondary">Switch store</Button>
          </form>
        </Card>
      ) : null}
      {activeStore ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <ProviderConnectionCard
            connection={stripeConnection}
            provider="stripe"
            storeId={activeStore.id}
          />
          <ProviderConnectionCard
            connection={paypalConnection}
            provider="paypal"
            storeId={activeStore.id}
          />
        </div>
      ) : null}
      {activeStore ? (
        <ManualProviderConfigForm
          paypalConnection={paypalConnection}
          stripeConnection={stripeConnection}
          storeId={activeStore.id}
          youcanConnection={youcanConnection}
        />
      ) : null}
      {activeStore ? (
        <form action={saveStorePaymentMethods} className="grid gap-6">
          <input name="storeId" type="hidden" value={activeStore.id} />
          <div className="grid gap-6 lg:grid-cols-2">
            {storePaymentMethodOptions.map((option) => {
              const current = methodByName(methods, option.method);
              return (
                <Card className="p-6 lg:p-8" key={option.method}>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                    {option.method.replace("_", " ")}
                  </p>
                  <h2 className="mt-3 text-2xl font-black tracking-[-0.03em] text-ink">
                    {option.title}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-muted">{option.description}</p>
                  <div className="mt-5 grid gap-4">
                    <Toggle
                      checked={current?.is_enabled ?? false}
                      description="Show this method in public checkout for this store."
                      label="Enabled"
                      name={`${option.method}Enabled`}
                    />
                    <Input
                      defaultValue={current?.display_name ?? defaultPaymentDisplayName(option.method)}
                      id={`${option.method}-display-name`}
                      label="Display name"
                      name={`${option.method}DisplayName`}
                    />
                    <Textarea
                      defaultValue={current?.instructions ?? ""}
                      id={`${option.method}-instructions`}
                      label="Instructions"
                      name={`${option.method}Instructions`}
                      placeholder="Buyer-facing payment instructions."
                    />
                    {option.method === "paypal" ? (
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Input
                          defaultValue={methodConfigValue(current, "merchant_email")}
                          id="paypal-merchant-email"
                          label="PayPal merchant email"
                          name="paypalMerchantEmail"
                        />
                        <Input
                          defaultValue={methodConfigValue(current, "client_id")}
                          id="paypal-client-id"
                          label="PayPal client ID"
                          name="paypalClientId"
                        />
                      </div>
                    ) : null}
                    {option.method === "youcan_pay" ? (
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Input
                          defaultValue={methodConfigValue(current, "store_id")}
                          id="youcan-store-id"
                          label="YouCan store ID"
                          name="youcanStoreId"
                        />
                        <Input
                          defaultValue={methodConfigValue(current, "public_key")}
                          id="youcan-public-key"
                          label="YouCan public key"
                          name="youcanPublicKey"
                        />
                      </div>
                    ) : null}
                  </div>
                </Card>
              );
            })}
          </div>
          <Card className="border-amber-200 bg-amber-50 p-5">
            <p className="text-sm font-bold leading-6 text-amber-900">
              PayPal and YouCan Pay are configuration placeholders only. No online payment is processed in this phase, and platform billing Stripe credentials are never used for store customer payments.
            </p>
          </Card>
          <div>
            <Button type="submit">Save store payment methods</Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
