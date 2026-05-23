import { PageHeader } from "@/components/dashboard/page-header";
import { StoreSaveToast } from "@/components/dashboard/store-save-toast";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { publishStoreDraft } from "@/lib/store-actions";
import { createClient } from "@/lib/supabase/server";
import { fetchStoresForAuthUser } from "@/lib/stores/user-stores";

export const dynamic = "force-dynamic";

type PublicationRow = {
  published_at?: string | null;
  slug?: string | null;
  status?: string | null;
  store_id: string;
  url?: string | null;
};

type DraftStore = {
  created_at: string;
  id: string;
  name: string;
  publication: PublicationRow | null;
  slug: string | null;
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
  draftStoresError: string | null;
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

function isMissingPublishedStoresTable(error: { code?: string; message?: string } | null) {
  const message = (error?.message ?? "").toLowerCase();
  return (
    error?.code === "PGRST205" ||
    message.includes("published_stores") ||
    message.includes("could not find")
  );
}

async function loadOwnedStores(ownedResult: {
  data: unknown;
  error: { code?: string; message?: string } | null;
}) {
  const schemaIssue =
    ownedResult.error && isMissingOwnershipFoundation(ownedResult.error)
      ? "Missing ownership foundation: run the buyer activation and account claim migrations that create get_claimed_store_instances_for_current_user(), store_owner_links, store_access_permissions, and store_instances."
      : null;

  return {
    ownedStores: (ownedResult.data ?? []) as OwnedStore[],
    ownedStoresError:
      ownedResult.error && !schemaIssue
        ? "Claimed stores could not be loaded. Please try again."
        : null,
    schemaIssue
  };
}

async function loadDraftStores(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
) {
  const { stores, error } = await fetchStoresForAuthUser(supabase, userId);

  if (error) {
    return {
      draftStores: [] as DraftStore[],
      draftStoresError: `Stores could not be loaded: ${error}`
    };
  }

  const draftStores = stores.map((store) => ({
    ...store,
    publication: null as PublicationRow | null
  }));
  const draftIds = draftStores.map((store) => store.id);
  let publicationRows: PublicationRow[] = [];

  if (draftIds.length) {
    const { data, error: publicationError } = await supabase
      .from("published_stores")
      .select("store_id, status, published_at, slug, url")
      .in("store_id", draftIds);

    if (!publicationError) {
      publicationRows = (data ?? []) as unknown as PublicationRow[];
    } else if (!isMissingPublishedStoresTable(publicationError)) {
      console.warn(
        "[dashboard/stores] published_stores metadata skipped:",
        publicationError.message
      );
    }
  }

  return {
    draftStores: draftStores.map((store) => ({
      ...store,
      publication:
        publicationRows.find((publication) => publication.store_id === store.id) ?? null
    })),
    draftStoresError: null
  };
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
      draftStoresError: null,
      error: "We could not verify your session. Please sign in again.",
      ownedStores: [],
      schemaIssue: null,
      subscription: null
    };
  }

  if (!user) {
    return {
      draftStores: [],
      draftStoresError: null,
      error: "Sign in to view your stores.",
      ownedStores: [],
      schemaIssue: null,
      subscription: null
    };
  }

  const [ownedResult, subscriptionResult] = await Promise.all([
    supabase.rpc("get_claimed_store_instances_for_current_user" as never),
    supabase
      .from("user_subscriptions" as never)
      .select("plan_id, status, current_period_end")
      .eq("user_id", user.id)
      .maybeSingle()
  ]);

  const { ownedStores, ownedStoresError, schemaIssue } = await loadOwnedStores(ownedResult);
  const { draftStores, draftStoresError } = await loadDraftStores(supabase, user.id);
  const subscription =
    subscriptionResult.error && isMissingSubscriptionTable(subscriptionResult.error)
      ? null
      : (subscriptionResult.data as SubscriptionSummary | null);

  return {
    draftStores,
    draftStoresError,
    error: ownedStoresError,
    ownedStores,
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
  searchParams: Promise<{
    catalog_warning?: string;
    deleted?: string;
    error?: string;
    published?: string;
    saved?: string;
  }>;
}) {
  const query = await searchParams;
  const { draftStores, draftStoresError, error, ownedStores, schemaIssue, subscription } =
    await getBuyerStores();
  const storeModeCount = draftStores.length;
  const totalStores = ownedStores.length + storeModeCount;

  return (
    <div className="grid gap-6 lg:gap-8">
      <StoreSaveToast
        message="Store draft saved successfully."
        show={Boolean(query.saved)}
      />
      <PageHeader
        action={<ButtonLink href="/dashboard/stores/new">Create store</ButtonLink>}
        description="Manage stores attached to your buyer account. Platform billing stays separate from store payments."
        title="My Stores"
      />

      {query.saved ? (
        <Card className="border-emerald-200 bg-emerald-50 p-5">
          <p className="text-sm font-bold text-emerald-700">
            Store draft saved successfully. {storeModeCount} store
            {storeModeCount === 1 ? "" : "s"} in your account.
          </p>
          {query.catalog_warning ? (
            <p className="mt-2 text-sm font-semibold text-amber-800">
              Catalog details were not saved: {query.catalog_warning}
            </p>
          ) : null}
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
      {query.error || error || draftStoresError ? (
        <Card className="border-red-200 bg-red-50 p-5">
          <p className="text-sm font-bold text-red-700">
            {query.error ?? draftStoresError ?? error}
          </p>
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
              Store Mode
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-ink">
              Your stores
            </h2>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-muted">
              Loaded directly from the stores table for the current Supabase Auth user
              (user_id or owner_user_id).
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-blue-700">
              {storeModeCount} store{storeModeCount === 1 ? "" : "s"}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-slate-700">
              {totalStores} total
            </span>
          </div>
        </div>

        {draftStores.length ? (
          <div className="mt-5 grid gap-4">
            {draftStores.map((store) => {
              const displayStatus = store.publication?.status ?? store.status ?? "draft";
              const publicSlug = store.slug ?? store.publication?.slug ?? null;
              const isPublished =
                (displayStatus === "published" || store.status === "published") &&
                Boolean(publicSlug);

              return (
                <div
                  className="grid gap-5 rounded-3xl border border-slate-200 bg-slate-50 p-5 lg:grid-cols-[minmax(0,1fr)_auto]"
                  key={store.id}
                >
                  <div className="min-w-0">
                    <p className="truncate text-lg font-black text-ink">{store.name}</p>
                    <p className="mt-1 text-sm font-semibold text-muted">
                      Status {formatStatus(displayStatus, "draft")} · Created{" "}
                      {formatDate(store.created_at)}
                    </p>
                    {publicSlug ? (
                      <p className="mt-2 font-mono text-xs font-bold text-muted">
                        /store/{publicSlug}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 lg:justify-end">
                    <ButtonLink href={`/dashboard/stores/${store.id}`}>Manage Store</ButtonLink>
                    {isPublished ? (
                      <ButtonLink
                        href={`/store/${publicSlug}`}
                        target="_blank"
                        variant="secondary"
                      >
                        Public Store
                      </ButtonLink>
                    ) : (
                      <form action={publishStoreDraft}>
                        <input name="storeId" type="hidden" value={store.id} />
                        <Button type="submit" variant="secondary">
                          Publish Store
                        </Button>
                      </form>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center">
            <p className="text-lg font-black text-ink">No saved stores in Store Mode yet.</p>
            <p className="mx-auto mt-2 max-w-md text-sm font-semibold leading-6 text-muted">
              Create a store draft, save it, and it will appear here immediately.
            </p>
            <div className="mt-4">
              <ButtonLink href="/dashboard/stores/new">Create store</ButtonLink>
            </div>
          </div>
        )}
      </Card>

      {ownedStores.length ? (
        <Card className="p-6 lg:p-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                Claimed stores
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-ink">
                Reseller-delivered ownership
              </h2>
              <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-muted">
                These stores come from buyer activation and ownership claim flows.
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${badgeClass(
                subscription?.status
              )}`}
            >
              Plan {subscription?.plan_id ?? "not connected"}
            </span>
          </div>

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
        </Card>
      ) : null}
    </div>
  );
}
