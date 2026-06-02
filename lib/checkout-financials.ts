export type PublicTaxSettings = {
  applyTaxToShipping: boolean;
  defaultTaxRate: number;
  pricesIncludeTax: boolean;
  taxRules?: PublicTaxRule[];
  taxEnabled: boolean;
  taxName: string;
};

export type PublicTaxRule = {
  city: string | null;
  country: string;
  region: string | null;
  taxName: string;
  taxRate: number;
};

export type CheckoutFinancialInput = {
  customerAddress?: string;
  discountAmount?: number;
  shippingAmount?: number;
  subtotalAmount: number;
  taxSettings?: PublicTaxSettings | null;
};

export type CheckoutFinancialBreakdown = {
  discountAmount: number;
  discountedSubtotalAmount: number;
  pricesIncludeTax: boolean;
  shippingAmount: number;
  subtotalAmount: number;
  taxableAmount: number;
  taxAmount: number;
  taxAppliesToShipping: boolean;
  taxName: string | null;
  taxRate: number;
  totalAmount: number;
};

export type TaxCalculation = {
  pricesIncludeTax: boolean;
  taxAmount: number;
  taxAppliesToShipping: boolean;
  taxName: string | null;
  taxRate: number;
  total: number;
};

export function money(value: number | string | null | undefined) {
  const amount = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(amount) ? Math.max(0, Number(amount.toFixed(2))) : 0;
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function matchesRule(address: string, rule: PublicTaxRule) {
  const normalizedAddress = normalizeText(address);

  if (!normalizedAddress) {
    return false;
  }

  return [rule.city, rule.region, rule.country]
    .filter((value): value is string => Boolean(value?.trim()))
    .every((value) => normalizedAddress.includes(normalizeText(value)));
}

function resolveTaxSettings(taxSettings: PublicTaxSettings | null, customerAddress = "") {
  if (!taxSettings?.taxEnabled) {
    return { taxName: null as string | null, taxRate: 0 };
  }

  const rules = taxSettings.taxRules ?? [];

  if (rules.length) {
    const matchedRule = rules.find((rule) => matchesRule(customerAddress, rule));

    return matchedRule
      ? { taxName: matchedRule.taxName, taxRate: money(matchedRule.taxRate) }
      : { taxName: null as string | null, taxRate: 0 };
  }

  return {
    taxName: taxSettings.taxName,
    taxRate: money(taxSettings.defaultTaxRate)
  };
}

export function calculateCheckoutFinancials({
  customerAddress = "",
  discountAmount = 0,
  shippingAmount = 0,
  subtotalAmount,
  taxSettings = null
}: CheckoutFinancialInput): CheckoutFinancialBreakdown {
  const subtotal = money(subtotalAmount);
  const discount = Math.min(subtotal, money(discountAmount));
  const discountedSubtotal = money(subtotal - discount);
  const shipping = money(shippingAmount);
  const preTaxTotal = money(discountedSubtotal + shipping);
  const resolvedTax = resolveTaxSettings(taxSettings, customerAddress);
  const taxEnabled = resolvedTax.taxRate > 0;
  const taxRate = taxEnabled ? resolvedTax.taxRate : 0;
  const taxAppliesToShipping = Boolean(taxSettings?.applyTaxToShipping);
  const pricesIncludeTax = Boolean(taxSettings?.pricesIncludeTax);
  const taxableAmount = taxEnabled
    ? money(discountedSubtotal + (taxAppliesToShipping ? shipping : 0))
    : 0;
  const taxAmount = taxEnabled
    ? pricesIncludeTax
      ? money(taxableAmount - taxableAmount / (1 + taxRate / 100))
      : money(taxableAmount * (taxRate / 100))
    : 0;

  return {
    discountAmount: discount,
    discountedSubtotalAmount: discountedSubtotal,
    pricesIncludeTax,
    shippingAmount: shipping,
    subtotalAmount: subtotal,
    taxableAmount,
    taxAmount,
    taxAppliesToShipping,
    taxName: taxEnabled ? resolvedTax.taxName : null,
    taxRate,
    totalAmount: pricesIncludeTax ? preTaxTotal : money(preTaxTotal + taxAmount)
  };
}

export function calculateTax(input: {
  customerAddress?: string;
  discountAmount: number;
  shippingFee: number;
  subtotal: number;
  taxSettings: PublicTaxSettings | null;
}): TaxCalculation {
  const breakdown = calculateCheckoutFinancials({
    customerAddress: input.customerAddress,
    discountAmount: input.discountAmount,
    shippingAmount: input.shippingFee,
    subtotalAmount: input.subtotal,
    taxSettings: input.taxSettings
  });

  return {
    pricesIncludeTax: breakdown.pricesIncludeTax,
    taxAmount: breakdown.taxAmount,
    taxAppliesToShipping: breakdown.taxAppliesToShipping,
    taxName: breakdown.taxName,
    taxRate: breakdown.taxRate,
    total: breakdown.totalAmount
  };
}
