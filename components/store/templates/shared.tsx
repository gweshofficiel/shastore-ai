import type { CSSProperties, ReactNode } from "react";
import {
  buttonRadiusClass,
  fontClass,
  fontScaleClass
} from "@/lib/store-theme";
import type {
  StorefrontCategory,
  StorefrontData,
  StorefrontProduct
} from "@/types/storefront";

export type StoreTemplateProps = {
  store: StorefrontData;
};

export type TemplateTone = "light" | "dark";

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function whatsappHref(number: string | null, text?: string) {
  const normalized = number?.replace(/\D/g, "");
  const message = text ? `?text=${encodeURIComponent(text)}` : "";

  return normalized ? `https://wa.me/${normalized}${message}` : "#contact";
}

export function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function getCategories(store: StorefrontData): StorefrontCategory[] {
  if (store.categories.length) {
    return store.categories;
  }

  return [
    {
      id: "featured",
      name: "Featured",
      description: "Curated products ready to order.",
      imageUrl: null
    }
  ];
}

export function getProducts(store: StorefrontData): StorefrontProduct[] {
  if (store.products.length) {
    return store.products;
  }

  return [
    {
      id: "preview-product",
      categoryId: null,
      name: "Signature product",
      description: "Add products in the dashboard to fill this storefront.",
      price: store.currency,
      imageUrl: null
    }
  ];
}

export function getFeaturedProducts(store: StorefrontData, count = 4) {
  return getProducts(store).slice(0, count);
}

export function getHeroProduct(store: StorefrontData) {
  return getProducts(store)[0];
}

export function getCategoryName(store: StorefrontData, categoryId: string | null) {
  return store.categories.find((category) => category.id === categoryId)?.name ?? "Featured";
}

export function themeText(store: StorefrontData, fallback: string | null | undefined) {
  return store.themeSettings.heroSubtitle || fallback;
}

export function heroTitle(store: StorefrontData) {
  return store.themeSettings.heroTitle || store.name;
}

export function heroSubtitle(store: StorefrontData, fallback: string) {
  return store.themeSettings.heroSubtitle || store.description || fallback;
}

export function themeFontClasses(store: StorefrontData) {
  return cn(
    fontClass(store.themeSettings.bodyFont),
    fontScaleClass(store.themeSettings.fontScale)
  );
}

export function headingFontClass(store: StorefrontData) {
  return fontClass(store.themeSettings.headingFont);
}

function buttonStyle(store: StorefrontData): CSSProperties {
  const { accentColor, ctaStyle, primaryColor } = store.themeSettings;
  const borderRadius =
    store.themeSettings.buttonStyle === "sharp"
      ? "0.65rem"
      : store.themeSettings.buttonStyle === "rounded"
        ? "1rem"
        : "999px";

  if (ctaStyle === "outline") {
    return {
      backgroundColor: "transparent",
      borderColor: accentColor,
      borderWidth: 1,
      color: accentColor,
      borderRadius
    };
  }

  if (ctaStyle === "glass") {
    return {
      backgroundColor: `${primaryColor}cc`,
      borderColor: "rgba(255,255,255,0.28)",
      borderWidth: 1,
      color: "#ffffff",
      borderRadius
    };
  }

  return {
    backgroundColor: primaryColor,
    color: "#ffffff",
    borderRadius
  };
}

export function StoreLogo({
  store,
  className,
  imageClassName,
  textClassName = "text-white"
}: {
  store: StorefrontData;
  className: string;
  imageClassName?: string;
  textClassName?: string;
}) {
  const logoUrl = store.themeSettings.logoUrl || store.logoImageUrl;

  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        alt={store.name}
        className={imageClassName ?? cn(className, "object-cover")}
        src={logoUrl}
      />
    );
  }

  return (
    <div
      className={cn("flex items-center justify-center font-black", className, textClassName)}
      style={{ backgroundColor: store.themeSettings.primaryColor || store.brandColor }}
    >
      {getInitials(store.name)}
    </div>
  );
}

export function StoreImage({
  alt,
  className,
  fallbackClassName,
  label,
  src
}: {
  alt: string;
  className: string;
  fallbackClassName: string;
  label: string;
  src: string | null;
}) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img alt={alt} className={className} src={src} />
    );
  }

  return (
    <div className={cn("flex items-center justify-center text-center", fallbackClassName)}>
      <span className="px-4 text-xs font-black uppercase tracking-[0.22em] opacity-60">
        {label}
      </span>
    </div>
  );
}

export function WhatsAppButton({
  children,
  className,
  store,
  text
}: {
  children: ReactNode;
  className: string;
  store: StorefrontData;
  text?: string;
}) {
  return (
    <a
      className={cn(className, buttonRadiusClass(store.themeSettings.buttonStyle))}
      href={whatsappHref(store.whatsappNumber, text)}
      style={buttonStyle(store)}
    >
      {children}
    </a>
  );
}

export function StoreHeader({
  accentClassName,
  className,
  ctaClassName,
  logoClassName,
  store,
  textClassName = "text-slate-950"
}: {
  accentClassName?: string;
  className: string;
  ctaClassName: string;
  logoClassName: string;
  store: StorefrontData;
  textClassName?: string;
}) {
  return (
    <header
      className={cn(
        store.themeSettings.stickyHeader ? "sticky top-0" : "relative",
        "z-40 border-b backdrop-blur-2xl",
        className
      )}
    >
      {store.themeSettings.announcementText ? (
        <div
          className="px-4 py-2 text-center text-xs font-black uppercase tracking-[0.22em]"
          style={{
            backgroundColor: store.themeSettings.accentColor,
            color: "#ffffff"
          }}
        >
          {store.themeSettings.announcementText}
        </div>
      ) : null}
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <a className="flex min-w-0 items-center gap-3" href="#">
          <StoreLogo className={logoClassName} store={store} />
          <div className="min-w-0">
            <p
              className={cn(
                "truncate text-sm font-black tracking-tight",
                headingFontClass(store),
                textClassName
              )}
            >
              {store.name}
            </p>
            <p className={cn("text-[0.65rem] font-black uppercase tracking-[0.24em]", accentClassName)}>
              Premium store
            </p>
          </div>
        </a>
        <nav
          className={cn(
            "hidden items-center text-sm font-bold md:flex",
            store.themeSettings.navigationStyle === "minimal" && "sr-only",
            store.themeSettings.navigationStyle === "split" ? "gap-10" : "gap-7"
          )}
        >
          <a className="opacity-70 transition hover:opacity-100" href="#categories">
            Categories
          </a>
          <a className="opacity-70 transition hover:opacity-100" href="#products">
            Products
          </a>
          <a className="opacity-70 transition hover:opacity-100" href="#contact">
            Contact
          </a>
        </nav>
        <WhatsAppButton
          className={cn(
            "hidden h-11 items-center justify-center rounded-full px-5 text-xs font-black uppercase tracking-[0.12em] transition hover:-translate-y-0.5 md:inline-flex",
            ctaClassName
          )}
          store={store}
          text={`Hi, I want to order from ${store.name}`}
        >
          WhatsApp
        </WhatsAppButton>
      </div>
    </header>
  );
}

export function SectionIntro({
  eyebrow,
  title,
  description,
  align = "left",
  dark = false
}: {
  eyebrow: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  dark?: boolean;
}) {
  return (
    <div className={cn(align === "center" && "mx-auto max-w-3xl text-center")}>
      <p
        className={cn(
          "text-xs font-black uppercase tracking-[0.28em]",
          dark ? "text-white/50" : "text-slate-400"
        )}
      >
        {eyebrow}
      </p>
      <h2
        className={cn(
          "mt-3 text-3xl font-black tracking-[-0.045em] sm:text-5xl",
          dark ? "text-white" : "text-slate-950"
        )}
      >
        {title}
      </h2>
      {description ? (
        <p
          className={cn(
            "mt-4 text-sm leading-7 sm:text-base",
            dark ? "text-white/62" : "text-slate-600"
          )}
        >
          {description}
        </p>
      ) : null}
    </div>
  );
}

export function PriceTag({
  children,
  className
}: {
  children: ReactNode;
  className: string;
}) {
  return (
    <span className={cn("shrink-0 rounded-full px-3 py-1 text-xs font-black", className)}>
      {children}
    </span>
  );
}

export function StoreFooter({
  className,
  store
}: {
  className: string;
  store: StorefrontData;
}) {
  return (
    <footer
      className={cn("px-4 py-8 sm:px-6 lg:px-8", className)}
      style={{
        backgroundColor: store.themeSettings.footerBackgroundColor,
        color: store.themeSettings.footerTextColor
      }}
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-3 text-sm font-bold sm:flex-row sm:items-center sm:justify-between">
        <p>{store.name}</p>
        <div className="flex flex-wrap items-center gap-4 opacity-75">
          {store.themeSettings.instagramUrl ? (
            <a href={store.themeSettings.instagramUrl}>Instagram</a>
          ) : null}
          {store.themeSettings.tiktokUrl ? <a href={store.themeSettings.tiktokUrl}>TikTok</a> : null}
          {store.themeSettings.facebookUrl ? (
            <a href={store.themeSettings.facebookUrl}>Facebook</a>
          ) : null}
          <p>{store.themeSettings.copyrightText || "Powered by SHASTORE AI"}</p>
        </div>
      </div>
    </footer>
  );
}
