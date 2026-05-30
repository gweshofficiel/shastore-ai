import { PageHeader } from "@/components/dashboard/page-header";
import { MonitoringCopyButton } from "@/components/dashboard/monitoring-copy-button";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { fetchStoresForAuthUser } from "@/lib/stores/user-stores";
import { getWorkspaceDataContext } from "@/lib/workspaces/data-access";

export const dynamic = "force-dynamic";

type MonitoringPageProps = {
  searchParams: Promise<{
    eventType?: string;
    from?: string;
    status?: string;
    storeId?: string;
  }>;
};

type MonitoringEventRow = {
  created_at: string;
  entity_id: string | null;
  entity_type: string;
  event_status: string;
  event_type: string;
  id: string;
  metadata?: Record<string, unknown> | null;
  store_id: string | null;
  user_id: string | null;
  workspace_id: string | null;
};

type EmailEventRow = {
  created_at: string;
  error_message?: string | null;
  id: string;
  status: string;
  store_id: string;
  subject: string;
  template_key: string;
  workspace_id: string;
};

type ThemeRuntimeLogRow = {
  created_at: string;
  event: string;
  id: string;
  message: string;
  store_id: string | null;
  theme_key: string | null;
};

type MediaLogRow = {
  action: string;
  created_at: string;
  id: string;
  media_id: string | null;
  store_id: string;
};

const rangeOptions = [
  { label: "24 hours", value: "24h" },
  { label: "7 days", value: "7d" },
  { label: "30 days", value: "30d" },
  { label: "All time", value: "all" }
] as const;

function cleanFilter(value: string | undefined, maxLength = 120) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function rangeStart(value: string | undefined) {
  const range = value === "24h" || value === "7d" || value === "30d" || value === "all" ? value : "7d";

  if (range === "all") {
    return { range, start: null };
  }

  const start = new Date();
  start.setHours(start.getHours() - (range === "24h" ? 24 : range === "7d" ? 24 * 7 : 24 * 30));
  return { range, start: start.toISOString() };
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
  if (status === "failed") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (status === "warning" || status === "retry_pending") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (status === "sent" || status === "success") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-600";
}

function storeName(stores: Array<{ id: string; name?: string | null; store_name?: string | null; slug?: string | null }>, storeId: string | null) {
  if (!storeId) {
    return "Workspace";
  }

  const store = stores.find((candidate) => candidate.id === storeId);
  return store?.store_name || store?.name || store?.slug || storeId.slice(0, 8);
}

function metricCard(label: string, value: number, note?: string) {
  return (
    <Card className="p-5" key={label}>
      <p className="text-sm font-bold text-muted">{label}</p>
      <p className="mt-4 text-3xl font-black tracking-[-0.04em] text-ink">{value}</p>
      {note ? <p className="mt-2 text-xs font-semibold text-muted">{note}</p> : null}
    </Card>
  );
}

const sensitiveMetadataKeyPattern = /api[_-]?key|credential|password|secret|service[_-]?role|token/i;

function sanitizeMetadataForDisplay(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeMetadataForDisplay);
  }

  if (value && typeof value === "object") {
    const safe: Record<string, unknown> = {};

    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      safe[key] = sensitiveMetadataKeyPattern.test(key)
        ? "[hidden]"
        : sanitizeMetadataForDisplay(nestedValue);
    }

    return safe;
  }

  return value;
}

function metadataStringValue(metadata: Record<string, unknown> | null | undefined, keys: string[]) {
  for (const key of keys) {
    const value = metadata?.[key];

    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return "Not provided";
}

function monitoringEventDetails(event: MonitoringEventRow) {
  const metadata = sanitizeMetadataForDisplay(event.metadata ?? {}) as Record<string, unknown>;
  const code = metadataStringValue(metadata, ["error_code", "code"]);
  const message = metadataStringValue(metadata, ["error_message", "message", "safeMessage"]);
  const details = metadataStringValue(metadata, ["error_details", "details"]);
  const hint = metadataStringValue(metadata, ["error_hint", "hint"]);
  const metadataJson = JSON.stringify(metadata, null, 2);
  const copyText = [
    `Event: ${event.event_type}`,
    `Status: ${event.event_status}`,
    `Entity: ${event.entity_type}${event.entity_id ? ` ${event.entity_id}` : ""}`,
    `Code: ${code}`,
    `Message: ${message}`,
    `Details: ${details}`,
    `Hint: ${hint}`,
    "Metadata:",
    metadataJson
  ].join("\n");

  return { code, copyText, details, hint, message, metadataJson };
}

async function countRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: string,
  workspaceId: string,
  storeId?: string
) {
  let query = supabase
    .from(table as never)
    .select("id", { count: "exact", head: true })
    .eq("workspace_id" as never, workspaceId as never);

  if (storeId) {
    query = query.eq("store_id" as never, storeId as never);
  }

  const { count } = await query;
  return count ?? 0;
}

export default async function MonitoringPage({ searchParams }: MonitoringPageProps) {
  const query = await searchParams;
  const { supabase, user, workspaceId } = await getWorkspaceDataContext({
    permission: "view_analytics",
    redirectTo: "/dashboard/monitoring"
  });
  const storesResult = await fetchStoresForAuthUser(supabase, user.id, workspaceId);
  const stores = storesResult.stores;
  const storeId = cleanFilter(query.storeId, 80);
  const selectedStoreId = stores.some((store) => store.id === storeId) ? storeId : "";
  const eventType = cleanFilter(query.eventType, 120);
  const status = cleanFilter(query.status, 40);
  const { range, start } = rangeStart(query.from);

  let eventsQuery = supabase
    .from("monitoring_events" as never)
    .select("id, workspace_id, store_id, user_id, event_type, event_status, entity_type, entity_id, metadata, created_at")
    .eq("workspace_id" as never, workspaceId as never)
    .order("created_at" as never, { ascending: false } as never)
    .limit(100);

  if (selectedStoreId) {
    eventsQuery = eventsQuery.eq("store_id" as never, selectedStoreId as never);
  }

  if (eventType) {
    eventsQuery = eventsQuery.eq("event_type" as never, eventType as never);
  }

  if (status) {
    eventsQuery = eventsQuery.eq("event_status" as never, status as never);
  }

  if (start) {
    eventsQuery = eventsQuery.gte("created_at" as never, start as never);
  }

  let emailQuery = supabase
    .from("email_event_logs" as never)
    .select("id, workspace_id, store_id, subject, template_key, status, error_message, created_at")
    .eq("workspace_id" as never, workspaceId as never)
    .order("created_at" as never, { ascending: false } as never)
    .limit(50);

  let themeQuery = supabase
    .from("theme_runtime_logs" as never)
    .select("id, store_id, theme_key, event, message, created_at")
    .eq("workspace_id" as never, workspaceId as never)
    .order("created_at" as never, { ascending: false } as never)
    .limit(20);

  let mediaQuery = supabase
    .from("media_logs" as never)
    .select("id, store_id, media_id, action, created_at")
    .eq("workspace_id" as never, workspaceId as never)
    .order("created_at" as never, { ascending: false } as never)
    .limit(20);

  if (selectedStoreId) {
    emailQuery = emailQuery.eq("store_id" as never, selectedStoreId as never);
    themeQuery = themeQuery.eq("store_id" as never, selectedStoreId as never);
    mediaQuery = mediaQuery.eq("store_id" as never, selectedStoreId as never);
  }

  if (start) {
    emailQuery = emailQuery.gte("created_at" as never, start as never);
    themeQuery = themeQuery.gte("created_at" as never, start as never);
    mediaQuery = mediaQuery.gte("created_at" as never, start as never);
  }

  const [
    eventsResult,
    emailsResult,
    themesResult,
    mediaResult,
    storeCount,
    publishedStoreCount,
    productCount,
    orderCount,
    storeOrderCount,
    customerCount,
    sentEmailCount,
    failedEmailCount
  ] = await Promise.all([
    eventsQuery,
    emailQuery,
    themeQuery,
    mediaQuery,
    (async () => {
      let countQuery = supabase
        .from("stores" as never)
        .select("id", { count: "exact", head: true })
        .eq("workspace_id" as never, workspaceId as never);
      if (selectedStoreId) countQuery = countQuery.eq("id" as never, selectedStoreId as never);
      const { count } = await countQuery;
      return count ?? 0;
    })(),
    (async () => {
      let countQuery = supabase
        .from("stores" as never)
        .select("id", { count: "exact", head: true })
        .eq("workspace_id" as never, workspaceId as never)
        .eq("status" as never, "published" as never);
      if (selectedStoreId) countQuery = countQuery.eq("id" as never, selectedStoreId as never);
      const { count } = await countQuery;
      return count ?? 0;
    })(),
    countRows(supabase, "store_products", workspaceId, selectedStoreId),
    countRows(supabase, "orders", workspaceId, selectedStoreId),
    countRows(supabase, "store_orders", workspaceId, selectedStoreId),
    countRows(supabase, "store_customers", workspaceId, selectedStoreId),
    (async () => {
      let countQuery = supabase
        .from("email_event_logs" as never)
        .select("id", { count: "exact", head: true })
        .eq("workspace_id" as never, workspaceId as never)
        .eq("status" as never, "sent" as never);
      if (selectedStoreId) countQuery = countQuery.eq("store_id" as never, selectedStoreId as never);
      const { count } = await countQuery;
      return count ?? 0;
    })(),
    (async () => {
      let countQuery = supabase
        .from("email_event_logs" as never)
        .select("id", { count: "exact", head: true })
        .eq("workspace_id" as never, workspaceId as never)
        .eq("status" as never, "failed" as never);
      if (selectedStoreId) countQuery = countQuery.eq("store_id" as never, selectedStoreId as never);
      const { count } = await countQuery;
      return count ?? 0;
    })()
  ]);
  const events = ((eventsResult.data ?? []) as unknown as MonitoringEventRow[]);
  const emailLogs = ((emailsResult.data ?? []) as unknown as EmailEventRow[]);
  const themeLogs = ((themesResult.data ?? []) as unknown as ThemeRuntimeLogRow[]);
  const mediaLogs = ((mediaResult.data ?? []) as unknown as MediaLogRow[]);
  const errorEvents = events.filter((event) => event.event_status === "failed" || event.event_status === "warning");
  const failedEmails = emailLogs.filter((email) => email.status === "failed" || email.status === "retry_pending");
  const failedJobs = events.filter((event) => event.entity_type === "job" && event.event_status === "failed");
  const themeErrors = themeLogs.filter((log) => /failed|error|invalid|fallback/i.test(`${log.event} ${log.message}`));
  const mediaErrors = events.filter((event) => event.entity_type === "media" && event.event_status === "failed");
  const eventTypes = Array.from(new Set(events.map((event) => event.event_type))).sort();

  return (
    <div className="grid gap-6">
      <PageHeader
        description="Production monitoring for platform events, email health, media activity, theme runtime issues, and operational counters."
        title="Monitoring"
      />

      <form className="grid gap-3 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-5" method="get">
        <label className="grid gap-2 text-sm font-bold text-ink">
          <span>Workspace</span>
          <input
            className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm text-muted"
            disabled
            value={workspaceId}
          />
        </label>
        <label className="grid gap-2 text-sm font-bold text-ink">
          <span>Store</span>
          <select className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm" defaultValue={selectedStoreId} name="storeId">
            <option value="">All stores</option>
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.store_name || store.name || store.slug || store.id}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-bold text-ink">
          <span>Event type</span>
          <input
            className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm"
            defaultValue={eventType}
            list="monitoring-event-types"
            name="eventType"
            placeholder="Any event"
          />
          <datalist id="monitoring-event-types">
            {eventTypes.map((type) => (
              <option key={type} value={type} />
            ))}
          </datalist>
        </label>
        <label className="grid gap-2 text-sm font-bold text-ink">
          <span>Status</span>
          <select className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm" defaultValue={status} name="status">
            <option value="">Any status</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
            <option value="warning">Warning</option>
            <option value="pending">Pending</option>
            <option value="info">Info</option>
          </select>
        </label>
        <label className="grid gap-2 text-sm font-bold text-ink">
          <span>Date range</span>
          <select className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm" defaultValue={range} name="from">
            {rangeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <div className="md:col-span-5">
          <button className="h-11 rounded-full bg-ink px-5 text-sm font-black text-white" type="submit">
            Apply filters
          </button>
        </div>
      </form>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          metricCard("Total Stores", storeCount),
          metricCard("Published Stores", publishedStoreCount),
          metricCard("Products Count", productCount),
          metricCard("Orders Count", orderCount + storeOrderCount),
          metricCard("Customers Count", customerCount),
          metricCard("Emails Sent", sentEmailCount),
          metricCard("Email Failures", failedEmailCount),
          metricCard("Recent Events", events.length, "Current filter")
        ]}
      </div>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(340px,0.8fr)]">
        <Card className="overflow-hidden p-0">
          <div className="border-b border-slate-200 p-5">
            <h2 className="text-2xl font-black tracking-[-0.03em] text-ink">Recent Events</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {events.length ? (
              events.map((event) => {
                const details = monitoringEventDetails(event);
                const showDetails = event.event_status === "failed" || event.event_status === "warning";

                return (
                  <div className="grid gap-3 p-5" key={event.id}>
                    <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                      <div>
                        <p className="text-sm font-black text-ink">{event.event_type}</p>
                        <p className="mt-1 text-sm font-semibold text-muted">
                          {event.entity_type} {event.entity_id ? `- ${event.entity_id.slice(0, 8)}` : ""}
                        </p>
                        <p className="mt-1 text-xs font-bold text-slate-400">
                          {storeName(stores, event.store_id)} - {formatDate(event.created_at)}
                        </p>
                      </div>
                      <span className={`h-fit rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${statusClass(event.event_status)}`}>
                        {event.event_status}
                      </span>
                    </div>

                    {showDetails ? (
                      <details className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                        <summary className="cursor-pointer text-sm font-black text-ink">
                          View details
                        </summary>
                        <div className="mt-4 grid gap-4">
                          <div className="grid gap-3 md:grid-cols-2">
                            <DetailField label="Code" value={details.code} />
                            <DetailField label="Message" value={details.message} />
                            <DetailField label="Details" value={details.details} />
                            <DetailField label="Hint" value={details.hint} />
                          </div>
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                              Metadata
                            </p>
                            <MonitoringCopyButton text={details.copyText} />
                          </div>
                          <pre className="max-h-72 overflow-auto rounded-2xl bg-white p-4 text-xs leading-5 text-slate-700">
                            {details.metadataJson}
                          </pre>
                        </div>
                      </details>
                    ) : null}
                  </div>
                );
              })
            ) : (
              <p className="p-5 text-sm font-semibold text-muted">
                No monitoring events match the current filters.
              </p>
            )}
          </div>
        </Card>

        <div className="grid gap-4">
          <SummaryCard title="Errors" rows={errorEvents.map((event) => `${event.event_type} - ${formatDate(event.created_at)}`)} />
          <SummaryCard title="Failed Emails" rows={failedEmails.map((email) => `${email.template_key} - ${email.error_message || email.status}`)} />
          <SummaryCard title="Failed Jobs" rows={failedJobs.map((event) => `${event.event_type} - ${event.entity_id ?? "job"}`)} />
          <SummaryCard title="Theme Errors" rows={themeErrors.map((log) => `${log.event}: ${log.message}`)} />
          <SummaryCard title="Media Errors" rows={mediaErrors.map((event) => `${event.event_type} - ${formatDate(event.created_at)}`)} />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-xl font-black tracking-[-0.02em] text-ink">Email Activity</h2>
          <div className="mt-4 grid gap-3">
            {emailLogs.length ? (
              emailLogs.slice(0, 8).map((email) => (
                <div className="rounded-2xl border border-slate-200 p-4" key={email.id}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-black text-ink">{email.template_key}</p>
                    <span className={`rounded-full border px-3 py-1 text-xs font-black uppercase ${statusClass(email.status)}`}>
                      {email.status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-muted">{email.subject}</p>
                  <p className="mt-1 text-xs font-bold text-slate-400">{formatDate(email.created_at)}</p>
                </div>
              ))
            ) : (
              <p className="text-sm font-semibold text-muted">No email activity in this range.</p>
            )}
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="text-xl font-black tracking-[-0.02em] text-ink">Theme And Media Signals</h2>
          <div className="mt-4 grid gap-3">
            {[...themeLogs.slice(0, 4).map((log) => ({
              id: `theme-${log.id}`,
              label: log.event,
              note: log.message,
              time: log.created_at
            })), ...mediaLogs.slice(0, 4).map((log) => ({
              id: `media-${log.id}`,
              label: `media.${log.action}`,
              note: `Media ${log.media_id?.slice(0, 8) ?? "item"} in ${storeName(stores, log.store_id)}`,
              time: log.created_at
            }))].map((row) => (
              <div className="rounded-2xl border border-slate-200 p-4" key={row.id}>
                <p className="font-black text-ink">{row.label}</p>
                <p className="mt-1 text-sm font-semibold text-muted">{row.note}</p>
                <p className="mt-1 text-xs font-bold text-slate-400">{formatDate(row.time)}</p>
              </div>
            ))}
            {!themeLogs.length && !mediaLogs.length ? (
              <p className="text-sm font-semibold text-muted">No theme or media signals in this range.</p>
            ) : null}
          </div>
        </Card>
      </section>

      <Card className="p-5">
        <h2 className="text-xl font-black tracking-[-0.02em] text-ink">Retention Foundation</h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-muted">
          Monitoring events are indexed by creation time for future retention jobs. This page reads recent data only and does not duplicate email or security logs.
        </p>
      </Card>
    </div>
  );
}

function SummaryCard({ rows, title }: { rows: string[]; title: string }) {
  return (
    <Card className="p-5">
      <h2 className="text-lg font-black tracking-[-0.02em] text-ink">{title}</h2>
      <div className="mt-3 grid gap-2">
        {rows.length ? (
          rows.slice(0, 5).map((row) => (
            <p className="rounded-2xl bg-slate-50 p-3 text-sm font-semibold text-muted" key={row}>
              {row}
            </p>
          ))
        ) : (
          <p className="text-sm font-semibold text-muted">No matching records.</p>
        )}
      </div>
    </Card>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white p-4">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 break-words text-sm font-semibold leading-6 text-slate-700">
        {value}
      </p>
    </div>
  );
}
