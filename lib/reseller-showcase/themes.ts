export type ResellerShowcaseThemeId = "minimal" | "modern" | "dark-premium" | "agency";

export type ResellerShowcaseTheme = {
  accentClass: string;
  cardClass: string;
  description: string;
  heroClass: string;
  id: ResellerShowcaseThemeId;
  name: string;
  previewClass: string;
  surfaceClass: string;
};

export const resellerShowcaseThemes: ResellerShowcaseTheme[] = [
  {
    accentClass: "text-slate-950",
    cardClass: "border-slate-200 bg-white text-slate-950",
    description: "Clean editorial layout for focused boutique showcases.",
    heroClass: "bg-white text-slate-950",
    id: "minimal",
    name: "Minimal",
    previewClass: "bg-gradient-to-br from-white to-slate-100",
    surfaceClass: "bg-slate-50"
  },
  {
    accentClass: "text-blue-700",
    cardClass: "border-blue-100 bg-white text-slate-950",
    description: "Bright marketplace presentation with bold product cards.",
    heroClass: "bg-gradient-to-br from-blue-600 via-indigo-600 to-slate-950 text-white",
    id: "modern",
    name: "Modern",
    previewClass: "bg-gradient-to-br from-blue-500 to-indigo-700",
    surfaceClass: "bg-blue-50"
  },
  {
    accentClass: "text-amber-300",
    cardClass: "border-white/10 bg-white/10 text-white",
    description: "Luxury dark storefront for premium reseller catalogs.",
    heroClass: "bg-gradient-to-br from-slate-950 via-zinc-950 to-amber-950 text-white",
    id: "dark-premium",
    name: "Dark Premium",
    previewClass: "bg-gradient-to-br from-slate-950 to-amber-900",
    surfaceClass: "bg-slate-950"
  },
  {
    accentClass: "text-fuchsia-700",
    cardClass: "border-fuchsia-100 bg-white text-slate-950",
    description: "Agency-style portfolio with strong brand positioning.",
    heroClass: "bg-gradient-to-br from-fuchsia-600 via-rose-500 to-orange-400 text-white",
    id: "agency",
    name: "Agency Style",
    previewClass: "bg-gradient-to-br from-fuchsia-500 to-orange-400",
    surfaceClass: "bg-rose-50"
  }
];

export function getResellerShowcaseTheme(themeId: string | null | undefined) {
  return resellerShowcaseThemes.find((theme) => theme.id === themeId) ?? resellerShowcaseThemes[0];
}
