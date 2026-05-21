"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function formBoolean(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function cleanText(value: FormDataEntryValue | null, maxLength = 240) {
  if (!value || typeof value !== "string") {
    return null;
  }

  const text = value.trim().slice(0, maxLength);
  return text || null;
}

function normalizeSubdomain(value: FormDataEntryValue | null) {
  if (!value || typeof value !== "string") {
    return null;
  }

  const subdomain = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 63);

  return subdomain || null;
}

function normalizeHostname(value: FormDataEntryValue | null) {
  if (!value || typeof value !== "string") {
    return null;
  }

  const hostname = value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/[^a-z0-9.-]/g, "")
    .slice(0, 253);

  return hostname || null;
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return { supabase, user };
}

export async function saveCommercePaymentSettings(formData: FormData) {
  const { supabase, user } = await requireUser();

  const { error } = await supabase.from("commerce_payment_settings").upsert(
    {
      user_id: user.id,
      stripe_enabled: false,
      paypal_enabled: false,
      cod_enabled: formBoolean(formData, "codEnabled"),
      whatsapp_orders_enabled: formBoolean(formData, "whatsappOrdersEnabled"),
      default_whatsapp_number: cleanText(formData.get("defaultWhatsappNumber"), 80),
      stripe_seller_enabled: formBoolean(formData, "stripeSellerEnabled"),
      paypal_seller_enabled: formBoolean(formData, "paypalSellerEnabled"),
      crypto_enabled: formBoolean(formData, "cryptoEnabled"),
      payment_instructions: cleanText(formData.get("paymentInstructions"), 1000),
      stripe_account_label: null,
      paypal_account_label: null
    },
    { onConflict: "user_id" }
  );

  if (error) {
    redirect(
      `/dashboard/payments?error=${encodeURIComponent(
        "Client payment settings are not ready. Apply the unified commerce and client payment connections migrations first."
      )}`
    );
  }

  revalidatePath("/dashboard/payments");
  redirect("/dashboard/payments?saved=true");
}

export async function prepareCommerceDomain(formData: FormData) {
  const { supabase, user } = await requireUser();
  const sourceType = formData.get("sourceType") === "store" ? "store" : "landing";
  const sourceSlug = cleanText(formData.get("sourceSlug"), 120);
  const freeSubdomain = normalizeSubdomain(formData.get("freeSubdomain"));
  const customDomain = normalizeHostname(formData.get("customDomain"));
  const hostname = customDomain ?? (freeSubdomain ? `${freeSubdomain}.shastore.ai` : null);

  if (!sourceSlug && !freeSubdomain && !customDomain) {
    redirect("/dashboard/domains?error=missing-domain");
  }

  const { error } = await supabase.from("commerce_domain_publications").insert({
    user_id: user.id,
    source_type: sourceType,
    source_slug: sourceSlug,
    free_subdomain: freeSubdomain,
    custom_domain: customDomain,
    hostname
  });

  if (error) {
    redirect(
      `/dashboard/domains?error=${encodeURIComponent(
        "Commerce domain table is not ready. Apply the unified commerce migration first."
      )}`
    );
  }

  revalidatePath("/dashboard/domains");
  redirect("/dashboard/domains?saved=true");
}
