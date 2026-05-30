import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function getConfiguredAdminEmails() {
  return (process.env.ADMIN_EMAILS ?? process.env.ADMIN_EMAIL ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isPlatformAdminEmail(
  email: string | null | undefined,
  options: { allowUnconfigured?: boolean } = {}
) {
  const configuredAdminEmails = getConfiguredAdminEmails();
  const normalizedEmail = email?.toLowerCase() ?? "";
  const isConfigured = configuredAdminEmails.length > 0;
  const allowUnconfigured = options.allowUnconfigured ?? true;

  return {
    isAdmin: isConfigured ? configuredAdminEmails.includes(normalizedEmail) : allowUnconfigured,
    isConfigured
  };
}

export async function getAdminAccess() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/admin");
  }

  const { isAdmin, isConfigured } = isPlatformAdminEmail(user.email);

  if (!isAdmin) {
    redirect("/dashboard");
  }

  return {
    isConfigured,
    role: "admin" as const,
    user
  };
}
