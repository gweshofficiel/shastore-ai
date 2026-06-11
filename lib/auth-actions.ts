"use server";

import { redirect } from "next/navigation";
import {
  activateAccountRoleForUser,
  getAccountRoleForUser,
  isConfiguredSuperAdminEmail,
  upsertAccountRoleForUser,
  type AccountRole
} from "@/lib/account-roles";
import { getPublicUrl } from "@/lib/deployment/config";
import {
  recordTestEnvironmentLogin,
  recordTestEnvironmentLogout
} from "@/lib/admin/test-environment-actions";
import { canUseAdminLoginForInternalTeam } from "@/lib/admin/internal-team-runtime";
import {
  customerNameFromUser,
  ensureCustomerProfileForUser,
  linkStoreCustomersForUser
} from "@/lib/customer-profiles";
import { ensureDeliveryProfileForUser } from "@/lib/delivery/profiles";
import { recordAuthLoginAttempt } from "@/lib/security/login-events";
import { checkRateLimit } from "@/lib/security/rate-limit";
import {
  authSessionRoleForAccountRole,
  authSessionRoleFromHeaders,
  type AuthSessionRole
} from "@/lib/auth-session-roles";
import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { getInviteTokenPreview } from "@/lib/workspace-members";

type AuthenticatedUser = NonNullable<Awaited<ReturnType<Awaited<ReturnType<typeof createClient>>["auth"]["getUser"]>>["data"]["user"]>;

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

function registrationResultPath(
  registerRoute: string,
  outcome: "check-email" | "auth" | "rate-limit" | "restricted" | "password",
  options?: { message?: string; next?: string }
) {
  const params = new URLSearchParams();

  if (outcome === "check-email") {
    params.set("status", outcome);
  } else {
    params.set("error", outcome);
    if (options?.message) {
      params.set("message", options.message.slice(0, 240));
    }
  }

  if (options?.next) {
    params.set("next", options.next);
  }

  return `${registerRoute}?${params.toString()}`;
}

function logAuthRegistration(
  role: AccountRole,
  email: string,
  result: { errorMessage: string | null; hasSession: boolean; hasUser: boolean }
) {
  console.log(`[auth-register][${role}]`, {
    role,
    email,
    hasUser: result.hasUser,
    hasSession: result.hasSession,
    errorMessage: result.errorMessage
  });
}

function registrationRoleFromMetadata(user: AuthenticatedUser): AccountRole | null {
  const metadata = user.user_metadata as Record<string, unknown> | null;
  const role = metadata?.account_role;
  const signupSource = metadata?.shastore_signup_source;

  if (
    (role === "owner" || role === "reseller" || role === "delivery" || role === "customer") &&
    signupSource === `${role}_register`
  ) {
    return role;
  }

  return null;
}

async function recoverMissingRoleFromRegistration({
  expectedRole,
  user
}: {
  expectedRole: AccountRole;
  user: AuthenticatedUser;
}) {
  if (expectedRole === "super_admin") {
    return false;
  }

  const registeredRole = registrationRoleFromMetadata(user);

  if (registeredRole !== expectedRole) {
    return false;
  }

  return upsertAccountRoleForUser({ role: expectedRole, status: "active", userId: user.id });
}

async function completeAuthRegistration({
  confirmationLoginPath,
  email,
  next,
  password,
  registerRoute,
  role,
  signupSource,
  supabase,
  verifiedPhone
}: {
  confirmationLoginPath: string;
  email: string;
  next?: string;
  password: string;
  registerRoute: string;
  role: AccountRole;
  signupSource: string;
  supabase: Awaited<ReturnType<typeof createClient>>;
  verifiedPhone?: string;
}) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        account_role: role,
        phone: verifiedPhone,
        shastore_signup_source: signupSource
      },
      emailRedirectTo: getPublicUrl(confirmationLoginPath)
    }
  });

  const hasUser = Boolean(data?.user);
  const hasSession = Boolean(data?.session);
  const errorMessage = error?.message ?? null;

  logAuthRegistration(role, email, { hasUser, hasSession, errorMessage });

  if (error) {
    redirect(registrationResultPath(registerRoute, "auth", { message: error.message, next }));
  }

  const user = data?.user;
  if (!user) {
    redirect(
      registrationResultPath(registerRoute, "auth", {
        message:
          "Registration was not accepted. No account was created. If email sign-up is disabled, contact support.",
        next
      })
    );
  }

  const identities = user.identities ?? [];
  if (identities.length === 0) {
    redirect(
      registrationResultPath(registerRoute, "auth", {
        message: "An account with this email already exists or registration was not accepted.",
        next
      })
    );
  }

  const roleSaved = await upsertAccountRoleForUser({ role, status: "pending", userId: user.id });
  if (!roleSaved) {
    console.warn(`[auth-register][${role}] role assignment failed`, {
      email,
      role,
      userId: user.id
    });
    redirect(
      registrationResultPath(registerRoute, "auth", {
        message: "Account was created but role assignment failed. Contact support.",
        next
      })
    );
  }

  if (role === "delivery") {
    const profile = await ensureDeliveryProfileForUser({
      email: user.email ?? email,
      name:
        typeof user.user_metadata?.name === "string"
          ? user.user_metadata.name
          : typeof user.user_metadata?.full_name === "string"
            ? user.user_metadata.full_name
            : null,
      phone: user.phone,
      userId: user.id
    });

    if (!profile) {
      console.warn("[auth-register][delivery] delivery profile creation failed", {
        email,
        role,
        userId: user.id
      });
      redirect(
        registrationResultPath(registerRoute, "auth", {
          message: "Account was created but delivery profile setup failed. Contact support.",
          next
        })
      );
    }
  }

  if (role === "customer") {
    const profile = await ensureCustomerProfileForUser({
      email: user.email ?? email,
      name: customerNameFromUser(user),
      phone: verifiedPhone,
      userId: user.id
    });

    if (!profile) {
      console.warn("[auth-register][customer] customer profile creation failed", {
        email,
        role,
        userId: user.id
      });
      redirect(
        registrationResultPath(registerRoute, "auth", {
          message: "Account was created but customer profile setup failed. Contact support.",
          next
        })
      );
    }

    await linkStoreCustomersForUser({
      email: user.email ?? email,
      phone: profile.phone,
      userId: user.id
    });
  }

  redirect(registrationResultPath(registerRoute, "check-email", { next }));
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
  const supabase = await createClient({ role: authSessionRoleForAccountRole(role) });
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

  const internalTeamAdminLoginAllowed =
    role === "super_admin" && !isConfiguredSuperAdminEmail(email)
      ? await canUseAdminLoginForInternalTeam(email)
      : false;

  if (role === "super_admin" && !isConfiguredSuperAdminEmail(email) && !internalTeamAdminLoginAllowed) {
    redirect(roleErrorPath(loginRoute, "restricted", next));
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    await recordAuthLoginAttempt({ email, route: loginRoute, success: false });
    redirect(roleErrorPath(loginRoute, "auth", next));
  }

  const accountRole = await getAccountRoleForUser(supabase, data.user.id);
  const recoveredRole = !accountRole
    ? await recoverMissingRoleFromRegistration({ expectedRole: role, user: data.user })
    : false;
  const legacyOwner = role === "owner" && !accountRole && !registrationRoleFromMetadata(data.user);

  if (legacyOwner) {
    const roleSaved = await upsertAccountRoleForUser({ role: "owner", status: "active", userId: data.user.id });
    if (!roleSaved) {
      await supabase.auth.signOut();
      redirect(roleErrorPath(loginRoute, "role", next));
    }
  } else if (
    !internalTeamAdminLoginAllowed &&
    !recoveredRole &&
    (!accountRole || accountRole.role !== role || accountRole.status === "suspended" || accountRole.status === "disabled")
  ) {
    await supabase.auth.signOut();
    redirect(roleErrorPath(loginRoute, role === "super_admin" ? "restricted" : "role", next));
  } else if (accountRole?.status === "pending") {
    await activateAccountRoleForUser(data.user.id, role);
  }

  if (role === "customer") {
    const metadataPhone = typeof data.user.user_metadata?.phone === "string" ? data.user.user_metadata.phone : "";
    const profile = await ensureCustomerProfileForUser({
      email: data.user.email ?? email,
      name: customerNameFromUser(data.user),
      phone: metadataPhone || data.user.phone,
      userId: data.user.id
    });

    if (!profile) {
      await supabase.auth.signOut();
      redirect(roleErrorPath(loginRoute, "profile", next));
    }

    await linkStoreCustomersForUser({
      email: data.user.email ?? email,
      phone: profile.phone,
      userId: data.user.id
    });
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
  confirmationLoginPath,
  defaultNext,
  formData,
  registerRoute,
  role
}: {
  confirmationLoginPath: string;
  defaultNext: string;
  formData: FormData;
  registerRoute: string;
  role: AccountRole;
}) {
  const supabase = await createClient({ role: authSessionRoleForAccountRole(role) });
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const customerPhone = role === "customer" ? String(formData.get("phone") ?? "").trim() : "";
  const next = safeRoleRedirect(formData.get("next"), defaultNext, defaultNext.split("/").slice(0, 2).join("/") || defaultNext);
  const rateLimit = await checkRateLimit({
    action: `auth.${role}_register`,
    identifier: email,
    limit: 5,
    route: registerRoute,
    windowSeconds: 300
  });

  if (!rateLimit.allowed) {
    redirect(registrationResultPath(registerRoute, "rate-limit", { next }));
  }

  if (role === "super_admin" && !isConfiguredSuperAdminEmail(email)) {
    redirect(registrationResultPath(registerRoute, "restricted", { next }));
  }

  if (role === "customer" && !customerPhone) {
    redirect(
      registrationResultPath(registerRoute, "auth", {
        message: "Phone or WhatsApp number is required for customer registration.",
        next
      })
    );
  }

  await completeAuthRegistration({
    confirmationLoginPath,
    email,
    next,
    password,
    registerRoute,
    role,
    signupSource: `${role}_register`,
    supabase,
    verifiedPhone: customerPhone || undefined
  });
}

export async function login(formData: FormData) {
  const supabase = await createClient({ role: "owner" });
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
  const registeredRole = data.user ? registrationRoleFromMetadata(data.user) : null;

  if (accountRole && accountRole.role !== "owner") {
    await supabase.auth.signOut();
    redirect(`/login?error=role&next=${encodeURIComponent(next)}`);
  }

  if (data.user && !accountRole) {
    if (registeredRole && registeredRole !== "owner") {
      await supabase.auth.signOut();
      redirect(`/login?error=role&next=${encodeURIComponent(next)}`);
    }

    const roleSaved = await upsertAccountRoleForUser({ role: "owner", status: "active", userId: data.user.id });
    if (!roleSaved) {
      await supabase.auth.signOut();
      redirect(`/login?error=role&next=${encodeURIComponent(next)}`);
    }
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
  const supabase = await createClient({ role: "owner" });
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
      emailRedirectTo: getPublicUrl("/login")
    }
  });

  const hasUser = Boolean(data?.user);
  const hasSession = Boolean(data?.session);
  const errorMessage = error?.message ?? null;

  logAuthRegistration("owner", email, { hasUser, hasSession, errorMessage });

  if (error) {
    if (next.startsWith("/invite/")) {
      console.warn("[invite-auth-failed] invite signup failed", {
        email,
        message: error.message
      });
    }
    const inviteToken = next.replace("/invite/", "");
    redirect(
      next.startsWith("/invite/")
        ? `/auth/register?error=auth&invite=${encodeURIComponent(inviteToken)}&message=${encodeURIComponent(error.message.slice(0, 240))}`
        : registrationResultPath("/register", "auth", { message: error.message, next })
    );
  }

  const user = data?.user;
  if (!user) {
    redirect(
      registrationResultPath("/register", "auth", {
        message:
          "Registration was not accepted. No account was created. If email sign-up is disabled, contact support.",
        next
      })
    );
  }

  const identities = user.identities ?? [];
  if (identities.length === 0) {
    redirect(
      registrationResultPath("/register", "auth", {
        message: "An account with this email already exists or registration was not accepted.",
        next
      })
    );
  }

  const roleSaved = await upsertAccountRoleForUser({ role: "owner", status: "pending", userId: user.id });
  if (!roleSaved) {
    console.warn("[auth-register][owner] role assignment failed", {
      email,
      role: "owner",
      userId: user.id
    });
    redirect(
      registrationResultPath("/register", "auth", {
        message: "Account was created but role assignment failed. Contact support.",
        next
      })
    );
  }

  if (next.startsWith("/invite/")) {
    console.info("[invite-auth-success] invite signup submitted", { email });
  }

  redirect(registrationResultPath("/register", "check-email", { next }));
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
  const next = safeRoleRedirect(formData.get("next"), "/admin", "/admin");

  redirect(roleErrorPath("/admin/login", "restricted", next));
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
    confirmationLoginPath: "/reseller/login",
    defaultNext: "/reseller/dashboard",
    formData,
    registerRoute: "/reseller/register",
    role: "reseller"
  });
}

export async function deliveryRegister(formData: FormData) {
  await registerForRole({
    confirmationLoginPath: "/delivery/login",
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
    confirmationLoginPath: "/customer/login",
    defaultNext: "/customer",
    formData,
    registerRoute: "/customer/register",
    role: "customer"
  });
}

export async function registerWithInvite(formData: FormData) {
  const supabase = await createClient({ role: "owner" });
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

function logoutRedirectForRole(role: AuthSessionRole) {
  if (role === "admin") {
    return "/admin/login";
  }

  if (role === "customer") {
    return "/customer/login";
  }

  if (role === "delivery") {
    return "/delivery/login";
  }

  if (role === "reseller") {
    return "/reseller/login";
  }

  return "/login";
}

function authSessionRoleFromFormData(formData: FormData | null | undefined): AuthSessionRole | null {
  const role = String(formData?.get("role") ?? "").trim();

  if (
    role === "admin" ||
    role === "customer" ||
    role === "delivery" ||
    role === "owner" ||
    role === "reseller"
  ) {
    return role;
  }

  return null;
}

export async function logout(formData?: FormData) {
  const role = authSessionRoleFromFormData(formData) ?? authSessionRoleFromHeaders(await headers());
  const supabase = await createClient({ role });
  const {
    data: { user }
  } = await supabase.auth.getUser();
  await recordTestEnvironmentLogout(user?.id);
  await supabase.auth.signOut();
  redirect(logoutRedirectForRole(role));
}
