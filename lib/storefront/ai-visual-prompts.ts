import {
  visualAssetSlotSizing,
  type VisualAssetSlot
} from "@/lib/storefront/visual-assets";

export type AIVisualPromptBlueprintId =
  | "ecommerce-product-photo"
  | "clean-category-visual"
  | "premium-hero-banner"
  | "seasonal-promotion-banner"
  | "collection-banner";

export type AIVisualPromptVariable =
  | "brandName"
  | "categoryName"
  | "categoryDescription"
  | "collectionName"
  | "colorPalette"
  | "industry"
  | "marketingTheme"
  | "productCategory"
  | "productDescription"
  | "productName"
  | "slotType"
  | "storeName"
  | "style"
  | "targetAudience"
  | "visualMood";

export type AIVisualPromptBlueprint = {
  defaultSlot: VisualAssetSlot;
  description: string;
  id: AIVisualPromptBlueprintId;
  negativePrompt: string;
  promptTemplate: string;
  title: string;
  variables: AIVisualPromptVariable[];
};

export type AIVisualPromptContext = Partial<Record<AIVisualPromptVariable, string>>;

const defaultNegativePrompt = [
  "No logos unless provided by the merchant.",
  "No copyrighted characters, brand marks, or celebrity likenesses.",
  "No checkout UI, payment details, private information, or misleading medical claims.",
  "No illustration, cartoon, vector art, icon, flat drawing, mascot, symbolic placeholder, or fake UI.",
  "No unreadable fake text, random letters, watermarks, labels, badges, or text-heavy layouts unless explicit merchant copy is provided.",
  "No abstract-only graphics; the image must show real ecommerce subjects with believable materials and textures."
].join(" ");

const realismStyleGuide = [
  "Photorealistic ecommerce visual.",
  "Real product photography, not illustration.",
  "Premium ecommerce catalog quality.",
  "Professional studio lighting with realistic shadows.",
  "Real materials, realistic textures, natural reflections, and believable depth of field.",
  "Clean commercial background suitable for a modern online store.",
  "High-resolution, sharp, polished, conversion-focused composition."
].join(" ");

export const aiVisualPromptBlueprintRegistry: AIVisualPromptBlueprint[] = [
  {
    defaultSlot: "product.primary",
    description: "Studio-ready ecommerce product image for product cards and PDP galleries.",
    id: "ecommerce-product-photo",
    negativePrompt: defaultNegativePrompt,
    promptTemplate:
      "Create a realistic ecommerce product photograph of {{productName}}. Product category: {{productCategory}}. Product details: {{productDescription}}. Store: {{storeName}}. Industry: {{industry}}. Use {{style}} styling and a {{colorPalette}} palette.",
    title: "Ecommerce product photo",
    variables: ["productName", "productCategory", "productDescription", "storeName", "industry", "style", "colorPalette"]
  },
  {
    defaultSlot: "category.image",
    description: "Clean category visual for category cards, icons, and category landing pages.",
    id: "clean-category-visual",
    negativePrompt: defaultNegativePrompt,
    promptTemplate:
      "Create a realistic ecommerce category image for {{categoryName}}. Category details: {{categoryDescription}}. Store: {{storeName}}. Match a {{style}} storefront for {{targetAudience}}, use {{colorPalette}} colors, and show real products that clearly belong to this category.",
    title: "Clean category visual",
    variables: ["categoryName", "categoryDescription", "storeName", "style", "targetAudience", "colorPalette"]
  },
  {
    defaultSlot: "hero.desktop",
    description: "Premium responsive hero banner with room for runtime headline and CTA overlay.",
    id: "premium-hero-banner",
    negativePrompt: defaultNegativePrompt,
    promptTemplate:
      "Create a realistic premium ecommerce hero banner for {{brandName}} / {{storeName}}. Industry: {{industry}}. Mood: {{visualMood}}. Style: {{style}}. Feature a believable commercial lifestyle or product scene with generous negative space for runtime headline and CTA overlay, using a polished {{colorPalette}} palette.",
    title: "Premium hero banner",
    variables: ["brandName", "storeName", "industry", "visualMood", "style", "colorPalette"]
  },
  {
    defaultSlot: "marketing.seasonalSale",
    description: "Seasonal promotion banner for flash sale, seasonal sale, or announcement campaign slots.",
    id: "seasonal-promotion-banner",
    negativePrompt: defaultNegativePrompt,
    promptTemplate:
      "Create a realistic ecommerce promotion banner for {{brandName}} / {{storeName}}. Campaign theme: {{marketingTheme}}. Industry: {{industry}}. Use {{style}} styling, {{colorPalette}} colors, realistic sale products, and clear space for runtime promo copy.",
    title: "Seasonal promotion banner",
    variables: ["brandName", "storeName", "marketingTheme", "industry", "style", "colorPalette"]
  },
  {
    defaultSlot: "marketing.collection",
    description: "Collection banner for launches, editorial merchandising, and homepage collection blocks.",
    id: "collection-banner",
    negativePrompt: defaultNegativePrompt,
    promptTemplate:
      "Create a realistic ecommerce collection banner for {{collectionName}} by {{brandName}} / {{storeName}}. Use {{style}} styling for {{targetAudience}}, a {{colorPalette}} palette, and real products arranged in a clean responsive storefront banner composition.",
    title: "Collection banner",
    variables: ["collectionName", "brandName", "storeName", "style", "targetAudience", "colorPalette"]
  }
];

function textValue(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function promptFallback(key: AIVisualPromptVariable, context: AIVisualPromptContext) {
  const storeName = textValue(context.storeName ?? context.brandName, "the store");
  const subject = textValue(
    context.productName ?? context.categoryName ?? context.collectionName ?? context.marketingTheme,
    "the ecommerce subject"
  );

  const fallbacks: Record<AIVisualPromptVariable, string> = {
    brandName: storeName,
    categoryDescription: `real products and styling that clearly match ${subject}`,
    categoryName: subject,
    collectionName: subject,
    colorPalette: "clean premium ecommerce color palette",
    industry: "ecommerce",
    marketingTheme: "premium ecommerce campaign",
    productCategory: textValue(context.categoryName, "the relevant product category"),
    productDescription: `realistic product details inferred from ${subject}`,
    productName: subject,
    slotType: "storefront visual slot",
    storeName,
    style: "premium commercial",
    targetAudience: "online shoppers",
    visualMood: "premium, inviting, commercial"
  };

  return fallbacks[key];
}

export function getAIVisualPromptBlueprint(id: AIVisualPromptBlueprintId) {
  return aiVisualPromptBlueprintRegistry.find((blueprint) => blueprint.id === id) ?? null;
}

export function promptBlueprintForAssetSlot(slot: VisualAssetSlot): AIVisualPromptBlueprint {
  if (slot.startsWith("product.")) {
    return getAIVisualPromptBlueprint("ecommerce-product-photo") ?? aiVisualPromptBlueprintRegistry[0];
  }

  if (slot.startsWith("category.")) {
    return getAIVisualPromptBlueprint("clean-category-visual") ?? aiVisualPromptBlueprintRegistry[0];
  }

  if (slot.startsWith("hero.")) {
    return getAIVisualPromptBlueprint("premium-hero-banner") ?? aiVisualPromptBlueprintRegistry[0];
  }

  if (slot === "marketing.collection") {
    return getAIVisualPromptBlueprint("collection-banner") ?? aiVisualPromptBlueprintRegistry[0];
  }

  return getAIVisualPromptBlueprint("seasonal-promotion-banner") ?? aiVisualPromptBlueprintRegistry[0];
}

export function renderAIVisualPrompt({
  blueprint,
  context,
  slot
}: {
  blueprint: AIVisualPromptBlueprint;
  context: AIVisualPromptContext;
  slot?: VisualAssetSlot;
}) {
  const contextualPrompt = blueprint.promptTemplate.replace(/\{\{(\w+)\}\}/g, (_match, key: AIVisualPromptVariable) =>
    textValue(context[key], promptFallback(key, context))
  );

  return [
    contextualPrompt,
    realismStyleGuide,
    slotRealismDirection(slot ?? blueprint.defaultSlot),
    "The image must look like a real photographed ecommerce asset for the actual subject, not a generic placeholder."
  ].filter(Boolean).join("\n\n");
}

function slotRealismDirection(slot: VisualAssetSlot) {
  const sizing = visualAssetSlotSizing(slot);
  const sizingGuidance = `Required slot composition: ${sizing.composition} Target aspect ratio: ${sizing.aspectRatio}. Preferred generated canvas: ${sizing.width}x${sizing.height}. Fit mode in storefront: object-${sizing.fitMode}, object-position ${sizing.objectPosition}. Compose with safe margins so the image displays cleanly without stretching or awkward crop.`;

  if (slot.startsWith("product.")) {
    return `${sizingGuidance} Product primary image direction: show the real product as the hero subject, centered and clear, with realistic proportions, packaging/material details when relevant, commercial studio lighting, and no fake labels or invented brand marks.`;
  }

  if (slot.startsWith("category.")) {
    return `${sizingGuidance} Category image direction: show a small set of real products that match the category name and description. Avoid single symbolic objects unless the category truly requires it. Make it suitable for category cards and landing pages.`;
  }

  if (slot.startsWith("hero.")) {
    return `${sizingGuidance} Hero banner direction: create a wide realistic commercial ecommerce scene with product/lifestyle styling and clean negative space for site copy overlays. Do not render text inside the image.`;
  }

  if (slot.startsWith("marketing.")) {
    return `${sizingGuidance} Promotion/banner direction: create a realistic sale or campaign product scene with commercial merchandising energy, but no rendered promo text, fake discounts, random typography, or UI elements.`;
  }

  return `${sizingGuidance} Visual direction: realistic ecommerce photography, clean composition, and subject-specific commercial styling.`;
}

