"use server";

import { redirect } from "next/navigation";
import {
  activateAccountRoleForUser,
  getAccountRoleForUser,
  isOfficialSuperAdminEmail,
  upsertAccountRoleForUser,
  type AccountRole
} from "@/lib/account-roles";
import { getPublicUrl } from "@/lib/deployment/config";
import {
  recordTestEnvironmentLogin,
  recordTestEnvironmentLogout
} from "@/lib/admin/test-environment-actions";
import { recordAuthLoginAttempt } from "@/lib/security/login-events";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { getInviteTokenPreview } from "@/lib/workspace-members";

function safeAuthRedirect(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard";
  }

  if (value.startsWith("/login") || value.startsWith("/register") || value.startsWith("/auth")) {
    return "/dashboard";
  }

  return value;
}

function roleErrorPath(route: string, error: string, next?: string) {
  return `${route}?error=${encodeURIComponent(error)}${next ? `&next=${encodeURIComponent(next)}` : ""}`;
}

function safeRoleRedirect(value: FormDataEntryValue | null, fallback: string, allowedPrefix: string) {
  const next = typeof value === "string" ? value.trim() : "";

  if (!next.startsWith("/") || next.startsWith("//")) {
    return fallback;
  }

  if (!next.startsWith(allowedPrefix)) {
    return fallback;
  }

  return next;
}

async function loginForRole({
  allowedPrefix,
  defaultNext,
  formData,
  loginRoute,
  rateLimitAction,
  role
}: {
  allowedPrefix: string;
  defaultNext: string;
  formData: FormData;
  loginRoute: string;
  rateLimitAction: string;
  role: AccountRole;
}) {
  const supabase = await createClient();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = safeRoleRedirect(formData.get("next"), defaultNext, allowedPrefix);
  const rateLimit = await checkRateLimit({
    action: rateLimitAction,
    identifier: email,
    limit: 10,
    route: loginRoute,
    windowSeconds: 300
  });

  if (!rateLimit.allowed) {
    redirect(roleErrorPath(loginRoute, "rate-limit", next));
  }

  if (role === "super_admin" && !isOfficialSuperAdminEmail(email)) {
    redirect(roleErrorPath(loginRoute, "role", next));
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    await recordAuthLoginAttempt({ email, route: loginRoute, success: false });
    redirect(roleErrorPath(loginRoute, "auth", next));
  }

  const accountRole = await getAccountRoleForUser(supabase, data.user.id);
  const legacyOwner = role === "owner" && !accountRole;

  if (legacyOwner) {
    await upsertAccountRoleForUser({ role: "owner", status: "active", userId: data.user.id });
  } else if (!accountRole || accountRole.role !== role || accountRole.status === "suspended" || accountRole.status === "disabled") {
    await supabase.auth.signOut();
    redirect(roleErrorPath(loginRoute, "role", next));
  } else if (accountRole.status === "pending") {
    await activateAccountRoleForUser(data.user.id, role);
  }

  await recordAuthLoginAttempt({
    email,
    route: loginRoute,
    success: true,
    userId: data.user.id
  });
  await recordTestEnvironmentLogin({
    email,
    route: loginRoute,
    userId: data.user.id
  });

  redirect(next);
}

async function registerForRole({
  defaultNext,
  formData,
  registerRoute,
  role
}: {
  defaultNext: string;
  formData: FormData;
  registerRoute: string;
  role: AccountRole;
}) {
  const supabase = await createClient();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = safeRoleRedirect(formData.get("next"), defaultNext, defaultNext.split("/").slice(0, 2).join("/") || defaultNext);
  const rateLimit = await checkRateLimit({
    action: `auth.${role}_register`,
    identifier: email,
    limit: 5,
    route: registerRoute,
    windowSeconds: 300
  });

  if (!rateLimit.allowed) {
    redirect(roleErrorPath(registerRoute, "rate-limit", next));
  }

  if (role === "super_admin" && !isOfficialSuperAdminEmail(email)) {
    redirect(roleErrorPath(registerRoute, "role", next));
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        account_role: role,
        shastore_signup_source: `${role}_register`
      },
      emailRedirectTo: getPublicUrl(next)
    }
  });

  if (error) {
    redirect(roleErrorPath(registerRoute, "auth", next));
  }

  if (data.user) {
    await upsertAccountRoleForUser({ role, status: "pending", userId: data.user.id });
  }

  redirect(roleErrorPath(registerRoute, "check-email", next));
}

export async function login(formData: FormData) {
  const supabase = await createClient();
  const email = String(formData.get("email"));
  const password = String(formData.get("password"));
  const next = safeAuthRedirect(formData.get("next"));
  const rateLimit = await checkRateLimit({
    action: "auth.login",
    identifier: email,
    limit: 10,
    route: "/login",
    windowSeconds: 300
  });

  if (!rateLimit.allowed) {
    redirect(`/login?error=rate-limit&next=${encodeURIComponent(next)}`);
  }

  if (next.startsWith("/invite/")) {
    console.info("[invite-auth-redirect] login requested for invite", { email });
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    await recordAuthLoginAttempt({ email, route: "/login", success: false });
    if (next.startsWith("/invite/")) {
      console.warn("[invite-auth-failed] invite login failed", {
        email,
        message: error.message
      });
    }
    redirect(
      next.startsWith("/invite/")
        ? `/auth/login?error=auth&invite=${encodeURIComponent(next.replace("/invite/", ""))}`
        : `/login?error=auth&next=${encodeURIComponent(next)}`
    );
  }

  if (next.startsWith("/invite/")) {
    console.info("[invite-auth-success] invite login succeeded", { email });
  }

  const accountRole = data.user ? await getAccountRoleForUser(supabase, data.user.id) : null;

  if (accountRole && accountRole.role !== "owner") {
    await supabase.auth.signOut();
    redirect(`/login?error=role&next=${encodeURIComponent(next)}`);
  }

  if (data.user && !accountRole) {
    await upsertAccountRoleForUser({ role: "owner", status: "active", userId: data.user.id });
  } else if (data.user && accountRole?.role === "owner" && accountRole.status === "pending") {
    await activateAccountRoleForUser(data.user.id, "owner");
  }

  await recordAuthLoginAttempt({
    email,
    route: "/login",
    success: true,
    userId: data.user?.id ?? null
  });
  await recordTestEnvironmentLogin({
    email,
    route: "/login",
    userId: data.user?.id ?? null
  });

  redirect(next);
}

export async function register(formData: FormData) {
  const supabase = await createClient();
  const email = String(formData.get("email"));
  const password = String(formData.get("password"));
  const next = safeAuthRedirect(formData.get("next"));
  const rateLimit = await checkRateLimit({
    action: "auth.register",
    identifier: email,
    limit: 5,
    route: "/register",
    windowSeconds: 300
  });

  if (!rateLimit.allowed) {
    redirect(`/register?error=rate-limit&next=${encodeURIComponent(next)}`);
  }

  if (next.startsWith("/invite/")) {
    console.info("[invite-auth-redirect] signup requested for invite", { email });
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        account_role: "owner",
        shastore_signup_source: "owner_register"
      },
      emailRedirectTo: getPublicUrl(next)
    }
  });

  if (error) {
    if (next.startsWith("/invite/")) {
      console.warn("[invite-auth-failed] invite signup failed", {
        email,
        message: error.message
      });
    }
    redirect(
      next.startsWith("/invite/")
        ? `/auth/register?error=auth&invite=${encodeURIComponent(next.replace("/invite/", ""))}`
        : `/register?error=auth&next=${encodeURIComponent(next)}`
    );
  }

  if (next.startsWith("/invite/")) {
    console.info("[invite-auth-success] invite signup submitted", { email });
  }

  if (data.user) {
    await upsertAccountRoleForUser({ role: "owner", status: "pending", userId: data.user.id });
  }

  redirect(`/register?status=check-email&next=${encodeURIComponent(next)}`);
}

export async function adminLogin(formData: FormData) {
  await loginForRole({
    allowedPrefix: "/admin",
    defaultNext: "/admin",
    formData,
    loginRoute: "/admin/login",
    rateLimitAction: "auth.admin_login",
    role: "super_admin"
  });
}

export async function adminRegister(formData: FormData) {
  await registerForRole({
    defaultNext: "/admin",
    formData,
    registerRoute: "/admin/register",
    role: "super_admin"
  });
}

export async function resellerLogin(formData: FormData) {
  await loginForRole({
    allowedPrefix: "/reseller",
    defaultNext: "/reseller/dashboard",
    formData,
    loginRoute: "/reseller/login",
    rateLimitAction: "auth.reseller_login",
    role: "reseller"
  });
}

export async function resellerRegister(formData: FormData) {
  await registerForRole({
    defaultNext: "/reseller/dashboard",
    formData,
    registerRoute: "/reseller/register",
    role: "reseller"
  });
}

export async function deliveryRegister(formData: FormData) {
  await registerForRole({
    defaultNext: "/delivery/dashboard",
    formData,
    registerRoute: "/delivery/register",
    role: "delivery"
  });
}

export async function customerLogin(formData: FormData) {
  await loginForRole({
    allowedPrefix: "/customer",
    defaultNext: "/customer",
    formData,
    loginRoute: "/customer/login",
    rateLimitAction: "auth.customer_login",
    role: "customer"
  });
}

export async function customerRegister(formData: FormData) {
  await registerForRole({
    defaultNext: "/customer",
    formData,
    registerRoute: "/customer/register",
    role: "customer"
  });
}

export async function registerWithInvite(formData: FormData) {
  const supabase = await createClient();
  const token = String(formData.get("inviteToken") ?? "");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const rateLimit = await checkRateLimit({
    action: "auth.invite_register",
    identifier: `${token}:${email}`,
    limit: 5,
    route: "/invite/[token]/signup",
    windowSeconds: 300
  });

  if (!rateLimit.allowed) {
    redirect(
      token
        ? `/invite/${encodeURIComponent(token)}/signup?error=rate-limit`
        : "/auth/register?error=rate-limit"
    );
  }

  console.log("[invite-signup-page] invite signup submitted", {
    email,
    hasToken: Boolean(token)
  });

  if (!token || !/^[A-Za-z0-9_-]{20,256}$/.test(token)) {
    redirect("/auth/register?error=invite");
  }

  if (password !== confirmPassword) {
    redirect(`/invite/${encodeURIComponent(token)}/signup?error=password`);
  }

  const invite = await getInviteTokenPreview(token);

  if (!invite.ok || !invite.email) {
    redirect(`/invite/${encodeURIComponent(token)}/signup?error=invite`);
  }

  if (email !== invite.email.toLowerCase()) {
    console.warn("[invite-signup-email-locked] attempted invited email change", {
      attemptedEmail: email,
      inviteEmail: invite.email
    });
    redirect(`/invite/${encodeURIComponent(token)}/signup?error=email`);
  }

  console.log("[invite-signup-email-locked] creating auth user with locked invite email", {
    email: invite.email,
    role: invite.role
  });
  console.log("[invite-signup-no-personal-workspace] signup will only create auth account", {
    email: invite.email
  });

  const { error } = await supabase.auth.signUp({
    email: invite.email,
    password,
    options: {
      data: {
        shastore_invited_role: invite.role,
        shastore_signup_source: "workspace_invite"
      },
      emailRedirectTo: getPublicUrl(`/invite/${token}`)
    }
  });

  if (error) {
    console.warn("[invite-auth-failed] invite signup failed", {
      email: invite.email,
      message: error.message
    });
    redirect(`/invite/${encodeURIComponent(token)}/signup?error=auth`);
  }

  console.info("[invite-auth-success] invite signup submitted", {
    email: invite.email,
    role: invite.role
  });

  redirect(`/invite/${encodeURIComponent(token)}`);
}

export async function logout() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  await recordTestEnvironmentLogout(user?.id);
  await supabase.auth.signOut();
  redirect("/");
}
