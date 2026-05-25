"use server";

import { redirect } from "next/navigation";
import { getPublicUrl } from "@/lib/deployment/config";
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

export async function login(formData: FormData) {
  const supabase = await createClient();
  const email = String(formData.get("email"));
  const password = String(formData.get("password"));
  const next = safeAuthRedirect(formData.get("next"));

  if (next.startsWith("/invite/")) {
    console.info("[invite-auth-redirect] login requested for invite", { email });
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
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

  redirect(next);
}

export async function register(formData: FormData) {
  const supabase = await createClient();
  const email = String(formData.get("email"));
  const password = String(formData.get("password"));
  const next = safeAuthRedirect(formData.get("next"));

  if (next.startsWith("/invite/")) {
    console.info("[invite-auth-redirect] signup requested for invite", { email });
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
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

  redirect(next);
}

export async function registerWithInvite(formData: FormData) {
  const supabase = await createClient();
  const token = String(formData.get("inviteToken") ?? "");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

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
  await supabase.auth.signOut();
  redirect("/");
}
