import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  getRequestHostname,
  getStorefrontContextFromHostname
} from "@/lib/storefront-hostname-context";
import { updateSession } from "@/lib/supabase/middleware";
import type { Database } from "@/types/database";

function shouldResolveStorefrontHostname(request: NextRequest) {
  return request.nextUrl.pathname === "/";
}

function getFormActionDirective() {
  const sources = new Set<string>(["'self'", "https://shastore-ai.vercel.app", "https://*.vercel.app"]);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (appUrl) {
    try {
      const origin = new URL(appUrl.includes("://") ? appUrl : `https://${appUrl}`).origin;

      if (origin.startsWith("https://")) {
        sources.add(origin);
      }
    } catch {
      // Ignore invalid NEXT_PUBLIC_APP_URL values.
    }
  }

  return `form-action ${Array.from(sources).join(" ")}`;
}

function applySecurityHeaders(response: NextResponse) {
  response.headers.set("X-Frame-Options", "SAMEORIGIN");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()"
  );
  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
      "style-src 'self' 'unsafe-inline' https:",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data: https:",
      "connect-src 'self' https: wss:",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      getFormActionDirective()
    ].join("; ")
  );

  return response;
}

async function resolveHostnameStorefront(request: NextRequest) {
  if (!shouldResolveStorefrontHostname(request)) {
    return null;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  const supabase = createServerClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {
          // Public hostname resolution does not mutate auth cookies.
        }
      }
    }
  );
  const context = await getStorefrontContextFromHostname(
    getRequestHostname(request),
    supabase as never
  );

  if (!context) {
    return null;
  }

  const rewriteUrl = request.nextUrl.clone();
  rewriteUrl.pathname = `/store/${context.storeSlug}`;

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-shastore-hostname", context.hostname);
  requestHeaders.set("x-shastore-hostname-source", context.source);
  requestHeaders.set("x-shastore-store-slug", context.storeSlug);
  requestHeaders.set(
    "x-shastore-tenant-source",
    context.source === "localhost_subdomain" ? "localhost_subdomain" : "hostname"
  );

  return applySecurityHeaders(NextResponse.rewrite(rewriteUrl, {
    request: {
      headers: requestHeaders
    }
  }));
}

export async function middleware(request: NextRequest) {
  const hostnameStorefront = await resolveHostnameStorefront(request);

  if (hostnameStorefront) {
    return applySecurityHeaders(hostnameStorefront);
  }

  const response = await updateSession(request);
  const activeWorkspaceId = request.cookies.get("shastore_active_workspace_id")?.value;

  if (activeWorkspaceId) {
    response.headers.set("x-shastore-active-workspace", activeWorkspaceId);
    console.log("[workspace-data-access] middleware active workspace observed", {
      workspaceId: activeWorkspaceId
    });
  }

  return applySecurityHeaders(response);
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"
  ]
};
