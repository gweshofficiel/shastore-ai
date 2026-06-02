import {
  calculateCheckoutFinancials,
  calculateTax,
  type CheckoutFinancialBreakdown,
  type PublicTaxRule,
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

type TaxRuleRow = {
  city?: string | null;
  country?: string | null;
  enabled?: boolean | null;
  region?: string | null;
  status?: string | null;
  tax_name?: string | null;
  tax_rate?: number | string | null;
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

function normalizeTaxRule(row: TaxRuleRow): PublicTaxRule | null {
  const country = row.country?.trim();

  if (!country || row.enabled === false || row.status === "inactive") {
    return null;
  }

  return {
    city: row.city?.trim() || null,
    country,
    region: row.region?.trim() || null,
    taxName: row.tax_name?.trim() || "Tax",
    taxRate: numberValue(row.tax_rate)
  };
}

function normalizeTaxSettings(row: TaxSettingsRow | null, rules: PublicTaxRule[] = []): PublicTaxSettings | null {
  if (!row) {
    return null;
  }

  return {
    applyTaxToShipping: Boolean(row.apply_tax_to_shipping),
    defaultTaxRate: numberValue(row.default_tax_rate),
    pricesIncludeTax: Boolean(row.prices_include_tax),
    taxRules: rules,
    taxEnabled: Boolean(row.tax_enabled),
    taxName: row.tax_name?.trim() || "Tax"
  };
}

export async function getPublicTaxSettingsForStore(storeId: string) {
  const admin = createAdminClient();

  if (!admin) {
    return null;
  }

  const [settingsResult, rulesResult] = await Promise.all([
    admin
    .from("store_tax_settings" as never)
    .select("tax_enabled, tax_name, default_tax_rate, prices_include_tax, apply_tax_to_shipping")
    .eq("store_id" as never, storeId as never)
      .maybeSingle(),
    admin
      .from("store_tax_rules" as never)
      .select("tax_name, country, region, city, tax_rate, status, enabled, sort_order")
      .eq("store_id" as never, storeId as never)
      .eq("status" as never, "active" as never)
      .order("sort_order" as never, { ascending: true } as never)
  ]);
  const rules = ((rulesResult.data ?? []) as unknown as TaxRuleRow[])
    .map(normalizeTaxRule)
    .filter((rule): rule is PublicTaxRule => Boolean(rule));

  return normalizeTaxSettings(settingsResult.data as unknown as TaxSettingsRow | null, rules);
}

export async function calculatePublicTaxForStore({
  customerAddress = "",
  discountAmount,
  shippingFee,
  storeId,
  subtotal
}: {
  customerAddress?: string;
  discountAmount: number;
  shippingFee: number;
  storeId: string;
  subtotal: number;
}): Promise<TaxCalculation> {
  return calculateTax({
    customerAddress,
    discountAmount,
    shippingFee,
    subtotal,
    taxSettings: await getPublicTaxSettingsForStore(storeId)
  });
}

export async function calculatePublicCheckoutFinancialsForStore({
  customerAddress = "",
  discountAmount,
  shippingAmount,
  storeId,
  subtotalAmount
}: {
  customerAddress?: string;
  discountAmount: number;
  shippingAmount: number;
  storeId: string;
  subtotalAmount: number;
}): Promise<CheckoutFinancialBreakdown> {
  return calculateCheckoutFinancials({
    customerAddress,
    discountAmount,
    shippingAmount,
    subtotalAmount,
    taxSettings: await getPublicTaxSettingsForStore(storeId)
  });
}

export type { CheckoutFinancialBreakdown, PublicTaxSettings, TaxCalculation };
