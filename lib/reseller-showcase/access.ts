import { redirect } from "next/navigation";
import { getAccountRoleForUser } from "@/lib/account-roles";
import { isCurrentUserDeliveryAccount } from "@/lib/delivery/access";
import { createClient } from "@/lib/supabase/server";

export async function requireResellerDashboardAccess() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/reseller/dashboard");
  }

  if (await isCurrentUserDeliveryAccount(supabase, user)) {
    redirect("/delivery/dashboard");
  }

  const accountRole = await getAccountRoleForUser(supabase, user.id);

  if (accountRole?.role !== "reseller" || accountRole.status !== "active") {
    redirect("/reseller/login?error=role");
  }

  return { role: "reseller" as const, user };
}
