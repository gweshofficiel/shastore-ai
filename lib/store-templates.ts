export const storeTemplates = [
  "Luxury Dark",
  "Minimal Clean",
  "Beauty Glow",
  "Arabic Premium",
  "Marketplace Grid",
  "Gadget Neon",
  "Fashion Editorial",
  "TikTok Product",
  "Modern Gradient",
  "Scandinavian Light"
] as const;

export type StoreTemplateName = (typeof storeTemplates)[number];

export function storeTemplateId(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
}

export const defaultStoreTemplateId = "luxury-dark";

export const storeTemplateDescriptions: Record<string, string> = {
  "luxury-dark": "Dark luxury storefront with concierge-style product presentation.",
  "minimal-clean": "Precise clean commerce with calm spacing and focused cards.",
  "beauty-glow": "Soft polished beauty storefront with warm glowing sections.",
  "arabic-premium": "Elegant RTL-ready premium storefront direction.",
  "marketplace-grid": "Grid-first catalog for multi-category shopping.",
  "gadget-neon": "Neon-accented launch storefront for modern tech products.",
  "fashion-editorial": "Magazine-style fashion storefront with editorial rhythm.",
  "tiktok-product": "Fast social-commerce layout for viral products.",
  "modern-gradient": "Cinematic gradient commerce with glassmorphism sections.",
  "scandinavian-light": "Minimal airy catalog with calm product presentation.",
  "minimal-luxury": "Legacy alias for Luxury Dark.",
  "fashion-modern": "Legacy alias for Fashion Editorial.",
  "electronics-dark": "Legacy alias for Gadget Neon.",
  "premium-brand": "Legacy alias for Modern Gradient.",
  "clean-scandinavian": "Legacy alias for Scandinavian Light.",
  "arabic-luxury": "Legacy alias for Arabic Premium.",
  "tiktok-product-store": "Legacy alias for TikTok Product."
};
