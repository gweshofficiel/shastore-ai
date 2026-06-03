import type { ReactNode } from "react";
import { Headphones, RotateCcw, ShieldCheck, Truck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { StoreThemeSettings } from "@/types/storefront";

type VisualTheme = {
  accent: string;
  primary: string;
  secondary: string;
};

export type HeroVisualSlots = {
  ctaLink: string;
  ctaText: string;
  desktopBannerUrl: string | null;
  mobileBannerUrl: string | null;
  subtitle: string;
  title: string;
};

export type CategoryVisualSlot = {
  accentColor: string;
  icon: LucideIcon;
  imageUrl: string | null;
};

export type TrustVisualSlot = {
  body: string;
  icon: LucideIcon;
  title: string;
};

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function nullableString(value: unknown) {
  const text = stringValue(value);
  return text || null;
}

function configRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function colorFromText(value: string, fallback: string) {
  const palette = ["#0f172a", "#1d4ed8", "#d97706", "#047857", "#7c3aed", "#be123c"];
  const sum = value.split("").reduce((total, char) => total + char.charCodeAt(0), 0);
  return palette[sum % palette.length] ?? fallback;
}

export function resolveHeroVisualSlots({
  config,
  fallbackSubtitle,
  fallbackTitle,
  themeSettings
}: {
  config: Record<string, unknown>;
  fallbackSubtitle: string;
  fallbackTitle: string;
  themeSettings: StoreThemeSettings;
}): HeroVisualSlots {
  const visual = configRecord(config.visual);

  return {
    ctaLink: stringValue(config.ctaLink ?? config.ctaHref ?? visual.ctaLink, "#products"),
    ctaText: stringValue(config.ctaText ?? visual.ctaText, themeSettings.ctaText || "Shop now"),
    desktopBannerUrl: nullableString(
      config.desktopBannerUrl ??
        config.desktopBanner ??
        visual.desktopBannerUrl ??
        visual.desktopBanner ??
        config.bannerImageUrl ??
        themeSettings.bannerImageUrl
    ),
    mobileBannerUrl: nullableString(
      config.mobileBannerUrl ??
        config.mobileBanner ??
        visual.mobileBannerUrl ??
        visual.mobileBanner
    ),
    subtitle: stringValue(config.subtitle ?? config.body ?? visual.subtitle, fallbackSubtitle),
    title: stringValue(config.title ?? visual.title, fallbackTitle)
  };
}

export function resolveCategoryVisualSlot({
  accentColor,
  category,
  fallbackIcon
}: {
  accentColor: string;
  category: {
    imageUrl?: string | null;
    name: string;
  };
  fallbackIcon: LucideIcon;
}): CategoryVisualSlot {
  return {
    accentColor: colorFromText(category.name, accentColor),
    icon: fallbackIcon,
    imageUrl: category.imageUrl ?? null
  };
}

export function defaultTrustVisualSlots(): TrustVisualSlot[] {
  return [
    {
      body: "Checkout and order handling are designed for a clear, protected shopping flow.",
      icon: ShieldCheck,
      title: "Secure checkout"
    },
    {
      body: "Delivery and pickup messaging can connect to the store's fulfillment settings.",
      icon: Truck,
      title: "Fast delivery"
    },
    {
      body: "Return and refund policies can be surfaced wherever the template needs trust support.",
      icon: RotateCcw,
      title: "Money back guarantee"
    },
    {
      body: "Support channels are ready for email, phone, WhatsApp, and future helpdesk integrations.",
      icon: Headphones,
      title: "24/7 support"
    }
  ];
}

export function PremiumVisualFallback({
  accentLabel,
  className = "",
  theme
}: {
  accentLabel?: string;
  className?: string;
  theme: VisualTheme;
}) {
  return (
    <div
      aria-label={accentLabel}
      className={`relative overflow-hidden ${className}`}
      role="img"
      style={{
        background: `radial-gradient(circle at 20% 20%, ${theme.accent}33, transparent 28%), radial-gradient(circle at 82% 18%, ${theme.secondary}2e, transparent 26%), linear-gradient(135deg, ${theme.primary}14, ${theme.secondary}22)`
      }}
    >
      <div className="absolute -left-10 top-8 h-32 w-32 rounded-full bg-white/50 blur-2xl" />
      <div className="absolute bottom-6 right-6 h-24 w-24 rounded-[2rem] border border-white/70 bg-white/45 shadow-2xl" />
      <div className="absolute bottom-12 left-8 h-3 w-28 rounded-full bg-white/70" />
      <div className="absolute bottom-7 left-8 h-2 w-40 rounded-full bg-white/45" />
    </div>
  );
}

export function CategoryVisualMedia({
  categoryName,
  className = "aspect-[4/3]",
  slot,
  theme
}: {
  categoryName: string;
  className?: string;
  slot: CategoryVisualSlot;
  theme: VisualTheme;
}) {
  const Icon = slot.icon;

  if (slot.imageUrl) {
    return <img alt={categoryName} className={`${className} w-full object-cover`} src={slot.imageUrl} />;
  }

  return (
    <div
      className={`relative flex items-end justify-between overflow-hidden p-4 ${className}`}
      style={{
        background: `radial-gradient(circle at 20% 15%, ${slot.accentColor}28, transparent 28%), linear-gradient(135deg, ${theme.primary}12, ${theme.secondary}24)`
      }}
    >
      <span className="rounded-2xl bg-white/85 p-3 text-slate-700 shadow-sm">
        <Icon className="h-5 w-5" />
      </span>
      <span className="h-12 w-12 rounded-full border border-white/70 bg-white/45 shadow-inner" />
    </div>
  );
}

export function PromotionalVisualBlocks({
  ctaHref = "#products",
  slots,
  theme
}: {
  ctaHref?: string;
  slots?: Array<{
    eyebrow?: string;
    title?: string;
    body?: string;
    ctaText?: string;
  }>;
  theme: VisualTheme;
}) {
  const promoSlots = slots?.length ? slots : [
    {
      body: "Countdown-ready merchandising space for limited-time offers.",
      ctaText: "Shop deals",
      eyebrow: "Flash sale",
      title: "Premium deal banner"
    },
    {
      body: "Highlight delivery thresholds, regions, or shipping campaigns.",
      ctaText: "View shipping",
      eyebrow: "Free shipping",
      title: "Delivery incentive"
    },
    {
      body: "Seasonal campaign block prepared for future campaign assets.",
      ctaText: "Browse collection",
      eyebrow: "Seasonal sale",
      title: "Campaign spotlight"
    }
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {promoSlots.slice(0, 3).map((slot, index) => (
        <a
          className="group overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
          href={ctaHref}
          key={`${slot.title ?? "promotion"}-${index}`}
        >
          <div
            className="rounded-[1.5rem] p-5 text-white"
            style={{
              background: `linear-gradient(135deg, ${index === 1 ? theme.secondary : theme.primary}, ${index === 2 ? theme.accent : theme.secondary})`
            }}
          >
            <p className="text-xs font-black uppercase tracking-[0.2em] text-white/70">{slot.eyebrow}</p>
            <h3 className="mt-3 text-2xl font-black tracking-[-0.04em]">{slot.title}</h3>
            <p className="mt-3 text-sm font-semibold leading-6 text-white/75">{slot.body}</p>
            <div className="mt-5 grid grid-cols-4 gap-2" aria-hidden="true">
              {[0, 1, 2, 3].map((item) => (
                <span className="rounded-xl bg-white/15 px-2 py-2 text-center text-[10px] font-black" key={item}>
                  00
                </span>
              ))}
            </div>
          </div>
          <span className="mt-4 inline-flex text-xs font-black uppercase tracking-[0.16em] text-slate-600 transition group-hover:text-slate-950">
            {slot.ctaText}
          </span>
        </a>
      ))}
    </div>
  );
}

export function PopupAnnouncementSlots({ theme }: { theme: VisualTheme }) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {[
        ["Announcement bar", "Ready for store-wide shipping, launch, or service notices."],
        ["Newsletter popup", "Ready for email capture once a signup destination is connected."],
        ["Discount popup", "Ready for campaign codes and future popup targeting."]
      ].map(([title, body], index) => (
        <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-5 shadow-sm" key={title}>
          <span
            className="inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white"
            style={{ backgroundColor: index === 0 ? theme.primary : index === 1 ? theme.secondary : theme.accent }}
          >
            Slot
          </span>
          <h3 className="mt-4 text-lg font-black tracking-[-0.03em] text-ink">{title}</h3>
          <p className="mt-2 text-sm font-semibold leading-6 text-muted">{body}</p>
        </div>
      ))}
    </div>
  );
}

export function TrustVisualBlocks({
  slots = defaultTrustVisualSlots()
}: {
  slots?: TrustVisualSlot[];
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {slots.map((slot) => {
        const Icon = slot.icon;

        return (
          <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5" key={slot.title}>
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white">
              <Icon className="h-5 w-5" />
            </div>
            <h3 className="text-base font-black text-ink">{slot.title}</h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-muted">{slot.body}</p>
          </div>
        );
      })}
    </div>
  );
}

export function VisualSlotPanel({
  children,
  eyebrow,
  subtitle,
  title
}: {
  children: ReactNode;
  eyebrow: string;
  subtitle?: string;
  title: string;
}) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-ink">{title}</h2>
      {subtitle ? <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-muted">{subtitle}</p> : null}
      <div className="mt-6">{children}</div>
    </div>
  );
}
