"use server";

import { redirect } from "next/navigation";
import { activateAccountRoleForUser, getAccountRoleForUser } from "@/lib/account-roles";
import { recordTestEnvironmentLogin } from "@/lib/admin/test-environment-actions";
import { recordAuthLoginAttempt } from "@/lib/security/login-events";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";
import {
  findAuthUserIdByEmail,
  getDeliveryAccessForUser,
  linkDeliveryAgentToAuthUser
} from "@/lib/delivery/data";

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

  const lookup = await getDeliveryAccessForUser({ email });

  if (lookup.status === "missing_email" || lookup.status === "not_found") {
    redirect("/delivery/login?error=delivery_required");
  }

  if (lookup.status === "inactive") {
    redirect("/delivery/login?error=suspended_delivery");
  }

  const authUserId = await findAuthUserIdByEmail(email);

  if (!authUserId) {
    redirect(
      `/delivery/login?error=auth_setup_required&email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    await recordAuthLoginAttempt({ email, route: "/delivery/login", success: false });
    redirect(`/delivery/login?error=auth_failed&next=${encodeURIComponent(next)}`);
  }

  const accountRole = await getAccountRoleForUser(supabase, data.user.id);

  if (accountRole?.role !== "delivery" || accountRole.status === "suspended" || accountRole.status === "disabled") {
    await supabase.auth.signOut();
    redirect(`/delivery/login?error=role&next=${encodeURIComponent(next)}`);
  }

  if (accountRole.status === "pending") {
    await activateAccountRoleForUser(data.user.id, "delivery");
  }

  await linkDeliveryAgentToAuthUser({
    agentId: lookup.access.agentId,
    userId: data.user.id
  });

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
