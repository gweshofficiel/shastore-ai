"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  normalizeMarketingMessageStatus,
  normalizeMarketingMessageType
} from "@/lib/store-marketing-messages";
import { getWorkspaceDataContext } from "@/lib/workspaces/data-access";

const messagesPath = "/dashboard/popups-announcements";

function cleanText(value: FormDataEntryValue | null, maxLength = 1000) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function parseOptionalDate(value: FormDataEntryValue | null) {
  const raw = cleanText(value, 80);

  if (!raw) {
    return null;
  }

  const date = new Date(raw);

  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function redirectWith(status: string, storeId: string): never {
  const params = new URLSearchParams({ messages: status });

  if (storeId) {
    params.set("storeId", storeId);
  }

  redirect(`${messagesPath}?${params.toString()}`);
}

export async function createStoreMarketingMessageAction(formData: FormData) {
  const storeId = cleanText(formData.get("storeId"), 80);
  const messageType = normalizeMarketingMessageType(formData.get("messageType"));
  const status = normalizeMarketingMessageStatus(formData.get("status"));
  const title = cleanText(formData.get("title"), 180);
  const message = cleanText(formData.get("message"), 1000);
  const buttonText = cleanText(formData.get("buttonText"), 80);
  const buttonLink = cleanText(formData.get("buttonLink"), 500);
  const startsAt = parseOptionalDate(formData.get("startsAt"));
  const endsAt = parseOptionalDate(formData.get("endsAt"));

  if (!storeId || !title || !message) {
    redirectWith("invalid", storeId);
  }

  if (startsAt && endsAt && new Date(startsAt) > new Date(endsAt)) {
    redirectWith("invalid-dates", storeId);
  }

  const { supabase, user, workspaceId } = await getWorkspaceDataContext({
    permission: "can_edit_stores",
    redirectTo: messagesPath
  });
  const { data: store } = await supabase
    .from("stores")
    .select("id")
    .eq("id", storeId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (!store) {
    redirectWith("access-denied", storeId);
  }

  const { error } = await supabase.from("store_marketing_messages" as never).insert({
    button_link: buttonLink || null,
    button_text: buttonText || null,
    created_by: user.id,
    ends_at: endsAt,
    message,
    message_type: messageType,
    starts_at: startsAt,
    status,
    store_id: storeId,
    title,
    workspace_id: workspaceId
  } as never);

  if (error) {
    console.error("[marketing-messages] create failed", {
      code: error.code,
      message: error.message,
      storeId,
      workspaceId
    });
    redirectWith("create-failed", storeId);
  }

  revalidatePath(messagesPath);
  redirectWith("created", storeId);
}

export async function updateStoreMarketingMessageStatusAction(formData: FormData) {
  const messageId = cleanText(formData.get("messageId"), 80);
  const storeId = cleanText(formData.get("storeId"), 80);
  const status = normalizeMarketingMessageStatus(formData.get("status"));

  if (!messageId || !storeId) {
    redirectWith("invalid", storeId);
  }

  const { supabase, workspaceId } = await getWorkspaceDataContext({
    permission: "can_edit_stores",
    redirectTo: messagesPath
  });
  const { error } = await supabase
    .from("store_marketing_messages" as never)
    .update({ status } as never)
    .eq("id" as never, messageId as never)
    .eq("store_id" as never, storeId as never)
    .eq("workspace_id" as never, workspaceId as never);

  if (error) {
    console.error("[marketing-messages] status update failed", {
      code: error.code,
      message: error.message,
      messageId,
      storeId,
      workspaceId
    });
    redirectWith("update-failed", storeId);
  }

  revalidatePath(messagesPath);
  redirectWith("updated", storeId);
}
