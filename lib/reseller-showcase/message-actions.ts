"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ResellerConversationStatus } from "@/lib/reseller-showcase/data";

type MessagePlaceholderAction =
  | "reseller_message_add_internal_note_placeholder"
  | "reseller_message_archive_placeholder"
  | "reseller_message_link_lead_placeholder"
  | "reseller_message_mark_read_placeholder"
  | "reseller_message_reply_placeholder";

function cleanText(value: FormDataEntryValue | null, maxLength = 220) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function safeReturnPath(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.startsWith("/reseller/dashboard")) {
    return "/reseller/dashboard/messages";
  }

  return value;
}

function withStatus(path: string, key: "error" | "saved", value: string) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${key}=${encodeURIComponent(value)}`;
}

function statusForAction(action: MessagePlaceholderAction): ResellerConversationStatus {
  if (action === "reseller_message_archive_placeholder") {
    return "archived";
  }

  if (action === "reseller_message_mark_read_placeholder") {
    return "read";
  }

  return "open";
}

async function recordMessageAction(formData: FormData, action: MessagePlaceholderAction) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const returnTo = safeReturnPath(formData.get("returnTo"));

  if (!user) {
    redirect("/login");
  }

  const conversationReference = cleanText(formData.get("conversationReference")) || "conversation-placeholder";
  const relatedItem = cleanText(formData.get("relatedItem")) || "Related item placeholder";
  const relatedLead = cleanText(formData.get("relatedLead")) || "Lead placeholder";
  const itemType = cleanText(formData.get("itemType")) || "custom request";
  const note = cleanText(formData.get("note"), 500);
  const reply = cleanText(formData.get("reply"), 500);
  const admin = createAdminClient();

  if (admin) {
    await admin.from("monitoring_events" as never).insert({
      entity_id: null,
      entity_type: "reseller_messages",
      event_status: "info",
      event_type: action,
      metadata: {
        buyer_display_name: "Buyer placeholder",
        contact_masked: "Masked contact",
        conversation_reference: conversationReference,
        conversation_status: statusForAction(action),
        internal_notes: note || "No internal notes yet. Notes are placeholder-only.",
        item_type: itemType,
        last_message_preview:
          reply || note || "Conversation placeholder action recorded. No external message was sent.",
        privacy: "No public message visibility, buyer private contact, external email/SMS/WhatsApp, order, ownership transfer, wallet, payout, withdrawal, commission, or fake sale was created.",
        related_item: relatedItem,
        related_lead: relatedLead,
        source: "reseller_dashboard_messages",
        unread_count: action === "reseller_message_mark_read_placeholder" ? 0 : 1
      },
      store_id: null,
      user_id: user.id,
      workspace_id: null
    } as never);
  }

  revalidatePath("/reseller/dashboard/messages");
  revalidatePath("/reseller/dashboard/leads");
  revalidatePath("/reseller/dashboard/analytics");
  redirect(withStatus(returnTo, "saved", action));
}

export async function markConversationReadPlaceholder(formData: FormData) {
  await recordMessageAction(formData, "reseller_message_mark_read_placeholder");
}

export async function archiveConversationPlaceholder(formData: FormData) {
  await recordMessageAction(formData, "reseller_message_archive_placeholder");
}

export async function linkConversationLeadPlaceholder(formData: FormData) {
  await recordMessageAction(formData, "reseller_message_link_lead_placeholder");
}

export async function addConversationNotePlaceholder(formData: FormData) {
  await recordMessageAction(formData, "reseller_message_add_internal_note_placeholder");
}

export async function replyConversationPlaceholder(formData: FormData) {
  await recordMessageAction(formData, "reseller_message_reply_placeholder");
}
