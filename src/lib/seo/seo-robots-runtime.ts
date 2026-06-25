import "server-only";

import { listSitemapEntries } from "@/src/lib/seo/seo-sitemap-runtime";

export type RobotsRuntimeStatus = "ready" | "warning";

export type RobotsRuntimeRules = {
  allowedRoutes: string[];
  disallowedRoutes: string[];
  platformRoutes: string[];
  status: RobotsRuntimeStatus;
  userAgent: "*";
};

export type RobotsRuntimeSummary = {
  allowedPaths: string[];
  blockedPaths: string[];
  environmentWarning: string;
  platformRouteCount: number;
  status: RobotsRuntimeStatus;
};

export const SEO_ROBOTS_ROUTE_MAX_LENGTH = 240 as const;

export const ROBOTS_ALLOWED_ROUTE_PATTERNS = ["/", "/l/", "/store/"] as const;

export const ROBOTS_DISALLOWED_ROUTE_PATTERNS = [
  "/admin/",
  "/api/",
  "/dashboard/",
  "/store/*/account",
  "/store/*/cart",
  "/store/*/checkout",
  "/store/*/compare",
  "/store/*/order/",
  "/store/*/receipt/",
  "/store/*/track",
  "/store/*/wishlist"
] as const;

const BLOCKED_ROBOTS_PREFIXES = ["/admin", "/api", "/dashboard"] as const;

const BLOCKED_ROBOTS_SEGMENTS = [
  "/account",
  "/cart",
  "/checkout",
  "/compare",
  "/order/",
  "/receipt/",
  "/track",
  "/wishlist"
] as const;

function text(value: unknown, maxLength: number = SEO_ROBOTS_ROUTE_MAX_LENGTH) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/\bjavascript:/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function isBlockedRobotsRoute(normalized: string) {
  if (/^(?:https?:|javascript:|data:)/i.test(normalized)) {
    return true;
  }

  if (
    BLOCKED_ROBOTS_PREFIXES.some(
      (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`)
    )
  ) {
    return true;
  }

  const lower = normalized.toLowerCase();

  return BLOCKED_ROBOTS_SEGMENTS.some((segment) => lower.includes(segment));
}

export function normalizeRobotsRoute(route: unknown) {
  const cleaned = text(route, SEO_ROBOTS_ROUTE_MAX_LENGTH);

  if (!cleaned) {
    return "";
  }

  if (/^(?:https?:|javascript:|data:)/i.test(cleaned)) {
    return "";
  }

  const relative = cleaned.startsWith("/") ? cleaned : `/${cleaned}`;
  return relative.replace(/\/+$/, "") || "/";
}

function routeMatchesDisallowedPattern(route: string, pattern: string) {
  const normalizedRoute = normalizeRobotsRoute(route);

  if (!normalizedRoute) {
    return false;
  }

  const escapedPattern = pattern
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, "[^/]+");
  const regex = new RegExp(`^${escapedPattern}`);

  return regex.test(normalizedRoute) || regex.test(`${normalizedRoute}/`);
}

export function isRobotsAllowedRoute(route: unknown) {
  const normalized = normalizeRobotsRoute(route);

  if (!normalized) {
    return false;
  }

  if (isBlockedRobotsRoute(normalized)) {
    return false;
  }

  return !ROBOTS_DISALLOWED_ROUTE_PATTERNS.some((pattern) => routeMatchesDisallowedPattern(normalized, pattern));
}

export function listRobotsAllowedRoutes() {
  return [...ROBOTS_ALLOWED_ROUTE_PATTERNS];
}

export function listRobotsDisallowedRoutes() {
  return [...ROBOTS_DISALLOWED_ROUTE_PATTERNS];
}

function resolveRobotsRuntimeStatus() {
  const hasAdminBlock = ROBOTS_DISALLOWED_ROUTE_PATTERNS.some((pattern) => pattern.startsWith("/admin"));
  const hasApiBlock = ROBOTS_DISALLOWED_ROUTE_PATTERNS.some((pattern) => pattern.startsWith("/api"));
  const hasDashboardBlock = ROBOTS_DISALLOWED_ROUTE_PATTERNS.some((pattern) => pattern.startsWith("/dashboard"));

  return hasAdminBlock && hasApiBlock && hasDashboardBlock ? "ready" : "warning";
}

export async function getRobotsRuntimeRules(): Promise<RobotsRuntimeRules> {
  try {
    const sitemapEntries = await listSitemapEntries();
    const platformRoutes = sitemapEntries.map((entry) => entry.route);

    return {
      allowedRoutes: listRobotsAllowedRoutes(),
      disallowedRoutes: listRobotsDisallowedRoutes(),
      platformRoutes,
      status: resolveRobotsRuntimeStatus(),
      userAgent: "*"
    };
  } catch (error) {
    console.error("[seo-robots-runtime] robots rules resolve failed", error);

    return {
      allowedRoutes: listRobotsAllowedRoutes(),
      disallowedRoutes: listRobotsDisallowedRoutes(),
      platformRoutes: [],
      status: "warning",
      userAgent: "*"
    };
  }
}

export async function mapRobotsRuntimeToAdminFields(): Promise<RobotsRuntimeSummary> {
  const rules = await getRobotsRuntimeRules();
  const isProduction = process.env.NODE_ENV === "production";

  return {
    allowedPaths: rules.allowedRoutes,
    blockedPaths: rules.disallowedRoutes,
    environmentWarning: isProduction
      ? "Production robots allow public routes and block admin/dashboard/private routes."
      : "Non-production environment: confirm deployment URL and indexing before launch.",
    platformRouteCount: rules.platformRoutes.length,
    status: rules.status
  };
}

// SEO-11+ placeholders: robots.txt regeneration and environment overrides stay disconnected.
export const SEO_ROBOTS_FUTURE_HOOKS = ["seo_robots_regeneration", "seo_robots_environment_overrides"] as const;
