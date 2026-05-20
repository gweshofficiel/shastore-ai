export type AiLandingCopy = {
  productTitle: string;
  headline: string;
  subheadline: string;
  description: string;
  productCopy?: string;
  seoTitle: string;
  seoDescription: string;
  benefits: string[];
  features: Array<{
    title: string;
    description: string;
  }>;
  testimonials: Array<{
    quote: string;
    author: string;
  }>;
  pricing: {
    label: string;
    price: string;
    note: string;
  };
  sections: Array<{
    eyebrow: string;
    title: string;
    body: string;
  }>;
  ctaText: string;
  ctaBlock: {
    title: string;
    body: string;
  };
  faq: Array<{
    question: string;
    answer: string;
  }>;
  themeSettings?: LandingThemeSettings;
  paymentMethods?: PaymentMethod[];
  comparePrice?: string;
  galleryImages?: string[];
};

export type ProductInput = {
  productName: string;
  productPrice: string;
  comparePrice?: string;
  shortDescription?: string;
  longDescription?: string;
  productDescription: string;
  ctaText?: string;
  whatsappNumber: string;
  brandColor: string;
  heroImage?: string;
  galleryImages?: string[];
};

export type PaymentMethod = "whatsapp" | "cod" | "stripe" | "paypal";

export type LandingThemeSettings = {
  primaryColor: string;
  secondaryColor: string;
  logoUrl: string;
  heroTitle: string;
  ctaText: string;
  footerText: string;
  announcementText: string;
};

export type LandingTemplate = {
  id: string;
  name: string;
  description: string;
  category: string;
  previewImage: string;
  colorPalette: string[];
  mobileOptimized: boolean;
  conversionOptimized: boolean;
  recommendedNiches: string[];
  placeholders: string[];
};

export type TemplateId =
  | "minimal"
  | "luxury"
  | "beauty"
  | "gadget"
  | "fashion"
  | "saas"
  | "local-business";

export type PublishedLanding = ProductInput & {
  id: string;
  templateId: TemplateId;
  slug: string;
  copy: AiLandingCopy;
  paymentMethods?: PaymentMethod[];
  themeSettings?: LandingThemeSettings;
};

export type PlaceholderValues = Record<
  | "{{product_name}}"
  | "{{product_price}}"
  | "{{product_description}}"
  | "{{whatsapp_number}}"
  | "{{hero_image}}"
  | "{{headline}}"
  | "{{benefits}}"
  | "{{cta_text}}",
  string
>;

export type DomainStatus = "pending" | "verified" | "failed";
export type PublicationStatus = "draft" | "published" | "unpublished";
