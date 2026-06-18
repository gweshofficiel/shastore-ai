import "server-only";

export type MarketplaceItemType = "app" | "plugin" | "service" | "template" | "theme";

export type MarketplaceSection =
  | "app_marketplace"
  | "plugin_marketplace"
  | "service_marketplace"
  | "template_marketplace"
  | "theme_marketplace";

export type MarketplaceItemTypeCatalogEntry = {
  itemType: MarketplaceItemType;
  label: string;
  section: MarketplaceSection;
  sectionLabel: string;
};

export type MarketplaceItemTypeStats = {
  appItems: number;
  pluginItems: number;
  serviceItems: number;
  templateItems: number;
  themeItems: number;
  totalItems: number;
};

export const MARKETPLACE_ITEM_TYPES: readonly MarketplaceItemType[] = [
  "template",
  "theme",
  "plugin",
  "app",
  "service"
] as const;

export const MARKETPLACE_SECTIONS: readonly MarketplaceSection[] = [
  "template_marketplace",
  "theme_marketplace",
  "plugin_marketplace",
  "app_marketplace",
  "service_marketplace"
] as const;

const sectionLabels: Record<MarketplaceSection, string> = {
  app_marketplace: "App Marketplace",
  plugin_marketplace: "Plugin Marketplace",
  service_marketplace: "Service Marketplace",
  template_marketplace: "Template Marketplace",
  theme_marketplace: "Theme Marketplace"
};

const itemTypeLabels: Record<MarketplaceItemType, string> = {
  app: "App",
  plugin: "Plugin",
  service: "Service",
  template: "Template",
  theme: "Theme"
};

const itemTypeToSectionMap: Record<MarketplaceItemType, MarketplaceSection> = {
  app: "app_marketplace",
  plugin: "plugin_marketplace",
  service: "service_marketplace",
  template: "template_marketplace",
  theme: "theme_marketplace"
};

const sectionToItemTypeMap: Record<MarketplaceSection, MarketplaceItemType> = {
  app_marketplace: "app",
  plugin_marketplace: "plugin",
  service_marketplace: "service",
  template_marketplace: "template",
  theme_marketplace: "theme"
};

function text(value: unknown, maxLength = 500) {
  if (typeof value !== "string") return "";

  return value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/\bjavascript:/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function isValidMarketplaceItemType(value: unknown): value is MarketplaceItemType {
  return MARKETPLACE_ITEM_TYPES.includes(value as MarketplaceItemType);
}

export function parseMarketplaceItemType(value: unknown): MarketplaceItemType | null {
  const cleaned = text(value, 40);
  return isValidMarketplaceItemType(cleaned) ? cleaned : null;
}

export function isValidMarketplaceSection(value: unknown): value is MarketplaceSection {
  return MARKETPLACE_SECTIONS.includes(value as MarketplaceSection);
}

export function parseMarketplaceSection(value: unknown): MarketplaceSection | null {
  const cleaned = text(value, 60);
  return isValidMarketplaceSection(cleaned) ? cleaned : null;
}

export function getSectionForItemType(itemType: MarketplaceItemType): MarketplaceSection {
  return itemTypeToSectionMap[itemType];
}

export function getItemTypeForSection(section: MarketplaceSection): MarketplaceItemType {
  return sectionToItemTypeMap[section];
}

export function getMarketplaceItemTypeLabel(itemType: MarketplaceItemType) {
  return itemTypeLabels[itemType];
}

export function getMarketplaceSectionLabel(section: MarketplaceSection) {
  return sectionLabels[section];
}

export function validateItemTypeSectionPair(
  itemType: MarketplaceItemType,
  section: MarketplaceSection
): boolean {
  return getSectionForItemType(itemType) === section;
}

export function assertValidMarketplaceItemType(value: unknown): MarketplaceItemType {
  const itemType = parseMarketplaceItemType(value);

  if (!itemType) {
    throw new Error("Marketplace item type must be template, theme, plugin, app, or service.");
  }

  return itemType;
}

export function assertValidItemTypeSectionPair(
  itemType: MarketplaceItemType,
  section: MarketplaceSection
) {
  if (!validateItemTypeSectionPair(itemType, section)) {
    throw new Error(
      `Marketplace item type "${itemType}" does not match section "${section}".`
    );
  }
}

export function listMarketplaceItemTypeCatalog(): MarketplaceItemTypeCatalogEntry[] {
  return MARKETPLACE_ITEM_TYPES.map((itemType) => {
    const section = getSectionForItemType(itemType);

    return {
      itemType,
      label: itemTypeLabels[itemType],
      section,
      sectionLabel: sectionLabels[section]
    };
  });
}

export function countMarketplaceItemsByType<
  T extends { itemType: MarketplaceItemType }
>(items: T[]): MarketplaceItemTypeStats {
  return {
    appItems: items.filter((item) => item.itemType === "app").length,
    pluginItems: items.filter((item) => item.itemType === "plugin").length,
    serviceItems: items.filter((item) => item.itemType === "service").length,
    templateItems: items.filter((item) => item.itemType === "template").length,
    themeItems: items.filter((item) => item.itemType === "theme").length,
    totalItems: items.length
  };
}

export function filterMarketplaceItemsByType<
  T extends { itemType: MarketplaceItemType; section: MarketplaceSection }
>(items: T[], itemType: MarketplaceItemType): T[] {
  const section = getSectionForItemType(itemType);

  return items.filter((item) => item.itemType === itemType && item.section === section);
}

export function filterMarketplaceItemsBySection<
  T extends { itemType: MarketplaceItemType; section: MarketplaceSection }
>(items: T[], section: MarketplaceSection): T[] {
  const itemType = getItemTypeForSection(section);

  return items.filter((item) => item.itemType === itemType && item.section === section);
}
