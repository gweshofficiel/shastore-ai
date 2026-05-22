"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getOrCreateAccountProfile } from "@/lib/account-profiles";
import { getStoreActivationByToken } from "@/lib/store-activation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type AccountClaimFormState = {
  message: string;
  status: "idle" | "error";
  reason?:
    | "already_claimed"
    | "auth_config"
    | "cancelled"
    | "email_mismatch"
    | "existing_account"
    | "expired"
    | "invalid"
    | "revoked";
};

type ClaimResult = {
  claim_status?: string;
  activation_status?: string;
  store_slug?: string | null;
  ownership_status?: string | null;
  auth_attachment_status?: string | null;
  owner_link_id?: string | null;
};

function cleanToken(value: FormDataEntryValue | string | null) {
  return typeof value === "string" ? value.trim().slice(0, 80) : "";
}

function cleanPassword(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : "";
}

function normalizeEmail(value: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

function isDuplicateUserError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("already") ||
    normalized.includes("registered") ||
    normalized.includes("duplicate") ||
    normalized.includes("exists")
  );
}

async function ensureProfileRows(userId: string, email: string, fullName: string | null) {
  const admin = createAdminClient();

  if (admin) {
    await admin.from("profiles" as never).upsert(
      {
        email,
        full_name: fullName,
        id: userId
      } as never,
      { onConflict: "id" }
    );
  }

  await getOrCreateAccountProfile("user");
}

async function claimCurrentSession(token: string): Promise<AccountClaimFormState | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("claim_store_activation_for_current_user" as never, {
    candidate_token: token
  } as never);

  if (error) {
    console.error("claim_store_activation_for_current_user failed", error);
    return {
      message: "Store ownership could not be linked to this account. Please try again.",
      status: "error"
    };
  }

  const result = Array.isArray(data) ? (data[0] as ClaimResult | undefined) : null;
  const claimStatus = result?.claim_status ?? "not_found";

  if (claimStatus === "claimed") {
    revalidatePath("/dashboard/stores");
    revalidatePath("/reseller/dashboard/orders");
    redirect("/dashboard/stores");
  }

  if (claimStatus === "expired") {
    return {
      message: "This claim link has expired. Contact your reseller for a fresh delivery package.",
      reason: "expired",
      status: "error"
    };
  }

  if (claimStatus === "cancelled") {
    return {
      message: "This claim link was cancelled.",
      reason: "cancelled",
      status: "error"
    };
  }

  if (claimStatus === "revoked") {
    return {
      message: "This claim link was revoked.",
      reason: "revoked",
      status: "error"
    };
  }

  if (claimStatus === "email_mismatch") {
    return {
      message:
        "You are signed in with a different email than the buyer email on this purchase. Sign out and claim with the buyer email.",
      reason: "email_mismatch",
      status: "error"
    };
  }

  if (claimStatus === "claimed_by_other_account") {
    return {
      message: "This store has already been linked to another SHASTORE account.",
      reason: "already_claimed",
      status: "error"
    };
  }

  return {
    message: "This claim link is invalid or no longer available.",
    reason: "invalid",
    status: "error"
  };
}

export async function claimBuyerAccountWithPassword(
  _previousState: AccountClaimFormState,
  formData: FormData
): Promise<AccountClaimFormState> {
  const token = cleanToken(formData.get("token"));
  const password = cleanPassword(formData.get("password"));
  const confirmPassword = cleanPassword(formData.get("confirmPassword"));

  if (!token) {
    return {
      message: "Claim token is missing.",
      reason: "invalid",
      status: "error"
    };
  }

  if (!password || password.length < 8) {
    return {
      message: "Choose a password with at least 8 characters.",
      status: "error"
    };
  }

  if (password !== confirmPassword) {
    return {
      message: "Passwords do not match. Please confirm your password.",
      status: "error"
    };
  }

  const activation = await getStoreActivationByToken(token);

  if (!activation || !activation.buyer_email) {
    return {
      message: "This account claim link is invalid.",
      reason: "invalid",
      status: "error"
    };
  }

  if (activation.activation_status === "expired") {
    return {
      message: "This claim link has expired. Contact your reseller for a fresh delivery package.",
      reason: "expired",
      status: "error"
    };
  }

  if (activation.activation_status === "cancelled" || activation.activation_status === "revoked") {
    return {
      message: `This claim link was ${activation.activation_status}.`,
      reason: activation.activation_status,
      status: "error"
    };
  }

  if (
    (activation.activation_status === "activated" || activation.activation_status === "claimed") &&
    activation.auth_attachment_status === "attached_to_auth_user"
  ) {
    return {
      message: "This store has already been claimed. Log in to open it from My Stores.",
      reason: "already_claimed",
      status: "error"
    };
  }

  const buyerEmail = normalizeEmail(activation.buyer_email);
  const supabase = await createClient();
  const {
    data: { user: currentUser }
  } = await supabase.auth.getUser();

  if (currentUser) {
    if (normalizeEmail(currentUser.email ?? null) !== buyerEmail) {
      return {
        message:
          "You are signed in with a different email than this purchase. Sign out and claim with the buyer email.",
        reason: "email_mismatch",
        status: "error"
      };
    }

    await ensureProfileRows(currentUser.id, buyerEmail, activation.buyer_name);
    return (await claimCurrentSession(token)) ?? { message: "", status: "idle" };
  }

  const existingSignIn = await supabase.auth.signInWithPassword({
    email: buyerEmail,
    password
  });

  if (!existingSignIn.error && existingSignIn.data.user) {
    await ensureProfileRows(existingSignIn.data.user.id, buyerEmail, activation.buyer_name);
    return (await claimCurrentSession(token)) ?? { message: "", status: "idle" };
  }

  const admin = createAdminClient();

  if (!admin) {
    return {
      message:
        "Account claim is not configured yet. Add SUPABASE_SERVICE_ROLE_KEY on the server to create buyer accounts safely.",
      reason: "auth_config",
      status: "error"
    };
  }

  const created = await admin.auth.admin.createUser({
    email: buyerEmail,
    email_confirm: true,
    password,
    user_metadata: {
      buyer_name: activation.buyer_name,
      store_activation_token: token
    }
  });

  if (created.error) {
    if (isDuplicateUserError(created.error.message)) {
      return {
        message:
          "A SHASTORE account already exists for this buyer email. Log in with that account, then reopen this claim link.",
        reason: "existing_account",
        status: "error"
      };
    }

    console.error("Supabase buyer user creation failed", created.error);
    return {
      message: "The buyer account could not be created. Please try again.",
      status: "error"
    };
  }

  if (!created.data.user) {
    return {
      message: "The buyer account could not be created. Please try again.",
      status: "error"
    };
  }

  await ensureProfileRows(created.data.user.id, buyerEmail, activation.buyer_name);

  const signIn = await supabase.auth.signInWithPassword({
    email: buyerEmail,
    password
  });

  if (signIn.error || !signIn.data.user) {
    return {
      message:
        "The buyer account was created, but automatic login failed. Log in with the buyer email and password, then reopen this claim link.",
      reason: "existing_account",
      status: "error"
    };
  }

  await ensureProfileRows(signIn.data.user.id, buyerEmail, activation.buyer_name);

  return (await claimCurrentSession(token)) ?? { message: "", status: "idle" };
}
