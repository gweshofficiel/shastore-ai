import type { StoreFooterLinkSettings } from "@/lib/store-footer-links";
import type { StoreHomepageSectionType } from "@/lib/store-homepage-sections";
import type { StoreMarketingMessageType } from "@/lib/store-marketing-messages";

export type TemplatePackageStatus = "failed" | "installed" | "partially_installed";

export type TemplatePackageCategory = {
  accentColor?: string;
  cardStyle?: "icon-led" | "image-led" | "standard";
  description?: string;
  imageUrl?: string | null;
  key: string;
  name: string;
  sortOrder?: number;
  status?: "active" | "inactive";
  visual?: Record<string, unknown>;
};

export type TemplatePackageProduct = {
  categoryKey?: string;
  compareAtPrice?: string | null;
  currency?: string;
  description?: string;
  imageUrl?: string | null;
  key: string;
  name: string;
  price: string;
  productType?: "digital" | "physical" | "service";
  slug?: string;
  status?: "active" | "archived" | "draft" | "published";
  stockQuantity?: number;
  trackInventory?: boolean;
};

export type TemplatePackageVariant = {
  color?: string | null;
  key: string;
  material?: string | null;
  name: string;
  priceOverride?: string | null;
  productKey: string;
  size?: string | null;
  sku?: string | null;
  status?: "active" | "inactive";
  stockQuantity?: number;
};

export type TemplatePackageReview = {
  comment: string;
  customerName: string;
  productKey: string;
  rating: number;
  title?: string | null;
};

export type TemplatePackageFaq = {
  answer: string;
  question: string;
  sortOrder?: number;
  status?: "draft" | "published";
};

export type TemplatePackageBlogArticle = {
  content: string;
  excerpt?: string | null;
  slug: string;
  status?: "draft" | "published";
  title: string;
};

export type TemplatePackagePage = {
  content: string;
  pageType: "about" | "contact" | "custom" | "faq" | "privacy" | "returns" | "shipping" | "terms";
  slug: string;
  status?: "archived" | "draft" | "published";
  title: string;
};

export type TemplatePackageHomepageSection = {
  enabled?: boolean;
  sectionType: StoreHomepageSectionType;
  settings?: Record<string, unknown>;
  sortOrder: number;
  subtitle?: string | null;
  title?: string | null;
};

export type TemplatePackageMarketingBlock = {
  buttonLink?: string | null;
  buttonText?: string | null;
  message: string;
  messageType: StoreMarketingMessageType;
  status?: "active" | "disabled" | "draft";
  title: string;
};

export type TemplatePackageNavigationLink = {
  customUrl?: string | null;
  isEnabled?: boolean;
  label: string;
  linkType?: "category" | "custom" | "home" | "page" | "product";
  location?: "footer" | "header";
  sortOrder: number;
};

export type TemplatePackageAboutPage = {
  companyStory?: string | null;
  founderMessage?: string | null;
  mission?: string | null;
  status?: "draft" | "published";
  subtitle?: string | null;
  title: string;
  vision?: string | null;
};

export type TemplatePackage = {
  aboutPage?: TemplatePackageAboutPage;
  blogArticles?: TemplatePackageBlogArticle[];
  categories?: TemplatePackageCategory[];
  faq?: TemplatePackageFaq[];
  footerLinkSettings?: Partial<StoreFooterLinkSettings>;
  homepageSections?: TemplatePackageHomepageSection[];
  id: string;
  legalPages?: TemplatePackagePage[];
  marketingBlocks?: TemplatePackageMarketingBlock[];
  name: string;
  navigationLinks?: TemplatePackageNavigationLink[];
  pages?: TemplatePackagePage[];
  products?: TemplatePackageProduct[];
  reviews?: TemplatePackageReview[];
  templateIds: string[];
  variants?: TemplatePackageVariant[];
  version: number;
  visualSlots?: Record<string, unknown>;
};

export type TemplatePackageInstallationRecord = {
  completedAt: string | null;
  packageId: string;
  packageVersion: number;
  startedAt: string;
  status: TemplatePackageStatus;
  steps: Array<{
    count?: number;
    error?: string;
    name: string;
    status: "failed" | "skipped" | "success";
  }>;
  templateId: string;
};

const flagshipPremiumPackage: TemplatePackage = {
  aboutPage: {
    companyStory:
      "SHASTORE Flagship Premium is a reference storefront package for premium commerce experiences powered by real catalog, checkout, content, and marketing systems.",
    mission: "Give every store a polished premium foundation without replacing the store's existing commerce systems.",
    status: "published",
    subtitle: "A premium SHASTORE storefront foundation for real sellers.",
    title: "About this store",
    vision: "Future premium storefronts inherit shared runtime sections, visual slots, and conversion foundations automatically."
  },
  blogArticles: [
    {
      content:
        "<p>Use this premium storefront foundation to organize catalog stories, campaign messaging, and customer education without changing checkout or order systems.</p>",
      excerpt: "A short guide to using the premium storefront foundation.",
      slug: "premium-storefront-foundation",
      status: "published",
      title: "Premium storefront foundation"
    },
    {
      content:
        "<p>Merchandising sections, trust blocks, promotional strips, and content pages can be tuned for each brand while staying inside the shared SHASTORE runtime.</p>",
      excerpt: "How shared template systems support future campaigns.",
      slug: "shared-template-merchandising",
      status: "published",
      title: "Shared template merchandising"
    }
  ],
  categories: [
    { cardStyle: "icon-led", description: "Premium accessories, gifts, and curated products.", key: "jewelry", name: "Jewelry", sortOrder: 10 },
    { cardStyle: "icon-led", description: "Timepieces and watch-ready merchandising.", key: "watches", name: "Watches", sortOrder: 20 },
    { cardStyle: "icon-led", description: "Beauty, fragrance, and self-care collections.", key: "beauty", name: "Beauty", sortOrder: 30 },
    { cardStyle: "icon-led", description: "Fashion, bags, and editorial collection slots.", key: "fashion", name: "Fashion", sortOrder: 40 }
  ],
  faq: [
    {
      answer: "The template package installs shared homepage, content, marketing, and visual-slot foundations while preserving existing commerce systems.",
      question: "What does this premium package install?",
      sortOrder: 10,
      status: "published"
    },
    {
      answer: "No. Products, checkout, cart, wishlist, compare, inventory, reviews, blog, FAQ, and legal systems remain on the existing shared runtime.",
      question: "Does this replace my commerce systems?",
      sortOrder: 20,
      status: "published"
    },
    {
      answer: "Yes. Future templates can use the same package installer and provide their own package registry entry.",
      question: "Can future templates reuse this installer?",
      sortOrder: 30,
      status: "published"
    }
  ],
  footerLinkSettings: {
    blog: true,
    categories: true,
    contact: true,
    faq: true,
    privacy: true,
    products: true,
    refund: true,
    shipping: true,
    terms: true
  },
  homepageSections: [
    {
      enabled: true,
      sectionType: "announcement_bar",
      settings: { message: "Premium storefront package installed", title: "Launch ready" },
      sortOrder: 5,
      subtitle: "Shared announcement runtime for campaigns and top-of-store messages.",
      title: "Launch ready"
    },
    {
      enabled: true,
      sectionType: "hero",
      settings: {
        visual: {
          asset: { promptKey: "flagship-premium-hero", source: "ai-ready" },
          ctaLink: "#products",
          ctaText: "Shop now"
        }
      },
      sortOrder: 10,
      subtitle: "Premium storefront structure powered by shared runtime systems.",
      title: "Premium commerce, powered by your real catalog"
    },
    {
      enabled: true,
      sectionType: "promotion_strips",
      sortOrder: 20,
      subtitle: "Free shipping, flash sale, seasonal, and new collection strips.",
      title: "Current promotions"
    },
    {
      enabled: true,
      sectionType: "trust_badges",
      sortOrder: 30,
      subtitle: "Secure checkout, fast shipping, easy returns, and 24/7 support.",
      title: "Why shop here"
    },
    {
      enabled: true,
      sectionType: "featured_categories",
      settings: { categoryCardStyle: "icon-led" },
      sortOrder: 40,
      subtitle: "Premium category visual slots for future imagery.",
      title: "Shop by Categories"
    },
    {
      enabled: true,
      sectionType: "featured_products",
      sortOrder: 50,
      subtitle: "Shows real active products when the store catalog is ready.",
      title: "Featured Products"
    },
    {
      enabled: true,
      sectionType: "conversion_blocks",
      sortOrder: 90,
      subtitle: "Why Choose Us, Customer Benefits, and Shopping Advantages.",
      title: "Shopping advantages"
    },
    {
      enabled: true,
      sectionType: "newsletter",
      sortOrder: 120,
      subtitle: "Newsletter runtime foundation without external provider integration.",
      title: "Join the newsletter"
    }
  ],
  id: "flagship-premium-foundation",
  legalPages: [
    {
      content: "<p>Describe how this store collects, uses, and protects customer information.</p>",
      pageType: "privacy",
      slug: "privacy-policy",
      status: "published",
      title: "Privacy Policy"
    },
    {
      content: "<p>Describe the terms customers accept when browsing, ordering, and using this store.</p>",
      pageType: "terms",
      slug: "terms-of-service",
      status: "published",
      title: "Terms of Service"
    },
    {
      content: "<p>Describe return, refund, and exchange rules for this store.</p>",
      pageType: "returns",
      slug: "refund-policy",
      status: "published",
      title: "Refund Policy"
    },
    {
      content: "<p>Describe shipping regions, delivery timelines, pickup options, and fulfillment notes.</p>",
      pageType: "shipping",
      slug: "shipping-policy",
      status: "published",
      title: "Shipping Policy"
    }
  ],
  marketingBlocks: [
    {
      buttonLink: "#products",
      buttonText: "Shop now",
      message: "Premium storefront package ready for campaigns, promos, and conversion blocks.",
      messageType: "announcement_bar",
      status: "active",
      title: "Launch ready"
    },
    {
      buttonLink: "#products",
      buttonText: "Browse products",
      message: "Invite shoppers to subscribe once an email provider is connected.",
      messageType: "newsletter_popup",
      status: "draft",
      title: "Newsletter signup"
    }
  ],
  name: "SHASTORE Flagship Premium Foundation",
  navigationLinks: [
    { customUrl: "#products", label: "Products", linkType: "custom", location: "header", sortOrder: 10 },
    { customUrl: "#categories", label: "Categories", linkType: "custom", location: "header", sortOrder: 20 },
    { customUrl: "about", label: "About", linkType: "custom", location: "header", sortOrder: 30 },
    { customUrl: "blog", label: "Blog", linkType: "custom", location: "header", sortOrder: 40 },
    { customUrl: "faq", label: "FAQ", linkType: "custom", location: "header", sortOrder: 50 },
    { customUrl: "contact", label: "Contact", linkType: "custom", location: "header", sortOrder: 60 }
  ],
  pages: [
    {
      content: "<p>Contact this store for product questions, order support, and business inquiries.</p>",
      pageType: "contact",
      slug: "contact",
      status: "published",
      title: "Contact Us"
    }
  ],
  products: [],
  reviews: [],
  templateIds: ["shastore-flagship-premium"],
  variants: [],
  version: 1,
  visualSlots: {
    categoryCardStyle: "icon-led",
    hero: {
      asset: { promptKey: "flagship-premium-hero", source: "ai-ready" }
    }
  }
};

export const templatePackageRegistry: TemplatePackage[] = [flagshipPremiumPackage];

export function getTemplatePackageForTemplate(templateId: string) {
  return templatePackageRegistry.find((templatePackage) =>
    templatePackage.templateIds.includes(templateId)
  ) ?? null;
}
