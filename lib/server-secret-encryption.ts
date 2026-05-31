import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const algorithm = "aes-256-gcm";

export function paymentSecretsEncryptionEnvName() {
  return "STORE_PAYMENT_SECRETS_ENCRYPTION_KEY";
}

function encryptionKey() {
  const raw = process.env[paymentSecretsEncryptionEnvName()];

  if (!raw) {
    return null;
  }

  return createHash("sha256").update(raw).digest();
}

export function canEncryptPaymentSecrets() {
  return Boolean(encryptionKey());
}

export function encryptServerSecret(value: string) {
  const key = encryptionKey();

  if (!key) {
    throw new Error(`Missing ${paymentSecretsEncryptionEnvName()}`);
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv(algorithm, key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    alg: algorithm,
    ciphertext: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    v: 1
  };
}

export function decryptServerSecret(payload: unknown) {
  const key = encryptionKey();

  if (!key || !payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const record = payload as Record<string, unknown>;

  if (
    record.alg !== algorithm ||
    typeof record.ciphertext !== "string" ||
    typeof record.iv !== "string" ||
    typeof record.tag !== "string"
  ) {
    return null;
  }

  const decipher = createDecipheriv(algorithm, key, Buffer.from(record.iv, "base64"));
  decipher.setAuthTag(Buffer.from(record.tag, "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(record.ciphertext, "base64")),
    decipher.final()
  ]).toString("utf8");
}
