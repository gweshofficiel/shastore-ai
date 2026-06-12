import "server-only";
import { normalizeDomainExtension } from "@/lib/domains/extension-catalog";

export type HttpApiDomainAvailabilityResult = {
  available: boolean;
  domain: string;
  extension: string;
  priceCents: number;
  provider: "httpapi";
  rawPrice: string;
  rawStatus: string;
};

type HttpApiAvailabilityInput = {
  domainName: string;
  extensions: string[];
};

type HttpApiResellerPricingInput = {
  extensions: string[];
};

type HttpApiResellerPriceResult = {
  extension: string;
  priceCents: number;
  rawPrice: string;
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

export class HttpApiProviderError extends Error {
  constructor(message = "HTTPAPI rejected the request. Check reseller IP whitelist or credentials.") {
    super(message);
    this.name = "HttpApiProviderError";
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

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new HttpApiConfigurationError("HTTPAPI_BASE_URL must use HTTP or HTTPS.");
  }

  return {
    apiKey,
    baseUrl: url.toString().replace(/\/+$/, ""),
    resellerId
  };
}

function logHttpApiProxyBaseUrlUsed({
  baseUrl,
  stage
}: {
  baseUrl: string;
  stage: "availability" | "pricing";
}) {
  console.info("httpapi_proxy_base_url_used", {
    baseUrl,
    provider: "httpapi",
    stage
  });
}

function logHttpApiUpstreamStatus({
  response,
  stage,
  url
}: {
  response: Response;
  stage: "availability" | "pricing";
  url: URL;
}) {
  console.info("httpapi_upstream_status", {
    endpoint: `${url.origin}${url.pathname}`,
    ok: response.ok,
    provider: "httpapi",
    stage,
    status: response.status,
    statusText: response.statusText
  });
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

function safeHttpApiErrorBody(value: unknown) {
  const text =
    typeof value === "string"
      ? value
      : value === null || value === undefined
        ? ""
        : JSON.stringify(value);

  return text
    .replace(/api-key=([^&\s]+)/gi, "api-key=[redacted]")
    .replace(/"api-key"\s*:\s*"[^"]+"/gi, '"api-key":"[redacted]"')
    .replace(/"api_key"\s*:\s*"[^"]+"/gi, '"api_key":"[redacted]"')
    .slice(0, 2000);
}

async function readSafeHttpApiErrorBody(response: Response) {
  const rawBody = await response.text().catch(() => "");

  return safeHttpApiErrorBody(rawBody);
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

function parseMoneyToCents(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value * 100);
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.replace(/,/g, "").trim();
  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
}

function findAddNewDomainPrice(value: unknown): { cents: number; rawPrice: string } | null {
  const record = responseRecord(value);

  if (!Object.keys(record).length) {
    return null;
  }

  const pricing = responseRecord(record.pricing);
  const addNewDomain = responseRecord(pricing.addnewdomain ?? record.addnewdomain);
  const rawPrice = addNewDomain["1"] ?? addNewDomain[1] ?? addNewDomain["1.0"];
  const cents = parseMoneyToCents(rawPrice);

  if (cents !== null) {
    return {
      cents,
      rawPrice: String(rawPrice)
    };
  }

  for (const nested of Object.values(record)) {
    const found = findAddNewDomainPrice(nested);

    if (found) {
      return found;
    }
  }

  return null;
}

function pricingCandidateKeys(extension: string) {
  const tld = extensionWithoutDot(extension);

  return [
    tld,
    `.${tld}`,
    tld.toUpperCase(),
    `.${tld.toUpperCase()}`,
    `dot${tld}`,
    `dom${tld}`,
    `domain${tld}`
  ];
}

function priceForExtension({
  extension,
  raw,
  singleExtension
}: {
  extension: string;
  raw: Record<string, unknown>;
  singleExtension: boolean;
}): HttpApiResellerPriceResult | null {
  for (const key of pricingCandidateKeys(extension)) {
    const found = findAddNewDomainPrice(raw[key]);

    if (found) {
      return {
        extension: normalizeDomainExtension(extension),
        priceCents: found.cents,
        rawPrice: found.rawPrice
      };
    }
  }

  const tld = extensionWithoutDot(extension);

  for (const [key, value] of Object.entries(raw)) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");

    if (normalizedKey === tld || normalizedKey === `dot${tld}` || normalizedKey === `dom${tld}`) {
      const found = findAddNewDomainPrice(value);

      if (found) {
        return {
          extension: normalizeDomainExtension(extension),
          priceCents: found.cents,
          rawPrice: found.rawPrice
        };
      }
    }
  }

  if (singleExtension) {
    const found = findAddNewDomainPrice(raw);

    if (found) {
      return {
        extension: normalizeDomainExtension(extension),
        priceCents: found.cents,
        rawPrice: found.rawPrice
      };
    }
  }

  return null;
}

function resultForExtension({
  domainName,
  extension,
  price,
  raw
}: {
  domainName: string;
  extension: string;
  price: HttpApiResellerPriceResult;
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
    priceCents: price.priceCents,
    provider: "httpapi",
    rawPrice: price.rawPrice,
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

  console.info("httpapi_availability_started", {
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

  logHttpApiProxyBaseUrlUsed({
    baseUrl: config.baseUrl,
    stage: "availability"
  });

  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        Accept: "application/json"
      }
    });
    logHttpApiUpstreamStatus({
      response,
      stage: "availability",
      url
    });
    const rawBody = response.ok ? await response.text().catch(() => "") : "";

    if (!response.ok) {
      const responseBody = await readSafeHttpApiErrorBody(response);

      // Vercel outbound IPs can change unless traffic uses a fixed egress IP/proxy.
      // Production HTTPAPI access therefore requires a whitelisted fixed egress path.
      console.error("httpapi_domain_search_failed", {
        domainName: normalizedDomainName,
        provider: "httpapi",
        responseBody,
        stage: "availability",
        status: response.status,
        statusText: response.statusText
      });
      throw new HttpApiProviderError();
    }

    const data = rawBody ? JSON.parse(rawBody) : null;
    const raw = responseRecord(data);
    const placeholderPrice = {
      extension: "",
      priceCents: 0,
      rawPrice: "0"
    };
    const results = normalizedExtensions.map((extension) =>
      resultForExtension({
        domainName: normalizedDomainName,
        extension,
        price: placeholderPrice,
        raw
      })
    );

    console.info("httpapi_availability_completed", {
      availableCount: results.filter((result) => result.available).length,
      domainName: normalizedDomainName,
      resultCount: results.length,
      provider: "httpapi"
    });

    return results;
  } catch (error) {
    console.error("httpapi_domain_search_failed", {
      domainName: normalizedDomainName,
      message: error instanceof Error ? error.message : String(error),
      provider: "httpapi",
      stage: "availability"
    });
    throw error;
  }
}

export async function getHttpApiResellerPrices({
  extensions
}: HttpApiResellerPricingInput): Promise<HttpApiResellerPriceResult[]> {
  const config = getHttpApiConfig();
  const normalizedExtensions = Array.from(new Set(extensions.map(extensionWithoutDot))).filter(Boolean);

  if (!normalizedExtensions.length) {
    return [];
  }

  console.info("httpapi_pricing_started", {
    extensionCount: normalizedExtensions.length,
    provider: "httpapi"
  });

  const url = new URL(`${config.baseUrl}/api/products/reseller-price.json`);
  url.searchParams.set("auth-userid", config.resellerId);
  url.searchParams.set("api-key", config.apiKey);

  for (const extension of normalizedExtensions) {
    url.searchParams.append("tlds", extension);
  }

  logHttpApiProxyBaseUrlUsed({
    baseUrl: config.baseUrl,
    stage: "pricing"
  });

  try {
    const pricingResponse = await fetch(url, {
      cache: "no-store",
      headers: {
        Accept: "application/json"
      }
    });
    console.log('PRICING_STATUS', pricingResponse.status);
    console.log('PRICING_TEXT', await pricingResponse.clone().text());
    logHttpApiUpstreamStatus({
      response: pricingResponse,
      stage: "pricing",
      url
    });
    const rawBody = pricingResponse.ok ? await pricingResponse.text().catch(() => "") : "";

    if (!pricingResponse.ok) {
      const responseBody = await readSafeHttpApiErrorBody(pricingResponse);

      // Vercel outbound IPs can change unless traffic uses a fixed egress IP/proxy.
      // Production HTTPAPI access therefore requires a whitelisted fixed egress path.
      console.error("httpapi_domain_search_failed", {
        provider: "httpapi",
        responseBody,
        stage: "pricing",
        status: pricingResponse.status,
        statusText: pricingResponse.statusText
      });
      throw new HttpApiProviderError();
    }

    const responseBody = rawBody;
    console.log('httpapi_pricing_raw_response', JSON.stringify(responseBody));

    const data = rawBody ? JSON.parse(rawBody) : null;
    const raw = responseRecord(data);
    const results = normalizedExtensions.map((extension) => {
      const price = priceForExtension({
        extension,
        raw,
        singleExtension: normalizedExtensions.length === 1
      });

      if (!price) {
        throw new Error(`HTTPAPI reseller price missing for .${extension}.`);
      }

      return price;
    });

    console.info("httpapi_pricing_completed", {
      priceCount: results.length,
      provider: "httpapi"
    });

    return results;
  } catch (error) {
    console.error("httpapi_domain_search_failed", {
      message: error instanceof Error ? error.message : String(error),
      provider: "httpapi",
      stage: "pricing"
    });
    throw error;
  }
}

export async function searchHttpApiDomains({
  domainName,
  extensions
}: HttpApiAvailabilityInput): Promise<HttpApiDomainAvailabilityResult[]> {
  const availability = await searchHttpApiDomainAvailability({ domainName, extensions });
  const prices = await getHttpApiResellerPrices({ extensions });
  const priceByExtension = new Map(prices.map((price) => [price.extension, price]));

  return availability.map((result) => {
    const price = priceByExtension.get(result.extension);

    if (!price) {
      throw new Error(`HTTPAPI reseller price missing for ${result.extension}.`);
    }

    return {
      ...result,
      priceCents: price.priceCents,
      rawPrice: price.rawPrice
    };
  });
}
