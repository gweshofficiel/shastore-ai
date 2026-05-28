import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { saveStoreEmailSettings } from "@/lib/store-email-actions";
import { createClient } from "@/lib/supabase/server";
import { fetchStoresForAuthUser, type UserStoreRow } from "@/lib/stores/user-stores";
import { getActiveWorkspaceForUser } from "@/lib/workspaces/active-workspace";

export const dynamic = "force-dynamic";

type EmailSettingsRow = {
  enable_customer_welcome?: boolean | null;
  enable_low_stock_alert?: boolean | null;
  enable_order_confirmation?: boolean | null;
  enable_order_status_update?: boolean | null;
  enable_review_request?: boolean | null;
  reply_to_email?: string | null;
  sender_name?: string | null;
};

type EmailLogRow = {
  created_at: string;
  error_message?: string | null;
  id: string;
  recipient: string;
  status: string;
  subject: string;
  template_key: string;
};

type EmailDashboardData = {
  activeStore: UserStoreRow | null;
  error: string | null;
  logs: EmailLogRow[];
  settings: EmailSettingsRow | null;
  stores: UserStoreRow[];
};

function message(status: string | undefined) {
  const messages: Record<string, string> = {
    "missing-store": "Choose a store before managing email settings.",
    "settings-failed": "Email settings could not be saved.",
    "settings-saved": "Email settings saved."
  };

  return status ? messages[status] : null;
}

function checked(value: boolean | null | undefined, fallback = true) {
  return value ?? fallback;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short"
  }).format(new Date(value));
}

async function getEmailDashboardData(selectedStoreId?: string): Promise<EmailDashboardData> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      activeStore: null,
      error: "Sign in to manage email settings.",
      logs: [],
      settings: null,
      stores: []
    };
  }

  const selection = await getActiveWorkspaceForUser({ supabase, userId: user.id });
  const workspaceId = selection.activeWorkspaceId;
  const { stores, error: storesError } = await fetchStoresForAuthUser(supabase, user.id, workspaceId);

  if (storesError) {
    return {
      activeStore: null,
      error: "Stores could not be loaded. Please try again.",
      logs: [],
      settings: null,
      stores: []
    };
  }

  const activeStore = stores.find((store) => store.id === selectedStoreId) ?? stores[0] ?? null;

  if (!activeStore) {
    return {
      activeStore: null,
      error: null,
      logs: [],
      settings: null,
      stores
    };
  }

  const [settingsResult, logsResult] = await Promise.all([
    supabase
      .from("store_email_settings" as never)
      .select("sender_name, reply_to_email, enable_order_confirmation, enable_order_status_update, enable_review_request, enable_low_stock_alert, enable_customer_welcome")
      .eq("workspace_id" as never, workspaceId as never)
      .eq("store_id" as never, activeStore.id as never)
      .maybeSingle(),
    supabase
      .from("email_event_logs" as never)
      .select("id, recipient, subject, template_key, status, error_message, created_at")
      .eq("workspace_id" as never, workspaceId as never)
      .eq("store_id" as never, activeStore.id as never)
      .order("created_at" as never, { ascending: false } as never)
      .limit(30)
  ]);

  if (settingsResult.error || logsResult.error) {
    return {
      activeStore,
      error: "Email tables could not be loaded. Confirm the email foundation migration has been applied.",
      logs: [],
      settings: null,
      stores
    };
  }

  return {
    activeStore,
    error: null,
    logs: (logsResult.data ?? []) as unknown as EmailLogRow[],
    settings: (settingsResult.data as unknown as EmailSettingsRow | null) ?? null,
    stores
  };
}

function Toggle({
  defaultChecked,
  label,
  name
}: {
  defaultChecked: boolean;
  label: string;
  name: string;
}) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-ink">
      <span>{label}</span>
      <input className="h-5 w-5 accent-slate-900" defaultChecked={defaultChecked} name={name} type="checkbox" />
    </label>
  );
}

export default async function EmailSettingsPage({
  searchParams
}: {
  searchParams: Promise<{ email?: string; storeId?: string }>;
}) {
  const query = await searchParams;
  const { activeStore, error, logs, settings, stores } = await getEmailDashboardData(query.storeId);
  const statusMessage = message(query.email);

  return (
    <div className="grid gap-6 lg:gap-8">
      <PageHeader
        description="Queue-based email foundation for order, review, inventory, and future customer lifecycle emails."
        title="Email"
      />

      {statusMessage ? (
        <Card className="border-blue-200 bg-blue-50 p-5">
          <p className="text-sm font-bold text-blue-800">{statusMessage}</p>
        </Card>
      ) : null}

      {error ? (
        <Card className="border-red-200 bg-red-50 p-5">
          <p className="text-sm font-bold text-red-700">{error}</p>
        </Card>
      ) : null}

      {activeStore ? (
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <Card className="grid gap-5 p-5 lg:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                  Active store
                </p>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">
                  {activeStore.name || activeStore.store_name || "Store"}
                </h2>
                <p className="mt-1 text-sm text-muted">
                  Emails are queued as internal logs. External delivery can attach later.
                </p>
              </div>
              <form className="flex min-w-64 flex-col gap-3" method="get">
                <label className="grid gap-2 text-sm font-semibold text-ink">
                  <span>Switch store</span>
                  <select
                    className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink shadow-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                    defaultValue={activeStore.id}
                    name="storeId"
                  >
                    {stores.map((store) => (
                      <option key={store.id} value={store.id}>
                        {store.name || store.store_name || store.id}
                      </option>
                    ))}
                  </select>
                </label>
                <Button type="submit" variant="secondary">
                  View settings
                </Button>
              </form>
            </div>

            <form action={saveStoreEmailSettings} className="grid gap-4">
              <input name="storeId" type="hidden" value={activeStore.id} />
              <Input
                defaultValue={settings?.sender_name ?? activeStore.name ?? activeStore.store_name ?? ""}
                id="senderName"
                label="Sender name"
                maxLength={160}
                name="senderName"
                placeholder="Your store name"
              />
              <Input
                defaultValue={settings?.reply_to_email ?? ""}
                id="replyToEmail"
                label="Reply-to email"
                maxLength={180}
                name="replyToEmail"
                placeholder="support@example.com"
                type="email"
              />
              <div className="grid gap-3">
                <Toggle
                  defaultChecked={checked(settings?.enable_order_confirmation)}
                  label="Order confirmation"
                  name="enableOrderConfirmation"
                />
                <Toggle
                  defaultChecked={checked(settings?.enable_order_status_update)}
                  label="Order status update"
                  name="enableOrderStatusUpdate"
                />
                <Toggle
                  defaultChecked={checked(settings?.enable_review_request)}
                  label="Review request"
                  name="enableReviewRequest"
                />
                <Toggle
                  defaultChecked={checked(settings?.enable_low_stock_alert)}
                  label="Low stock alert"
                  name="enableLowStockAlert"
                />
                <Toggle
                  defaultChecked={checked(settings?.enable_customer_welcome, false)}
                  label="Customer welcome"
                  name="enableCustomerWelcome"
                />
              </div>
              <Button type="submit">Save email settings</Button>
            </form>
          </Card>

          <Card className="p-5 lg:p-6">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
              Recent email logs
            </p>
            <div className="mt-5 grid gap-3">
              {logs.length ? (
                logs.map((log) => (
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4" key={log.id}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-ink">{log.subject}</p>
                        <p className="mt-1 text-sm font-semibold text-muted">{log.recipient}</p>
                      </div>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-muted">
                        {log.status}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-muted">
                        {log.template_key.replace(/_/g, " ")}
                      </span>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-muted">
                        {formatDate(log.created_at)}
                      </span>
                    </div>
                    {log.error_message ? (
                      <p className="mt-3 text-sm font-semibold text-red-700">{log.error_message}</p>
                    ) : null}
                  </div>
                ))
              ) : (
                <p className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-muted">
                  No email events have been queued for this store yet.
                </p>
              )}
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
