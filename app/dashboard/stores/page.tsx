import { PageHeader } from "@/components/dashboard/page-header";
import { CopyStoreUrlButton } from "@/components/dashboard/copy-store-url-button";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { deleteStoreDraft, publishStoreDraft, unpublishStore } from "@/lib/store-actions";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PublicationRow = {
  store_id: string;
  slug: string;
  url?: string | null;
  status?: string | null;
  visibility?: string | null;
  published_at?: string | null;
  hostname?: string | null;
};

async function getStores() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return [];
  }

  const { data, error } = await supabase
    .from("stores")
    .select("id, name, description, status, template_id, currency, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return [];
  }

  const stores = data ?? [];
  const storeIds = stores.map((store) => store.id);

  if (!storeIds.length) {
    return [];
  }

  const [{ data: categories }, { data: products }] = await Promise.all([
    supabase.from("store_categories").select("store_id").in("store_id", storeIds),
    supabase.from("store_products").select("store_id").in("store_id", storeIds)
  ]);
  const { data: publications } = await supabase
    .from("published_stores")
    .select("*")
    .in("store_id", storeIds);
  const publicationRows = (publications ?? []) as PublicationRow[];

  return stores.map((store) => ({
    ...store,
    publication:
      publicationRows.find((publication) => publication.store_id === store.id) ?? null,
    categoryCount:
      categories?.filter((category) => category.store_id === store.id).length ?? 0,
    productCount:
      products?.filter((product) => product.store_id === store.id).length ?? 0,
    publicSlug:
      publicationRows.find(
        (publication) =>
          publication.store_id === store.id &&
          publication.status === "published" &&
          publication.visibility !== "private"
      )?.slug ?? null
  }));
}

async function getClaimedStoreInstances() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return [];
  }

  const { data, error } = await supabase
    .from("store_instances" as never)
    .select("id, internal_slug, store_name, status, visibility, created_at")
    .eq("owner_user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return [];
  }

  return (data ?? []) as Array<{
    id: string;
    internal_slug: string;
    store_name: string;
    status: string;
    visibility: string;
    created_at: string;
  }>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
}

function formatOptionalDate(value: string | null | undefined) {
  return value ? formatDate(value) : "Not published";
}

export default async function StoresPage({
  searchParams
}: {
  searchParams: Promise<{ saved?: string; deleted?: string; published?: string; error?: string }>;
}) {
  const query = await searchParams;
  const [stores, claimedStores] = await Promise.all([getStores(), getClaimedStoreInstances()]);

  return (
    <div className="grid gap-6 lg:gap-8">
      <PageHeader
        action={<ButtonLink href="/dashboard/stores/new">Create store</ButtonLink>}
        description="Create and manage draft multi-category stores before public store publishing is enabled."
        title="Stores"
      />
      {query.saved ? (
        <Card className="border-emerald-200 bg-emerald-50 p-5">
          <p className="text-sm font-bold text-emerald-700">
            Store draft saved successfully.
          </p>
        </Card>
      ) : null}
      {query.deleted ? (
        <Card className="border-slate-200 bg-slate-50 p-5">
          <p className="text-sm font-bold text-ink">
            Store draft deleted successfully.
          </p>
        </Card>
      ) : null}
      {query.published ? (
        <Card className="border-emerald-200 bg-emerald-50 p-5">
          <p className="text-sm font-bold text-emerald-700">
            Store published successfully at /store/{query.published}.
          </p>
        </Card>
      ) : null}
      {query.error ? (
        <Card className="border-red-200 bg-red-50 p-5">
          <p className="text-sm font-bold text-red-700">{query.error}</p>
        </Card>
      ) : null}
      <Card className="p-6 lg:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
              Claimed Stores
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-ink">
              Buyer-owned store placeholders
            </h2>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-muted">
              Stores claimed through reseller activation appear here. Future owner role permissions,
              login redirect, and management access will connect to these records.
            </p>
          </div>
          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-blue-700">
            {claimedStores.length} claimed
          </span>
        </div>
        {claimedStores.length ? (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {claimedStores.map((store) => (
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4" key={store.id}>
                <p className="font-black text-ink">{store.store_name}</p>
                <p className="mt-1 font-mono text-xs font-bold text-muted">{store.internal_slug}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
                    {store.status}
                  </span>
                  <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-slate-700">
                    {store.visibility}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-muted">
            No claimed reseller stores yet.
          </p>
        )}
      </Card>
      {stores.length ? (
        <div className="grid gap-4">
          {stores.map((store) => (
            <Card
              className="grid gap-5 p-5 transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_22px_70px_-48px_rgba(15,23,42,0.95)] lg:grid-cols-[minmax(0,1fr)_auto]"
              key={store.id}
            >
              <div className="min-w-0">
                <p className="truncate text-lg font-black text-ink">{store.name}</p>
                <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted">
                  {store.description || "Draft multi-category store"}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] ${
                      store.publication?.status === "published"
                        ? "bg-emerald-100 text-emerald-700"
                        : store.publication?.status === "unpublished"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-slate-100 text-muted"
                    }`}
                  >
                    {store.publication?.status ?? store.status}
                  </span>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] ${
                      store.publication?.visibility === "private"
                        ? "bg-slate-200 text-slate-700"
                        : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {store.publication?.visibility ?? "private"}
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-muted">
                    {store.template_id}
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-muted">
                    {store.categoryCount} categories
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-muted">
                    {store.productCount} products
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-muted">
                    {formatDate(store.created_at)}
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-muted">
                    Published {formatOptionalDate(store.publication?.published_at)}
                  </span>
                  {store.publication?.hostname ? (
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-muted">
                      {store.publication.hostname}
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 lg:justify-end">
                <ButtonLink href={`/dashboard/stores/${store.id}`} variant="secondary">
                  Edit
                </ButtonLink>
                <ButtonLink href={`/dashboard/stores/${store.id}`} variant="secondary">
                  Preview
                </ButtonLink>
                {store.publication?.status === "published" ? (
                  <>
                    {store.publicSlug ? (
                      <>
                        <ButtonLink href={`/store/${store.publicSlug}`} target="_blank" variant="secondary">
                          Open public
                        </ButtonLink>
                        <CopyStoreUrlButton url={`/store/${store.publicSlug}`} />
                      </>
                    ) : null}
                    <form action={unpublishStore}>
                      <input name="storeId" type="hidden" value={store.id} />
                      <Button type="submit" variant="secondary">
                        Unpublish
                      </Button>
                    </form>
                  </>
                ) : (
                  <form action={publishStoreDraft}>
                    <input name="storeId" type="hidden" value={store.id} />
                    <Button type="submit">
                      {store.publication?.status === "unpublished" ? "Republish" : "Publish"}
                    </Button>
                  </form>
                )}
                <form action={deleteStoreDraft}>
                  <input name="storeId" type="hidden" value={store.id} />
                  <Button type="submit" variant="secondary">
                    Delete
                  </Button>
                </form>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-6 text-center lg:p-10">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
            Store Mode
          </p>
          <h2 className="mt-3 text-2xl font-black tracking-[-0.03em] text-ink">
            Start your first multi-category store.
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-muted">
            Draft stores can hold store basics, categories, products, templates,
            and a WhatsApp CTA. Public store publishing is not enabled yet.
          </p>
          <div className="mt-6 flex justify-center">
            <ButtonLink href="/dashboard/projects/new" variant="secondary">
              Choose project type
            </ButtonLink>
          </div>
        </Card>
      )}
    </div>
  );
}
