import { getDomainBase } from "@/lib/domains/hostinsh";

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
