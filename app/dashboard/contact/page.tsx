import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  updateStoreContactMessageStatus,
  updateStoreContactSettings
} from "@/lib/store-contact-actions";
import { createClient } from "@/lib/supabase/server";
import { fetchStoresForAuthUser, type UserStoreRow } from "@/lib/stores/user-stores";
import { getActiveWorkspaceForUser } from "@/lib/workspaces/active-workspace";

export const dynamic = "force-dynamic";

type ContactStoreRow = {
  business_address: string | null;
  business_hours: string | null;
  contact_message: string | null;
  id: string;
  slug: string | null;
  support_email: string | null;
  support_phone: string | null;
  whatsapp_number: string | null;
};

type ContactMessageRow = {
  created_at: string;
  customer_email: string;
  customer_name: string;
  id: string;
  message: string;
  status: string;
  subject: string;
};

type ContactDashboardData = {
  activeStore: UserStoreRow | null;
  contactStore: ContactStoreRow | null;
  error: string | null;
  messages: ContactMessageRow[];
  stores: UserStoreRow[];
};

function statusMessage(status: string | undefined) {
  const messages: Record<string, string> = {
    failed: "Contact message could not be submitted.",
    invalid: "Contact message details were invalid.",
    "message-updated": "Contact message updated.",
    "message-update-failed": "Contact message could not be updated.",
    "missing-store": "Choose a store before managing contact settings.",
    "not-authorized": "You do not have permission to manage that store.",
    "settings-failed": "Contact settings could not be saved.",
    "settings-saved": "Contact settings saved.",
    sent: "Contact message sent."
  };

  return status ? messages[status] : null;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short"
  }).format(new Date(value));
}

function statusClass(status: string) {
  if (status === "archived") {
    return "bg-slate-100 text-slate-600";
  }

  return status === "read"
    ? "bg-blue-100 text-blue-700"
    : "bg-emerald-100 text-emerald-700";
}

async function getContactDashboardData(selectedStoreId?: string): Promise<ContactDashboardData> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { activeStore: null, contactStore: null, error: "Sign in to manage contact settings.", messages: [], stores: [] };
  }

  const selection = await getActiveWorkspaceForUser({ supabase, userId: user.id });
  const workspaceId = selection.activeWorkspaceId;
  const { stores, error: storesError } = await fetchStoresForAuthUser(supabase, user.id, workspaceId);

  if (storesError) {
    return { activeStore: null, contactStore: null, error: "Stores could not be loaded.", messages: [], stores: [] };
  }

  const activeStore = stores.find((store) => store.id === selectedStoreId) ?? stores[0] ?? null;

  if (!activeStore) {
    return { activeStore: null, contactStore: null, error: null, messages: [], stores };
  }

  const { data: storeData, error: storeError } = await supabase
    .from("stores" as never)
    .select("id, slug, support_email, support_phone, whatsapp_number, business_address, business_hours, contact_message")
    .eq("workspace_id" as never, workspaceId as never)
    .eq("id" as never, activeStore.id as never)
    .maybeSingle();

  if (storeError) {
    return {
      activeStore,
      contactStore: null,
      error: "Contact settings could not be loaded. Confirm the contact migration has been applied.",
      messages: [],
      stores
    };
  }

  const { data: messageData, error: messageError } = await supabase
    .from("store_contact_messages" as never)
    .select("id, customer_name, customer_email, subject, message, status, created_at")
    .eq("workspace_id" as never, workspaceId as never)
    .eq("store_id" as never, activeStore.id as never)
    .order("created_at" as never, { ascending: false } as never)
    .limit(100);

  if (messageError) {
    return {
      activeStore,
      contactStore: storeData as unknown as ContactStoreRow | null,
      error: "Contact messages could not be loaded. Confirm the contact migration has been applied.",
      messages: [],
      stores
    };
  }

  return {
    activeStore,
    contactStore: storeData as unknown as ContactStoreRow | null,
    error: null,
    messages: (messageData ?? []) as unknown as ContactMessageRow[],
    stores
  };
}

export default async function StoreContactDashboard({
  searchParams
}: {
  searchParams: Promise<{ contact?: string; storeId?: string }>;
}) {
  const query = await searchParams;
  const { activeStore, contactStore, error, messages, stores } = await getContactDashboardData(query.storeId);
  const message = statusMessage(query.contact);

  return (
    <div className="grid gap-6 lg:gap-8">
      <PageHeader
        description="Manage public contact details and read customer contact messages."
        title="Contact"
      />

      {message ? (
        <Card className="border-blue-100 bg-blue-50 p-4 text-sm font-bold text-blue-800">
          {message}
        </Card>
      ) : null}

      {error ? (
        <Card className="border-red-200 bg-red-50 p-5 text-sm font-bold text-red-700">
          {error}
        </Card>
      ) : null}

      {stores.length ? (
        <Card className="p-4">
          <form className="flex flex-wrap items-end gap-3">
            <label className="grid gap-2 text-sm font-bold text-ink">
              <span>Store</span>
              <select
                className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-ink outline-none"
                defaultValue={activeStore?.id}
                name="storeId"
              >
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.store_name || store.name || store.slug || store.id}
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit" variant="secondary">
              View store
            </Button>
          </form>
        </Card>
      ) : null}

      {activeStore && contactStore ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <Card className="p-5">
            <h2 className="text-2xl font-black tracking-[-0.03em] text-ink">
              Contact page settings
            </h2>
            <form action={updateStoreContactSettings} className="mt-5 grid gap-4">
              <input name="storeId" type="hidden" value={activeStore.id} />
              <Input
                defaultValue={contactStore.support_email ?? ""}
                id="contact-email"
                label="Contact email"
                maxLength={180}
                name="contactEmail"
                placeholder="support@example.com"
                type="email"
              />
              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  defaultValue={contactStore.support_phone ?? ""}
                  id="contact-phone"
                  label="Phone"
                  maxLength={80}
                  name="phone"
                  placeholder="+1 555 123 4567"
                />
                <Input
                  defaultValue={contactStore.whatsapp_number ?? ""}
                  id="contact-whatsapp"
                  label="WhatsApp number"
                  maxLength={80}
                  name="whatsappNumber"
                  placeholder="+1 555 123 4567"
                />
              </div>
              <Textarea
                defaultValue={contactStore.business_address ?? ""}
                id="contact-address"
                label="Address"
                maxLength={1000}
                name="businessAddress"
                placeholder="Store address or service area"
                rows={3}
              />
              <Textarea
                defaultValue={contactStore.business_hours ?? ""}
                id="contact-hours"
                label="Business hours"
                maxLength={1000}
                name="businessHours"
                placeholder="Mon-Fri, 9:00-18:00"
                rows={3}
              />
              <Textarea
                defaultValue={contactStore.contact_message ?? ""}
                id="contact-message"
                label="Short contact message"
                maxLength={1000}
                name="contactMessage"
                placeholder="Tell customers when and how you usually respond."
                rows={4}
              />
              <Button type="submit">Save contact settings</Button>
            </form>
          </Card>

          <section className="grid gap-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                  Contact Messages
                </p>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">
                  {messages.length} {messages.length === 1 ? "message" : "messages"}
                </h2>
              </div>
              {contactStore.slug ? (
                <a
                  className="rounded-full bg-slate-100 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-muted"
                  href={`/store/${contactStore.slug}/contact`}
                  target="_blank"
                >
                  View contact page
                </a>
              ) : null}
            </div>

            {messages.length ? (
              messages.map((item) => (
                <Card className="grid gap-4 p-5" key={item.id}>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${statusClass(item.status)}`}>
                        {item.status}
                      </span>
                      <h3 className="mt-3 text-xl font-black tracking-[-0.03em] text-ink">
                        {item.subject}
                      </h3>
                      <p className="mt-1 text-sm font-semibold text-muted">
                        {item.customer_name} · {item.customer_email} · {formatDate(item.created_at)}
                      </p>
                    </div>
                  </div>
                  <p className="whitespace-pre-line rounded-2xl bg-slate-50 p-3 text-sm font-semibold leading-6 text-muted">
                    {item.message}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {["new", "read", "archived"]
                      .filter((status) => status !== item.status)
                      .map((status) => (
                        <form action={updateStoreContactMessageStatus} key={status}>
                          <input name="messageId" type="hidden" value={item.id} />
                          <input name="storeId" type="hidden" value={activeStore.id} />
                          <input name="status" type="hidden" value={status} />
                          <Button type="submit" variant="secondary">
                            Mark {status}
                          </Button>
                        </form>
                      ))}
                  </div>
                </Card>
              ))
            ) : (
              <Card className="border-dashed p-8 text-center">
                <h3 className="text-xl font-black tracking-[-0.03em] text-ink">
                  No contact messages yet
                </h3>
                <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted">
                  Messages submitted through the public storefront contact form will appear here.
                </p>
              </Card>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
