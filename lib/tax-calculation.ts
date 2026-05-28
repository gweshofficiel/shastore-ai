export type PublicTaxSettings = {
  applyTaxToShipping: boolean;
  defaultTaxRate: number;
  pricesIncludeTax: boolean;
  taxEnabled: boolean;
  taxName: string;
};

export type TaxCalculation = {
  pricesIncludeTax: boolean;
  taxAmount: number;
  taxAppliesToShipping: boolean;
  taxName: string | null;
  taxRate: number;
  total: number;
};

function money(value: number) {
  return Number(Math.max(0, value).toFixed(2));
}

export function calculateTax({
  discountAmount,
  shippingFee,
  subtotal,
  taxSettings
}: {
  discountAmount: number;
  shippingFee: number;
  subtotal: number;
  taxSettings: PublicTaxSettings | null;
}): TaxCalculation {
  const discountedSubtotal = money(subtotal - discountAmount);
  const safeShippingFee = money(shippingFee);
  const untaxedTotal = money(discountedSubtotal + safeShippingFee);

  if (!taxSettings?.taxEnabled || taxSettings.defaultTaxRate <= 0) {
    return {
      pricesIncludeTax: taxSettings?.pricesIncludeTax ?? false,
      taxAmount: 0,
      taxAppliesToShipping: taxSettings?.applyTaxToShipping ?? false,
      taxName: taxSettings?.taxName ?? null,
      taxRate: 0,
      total: untaxedTotal
    };
  }

  const taxableBase = money(
    discountedSubtotal + (taxSettings.applyTaxToShipping ? safeShippingFee : 0)
  );
  const rate = taxSettings.defaultTaxRate;
  const taxAmount = taxSettings.pricesIncludeTax
    ? money(taxableBase - taxableBase / (1 + rate / 100))
    : money(taxableBase * (rate / 100));

  return {
    pricesIncludeTax: taxSettings.pricesIncludeTax,
    taxAmount,
    taxAppliesToShipping: taxSettings.applyTaxToShipping,
    taxName: taxSettings.taxName,
    taxRate: rate,
    total: taxSettings.pricesIncludeTax ? untaxedTotal : money(untaxedTotal + taxAmount)
  };
}
