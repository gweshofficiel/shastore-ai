import { PageHeader } from "@/components/dashboard/page-header";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { UpgradeRequiredCard } from "@/components/billing/UpgradeRequiredCard";
import { Input } from "@/components/ui/input";
import { DeleteLandingButton } from "@/components/dashboard/delete-landing-button";
import { publishLandingPageById } from "@/lib/landing-actions";
import {
  duplicateLandingPage,
  unpublishLandingPage
} from "@/lib/landing-management-actions";
import { getCurrentUserSubscriptionAccess } from "@/lib/billing/access";
import { getRecommendedUpgrade } from "@/lib/billing/upgrade";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspaceForUser } from "@/lib/workspaces/active-workspace";

export const dynamic = "force-dynamic";
const pageSize = 8;

type LandingsPageProps = {
  searchParams: Promise<{
    detail?: string;
    error?: string;
    q?: string;
    status?: string;
    published?: string;
    draft?: string;
    deleted?: string;
    duplicated?: string;
    unpublished?: string;
    page?: string;
  }>;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
}

function pageHref(page: number, query?: string, status?: string) {
  const params = new URLSearchParams();

  if (query) {
    params.set("q", query);
  }
  if (status && status !== "all") {
    params.set("status", status);
  }
  if (page > 1) {
    params.set("page", String(page));
  }

  const search = params.toString();
  return search ? `/dashboard/landings?${search}` : "/dashboard/landings";
}

async function getLandings(query = "", status = "all", page = 1) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { items: [], page: 1, total: 0, totalPages: 1 };
  }

  const selection = await getActiveWorkspaceForUser({ supabase, userId: user.id });
  const workspaceId = selection.activeWorkspaceId;

  console.log("[workspace-data-access] landings list scoped", {
    userId: user.id,
    workspaceId
  });

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  let request = supabase
    .from("landing_pages")
    .select(
      "id, product_name, slug, status, template_id, created_at, published_at, hero_image_url",
      { count: "exact" }
    )
    .eq("workspace_id" as never, workspaceId as never)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (query) {
    request = request.ilike("product_name", `%${query}%`);
  }

  if (status === "draft" || status === "published" || status === "archived") {
    request = request.eq("status", status);
  }

  const { count, data } = await request;
  const total = count ?? 0;

  return {
    items: data ?? [],
    page,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize))
  };
}

export default async function LandingsPage({ searchParams }: LandingsPageProps) {
  const params = await searchParams;
  const currentPage = Math.max(1, Number(params.page ?? "1") || 1);
  const [access, landings] = await Promise.all([
    getCurrentUserSubscriptionAccess(),
    getLandings(params.q, params.status, currentPage)
  ]);
  const status = params.status ?? "all";
  const landingUpgrade = access
    ? getRecommendedUpgrade({
        blockedResource: "landings",
        currentPlanId: access.plan.id,
        needsUnlimited: access.plan.id === "starter" || access.plan.id === "pro"
      })
    : null;

  return (
    <div className="grid gap-6 lg:gap-8">
      <PageHeader
        action={
          <ButtonLink href="/dashboard/landings/new">
            Create landing page
          </ButtonLink>
        }
        description="Create template-based ecommerce landing pages with AI-generated copy and WhatsApp CTAs."
        title="Landing pages"
      />
      {params.published ? (
        <Card className="border-emerald-200 bg-emerald-50 p-5">
          <p className="text-sm font-bold text-emerald-800">
            Landing page published successfully.
          </p>
          <p className="mt-1 text-sm text-emerald-700">
            Your page is live at /l/{params.published}.
          </p>
        </Card>
      ) : null}
      {params.error === "limit-reached" && access ? (
        <UpgradeRequiredCard
          blockedAction="Landing page limit reached"
          currentPlan={access.plan.name}
          reason={landingUpgrade?.reason ?? params.detail ?? "Landing page limit reached on your current plan."}
          recommendedPlan={landingUpgrade?.planName ?? "Starter"}
          recommendedPlanId={landingUpgrade?.planId}
        />
      ) : null}
      {params.draft ? (
        <Card className="border-slate-200 bg-slate-50 p-5">
          <p className="text-sm font-bold text-ink">Draft saved successfully.</p>
          <p className="mt-1 text-sm text-muted">
            Preview it, then publish when you are ready.
          </p>
        </Card>
      ) : null}
      {params.deleted ? (
        <Card className="border-slate-200 bg-slate-50 p-5">
          <p className="text-sm font-bold text-ink">
            Landing page deleted successfully.
          </p>
        </Card>
      ) : null}
      {params.duplicated ? (
        <Card className="border-slate-200 bg-slate-50 p-5">
          <p className="text-sm font-bold text-ink">
            Landing page duplicated as a draft.
          </p>
        </Card>
      ) : null}
      {params.unpublished ? (
        <Card className="border-slate-200 bg-slate-50 p-5">
          <p className="text-sm font-bold text-ink">
            Landing page unpublished and moved to drafts.
          </p>
        </Card>
      ) : null}
      <Card className="p-5 lg:p-6">
        <div className="mb-5 flex flex-wrap gap-2">
          {[
            ["all", "All"],
            ["published", "Published"],
            ["draft", "Drafts"]
          ].map(([value, label]) => (
            <ButtonLink
              className={
                status === value
                  ? "bg-ink text-white hover:bg-slate-800"
                  : undefined
              }
              href={pageHref(1, params.q, value)}
              key={value}
              variant={status === value ? "primary" : "secondary"}
            >
              {label}
            </ButtonLink>
          ))}
        </div>
        <form className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
          <input name="status" type="hidden" value={status} />
          <Input
            defaultValue={params.q}
            id="q"
            label="Search"
            name="q"
            placeholder="Search product pages"
          />
          <div className="flex">
            <button className="h-12 w-full rounded-full bg-ink px-6 text-sm font-black text-white shadow-[0_18px_45px_-24px_rgba(15,23,42,0.9)] md:w-auto">
              Filter
            </button>
          </div>
        </form>
      </Card>
      <div className="grid gap-4">
        {landings.items.length ? (
          landings.items.map((landing) => (
            <Card
              className="grid gap-5 p-5 transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_22px_70px_-48px_rgba(15,23,42,0.95)] lg:grid-cols-[88px_minmax(0,1fr)_auto]"
              key={landing.id}
            >
              <div className="h-24 w-24 overflow-hidden rounded-3xl border border-slate-200 bg-slate-50">
                {landing.hero_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt={landing.product_name}
                    className="h-full w-full object-cover"
                    src={landing.hero_image_url}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                    Image
                  </div>
                )}
              </div>
              <div className="min-w-0 self-center">
                <p className="truncate text-lg font-black text-ink">
                  {landing.product_name}
                </p>
                <p className="mt-1 truncate text-sm text-muted">
                  /l/{landing.slug}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-muted">
                    {landing.status}
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-muted">
                    {landing.template_id}
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-muted">
                    {formatDate(landing.created_at)}
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-3 self-center lg:justify-end">
                <ButtonLink
                  href={`/dashboard/landings/${landing.id}`}
                  variant="secondary"
                >
                  Edit
                </ButtonLink>
                <ButtonLink href={`/l/${landing.slug}`} variant="secondary">
                  Preview
                </ButtonLink>
                {landing.status === "published" ? (
                  <ButtonLink
                    href={`/l/${landing.slug}`}
                    target="_blank"
                    variant="secondary"
                  >
                    Open public page
                  </ButtonLink>
                ) : null}
                <form action={duplicateLandingPage}>
                  <input name="landingId" type="hidden" value={landing.id} />
                  <Button type="submit" variant="secondary">
                    Duplicate
                  </Button>
                </form>
                {landing.status !== "published" ? (
                  <form action={publishLandingPageById}>
                    <input name="landingId" type="hidden" value={landing.id} />
                    <Button type="submit">Publish</Button>
                  </form>
                ) : (
                  <form action={unpublishLandingPage}>
                    <input name="landingId" type="hidden" value={landing.id} />
                    <Button type="submit" variant="secondary">
                      Unpublish
                    </Button>
                  </form>
                )}
                <DeleteLandingButton
                  landingId={landing.id}
                  productName={landing.product_name}
                />
              </div>
            </Card>
          ))
        ) : (
          <Card className="p-8 text-center lg:p-12">
            <h2 className="text-2xl font-black tracking-[-0.03em] text-ink">
              Your landing pages will appear here.
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted">
              Start with a product form, generate copy, choose a template, and
              publish a mobile-ready page at a shareable URL.
            </p>
            <ButtonLink className="mt-6" href="/dashboard/landings/new">
              Create your first landing page
            </ButtonLink>
          </Card>
        )}
      </div>
      {landings.totalPages > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-muted">
            Page {landings.page} of {landings.totalPages} · {landings.total}{" "}
            landings
          </p>
          <div className="flex gap-2">
            <ButtonLink
              href={pageHref(Math.max(1, landings.page - 1), params.q, status)}
              variant="secondary"
            >
              Previous
            </ButtonLink>
            <ButtonLink
              href={pageHref(
                Math.min(landings.totalPages, landings.page + 1),
                params.q,
                status
              )}
              variant="secondary"
            >
              Next
            </ButtonLink>
          </div>
        </div>
      ) : null}
    </div>
  );
}
