import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { moderateProductQuestion } from "@/lib/product-question-actions";
import { createClient } from "@/lib/supabase/server";
import { fetchStoresForAuthUser, type UserStoreRow } from "@/lib/stores/user-stores";
import { getActiveWorkspaceForUser } from "@/lib/workspaces/active-workspace";

export const dynamic = "force-dynamic";

type ProductQaPageProps = {
  searchParams: Promise<{
    qa?: string;
    storeId?: string;
  }>;
};

type QuestionRow = {
  answer_text: string | null;
  answered_at: string | null;
  created_at: string;
  customer_email: string | null;
  customer_name: string | null;
  id: string;
  product_id: string;
  question_text: string;
  status: string;
  store_id: string;
};

type ProductRow = {
  id: string;
  name?: string | null;
  title?: string | null;
};

type ProductQaData = {
  activeStore: UserStoreRow | null;
  error: string | null;
  products: ProductRow[];
  questions: QuestionRow[];
  stats: {
    approvedCount: number;
    hiddenCount: number;
    pendingCount: number;
    totalCount: number;
  };
  stores: UserStoreRow[];
};

function statusMessage(status: string | undefined) {
  const messages: Record<string, string> = {
    approved: "Question approved.",
    "answer-required": "Add an answer before approving a question.",
    hidden: "Question hidden.",
    "missing-question": "Question could not be found.",
    "moderation-failed": "Question moderation could not be saved.",
    "not-authorized": "You do not have permission to moderate Q&A for that store.",
    pending: "Question moved back to pending."
  };

  return status ? messages[status] : null;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

function summarizeQuestions(questions: QuestionRow[]) {
  return {
    approvedCount: questions.filter((question) => question.status === "approved").length,
    hiddenCount: questions.filter((question) => question.status === "hidden").length,
    pendingCount: questions.filter((question) => question.status === "pending").length,
    totalCount: questions.length
  };
}

async function getProductQaData(selectedStoreId?: string): Promise<ProductQaData> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      activeStore: null,
      error: "Sign in to moderate product Q&A.",
      products: [],
      questions: [],
      stats: summarizeQuestions([]),
      stores: []
    };
  }

  const selection = await getActiveWorkspaceForUser({ supabase, userId: user.id });
  const workspaceId = selection.activeWorkspaceId;
  const { stores, error: storesError } = await fetchStoresForAuthUser(
    supabase,
    user.id,
    workspaceId
  );

  if (storesError) {
    return {
      activeStore: null,
      error: "Stores could not be loaded. Please try again.",
      products: [],
      questions: [],
      stats: summarizeQuestions([]),
      stores: []
    };
  }

  const activeStore =
    stores.find((store) => store.id === selectedStoreId) ?? stores[0] ?? null;

  if (!activeStore) {
    return {
      activeStore: null,
      error: null,
      products: [],
      questions: [],
      stats: summarizeQuestions([]),
      stores
    };
  }

  const [questionsResult, productsResult] = await Promise.all([
    supabase
      .from("product_questions" as never)
      .select("id, store_id, product_id, customer_name, customer_email, question_text, answer_text, answered_at, status, created_at")
      .eq("workspace_id" as never, workspaceId as never)
      .eq("store_id" as never, activeStore.id as never)
      .order("created_at", { ascending: false }),
    supabase
      .from("store_products" as never)
      .select("id, title, name")
      .eq("workspace_id" as never, workspaceId as never)
      .eq("store_id", activeStore.id)
  ]);

  if (questionsResult.error || productsResult.error) {
    return {
      activeStore,
      error: "Product Q&A could not be loaded. Confirm the Q&A migration has been applied.",
      products: [],
      questions: [],
      stats: summarizeQuestions([]),
      stores
    };
  }

  const questions = (questionsResult.data ?? []) as unknown as QuestionRow[];

  return {
    activeStore,
    error: null,
    products: (productsResult.data ?? []) as unknown as ProductRow[],
    questions,
    stats: summarizeQuestions(questions),
    stores
  };
}

export default async function ProductQaPage({
  searchParams
}: ProductQaPageProps) {
  const query = await searchParams;
  const { activeStore, error, products, questions, stats, stores } = await getProductQaData(query.storeId);
  const message = statusMessage(query.qa);
  const productsById = new Map(products.map((product) => [product.id, product.title || product.name || product.id]));

  return (
    <div className="grid gap-6 lg:gap-8">
      <PageHeader
        description="Answer customer product questions and choose which answered questions appear publicly."
        title="Product Q&A"
      />

      {message ? (
        <div className="rounded-3xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm font-bold text-blue-800">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700">
          {error}
        </div>
      ) : null}

      {stores.length === 0 ? (
        <Card className="p-8 text-center">
          <h2 className="text-2xl font-black tracking-[-0.03em] text-ink">
            No stores in this workspace yet
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-muted">
            Create a store before moderating product questions.
          </p>
        </Card>
      ) : null}

      {activeStore ? (
        <>
          <Card className="grid gap-4 p-5 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                Active Store
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">
                {activeStore.store_name || activeStore.name || "Workspace store"}
              </h2>
              <p className="mt-1 text-sm text-muted">
                Pending and hidden questions never appear publicly.
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
              <Button type="submit" variant="secondary">
                View Q&A
              </Button>
            </form>
          </Card>

          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <QuestionStatCard label="Total questions" value={String(stats.totalCount)} />
            <QuestionStatCard label="Pending" value={String(stats.pendingCount)} />
            <QuestionStatCard label="Approved" value={String(stats.approvedCount)} />
            <QuestionStatCard label="Hidden" value={String(stats.hiddenCount)} />
          </section>

          <section className="grid gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                Q&A Queue
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">
                {questions.length} {questions.length === 1 ? "question" : "questions"}
              </h2>
            </div>

            {questions.length === 0 ? (
              <Card className="p-8 text-center">
                <h3 className="text-xl font-black tracking-[-0.03em] text-ink">
                  No questions yet
                </h3>
                <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted">
                  Customer questions submitted from product pages will appear here for answers and moderation.
                </p>
              </Card>
            ) : null}

            {questions.map((question) => (
              <Card className="grid gap-4 p-5" key={question.id}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-xl font-black tracking-[-0.03em] text-ink">
                        {productsById.get(question.product_id) ?? question.product_id}
                      </h3>
                      <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.16em] ${
                        question.status === "approved"
                          ? "bg-emerald-100 text-emerald-700"
                          : question.status === "hidden"
                            ? "bg-slate-100 text-slate-700"
                            : "bg-amber-100 text-amber-700"
                      }`}>
                        {question.status}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-bold text-muted">
                      {question.customer_name || "Anonymous customer"}
                      {question.customer_email ? ` · ${question.customer_email}` : ""}
                      {" · "}
                      {formatDate(question.created_at)}
                    </p>
                  </div>
                </div>
                <p className="rounded-2xl border border-slate-100 bg-slate-50 p-3 text-sm leading-6 text-muted">
                  {question.question_text}
                </p>
                <form action={moderateProductQuestion} className="grid gap-3">
                  <input name="questionId" type="hidden" value={question.id} />
                  <input name="productId" type="hidden" value={question.product_id} />
                  <input name="storeId" type="hidden" value={activeStore.id} />
                  <Textarea
                    defaultValue={question.answer_text ?? ""}
                    id={`question-${question.id}-answer`}
                    label="Seller answer"
                    name="answerText"
                    rows={4}
                  />
                  {question.answered_at ? (
                    <p className="text-xs font-bold text-slate-400">
                      Answered {formatDate(question.answered_at)}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button name="status" type="submit" value="pending" variant="secondary">
                      Mark pending
                    </Button>
                    <Button name="status" type="submit" value="hidden" variant="secondary">
                      Hide
                    </Button>
                    <Button name="status" type="submit" value="approved">
                      Approve answer
                    </Button>
                  </div>
                </form>
              </Card>
            ))}
          </section>
        </>
      ) : null}
    </div>
  );
}

function QuestionStatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-5">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">{value}</p>
    </Card>
  );
}
