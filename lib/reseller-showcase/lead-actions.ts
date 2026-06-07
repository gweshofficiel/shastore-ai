"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ResellerLeadStatus } from "@/lib/reseller-showcase/data";

type LeadPlaceholderAction =
  | "reseller_lead_add_note_placeholder"
  | "reseller_lead_archive_placeholder"
  | "reseller_lead_mark_contacted_placeholder"
  | "reseller_lead_mark_lost_placeholder"
  | "reseller_lead_mark_negotiating_placeholder";

function cleanText(value: FormDataEntryValue | null, maxLength = 180) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function safeReturnPath(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.startsWith("/reseller/dashboard")) {
    return "/reseller/dashboard/leads";
  }

  return value;
}

function withStatus(path: string, key: "error" | "saved", value: string) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${key}=${encodeURIComponent(value)}`;
}

function statusForAction(action: LeadPlaceholderAction): ResellerLeadStatus {
  if (action === "reseller_lead_mark_contacted_placeholder") {
    return "contacted";
  }

  if (action === "reseller_lead_mark_negotiating_placeholder") {
    return "negotiating";
  }

  if (action === "reseller_lead_mark_lost_placeholder") {
    return "lost";
  }

  if (action === "reseller_lead_archive_placeholder") {
    return "archived";
  }

  return "interested";
}

async function recordLeadAction(formData: FormData, action: LeadPlaceholderAction) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const returnTo = safeReturnPath(formData.get("returnTo"));

  if (!user) {
    redirect("/login");
  }

  const leadReference = cleanText(formData.get("leadReference")) || "lead-placeholder";
  const interestedItem = cleanText(formData.get("interestedItem")) || "Lead interest placeholder";
  const itemType = cleanText(formData.get("itemType")) || "custom request";
  const source = cleanText(formData.get("leadSource")) || "public_profile_contact";
  const note = cleanText(formData.get("note"), 500);
  const admin = createAdminClient();

  if (admin) {
    await admin.from("monitoring_events" as never).insert({
      entity_id: null,
      entity_type: "reseller_leads",
      event_status: "info",
      event_type: action,
      metadata: {
        contact_masked: "Masked contact",
        interested_item: interestedItem,
        item_type: itemType,
        lead_name: "Lead placeholder",
        lead_reference: leadReference,
        lead_source: source,
        lead_status: statusForAction(action),
        next_action: "Follow up placeholder",
        note: note || null,
        notes: note || "No notes yet. Notes are placeholder-only in this phase.",
        privacy: "Buyer email, phone, private data, order creation, wallet, payout, commission, and ownership transfer are not exposed or performed.",
        requested_item: interestedItem,
        source: "reseller_dashboard_leads"
      },
      store_id: null,
      user_id: user.id,
      workspace_id: null
    } as never);
  }

  revalidatePath("/reseller/dashboard/leads");
  revalidatePath("/reseller/dashboard/analytics");
  redirect(withStatus(returnTo, "saved", action));
}

export async function markLeadContactedPlaceholder(formData: FormData) {
  await recordLeadAction(formData, "reseller_lead_mark_contacted_placeholder");
}

export async function markLeadNegotiatingPlaceholder(formData: FormData) {
  await recordLeadAction(formData, "reseller_lead_mark_negotiating_placeholder");
}

export async function markLeadLostPlaceholder(formData: FormData) {
  await recordLeadAction(formData, "reseller_lead_mark_lost_placeholder");
}

export async function archiveLeadPlaceholder(formData: FormData) {
  await recordLeadAction(formData, "reseller_lead_archive_placeholder");
}

export async function addLeadNotePlaceholder(formData: FormData) {
  await recordLeadAction(formData, "reseller_lead_add_note_placeholder");
}
