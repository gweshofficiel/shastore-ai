import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function getConfiguredAdminEmails() {
  return (process.env.ADMIN_EMAILS ?? process.env.ADMIN_EMAIL ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export async function getAdminAccess() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/admin");
  }

  const configuredAdminEmails = getConfiguredAdminEmails();
  const userEmail = user.email?.toLowerCase() ?? "";
  const isConfigured = configuredAdminEmails.length > 0;
  const isAdmin = isConfigured ? configuredAdminEmails.includes(userEmail) : true;

  if (!isAdmin) {
    redirect("/dashboard");
  }

  return {
    isConfigured,
    role: "admin" as const,
    user
  };
}
