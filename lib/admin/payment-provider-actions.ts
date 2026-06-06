"use server";

import { revalidatePath } from "next/cache";
import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";

type PaymentProviderAction =
  | "admin_payment_provider_clear_review"
  | "admin_payment_provider_disable"
  | "admin_payment_provider_enable"
  | "admin_payment_provider_mark_review"
  | "admin_payment_provider_view_logs";

function cleanProviderKey(formData: FormData) {
  return String(formData.get("providerKey") ?? "").trim();
}

async function recordPaymentProviderAction(formData: FormData, eventType: PaymentProviderAction) {
  const access = await getAdminAccess();
  const providerKey = cleanProviderKey(formData);

  if (!providerKey) {
    throw new Error("Missing payment provider key.");
  }

  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for provider controls.");
  }

  await admin.from("billing_events" as never).insert({
    event_type: eventType,
    provider: "admin",
    user_id: access.user.id,
    payload: {
      providerKey,
      source: "super_admin_payment_providers_control_center",
      note: "Placeholder control only. No provider API was called."
    } as never,
    processed_at: new Date().toISOString()
  } as never);

  revalidatePath("/admin/billing/payment-providers");
}

export async function enablePaymentProviderPlaceholder(formData: FormData) {
  await recordPaymentProviderAction(formData, "admin_payment_provider_enable");
}

export async function disablePaymentProviderPlaceholder(formData: FormData) {
  await recordPaymentProviderAction(formData, "admin_payment_provider_disable");
}

export async function markPaymentProviderUnderReview(formData: FormData) {
  await recordPaymentProviderAction(formData, "admin_payment_provider_mark_review");
}

export async function clearPaymentProviderReview(formData: FormData) {
  await recordPaymentProviderAction(formData, "admin_payment_provider_clear_review");
}

export async function viewPaymentProviderLogs(formData: FormData) {
  await recordPaymentProviderAction(formData, "admin_payment_provider_view_logs");
}
