import "server-only";

export type HttpApiDomainProviderStatus =
  | "active"
  | "failed"
  | "locked_processing"
  | "pending"
  | "suspended"
  | "unknown";

export type HttpApiDomainStatusInput = {
  domainName: string;
  providerEntityId?: string | null;
  providerOrderId?: string | null;
};

export type HttpApiDomainStatusResult = {
  endpoint: "details-by-name" | "search";
  error?: {
    code: string;
    message: string;
    status?: number;
  };
  providerResponse: unknown;
  providerStatus: HttpApiDomainProviderStatus;
  providerStatusText: string | null;
  success: boolean;
};

type HttpApiStatusConfig = {
  apiKey: string;
  baseUrl: string;
  resellerId: string;
};

const sensitiveKeys = [
  "apikey",
  "auth",
  "authorization",
  "password",
  "privatekey",
  "secret",
  "token"
];

function readEnv(key: string) {
  return process.env[key]?.trim() || null;
}

function getHttpApiStatusConfig(): HttpApiStatusConfig {
  const baseUrl = readEnv("HTTPAPI_BASE_URL");
  const resellerId = readEnv("HTTPAPI_RESELLER_ID");
  const apiKey = readEnv("HTTPAPI_API_KEY");

  if (!baseUrl || !resellerId || !apiKey) {
    throw new Error("HTTPAPI status sync is not configured.");
  }

  const url = new URL(baseUrl);

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("HTTPAPI_BASE_URL must use HTTP or HTTPS.");
  }

  return {
    apiKey,
    baseUrl: url.toString().replace(/\/+$/, ""),
    resellerId
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function textValue(value: unknown) {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function normalizedKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isSensitiveKey(value: string) {
  const key = normalizedKey(value);

  return sensitiveKeys.some((part) => key.includes(part));
}

function safeText(value: string) {
  return value
    .replace(
      /((?:api[-_]?key|api_key|token|secret|password|auth|authorization|private[-_]?key)=)[^&\s"']+/gi,
      "$1[redacted]"
    )
    .replace(
      /((?:api[-_]?key|api_key|token|secret|password|auth|authorization|private[-_]?key)["']?\s*:\s*["']?)[^"',}\s]+/gi,
      "$1[redacted]"
    )
    .slice(0, 10000);
}

export function safeHttpApiStatusResponse(value: unknown): unknown {
  if (typeof value === "string") {
    return safeText(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => safeHttpApiStatusResponse(item));
  }

  if (!isRecord(value)) {
    return value ?? null;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, nestedValue]) => [
      key,
      isSensitiveKey(key) ? "[redacted]" : safeHttpApiStatusResponse(nestedValue)
    ])
  );
}

function providerResponseFromText({
  response,
  responseText
}: {
  response: Response;
  responseText: string;
}) {
  return {
    rawText: safeText(responseText),
    status: response.status,
    statusText: response.statusText
  };
}

function firstNestedText(value: unknown, keys: string[]): string | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = firstNestedText(item, keys);

      if (nested) {
        return nested;
      }
    }

    return null;
  }

  if (!isRecord(value)) {
    return null;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    if (keys.includes(normalizedKey(key))) {
      const direct = textValue(nestedValue);

      if (direct) {
        return direct;
      }
    }
  }

  for (const nestedValue of Object.values(value)) {
    const nested = firstNestedText(nestedValue, keys);

    if (nested) {
      return nested;
    }
  }

  return null;
}

export function mapHttpApiProviderStatus(value: string | null): HttpApiDomainProviderStatus {
  const status = value?.toLowerCase() ?? "";

  if (!status) return "unknown";
  if (status.includes("lock") || status.includes("processing")) return "locked_processing";
  if (status.includes("suspend")) return "suspended";
  if (status.includes("active") && !status.includes("inactive")) return "active";
  if (status.includes("fail") || status.includes("delete") || status.includes("archiv") || status.includes("error")) return "failed";
  if (status.includes("pending") || status.includes("inactive") || status.includes("verification")) return "pending";

  return "unknown";
}

function providerStatusText(rawResponse: unknown) {
  return firstNestedText(rawResponse, [
    "actionstatus",
    "currentstatus",
    "entitycurrentstatus",
    "orderstatus",
    "status"
  ]);
}

function failedStatusResult({
  code,
  endpoint,
  message,
  providerResponse,
  providerStatus = "unknown",
  status
}: {
  code: string;
  endpoint: HttpApiDomainStatusResult["endpoint"];
  message: string;
  providerResponse: unknown;
  providerStatus?: HttpApiDomainProviderStatus;
  status?: number;
}): HttpApiDomainStatusResult {
  return {
    endpoint,
    error: {
      code,
      message,
      status
    },
    providerResponse,
    providerStatus,
    providerStatusText: null,
    success: false
  };
}

export async function fetchHttpApiDomainStatus({
  domainName,
  providerEntityId,
  providerOrderId
}: HttpApiDomainStatusInput): Promise<HttpApiDomainStatusResult> {
  const config = getHttpApiStatusConfig();
  const endpoint: HttpApiDomainStatusResult["endpoint"] = providerOrderId ? "search" : "details-by-name";
  const url = new URL(
    endpoint === "search"
      ? `${config.baseUrl}/api/domains/search.json`
      : `${config.baseUrl}/api/domains/details-by-name.json`
  );

  url.searchParams.set("auth-userid", config.resellerId);
  url.searchParams.set("api-key", config.apiKey);

  if (endpoint === "search") {
    url.searchParams.set("no-of-records", "10");
    url.searchParams.set("page-no", "1");
    url.searchParams.set("order-id", providerOrderId ?? "");
  } else {
    url.searchParams.set("domain-name", domainName);
    url.searchParams.append("options", "All");
  }

  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/json"
    },
    method: "GET"
  });
  const responseText = await response.text().catch(() => "");
  let rawResponse: unknown = null;

  try {
    rawResponse = responseText ? JSON.parse(responseText) : null;
  } catch {
    rawResponse = providerResponseFromText({ response, responseText });
  }

  const safeResponse = safeHttpApiStatusResponse(rawResponse);
  const statusText = providerStatusText(rawResponse);
  const providerStatus = mapHttpApiProviderStatus(statusText);

  if (!response.ok) {
    return failedStatusResult({
      code: "httpapi_status_http_error",
      endpoint,
      message: response.statusText || "HTTPAPI domain status lookup failed.",
      providerResponse: safeResponse,
      providerStatus,
      status: response.status
    });
  }

  return {
    endpoint,
    providerResponse: safeResponse,
    providerStatus,
    providerStatusText: statusText ?? (providerEntityId ? `entity:${providerEntityId}` : null),
    success: true
  };
}
