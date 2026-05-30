import { recordSecurityAuditLog, getRequestAuditFields } from "@/lib/security/audit";

type RateLimitInput = {
  action: string;
  identifier: string;
  limit: number;
  metadata?: Record<string, unknown>;
  route?: string | null;
  storeId?: string | null;
  userId?: string | null;
  windowSeconds: number;
  workspaceId?: string | null;
};

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const globalRateLimits = globalThis as typeof globalThis & {
  __shastoreRateLimits?: Map<string, RateLimitEntry>;
};

function store() {
  if (!globalRateLimits.__shastoreRateLimits) {
    globalRateLimits.__shastoreRateLimits = new Map();
  }

  return globalRateLimits.__shastoreRateLimits;
}

function cleanIdentifier(value: string) {
  return value.trim().toLowerCase().slice(0, 240) || "anonymous";
}

export async function checkRateLimit({
  action,
  identifier,
  limit,
  metadata,
  route,
  storeId,
  userId,
  windowSeconds,
  workspaceId
}: RateLimitInput) {
  const key = `${action}:${cleanIdentifier(identifier)}`;
  const now = Date.now();
  const bucket = store();
  const existing = bucket.get(key);
  const entry =
    existing && existing.resetAt > now
      ? { count: existing.count + 1, resetAt: existing.resetAt }
      : { count: 1, resetAt: now + windowSeconds * 1000 };

  bucket.set(key, entry);

  const allowed = entry.count <= limit;
  const remaining = Math.max(0, limit - entry.count);

  if (!allowed) {
    const request = await getRequestAuditFields();
    await recordSecurityAuditLog({
      ...request,
      action: "rate_limit.exceeded",
      metadata: {
        action,
        count: entry.count,
        limit,
        windowSeconds,
        ...metadata
      },
      reason: "Rate limit exceeded",
      route,
      storeId,
      userId,
      workspaceId
    });
  }

  return {
    allowed,
    limit,
    remaining,
    resetAt: entry.resetAt,
    windowSeconds
  };
}
