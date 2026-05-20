export type StorefrontCategory = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
};

export type StorefrontProduct = {
  id: string;
  categoryId: string | null;
  name: string;
  description: string | null;
  price: string | null;
  imageUrl: string | null;
};

export type StorefrontData = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logoImageUrl: string | null;
  brandColor: string;
  currency: string;
  whatsappNumber: string | null;
  templateId: string;
  publication: StorePublication;
  themeSettings: StoreThemeSettings;
  categories: StorefrontCategory[];
  products: StorefrontProduct[];
};

export type StorePublication = {
  slug: string;
  status: "draft" | "published" | "unpublished";
  visibility: "public" | "private";
  url: string;
  publishedAt: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  faviconUrl: string | null;
  socialImageUrl: string | null;
  customDomain: string | null;
  subdomain: string | null;
  hostname: string | null;
};

export type StoreThemeSettings = {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  gradientFrom: string;
  gradientTo: string;
  buttonStyle: "pill" | "rounded" | "sharp";
  headingFont: "inter" | "serif" | "display" | "mono";
  bodyFont: "inter" | "serif" | "display" | "mono";
  fontScale: "compact" | "comfortable" | "large";
  logoUrl: string;
  navigationStyle: "centered" | "split" | "minimal";
  stickyHeader: boolean;
  announcementText: string;
  heroTitle: string;
  heroSubtitle: string;
  heroBackground: "gradient" | "solid" | "image" | "glass";
  ctaText: string;
  ctaStyle: "filled" | "outline" | "glass";
  footerStyle: "minimal" | "bold" | "glass";
  footerBackgroundColor: string;
  footerTextColor: string;
  copyrightText: string;
  instagramUrl: string;
  tiktokUrl: string;
  facebookUrl: string;
};

export type StoreTemplateTheme = {
  page: string;
  header: string;
  hero: string;
  surface: string;
  mutedSurface: string;
  heading: string;
  text: string;
  muted: string;
  accent: string;
  button: string;
  productCard: string;
  rtl?: boolean;
};
