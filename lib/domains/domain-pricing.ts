import type { DomainExtensionCatalogItem } from "@/lib/domains/extension-catalog";

export type DomainPriceLine = {
  domainName: string;
  extension: string;
  priceCents: number;
};

export type DomainPricingQuote = {
  currency: "USD";
  lines: DomainPriceLine[];
  subtotalCents: number;
};

function cleanDomainLabel(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/\s+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
}

export function buildDomainPricingQuote({
  extensions,
  searchTerm
}: {
  extensions: DomainExtensionCatalogItem[];
  searchTerm: string;
}): DomainPricingQuote {
  const label = cleanDomainLabel(searchTerm);
  const lines = label
    ? extensions.map((extension) => ({
        domainName: `${label}${extension.extension}`,
        extension: extension.extension,
        priceCents: extension.registrationPriceCents
      }))
    : [];

  return {
    currency: "USD",
    lines,
    subtotalCents: lines.reduce((total, line) => total + line.priceCents, 0)
  };
}

export function formatDomainMoney(cents: number) {
  return new Intl.NumberFormat("en", {
    currency: "USD",
    style: "currency"
  }).format(cents / 100);
}
