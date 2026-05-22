import { PageHeader } from "@/components/dashboard/page-header";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PublicationRow = {
  hostname?: string | null;
  published_at?: string | null;
  status?: string | null;
  store_id: string;
};

type DraftStore = {
  created_at: string;
  id: string;
  name: string;
  publication: PublicationRow | null;
  status: string | null;
};

type OwnedStore = {
  access_role: string | null;
  access_status: string | null;
  activation_status: string;
  auth_attachment_status: string | null;
  connected_domain: string | null;
  created_at: string;
  id: string;
  internal_slug: string;
  ownership_status: string;
  requested_domain: string | null;
  source_reseller_name: string | null;
  status: string;
  store_name: string;
  transfer_code: string | null;
  visibility: string;
};

type SubscriptionSummary = {
  current_period_end: string | null;
  plan_id: string | null;
  status: string | null;
};

type StoreListResult = {
  draftStores: DraftStore[];
  error: string | null;
  ownedStores: OwnedStore[];
  schemaIssue: string | null;
  subscription: SubscriptionSummary | null;
};

function isMissingOwnershipFoundation(error: { code?: string; message?: string } | null) {
  const message = (error?.message ?? "").toLowerCase();
  return (
    error?.code === "PGRST202" ||
    error?.code === "PGRST205" ||
    message.includes("get_claimed_store_instances_for_current_user") ||
    message.includes("store_owner_links") ||
    message.includes("store_access_permissions") ||
    message.includes("store_instances") ||
    message.includes("could not find")
  );
}

function isMissingSubscriptionTable(error: { code?: string; message?: string } | null) {
  const message = (error?.message ?? "").toLowerCase();
  return (
    error?.code === "PGRST205" ||
    message.includes("user_subscriptions") ||
    message.includes("could not find")
  );
}

async function getBuyerStores(): Promise<StoreListResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError) {
    return {
      draftStores: [],
      error: "We could not verify your session. Please sign in again.",
      ownedStores: [],
      schemaIssue: null,
      subscription: null
    };
  }

  if (!user) {
    return {
      draftStores: [],
      error: "Sign in to view your stores.",
      ownedStores: [],
      schemaIssue: null,
      subscription: null
    };
  }

  const [ownedResult, draftResult, subscriptionResult] = await Promise.all([
    supabase.rpc("get_claimed_store_instances_for_current_user" as never),
    supabase
      .from("stores")
      .select("id, name, status, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("user_subscriptions" as never)
      .select("plan_id, status, current_period_end")
      .eq("user_id", user.id)
      .maybeSingle()
  ]);

  const schemaIssue =
    ownedResult.error && isMissingOwnershipFoundation(ownedResult.error)
      ? "Missing ownership foundation: run the buyer activation and account claim migrations that create get_claimed_store_instances_for_current_user(), store_owner_links, store_access_permissions, and store_instances."
      : null;
  const error =
    ownedResult.error && !schemaIssue
      ? "Owned stores could not be loaded. Please try again."
      : draftResult.error
        ? "Draft stores could not be loaded. Please try again."
        : null;
  const draftStores = ((draftResult.data ?? []) as Omit<DraftStore, "publication">[]).map(
    (store) => ({
      ...store,
      publication: null
    })
  );
  const draftIds = draftStores.map((store) => store.id);
  let publicationRows: PublicationRow[] = [];

  if (draftIds.length) {
    const { data } = await supabase
      .from("published_stores")
      .select("store_id, status, published_at, hostname")
      .in("store_id", draftIds);
    publicationRows = (data ?? []) as unknown as PublicationRow[];
  }

  const subscription =
    subscriptionResult.error && isMissingSubscriptionTable(subscriptionResult.error)
      ? null
      : (subscriptionResult.data as SubscriptionSummary | null);

  return {
    draftStores: draftStores.map((store) => ({
      ...store,
      publication:
        publicationRows.find((publication) => publication.store_id === store.id) ?? null
    })),
    error,
    ownedStores: (ownedResult.data ?? []) as OwnedStore[],
    schemaIssue,
    subscription
  };
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

function formatStatus(value: string | null | undefined, fallback = "not connected") {
  return value ? value.replace(/_/g, " ") : fallback;
}

function badgeClass(status: string | null | undefined) {
  if (
    status === "active" ||
    status === "activated" ||
    status === "claimed" ||
    status === "published"
  ) {
    return "bg-emerald-100 text-emerald-700";
  }

  if (status === "canceled" || status === "failed" || status === "revoked" || status === "suspended") {
    return "bg-red-100 text-red-700";
  }

  if (status === "delivered" || status === "transferred") {
    return "bg-blue-100 text-blue-700";
  }

  return "bg-amber-100 text-amber-700";
}

export default async function StoresPage({
  searchParams
}: {
  searchParams: Promise<{ deleted?: string; error?: string; published?: string; saved?: string }>;
}) {
  const query = await searchParams;
  const { draftStores, error, ownedStores, schemaIssue, subscription } = await getBuyerStores();
  const totalStores = ownedStores.length + draftStores.length;

  return (
    <div className="grid gap-6 lg:gap-8">
      <PageHeader
        action={<ButtonLink href="/dashboard/stores/new">Create store</ButtonLink>}
        description="Manage stores attached to your buyer account. Platform billing stays separate from store payments."
        title="My Stores"
      />

      {query.saved ? (
        <Card className="border-emerald-200 bg-emerald-50 p-5">
          <p className="text-sm font-bold text-emerald-700">Store draft saved successfully.</p>
        </Card>
      ) : null}
      {query.deleted ? (
        <Card className="border-slate-200 bg-slate-50 p-5">
          <p className="text-sm font-bold text-ink">Store draft deleted successfully.</p>
        </Card>
      ) : null}
      {query.published ? (
        <Card className="border-emerald-200 bg-emerald-50 p-5">
          <p className="text-sm font-bold text-emerald-700">
            Store published successfully at /store/{query.published}.
          </p>
        </Card>
      ) : null}
      {query.error || error ? (
        <Card className="border-red-200 bg-red-50 p-5">
          <p className="text-sm font-bold text-red-700">{query.error ?? error}</p>
        </Card>
      ) : null}
      {schemaIssue ? (
        <Card className="border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-bold text-amber-800">{schemaIssue}</p>
        </Card>
      ) : null}

      <Card className="p-6 lg:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
              Buyer Store Management
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-ink">
              Stores owned by your account
            </h2>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-muted">
              This page reads stores connected to the current Supabase Auth user through ownership
              links, access permissions, or your own draft store records.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-blue-700">
              {totalStores} total
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-slate-700">
              Plan {subscription?.plan_id ?? "not connected"}
            </span>
            <span
              className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${badgeClass(
                subscription?.status
              )}`}
            >
              {subscription?.status ?? "no subscription record"}
            </span>
          </div>
        </div>

        {ownedStores.length ? (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {ownedStores.map((store) => (
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5" key={store.id}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-black text-ink">{store.store_name}</p>
                    <p className="mt-1 font-mono text-xs font-bold text-muted">
                      {store.internal_slug}
                    </p>
                  </div>
                  <span
                    className={`w-fit rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${badgeClass(
                      store.ownership_status
                    )}`}
                  >
                    {formatStatus(store.ownership_status)}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold text-muted">
                  <p>Source reseller: {store.source_reseller_name ?? "Reseller"}</p>
                  <p>Transfer code: {store.transfer_code ?? "Not available"}</p>
                  <p>
                    Domain: {store.connected_domain ?? store.requested_domain ?? "not connected"}
                  </p>
                  <p>Auth attachment: {formatStatus(store.auth_attachment_status, "not attached")}</p>
                  <p>Created: {formatDate(store.created_at)}</p>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${badgeClass(
                      store.status
                    )}`}
                  >
                    Store {formatStatus(store.status)}
                  </span>
                  <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-slate-700">
                    {store.visibility}
                  </span>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${badgeClass(
                      store.activation_status
                    )}`}
                  >
                    Activation {formatStatus(store.activation_status)}
                  </span>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${badgeClass(
                      store.access_status
                    )}`}
                  >
                    {store.access_role ?? "owner"} {store.access_status ?? "pending"}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <ButtonLink href={`/dashboard/stores/${store.id}`}>Manage Store</ButtonLink>
                  <ButtonLink
                    href={`/dashboard/stores/preview/${store.internal_slug}`}
                    target="_blank"
                    variant="secondary"
                  >
                    View store preview
                  </ButtonLink>
                </div>
              </div>
            ))}
          </div>
        ) : !draftStores.length ? (
          <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center">
            <p className="text-lg font-black text-ink">No stores claimed yet.</p>
            <p className="mx-auto mt-2 max-w-md text-sm font-semibold leading-6 text-muted">
              Open the activation link from your delivery PDF, confirm your password placeholder,
              and click Activate store. Your owned store will appear here.
            </p>
          </div>
        ) : null}
      </Card>

      {draftStores.length ? (
        <Card className="p-6 lg:p-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                Draft Stores
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-ink">
                Stores created by your user account
              </h2>
              <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-muted">
                These are Store Mode drafts where `stores.user_id` equals your current Supabase Auth
                user.
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-slate-700">
              {draftStores.length} drafts
            </span>
          </div>

          <div className="mt-5 grid gap-4">
            {draftStores.map((store) => (
              <div
                className="grid gap-5 rounded-3xl border border-slate-200 bg-slate-50 p-5 lg:grid-cols-[minmax(0,1fr)_auto]"
                key={store.id}
              >
                <div className="min-w-0">
                  <p className="truncate text-lg font-black text-ink">{store.name}</p>
                  <p className="mt-1 text-sm font-semibold text-muted">
                    Created {formatDate(store.created_at)}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] ${badgeClass(
                        store.publication?.status ?? store.status
                      )}`}
                    >
                      {store.publication?.status ?? store.status ?? "draft"}
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-muted">
                      Domain {store.publication?.hostname ?? "not connected"}
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-muted">
                      Published{" "}
                      {store.publication?.published_at
                        ? formatDate(store.publication.published_at)
                        : "not yet"}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 lg:justify-end">
                  <ButtonLink href={`/dashboard/stores/${store.id}`}>Manage Store</ButtonLink>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
