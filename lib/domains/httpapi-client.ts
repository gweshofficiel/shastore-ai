import "server-only";
import { normalizeDomainExtension } from "@/lib/domains/extension-catalog";

export type HttpApiDomainAvailabilityResult = {
  available: boolean;
  domain: string;
  extension: string;
  pricePreview: null;
  provider: "httpapi";
  rawStatus: string;
};

type HttpApiAvailabilityInput = {
  domainName: string;
  extensions: string[];
};

type HttpApiConfig = {
  apiKey: string;
  baseUrl: string;
  resellerId: string;
};

export class HttpApiConfigurationError extends Error {
  constructor(message = "HTTPAPI domain search is not configured.") {
    super(message);
    this.name = "HttpApiConfigurationError";
  }
}

function readEnv(key: string) {
  return process.env[key]?.trim() || null;
}

export function getHttpApiReadiness() {
  const baseUrl = readEnv("HTTPAPI_BASE_URL");
  const resellerId = readEnv("HTTPAPI_RESELLER_ID");
  const apiKey = readEnv("HTTPAPI_API_KEY");

  return {
    enabled: Boolean(baseUrl && resellerId && apiKey),
    hasApiKey: Boolean(apiKey),
    hasBaseUrl: Boolean(baseUrl),
    hasResellerId: Boolean(resellerId)
  };
}

function getHttpApiConfig(): HttpApiConfig {
  const baseUrl = readEnv("HTTPAPI_BASE_URL");
  const resellerId = readEnv("HTTPAPI_RESELLER_ID");
  const apiKey = readEnv("HTTPAPI_API_KEY");

  if (!baseUrl || !resellerId || !apiKey) {
    throw new HttpApiConfigurationError();
  }

  const url = new URL(baseUrl);

  if (url.protocol !== "https:") {
    throw new HttpApiConfigurationError("HTTPAPI_BASE_URL must use HTTPS.");
  }

  return {
    apiKey,
    baseUrl: url.toString().replace(/\/+$/, ""),
    resellerId
  };
}

function normalizeSearchLabel(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/^\.+|\.+$/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 63);
}

function extensionWithoutDot(value: string) {
  return normalizeDomainExtension(value).replace(/^\./, "");
}

function responseRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function statusFromProviderValue(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  const record = responseRecord(value);
  const status = record.status ?? record.availability ?? record.available;

  if (typeof status === "boolean") {
    return status ? "available" : "unavailable";
  }

  return typeof status === "string" ? status : "unknown";
}

function isAvailableStatus(status: string) {
  return ["available", "avail"].includes(status.toLowerCase());
}

function resultForExtension({
  domainName,
  extension,
  raw
}: {
  domainName: string;
  extension: string;
  raw: Record<string, unknown>;
}): HttpApiDomainAvailabilityResult {
  const tld = extensionWithoutDot(extension);
  const normalizedExtension = normalizeDomainExtension(extension);
  const domain = `${domainName}.${tld}`;
  const rawValue = raw[domain] ?? raw[`${domainName}${normalizedExtension}`] ?? raw[tld] ?? raw[normalizedExtension];
  const rawStatus = statusFromProviderValue(rawValue);

  return {
    available: isAvailableStatus(rawStatus),
    domain,
    extension: normalizedExtension,
    pricePreview: null,
    provider: "httpapi",
    rawStatus
  };
}

export async function searchHttpApiDomainAvailability({
  domainName,
  extensions
}: HttpApiAvailabilityInput): Promise<HttpApiDomainAvailabilityResult[]> {
  const config = getHttpApiConfig();
  const normalizedDomainName = normalizeSearchLabel(domainName);
  const normalizedExtensions = Array.from(new Set(extensions.map(extensionWithoutDot))).filter(Boolean);

  if (!normalizedDomainName || !normalizedExtensions.length) {
    return [];
  }

  console.info("domain_search_started", {
    domainName: normalizedDomainName,
    extensionCount: normalizedExtensions.length,
    provider: "httpapi"
  });

  const url = new URL(`${config.baseUrl}/api/domains/available.json`);
  url.searchParams.set("auth-userid", config.resellerId);
  url.searchParams.set("api-key", config.apiKey);
  url.searchParams.set("domain-name", normalizedDomainName);

  for (const extension of normalizedExtensions) {
    url.searchParams.append("tlds", extension);
  }

  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        Accept: "application/json"
      }
    });
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      console.error("domain_search_failed", {
        domainName: normalizedDomainName,
        provider: "httpapi",
        status: response.status,
        statusText: response.statusText
      });
      throw new Error("HTTPAPI domain availability request failed.");
    }

    const raw = responseRecord(data);
    const results = normalizedExtensions.map((extension) =>
      resultForExtension({
        domainName: normalizedDomainName,
        extension,
        raw
      })
    );

    console.info("domain_search_completed", {
      availableCount: results.filter((result) => result.available).length,
      domainName: normalizedDomainName,
      resultCount: results.length,
      provider: "httpapi"
    });

    return results;
  } catch (error) {
    console.error("domain_search_failed", {
      domainName: normalizedDomainName,
      message: error instanceof Error ? error.message : String(error),
      provider: "httpapi"
    });
    throw error;
  }
}
