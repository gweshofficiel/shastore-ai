import type { NextRequest } from "next/server";
import { isProduction } from "@/lib/deployment/config";

export type AppOriginSource =
  | "headers"
  | "localhost_dev"
  | "next_public_app_url"
  | "public_app_url"
  | "request"
  | "vercel_project_production_url"
  | "vercel_url";

export type AppOriginResult = {
  isLocalhost: boolean;
  origin: string;
  originSource: AppOriginSource;
};

function withProtocol(value: string) {
  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value.replace(/\/+$/, "");
  }

  return `https://${value.replace(/\/+$/, "")}`;
}

function isLocalhostHost(value: string) {
  try {
    const hostname = new URL(value).hostname;
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

function finalizeOrigin(origin: string, originSource: AppOriginSource): AppOriginResult {
  const normalizedOrigin = withProtocol(origin);
  const isLocalhost = isLocalhostHost(normalizedOrigin);

  if (isProduction() && isLocalhost) {
    throw new Error("App origin cannot be localhost in production.");
  }

  return {
    isLocalhost,
    origin: normalizedOrigin,
    originSource
  };
}

function originFromEnv(
  envKey: "NEXT_PUBLIC_APP_URL" | "PUBLIC_APP_URL",
  originSource: Extract<AppOriginSource, "next_public_app_url" | "public_app_url">
) {
  const value = process.env[envKey]?.trim();

  if (!value) {
    return null;
  }

  const origin = withProtocol(value);

  if (isProduction() && isLocalhostHost(origin)) {
    return null;
  }

  return finalizeOrigin(origin, originSource);
}

export function getAppOrigin(request?: NextRequest | null): AppOriginResult {
  if (request?.nextUrl?.origin) {
    return finalizeOrigin(request.nextUrl.origin, "request");
  }

  const fromNextPublicAppUrl = originFromEnv("NEXT_PUBLIC_APP_URL", "next_public_app_url");

  if (fromNextPublicAppUrl) {
    return fromNextPublicAppUrl;
  }

  const fromPublicAppUrl = originFromEnv("PUBLIC_APP_URL", "public_app_url");

  if (fromPublicAppUrl) {
    return fromPublicAppUrl;
  }

  if (process.env.VERCEL_URL?.trim()) {
    return finalizeOrigin(process.env.VERCEL_URL, "vercel_url");
  }

  if (process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim()) {
    return finalizeOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL, "vercel_project_production_url");
  }

  if (isProduction()) {
    throw new Error("App origin is not configured for production.");
  }

  return finalizeOrigin("http://localhost:3000", "localhost_dev");
}

export async function resolveAppOrigin(request?: NextRequest | null): Promise<AppOriginResult> {
  if (request?.nextUrl?.origin) {
    return getAppOrigin(request);
  }

  try {
    const { headers } = await import("next/headers");
    const headerList = await headers();
    const host = headerList.get("x-forwarded-host") ?? headerList.get("host");

    if (host) {
      const normalizedHost = host.split(",")[0]?.trim();

      if (normalizedHost) {
        const proto =
          headerList.get("x-forwarded-proto")?.split(",")[0]?.trim() ??
          (isProduction() ? "https" : "http");
        const origin = `${proto}://${normalizedHost}`;

        return finalizeOrigin(origin, "headers");
      }
    }
  } catch {
    // headers() is unavailable outside a request context.
  }

  return getAppOrigin(null);
}
