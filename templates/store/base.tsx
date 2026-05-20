import {
  StoreCategories,
  StoreCtaBanner,
  StoreFooter,
  StoreHeader,
  StoreHero,
  StoreProductGrid,
  StoreTestimonials
} from "@/templates/store/sections";
import type { StorefrontData, StoreTemplateTheme } from "@/types/storefront";

export const storeThemes = {
  "minimal-luxury": {
    page: "bg-white text-slate-950",
    header: "border-slate-200 bg-white/90",
    hero: "bg-white",
    surface: "border border-slate-200 bg-white shadow-sm",
    mutedSurface: "bg-slate-50",
    heading: "text-slate-950",
    text: "text-slate-700",
    muted: "text-slate-500",
    accent: "bg-slate-950",
    button: "bg-slate-950 text-white",
    productCard: "border border-slate-200 bg-white shadow-sm"
  },
  "fashion-modern": {
    page: "bg-[#fbfaf7] text-zinc-950",
    header: "border-zinc-200 bg-[#fbfaf7]/90",
    hero: "bg-[#fbfaf7]",
    surface: "border border-zinc-200 bg-white shadow-xl shadow-zinc-200/50",
    mutedSurface: "bg-zinc-100",
    heading: "text-zinc-950",
    text: "text-zinc-700",
    muted: "text-zinc-500",
    accent: "bg-zinc-950",
    button: "bg-zinc-950 text-white",
    productCard: "border border-zinc-200 bg-white shadow-sm"
  },
  "electronics-dark": {
    page: "bg-slate-950 text-white",
    header: "border-white/10 bg-slate-950/90",
    hero: "bg-slate-950",
    surface: "border border-white/10 bg-white/5 shadow-2xl shadow-black/30",
    mutedSurface: "bg-white/10",
    heading: "text-white",
    text: "text-slate-300",
    muted: "text-slate-400",
    accent: "bg-cyan-400",
    button: "bg-white text-slate-950",
    productCard: "border border-white/10 bg-white/5"
  },
  "beauty-glow": {
    page: "bg-[#fff8fb] text-slate-950",
    header: "border-rose-100 bg-[#fff8fb]/90",
    hero: "bg-[#fff8fb]",
    surface: "border border-rose-100 bg-white shadow-2xl shadow-rose-100",
    mutedSurface: "bg-rose-50",
    heading: "text-slate-950",
    text: "text-slate-700",
    muted: "text-rose-500",
    accent: "bg-rose-200",
    button: "bg-rose-500 text-white",
    productCard: "border border-rose-100 bg-white shadow-sm"
  },
  "marketplace-grid": {
    page: "bg-slate-50 text-slate-950",
    header: "border-slate-200 bg-slate-50/90",
    hero: "bg-slate-50",
    surface: "border border-slate-200 bg-white shadow-sm",
    mutedSurface: "bg-slate-100",
    heading: "text-slate-950",
    text: "text-slate-700",
    muted: "text-slate-500",
    accent: "bg-blue-600",
    button: "bg-blue-600 text-white",
    productCard: "border border-slate-200 bg-white shadow-sm"
  },
  "premium-brand": {
    page: "bg-[#f7f1e8] text-stone-950",
    header: "border-stone-200 bg-[#f7f1e8]/90",
    hero: "bg-[#f7f1e8]",
    surface: "border border-stone-200 bg-white shadow-2xl shadow-stone-200",
    mutedSurface: "bg-stone-100",
    heading: "text-stone-950",
    text: "text-stone-700",
    muted: "text-stone-500",
    accent: "bg-stone-950",
    button: "bg-stone-950 text-white",
    productCard: "border border-stone-200 bg-white"
  },
  "gadget-neon": {
    page: "bg-[#060712] text-white",
    header: "border-fuchsia-400/20 bg-[#060712]/90",
    hero: "bg-[radial-gradient(circle_at_top,#2e1065,#060712_55%)]",
    surface: "border border-fuchsia-400/20 bg-white/5 shadow-2xl shadow-fuchsia-950/40",
    mutedSurface: "bg-fuchsia-400/10",
    heading: "text-white",
    text: "text-fuchsia-100",
    muted: "text-fuchsia-200",
    accent: "bg-fuchsia-400",
    button: "bg-fuchsia-400 text-slate-950",
    productCard: "border border-fuchsia-400/20 bg-white/5"
  },
  "clean-scandinavian": {
    page: "bg-[#f9faf7] text-slate-950",
    header: "border-slate-200 bg-[#f9faf7]/90",
    hero: "bg-[#f9faf7]",
    surface: "border border-slate-200 bg-white shadow-sm",
    mutedSurface: "bg-[#eef1ec]",
    heading: "text-slate-950",
    text: "text-slate-700",
    muted: "text-slate-500",
    accent: "bg-emerald-700",
    button: "bg-emerald-700 text-white",
    productCard: "border border-slate-200 bg-white"
  },
  "arabic-luxury": {
    page: "bg-[#0f0d0a] text-white",
    header: "border-amber-300/20 bg-[#0f0d0a]/90",
    hero: "bg-[#0f0d0a]",
    surface: "border border-amber-300/20 bg-white/5 shadow-2xl shadow-black/40",
    mutedSurface: "bg-amber-300/10",
    heading: "text-white",
    text: "text-amber-50",
    muted: "text-amber-200",
    accent: "bg-amber-300",
    button: "bg-amber-300 text-stone-950",
    productCard: "border border-amber-300/20 bg-white/5",
    rtl: true
  },
  "tiktok-product-store": {
    page: "bg-white text-slate-950",
    header: "border-slate-200 bg-white/90",
    hero: "bg-[linear-gradient(135deg,#fff,#f0f9ff,#fdf2f8)]",
    surface: "border border-slate-200 bg-white shadow-2xl shadow-slate-200",
    mutedSurface: "bg-slate-50",
    heading: "text-slate-950",
    text: "text-slate-700",
    muted: "text-slate-500",
    accent: "bg-pink-500",
    button: "bg-slate-950 text-white",
    productCard: "border border-slate-200 bg-white shadow-sm"
  }
} satisfies Record<string, StoreTemplateTheme>;

export function BaseStoreTemplate({
  store,
  theme
}: {
  store: StorefrontData;
  theme: StoreTemplateTheme;
}) {
  return (
    <main className={`min-h-screen ${theme.page}`} dir={theme.rtl ? "rtl" : "ltr"}>
      <StoreHeader store={store} theme={theme} />
      <StoreHero store={store} theme={theme} />
      <StoreCategories store={store} theme={theme} />
      <StoreProductGrid store={store} theme={theme} />
      <StoreTestimonials theme={theme} />
      <StoreCtaBanner store={store} theme={theme} />
      <StoreFooter store={store} theme={theme} />
    </main>
  );
}
