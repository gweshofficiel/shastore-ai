"use client";

import { useEffect, useMemo, useState } from "react";
import {
  selectedCurrencyFromValue,
  supportedStoreCurrencies,
  type StoreCurrencyCode,
  type StoreCurrencySettings
} from "@/lib/store-currencies";

type StorefrontCurrencySwitcherProps = {
  settings: StoreCurrencySettings;
};

function selectedFromSearch(settings: StoreCurrencySettings) {
  if (typeof window === "undefined") {
    return null;
  }

  const params = new URLSearchParams(window.location.search);
  const currency = params.get("currency");

  return currency ? selectedCurrencyFromValue(currency, settings) : null;
}

export function StorefrontCurrencySwitcher({ settings }: StorefrontCurrencySwitcherProps) {
  const initialCurrency = settings.defaultCurrency;
  const [selectedCurrency, setSelectedCurrency] = useState<StoreCurrencyCode>(initialCurrency);
  const currencies = useMemo(
    () => settings.enabledCurrencies
      .map((code) => supportedStoreCurrencies.find((currency) => currency.code === code))
      .filter((currency): currency is NonNullable<typeof currency> => Boolean(currency)),
    [settings.enabledCurrencies]
  );

  useEffect(() => {
    const saved = window.localStorage.getItem("shastore_storefront_currency");
    const selected = selectedFromSearch(settings) ?? selectedCurrencyFromValue(saved, settings);
    setSelectedCurrency(selected);
  }, [settings]);

  if (currencies.length <= 1) {
    return null;
  }

  return (
    <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-3 py-2 text-xs font-black text-ink shadow-sm backdrop-blur">
      <span>Currency</span>
      <select
        aria-label="Storefront currency"
        className="bg-transparent text-xs font-black outline-none"
        onChange={(event) => {
          const nextCurrency = selectedCurrencyFromValue(event.target.value, settings);
          const url = new URL(window.location.href);
          url.searchParams.set("currency", nextCurrency);
          window.localStorage.setItem("shastore_storefront_currency", nextCurrency);
          setSelectedCurrency(nextCurrency);
          window.location.assign(url.toString());
        }}
        value={selectedCurrency}
      >
        {currencies.map((currency) => (
          <option key={currency.code} value={currency.code}>
            {currency.code}
          </option>
        ))}
      </select>
    </label>
  );
}
