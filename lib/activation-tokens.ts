import { createHash, randomBytes } from "node:crypto";

export const ACTIVATION_TOKEN_TTL_DAYS = 14;

export type ActivationTokenRecord = {
  expiresAt: string;
  hash: string;
  token: string;
  tokenStorageValue: string;
};

export function createActivationTokenRecord(): ActivationTokenRecord {
  const token = `claim_${randomBytes(32).toString("base64url")}`;
  const hash = hashActivationToken(token);

  return {
    expiresAt: new Date(Date.now() + ACTIVATION_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    hash,
    token,
    tokenStorageValue: hash
  };
}

export function hashActivationToken(token: string) {
  return createHash("sha256").update(token.trim(), "utf8").digest("hex");
}

export function buildClaimAccountPath(token: string) {
  return `/claim-account/${encodeURIComponent(token)}`;
}

export function buildActivationEmailPayload({
  buyerEmail,
  buyerName,
  claimPath,
  expiresAt,
  resellerName,
  storeName,
  transferCode
}: {
  buyerEmail: string;
  buyerName: string;
  claimPath: string;
  expiresAt: string;
  resellerName: string;
  storeName: string;
  transferCode: string;
}) {
  return {
    buyerEmail,
    buyerName,
    claimPath,
    expiresAt,
    resellerName,
    storeName,
    subject: `Claim your SHASTORE AI store: ${storeName}`,
    transferCode
  };
}
