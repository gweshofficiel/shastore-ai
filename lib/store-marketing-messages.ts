import type { SupabaseClient } from "@supabase/supabase-js";

export type StoreMarketingMessageType =
  | "announcement_bar"
  | "discount_popup"
  | "newsletter_popup"
  | "exit_intent_popup";

export type StoreMarketingMessageStatus = "active" | "disabled" | "draft";

export type StoreMarketingMessageRow = {
  button_link: string | null;
  button_text: string | null;
  ends_at: string | null;
  id: string;
  message: string;
  message_type: StoreMarketingMessageType;
  starts_at: string | null;
  status: StoreMarketingMessageStatus;
  store_id: string;
  title: string;
  workspace_id: string;
};

const messageTypes = new Set<StoreMarketingMessageType>([
  "announcement_bar",
  "discount_popup",
  "newsletter_popup",
  "exit_intent_popup"
]);

const statuses = new Set<StoreMarketingMessageStatus>(["active", "disabled", "draft"]);

export function normalizeMarketingMessageType(value: FormDataEntryValue | string | null | undefined): StoreMarketingMessageType {
  const type = String(value ?? "").trim() as StoreMarketingMessageType;
  return messageTypes.has(type) ? type : "announcement_bar";
}

export function normalizeMarketingMessageStatus(value: FormDataEntryValue | string | null | undefined): StoreMarketingMessageStatus {
  const status = String(value ?? "").trim() as StoreMarketingMessageStatus;
  return statuses.has(status) ? status : "draft";
}

export function marketingMessageTypeLabel(type: StoreMarketingMessageType | string) {
  const labels: Record<string, string> = {
    announcement_bar: "Announcement bar",
    discount_popup: "Discount popup",
    exit_intent_popup: "Exit intent popup",
    newsletter_popup: "Newsletter popup"
  };

  return labels[type] ?? String(type).replaceAll("_", " ");
}

export function activeMarketingWindowFilter(now = new Date()) {
  const iso = now.toISOString();

  return {
    endFilter: `ends_at.is.null,ends_at.gte.${iso}`,
    startFilter: `starts_at.is.null,starts_at.lte.${iso}`
  };
}

export async function loadActiveStoreMarketingMessages({
  storeId,
  supabase,
  workspaceId
}: {
  storeId: string;
  supabase: SupabaseClient;
  workspaceId?: string | null;
}) {
  if (!workspaceId) {
    return [];
  }

  const { endFilter, startFilter } = activeMarketingWindowFilter();
  const { data, error } = await supabase
    .from("store_marketing_messages" as never)
    .select("id, workspace_id, store_id, message_type, title, message, button_text, button_link, status, starts_at, ends_at")
    .eq("workspace_id" as never, workspaceId as never)
    .eq("store_id" as never, storeId as never)
    .eq("status" as never, "active" as never)
    .or(startFilter as never)
    .or(endFilter as never)
    .order("created_at" as never, { ascending: false } as never)
    .limit(20);

  if (error) {
    console.warn("[marketing-messages] active load failed", {
      code: error.code,
      message: error.message,
      storeId,
      workspaceId
    });
    return [];
  }

  return (data ?? []) as unknown as StoreMarketingMessageRow[];
}
