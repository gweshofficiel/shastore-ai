"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { CommerceOperationsScope } from "@/lib/commerce-operations/types";

function cleanText(value: FormDataEntryValue | null, maxLength = 500) {
  if (!value || typeof value !== "string") {
    return null;
  }

  const text = value.trim().slice(0, maxLength);
  return text || null;
}

function formBoolean(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function parseNumber(value: FormDataEntryValue | null, fallback = 0) {
  const parsed = Number(cleanText(value, 40));
  return Number.isFinite(parsed) ? Math.max(parsed, 0) : fallback;
}

function parseInteger(value: FormDataEntryValue | null, fallback = 0) {
  return Math.round(parseNumber(value, fallback));
}

function parseList(value: FormDataEntryValue | null) {
  if (!value || typeof value !== "string") {
    return [];
  }

  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 80);
}

function parseScope(value: FormDataEntryValue | null): CommerceOperationsScope {
  return value === "reseller" ? "reseller" : "seller";
}

function defaultReturnPath(scope: CommerceOperationsScope, area: "commerce" | "shipping") {
  if (scope === "reseller") {
    return "/reseller/dashboard/business";
  }

  return area === "commerce" ? "/dashboard/settings/commerce" : "/dashboard/shipping";
}

function safeReturnPath(
  value: FormDataEntryValue | null,
  scope: CommerceOperationsScope,
  area: "commerce" | "shipping"
) {
  const fallback = defaultReturnPath(scope, area);

  if (typeof value !== "string") {
    return fallback;
  }

  const allowedPrefix = scope === "reseller" ? "/reseller/dashboard" : "/dashboard";
  return value.startsWith(allowedPrefix) ? value : fallback;
}

function withStatus(path: string, key: "error" | "saved", value: string) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${key}=${encodeURIComponent(value)}`;
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

export async function saveCommerceOperationsSettings(formData: FormData) {
  const { supabase, user } = await requireUser();
  const scope = parseScope(formData.get("scope"));
  const returnTo = safeReturnPath(formData.get("returnTo"), scope, "commerce");

  const { error } = await supabase.from("seller_commerce_settings" as never).upsert(
    {
      business_address: cleanText(formData.get("businessAddress"), 1000),
      business_email: cleanText(formData.get("businessEmail"), 240),
      business_name: cleanText(formData.get("businessName"), 180),
      currency: cleanText(formData.get("currency"), 12) ?? "USD",
      dashboard_scope: scope,
      order_confirmation_mode:
        cleanText(formData.get("orderConfirmationMode"), 40) ?? "manual",
      privacy_policy: cleanText(formData.get("privacyPolicy"), 3000),
      return_policy: cleanText(formData.get("returnPolicy"), 3000),
      shipping_policy: cleanText(formData.get("shippingPolicy"), 3000),
      support_phone: cleanText(formData.get("supportPhone"), 80),
      support_whatsapp: cleanText(formData.get("supportWhatsapp"), 80),
      supported_countries: parseList(formData.get("supportedCountries")),
      tax_notes: cleanText(formData.get("taxNotes"), 1000),
      taxes_enabled: formBoolean(formData, "taxesEnabled"),
      timezone: cleanText(formData.get("timezone"), 80) ?? "UTC",
      user_id: user.id
    } as never,
    { onConflict: "user_id,dashboard_scope" }
  );

  if (error) {
    redirect(withStatus(returnTo, "error", "Commerce settings could not be saved."));
  }

  revalidatePath(returnTo);
  redirect(withStatus(returnTo, "saved", "commerce"));
}

export async function saveShippingMethod(formData: FormData) {
  const { supabase, user } = await requireUser();
  const scope = parseScope(formData.get("scope"));
  const returnTo = safeReturnPath(formData.get("returnTo"), scope, "shipping");
  const methodName = cleanText(formData.get("methodName"), 160);

  if (scope === "reseller") {
    redirect(withStatus("/reseller/dashboard/business", "error", "Resellers do not use physical shipping settings."));
  }

  if (!methodName) {
    redirect(withStatus(returnTo, "error", "Shipping method name is required."));
  }

  const { error } = await supabase.from("shipping_methods" as never).insert({
    cod_supported: formBoolean(formData, "codSupported"),
    dashboard_scope: scope,
    delivery_notes: cleanText(formData.get("deliveryNotes"), 1000),
    enabled: formBoolean(formData, "enabled"),
    estimated_delivery_days: parseInteger(formData.get("estimatedDeliveryDays"), 3),
    estimated_delivery_time: cleanText(formData.get("estimatedDeliveryTime"), 120),
    flat_fee: parseNumber(formData.get("flatFee"), 0),
    free_shipping_enabled: formBoolean(formData, "freeShippingEnabled"),
    local_delivery_enabled: formBoolean(formData, "localDeliveryEnabled"),
    method_name: methodName,
    pickup_enabled: formBoolean(formData, "pickupEnabled"),
    preparation_delay_days: parseInteger(formData.get("preparationDelayDays"), 0),
    shipping_regions: parseList(formData.get("shippingRegions")),
    sort_order: parseInteger(formData.get("sortOrder"), 0),
    user_id: user.id
  } as never);

  if (error) {
    redirect(withStatus(returnTo, "error", "Shipping method could not be saved."));
  }

  revalidatePath(returnTo);
  redirect(withStatus(returnTo, "saved", "shipping"));
}

export async function saveDeliveryAgent(formData: FormData) {
  const { supabase, user } = await requireUser();
  const scope = parseScope(formData.get("scope"));
  const returnTo = safeReturnPath(formData.get("returnTo"), scope, "shipping");
  const agentName = cleanText(formData.get("agentName"), 160);

  if (scope === "reseller") {
    redirect(withStatus("/reseller/dashboard/business", "error", "Resellers do not use delivery agents."));
  }

  if (!agentName) {
    redirect(withStatus(returnTo, "error", "Delivery agent name is required."));
  }

  const status = cleanText(formData.get("status"), 20) === "inactive" ? "inactive" : "active";
  const { error } = await supabase.from("delivery_agents" as never).insert({
    agent_name: agentName,
    city: cleanText(formData.get("city"), 120),
    dashboard_scope: scope,
    notes: cleanText(formData.get("notes"), 1000),
    phone: cleanText(formData.get("phone"), 80),
    status,
    user_id: user.id,
    vehicle_type: cleanText(formData.get("vehicleType"), 120)
  } as never);

  if (error) {
    redirect(withStatus(returnTo, "error", "Delivery agent could not be saved."));
  }

  revalidatePath(returnTo);
  redirect(withStatus(returnTo, "saved", "agent"));
}
