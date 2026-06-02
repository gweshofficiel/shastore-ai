import { PageHeader } from "@/components/dashboard/page-header";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  createEmailCampaignAction,
  sendEmailCampaignAction
} from "@/lib/email-campaign-actions";
import { createClient } from "@/lib/supabase/server";
import { fetchStoresForAuthUser, type UserStoreRow } from "@/lib/stores/user-stores";
import { getActiveWorkspaceForUser } from "@/lib/workspaces/active-workspace";

export const dynamic = "force-dynamic";

type EmailCampaignRow = {
  campaign_name: string;
  content: string;
  created_at: string;
  id: string;
  recipient_count: number | null;
  sent_at: string | null;
  status: string;
  subject: string;
  target_segment: string;
};

type CampaignRecipientRow = {
  campaign_id: string;
  status: string;
};

type CampaignsData = {
  activeStore: UserStoreRow | null;
  campaigns: EmailCampaignRow[];
  error: string | null;
  recipientCountsByCampaign: Map<string, { queued: number; sent: number; total: number }>;
  stores: UserStoreRow[];
};

const segmentOptions = [
  ["all_customers", "All customers"],
  ["new_customers", "New customers"],
  ["returning_customers", "Returning customers"],
  ["vip_customers", "VIP customers"],
  ["digital_product_customers", "Digital product customers"]
] as const;

function message(status: string | undefined) {
  const messages: Record<string, string> = {
    "already-sent": "This campaign has already been sent.",
    "create-failed": "Campaign could not be created. Apply the email campaigns migration and try again.",
    created: "Campaign draft created.",
    duplicate: "No new recipients were queued because this campaign already has recipients.",
    invalid: "Add campaign name, subject, and content.",
    "missing-campaign": "Campaign was not found.",
    "no-recipients": "No customer emails matched that target segment.",
    "not-authorized": "You are not authorized to manage campaigns for this store.",
    sent: "Campaign emails queued."
  };

  return status ? messages[status] : null;
}

function segmentLabel(segment: string) {
  return segmentOptions.find(([value]) => value === segment)?.[1] ?? segment.replaceAll("_", " ");
}

function formatDate(value: string | null) {
  if (!value) {
    return "Not sent";
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short"
  }).format(new Date(value));
}

function statusClass(status: string) {
  if (status === "sent") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (status === "scheduled") {
    return "bg-blue-100 text-blue-700";
  }

  return "bg-amber-100 text-amber-700";
}

async function getCampaignsData(selectedStoreId?: string): Promise<CampaignsData> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      activeStore: null,
      campaigns: [],
      error: "Sign in to manage email campaigns.",
      recipientCountsByCampaign: new Map(),
      stores: []
    };
  }

  const selection = await getActiveWorkspaceForUser({ supabase, userId: user.id });
  const workspaceId = selection.activeWorkspaceId;
  const { stores, error: storesError } = await fetchStoresForAuthUser(supabase, user.id, workspaceId);

  if (storesError) {
    return {
      activeStore: null,
      campaigns: [],
      error: "Stores could not be loaded.",
      recipientCountsByCampaign: new Map(),
      stores: []
    };
  }

  const activeStore = stores.find((store) => store.id === selectedStoreId) ?? stores[0] ?? null;

  if (!activeStore) {
    return {
      activeStore: null,
      campaigns: [],
      error: null,
      recipientCountsByCampaign: new Map(),
      stores
    };
  }

  const { data: campaigns, error } = await supabase
    .from("email_campaigns" as never)
    .select("id, campaign_name, subject, content, target_segment, status, recipient_count, sent_at, created_at")
    .eq("workspace_id" as never, workspaceId as never)
    .eq("store_id" as never, activeStore.id as never)
    .order("created_at" as never, { ascending: false } as never)
    .limit(50);

  if (error) {
    return {
      activeStore,
      campaigns: [],
      error: "Email campaign tables could not be loaded. Apply the email campaigns migration.",
      recipientCountsByCampaign: new Map(),
      stores
    };
  }

  const campaignRows = (campaigns ?? []) as unknown as EmailCampaignRow[];
  const campaignIds = campaignRows.map((campaign) => campaign.id);
  const { data: recipients } = campaignIds.length
    ? await supabase
        .from("email_campaign_recipients" as never)
        .select("campaign_id, status")
        .eq("workspace_id" as never, workspaceId as never)
        .eq("store_id" as never, activeStore.id as never)
        .in("campaign_id" as never, campaignIds as never)
    : { data: [] };
  const recipientCountsByCampaign = new Map<string, { queued: number; sent: number; total: number }>();

  for (const recipient of (recipients ?? []) as unknown as CampaignRecipientRow[]) {
    const current = recipientCountsByCampaign.get(recipient.campaign_id) ?? { queued: 0, sent: 0, total: 0 };
    current.total += 1;

    if (recipient.status === "sent") {
      current.sent += 1;
    }

    if (recipient.status === "queued" || recipient.status === "pending") {
      current.queued += 1;
    }

    recipientCountsByCampaign.set(recipient.campaign_id, current);
  }

  return {
    activeStore,
    campaigns: campaignRows,
    error: null,
    recipientCountsByCampaign,
    stores
  };
}

export default async function EmailCampaignsPage({
  searchParams
}: {
  searchParams: Promise<{ campaigns?: string; storeId?: string }>;
}) {
  const query = await searchParams;
  const { activeStore, campaigns, error, recipientCountsByCampaign, stores } = await getCampaignsData(query.storeId);
  const notice = message(query.campaigns);

  return (
    <div className="grid gap-6 lg:gap-8">
      <PageHeader
        action={<ButtonLink href="/dashboard/email" variant="secondary">Email settings</ButtonLink>}
        description="Create campaign drafts and queue campaign emails only when the seller explicitly sends them."
        title="Email Campaigns"
      />

      {notice ? (
        <Card className="border-blue-200 bg-blue-50 p-5">
          <p className="text-sm font-bold text-blue-800">{notice}</p>
        </Card>
      ) : null}

      {error ? (
        <Card className="border-red-200 bg-red-50 p-5">
          <p className="text-sm font-bold text-red-700">{error}</p>
        </Card>
      ) : null}

      {activeStore ? (
        <>
          <Card className="grid gap-4 p-5 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Active store</p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">
                {activeStore.store_name || activeStore.name || "Workspace store"}
              </h2>
              <p className="mt-1 text-sm text-muted">
                Campaigns are store-scoped and queued into the existing email foundation.
              </p>
            </div>
            <form className="flex flex-col gap-3 sm:min-w-[260px]" method="get">
              <label className="grid gap-2 text-sm font-semibold text-ink">
                <span>Switch store</span>
                <select
                  className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink shadow-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                  defaultValue={activeStore.id}
                  name="storeId"
                >
                  {stores.map((store) => (
                    <option key={store.id} value={store.id}>
                      {store.store_name || store.name || store.slug || store.id}
                    </option>
                  ))}
                </select>
              </label>
              <Button type="submit" variant="secondary">View campaigns</Button>
            </form>
          </Card>

          <Card className="grid gap-5 p-6">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Create campaign</p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">Draft a campaign</h2>
            </div>
            <form action={createEmailCampaignAction} className="grid gap-4">
              <input name="storeId" type="hidden" value={activeStore.id} />
              <Input id="campaign-name" label="Campaign name" maxLength={180} name="campaignName" required />
              <Input id="campaign-subject" label="Subject" maxLength={240} name="subject" required />
              <label className="grid gap-2 text-sm font-semibold text-ink">
                <span>Target segment</span>
                <select
                  className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink shadow-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                  name="targetSegment"
                >
                  {segmentOptions.map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <Textarea
                id="campaign-content"
                label="Email content"
                maxLength={8000}
                name="content"
                placeholder="Write the email body customers will receive."
                required
                rows={8}
              />
              <div className="flex justify-end">
                <Button type="submit">Create draft</Button>
              </div>
            </form>
          </Card>

          <section className="grid gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Campaigns</p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">
                {campaigns.length} {campaigns.length === 1 ? "campaign" : "campaigns"}
              </h2>
            </div>

            {campaigns.length ? (
              campaigns.map((campaign) => {
                const counts = recipientCountsByCampaign.get(campaign.id) ?? { queued: 0, sent: 0, total: campaign.recipient_count ?? 0 };

                return (
                  <Card className="grid gap-4 p-5" key={campaign.id}>
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.16em] ${statusClass(campaign.status)}`}>
                            {campaign.status}
                          </span>
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-muted">
                            {segmentLabel(campaign.target_segment)}
                          </span>
                        </div>
                        <h3 className="mt-3 text-xl font-black tracking-[-0.03em] text-ink">{campaign.campaign_name}</h3>
                        <p className="mt-1 text-sm font-bold text-muted">{campaign.subject}</p>
                      </div>
                      <div className="text-sm font-bold text-muted sm:text-right">
                        <p>Recipients: {counts.total}</p>
                        <p>Queued: {counts.queued}</p>
                        <p>Sent: {counts.sent}</p>
                        <p>Sent at: {formatDate(campaign.sent_at)}</p>
                      </div>
                    </div>
                    <p className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm leading-6 text-muted">
                      {campaign.content}
                    </p>
                    {campaign.status !== "sent" ? (
                      <form action={sendEmailCampaignAction} className="flex justify-end">
                        <input name="campaignId" type="hidden" value={campaign.id} />
                        <input name="storeId" type="hidden" value={activeStore.id} />
                        <Button type="submit">Send campaign</Button>
                      </form>
                    ) : null}
                  </Card>
                );
              })
            ) : (
              <Card className="border-dashed p-8 text-center">
                <h3 className="text-xl font-black tracking-[-0.03em] text-ink">No campaigns yet</h3>
                <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted">
                  Create a draft campaign. Emails are not queued until you click Send campaign.
                </p>
              </Card>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
