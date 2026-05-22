import { getDomainBase } from "@/lib/domains/hostinsh";
import { createClient } from "@/lib/supabase/server";

const reservedSubdomains = new Set([
  "admin",
  "api",
  "app",
  "auth",
  "blog",
  "cdn",
  "checkout",
  "dashboard",
  "docs",
  "help",
  "mail",
  "reseller",
  "root",
  "shastore",
  "static",
  "store",
  "support",
  "www"
]);

export function normalizeSubdomain(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 48);
}

export function normalizeHostname(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/[^a-z0-9.-]/g, "")
    .replace(/\.+/g, ".")
    .replace(/(^\.|\.$)+/g, "")
    .slice(0, 253);
}

export function isValidHostname(value: string) {
  const hostname = normalizeHostname(value);

  if (!hostname || hostname.length > 253 || !hostname.includes(".")) {
    return false;
  }

  return hostname
    .split(".")
    .every(
      (part) =>
        part.length > 0 &&
        part.length <= 63 &&
        /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(part)
    );
}

export function extractSubdomain(hostname: string, baseDomain = getDomainBase()) {
  const normalizedHostname = normalizeHostname(hostname);
  const normalizedBase = normalizeHostname(baseDomain);
  const suffix = `.${normalizedBase}`;

  if (!normalizedHostname.endsWith(suffix)) {
    return "";
  }

  const subdomain = normalizedHostname.slice(0, -suffix.length);
  return subdomain.includes(".") ? "" : normalizeSubdomain(subdomain);
}

export function isReservedSubdomain(value: string) {
  return reservedSubdomains.has(normalizeSubdomain(value));
}

export function sourcePublicationUrl(sourceType: "landing" | "store", sourceSlug: string) {
  return sourceType === "store" ? `/store/${sourceSlug}` : `/l/${sourceSlug}`;
}

export function buildFreeHostname(subdomain: string) {
  return `${normalizeSubdomain(subdomain)}.${getDomainBase()}`;
}

export function createVerificationToken() {
  return crypto.randomUUID().replace(/-/g, "");
}

export function cleanSourceSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^\/?(l|store)\//, "")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 120);
}

export async function resolveStoreByHostname(hostname: string) {
  const normalizedHostname = normalizeHostname(hostname);

  if (
    !normalizedHostname ||
    normalizedHostname === "localhost" ||
    normalizedHostname.startsWith("localhost:") ||
    normalizedHostname.endsWith(".localhost")
  ) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("resolve_storefront_hostname" as never, {
    candidate_hostname: normalizedHostname
  } as never);

  if (error) {
    console.error("[domains] storefront hostname resolution failed", {
      code: error.code,
      hostname: normalizedHostname,
      message: error.message
    });
    return null;
  }

  const resolvedSlug = data as string | null;
  return typeof resolvedSlug === "string" && resolvedSlug.trim() ? resolvedSlug : null;
}
