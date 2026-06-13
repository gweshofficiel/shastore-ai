import "server-only";

export type HttpApiRegistrationInput = {
  adminContactId: string;
  billingContactId: string;
  customerId: string;
  domainName: string;
  nameserver1: string;
  nameserver2: string;
  nameserver3?: string;
  nameserver4?: string;
  nameserver5?: string;
  registrantContactId: string;
  techContactId: string;
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

export type HttpApiContactCreateInput = {
  customerId?: string;
};

type HttpApiContactCreateResult = {
  contactId: string | null;
  error?: {
    code: string;
    message: string;
    status?: number;
  };
  rawResponse: unknown;
  success: boolean;
};

type HttpApiRegistrationConfig = {
  apiKey: string;
  baseUrl: string;
  resellerId: string;
};

type HttpApiContactEnvField = {
  envKey: string;
  param: string;
};

const CONTACT_ENV_FIELDS: readonly HttpApiContactEnvField[] = [
  { envKey: "HTTPAPI_REGISTRATION_CONTACT_NAME", param: "name" },
  { envKey: "HTTPAPI_REGISTRATION_CONTACT_COMPANY", param: "company" },
  { envKey: "HTTPAPI_REGISTRATION_CONTACT_EMAIL", param: "email" },
  { envKey: "HTTPAPI_REGISTRATION_CONTACT_ADDRESS1", param: "address-line-1" },
  { envKey: "HTTPAPI_REGISTRATION_CONTACT_CITY", param: "city" },
  { envKey: "HTTPAPI_REGISTRATION_CONTACT_STATE", param: "state" },
  { envKey: "HTTPAPI_REGISTRATION_CONTACT_COUNTRY", param: "country" },
  { envKey: "HTTPAPI_REGISTRATION_CONTACT_ZIP", param: "zipcode" },
  { envKey: "HTTPAPI_REGISTRATION_CONTACT_PHONE_CC", param: "phone-cc" },
  { envKey: "HTTPAPI_REGISTRATION_CONTACT_PHONE", param: "phone" }
];

const CONTACT_RESPONSE_PRIVATE_KEYS = new Set([
  "address-line-1",
  "address1",
  "city",
  "company",
  "country",
  "email",
  "name",
  "phone",
  "phone-cc",
  "state",
  "zipcode",
  "zip"
]);

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
    .replace(
      /(name|company|email|address-line-1|city|state|country|zipcode|phone-cc|phone)=([^&\s]+)/gi,
      "$1=[redacted]"
    )
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

function safeContactResponseForLog(value: unknown): unknown {
  if (typeof value === "string") {
    return safeRawText(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => safeContactResponseForLog(item));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const sanitized: Record<string, unknown> = {};

  for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
    sanitized[key] = CONTACT_RESPONSE_PRIVATE_KEYS.has(key.toLowerCase())
      ? "[redacted]"
      : safeContactResponseForLog(nestedValue);
  }

  return sanitized;
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

function missingRegistrationEnvNames({
  customerId,
  nameserver1,
  nameserver2,
  nameservers
}: {
  customerId: string;
  nameserver1: string;
  nameserver2: string;
  nameservers: string[];
}) {
  const missing: string[] = [];

  if (!customerId) {
    missing.push("HTTPAPI_REGISTRATION_CUSTOMER_ID");
    missing.push("HTTPAPI_REGISTRATION_CUSTOMER_CONTACT_ID");
  }

  if (nameservers.length < 2) {
    if (!nameserver1) {
      missing.push("HTTPAPI_REGISTRATION_NAMESERVER_1");
    }

    if (!nameserver2) {
      missing.push("HTTPAPI_REGISTRATION_NAMESERVER_2");
    }
  }

  return Array.from(new Set(missing));
}

function contactIdFromResponse(raw: Record<string, unknown>) {
  return stringValue(raw.contactid ?? raw["contact-id"] ?? raw.entityid ?? raw.id);
}

function readRegistrationCustomerId(fallbackCustomerId?: string) {
  return (
    fallbackCustomerId?.trim() ||
    readEnv("HTTPAPI_REGISTRATION_CUSTOMER_ID") ||
    readEnv("HTTPAPI_REGISTRATION_CUSTOMER_CONTACT_ID") ||
    ""
  );
}

function readRegistrationContactType() {
  return readEnv("HTTPAPI_REGISTRATION_CONTACT_TYPE") || "Contact";
}

function contactEnvValues() {
  const values = new Map<string, string>();
  const missingEnvNames: string[] = [];

  for (const field of CONTACT_ENV_FIELDS) {
    const value = readEnv(field.envKey) ?? "";

    if (!value) {
      missingEnvNames.push(field.envKey);
    }

    values.set(field.param, value);
  }

  return {
    missingEnvNames,
    values
  };
}

function failedContactCreateResult({
  code,
  message,
  rawResponse,
  status
}: {
  code: string;
  message: string;
  rawResponse: unknown;
  status?: number;
}): HttpApiContactCreateResult {
  return {
    contactId: null,
    error: {
      code,
      message,
      status
    },
    rawResponse,
    success: false
  };
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

export async function createHttpApiContact(
  input: HttpApiContactCreateInput = {}
): Promise<HttpApiContactCreateResult> {
  const customerId = readRegistrationCustomerId(input.customerId);
  const contactType = readRegistrationContactType();
  const { missingEnvNames, values } = contactEnvValues();

  if (!customerId) {
    missingEnvNames.unshift(
      "HTTPAPI_REGISTRATION_CUSTOMER_ID",
      "HTTPAPI_REGISTRATION_CUSTOMER_CONTACT_ID"
    );
  }

  console.info("httpapi_contact_create_started", {
    contactType,
    hasCustomerId: Boolean(customerId),
    hasType: Boolean(contactType),
    missingEnvCount: missingEnvNames.length,
    provider: "httpapi"
  });

  if (missingEnvNames.length > 0) {
    const uniqueMissingEnvNames = Array.from(new Set(missingEnvNames));
    const result = failedContactCreateResult({
      code: "missing_contact_create_input",
      message: `Missing HTTPAPI contact creation environment variables: ${uniqueMissingEnvNames.join(", ")}.`,
      rawResponse: {
        code: "missing_contact_create_input",
        missingEnvNames: uniqueMissingEnvNames,
        status: "ERROR"
      }
    });

    console.error("httpapi_contact_create_failed", {
      code: result.error?.code,
      message: result.error?.message,
      provider: "httpapi"
    });

    return result;
  }

  try {
    const config = getHttpApiRegistrationConfig();
    const url = new URL(`${config.baseUrl}/api/contacts/add.json`);
    url.searchParams.set("auth-userid", config.resellerId);
    url.searchParams.set("api-key", config.apiKey);
    url.searchParams.set("customer-id", customerId);
    url.searchParams.set("type", contactType);

    for (const [param, value] of values.entries()) {
      url.searchParams.set(param, value);
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
    const contactId = contactIdFromResponse(raw);
    const loggedResponse = safeContactResponseForLog(rawResponse);

    console.info("httpapi_contact_create_response", {
      hasContactId: Boolean(contactId),
      provider: "httpapi",
      response: loggedResponse,
      status: response.status,
      statusText: response.statusText
    });

    if (!response.ok || providerStatus === "error") {
      const message =
        extractHttpApiErrorMessage(rawResponse) ??
        response.statusText ??
        "HTTPAPI contact creation failed.";
      const result = failedContactCreateResult({
        code: providerStatus === "error" ? "httpapi_contact_create_error" : "httpapi_contact_create_http_error",
        message,
        rawResponse: safeContactResponseForLog(
          rawResponse ?? providerResponseFromText({ response, responseText })
        ),
        status: response.status
      });

      console.error("httpapi_contact_create_failed", {
        message: result.error?.message,
        provider: "httpapi",
        response: loggedResponse,
        status: response.status,
        statusText: response.statusText
      });

      return result;
    }

    if (!contactId) {
      const message =
        extractHttpApiErrorMessage(rawResponse) ??
        "HTTPAPI contact creation succeeded without a contact id.";
      const result = failedContactCreateResult({
        code: "httpapi_contact_create_missing_contact_id",
        message,
        rawResponse: safeContactResponseForLog(rawResponse)
      });

      console.error("httpapi_contact_create_failed", {
        code: result.error?.code,
        message: result.error?.message,
        provider: "httpapi",
        response: loggedResponse,
        status: response.status,
        statusText: response.statusText
      });

      return result;
    }

    return {
      contactId,
      rawResponse: safeContactResponseForLog(rawResponse),
      success: true
    };
  } catch (error) {
    const result = failedContactCreateResult({
      code: "httpapi_contact_create_exception",
      message: error instanceof Error ? error.message : String(error),
      rawResponse: null
    });

    console.error("httpapi_contact_create_failed", {
      message: result.error?.message,
      provider: "httpapi"
    });

    return result;
  }
}

export async function registerDomainOrder(
  input: HttpApiRegistrationInput
): Promise<HttpApiRegistrationResult> {
  let adminContactId = input.adminContactId.trim();
  let billingContactId = input.billingContactId.trim();
  const customerId = input.customerId.trim();
  const domainName = normalizeDomainName(input.domainName);
  let registrantContactId = input.registrantContactId.trim();
  let techContactId = input.techContactId.trim();
  const years = normalizeYears(input.years);
  const nameserver1 = input.nameserver1.trim();
  const nameserver2 = input.nameserver2.trim();
  const nameservers = normalizeNameservers(input);
  const hasExplicitContactIds = Boolean(
    registrantContactId && adminContactId && techContactId && billingContactId
  );

  console.info("domain_registration_started", {
    domainName,
    nameserverCount: nameservers.length,
    provider: "httpapi",
    years
  });

  console.info("httpapi_registration_input_ready", {
    hasAdminContactId: Boolean(adminContactId),
    hasBillingContactId: Boolean(billingContactId),
    hasCustomerId: Boolean(customerId),
    hasExplicitContactIds,
    hasRegistrantContactId: Boolean(registrantContactId),
    hasTechContactId: Boolean(techContactId),
    nameserverCount: nameservers.length
  });

  const missingEnvNames = missingRegistrationEnvNames({
    customerId,
    nameserver1,
    nameserver2,
    nameservers
  });

  if (!domainName || missingEnvNames.length > 0) {
    const missingMessage = missingEnvNames.length
      ? `Missing HTTPAPI registration environment variables: ${missingEnvNames.join(", ")}.`
      : "Domain registration requires a domain name.";
    const result = failedRegistrationResult({
      code: "missing_registration_input",
      message: missingMessage,
      rawResponse: {
        code: "missing_registration_input",
        missingEnvNames,
        status: "ERROR"
      }
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
    let contactCreateRawResponse: unknown = null;

    if (!hasExplicitContactIds) {
      const contactCreateResult = await createHttpApiContact({ customerId });

      contactCreateRawResponse = contactCreateResult.rawResponse;

      if (!contactCreateResult.success || !contactCreateResult.contactId) {
        const result = failedRegistrationResult({
          code: contactCreateResult.error?.code ?? "httpapi_contact_create_failed",
          message: contactCreateResult.error?.message ?? "HTTPAPI contact creation failed.",
          rawResponse: {
            contactCreate: contactCreateResult.rawResponse,
            status: "ERROR"
          },
          status: contactCreateResult.error?.status
        });

        console.error("domain_registration_failed", {
          code: result.error?.code,
          domainName,
          message: result.error?.message,
          provider: "httpapi"
        });

        return result;
      }

      registrantContactId = contactCreateResult.contactId;
      adminContactId = contactCreateResult.contactId;
      techContactId = contactCreateResult.contactId;
      billingContactId = contactCreateResult.contactId;
    }

    const config = getHttpApiRegistrationConfig();
    const url = new URL(`${config.baseUrl}/api/domains/register.json`);
    url.searchParams.set("auth-userid", config.resellerId);
    url.searchParams.set("api-key", config.apiKey);
    url.searchParams.set("domain-name", domainName);
    url.searchParams.set("years", String(years));
    url.searchParams.set("customer-id", customerId);
    url.searchParams.set("reg-contact-id", registrantContactId);
    url.searchParams.set("admin-contact-id", adminContactId);
    url.searchParams.set("tech-contact-id", techContactId);
    url.searchParams.set("billing-contact-id", billingContactId);
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
        rawResponse: contactCreateRawResponse
          ? {
              contactCreate: contactCreateRawResponse,
              registration: rawResponse ?? providerResponseFromText({ response, responseText })
            }
          : rawResponse ?? providerResponseFromText({ response, responseText }),
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
        rawResponse: contactCreateRawResponse
          ? {
              contactCreate: contactCreateRawResponse,
              registration: rawResponse
            }
          : rawResponse
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
      rawResponse: contactCreateRawResponse
        ? {
            contactCreate: contactCreateRawResponse,
            registration: rawResponse
          }
        : rawResponse,
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
