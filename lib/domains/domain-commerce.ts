import type { BillingPlan } from "@/lib/billing/plans";
import {
  domainExtensionCatalog,
  getDomainExtensions,
  topDomainExtensions
} from "@/lib/domains/extension-catalog";
import {
  buildDomainPricingQuote,
  type DomainPricingQuote
} from "@/lib/domains/domain-pricing";
import {
  calculateDomainCreditQuote,
  type DomainCreditQuote
} from "@/lib/domains/domain-credit";

export type DomainCommercePreview = {
  credit: DomainCreditQuote;
  idnSearchTerm: string;
  pricing: DomainPricingQuote;
  searchTerm: string;
  selectedExtensions: string[];
};

export function defaultDomainExtensions() {
  return [...topDomainExtensions];
}

export function allDomainExtensions() {
  return domainExtensionCatalog.map((extension) => extension.extension);
}

export function buildDomainCommercePreview({
  idnSearchTerm,
  plan,
  searchTerm,
  selectedExtensions
}: {
  idnSearchTerm: string;
  plan: BillingPlan;
  searchTerm: string;
  selectedExtensions: string[];
}): DomainCommercePreview {
  const selected = selectedExtensions.length ? selectedExtensions : defaultDomainExtensions();
  const extensions = getDomainExtensions(selected);
  const pricing = buildDomainPricingQuote({
    extensions,
    searchTerm: searchTerm || idnSearchTerm
  });

  return {
    credit: calculateDomainCreditQuote({ plan, pricing }),
    idnSearchTerm,
    pricing,
    searchTerm,
    selectedExtensions: extensions.map((extension) => extension.extension)
  };
}

export function domainCheckoutHookPoints() {
  return [
    "availability check",
    "registration quote refresh",
    "domain registration checkout",
    "included credit redemption",
    "email package checkout"
  ];
}
