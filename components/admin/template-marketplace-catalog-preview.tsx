import { AdminBadge } from "@/components/admin/admin-control";

type TemplateMarketplaceCatalogPreviewProps = {
  cards: Array<{
    badges: string[];
    category: string | null;
    featured: boolean;
    id: string;
    isOfficial: boolean;
    isRecommended: boolean;
    listingDescription: string | null;
    listingStatus: string;
    listingTitle: string;
    previewGradient: string | null;
    pricingLabel: string;
    pricingType: string;
    publishedAt: string | null;
    screenshots: Array<{
      imageUrl: string | null;
      label: string;
    }>;
    templateName: string;
    templateSlug: string;
    versionNumber: string | null;
  }>;
};

export function TemplateMarketplaceCatalogPreview({ cards }: TemplateMarketplaceCatalogPreviewProps) {
  if (!cards.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm font-semibold text-slate-500">
        No published marketplace listings yet. Approve and publish a draft listing to preview the admin catalog.
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => {
        const hero = card.screenshots[0];

        return (
          <article
            className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
            key={card.id}
          >
            <div
              className="relative aspect-[16/10] overflow-hidden"
              style={{
                background:
                  hero?.imageUrl
                    ? `center / cover no-repeat url(${hero.imageUrl})`
                    : card.previewGradient ?? "linear-gradient(135deg,#0f172a,#2563eb 52%,#020617)"
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent" />
              <div className="absolute left-3 top-3 flex flex-wrap gap-2">
                <AdminBadge tone="green">{card.pricingLabel}</AdminBadge>
                {card.featured ? <AdminBadge tone="amber">Featured</AdminBadge> : null}
                <AdminBadge tone="blue">{card.listingStatus}</AdminBadge>
              </div>
            </div>

            <div className="grid gap-3 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-black tracking-[-0.03em] text-slate-950">{card.listingTitle}</h3>
                {card.isOfficial ? <AdminBadge tone="green">Official</AdminBadge> : null}
                {card.isRecommended ? <AdminBadge tone="amber">Recommended</AdminBadge> : null}
              </div>

              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                {card.templateName} · v{card.versionNumber ?? "—"} · {card.category ?? "General"}
              </p>

              <p className="text-sm font-semibold text-slate-600">
                {card.listingDescription ?? "No marketplace description provided."}
              </p>

              <div className="flex flex-wrap gap-2">
                {card.badges.slice(0, 4).map((badge) => (
                  <AdminBadge key={`${card.id}-${badge}`} tone="blue">
                    {badge}
                  </AdminBadge>
                ))}
              </div>

              {card.screenshots.length > 1 ? (
                <div className="grid grid-cols-3 gap-2">
                  {card.screenshots.slice(1, 4).map((screenshot, index) => (
                    <div
                      className="aspect-[4/3] rounded-xl border border-slate-200 bg-slate-100"
                      key={`${card.id}-shot-${index}`}
                      style={
                        screenshot.imageUrl
                          ? {
                              background: `center / cover no-repeat url(${screenshot.imageUrl})`
                            }
                          : {
                              background:
                                card.previewGradient ??
                                "linear-gradient(135deg,#f8fafc,#2563eb 52%,#020617)"
                            }
                      }
                      title={screenshot.label}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}
