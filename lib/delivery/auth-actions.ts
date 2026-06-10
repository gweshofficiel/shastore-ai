"use server";

import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { activateAccountRoleForUser, getAccountRoleForUser, upsertAccountRoleForUser } from "@/lib/account-roles";
import { recordTestEnvironmentLogin } from "@/lib/admin/test-environment-actions";
import { ensureDeliveryProfileForUser } from "@/lib/delivery/profiles";
import { recordAuthLoginAttempt } from "@/lib/security/login-events";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { getDeliveryAccessForUser, linkDeliveryAgentToAuthUser } from "@/lib/delivery/data";

function normalizeEmail(value: FormDataEntryValue | null) {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  return email.includes("@") ? email : "";
}

function safeDeliveryRedirect(value: FormDataEntryValue | null) {
  const next = typeof value === "string" ? value.trim() : "";

  if (!next.startsWith("/delivery") || next.startsWith("/delivery/login")) {
    return "/delivery/dashboard";
  }

  return next;
}

function isDeliveryRegistrationUser(user: User) {
  const metadata = user.user_metadata as Record<string, unknown> | null;
  return metadata?.account_role === "delivery" && metadata?.shastore_signup_source === "delivery_register";
}

export async function deliveryLogin(formData: FormData) {
  const email = normalizeEmail(formData.get("email"));
  const password = String(formData.get("password"));
  const next = safeDeliveryRedirect(formData.get("next"));
  const rateLimit = await checkRateLimit({
    action: "auth.delivery_login",
    identifier: email || "unknown",
    limit: 10,
    route: "/delivery/login",
    windowSeconds: 300
  });

  if (!rateLimit.allowed) {
    redirect(`/delivery/login?error=rate-limit&next=${encodeURIComponent(next)}`);
  }

  const supabase = await createClient({ role: "delivery" });
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    await recordAuthLoginAttempt({ email, route: "/delivery/login", success: false });
    redirect(`/delivery/login?error=auth_failed&next=${encodeURIComponent(next)}`);
  }

  const accountRole = await getAccountRoleForUser(supabase, data.user.id);
  const recoveredRole =
    !accountRole && isDeliveryRegistrationUser(data.user)
      ? await upsertAccountRoleForUser({ role: "delivery", status: "active", userId: data.user.id })
      : false;

  if (
    !recoveredRole &&
    (accountRole?.role !== "delivery" || accountRole.status === "suspended" || accountRole.status === "disabled")
  ) {
    await supabase.auth.signOut();
    redirect(`/delivery/login?error=role&next=${encodeURIComponent(next)}`);
  }

  if (accountRole?.status === "pending") {
    const activated = await activateAccountRoleForUser(data.user.id, "delivery");
    if (!activated) {
      await supabase.auth.signOut();
      redirect(`/delivery/login?error=role&next=${encodeURIComponent(next)}`);
    }
  }

  const profile = await ensureDeliveryProfileForUser({
    email: data.user.email ?? email,
    name:
      typeof data.user.user_metadata?.name === "string"
        ? data.user.user_metadata.name
        : typeof data.user.user_metadata?.full_name === "string"
          ? data.user.user_metadata.full_name
          : null,
    phone: data.user.phone,
    userId: data.user.id
  });

  if (!profile) {
    await supabase.auth.signOut();
    redirect(`/delivery/login?error=profile&next=${encodeURIComponent(next)}`);
  }

  if (profile.status === "suspended") {
    await supabase.auth.signOut();
    redirect(`/delivery/login?error=suspended_delivery&next=${encodeURIComponent(next)}`);
  }

  const lookup = await getDeliveryAccessForUser({ email: data.user.email ?? email, userId: data.user.id });

  if (lookup.status === "approved") {
    await linkDeliveryAgentToAuthUser({
      agentId: lookup.access.agentId,
      userId: data.user.id
    });
  }

  await recordAuthLoginAttempt({
    email,
    route: "/delivery/login",
    success: true,
    userId: data.user.id
  });
  await recordTestEnvironmentLogin({
    email,
    route: "/delivery/login",
    userId: data.user.id
  });

  redirect(next);
}
