import { redirect } from "next/navigation";
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

  // Future role hook: check a dedicated reseller role/profile flag here once roles exist.
  // For now, any authenticated user can prepare a reseller showcase without affecting
  // seller, admin, billing, checkout, or public storefront systems.
  return { role: "reseller" as const, user };
}
