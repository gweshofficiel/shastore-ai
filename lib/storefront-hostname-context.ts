import type { NextRequest } from "next/server";
import { getDomainBase } from "@/lib/domains/hostinsh";
import {
  extractSubdomain,
  normalizeHostname,
  resolveStoreByHostname
} from "@/lib/domains/utils";

type HostnameResolverClient = Parameters<typeof resolveStoreByHostname>[1];

export type StorefrontHostnameContext = {
  hostname: string;
  source: "custom_domain" | "localhost_subdomain" | "platform_subdomain";
  storeSlug: string;
};

export function getRequestHostname(request: Pick<NextRequest, "headers"> | Headers) {
  const headers = request instanceof Headers ? request : request.headers;
  return normalizeHostname(headers.get("x-forwarded-host") ?? headers.get("host") ?? "");
}

function isInternalHostname(hostname: string) {
  const platformDomain = normalizeHostname(getDomainBase());

  return (
    !hostname ||
    hostname === "localhost" ||
    hostname === platformDomain ||
    hostname.endsWith(".vercel.app")
  );
}

function hostnameSource(hostname: string): StorefrontHostnameContext["source"] {
  if (extractSubdomain(hostname, "localhost")) {
    return "localhost_subdomain";
  }

  if (extractSubdomain(hostname, getDomainBase())) {
    return "platform_subdomain";
  }

  return "custom_domain";
}

export async function getStorefrontContextFromHostname(
  hostname: string,
  resolverClient?: HostnameResolverClient
): Promise<StorefrontHostnameContext | null> {
  const normalizedHostname = normalizeHostname(hostname);

  if (isInternalHostname(normalizedHostname)) {
    return null;
  }

  try {
    const storeSlug = await resolveStoreByHostname(normalizedHostname, resolverClient);

    if (!storeSlug) {
      return null;
    }

    return {
      hostname: normalizedHostname,
      source: hostnameSource(normalizedHostname),
      storeSlug
    };
  } catch (error) {
    console.error("[storefront-hostname] resolution failed", {
      error,
      hostname: normalizedHostname
    });
    return null;
  }
}
