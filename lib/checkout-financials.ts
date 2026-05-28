export type PublicTaxSettings = {
  applyTaxToShipping: boolean;
  defaultTaxRate: number;
  pricesIncludeTax: boolean;
  taxEnabled: boolean;
  taxName: string;
};

export type CheckoutFinancialInput = {
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

export function calculateCheckoutFinancials({
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
  const taxEnabled = Boolean(taxSettings?.taxEnabled && taxSettings.defaultTaxRate > 0);
  const taxRate = taxEnabled ? money(taxSettings?.defaultTaxRate) : 0;
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
    taxName: taxSettings?.taxName ?? null,
    taxRate,
    totalAmount: pricesIncludeTax ? preTaxTotal : money(preTaxTotal + taxAmount)
  };
}

export function calculateTax(input: {
  discountAmount: number;
  shippingFee: number;
  subtotal: number;
  taxSettings: PublicTaxSettings | null;
}): TaxCalculation {
  const breakdown = calculateCheckoutFinancials({
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
