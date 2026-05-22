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

async function resolveHostnameStorefront(request: NextRequest) {
  if (!shouldResolveStorefrontHostname(request)) {
    return null;
  }

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

  return NextResponse.rewrite(rewriteUrl, {
    request: {
      headers: requestHeaders
    }
  });
}

export async function middleware(request: NextRequest) {
  const hostnameStorefront = await resolveHostnameStorefront(request);

  if (hostnameStorefront) {
    return hostnameStorefront;
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"
  ]
};
