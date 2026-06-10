import { createBrowserClient } from "@supabase/ssr";
import { authCookieOptionsForRole, type AuthSessionRole } from "@/lib/auth-session-roles";
import type { Database } from "@/types/database";

export function createClient(options: { role?: AuthSessionRole } = {}) {
  const role = options.role ?? "owner";

  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: authCookieOptionsForRole(role)
    }
  );
}
