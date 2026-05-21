"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ResellerStoreDeliveryMethod } from "@/lib/reseller-business/types";

function cleanText(value: FormDataEntryValue | null, maxLength = 1000) {
  if (!value || typeof value !== "string") {
    return null;
  }

  const text = value.trim().slice(0, maxLength);
  return text || null;
}

function formBoolean(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function normalizeDeliveryMethod(value: FormDataEntryValue | null): ResellerStoreDeliveryMethod {
  if (
    value === "email_placeholder" ||
    value === "whatsapp_placeholder" ||
    value === "pdf_access_placeholder" ||
    value === "ownership_transfer_placeholder"
  ) {
    return value;
  }

  return "manual";
}

function withStatus(path: string, key: "error" | "saved", value: string) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${key}=${encodeURIComponent(value)}`;
}

export async function saveResellerBusinessSettings(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const returnTo = "/reseller/dashboard/business";

  if (!user) {
    redirect("/login?next=/reseller/dashboard/business");
  }

  const { error } = await supabase.from("reseller_business_settings" as never).upsert(
    {
      business_name: cleanText(formData.get("businessName"), 180),
      business_website: cleanText(formData.get("businessWebsite"), 500),
      buyer_thank_you_message: cleanText(formData.get("buyerThankYouMessage"), 1500),
      client_onboarding_instructions: cleanText(
        formData.get("clientOnboardingInstructions"),
        3000
      ),
      generate_invoice_pdf: formBoolean(formData, "generateInvoicePdf"),
      generate_pdf_access_file: formBoolean(formData, "generatePdfAccessFile"),
      invoice_notes: cleanText(formData.get("invoiceNotes"), 2000),
      send_store_access_email: formBoolean(formData, "sendStoreAccessEmail"),
      send_store_access_whatsapp: formBoolean(formData, "sendStoreAccessWhatsapp"),
      store_delivery_method: normalizeDeliveryMethod(formData.get("storeDeliveryMethod")),
      support_email: cleanText(formData.get("supportEmail"), 240),
      support_whatsapp: cleanText(formData.get("supportWhatsapp"), 80),
      user_id: user.id
    } as never,
    { onConflict: "user_id" }
  );

  if (error) {
    redirect(withStatus(returnTo, "error", "Reseller business settings could not be saved."));
  }

  revalidatePath(returnTo);
  redirect(withStatus(returnTo, "saved", "business"));
}
