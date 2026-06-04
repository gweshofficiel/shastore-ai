import type { VisualAssetSlot } from "@/lib/storefront/visual-assets";

export type AIVisualPromptBlueprintId =
  | "ecommerce-product-photo"
  | "clean-category-visual"
  | "premium-hero-banner"
  | "seasonal-promotion-banner"
  | "collection-banner";

export type AIVisualPromptVariable =
  | "brandName"
  | "categoryName"
  | "collectionName"
  | "colorPalette"
  | "industry"
  | "marketingTheme"
  | "productName"
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
  "No text-heavy layouts; keep any text area clean for runtime copy overlays."
].join(" ");

export const aiVisualPromptBlueprintRegistry: AIVisualPromptBlueprint[] = [
  {
    defaultSlot: "product.primary",
    description: "Studio-ready ecommerce product image for product cards and PDP galleries.",
    id: "ecommerce-product-photo",
    negativePrompt: defaultNegativePrompt,
    promptTemplate:
      "Create a clean ecommerce product photo for {{productName}} in the {{industry}} industry. Use a {{style}} visual style, {{colorPalette}} palette, premium lighting, clear product focus, and a simple commerce-ready background.",
    title: "Ecommerce product photo",
    variables: ["productName", "industry", "style", "colorPalette"]
  },
  {
    defaultSlot: "category.image",
    description: "Clean category visual for category cards, icons, and category landing pages.",
    id: "clean-category-visual",
    negativePrompt: defaultNegativePrompt,
    promptTemplate:
      "Create a clean category visual for {{categoryName}}. Match a {{style}} storefront for {{targetAudience}}, use {{colorPalette}} colors, and keep the composition simple enough for category card cropping.",
    title: "Clean category visual",
    variables: ["categoryName", "style", "targetAudience", "colorPalette"]
  },
  {
    defaultSlot: "hero.desktop",
    description: "Premium responsive hero banner with room for runtime headline and CTA overlay.",
    id: "premium-hero-banner",
    negativePrompt: defaultNegativePrompt,
    promptTemplate:
      "Create a premium ecommerce hero banner for {{brandName}}. Industry: {{industry}}. Mood: {{visualMood}}. Style: {{style}}. Leave generous negative space for headline and CTA overlay, with a polished {{colorPalette}} palette.",
    title: "Premium hero banner",
    variables: ["brandName", "industry", "visualMood", "style", "colorPalette"]
  },
  {
    defaultSlot: "marketing.seasonalSale",
    description: "Seasonal promotion banner for flash sale, seasonal sale, or announcement campaign slots.",
    id: "seasonal-promotion-banner",
    negativePrompt: defaultNegativePrompt,
    promptTemplate:
      "Create a seasonal ecommerce promotion banner for {{brandName}}. Campaign theme: {{marketingTheme}}. Industry: {{industry}}. Use {{style}} styling, {{colorPalette}} colors, and clear space for runtime promo copy.",
    title: "Seasonal promotion banner",
    variables: ["brandName", "marketingTheme", "industry", "style", "colorPalette"]
  },
  {
    defaultSlot: "marketing.collection",
    description: "Collection banner for launches, editorial merchandising, and homepage collection blocks.",
    id: "collection-banner",
    negativePrompt: defaultNegativePrompt,
    promptTemplate:
      "Create an ecommerce collection banner for {{collectionName}} by {{brandName}}. Use {{style}} styling for {{targetAudience}}, a {{colorPalette}} palette, and a clean composition suitable for responsive storefront banners.",
    title: "Collection banner",
    variables: ["collectionName", "brandName", "style", "targetAudience", "colorPalette"]
  }
];

function textValue(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
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
  context
}: {
  blueprint: AIVisualPromptBlueprint;
  context: AIVisualPromptContext;
}) {
  return blueprint.promptTemplate.replace(/\{\{(\w+)\}\}/g, (_match, key: AIVisualPromptVariable) =>
    textValue(context[key], `[${key}]`)
  );
}

