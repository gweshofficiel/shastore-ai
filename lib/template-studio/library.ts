import type {
  StoreTemplate,
  StoreTemplateCategory,
  TemplateCategoryKey,
  TemplateKind
} from "@/lib/template-studio/types";

export const storeTemplateCategories: StoreTemplateCategory[] = [
  {
    key: "fashion",
    name: "Fashion Store",
    description: "Boutique apparel, seasonal drops, lookbooks, and featured outfits.",
    lockedCategoryMapping: "fashion"
  },
  {
    key: "jewelry",
    name: "Jewelry Store",
    description: "Fine jewelry, gift edits, premium collections, and trust-led buying.",
    lockedCategoryMapping: "jewelry"
  },
  {
    key: "electronics",
    name: "Electronics Store",
    description: "Gadgets, accessories, bundles, warranties, and technical product cards.",
    lockedCategoryMapping: "electronics"
  },
  {
    key: "beauty",
    name: "Beauty & Cosmetics Store",
    description: "Skincare, makeup, routine bundles, social proof, and ingredient callouts.",
    lockedCategoryMapping: "beauty"
  },
  {
    key: "food",
    name: "Restaurant / Food Store",
    description: "Menus, meal bundles, delivery offers, chef notes, and catering CTAs.",
    lockedCategoryMapping: "food"
  },
  {
    key: "furniture",
    name: "Furniture Store",
    description: "Room collections, materials, delivery notes, and interior design offers.",
    lockedCategoryMapping: "furniture"
  },
  {
    key: "fitness",
    name: "Fitness Store",
    description: "Equipment, supplements, training packs, transformations, and bundles.",
    lockedCategoryMapping: "fitness"
  },
  {
    key: "kids",
    name: "Kids / Baby Store",
    description: "Baby essentials, toys, safety notes, gifting, and age-based categories.",
    lockedCategoryMapping: "kids"
  },
  {
    key: "digital",
    name: "Digital Products Store",
    description: "Ebooks, courses, templates, prompt packs, previews, and license terms.",
    lockedCategoryMapping: "digital"
  },
  {
    key: "marketplace",
    name: "Multi-Category Marketplace",
    description: "Vendor shelves, marketplace offers, commissions, and featured sellers.",
    lockedCategoryMapping: "marketplace"
  }
];

const categoryNames = Object.fromEntries(
  storeTemplateCategories.map((category) => [category.key, category.name])
) as Record<TemplateCategoryKey, string>;

function templateProtection(categoryKey: TemplateCategoryKey) {
  return {
    lockedCategory: categoryKey,
    validationPlaceholder: `Validate that this template publishes only inside ${categoryNames[categoryKey]}.`,
    wrongCategoryPublishPlaceholder:
      "Publishing will block mismatched category assignments before marketplace or showcase listing creation."
  };
}

function templateBase({
  id,
  name,
  categoryKey,
  kind,
  description,
  previewGradient,
  heroTitle,
  heroSubtitle,
  ctaText,
  footerText,
  categories,
  products,
  sections,
  offers,
  featuredSellers
}: {
  id: string;
  name: string;
  categoryKey: TemplateCategoryKey;
  kind: TemplateKind;
  description: string;
  previewGradient: string;
  heroTitle: string;
  heroSubtitle: string;
  ctaText: string;
  footerText: string;
  categories: string[];
  products: StoreTemplate["demoProducts"];
  sections: StoreTemplate["demoSections"];
  offers: StoreTemplate["demoOffers"];
  featuredSellers?: string[];
}): StoreTemplate {
  return {
    id,
    name,
    categoryKey,
    categoryName: categoryNames[categoryKey],
    kind,
    description,
    previewGradient,
    demoCategories: categories,
    demoProducts: products,
    demoSections: sections,
    demoOffers: offers,
    homepageText: {
      eyebrow: categoryNames[categoryKey],
      headline: heroTitle,
      subheadline: heroSubtitle
    },
    featuredSellers,
    defaultCustomization: {
      logo: `${name} logo placeholder`,
      banner: `${name} editorial banner placeholder`,
      primaryColor: previewGradient.includes("#020617") ? "#020617" : "#111827",
      secondaryColor: previewGradient.match(/#[0-9a-fA-F]{6}/g)?.[1] ?? "#f8fafc",
      heroTitle,
      heroSubtitle,
      ctaText,
      footerText,
      contactInfo: "support@example-store.com | WhatsApp +971 50 000 0000",
      socialLinks: {
        instagram: "https://instagram.com/example-store",
        tiktok: "https://tiktok.com/@example-store",
        facebook: "https://facebook.com/example-store"
      },
      seoTitle: `${name} | Premium ready-made store template`,
      seoDescription: description
    },
    allowedPublishTargets: ["seller_store", "reseller_showcase", "marketplace_listing"],
    protection: templateProtection(categoryKey)
  };
}

export const storeTemplates: StoreTemplate[] = [
  templateBase({
    id: "fashion-atelier",
    name: "Fashion Atelier",
    categoryKey: "fashion",
    kind: "physical",
    description: "A premium boutique layout for curated outfits, seasonal edits, and apparel drops.",
    previewGradient: "linear-gradient(135deg,#fff7ed,#111827 58%,#f97316)",
    heroTitle: "Curated looks for every polished moment",
    heroSubtitle: "Launch a fashion storefront with editorial sections, featured outfits, and real product storytelling.",
    ctaText: "Shop the latest edit",
    footerText: "Fashion Atelier demo store. Replace with your brand promise, returns note, and support details.",
    categories: ["New Arrivals", "Dresses", "Outerwear", "Accessories"],
    products: [
      {
        type: "physical",
        name: "Linen Wrap Midi Dress",
        price: "$89",
        category: "Dresses",
        shortDescription: "Breathable linen blend with a flattering waist tie and soft neutral tone.",
        imagePlaceholder: "fashion-dress-placeholder.jpg",
        stockPlaceholder: "42 units available",
        featured: true
      },
      {
        type: "physical",
        name: "Cropped Tailored Blazer",
        price: "$124",
        category: "Outerwear",
        shortDescription: "Structured blazer for weekday looks and elevated evening styling.",
        imagePlaceholder: "fashion-blazer-placeholder.jpg",
        stockPlaceholder: "18 units available",
        featured: true
      },
      {
        type: "physical",
        name: "Satin Cloud Scarf",
        price: "$34",
        category: "Accessories",
        shortDescription: "Printed satin scarf designed for bags, hair, and lightweight layering.",
        imagePlaceholder: "fashion-scarf-placeholder.jpg",
        stockPlaceholder: "96 units available",
        featured: false
      }
    ],
    sections: [
      {
        eyebrow: "Lookbook",
        title: "Style the full outfit in one click",
        body: "Use demo sections for editorial image blocks, outfit bundles, and collection launches."
      },
      {
        eyebrow: "Service",
        title: "Clear sizing and exchange confidence",
        body: "Add fit guidance, delivery timelines, exchange terms, and WhatsApp styling support."
      }
    ],
    offers: [
      {
        title: "Launch Week Wardrobe",
        description: "Buy any two featured pieces and get the Satin Cloud Scarf at 40% off.",
        code: "STYLE40"
      }
    ]
  }),
  templateBase({
    id: "jewelry-luxe",
    name: "Jewelry Luxe",
    categoryKey: "jewelry",
    kind: "physical",
    description: "A trust-heavy jewelry storefront for rings, necklaces, gifting, and luxury collections.",
    previewGradient: "linear-gradient(135deg,#fef3c7,#78350f 56%,#fbbf24)",
    heroTitle: "Fine pieces made for everyday rituals",
    heroSubtitle: "Present jewelry with material notes, gifting offers, warranty placeholders, and premium product cards.",
    ctaText: "Explore the gift edit",
    footerText: "Jewelry Luxe demo store. Add certification notes, care instructions, and support contacts.",
    categories: ["Rings", "Necklaces", "Bracelets", "Gift Sets"],
    products: [
      {
        type: "physical",
        name: "Gold Vermeil Signet Ring",
        price: "$149",
        category: "Rings",
        shortDescription: "Polished vermeil ring with a soft oval face and keepsake-ready packaging.",
        imagePlaceholder: "jewelry-ring-placeholder.jpg",
        stockPlaceholder: "24 units available",
        featured: true
      },
      {
        type: "physical",
        name: "Pearl Drop Necklace",
        price: "$118",
        category: "Necklaces",
        shortDescription: "Freshwater pearl pendant on a delicate adjustable chain.",
        imagePlaceholder: "jewelry-necklace-placeholder.jpg",
        stockPlaceholder: "31 units available",
        featured: true
      },
      {
        type: "physical",
        name: "Stacked Gift Bracelet Set",
        price: "$96",
        category: "Gift Sets",
        shortDescription: "Three coordinated bracelets boxed for birthdays, bridesmaids, and Eid gifting.",
        imagePlaceholder: "jewelry-bracelet-placeholder.jpg",
        stockPlaceholder: "55 units available",
        featured: false
      }
    ],
    sections: [
      {
        eyebrow: "Materials",
        title: "Show quality before checkout",
        body: "Use placeholders for gold plating, gemstones, hypoallergenic notes, and care details."
      },
      {
        eyebrow: "Gifting",
        title: "Built for occasion-led shopping",
        body: "Feature gift wrapping, message cards, delivery dates, and best-seller edits."
      }
    ],
    offers: [
      {
        title: "Complimentary Gift Box",
        description: "Free premium packaging on all featured pieces during the launch campaign.",
        code: "GIFTBOX"
      }
    ]
  }),
  templateBase({
    id: "electronics-hub",
    name: "Electronics Hub",
    categoryKey: "electronics",
    kind: "physical",
    description: "A high-contrast electronics store for gadgets, smart accessories, and bundles.",
    previewGradient: "linear-gradient(135deg,#020617,#2563eb 55%,#67e8f9)",
    heroTitle: "Smart gear for faster everyday work",
    heroSubtitle: "Launch with spec-focused cards, accessory bundles, warranty notes, and featured tech offers.",
    ctaText: "Browse smart deals",
    footerText: "Electronics Hub demo store. Add warranty, compatibility, and support terms before publishing.",
    categories: ["Smart Devices", "Audio", "Chargers", "Workstation"],
    products: [
      {
        type: "physical",
        name: "MagSafe Desk Charger Pro",
        price: "$59",
        category: "Chargers",
        shortDescription: "Three-in-one magnetic charging dock for phone, earbuds, and watch.",
        imagePlaceholder: "electronics-charger-placeholder.jpg",
        stockPlaceholder: "75 units available",
        featured: true
      },
      {
        type: "physical",
        name: "Noise-Cancel Air Buds",
        price: "$129",
        category: "Audio",
        shortDescription: "Compact wireless earbuds with ANC, transparency mode, and travel case.",
        imagePlaceholder: "electronics-buds-placeholder.jpg",
        stockPlaceholder: "46 units available",
        featured: true
      },
      {
        type: "physical",
        name: "USB-C Creator Hub",
        price: "$84",
        category: "Workstation",
        shortDescription: "Seven-port aluminum hub with HDMI, card reader, and fast pass-through charging.",
        imagePlaceholder: "electronics-hub-placeholder.jpg",
        stockPlaceholder: "38 units available",
        featured: false
      }
    ],
    sections: [
      {
        eyebrow: "Specs",
        title: "Make comparisons simple",
        body: "Add compatibility badges, feature grids, warranty placeholders, and bundle comparisons."
      },
      {
        eyebrow: "Bundles",
        title: "Increase order value with kits",
        body: "Promote charging kits, creator setups, office bundles, and limited stock alerts."
      }
    ],
    offers: [
      {
        title: "Creator Setup Bundle",
        description: "Save 15% when buying a charger, hub, and earbuds together.",
        code: "CREATOR15"
      }
    ]
  }),
  templateBase({
    id: "beauty-glow-lab",
    name: "Beauty Glow Lab",
    categoryKey: "beauty",
    kind: "physical",
    description: "A soft, premium cosmetics template for routines, ingredient callouts, and bundles.",
    previewGradient: "linear-gradient(135deg,#fff1f2,#fb7185 54%,#7f1d1d)",
    heroTitle: "Daily glow routines customers can trust",
    heroSubtitle: "Show skincare collections with ingredient notes, before-and-after sections, and bundle offers.",
    ctaText: "Build your routine",
    footerText: "Beauty Glow Lab demo store. Replace with ingredient disclaimers and support information.",
    categories: ["Skincare", "Makeup", "Body Care", "Routine Bundles"],
    products: [
      {
        type: "physical",
        name: "Vitamin C Morning Serum",
        price: "$42",
        category: "Skincare",
        shortDescription: "Brightening serum with lightweight texture and daily antioxidant support.",
        imagePlaceholder: "beauty-serum-placeholder.jpg",
        stockPlaceholder: "88 units available",
        featured: true
      },
      {
        type: "physical",
        name: "Cloud Cream Moisturizer",
        price: "$36",
        category: "Skincare",
        shortDescription: "Barrier-friendly moisturizer with ceramides and a smooth satin finish.",
        imagePlaceholder: "beauty-cream-placeholder.jpg",
        stockPlaceholder: "64 units available",
        featured: true
      },
      {
        type: "physical",
        name: "Soft Rose Lip Tint",
        price: "$21",
        category: "Makeup",
        shortDescription: "Hydrating tint with buildable color for everyday wear.",
        imagePlaceholder: "beauty-lip-placeholder.jpg",
        stockPlaceholder: "120 units available",
        featured: false
      }
    ],
    sections: [
      {
        eyebrow: "Routine",
        title: "Guide shoppers by skin goal",
        body: "Use demo blocks for morning routines, evening routines, ingredients, and skin type notes."
      },
      {
        eyebrow: "Trust",
        title: "Bring reviews close to the products",
        body: "Add testimonials, dermatologist placeholders, FAQs, and patch-test reminders."
      }
    ],
    offers: [
      {
        title: "Glow Starter Kit",
        description: "Bundle serum, moisturizer, and lip tint for a launch-ready routine.",
        code: "GLOWKIT"
      }
    ]
  }),
  templateBase({
    id: "food-market",
    name: "Food Market",
    categoryKey: "food",
    kind: "physical",
    description: "A warm restaurant and food ordering template for menus, bundles, and local delivery.",
    previewGradient: "linear-gradient(135deg,#fff7ed,#ea580c 52%,#431407)",
    heroTitle: "Fresh meals, fast ordering, local flavor",
    heroSubtitle: "Publish a food storefront with menu cards, chef picks, delivery notes, and catering CTAs.",
    ctaText: "Order today's favorites",
    footerText: "Food Market demo store. Add delivery zones, allergen notes, and kitchen hours.",
    categories: ["Chef Specials", "Family Meals", "Desserts", "Drinks"],
    products: [
      {
        type: "physical",
        name: "Harissa Chicken Bowl",
        price: "$14",
        category: "Chef Specials",
        shortDescription: "Grilled chicken, saffron rice, crunchy salad, and smoky harissa sauce.",
        imagePlaceholder: "food-bowl-placeholder.jpg",
        stockPlaceholder: "Prepared fresh daily",
        featured: true
      },
      {
        type: "physical",
        name: "Family Mezze Box",
        price: "$39",
        category: "Family Meals",
        shortDescription: "Shareable dips, breads, grilled skewers, and seasonal sides for four.",
        imagePlaceholder: "food-mezze-placeholder.jpg",
        stockPlaceholder: "30 boxes per day",
        featured: true
      },
      {
        type: "physical",
        name: "Pistachio Milk Cake",
        price: "$8",
        category: "Desserts",
        shortDescription: "Soft sponge cake soaked in pistachio milk and topped with cream.",
        imagePlaceholder: "food-cake-placeholder.jpg",
        stockPlaceholder: "Limited daily batch",
        featured: false
      }
    ],
    sections: [
      {
        eyebrow: "Menu",
        title: "Highlight dishes with appetite-first cards",
        body: "Use placeholders for food photos, prep times, allergens, spice levels, and add-ons."
      },
      {
        eyebrow: "Catering",
        title: "Turn store traffic into event orders",
        body: "Promote family boxes, office lunches, catering forms, and WhatsApp ordering."
      }
    ],
    offers: [
      {
        title: "Lunch Rush Deal",
        description: "Free drink with any chef special ordered before 2 PM.",
        code: "LUNCHDRINK"
      }
    ]
  }),
  templateBase({
    id: "furniture-studio",
    name: "Furniture Studio",
    categoryKey: "furniture",
    kind: "physical",
    description: "A refined home store template for room collections, material notes, and delivery confidence.",
    previewGradient: "linear-gradient(135deg,#f5f5f4,#78716c 52%,#1c1917)",
    heroTitle: "Design calm rooms with statement pieces",
    heroSubtitle: "Show sofas, tables, lighting, and curated room sets with premium delivery placeholders.",
    ctaText: "Explore room collections",
    footerText: "Furniture Studio demo store. Add measurements, delivery areas, assembly terms, and returns.",
    categories: ["Living Room", "Dining", "Lighting", "Decor"],
    products: [
      {
        type: "physical",
        name: "Noura Boucle Lounge Chair",
        price: "$420",
        category: "Living Room",
        shortDescription: "Curved accent chair with textured boucle fabric and walnut legs.",
        imagePlaceholder: "furniture-chair-placeholder.jpg",
        stockPlaceholder: "12 units available",
        featured: true
      },
      {
        type: "physical",
        name: "Marble Nesting Tables",
        price: "$310",
        category: "Living Room",
        shortDescription: "Two-piece marble-look table set with brushed brass frames.",
        imagePlaceholder: "furniture-table-placeholder.jpg",
        stockPlaceholder: "20 units available",
        featured: true
      },
      {
        type: "physical",
        name: "Amber Dome Floor Lamp",
        price: "$185",
        category: "Lighting",
        shortDescription: "Warm floor lamp with arched metal stem and soft amber shade.",
        imagePlaceholder: "furniture-lamp-placeholder.jpg",
        stockPlaceholder: "17 units available",
        featured: false
      }
    ],
    sections: [
      {
        eyebrow: "Rooms",
        title: "Sell by space, not only by product",
        body: "Use room boards, material cards, dimensions, and delivery scheduling placeholders."
      },
      {
        eyebrow: "Confidence",
        title: "Make big-ticket purchases easier",
        body: "Add assembly options, care guides, fabric notes, and return policies."
      }
    ],
    offers: [
      {
        title: "Room Refresh",
        description: "Save $75 when buying any chair and table combination.",
        code: "ROOM75"
      }
    ]
  }),
  templateBase({
    id: "fitness-performance",
    name: "Fitness Performance",
    categoryKey: "fitness",
    kind: "physical",
    description: "An energetic template for workout gear, supplements, bundles, and training programs.",
    previewGradient: "linear-gradient(135deg,#ecfccb,#16a34a 52%,#052e16)",
    heroTitle: "Gear up for stronger training days",
    heroSubtitle: "Build a fitness storefront with performance products, stack bundles, and transformation CTAs.",
    ctaText: "Shop training essentials",
    footerText: "Fitness Performance demo store. Add safety notes, supplement disclaimers, and support channels.",
    categories: ["Equipment", "Supplements", "Recovery", "Training Kits"],
    products: [
      {
        type: "physical",
        name: "Adjustable Resistance Band Set",
        price: "$32",
        category: "Equipment",
        shortDescription: "Five-band kit with handles, door anchor, and travel pouch.",
        imagePlaceholder: "fitness-bands-placeholder.jpg",
        stockPlaceholder: "110 units available",
        featured: true
      },
      {
        type: "physical",
        name: "Plant Protein Vanilla",
        price: "$44",
        category: "Supplements",
        shortDescription: "Smooth vegan protein blend with 24g protein per serving.",
        imagePlaceholder: "fitness-protein-placeholder.jpg",
        stockPlaceholder: "58 units available",
        featured: true
      },
      {
        type: "physical",
        name: "Recovery Foam Roller",
        price: "$27",
        category: "Recovery",
        shortDescription: "Firm textured roller for warmups, cooldowns, and mobility work.",
        imagePlaceholder: "fitness-roller-placeholder.jpg",
        stockPlaceholder: "72 units available",
        featured: false
      }
    ],
    sections: [
      {
        eyebrow: "Performance",
        title: "Bundle by customer goal",
        body: "Use sections for strength, recovery, fat loss, mobility, and beginner training kits."
      },
      {
        eyebrow: "Education",
        title: "Explain how to use every product",
        body: "Add exercise cards, dosage placeholders, safety notes, and transformation stories."
      }
    ],
    offers: [
      {
        title: "Starter Stack",
        description: "Save 20% on bands, protein, and roller when purchased as one kit.",
        code: "STACK20"
      }
    ]
  }),
  templateBase({
    id: "baby-bloom",
    name: "Baby Bloom",
    categoryKey: "kids",
    kind: "physical",
    description: "A gentle kids and baby template for essentials, toys, gifts, and safety-led product pages.",
    previewGradient: "linear-gradient(135deg,#eff6ff,#f9a8d4 52%,#7c3aed)",
    heroTitle: "Soft essentials for little everyday moments",
    heroSubtitle: "Launch a baby store with age-based categories, gifting sections, and safety placeholders.",
    ctaText: "Shop baby favorites",
    footerText: "Baby Bloom demo store. Add safety certifications, age guidance, and parent support details.",
    categories: ["Newborn", "Toys", "Nursery", "Gift Bundles"],
    products: [
      {
        type: "physical",
        name: "Organic Cotton Swaddle Trio",
        price: "$38",
        category: "Newborn",
        shortDescription: "Three breathable muslin swaddles in soft neutral prints.",
        imagePlaceholder: "baby-swaddle-placeholder.jpg",
        stockPlaceholder: "82 units available",
        featured: true
      },
      {
        type: "physical",
        name: "Wooden Rainbow Stacker",
        price: "$29",
        category: "Toys",
        shortDescription: "Smooth wooden toy for color play, stacking, and nursery decor.",
        imagePlaceholder: "baby-toy-placeholder.jpg",
        stockPlaceholder: "60 units available",
        featured: true
      },
      {
        type: "physical",
        name: "Sleepy Moon Night Light",
        price: "$24",
        category: "Nursery",
        shortDescription: "Rechargeable dimmable night light with warm nursery glow.",
        imagePlaceholder: "baby-light-placeholder.jpg",
        stockPlaceholder: "45 units available",
        featured: false
      }
    ],
    sections: [
      {
        eyebrow: "Age Guide",
        title: "Help parents choose quickly",
        body: "Use age tags, safety notes, wash guidance, and gift bundle recommendations."
      },
      {
        eyebrow: "Gifting",
        title: "Create baby shower-ready bundles",
        body: "Add gift wrap placeholders, message notes, and curated newborn sets."
      }
    ],
    offers: [
      {
        title: "New Parent Bundle",
        description: "Save 15% on swaddles, night light, and one toy.",
        code: "BABY15"
      }
    ]
  }),
  templateBase({
    id: "digital-creator-kit",
    name: "Digital Creator Kit",
    categoryKey: "digital",
    kind: "digital",
    description: "A digital product storefront for ebooks, templates, prompt packs, and creator resources.",
    previewGradient: "linear-gradient(135deg,#eef2ff,#4f46e5 52%,#111827)",
    heroTitle: "Download-ready tools for faster content creation",
    heroSubtitle: "Sell digital files with preview cards, license placeholders, delivery notes, and product bundles.",
    ctaText: "Browse instant downloads",
    footerText: "Digital Creator Kit demo store. Add license terms, file delivery notes, and refund policy.",
    categories: ["Ebooks", "Templates", "Prompt Packs", "Creator Courses"],
    products: [
      {
        type: "digital",
        name: "30-Day Content Calendar Template",
        price: "$19",
        category: "Templates",
        shortDescription: "Editable planning system for reels, emails, launches, and weekly campaigns.",
        downloadTypePlaceholder: "Notion + CSV template download",
        fileDeliveryPlaceholder: "Instant email delivery placeholder",
        licensePlaceholder: "Single creator commercial license placeholder",
        previewImagePlaceholder: "digital-calendar-preview.jpg",
        featured: true
      },
      {
        type: "digital",
        name: "AI Product Copy Prompt Pack",
        price: "$24",
        category: "Prompt Packs",
        shortDescription: "Prompt library for product names, benefits, emails, ads, and FAQs.",
        downloadTypePlaceholder: "PDF + Google Doc prompt pack",
        fileDeliveryPlaceholder: "Secure download link placeholder",
        licensePlaceholder: "Personal and client-use license placeholder",
        previewImagePlaceholder: "digital-prompts-preview.jpg",
        featured: true
      },
      {
        type: "digital",
        name: "Launch Emails Mini Course",
        price: "$49",
        category: "Creator Courses",
        shortDescription: "Short course with scripts for pre-launch, launch day, and follow-up emails.",
        downloadTypePlaceholder: "Video course access placeholder",
        fileDeliveryPlaceholder: "Member area invite placeholder",
        licensePlaceholder: "Single-seat access license placeholder",
        previewImagePlaceholder: "digital-course-preview.jpg",
        featured: false
      }
    ],
    sections: [
      {
        eyebrow: "Delivery",
        title: "Set expectations before purchase",
        body: "Show delivery method, file types, license terms, preview images, and update policy."
      },
      {
        eyebrow: "Bundles",
        title: "Turn small files into full toolkits",
        body: "Combine ebooks, templates, courses, and prompt packs into creator-friendly offers."
      }
    ],
    offers: [
      {
        title: "Creator Launch Bundle",
        description: "Get the content calendar and prompt pack together for a discounted launch stack.",
        code: "CREATORBUNDLE"
      }
    ]
  }),
  templateBase({
    id: "digital-course-academy",
    name: "Digital Course Academy",
    categoryKey: "digital",
    kind: "digital",
    description: "A course-first digital template for lessons, workbooks, templates, and gated delivery.",
    previewGradient: "linear-gradient(135deg,#ecfeff,#0891b2 52%,#164e63)",
    heroTitle: "Package your expertise into a premium digital academy",
    heroSubtitle: "Use course modules, workbook previews, prompt libraries, and license placeholders for digital selling.",
    ctaText: "Preview the curriculum",
    footerText: "Digital Course Academy demo store. Add access terms, refund window, and support channels.",
    categories: ["Courses", "Workbooks", "Templates", "Coaching Upsells"],
    products: [
      {
        type: "digital",
        name: "Store Launch Masterclass",
        price: "$149",
        category: "Courses",
        shortDescription: "Six-module course teaching niche choice, offer pages, product copy, and launch traffic.",
        downloadTypePlaceholder: "Course portal access placeholder",
        fileDeliveryPlaceholder: "Invite email after publish placeholder",
        licensePlaceholder: "Single-student non-transferable license placeholder",
        previewImagePlaceholder: "academy-course-preview.jpg",
        featured: true
      },
      {
        type: "digital",
        name: "Launch Workbook PDF",
        price: "$29",
        category: "Workbooks",
        shortDescription: "Step-by-step planning workbook for offer positioning and launch tasks.",
        downloadTypePlaceholder: "Interactive PDF download",
        fileDeliveryPlaceholder: "Instant download placeholder",
        licensePlaceholder: "Personal use license placeholder",
        previewImagePlaceholder: "academy-workbook-preview.jpg",
        featured: true
      },
      {
        type: "digital",
        name: "Sales Page Wireframe Pack",
        price: "$39",
        category: "Templates",
        shortDescription: "Editable sales page wireframes for coaching, digital files, and service offers.",
        downloadTypePlaceholder: "Figma + PDF files placeholder",
        fileDeliveryPlaceholder: "Secure file link placeholder",
        licensePlaceholder: "Commercial use for one brand placeholder",
        previewImagePlaceholder: "academy-wireframe-preview.jpg",
        featured: false
      }
    ],
    sections: [
      {
        eyebrow: "Curriculum",
        title: "Preview learning outcomes clearly",
        body: "Add module cards, lesson counts, workbook previews, and delivery expectations."
      },
      {
        eyebrow: "Access",
        title: "Prepare gated delivery without building enforcement yet",
        body: "Use placeholders for course access, license terms, updates, and support."
      }
    ],
    offers: [
      {
        title: "Academy Starter",
        description: "Bundle the masterclass, workbook, and wireframes for launch week pricing.",
        code: "ACADEMY"
      }
    ]
  }),
  templateBase({
    id: "marketplace-city-bazaar",
    name: "City Bazaar Marketplace",
    categoryKey: "marketplace",
    kind: "marketplace",
    description: "A multi-vendor marketplace template for local sellers, category shelves, and commissions.",
    previewGradient: "linear-gradient(135deg,#f8fafc,#0f172a 52%,#22c55e)",
    heroTitle: "One marketplace for the city's best independent sellers",
    heroSubtitle: "Show vendor shelves, featured sellers, category navigation, and commission placeholders.",
    ctaText: "Explore featured sellers",
    footerText: "City Bazaar demo marketplace. Add vendor terms, commission policy, and support contacts.",
    categories: ["Fashion", "Beauty", "Home", "Food", "Electronics"],
    featuredSellers: ["Lina Style Studio", "Glow District", "Home & Co.", "Chef Samir Kitchen"],
    products: [
      {
        type: "marketplace",
        name: "Vendor Spotlight Bundle",
        price: "$75",
        category: "Fashion",
        shortDescription: "Curated bundle placeholder from a featured fashion vendor.",
        vendorPlaceholder: "Lina Style Studio",
        commissionPlaceholder: "12% marketplace commission placeholder",
        imagePlaceholder: "marketplace-fashion-placeholder.jpg",
        featured: true
      },
      {
        type: "marketplace",
        name: "Glow Essentials Set",
        price: "$58",
        category: "Beauty",
        shortDescription: "Skincare starter set placeholder from a beauty seller.",
        vendorPlaceholder: "Glow District",
        commissionPlaceholder: "10% marketplace commission placeholder",
        imagePlaceholder: "marketplace-beauty-placeholder.jpg",
        featured: true
      },
      {
        type: "marketplace",
        name: "Weekend Dessert Box",
        price: "$33",
        category: "Food",
        shortDescription: "Rotating dessert box placeholder from a local kitchen vendor.",
        vendorPlaceholder: "Chef Samir Kitchen",
        commissionPlaceholder: "8% marketplace commission placeholder",
        imagePlaceholder: "marketplace-food-placeholder.jpg",
        featured: false
      }
    ],
    sections: [
      {
        eyebrow: "Vendors",
        title: "Feature sellers as the hero product",
        body: "Use shelves for featured sellers, vendor stories, category ownership, and commission placeholders."
      },
      {
        eyebrow: "Governance",
        title: "Prepare listing rules before enforcement",
        body: "Add category protection, publish review placeholders, and automatic disable placeholders."
      }
    ],
    offers: [
      {
        title: "Marketplace Launch Week",
        description: "Feature the first 10 sellers on the homepage carousel placeholder.",
        code: "SELLERLAUNCH"
      }
    ]
  }),
  templateBase({
    id: "marketplace-mega-mall",
    name: "Mega Mall Marketplace",
    categoryKey: "marketplace",
    kind: "marketplace",
    description: "A broad marketplace layout for many categories, vendor discovery, and featured promotions.",
    previewGradient: "linear-gradient(135deg,#fefce8,#ca8a04 48%,#1f2937)",
    heroTitle: "A multi-category mall ready for vendor growth",
    heroSubtitle: "Build a polished marketplace homepage with product rows, seller cards, and commission architecture placeholders.",
    ctaText: "Browse marketplace deals",
    footerText: "Mega Mall demo marketplace. Add vendor onboarding, commission rules, and listing policies.",
    categories: ["Electronics", "Fashion", "Kids", "Furniture", "Digital Goods", "Fitness"],
    featuredSellers: ["Tech Yard", "Mini Nest", "Fit Supply", "Modern Rooms"],
    products: [
      {
        type: "marketplace",
        name: "Smart Home Starter Kit",
        price: "$119",
        category: "Electronics",
        shortDescription: "Demo marketplace product from an electronics vendor.",
        vendorPlaceholder: "Tech Yard",
        commissionPlaceholder: "11% marketplace commission placeholder",
        imagePlaceholder: "mall-electronics-placeholder.jpg",
        featured: true
      },
      {
        type: "marketplace",
        name: "Kids Creative Play Set",
        price: "$45",
        category: "Kids",
        shortDescription: "Demo marketplace toy bundle from a kids store vendor.",
        vendorPlaceholder: "Mini Nest",
        commissionPlaceholder: "9% marketplace commission placeholder",
        imagePlaceholder: "mall-kids-placeholder.jpg",
        featured: true
      },
      {
        type: "marketplace",
        name: "Home Office Upgrade Pack",
        price: "$260",
        category: "Furniture",
        shortDescription: "Desk, lamp, and organizer placeholder from a furniture vendor.",
        vendorPlaceholder: "Modern Rooms",
        commissionPlaceholder: "13% marketplace commission placeholder",
        imagePlaceholder: "mall-furniture-placeholder.jpg",
        featured: false
      }
    ],
    sections: [
      {
        eyebrow: "Discovery",
        title: "Give every category a clear shelf",
        body: "Use category rows, seller badges, featured deals, and marketplace navigation placeholders."
      },
      {
        eyebrow: "Limits",
        title: "Prepare subscription-aware controls",
        body: "Display allowed categories, monthly publish limits, sales limit placeholders, and disable hooks."
      }
    ],
    offers: [
      {
        title: "Mall Opening Deal",
        description: "Highlight launch promotions across the first four vendor categories.",
        code: "MEGAMALL"
      }
    ]
  })
];

export function getStoreTemplate(templateId: string) {
  return storeTemplates.find((template) => template.id === templateId);
}

export function getTemplatesByCategory(categoryKey: TemplateCategoryKey) {
  return storeTemplates.filter((template) => template.categoryKey === categoryKey);
}
