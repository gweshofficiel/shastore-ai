import "server-only";

export type HttpApiRegistrationInput = {
  customerContactId: string;
  domainName: string;
  nameserver1: string;
  nameserver2: string;
  nameserver3?: string;
  nameserver4?: string;
  nameserver5?: string;
  years: number;
};

export type HttpApiRegistrationResult = {
  actionType: string | null;
  entityId: string | null;
  error?: {
    code: string;
    message: string;
    status?: number;
  };
  orderId: string | null;
  rawResponse: unknown;
  success: boolean;
};

type HttpApiRegistrationConfig = {
  apiKey: string;
  baseUrl: string;
  resellerId: string;
};

function readEnv(key: string) {
  return process.env[key]?.trim() || null;
}

function getHttpApiRegistrationConfig(): HttpApiRegistrationConfig {
  const baseUrl = readEnv("HTTPAPI_BASE_URL");
  const resellerId = readEnv("HTTPAPI_RESELLER_ID");
  const apiKey = readEnv("HTTPAPI_API_KEY");

  if (!baseUrl || !resellerId || !apiKey) {
    throw new Error("HTTPAPI registration is not configured.");
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

function responseRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown) {
  if (typeof value === "string") {
    const trimmed = value.trim();

    return trimmed ? trimmed : null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function safeRawText(value: string) {
  return value
    .replace(/api-key=([^&\s]+)/gi, "api-key=[redacted]")
    .replace(/"api-key"\s*:\s*"[^"]+"/gi, '"api-key":"[redacted]"')
    .replace(/"api_key"\s*:\s*"[^"]+"/gi, '"api_key":"[redacted]"')
    .slice(0, 5000);
}

function safeResponseForLog(value: unknown) {
  if (typeof value === "string") {
    return safeRawText(value);
  }

  try {
    return JSON.parse(safeRawText(JSON.stringify(value)));
  } catch {
    return null;
  }
}

function providerResponseFromText({
  response,
  responseText
}: {
  response: Response;
  responseText: string;
}) {
  const rawText = safeRawText(responseText);

  return {
    rawText,
    status: response.status,
    statusText: response.statusText
  };
}

export function extractHttpApiErrorMessage(rawResponse: unknown): string | null {
  const visited = new Set<unknown>();
  const preferredKeys = [
    "message",
    "error",
    "errorMessage",
    "error_message",
    "statusText",
    "status",
    "rawText",
    "description",
    "detail"
  ];

  function visit(value: unknown): string | null {
    const directValue = stringValue(value);

    if (directValue) {
      return directValue;
    }

    if (!value || typeof value !== "object" || visited.has(value)) {
      return null;
    }

    visited.add(value);

    if (Array.isArray(value)) {
      for (const item of value) {
        const message = visit(item);

        if (message) {
          return message;
        }
      }

      return null;
    }

    const record = value as Record<string, unknown>;

    for (const key of preferredKeys) {
      const message = stringValue(record[key]);

      if (message && message.toLowerCase() !== "error") {
        return message;
      }
    }

    for (const nestedValue of Object.values(record)) {
      const message = visit(nestedValue);

      if (message && message.toLowerCase() !== "error") {
        return message;
      }
    }

    return null;
  }

  return visit(rawResponse);
}

function normalizeDomainName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "")
    .replace(/(^\.|\.$)+/g, "")
    .slice(0, 253);
}

function normalizeYears(value: number) {
  return Number.isInteger(value) && value >= 1 && value <= 10 ? value : 1;
}

function normalizeNameservers(input: HttpApiRegistrationInput) {
  return [
    input.nameserver1,
    input.nameserver2,
    input.nameserver3,
    input.nameserver4,
    input.nameserver5
  ]
    .map((nameserver) => nameserver?.trim().toLowerCase() ?? "")
    .filter(Boolean);
}

function failedRegistrationResult({
  code,
  message,
  rawResponse,
  status
}: {
  code: string;
  message: string;
  rawResponse: unknown;
  status?: number;
}): HttpApiRegistrationResult {
  return {
    actionType: null,
    entityId: null,
    error: {
      code,
      message,
      status
    },
    orderId: null,
    rawResponse,
    success: false
  };
}

export async function registerDomainOrder(
  input: HttpApiRegistrationInput
): Promise<HttpApiRegistrationResult> {
  const domainName = normalizeDomainName(input.domainName);
  const years = normalizeYears(input.years);
  const customerContactId = input.customerContactId.trim();
  const nameservers = normalizeNameservers(input);

  console.info("domain_registration_started", {
    domainName,
    nameserverCount: nameservers.length,
    provider: "httpapi",
    years
  });

  if (!domainName || !customerContactId || nameservers.length < 2) {
    const result = failedRegistrationResult({
      code: "missing_registration_input",
      message: "Domain registration requires a domain, customer contact ID, and at least two nameservers.",
      rawResponse: null
    });

    console.error("domain_registration_failed", {
      code: result.error?.code,
      domainName,
      message: result.error?.message,
      provider: "httpapi"
    });

    return result;
  }

  try {
    const config = getHttpApiRegistrationConfig();
    const url = new URL(`${config.baseUrl}/api/domains/register.json`);
    url.searchParams.set("auth-userid", config.resellerId);
    url.searchParams.set("api-key", config.apiKey);
    url.searchParams.set("domain-name", domainName);
    url.searchParams.set("years", String(years));
    url.searchParams.set("customer-id", customerContactId);
    url.searchParams.set("reg-contact-id", customerContactId);
    url.searchParams.set("admin-contact-id", customerContactId);
    url.searchParams.set("tech-contact-id", customerContactId);
    url.searchParams.set("billing-contact-id", customerContactId);
    url.searchParams.set("invoice-option", "NoInvoice");
    url.searchParams.set("auto-renew", "false");
    url.searchParams.set("purchase-privacy", "false");

    for (const nameserver of nameservers) {
      url.searchParams.append("ns", nameserver);
    }

    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        Accept: "application/json"
      },
      method: "POST"
    });
    const responseText = await response.text().catch(() => "");
    let rawResponse: unknown = null;

    try {
      rawResponse = responseText ? JSON.parse(responseText) : null;
    } catch {
      rawResponse = providerResponseFromText({ response, responseText });
    }

    const raw = responseRecord(rawResponse);
    const providerStatus = stringValue(raw.status)?.toLowerCase() ?? null;
    const loggedResponse = safeResponseForLog(rawResponse);

    console.info("httpapi_registration_response", {
      domainName,
      provider: "httpapi",
      response: loggedResponse,
      status: response.status,
      statusText: response.statusText
    });

    if (!response.ok || providerStatus === "error") {
      const message =
        extractHttpApiErrorMessage(rawResponse) ??
        response.statusText ??
        "HTTPAPI domain registration failed.";
      const result = failedRegistrationResult({
        code: providerStatus === "error" ? "httpapi_registration_error" : "httpapi_registration_http_error",
        message,
        rawResponse: rawResponse ?? providerResponseFromText({ response, responseText }),
        status: response.status
      });

      console.error("httpapi_registration_failed_response", {
        domainName,
        message: result.error?.message,
        provider: "httpapi",
        response: loggedResponse,
        status: response.status,
        statusText: response.statusText
      });

      console.error("domain_registration_failed", {
        domainName,
        message: result.error?.message,
        provider: "httpapi",
        status: response.status
      });

      return result;
    }

    const entityId = stringValue(raw.entityid ?? raw.entityId);
    const orderId = stringValue(raw.orderid ?? raw.orderId ?? raw.entityid ?? raw.entityId);
    const actionType = stringValue(raw.actiontype ?? raw.actionType);

    if (!entityId && !orderId) {
      const message =
        extractHttpApiErrorMessage(rawResponse) ??
        "HTTPAPI registration succeeded without a provider order identifier.";
      const result = failedRegistrationResult({
        code: "httpapi_registration_missing_order_id",
        message,
        rawResponse
      });

      console.error("httpapi_registration_failed_response", {
        domainName,
        message: result.error?.message,
        provider: "httpapi",
        response: loggedResponse,
        status: response.status,
        statusText: response.statusText
      });

      console.error("domain_registration_failed", {
        code: result.error?.code,
        domainName,
        message: result.error?.message,
        provider: "httpapi"
      });

      return result;
    }

    console.info("domain_registration_success", {
      actionStatus: stringValue(raw.actionstatus ?? raw.actionStatus),
      actionType,
      domainName,
      entityId,
      orderId,
      provider: "httpapi"
    });

    return {
      actionType,
      entityId,
      orderId,
      rawResponse,
      success: true
    };
  } catch (error) {
    const result = failedRegistrationResult({
      code: "httpapi_registration_exception",
      message: error instanceof Error ? error.message : String(error),
      rawResponse: null
    });

    console.error("domain_registration_failed", {
      domainName,
      message: result.error?.message,
      provider: "httpapi"
    });

    return result;
  }
}
