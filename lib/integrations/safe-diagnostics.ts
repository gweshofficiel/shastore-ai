const sensitiveKeyParts = [
  "apikey",
  "api_key",
  "api-key",
  "authorization",
  "bearer",
  "key",
  "password",
  "private_key",
  "privatekey",
  "secret",
  "token",
  "webhook_secret",
  "webhooksecret"
];

function normalizedKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9_-]/g, "");
}

function isSensitiveKey(value: string) {
  const key = normalizedKey(value);

  return sensitiveKeyParts.some((part) => key.includes(normalizedKey(part)));
}

export function maskSensitiveText(value: string) {
  return value
    .replace(
      /((?:api[-_]?key|apikey|key|token|secret|password|auth|authorization|bearer|private[-_]?key|webhook[-_]?secret)=)[^&\s"']+/gi,
      "$1[redacted]"
    )
    .replace(
      /((?:api[-_]?key|apikey|key|token|secret|password|auth|authorization|bearer|private[-_]?key|webhook[-_]?secret)["']?\s*:\s*["']?)[^"',}\s]+/gi,
      "$1[redacted]"
    )
    .slice(0, 500);
}

export function maskIntegrationDiagnostic(value: unknown): unknown {
  if (typeof value === "string") {
    return maskSensitiveText(value);
  }

  if (typeof value === "number" || typeof value === "boolean" || value === null) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => maskIntegrationDiagnostic(item));
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => [
      key,
      isSensitiveKey(key) ? "[redacted]" : maskIntegrationDiagnostic(nestedValue)
    ])
  );
}
