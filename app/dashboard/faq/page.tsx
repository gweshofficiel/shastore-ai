import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  createStoreFaq,
  deleteStoreFaq,
  setStoreFaqStatus,
  updateStoreFaq
} from "@/lib/store-faq-actions";
import { createClient } from "@/lib/supabase/server";
import { fetchStoresForAuthUser, type UserStoreRow } from "@/lib/stores/user-stores";
import { getActiveWorkspaceForUser } from "@/lib/workspaces/active-workspace";

export const dynamic = "force-dynamic";

type FaqRow = {
  answer: string;
  created_at: string;
  id: string;
  question: string;
  sort_order: number | null;
  status: string;
  updated_at: string | null;
};

type FaqDashboardData = {
  activeStore: UserStoreRow | null;
  error: string | null;
  faqs: FaqRow[];
  stores: UserStoreRow[];
};

function statusMessage(status: string | undefined) {
  const messages: Record<string, string> = {
    created: "FAQ created.",
    deleted: "FAQ deleted.",
    "delete-failed": "FAQ could not be deleted.",
    "create-failed": "FAQ could not be created.",
    "missing-fields": "FAQ question and answer are required.",
    "missing-store": "Choose a store before managing FAQs.",
    "not-authorized": "You do not have permission to manage that store.",
    published: "FAQ published.",
    "status-failed": "FAQ status could not be updated.",
    unpublished: "FAQ moved back to draft.",
    updated: "FAQ updated.",
    "update-failed": "FAQ could not be updated."
  };

  return status ? messages[status] : null;
}

function statusClass(status: string) {
  return status === "published"
    ? "bg-emerald-100 text-emerald-700"
    : "bg-amber-100 text-amber-700";
}

async function getFaqDashboardData(selectedStoreId?: string): Promise<FaqDashboardData> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { activeStore: null, error: "Sign in to manage FAQs.", faqs: [], stores: [] };
  }

  const selection = await getActiveWorkspaceForUser({ supabase, userId: user.id });
  const workspaceId = selection.activeWorkspaceId;
  const { stores, error: storesError } = await fetchStoresForAuthUser(supabase, user.id, workspaceId);

  if (storesError) {
    return { activeStore: null, error: "Stores could not be loaded.", faqs: [], stores: [] };
  }

  const activeStore = stores.find((store) => store.id === selectedStoreId) ?? stores[0] ?? null;

  if (!activeStore) {
    return { activeStore: null, error: null, faqs: [], stores };
  }

  const { data, error } = await supabase
    .from("store_faqs" as never)
    .select("id, question, answer, status, sort_order, created_at, updated_at")
    .eq("workspace_id" as never, workspaceId as never)
    .eq("store_id" as never, activeStore.id as never)
    .order("sort_order" as never, { ascending: true, nullsFirst: false } as never)
    .order("updated_at" as never, { ascending: false } as never)
    .order("created_at" as never, { ascending: false } as never);

  if (error) {
    return {
      activeStore,
      error: "FAQs could not be loaded. Confirm the FAQ migration has been applied.",
      faqs: [],
      stores
    };
  }

  return {
    activeStore,
    error: null,
    faqs: (data ?? []) as unknown as FaqRow[],
    stores
  };
}

function FaqFields({ faq }: { faq?: FaqRow }) {
  return (
    <>
      <Textarea
        defaultValue={faq?.question ?? ""}
        id={faq ? `faq-${faq.id}-question` : "faq-new-question"}
        label="Question"
        maxLength={500}
        name="question"
        placeholder="What shipping options are available?"
        required
        rows={3}
      />
      <Textarea
        defaultValue={faq?.answer ?? ""}
        id={faq ? `faq-${faq.id}-answer` : "faq-new-answer"}
        label="Answer"
        maxLength={8000}
        name="answer"
        placeholder="Explain the answer customers should see on your storefront."
        required
        rows={6}
      />
      <div className="grid gap-4 md:grid-cols-2">
        <Input
          defaultValue={faq?.sort_order ?? ""}
          id={faq ? `faq-${faq.id}-sort` : "faq-new-sort"}
          label="Sort order"
          name="sortOrder"
          placeholder="10"
          type="number"
        />
        <label className="grid gap-2 text-sm font-semibold text-ink">
          <span>Status</span>
          <select
            className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink shadow-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
            defaultValue={faq?.status ?? "draft"}
            name="status"
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </label>
      </div>
    </>
  );
}

export default async function StoreFaqDashboard({
  searchParams
}: {
  searchParams: Promise<{ edit?: string; faq?: string; storeId?: string }>;
}) {
  const query = await searchParams;
  const { activeStore, error, faqs, stores } = await getFaqDashboardData(query.storeId);
  const message = statusMessage(query.faq);
  const editingFaq = query.edit ? faqs.find((faq) => faq.id === query.edit) ?? null : null;

  return (
    <div className="grid gap-6 lg:gap-8">
      <PageHeader
        description="Create storefront FAQ questions and answers for customer self-service."
        title="FAQ"
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

      {activeStore ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <Card className="p-5">
            <h2 className="text-2xl font-black tracking-[-0.03em] text-ink">
              {editingFaq ? "Edit FAQ" : "Create FAQ"}
            </h2>
            <form
              action={editingFaq ? updateStoreFaq : createStoreFaq}
              className="mt-5 grid gap-4"
            >
              <input name="storeId" type="hidden" value={activeStore.id} />
              {editingFaq ? <input name="faqId" type="hidden" value={editingFaq.id} /> : null}
              <FaqFields faq={editingFaq ?? undefined} />
              <Button type="submit">
                {editingFaq ? "Save FAQ" : "Create FAQ"}
              </Button>
            </form>
          </Card>

          <section className="grid gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                FAQ Library
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">
                {faqs.length} {faqs.length === 1 ? "FAQ" : "FAQs"}
              </h2>
            </div>

            {faqs.length ? (
              faqs.map((faq) => (
                <Card className="grid gap-4 p-5" key={faq.id}>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${statusClass(faq.status)}`}>
                        {faq.status}
                      </span>
                      <h3 className="mt-3 text-xl font-black tracking-[-0.03em] text-ink">
                        {faq.question}
                      </h3>
                      <p className="mt-1 text-sm font-semibold text-muted">
                        Sort order {faq.sort_order ?? "not set"}
                      </p>
                    </div>
                    {faq.status === "published" && activeStore.slug ? (
                      <a
                        className="rounded-full bg-slate-100 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-muted"
                        href={`/store/${activeStore.slug}/faq`}
                        target="_blank"
                      >
                        View
                      </a>
                    ) : null}
                  </div>
                  <p className="rounded-2xl bg-slate-50 p-3 text-sm font-semibold leading-6 text-muted">
                    {faq.answer}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <a
                      className="inline-flex h-10 items-center justify-center rounded-full bg-ink px-4 text-xs font-black uppercase tracking-[0.14em] text-white"
                      href={`/dashboard/faq?storeId=${activeStore.id}&edit=${faq.id}`}
                    >
                      Edit
                    </a>
                    <form action={setStoreFaqStatus}>
                      <input name="faqId" type="hidden" value={faq.id} />
                      <input name="storeId" type="hidden" value={activeStore.id} />
                      <input
                        name="status"
                        type="hidden"
                        value={faq.status === "published" ? "draft" : "published"}
                      />
                      <Button type="submit" variant="secondary">
                        {faq.status === "published" ? "Unpublish" : "Publish"}
                      </Button>
                    </form>
                    <form action={deleteStoreFaq}>
                      <input name="faqId" type="hidden" value={faq.id} />
                      <input name="storeId" type="hidden" value={activeStore.id} />
                      <Button type="submit" variant="secondary">
                        Delete
                      </Button>
                    </form>
                  </div>
                </Card>
              ))
            ) : (
              <Card className="border-dashed p-8 text-center">
                <h3 className="text-xl font-black tracking-[-0.03em] text-ink">
                  No FAQs yet
                </h3>
                <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted">
                  Create your first FAQ to answer common storefront customer questions.
                </p>
              </Card>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
