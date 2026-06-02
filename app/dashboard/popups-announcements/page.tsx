import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getUserWorkspaceRole, hasPermission } from "@/lib/permissions/rbac";
import { createClient } from "@/lib/supabase/server";
import { fetchStoresForAuthUser, type UserStoreRow } from "@/lib/stores/user-stores";
import {
  createStoreMarketingMessageAction,
  updateStoreMarketingMessageStatusAction
} from "@/lib/store-marketing-message-actions";
import {
  marketingMessageTypeLabel,
  type StoreMarketingMessageRow
} from "@/lib/store-marketing-messages";
import { getActiveWorkspaceForUser } from "@/lib/workspaces/active-workspace";

export const dynamic = "force-dynamic";

type MessagesData = {
  activeStore: UserStoreRow | null;
  error: string | null;
  messages: StoreMarketingMessageRow[];
  stores: UserStoreRow[];
};

function statusMessage(value: string | undefined) {
  const messages: Record<string, string> = {
    "access-denied": "You do not have permission to manage popups for that store.",
    "create-failed": "Popup or announcement could not be created. Apply the migration and try again.",
    created: "Popup or announcement created.",
    invalid: "Title and message are required.",
    "invalid-dates": "Start date must be before the end date.",
    updated: "Status updated.",
    "update-failed": "Status could not be updated."
  };

  return value ? messages[value] ?? null : null;
}

function statusClass(status: string) {
  if (status === "active") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (status === "disabled") {
    return "bg-red-100 text-red-700";
  }

  return "bg-slate-100 text-muted";
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "No limit";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

async function getMessagesData(selectedStoreId?: string): Promise<MessagesData> {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { activeStore: null, error: "Sign in to manage popups and announcements.", messages: [], stores: [] };
  }

  const selection = await getActiveWorkspaceForUser({ supabase, userId: user.id });
  const workspaceId = selection.activeWorkspaceId;
  const role = await getUserWorkspaceRole(supabase, workspaceId, user.id);

  if (!hasPermission(role, "can_edit_stores")) {
    return { activeStore: null, error: "You do not have permission to manage popups and announcements.", messages: [], stores: [] };
  }

  const { stores, error: storesError } = await fetchStoresForAuthUser(supabase, user.id, workspaceId);
  const activeStore = stores.find((store) => store.id === selectedStoreId) ?? stores[0] ?? null;

  if (storesError || !activeStore) {
    return {
      activeStore,
      error: storesError ? "Stores could not be loaded." : null,
      messages: [],
      stores
    };
  }

  const { data, error } = await supabase
    .from("store_marketing_messages" as never)
    .select("id, workspace_id, store_id, message_type, title, message, button_text, button_link, status, starts_at, ends_at")
    .eq("workspace_id" as never, workspaceId as never)
    .eq("store_id" as never, activeStore.id as never)
    .order("created_at" as never, { ascending: false } as never);

  if (error) {
    return {
      activeStore,
      error: "Popups and announcements could not be loaded. Apply the migration.",
      messages: [],
      stores
    };
  }

  return {
    activeStore,
    error: null,
    messages: (data ?? []) as unknown as StoreMarketingMessageRow[],
    stores
  };
}

export default async function PopupsAnnouncementsPage({
  searchParams
}: {
  searchParams: Promise<{ messages?: string; storeId?: string }>;
}) {
  const query = await searchParams;
  const { activeStore, error, messages, stores } = await getMessagesData(query.storeId);
  const message = statusMessage(query.messages);
  const activeCount = messages.filter((item) => item.status === "active").length;
  const popupCount = messages.filter((item) => item.message_type !== "announcement_bar").length;

  return (
    <div className="grid gap-6 lg:gap-8">
      <PageHeader
        description="Create announcement bars and storefront popups that appear only when active and inside their scheduled date window."
        title="Popups & Announcements"
      />

      {message ? (
        <Card className="border-blue-200 bg-blue-50 p-5">
          <p className="text-sm font-bold text-blue-800">{message}</p>
        </Card>
      ) : null}
      {error ? (
        <Card className="border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-bold text-amber-800">{error}</p>
        </Card>
      ) : null}

      {stores.length > 1 ? (
        <Card className="p-5">
          <form className="flex flex-wrap items-end gap-3">
            <label className="grid gap-2 text-sm font-semibold text-ink">
              <span>Store</span>
              <select className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink outline-none" defaultValue={activeStore?.id ?? ""} name="storeId">
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>{store.name}</option>
                ))}
              </select>
            </label>
            <Button type="submit">Switch store</Button>
          </form>
        </Card>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Messages" value={messages.length} />
        <MetricCard label="Active" value={activeCount} />
        <MetricCard label="Popups" value={popupCount} />
      </section>

      <section className="grid gap-6 lg:grid-cols-[420px_minmax(0,1fr)]">
        <Card className="p-6">
          <h2 className="text-2xl font-black tracking-[-0.03em] text-ink">Create message</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-muted">
            Announcement bars render at the top of the storefront. Popups can be closed by shoppers and will not repeat in the same session.
          </p>
          {activeStore ? (
            <form action={createStoreMarketingMessageAction} className="mt-5 grid gap-4">
              <input name="storeId" type="hidden" value={activeStore.id} />
              <label className="grid gap-2 text-sm font-semibold text-ink">
                <span>Type</span>
                <select className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink outline-none" defaultValue="announcement_bar" name="messageType">
                  <option value="announcement_bar">Announcement bar</option>
                  <option value="discount_popup">Discount popup</option>
                  <option value="newsletter_popup">Newsletter popup</option>
                  <option value="exit_intent_popup">Exit intent popup</option>
                </select>
              </label>
              <Input label="Title" name="title" placeholder="Summer sale" required />
              <label className="grid gap-2 text-sm font-semibold text-ink">
                <span>Message</span>
                <textarea className="min-h-28 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-ink outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100" name="message" placeholder="Tell shoppers about your offer." required />
              </label>
              <Input label="Button text" name="buttonText" placeholder="Shop now" />
              <Input label="Button link" name="buttonLink" placeholder="/store/your-store/category/sale" />
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Start date" name="startsAt" type="datetime-local" />
                <Input label="End date" name="endsAt" type="datetime-local" />
              </div>
              <label className="grid gap-2 text-sm font-semibold text-ink">
                <span>Status</span>
                <select className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink outline-none" defaultValue="draft" name="status">
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="disabled">Disabled</option>
                </select>
              </label>
              <Button type="submit">Create</Button>
            </form>
          ) : null}
        </Card>

        <Card className="p-6">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Marketing messages</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">
              {activeStore ? activeStore.name : "No store selected"}
            </h2>
          </div>

          <div className="mt-5 grid gap-3">
            {messages.length ? (
              messages.map((item) => (
                <article className="rounded-[1.5rem] border border-slate-200 bg-white p-5" key={item.id}>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                        {marketingMessageTypeLabel(item.message_type)}
                      </p>
                      <h3 className="mt-2 text-xl font-black tracking-[-0.03em] text-ink">{item.title}</h3>
                      <p className="mt-2 text-sm font-semibold leading-6 text-muted">{item.message}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${statusClass(item.status)}`}>
                      {item.status}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-2 rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-muted sm:grid-cols-2">
                    <p>Starts: {formatDate(item.starts_at)}</p>
                    <p>Ends: {formatDate(item.ends_at)}</p>
                    <p>Button: {item.button_text || "None"}</p>
                    <p className="break-all">Link: {item.button_link || "None"}</p>
                  </div>
                  <form action={updateStoreMarketingMessageStatusAction} className="mt-4 flex flex-wrap items-end gap-2">
                    <input name="messageId" type="hidden" value={item.id} />
                    <input name="storeId" type="hidden" value={item.store_id} />
                    <label className="grid gap-2 text-sm font-semibold text-ink">
                      <span>Status</span>
                      <select className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink outline-none" defaultValue={item.status} name="status">
                        <option value="draft">Draft</option>
                        <option value="active">Active</option>
                        <option value="disabled">Disabled</option>
                      </select>
                    </label>
                    <Button type="submit" variant="secondary">Update</Button>
                  </form>
                </article>
              ))
            ) : (
              <div className="rounded-[1.5rem] border border-dashed border-slate-300 p-8 text-center">
                <h3 className="text-xl font-black tracking-[-0.03em] text-ink">No messages yet</h3>
                <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted">
                  Create an announcement bar or popup to show active marketing messages on the storefront.
                </p>
              </div>
            )}
          </div>
        </Card>
      </section>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number | string }) {
  return (
    <Card className="p-5">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-black tracking-[-0.04em] text-ink">{value}</p>
    </Card>
  );
}
