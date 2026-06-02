export type StoreLanguageCode =
  | "tzm-Tfng"
  | "en"
  | "ar"
  | "fr"
  | "es"
  | "de"
  | "it"
  | "pt"
  | "tr"
  | "nl"
  | "ru"
  | "zh"
  | "hi"
  | "id"
  | "ja"
  | "ko";

export type StoreLanguageDefinition = {
  code: StoreLanguageCode;
  direction: "ltr" | "rtl";
  label: string;
  nativeLabel: string;
};

export type StoreLanguageSettings = {
  defaultLanguage: StoreLanguageCode;
  enabledLanguages: StoreLanguageCode[];
};

export type StoreTranslations = Record<string, Record<string, string>>;

export const tifinaghAmazighLanguageCode: StoreLanguageCode = "tzm-Tfng";

export const storefrontLanguageDefinitions: readonly StoreLanguageDefinition[] = [
  { code: "tzm-Tfng", direction: "ltr", label: "Tifinagh Amazigh", nativeLabel: "ⵜⴰⵎⴰⵣⵉⵖⵜ" },
  { code: "en", direction: "ltr", label: "English", nativeLabel: "English" },
  { code: "ar", direction: "rtl", label: "Arabic", nativeLabel: "العربية" },
  { code: "fr", direction: "ltr", label: "French", nativeLabel: "Français" },
  { code: "es", direction: "ltr", label: "Spanish", nativeLabel: "Español" },
  { code: "de", direction: "ltr", label: "German", nativeLabel: "Deutsch" },
  { code: "it", direction: "ltr", label: "Italian", nativeLabel: "Italiano" },
  { code: "pt", direction: "ltr", label: "Portuguese", nativeLabel: "Português" },
  { code: "tr", direction: "ltr", label: "Turkish", nativeLabel: "Türkçe" },
  { code: "nl", direction: "ltr", label: "Dutch", nativeLabel: "Nederlands" },
  { code: "ru", direction: "ltr", label: "Russian", nativeLabel: "Русский" },
  { code: "zh", direction: "ltr", label: "Chinese", nativeLabel: "中文" },
  { code: "hi", direction: "ltr", label: "Hindi", nativeLabel: "हिन्दी" },
  { code: "id", direction: "ltr", label: "Indonesian", nativeLabel: "Bahasa Indonesia" },
  { code: "ja", direction: "ltr", label: "Japanese", nativeLabel: "日本語" },
  { code: "ko", direction: "ltr", label: "Korean", nativeLabel: "한국어" }
] as const;

const languageCodes = new Set<StoreLanguageCode>(storefrontLanguageDefinitions.map((language) => language.code));

export const defaultStoreLanguageSettings: StoreLanguageSettings = {
  defaultLanguage: tifinaghAmazighLanguageCode,
  enabledLanguages: [tifinaghAmazighLanguageCode]
};

export function isStoreLanguageCode(value: unknown): value is StoreLanguageCode {
  return languageCodes.has(value as StoreLanguageCode);
}

export function languageDirection(code: StoreLanguageCode) {
  return storefrontLanguageDefinitions.find((language) => language.code === code)?.direction ?? "ltr";
}

export function normalizeStoreLanguageSettings(value: unknown): StoreLanguageSettings {
  const input = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const rawEnabled = Array.isArray(input.enabledLanguages) ? input.enabledLanguages : [];
  const enabled = rawEnabled.filter(isStoreLanguageCode);
  const enabledLanguages = Array.from(new Set([tifinaghAmazighLanguageCode, ...enabled.filter((code) => code !== tifinaghAmazighLanguageCode)]));
  const defaultLanguage = isStoreLanguageCode(input.defaultLanguage) && enabledLanguages.includes(input.defaultLanguage)
    ? input.defaultLanguage
    : enabledLanguages[0];

  return {
    defaultLanguage,
    enabledLanguages
  };
}

export function normalizeEnabledLanguageOrder(codes: StoreLanguageCode[]) {
  const selected = new Set(codes);
  return storefrontLanguageDefinitions
    .map((language) => language.code)
    .filter((code) => code === tifinaghAmazighLanguageCode || selected.has(code));
}

export function translateField({
  defaultLanguage,
  fallback,
  field,
  language,
  translations
}: {
  defaultLanguage: StoreLanguageCode;
  fallback: string | null | undefined;
  field: string;
  language: StoreLanguageCode;
  translations: unknown;
}) {
  if (!translations || typeof translations !== "object" || Array.isArray(translations)) {
    return fallback ?? "";
  }

  const record = translations as StoreTranslations;
  const selected = record[language]?.[field]?.trim();
  const defaultValue = record[defaultLanguage]?.[field]?.trim();

  return selected || defaultValue || fallback || "";
}
