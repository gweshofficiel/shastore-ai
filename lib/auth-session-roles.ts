import type { CookieOptionsWithName } from "@supabase/ssr";
import type { AccountRole } from "@/lib/account-roles";

export type AuthSessionRole = "admin" | "customer" | "delivery" | "internal_team" | "owner" | "reseller";

const roleCookieNames: Record<AuthSessionRole, string> = {
  admin: "shastore-auth-admin",
  customer: "shastore-auth-customer",
  delivery: "shastore-auth-delivery",
  internal_team: "shastore-auth-internal-team",
  owner: "shastore-auth-owner",
  reseller: "shastore-auth-reseller"
};

export function authCookieOptionsForRole(role: AuthSessionRole): CookieOptionsWithName {
  return {
    name: roleCookieNames[role],
    path: "/",
    sameSite: "lax"
  };
}

export function authSessionRoleForAccountRole(role: AccountRole): AuthSessionRole {
  if (role === "super_admin") {
    return "admin";
  }

  if (role === "customer" || role === "delivery" || role === "reseller") {
    return role;
  }

  return "owner";
}

export function authSessionRoleFromPath(pathname: string | null | undefined): AuthSessionRole {
  const path = pathname || "/";

  if (path.startsWith("/admin/internal-team/accept/")) {
    return "internal_team";
  }

  if (path.startsWith("/admin")) {
    return "admin";
  }

  if (path.startsWith("/customer") || path.startsWith("/store/")) {
    return "customer";
  }

  if (path.startsWith("/delivery")) {
    return "delivery";
  }

  if (path.startsWith("/reseller")) {
    return "reseller";
  }

  return "owner";
}

export function authSessionRoleFromHeaders(headers: Headers): AuthSessionRole {
  const explicitPath = headers.get("x-shastore-path");

  if (explicitPath) {
    return authSessionRoleFromPath(explicitPath);
  }

  const referer = headers.get("referer");

  if (referer) {
    try {
      return authSessionRoleFromPath(new URL(referer).pathname);
    } catch {
      return authSessionRoleFromPath(referer);
    }
  }

  return "owner";
}
