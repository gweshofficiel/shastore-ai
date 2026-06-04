import { Award, BadgeCheck, Gift, Headphones, RotateCcw, ShieldCheck, ShoppingBag, Sparkles, Star, Truck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { PublicStorefrontProduct } from "@/lib/public-storefront-preview";
import type { ProductRatingSummaryValue } from "@/components/storefront/product-rating-summary";

type MarketingTheme = {
  accent: string;
  primary: string;
  secondary: string;
};

export type MarketingTrustBadge = {
  body: string;
  icon: LucideIcon;
  title: string;
};

export type PromotionStripItem = {
  body: string;
  ctaHref?: string;
  ctaText?: string;
  eyebrow: string;
  title: string;
};

export type AnnouncementRuntimeItem = {
  body: string;
  ctaHref?: string;
  ctaText?: string;
  title: string;
};

export type ConversionBlockItem = {
  body: string;
  icon: LucideIcon;
  title: string;
};

export function defaultMarketingTrustBadges(): MarketingTrustBadge[] {
  return [
    {
      body: "Checkout is presented with clear, secure purchase messaging.",
      icon: ShieldCheck,
      title: "Secure checkout"
    },
    {
      body: "Shipping promises can connect to fulfillment and delivery settings.",
      icon: Truck,
      title: "Fast shipping"
    },
    {
      body: "Return policy messaging is ready to surface across premium templates.",
      icon: RotateCcw,
      title: "Easy returns"
    },
    {
      body: "Support channels are ready for email, phone, WhatsApp, and future helpdesk integrations.",
      icon: Headphones,
      title: "24/7 support"
    }
  ];
}

export function defaultPromotionStrips(): PromotionStripItem[] {
  return [
    {
      body: "Shipping incentive strip ready for thresholds, regions, and delivery campaigns.",
      ctaText: "Shop now",
      eyebrow: "Free shipping",
      title: "Free shipping offer"
    },
    {
      body: "Limited-time merchandising strip for countdowns and campaign assets.",
      ctaText: "Shop deals",
      eyebrow: "Flash sale",
      title: "Flash sale ready"
    },
    {
      body: "Seasonal campaign strip for events, launches, and holiday edits.",
      ctaText: "Browse sale",
      eyebrow: "Seasonal sale",
      title: "Seasonal campaign"
    },
    {
      body: "Collection launch strip for new drops and editorial merchandising.",
      ctaText: "Explore new",
      eyebrow: "New collection",
      title: "New collection launch"
    }
  ];
}

export function defaultConversionBlocks(): ConversionBlockItem[] {
  return [
    {
      body: "Clear shopping paths, real product data, and checkout-ready actions help customers move with confidence.",
      icon: BadgeCheck,
      title: "Why choose us"
    },
    {
      body: "Reusable benefit blocks can highlight delivery, service, quality, guarantees, and store-specific value.",
      icon: Gift,
      title: "Customer benefits"
    },
    {
      body: "Premium shopping advantages are available to every storefront template without custom store logic.",
      icon: ShoppingBag,
      title: "Shopping advantages"
    }
  ];
}

export function MarketingTrustBadges({ badges = defaultMarketingTrustBadges() }: { badges?: MarketingTrustBadge[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {badges.map((badge) => {
        const Icon = badge.icon;

        return (
          <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm" key={badge.title}>
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white">
              <Icon className="h-5 w-5" />
            </div>
            <h3 className="text-base font-black text-ink">{badge.title}</h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-muted">{badge.body}</p>
          </div>
        );
      })}
    </div>
  );
}

export function PromotionStrips({
  ctaHref = "#products",
  items = defaultPromotionStrips(),
  theme
}: {
  ctaHref?: string;
  items?: PromotionStripItem[];
  theme: MarketingTheme;
}) {
  return (
    <div className="grid gap-3 lg:grid-cols-4">
      {items.slice(0, 4).map((item, index) => (
        <a
          className="group overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
          href={item.ctaHref || ctaHref}
          key={`${item.eyebrow}-${index}`}
        >
          <div
            className="rounded-[1.25rem] p-4 text-white"
            style={{
              background: `linear-gradient(135deg, ${index % 2 === 0 ? theme.primary : theme.secondary}, ${index === 2 ? theme.accent : theme.secondary})`
            }}
          >
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/70">{item.eyebrow}</p>
            <h3 className="mt-2 text-lg font-black tracking-[-0.03em]">{item.title}</h3>
            <p className="mt-2 text-xs font-semibold leading-5 text-white/75">{item.body}</p>
          </div>
          <span className="mt-3 inline-flex text-[10px] font-black uppercase tracking-[0.16em] text-slate-600 transition group-hover:text-slate-950">
            {item.ctaText || "Shop now"}
          </span>
        </a>
      ))}
    </div>
  );
}

export function AnnouncementBarRuntime({
  ctaHref,
  ctaText,
  message,
  theme,
  title
}: {
  ctaHref?: string;
  ctaText?: string;
  message: string;
  theme: MarketingTheme;
  title?: string;
}) {
  if (!message && !title) {
    return null;
  }

  return (
    <div className="border-b border-white/15 px-4 py-3 text-white" style={{ backgroundColor: theme.primary }}>
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-3 text-center">
        {title ? <p className="text-xs font-black uppercase tracking-[0.18em] text-white/70">{title}</p> : null}
        {message ? <p className="text-sm font-semibold">{message}</p> : null}
        {ctaHref && ctaText ? (
          <a className="rounded-full bg-white px-4 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-slate-950" href={ctaHref}>
            {ctaText}
          </a>
        ) : null}
      </div>
    </div>
  );
}

export function NewsletterSignupBlock({
  body,
  buttonText = "Subscribe",
  eyebrow = "Newsletter",
  title,
  theme
}: {
  body: string;
  buttonText?: string;
  eyebrow?: string;
  title: string;
  theme: MarketingTheme;
}) {
  return (
    <div
      className="grid gap-6 rounded-[2.5rem] p-8 text-white lg:grid-cols-[minmax(0,1fr)_420px] lg:items-center"
      style={{
        background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})`
      }}
    >
      <div>
        <p className="text-xs font-black uppercase tracking-[0.22em] text-white/60">{eyebrow}</p>
        <h2 className="mt-3 text-4xl font-black tracking-[-0.05em]">{title}</h2>
        <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-white/70">{body}</p>
      </div>
      <form className="flex overflow-hidden rounded-full border border-white/15 bg-white text-slate-950">
        <input className="min-h-12 flex-1 px-5 text-sm font-semibold outline-none" placeholder="Email address" type="email" />
        <button className="px-6 text-xs font-black uppercase tracking-[0.16em] text-white" style={{ backgroundColor: theme.accent }} type="button">
          {buttonText}
        </button>
      </form>
    </div>
  );
}

export function ConversionBlocks({
  items = defaultConversionBlocks()
}: {
  items?: ConversionBlockItem[];
}) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {items.slice(0, 3).map((item) => {
        const Icon = item.icon;

        return (
          <article className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm" key={item.title}>
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white">
              <Icon className="h-5 w-5" />
            </div>
            <h3 className="text-xl font-black tracking-[-0.03em] text-ink">{item.title}</h3>
            <p className="mt-3 text-sm font-semibold leading-6 text-muted">{item.body}</p>
          </article>
        );
      })}
    </div>
  );
}

function isBestSeller(product: PublicStorefrontProduct) {
  const status = product.inventoryStatus?.toLowerCase().replace(/[\s-]+/g, "_");
  return status === "best_seller" || status === "bestseller" || product.salesCount >= 10;
}

export function ProductSocialProof({
  className = "",
  product,
  summary
}: {
  className?: string;
  product: PublicStorefrontProduct;
  summary: ProductRatingSummaryValue | null;
}) {
  const averageRating = summary?.averageRating ?? 0;
  const reviewCount = summary?.reviewCount ?? 0;
  const hasRating = averageRating > 0 && reviewCount > 0;
  const bestseller = isBestSeller(product);

  if (!hasRating && !bestseller) {
    return null;
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 text-xs font-black ${className}`}>
      {hasRating ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-amber-700">
          <Star className="h-3.5 w-3.5 fill-current" />
          {averageRating.toFixed(1)} rating
          <span className="text-amber-700/70">({reviewCount} {reviewCount === 1 ? "review" : "reviews"})</span>
        </span>
      ) : null}
      {bestseller ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-blue-700">
          <Award className="h-3.5 w-3.5" />
          Bestseller
        </span>
      ) : null}
    </div>
  );
}
