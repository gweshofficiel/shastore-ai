import { createClient } from "@/lib/supabase/server";

export type AccountProfileType = "user" | "reseller" | "admin";

export type AccountProfile = {
  id: string;
  user_id: string;
  account_id: string;
  account_type: AccountProfileType;
  display_name: string | null;
  email: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
};

function accountSuffix(accountType: AccountProfileType) {
  if (accountType === "reseller") {
    return "R";
  }

  if (accountType === "admin") {
    return "A";
  }

  return "U";
}

function accountDigits(accountType: AccountProfileType) {
  return accountType === "reseller" ? 7 : 9;
}

function randomDigits(length: number) {
  const max = 10 ** length;
  return String(Math.floor(Math.random() * max)).padStart(length, "0");
}

function generateAccountId(accountType: AccountProfileType) {
  if (accountType === "admin") {
    return `SHA${randomDigits(9)}A`;
  }

  return `SHA${randomDigits(accountDigits(accountType))}${accountSuffix(accountType)}`;
}

function isMissingAccountProfilesTable(error: { code?: string; message?: string } | null) {
  const message = (error?.message ?? "").toLowerCase();
  return (
    error?.code === "PGRST205" ||
    error?.code === "PGRST204" ||
    message.includes("account_profiles") ||
    message.includes("could not find the table")
  );
}

export async function getOrCreateAccountProfile(
  accountType: AccountProfileType
): Promise<AccountProfile | null> {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: existing, error: existingError } = await supabase
    .from("account_profiles" as never)
    .select("*")
    .eq("user_id", user.id)
    .eq("account_type", accountType)
    .maybeSingle();

  if (existing) {
    return existing as AccountProfile;
  }

  if (existingError && !isMissingAccountProfilesTable(existingError)) {
    return null;
  }

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const accountId =
      accountType === "admin" && attempt === 0 ? "SHA000000001A" : generateAccountId(accountType);
    const { data, error } = await supabase
      .from("account_profiles" as never)
      .insert({
        account_id: accountId,
        account_type: accountType,
        display_name:
          user.user_metadata?.full_name ??
          user.user_metadata?.name ??
          user.email?.split("@")[0] ??
          null,
        email: user.email ?? null,
        phone: user.phone ?? null,
        user_id: user.id
      } as never)
      .select("*")
      .single();

    if (data && !error) {
      return data as AccountProfile;
    }

    const message = (error?.message ?? "").toLowerCase();
    if (!message.includes("duplicate") && !message.includes("unique")) {
      return null;
    }
  }

  return null;
}

export function accountProfileUnavailableMessage() {
  return "Apply supabase/migrations/shastore-account-id-foundation-safe.sql to enable permanent SHASTORE Account IDs.";
}
