import { cookies, headers } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import {
  authCookieOptionsForRole,
  authSessionRoleFromHeaders,
  type AuthSessionRole
} from "@/lib/auth-session-roles";
import type { Database } from "@/types/database";

export async function createClient(options: { role?: AuthSessionRole } = {}) {
  const cookieStore = await cookies();
  const requestHeaders = await headers();
  const role = options.role ?? authSessionRoleFromHeaders(requestHeaders);

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: authCookieOptionsForRole(role),
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server components cannot set cookies; middleware refreshes sessions.
          }
        }
      }
    }
  );
}
