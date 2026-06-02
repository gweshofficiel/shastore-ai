export type StoreCurrencyCode = "MAD" | "USD" | "EUR" | "GBP" | "AED" | "SAR" | "CAD" | "AUD" | "TRY";

export type StoreCurrencyDefinition = {
  code: StoreCurrencyCode;
  label: string;
  symbol: string;
};

export type StoreCurrencySettings = {
  defaultCurrency: StoreCurrencyCode;
  enabledCurrencies: StoreCurrencyCode[];
  manualRates: Record<StoreCurrencyCode, number>;
};

export const supportedStoreCurrencies: readonly StoreCurrencyDefinition[] = [
  { code: "MAD", label: "Moroccan Dirham", symbol: "MAD" },
  { code: "USD", label: "US Dollar", symbol: "$" },
  { code: "EUR", label: "Euro", symbol: "€" },
  { code: "GBP", label: "British Pound", symbol: "£" },
  { code: "AED", label: "UAE Dirham", symbol: "AED" },
  { code: "SAR", label: "Saudi Riyal", symbol: "SAR" },
  { code: "CAD", label: "Canadian Dollar", symbol: "CA$" },
  { code: "AUD", label: "Australian Dollar", symbol: "A$" },
  { code: "TRY", label: "Turkish Lira", symbol: "TRY" }
] as const;

const currencyCodes = new Set<StoreCurrencyCode>(supportedStoreCurrencies.map((currency) => currency.code));

export function isStoreCurrencyCode(value: unknown): value is StoreCurrencyCode {
  return currencyCodes.has(String(value).toUpperCase() as StoreCurrencyCode);
}

export function normalizeStoreCurrencyCode(value: unknown, fallback: StoreCurrencyCode = "MAD"): StoreCurrencyCode {
  const code = String(value ?? "").trim().toUpperCase();
  return isStoreCurrencyCode(code) ? code : fallback;
}

export function normalizeStoreCurrencySettings(
  value: unknown,
  fallbackDefault: string | null | undefined = "MAD"
): StoreCurrencySettings {
  const input = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const defaultCurrency = normalizeStoreCurrencyCode(input.defaultCurrency, normalizeStoreCurrencyCode(fallbackDefault));
  const rawEnabled = Array.isArray(input.enabledCurrencies) ? input.enabledCurrencies : [];
  const enabled = rawEnabled.map((code) => normalizeStoreCurrencyCode(code, defaultCurrency));
  const enabledCurrencies = Array.from(new Set([defaultCurrency, ...enabled]))
    .filter(isStoreCurrencyCode)
    .sort((left, right) => {
      const leftIndex = supportedStoreCurrencies.findIndex((currency) => currency.code === left);
      const rightIndex = supportedStoreCurrencies.findIndex((currency) => currency.code === right);
      return leftIndex - rightIndex;
    });
  const rawRates = input.manualRates && typeof input.manualRates === "object" && !Array.isArray(input.manualRates)
    ? input.manualRates as Record<string, unknown>
    : {};
  const manualRates = supportedStoreCurrencies.reduce((rates, currency) => {
    const rawRate = Number(rawRates[currency.code]);
    rates[currency.code] = currency.code === defaultCurrency
      ? 1
      : Number.isFinite(rawRate) && rawRate > 0
        ? Number(rawRate.toFixed(8))
        : 1;
    return rates;
  }, {} as Record<StoreCurrencyCode, number>);

  return {
    defaultCurrency,
    enabledCurrencies,
    manualRates
  };
}

export function selectedCurrencyFromValue(value: unknown, settings: StoreCurrencySettings) {
  const selected = normalizeStoreCurrencyCode(value, settings.defaultCurrency);
  return settings.enabledCurrencies.includes(selected) ? selected : settings.defaultCurrency;
}

export function exchangeRateForCurrency(settings: StoreCurrencySettings, currency: StoreCurrencyCode) {
  return currency === settings.defaultCurrency ? 1 : settings.manualRates[currency] || 1;
}

export function convertCurrencyAmount(
  amount: number,
  settings: StoreCurrencySettings,
  currency: StoreCurrencyCode
) {
  const rate = exchangeRateForCurrency(settings, currency);
  return Number((amount * rate).toFixed(2));
}

export function formatCurrencyAmount(amount: number, currency: StoreCurrencyCode) {
  return new Intl.NumberFormat("en", {
    currency,
    style: "currency"
  }).format(amount);
}
