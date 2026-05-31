import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { saveStorePaymentMethods } from "@/lib/store-payment-method-actions";
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
  stores: UserStoreRow[];
};

async function getPaymentsData(selectedStoreId?: string): Promise<PaymentsData> {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { activeStore: null, error: "Sign in to manage store payments.", methods: [], stores: [] };
  }

  const selection = await getActiveWorkspaceForUser({ supabase, userId: user.id });
  const role = await getUserWorkspaceRole(supabase, selection.activeWorkspaceId, user.id);

  if (!hasPermission(role, "can_manage_payments")) {
    return { activeStore: null, error: "You do not have permission to manage payments.", methods: [], stores: [] };
  }

  const { stores, error: storesError } = await fetchStoresForAuthUser(supabase, user.id, selection.activeWorkspaceId);

  if (storesError) {
    return { activeStore: null, error: "Stores could not be loaded. Please try again.", methods: [], stores: [] };
  }

  const activeStore = stores.find((store) => store.id === selectedStoreId) ?? stores[0] ?? null;

  if (!activeStore) {
    return { activeStore: null, error: null, methods: [], stores };
  }

  const methods = await getStorePaymentMethods(supabase, activeStore.id);

  return { activeStore, error: null, methods, stores };
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
    "save-failed": "Store payment methods could not be saved. Confirm the migration has been applied."
  };

  return value ? messages[value] : null;
}

export default async function PaymentsPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; payments?: string; storeId?: string }>;
}) {
  const params = await searchParams;
  const { activeStore, error, methods, stores } = await getPaymentsData(params.storeId);
  const message = statusMessage(params.payments);

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
