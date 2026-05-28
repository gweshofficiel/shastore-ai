import {
  calculateCheckoutFinancials,
  calculateTax,
  type CheckoutFinancialBreakdown,
  type PublicTaxSettings,
  type TaxCalculation
} from "@/lib/checkout-financials";
import { createAdminClient } from "@/lib/supabase/admin";

type TaxSettingsRow = {
  apply_tax_to_shipping?: boolean | null;
  default_tax_rate?: number | string | null;
  prices_include_tax?: boolean | null;
  tax_enabled?: boolean | null;
  tax_name?: string | null;
};

function numberValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function normalizeTaxSettings(row: TaxSettingsRow | null): PublicTaxSettings | null {
  if (!row) {
    return null;
  }

  return {
    applyTaxToShipping: Boolean(row.apply_tax_to_shipping),
    defaultTaxRate: numberValue(row.default_tax_rate),
    pricesIncludeTax: Boolean(row.prices_include_tax),
    taxEnabled: Boolean(row.tax_enabled),
    taxName: row.tax_name?.trim() || "Tax"
  };
}

export async function getPublicTaxSettingsForStore(storeId: string) {
  const admin = createAdminClient();

  if (!admin) {
    return null;
  }

  const { data } = await admin
    .from("store_tax_settings" as never)
    .select("tax_enabled, tax_name, default_tax_rate, prices_include_tax, apply_tax_to_shipping")
    .eq("store_id" as never, storeId as never)
    .maybeSingle();

  return normalizeTaxSettings(data as unknown as TaxSettingsRow | null);
}

export async function calculatePublicTaxForStore({
  discountAmount,
  shippingFee,
  storeId,
  subtotal
}: {
  discountAmount: number;
  shippingFee: number;
  storeId: string;
  subtotal: number;
}): Promise<TaxCalculation> {
  return calculateTax({
    discountAmount,
    shippingFee,
    subtotal,
    taxSettings: await getPublicTaxSettingsForStore(storeId)
  });
}

export async function calculatePublicCheckoutFinancialsForStore({
  discountAmount,
  shippingAmount,
  storeId,
  subtotalAmount
}: {
  discountAmount: number;
  shippingAmount: number;
  storeId: string;
  subtotalAmount: number;
}): Promise<CheckoutFinancialBreakdown> {
  return calculateCheckoutFinancials({
    discountAmount,
    shippingAmount,
    subtotalAmount,
    taxSettings: await getPublicTaxSettingsForStore(storeId)
  });
}

export type { CheckoutFinancialBreakdown, PublicTaxSettings, TaxCalculation };
