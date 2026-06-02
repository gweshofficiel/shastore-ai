"use client";

import { useEffect, useMemo, useState } from "react";
import {
  languageDirection,
  storefrontLanguageDefinitions,
  type StoreLanguageCode,
  type StoreLanguageSettings
} from "@/lib/store-languages";

type StorefrontLanguageSwitcherProps = {
  settings: StoreLanguageSettings;
};

function selectedFromSearch(enabledLanguages: StoreLanguageCode[]) {
  if (typeof window === "undefined") {
    return null;
  }

  const params = new URLSearchParams(window.location.search);
  const lang = params.get("lang") as StoreLanguageCode | null;

  return lang && enabledLanguages.includes(lang) ? lang : null;
}

export function StorefrontLanguageSwitcher({ settings }: StorefrontLanguageSwitcherProps) {
  const enabledLanguages = settings.enabledLanguages;
  const initialLanguage = settings.defaultLanguage;
  const [selectedLanguage, setSelectedLanguage] = useState<StoreLanguageCode>(initialLanguage);
  const languages = useMemo(
    () => enabledLanguages
      .map((code) => storefrontLanguageDefinitions.find((language) => language.code === code))
      .filter((language): language is NonNullable<typeof language> => Boolean(language)),
    [enabledLanguages]
  );

  useEffect(() => {
    const saved = window.localStorage.getItem("shastore_storefront_language") as StoreLanguageCode | null;
    const selected = selectedFromSearch(enabledLanguages) ?? (saved && enabledLanguages.includes(saved) ? saved : null) ?? initialLanguage;

    setSelectedLanguage(selected);
  }, [enabledLanguages, initialLanguage]);

  useEffect(() => {
    document.documentElement.lang = selectedLanguage;
    document.documentElement.dir = languageDirection(selectedLanguage);
    window.localStorage.setItem("shastore_storefront_language", selectedLanguage);
  }, [selectedLanguage]);

  if (languages.length <= 1) {
    return null;
  }

  return (
    <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-3 py-2 text-xs font-black text-ink shadow-sm backdrop-blur">
      <span>Language</span>
      <select
        aria-label="Storefront language"
        className="bg-transparent text-xs font-black outline-none"
        onChange={(event) => {
          const nextLanguage = event.target.value as StoreLanguageCode;
          const url = new URL(window.location.href);
          url.searchParams.set("lang", nextLanguage);
          window.history.replaceState(null, "", url.toString());
          setSelectedLanguage(nextLanguage);
        }}
        value={selectedLanguage}
      >
        {languages.map((language) => (
          <option key={language.code} value={language.code}>
            {language.nativeLabel}
          </option>
        ))}
      </select>
    </label>
  );
}
