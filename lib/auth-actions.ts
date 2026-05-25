"use server";

import { redirect } from "next/navigation";
import { getPublicUrl } from "@/lib/deployment/config";
import { createClient } from "@/lib/supabase/server";

function safeAuthRedirect(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard";
  }

  if (value.startsWith("/login") || value.startsWith("/register")) {
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
    console.info("[invite-auth] login requested for invite", { email });
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (next.startsWith("/invite/")) {
      console.warn("[invite-error] invite login failed", {
        email,
        message: error.message
      });
    }
    redirect(`/login?error=auth&next=${encodeURIComponent(next)}`);
  }

  redirect(next);
}

export async function register(formData: FormData) {
  const supabase = await createClient();
  const email = String(formData.get("email"));
  const password = String(formData.get("password"));
  const next = safeAuthRedirect(formData.get("next"));

  if (next.startsWith("/invite/")) {
    console.info("[invite-auth] signup requested for invite", { email });
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
      console.warn("[invite-error] invite signup failed", {
        email,
        message: error.message
      });
    }
    redirect(`/register?error=auth&next=${encodeURIComponent(next)}`);
  }

  redirect(next);
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
