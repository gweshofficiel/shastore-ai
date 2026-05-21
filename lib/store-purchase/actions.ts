"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { StorePurchaseRequestStatus } from "@/lib/store-purchase/types";

export type StorePurchaseFormState = {
  message: string;
  status: "idle" | "success" | "error";
};

const allowedStatuses: StorePurchaseRequestStatus[] = [
  "pending",
  "approved",
  "rejected",
  "preparing",
  "delivered"
];

function cleanText(value: FormDataEntryValue | null, maxLength = 1000) {
  if (!value || typeof value !== "string") {
    return null;
  }

  const text = value.trim().slice(0, maxLength);
  return text || null;
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function safeOrdersReturnPath(value: FormDataEntryValue | null) {
  if (typeof value === "string" && value.startsWith("/reseller/dashboard/orders")) {
    return value;
  }

  return "/reseller/dashboard/orders";
}

function withStatus(path: string, key: "error" | "saved", value: string) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${key}=${encodeURIComponent(value)}`;
}

function redirectWithError(message: string, returnTo: string): never {
  redirect(withStatus(returnTo, "error", message));
}

async function requireResellerProfile() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("reseller_profiles" as never)
    .select("id, slug")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) {
    redirectWithError("Create your reseller profile before managing store orders.", "/reseller/dashboard/orders");
  }

  return {
    profile: profile as { id: string; slug: string },
    supabase,
    user
  };
}

export async function submitStorePurchaseRequest(
  _previousState: StorePurchaseFormState,
  formData: FormData
): Promise<StorePurchaseFormState> {
  const supabase = await createClient();
  const buyerName = cleanText(formData.get("buyerName"), 120);
  const buyerEmail = cleanText(formData.get("buyerEmail"), 160);
  const businessName = cleanText(formData.get("businessName"), 160);
  const resellerId = cleanText(formData.get("resellerId"), 80);
  const showcaseItemId = cleanText(formData.get("showcaseItemId"), 80);

  if (!buyerName || !buyerEmail || !businessName || !resellerId || !showcaseItemId) {
    return {
      message: "Please complete your name, email, business name, and selected store.",
      status: "error"
    };
  }

  if (!isEmail(buyerEmail)) {
    return { message: "Please enter a valid buyer email.", status: "error" };
  }

  const { error } = await supabase.from("store_purchase_requests" as never).insert({
    business_name: businessName,
    buyer_email: buyerEmail,
    buyer_name: buyerName,
    buyer_phone: cleanText(formData.get("buyerPhone"), 80),
    buyer_whatsapp: cleanText(formData.get("buyerWhatsapp"), 80),
    notes: cleanText(formData.get("notes"), 1200),
    requested_domain: cleanText(formData.get("requestedDomain"), 160),
    request_status: "pending",
    reseller_id: resellerId,
    showcase_item_id: showcaseItemId,
    template_id: cleanText(formData.get("templateId"), 120)
  } as never);

  if (error) {
    return {
      message: "Your request could not be sent. Please check the store is still available.",
      status: "error"
    };
  }

  return {
    message: "Request sent. The reseller can now review your store purchase and prepare transfer.",
    status: "success"
  };
}

export async function updateStorePurchaseRequestStatus(formData: FormData) {
  const returnTo = safeOrdersReturnPath(formData.get("returnTo"));
  const requestId = cleanText(formData.get("requestId"), 80);
  const status = cleanText(formData.get("requestStatus"), 40) as StorePurchaseRequestStatus | null;
  const { profile, supabase } = await requireResellerProfile();

  if (!requestId || !status || !allowedStatuses.includes(status)) {
    redirectWithError("Store purchase request status could not be updated.", returnTo);
  }

  const { error } = await supabase
    .from("store_purchase_requests" as never)
    .update({ request_status: status } as never)
    .eq("id", requestId)
    .eq("reseller_id", profile.id);

  if (error) {
    redirectWithError("Store purchase request status could not be saved.", returnTo);
  }

  revalidatePath(returnTo);
  redirect(withStatus(returnTo, "saved", status));
}

export async function prepareStoreTransferRecord(formData: FormData) {
  const returnTo = safeOrdersReturnPath(formData.get("returnTo"));
  const requestId = cleanText(formData.get("requestId"), 80);
  const { profile, supabase } = await requireResellerProfile();

  if (!requestId) {
    redirectWithError("Store purchase request could not be found.", returnTo);
  }

  const { error: transferError } = await supabase.from("store_transfer_records" as never).upsert(
    {
      delivery_status: "pdf_pending",
      email_delivery_placeholder:
        "Future email delivery will send buyer credentials and transfer checklist.",
      pdf_delivery_placeholder:
        "Future PDF delivery will include store access, transfer code, and onboarding steps.",
      request_id: requestId,
      reseller_id: profile.id,
      transfer_status: "ownership_pending",
      whatsapp_delivery_placeholder:
        "Future WhatsApp delivery will notify the buyer when ownership transfer is ready."
    } as never,
    { onConflict: "request_id" }
  );

  if (transferError) {
    redirectWithError("Ownership transfer preparation could not be created.", returnTo);
  }

  await supabase
    .from("store_purchase_requests" as never)
    .update({ request_status: "preparing" } as never)
    .eq("id", requestId)
    .eq("reseller_id", profile.id);

  revalidatePath(returnTo);
  redirect(withStatus(returnTo, "saved", "preparing"));
}
