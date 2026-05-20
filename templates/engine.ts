import type {
  AiLandingCopy,
  PlaceholderValues,
  ProductInput
} from "@/types/landing";

export const supportedPlaceholders = [
  "{{product_name}}",
  "{{product_price}}",
  "{{product_description}}",
  "{{whatsapp_number}}",
  "{{hero_image}}",
  "{{headline}}",
  "{{benefits}}",
  "{{cta_text}}"
] as const;

export function createPlaceholderValues(
  product: ProductInput,
  copy: AiLandingCopy
): PlaceholderValues {
  return {
    "{{product_name}}": product.productName,
    "{{product_price}}": product.productPrice,
    "{{product_description}}": product.productDescription,
    "{{whatsapp_number}}": product.whatsappNumber,
    "{{hero_image}}": product.heroImage ?? "",
    "{{headline}}": copy.headline,
    "{{benefits}}": copy.benefits.join(", "),
    "{{cta_text}}": copy.ctaText
  };
}

export function injectPlaceholders(
  source: string,
  values: PlaceholderValues
) {
  return supportedPlaceholders.reduce(
    (output, placeholder) => output.replaceAll(placeholder, values[placeholder]),
    source
  );
}

export function getWhatsappHref(number: string) {
  return `https://wa.me/${number.replace(/\D/g, "")}`;
}

export function createFallbackCopy(productName = "Your product"): AiLandingCopy {
  return {
    productTitle: productName,
    headline: `Launch ${productName} with confidence`,
    subheadline: "A premium, mobile-ready landing page built to help customers understand and buy faster.",
    description: "Clear product messaging, focused benefits, trust-building sections, and a direct WhatsApp CTA.",
    productCopy: "Clear product messaging, focused benefits, trust-building sections, and a direct WhatsApp CTA.",
    seoTitle: `${productName} | Premium Product Landing Page`,
    seoDescription: `Discover ${productName}, compare the benefits, and order directly through WhatsApp.`,
    benefits: ["Clear product value", "Fast WhatsApp ordering", "Mobile-first shopping"],
    features: [
      {
        title: "Premium presentation",
        description: "A clean product page with strong messaging and modern spacing."
      },
      {
        title: "Buyer-focused copy",
        description: "Sections explain the product, benefits, and next action quickly."
      },
      {
        title: "Instant contact",
        description: "Customers can tap the sticky WhatsApp CTA from any device."
      }
    ],
    testimonials: [
      {
        quote: "The page made the product feel clear, premium, and easy to order.",
        author: "Happy customer"
      },
      {
        quote: "Everything I needed to decide was on one simple page.",
        author: "Verified buyer"
      }
    ],
    pricing: {
      label: "Price",
      price: "Contact for price",
      note: "Message us on WhatsApp for availability."
    },
    sections: [
      {
        eyebrow: "Why it works",
        title: "Built for simple buying decisions",
        body: "The page presents the product, value, proof, pricing, FAQs, and CTA without distracting buyers."
      }
    ],
    ctaText: "Order on WhatsApp",
    ctaBlock: {
      title: "Ready to order?",
      body: "Tap the WhatsApp button and send a quick message to get started."
    },
    faq: [
      {
        question: "How do I order?",
        answer: "Tap the WhatsApp button and send your order request."
      },
      {
        question: "Can I ask questions first?",
        answer: "Yes. Use WhatsApp to confirm details, availability, and delivery."
      },
      {
        question: "Is this page mobile friendly?",
        answer: "Yes. It is designed for fast browsing and ordering on mobile devices."
      }
    ]
  };
}
