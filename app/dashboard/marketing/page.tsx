import { PageHeader } from "@/components/dashboard/page-header";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { fetchStoresForAuthUser, type UserStoreRow } from "@/lib/stores/user-stores";
import { getActiveWorkspaceForUser } from "@/lib/workspaces/active-workspace";

export const dynamic = "force-dynamic";

type MarketingPageProps = {
  searchParams: Promise<{
    storeId?: string;
  }>;
};

type MarketingData = {
  activeStore: UserStoreRow | null;
  error: string | null;
  stores: UserStoreRow[];
};

type MarketingSection = {
  actionLabel: string;
  bullets: string[];
  description: string;
  foundation: "Live foundation" | "Preview mode" | "Setup required" | "Coming soon";
  href: string;
  secondaryAction?: {
    href: string;
    label: string;
  };
  title: string;
};

function storeName(store: UserStoreRow | null) {
  return store?.store_name ?? store?.name ?? "Selected store";
}

function withStoreId(href: string, storeId?: string | null) {
  if (!storeId) {
    return href;
  }

  const separator = href.includes("?") ? "&" : "?";

  return `${href}${separator}storeId=${encodeURIComponent(storeId)}`;
}

function statusClass(status: MarketingSection["foundation"]) {
  const classes: Record<MarketingSection["foundation"], string> = {
    "Coming soon": "bg-slate-100 text-slate-700",
    "Live foundation": "bg-emerald-100 text-emerald-700",
    "Preview mode": "bg-blue-100 text-blue-700",
    "Setup required": "bg-amber-100 text-amber-700"
  };

  return classes[status];
}

async function getMarketingData(selectedStoreId?: string): Promise<MarketingData> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      activeStore: null,
      error: "Sign in to open the Marketing dashboard.",
      stores: []
    };
  }

  const selection = await getActiveWorkspaceForUser({ supabase, userId: user.id });
  const { error, stores } = await fetchStoresForAuthUser(
    supabase,
    user.id,
    selection.activeWorkspaceId
  );
  const activeStore = stores.find((store) => store.id === selectedStoreId) ?? stores[0] ?? null;

  return {
    activeStore,
    error: error ? "Stores could not be loaded for marketing setup." : null,
    stores
  };
}

export default async function MarketingPage({ searchParams }: MarketingPageProps) {
  const query = await searchParams;
  const data = await getMarketingData(query.storeId);
  const activeStoreId = data.activeStore?.id ?? null;
  const selectedStoreName = storeName(data.activeStore);
  const sections: MarketingSection[] = [
    {
      actionLabel: "Manage coupons",
      bullets: [
        "Create store-scoped coupon codes.",
        "Checkout validates coupon rules again before an order is saved.",
        "Discount campaigns can target products, categories, or customer segments."
      ],
      description:
        "Use existing coupon and discount campaign tools to run safe promotions for the selected store.",
      foundation: "Live foundation",
      href: withStoreId("/dashboard/coupons", activeStoreId),
      secondaryAction: {
        href: withStoreId("/dashboard/discount-campaigns", activeStoreId),
        label: "Open discount campaigns"
      },
      title: "Coupons & Discounts"
    },
    {
      actionLabel: "Start setup",
      bullets: [
        "Show a short banner at the top of the storefront.",
        "Schedule start and end dates when needed.",
        "Shared storefront runtime renders active announcements for every template."
      ],
      description:
        "Prepare store-wide sale messages, shipping notices, or launch announcements without changing templates one by one.",
      foundation: "Live foundation",
      href: withStoreId("/dashboard/popups-announcements", activeStoreId),
      title: "Announcement Bar"
    },
    {
      actionLabel: "Start setup",
      bullets: [
        "Create newsletter, discount, or exit-intent popup drafts.",
        "Popups are dismissible and scoped to the selected storefront.",
        "Shared storefront runtime keeps popup support reusable across templates."
      ],
      description:
        "Add lightweight storefront prompts for launches and offers. Nothing is sent to shoppers from this Marketing hub.",
      foundation: "Preview mode",
      href: withStoreId("/dashboard/popups-announcements", activeStoreId),
      title: "Popups"
    },
    {
      actionLabel: "Review carts",
      bullets: [
        "Review carts with shopper contact details when available.",
        "Recovery stays tied to the selected store and workspace.",
        "No SMS recovery is connected from this foundation page."
      ],
      description:
        "Track carts that need recovery attention and keep recovery actions controlled in the abandoned cart workspace.",
      foundation: "Setup required",
      href: withStoreId("/dashboard/abandoned-carts", activeStoreId),
      title: "Abandoned Cart"
    },
    {
      actionLabel: "Open campaign drafts",
      bullets: [
        "Draft campaign name, subject, content, and customer segment.",
        "Review recipients before any delivery workflow is used.",
        "This Marketing hub never sends a campaign."
      ],
      description:
        "Plan customer email campaigns with safe draft-first workflows. Delivery is not triggered from this overview.",
      foundation: "Preview mode",
      href: withStoreId("/dashboard/email-campaigns", activeStoreId),
      title: "Email Campaigns"
    },
    {
      actionLabel: "Open SEO setup",
      bullets: [
        "Tune store, product, page, and article metadata.",
        "Prepare share previews and search snippets.",
        "Promotion links and external search tools remain setup-only until configured."
      ],
      description:
        "Improve organic promotion readiness with store-scoped SEO settings and safe preview states.",
      foundation: "Setup required",
      href: withStoreId("/dashboard/seo", activeStoreId),
      title: "SEO Promotions"
    }
  ];

  return (
    <div className="grid gap-6 lg:gap-8">
      <PageHeader
        action={
          activeStoreId ? (
            <ButtonLink href={withStoreId("/dashboard/popups-announcements", activeStoreId)}>
              Start setup
            </ButtonLink>
          ) : (
            <ButtonLink href="/dashboard/stores/new">Create store</ButtonLink>
          )
        }
        description="Plan promotions after store setup with store-scoped tools for coupons, announcements, popups, cart recovery, campaigns, and SEO. No campaign is sent from this page."
        title="Marketing"
      />

      {data.error ? (
        <Card className="border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-bold text-amber-800">{data.error}</p>
        </Card>
      ) : null}

      <Card className="p-5 lg:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
              Selected store
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">
              {data.activeStore ? selectedStoreName : "Create a store before marketing setup"}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              Marketing setup reads only stores available in your active workspace. Each action opens
              the existing store-scoped tool with this store selected.
            </p>
          </div>
          {data.stores.length > 1 ? (
            <form className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="grid min-w-64 gap-2 text-sm font-semibold text-ink">
                <span>Store</span>
                <select
                  className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink outline-none"
                  defaultValue={data.activeStore?.id ?? ""}
                  name="storeId"
                >
                  {data.stores.map((store) => (
                    <option key={store.id} value={store.id}>
                      {storeName(store)}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="inline-flex h-11 items-center justify-center whitespace-nowrap rounded-full border border-slate-200 bg-white px-5 text-sm font-bold text-ink shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                type="submit"
              >
                Switch store
              </button>
            </form>
          ) : null}
        </div>
      </Card>

      {!data.activeStore ? (
        <Card className="border-dashed border-slate-300 bg-slate-50 p-8 text-center">
          <h2 className="text-2xl font-black tracking-[-0.03em] text-ink">
            No store selected
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-muted">
            Create a store first. Marketing tools stay store-scoped so promotions, popups, carts,
            and campaign drafts do not cross into another storefront.
          </p>
          <ButtonLink className="mt-5" href="/dashboard/stores/new">
            Create store
          </ButtonLink>
        </Card>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <Card className="p-5">
              <p className="text-sm font-bold text-muted">Store scope</p>
              <p className="mt-3 text-3xl font-black tracking-[-0.04em] text-ink">Active</p>
              <p className="mt-2 text-sm leading-6 text-muted">
                Actions pass the selected store into each existing dashboard tool.
              </p>
            </Card>
            <Card className="p-5">
              <p className="text-sm font-bold text-muted">Runtime support</p>
              <p className="mt-3 text-3xl font-black tracking-[-0.04em] text-ink">Shared</p>
              <p className="mt-2 text-sm leading-6 text-muted">
                Announcement and popup blocks render through the shared storefront runtime.
              </p>
            </Card>
            <Card className="p-5">
              <p className="text-sm font-bold text-muted">Campaign safety</p>
              <p className="mt-3 text-3xl font-black tracking-[-0.04em] text-ink">Draft first</p>
              <p className="mt-2 text-sm leading-6 text-muted">
                This hub does not send campaigns, SMS, charges, or external integrations.
              </p>
            </Card>
          </section>

          <section className="grid gap-5 lg:grid-cols-2">
            {sections.map((section) => (
              <Card className="flex flex-col p-6" key={section.title}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                      Marketing essential
                    </p>
                    <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">
                      {section.title}
                    </h2>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${statusClass(
                      section.foundation
                    )}`}
                  >
                    {section.foundation}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-muted">{section.description}</p>
                <div className="mt-5 grid gap-3">
                  {section.bullets.map((bullet) => (
                    <p
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold leading-6 text-muted"
                      key={bullet}
                    >
                      {bullet}
                    </p>
                  ))}
                </div>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <ButtonLink className="w-full justify-center sm:w-fit" href={section.href}>
                    {section.actionLabel}
                  </ButtonLink>
                  {section.secondaryAction ? (
                    <ButtonLink
                      className="w-full justify-center sm:w-fit"
                      href={section.secondaryAction.href}
                      variant="secondary"
                    >
                      {section.secondaryAction.label}
                    </ButtonLink>
                  ) : null}
                </div>
              </Card>
            ))}
          </section>

          <Card className="border-blue-100 bg-blue-50 p-5">
            <p className="text-sm font-bold leading-6 text-blue-900">
              Foundation safety: this Marketing page only routes owners to existing store-scoped
              setup tools. It does not send campaigns, register external integrations, bill
              customers, or create background delivery jobs.
            </p>
          </Card>
        </>
      )}
    </div>
  );
}
