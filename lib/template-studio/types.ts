export type TemplateCategoryKey =
  | "fashion"
  | "jewelry"
  | "electronics"
  | "beauty"
  | "food"
  | "furniture"
  | "fitness"
  | "kids"
  | "digital"
  | "marketplace";

export type TemplateKind = "physical" | "digital" | "marketplace";

export type DemoSection = {
  eyebrow: string;
  title: string;
  body: string;
};

export type DemoOffer = {
  title: string;
  description: string;
  code: string;
};

export type PhysicalDemoProduct = {
  type: "physical";
  name: string;
  price: string;
  category: string;
  shortDescription: string;
  imagePlaceholder: string;
  stockPlaceholder: string;
  featured: boolean;
};

export type DigitalDemoProduct = {
  type: "digital";
  name: string;
  price: string;
  category: string;
  shortDescription: string;
  downloadTypePlaceholder: string;
  fileDeliveryPlaceholder: string;
  licensePlaceholder: string;
  previewImagePlaceholder: string;
  featured: boolean;
};

export type MarketplaceDemoProduct = {
  type: "marketplace";
  name: string;
  price: string;
  category: string;
  shortDescription: string;
  vendorPlaceholder: string;
  commissionPlaceholder: string;
  imagePlaceholder: string;
  featured: boolean;
};

export type TemplateDemoProduct =
  | PhysicalDemoProduct
  | DigitalDemoProduct
  | MarketplaceDemoProduct;

export type TemplateSocialLinks = {
  instagram: string;
  tiktok: string;
  facebook: string;
};

export type TemplateCustomizationDefaults = {
  logo: string;
  banner: string;
  primaryColor: string;
  secondaryColor: string;
  heroTitle: string;
  heroSubtitle: string;
  ctaText: string;
  footerText: string;
  contactInfo: string;
  socialLinks: TemplateSocialLinks;
  seoTitle: string;
  seoDescription: string;
};

export type StoreTemplateCategory = {
  key: TemplateCategoryKey;
  name: string;
  description: string;
  lockedCategoryMapping: TemplateCategoryKey;
};

export type StoreTemplate = {
  id: string;
  name: string;
  categoryKey: TemplateCategoryKey;
  categoryName: string;
  kind: TemplateKind;
  description: string;
  previewGradient: string;
  demoCategories: string[];
  demoProducts: TemplateDemoProduct[];
  demoSections: DemoSection[];
  demoOffers: DemoOffer[];
  homepageText: {
    eyebrow: string;
    headline: string;
    subheadline: string;
  };
  featuredSellers?: string[];
  defaultCustomization: TemplateCustomizationDefaults;
  allowedPublishTargets: Array<"seller_store" | "reseller_showcase" | "marketplace_listing">;
  protection: {
    lockedCategory: TemplateCategoryKey;
    validationPlaceholder: string;
    wrongCategoryPublishPlaceholder: string;
  };
};
