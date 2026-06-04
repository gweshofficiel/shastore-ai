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
  salesCount?: number;
  slug?: string;
  status?: "active" | "archived" | "draft" | "published";
  stockQuantity?: number;
  trackInventory?: boolean;
};

export type TemplatePackageCollection = {
  body?: string;
  categoryKeys?: string[];
  key: string;
  title: string;
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
  collections?: TemplatePackageCollection[];
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
    { cardStyle: "icon-led", description: "Fashion, bags, and editorial collection slots.", key: "fashion", name: "Fashion", sortOrder: 40 },
    { cardStyle: "icon-led", description: "Bags, wallets, sunglasses, and premium add-ons.", key: "accessories", name: "Accessories", sortOrder: 50 },
    { cardStyle: "icon-led", description: "Home, lifestyle, and giftable everyday upgrades.", key: "home-living", name: "Home & Living", sortOrder: 60 }
  ],
  collections: [
    {
      body: "A cross-category premium edit for first-time storefront shoppers.",
      categoryKeys: ["jewelry", "watches", "beauty", "fashion"],
      key: "flagship-editorial-edit",
      title: "Flagship Editorial Edit"
    },
    {
      body: "Gift-ready products and collection slots for seasonal campaigns.",
      categoryKeys: ["jewelry", "accessories", "home-living"],
      key: "premium-gift-edit",
      title: "Premium Gift Edit"
    }
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
      subtitle: "Shows active package products first, then real catalog additions as the store grows.",
      title: "Featured Products"
    },
    {
      enabled: true,
      sectionType: "featured_collection",
      settings: { collectionKey: "flagship-editorial-edit" },
      sortOrder: 60,
      subtitle: "A collection-ready editorial block for premium merchandising.",
      title: "Flagship Editorial Edit"
    },
    {
      enabled: true,
      sectionType: "best_sellers",
      sortOrder: 70,
      subtitle: "Package best sellers use deterministic sales signals for storefront social proof.",
      title: "Top Selling"
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
  name: "SHASTORE Flagship Premium",
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
  products: [
    {
      categoryKey: "jewelry",
      compareAtPrice: "189.00",
      currency: "USD",
      description: "Polished gold-tone necklace for premium gifting and everyday styling.",
      key: "gold-signature-necklace",
      name: "Gold Signature Necklace",
      price: "149.00",
      salesCount: 24,
      slug: "gold-signature-necklace",
      status: "active",
      stockQuantity: 18,
      trackInventory: true
    },
    {
      categoryKey: "watches",
      compareAtPrice: "289.00",
      currency: "USD",
      description: "Minimal premium watch with a refined case, comfortable strap, and gift-ready presentation.",
      key: "heritage-minimal-watch",
      name: "Heritage Minimal Watch",
      price: "239.00",
      salesCount: 18,
      slug: "heritage-minimal-watch",
      status: "active",
      stockQuantity: 12,
      trackInventory: true
    },
    {
      categoryKey: "beauty",
      compareAtPrice: "95.00",
      currency: "USD",
      description: "Curated fragrance discovery set for premium scent exploration and gifting.",
      key: "signature-fragrance-set",
      name: "Signature Fragrance Set",
      price: "79.00",
      salesCount: 15,
      slug: "signature-fragrance-set",
      status: "active",
      stockQuantity: 25,
      trackInventory: true
    },
    {
      categoryKey: "fashion",
      compareAtPrice: "165.00",
      currency: "USD",
      description: "Soft structured scarf with an editorial premium look for seasonal styling.",
      key: "editorial-silk-scarf",
      name: "Editorial Silk Scarf",
      price: "129.00",
      salesCount: 11,
      slug: "editorial-silk-scarf",
      status: "active",
      stockQuantity: 20,
      trackInventory: true
    },
    {
      categoryKey: "accessories",
      compareAtPrice: "145.00",
      currency: "USD",
      description: "Compact leather wallet designed for premium daily carry and gifting.",
      key: "compact-leather-wallet",
      name: "Compact Leather Wallet",
      price: "118.00",
      salesCount: 14,
      slug: "compact-leather-wallet",
      status: "active",
      stockQuantity: 16,
      trackInventory: true
    },
    {
      categoryKey: "home-living",
      compareAtPrice: "110.00",
      currency: "USD",
      description: "Premium candle and home scent set for lifestyle storefront merchandising.",
      key: "home-scent-ritual-set",
      name: "Home Scent Ritual Set",
      price: "88.00",
      salesCount: 9,
      slug: "home-scent-ritual-set",
      status: "active",
      stockQuantity: 22,
      trackInventory: true
    }
  ],
  reviews: [
    {
      comment: "The storefront made it easy to browse premium products and understand the offer quickly.",
      customerName: "Amina R.",
      productKey: "gold-signature-necklace",
      rating: 5,
      title: "Beautiful premium presentation"
    },
    {
      comment: "Clear categories, polished product cards, and trust sections made the store feel ready to shop.",
      customerName: "Karim B.",
      productKey: "heritage-minimal-watch",
      rating: 5,
      title: "Professional shopping experience"
    },
    {
      comment: "The package content gives a strong starting point without changing the real checkout flow.",
      customerName: "Sara M.",
      productKey: "signature-fragrance-set",
      rating: 4,
      title: "Strong launch foundation"
    }
  ],
  templateIds: ["shastore-flagship-premium"],
  variants: [
    { key: "gold-necklace-16", name: "16 inch", productKey: "gold-signature-necklace", size: "16 in", sku: "FLAG-NECK-16", stockQuantity: 8 },
    { key: "gold-necklace-18", name: "18 inch", productKey: "gold-signature-necklace", size: "18 in", sku: "FLAG-NECK-18", stockQuantity: 10 },
    { color: "Black", key: "watch-black-strap", name: "Black strap", productKey: "heritage-minimal-watch", sku: "FLAG-WATCH-BLK", stockQuantity: 6 },
    { key: "watch-brown", color: "Brown", name: "Brown strap", productKey: "heritage-minimal-watch", sku: "FLAG-WATCH-BRN", stockQuantity: 6 },
    { key: "scarf-warm", color: "Warm sand", name: "Warm sand", productKey: "editorial-silk-scarf", sku: "FLAG-SCARF-SAND", stockQuantity: 10 },
    { key: "scarf-midnight", color: "Midnight", name: "Midnight", productKey: "editorial-silk-scarf", sku: "FLAG-SCARF-MID", stockQuantity: 10 }
  ],
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
