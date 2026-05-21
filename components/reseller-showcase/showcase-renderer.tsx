import Link from "next/link";
import { getResellerShowcaseTheme } from "@/lib/reseller-showcase/themes";
import { TemplateHeroThumbnail } from "@/components/templates/demo-store-preview";
import { getStoreTemplate } from "@/lib/template-studio/library";
import type {
  PublicResellerShowcase,
  ResellerShowcaseItem
} from "@/lib/reseller-showcase/types";

function stringList(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
}

function socialLinks(showcase: PublicResellerShowcase) {
  const { profile } = showcase;

  return [
    profile.website_url ? { href: profile.website_url, label: "Website" } : null,
    profile.instagram_url ? { href: profile.instagram_url, label: "Instagram" } : null,
    profile.tiktok_url ? { href: profile.tiktok_url, label: "TikTok" } : null
  ].filter(Boolean) as Array<{ href: string; label: string }>;
}

function ShowcaseItemCard({
  item,
  muted,
  premium
}: {
  item: ResellerShowcaseItem;
  muted: string;
  premium: boolean;
}) {
  const features = stringList(item.features);
  const previewImages = stringList(item.preview_images);
  const templatePreviewId = previewImages
    .find((image) => image.startsWith("template:"))
    ?.replace("template:", "");
  const templatePreview = templatePreviewId ? getStoreTemplate(templatePreviewId) : null;

  return (
    <article
      className={`group overflow-hidden rounded-[2rem] border ${
        premium
          ? "border-white/10 bg-white/10 text-white"
          : "border-slate-200 bg-white text-slate-950"
      } shadow-[0_24px_80px_-55px_rgba(15,23,42,0.9)] transition hover:-translate-y-1`}
    >
      {templatePreview ? (
        <div className="p-3">
          <TemplateHeroThumbnail template={templatePreview} />
        </div>
      ) : (
        <div
          className={`flex h-56 items-center justify-center bg-slate-100 bg-cover bg-center ${
            premium ? "bg-white/10" : ""
          }`}
          style={item.thumbnail_url ? { backgroundImage: `url(${item.thumbnail_url})` } : undefined}
        >
          {!item.thumbnail_url ? (
            <span className={`text-sm font-black uppercase tracking-[0.22em] ${muted}`}>
              Store preview
            </span>
          ) : null}
        </div>
      )}
      <div className="grid gap-4 p-5 lg:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className={`text-xs font-black uppercase tracking-[0.18em] ${muted}`}>
              {item.category ?? "Ready-made store"}
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.04em]">{item.title}</h2>
          </div>
          <span className="rounded-full bg-emerald-500 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-white">
            Live
          </span>
        </div>
        <p className={`text-sm leading-6 ${muted}`}>
          {item.description ?? "A reseller-published SHASTORE AI showcase item."}
        </p>
        {features.length ? (
          <div className="grid gap-2">
            {features.slice(0, 4).map((feature) => (
              <div className="flex items-center gap-2 text-sm font-semibold" key={feature}>
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                {feature}
              </div>
            ))}
          </div>
        ) : null}
        {previewImages.filter((image) => !image.startsWith("template:")).length ? (
          <div className="grid grid-cols-3 gap-2">
            {previewImages.filter((image) => !image.startsWith("template:")).slice(0, 3).map((image) => (
              <div
                className="h-20 rounded-2xl bg-slate-100 bg-cover bg-center"
                key={image}
                style={{ backgroundImage: `url(${image})` }}
              />
            ))}
          </div>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xl font-black">{item.price_label ?? "Pricing on request"}</p>
          {item.demo_url ? (
            <Link
              className={`inline-flex h-11 items-center rounded-full px-5 text-sm font-black ${
                premium ? "bg-white text-slate-950" : "bg-slate-950 text-white"
              }`}
              href={item.demo_url}
              target="_blank"
            >
              View demo
            </Link>
          ) : (
            <span className={`text-sm font-semibold ${muted}`}>Demo coming soon</span>
          )}
        </div>
      </div>
    </article>
  );
}

export function ResellerShowcaseRenderer({
  showcase
}: {
  showcase: PublicResellerShowcase;
}) {
  const { items, profile } = showcase;
  const theme = getResellerShowcaseTheme(profile.theme_id);
  const premium = profile.theme_id === "dark-premium";
  const muted = premium ? "text-white/60" : "text-slate-500";
  const links = socialLinks(showcase);

  return (
    <main className={`min-h-screen ${theme.surfaceClass}`}>
      <section className={`px-4 py-8 sm:px-6 lg:px-8 ${theme.heroClass}`}>
        <div className="mx-auto max-w-7xl overflow-hidden rounded-[2rem] border border-white/10">
          <div
            className="min-h-72 bg-cover bg-center p-6 lg:p-10"
            style={
              profile.banner_url
                ? { backgroundImage: `linear-gradient(rgba(15,23,42,.55), rgba(15,23,42,.55)), url(${profile.banner_url})` }
                : undefined
            }
          >
            <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                {profile.logo_url ? (
                  <div
                    aria-label={`${profile.display_name} logo`}
                    className="mb-6 h-16 w-16 rounded-3xl border border-white/20 bg-cover bg-center"
                    role="img"
                    style={{ backgroundImage: `url(${profile.logo_url})` }}
                  />
                ) : null}
                <p className="text-xs font-black uppercase tracking-[0.26em] opacity-60">
                  Reseller Showcase
                </p>
                <h1 className="mt-4 text-5xl font-black tracking-[-0.07em] lg:text-7xl">
                  {profile.display_name}
                </h1>
                <p className="mt-5 max-w-2xl text-base font-medium leading-8 opacity-75">
                  {profile.bio ??
                    "A curated marketplace of ready-made stores and templates built with SHASTORE AI."}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                {links.map((link) => (
                  <Link
                    className="inline-flex h-11 items-center rounded-full border border-white/20 bg-white/10 px-5 text-sm font-black backdrop-blur"
                    href={link.href}
                    key={link.label}
                    target="_blank"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className={`text-xs font-black uppercase tracking-[0.22em] ${theme.accentClass}`}>
                Store Marketplace
              </p>
              <h2 className={`mt-2 text-4xl font-black tracking-[-0.05em] ${premium ? "text-white" : "text-slate-950"}`}>
                Ready-made stores and templates
              </h2>
            </div>
            <p className={`text-sm font-semibold ${muted}`}>
              {items.length} published listing{items.length === 1 ? "" : "s"}
            </p>
          </div>
          {items.length ? (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {items.map((item) => (
                <ShowcaseItemCard
                  item={item}
                  key={item.id}
                  muted={muted}
                  premium={premium}
                />
              ))}
            </div>
          ) : (
            <div
              className={`rounded-[2rem] border p-8 text-center ${
                premium
                  ? "border-white/10 bg-white/10 text-white"
                  : "border-slate-200 bg-white text-slate-950"
              }`}
            >
              <h2 className="text-2xl font-black tracking-[-0.03em]">No listings yet</h2>
              <p className={`mx-auto mt-2 max-w-xl text-sm leading-6 ${muted}`}>
                This reseller has not published marketplace items yet.
              </p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
