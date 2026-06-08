import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getDeliveryAccessForUser,
  type DeliveryAgentAccessRecord,
  type DeliveryRole
} from "@/lib/delivery/data";
import { createClient } from "@/lib/supabase/server";

export type { DeliveryRole };

type SupabaseUser = NonNullable<Awaited<ReturnType<SupabaseClient["auth"]["getUser"]>>["data"]["user"]>;

function normalizeDeliveryRole(value: unknown): DeliveryRole | null {
  if (value === "delivery" || value === "pending_delivery" || value === "suspended_delivery") {
    return value;
  }

  return null;
}

async function getLegacyDeliveryRole({
  supabase,
  user
}: {
  supabase: SupabaseClient;
  user: SupabaseUser;
}): Promise<DeliveryRole | null> {
  const metadataRole =
    normalizeDeliveryRole(user.user_metadata?.delivery_role) ??
    normalizeDeliveryRole(user.user_metadata?.account_role) ??
    normalizeDeliveryRole(user.user_metadata?.account_type) ??
    normalizeDeliveryRole(user.user_metadata?.role);

  if (metadataRole) {
    return metadataRole;
  }

  const { data, error } = await supabase
    .from("account_profiles" as never)
    .select("account_type")
    .eq("user_id", user.id)
    .eq("account_type", "delivery")
    .maybeSingle();

  if (error) {
    return null;
  }

  return data ? "delivery" : null;
}

export async function getDeliveryRoleForUser({
  supabase,
  user
}: {
  supabase: SupabaseClient;
  user: SupabaseUser | null;
}): Promise<DeliveryRole | null> {
  if (!user) {
    return null;
  }

  const agentLookup = await getDeliveryAccessForUser({
    email: user.email,
    userId: user.id
  });

  if (agentLookup.status === "approved") {
    return agentLookup.access.role;
  }

  if (agentLookup.status === "inactive") {
    return "suspended_delivery";
  }

  return getLegacyDeliveryRole({ supabase, user });
}

export async function getCurrentDeliveryAccess() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const role = await getDeliveryRoleForUser({ supabase, user });
  const agent =
    user && role
      ? await getDeliveryAccessForUser({ email: user.email, userId: user.id }).then((lookup) =>
          lookup.status === "approved" || lookup.status === "inactive" ? lookup.access : null
        )
      : null;

  return { agent, role, supabase, user };
}

export async function requireDeliveryAccess(): Promise<{
  agent: DeliveryAgentAccessRecord | null;
  role: DeliveryRole;
  supabase: SupabaseClient;
  user: SupabaseUser;
}> {
  const access = await getCurrentDeliveryAccess();

  if (!access.user) {
    redirect("/delivery/login?next=/delivery/dashboard");
  }

  if (!access.role) {
    redirect("/delivery/login?error=delivery_required");
  }

  if (access.role === "suspended_delivery") {
    redirect("/delivery/login?error=suspended_delivery");
  }

  return {
    agent: access.agent,
    role: access.role,
    supabase: access.supabase,
    user: access.user
  };
}

export async function isCurrentUserDeliveryAccount(supabase: SupabaseClient, user: SupabaseUser | null) {
  return Boolean(await getDeliveryRoleForUser({ supabase, user }));
}
