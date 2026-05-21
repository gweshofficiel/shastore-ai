"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type StoreActivationView = {
  activation_status: "pending" | "activated" | "expired" | "cancelled" | "not_found";
  buyer_email: string | null;
  buyer_name: string | null;
  expires_at: string | null;
  store_instance_id: string | null;
  store_name: string | null;
  store_slug: string | null;
  transfer_code: string | null;
  target_account_id: string | null;
  target_account_lookup_status: string | null;
  account_claim_mode: "existing_account" | "new_account";
  transfer_destination: string;
  auth_attachment_status: string;
  owner_link_id: string | null;
  access_role: string | null;
  requested_domain: string | null;
  connected_domain: string | null;
};

export type StoreActivationFormState = {
  message: string;
  status: "idle" | "success" | "error";
  activationStatus?: string;
  authAttachmentStatus?: string;
  ownerLinkId?: string | null;
  storeSlug?: string | null;
};

function cleanToken(value: string) {
  return value.trim().slice(0, 80);
}

function cleanPassword(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : "";
}

export async function getStoreActivationByToken(token: string): Promise<StoreActivationView | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_store_activation_by_token" as never, {
    candidate_token: cleanToken(token)
  } as never);

  if (error || !Array.isArray(data) || !data[0]) {
    return null;
  }

  const row = data[0] as StoreActivationView & {
    account_claim_mode?: string;
    auth_attachment_status?: string;
    transfer_destination?: string;
  };

  return {
    ...row,
    account_claim_mode:
      row.account_claim_mode === "existing_account" ? "existing_account" : "new_account",
    auth_attachment_status: row.auth_attachment_status ?? "not_attached",
    transfer_destination: row.transfer_destination ?? "new_account_placeholder"
  };
}

export async function claimStoreByActivationToken(
  _previousState: StoreActivationFormState,
  formData: FormData
): Promise<StoreActivationFormState> {
  const token =
    typeof formData.get("token") === "string" ? cleanToken(String(formData.get("token"))) : "";
  const password = cleanPassword(formData.get("password"));
  const confirmPassword = cleanPassword(formData.get("confirmPassword"));

  if (!token) {
    return {
      message: "Activation token is missing.",
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

  try {
    const activation = await getStoreActivationByToken(token);

    if (!activation) {
      return {
        message: "This activation link is invalid.",
        status: "error"
      };
    }

    if (activation.activation_status === "expired") {
      return {
        activationStatus: "expired",
        message: "This activation link has expired. Contact your reseller for a new delivery package.",
        status: "error"
      };
    }

    if (activation.activation_status === "activated") {
      return {
        activationStatus: "activated",
        message: "This store was already activated. You can open it from your buyer dashboard.",
        status: "success",
        storeSlug: activation.store_slug
      };
    }

    if (activation.activation_status === "cancelled") {
      return {
        message: "This activation link was cancelled.",
        status: "error"
      };
    }

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("activate_store_by_token" as never, {
      candidate_token: token
    } as never);

    if (error) {
      return {
        message: "Store activation could not be completed. Please try again.",
        status: "error"
      };
    }

    const result = Array.isArray(data)
      ? (data[0] as
          | {
              activation_status?: string;
              store_slug?: string | null;
              ownership_status?: string | null;
              transfer_destination?: string | null;
              auth_attachment_status?: string | null;
              owner_link_id?: string | null;
            }
          | undefined)
      : null;

    const activationStatus = result?.activation_status ?? "not_found";

    if (activationStatus === "not_found") {
      return {
        message: "This activation link is invalid.",
        status: "error"
      };
    }

    if (activationStatus === "expired") {
      return {
        activationStatus: "expired",
        message: "This activation link has expired. Contact your reseller for a new delivery package.",
        status: "error"
      };
    }

    if (activationStatus !== "activated") {
      return {
        activationStatus,
        message: `Activation could not be completed (${activationStatus.replace(/-/g, " ")}).`,
        status: "error"
      };
    }

    revalidatePath("/dashboard/stores");
    revalidatePath("/reseller/dashboard/orders");

    const accountLabel =
      activation.account_claim_mode === "existing_account"
        ? "linked to your SHASTORE account target"
        : "prepared for new buyer account setup";
    const attachmentLabel =
      result?.auth_attachment_status === "attached_to_auth_user"
        ? "attached to the current Supabase Auth user"
        : "saved as an onboarding placeholder until the buyer signs in";

    return {
      activationStatus: "activated",
      authAttachmentStatus: result?.auth_attachment_status ?? "onboarding_placeholder_prepared",
      message: `Store claimed and ownership recorded (${accountLabel}); ownership is ${attachmentLabel}. Password setup will connect to Supabase auth invite in a future step.`,
      ownerLinkId: result?.owner_link_id ?? null,
      status: "success",
      storeSlug: result?.store_slug ?? activation.store_slug
    };
  } catch (error) {
    console.error("claimStoreByActivationToken failed", error);

    return {
      message: "Something went wrong during activation. Please try again.",
      status: "error"
    };
  }
}

/** @deprecated Use claimStoreByActivationToken via ActivateStoreForm */
export async function activateStoreByToken(formData: FormData) {
  const result = await claimStoreByActivationToken(
    { message: "", status: "idle" },
    formData
  );

  return result;
}
