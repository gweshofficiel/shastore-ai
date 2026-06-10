import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

function loginPathForRoute(pathname: string) {
  if (pathname.startsWith("/admin")) {
    return "/admin/login";
  }

  if (pathname.startsWith("/customer")) {
    return "/customer/login";
  }

  if (pathname.startsWith("/delivery")) {
    return "/delivery/login";
  }

  if (pathname.startsWith("/reseller")) {
    return "/reseller/login";
  }

  return "/login";
}

export async function updateSession(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-shastore-path", request.nextUrl.pathname);
  let response = NextResponse.next({
    request: {
      headers: requestHeaders
    }
  });
  const isProtectedRoute =
    request.nextUrl.pathname.startsWith("/dashboard") ||
    request.nextUrl.pathname.startsWith("/admin") ||
    request.nextUrl.pathname.startsWith("/customer") ||
    request.nextUrl.pathname.startsWith("/delivery/dashboard") ||
    request.nextUrl.pathname.startsWith("/reseller/dashboard");
  const isRoleAuthRoute =
    request.nextUrl.pathname.startsWith("/admin/login") ||
    request.nextUrl.pathname.startsWith("/admin/register") ||
    request.nextUrl.pathname.startsWith("/customer/login") ||
    request.nextUrl.pathname.startsWith("/customer/register") ||
    request.nextUrl.pathname.startsWith("/delivery/login") ||
    request.nextUrl.pathname.startsWith("/delivery/register") ||
    request.nextUrl.pathname.startsWith("/reseller/login") ||
    request.nextUrl.pathname.startsWith("/reseller/register");
  const isStoreDashboardRoute = request.nextUrl.pathname.startsWith("/dashboard/stores");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    if (isProtectedRoute && !isRoleAuthRoute) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = loginPathForRoute(request.nextUrl.pathname);
      redirectUrl.searchParams.set("next", request.nextUrl.pathname);
      redirectUrl.searchParams.set("runtime", "env-missing");
      return NextResponse.redirect(redirectUrl);
    }

    return response;
  }

  const supabase = createServerClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({
            request: {
              headers: requestHeaders
            }
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        }
      }
    }
  );

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user && isProtectedRoute && !isRoleAuthRoute) {
    if (isStoreDashboardRoute) {
      console.warn("[store-access] unauthenticated store dashboard request", {
        path: request.nextUrl.pathname
      });
    }

    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = loginPathForRoute(request.nextUrl.pathname);
    redirectUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (user && isStoreDashboardRoute) {
    console.info("[store-access] store dashboard session verified", {
      path: request.nextUrl.pathname,
      userId: user.id
    });
  }

  return response;
}
