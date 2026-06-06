export type DomainExtensionCategory = "business" | "commerce" | "general" | "tech";

export type DomainExtensionCatalogItem = {
  category: DomainExtensionCategory;
  extension: string;
  featured: boolean;
  label: string;
  registrationPriceCents: number;
};

export const topDomainExtensions = [
  ".com",
  ".net",
  ".org",
  ".co",
  ".io",
  ".us",
  ".ai",
  ".shop",
  ".store",
  ".online"
] as const;

export const domainExtensionCatalog: DomainExtensionCatalogItem[] = [
  { category: "general", extension: ".com", featured: true, label: "Commercial", registrationPriceCents: 1299 },
  { category: "general", extension: ".net", featured: true, label: "Network", registrationPriceCents: 1499 },
  { category: "general", extension: ".org", featured: true, label: "Organization", registrationPriceCents: 1299 },
  { category: "business", extension: ".co", featured: true, label: "Company", registrationPriceCents: 2999 },
  { category: "tech", extension: ".io", featured: true, label: "Tech", registrationPriceCents: 4999 },
  { category: "business", extension: ".us", featured: true, label: "United States", registrationPriceCents: 999 },
  { category: "tech", extension: ".ai", featured: true, label: "AI", registrationPriceCents: 8999 },
  { category: "commerce", extension: ".shop", featured: true, label: "Shop", registrationPriceCents: 3499 },
  { category: "commerce", extension: ".store", featured: true, label: "Store", registrationPriceCents: 4499 },
  { category: "commerce", extension: ".online", featured: true, label: "Online", registrationPriceCents: 2999 },
  { category: "business", extension: ".biz", featured: false, label: "Business", registrationPriceCents: 1699 },
  { category: "general", extension: ".info", featured: false, label: "Info", registrationPriceCents: 1599 },
  { category: "tech", extension: ".xyz", featured: false, label: "Modern", registrationPriceCents: 1299 },
  { category: "tech", extension: ".app", featured: false, label: "Apps", registrationPriceCents: 1999 },
  { category: "tech", extension: ".dev", featured: false, label: "Developer", registrationPriceCents: 1999 },
  { category: "business", extension: ".me", featured: false, label: "Personal", registrationPriceCents: 1799 },
  { category: "business", extension: ".ca", featured: false, label: "Canada", registrationPriceCents: 1899 },
  { category: "business", extension: ".uk", featured: false, label: "United Kingdom", registrationPriceCents: 1499 },
  { category: "business", extension: ".de", featured: false, label: "Germany", registrationPriceCents: 1299 }
];

export function normalizeDomainExtension(value: string) {
  const extension = value.trim().toLowerCase();
  return extension.startsWith(".") ? extension : `.${extension}`;
}

export function getDomainExtension(extension: string) {
  const normalized = normalizeDomainExtension(extension);
  return domainExtensionCatalog.find((item) => item.extension === normalized) ?? null;
}

export function getDomainExtensions(input: string[]) {
  const unique = Array.from(new Set(input.map(normalizeDomainExtension)));
  return unique
    .map(getDomainExtension)
    .filter((item): item is DomainExtensionCatalogItem => Boolean(item));
}
