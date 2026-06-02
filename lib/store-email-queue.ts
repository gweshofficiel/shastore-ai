import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getStoreEmailTemplate,
  type StoreEmailTemplateKey
} from "@/lib/store-email-templates";
import type { Json } from "@/types/database";

type StoreEmailMetadata = Record<string, unknown>;

type StoreEmailInput = {
  metadata?: StoreEmailMetadata;
  recipient?: string | null;
  storeId: string;
  templateKey: StoreEmailTemplateKey;
  workspaceId?: string | null;
};

type StoreEmailSettings = {
  enable_abandoned_cart_recovery?: boolean | null;
  enable_customer_welcome?: boolean | null;
  enable_low_stock_alert?: boolean | null;
  enable_order_confirmation?: boolean | null;
  enable_order_status_update?: boolean | null;
  enable_review_reminder?: boolean | null;
  enable_review_request?: boolean | null;
  enable_thank_you?: boolean | null;
  reply_to_email?: string | null;
  sender_name?: string | null;
};

const settingByTemplate: Partial<Record<StoreEmailTemplateKey, keyof StoreEmailSettings>> = {
  abandoned_cart_recovery: "enable_abandoned_cart_recovery",
  customer_welcome: "enable_customer_welcome",
  low_stock_alert: "enable_low_stock_alert",
  order_confirmation: "enable_order_confirmation",
  order_status_update: "enable_order_status_update",
  review_reminder: "enable_review_reminder",
  review_request: "enable_review_request",
  thank_you: "enable_thank_you"
};

function cleanEmail(value: string | null | undefined) {
  const email = value?.trim().toLowerCase() ?? "";
  return email.includes("@") ? email.slice(0, 180) : "";
}

function sanitizeMetadata(metadata: StoreEmailMetadata = {}) {
  const safe: StoreEmailMetadata = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (/password|secret|token|credential/i.test(key)) {
      continue;
    }

    if (typeof value === "string") {
      safe[key.slice(0, 80)] = value.slice(0, 240);
    } else if (typeof value === "number" || typeof value === "boolean" || value === null) {
      safe[key.slice(0, 80)] = value;
    } else {
      safe[key.slice(0, 80)] = String(value ?? "").slice(0, 120);
    }
  }

  return safe;
}

function enabledForTemplate(settings: StoreEmailSettings | null, templateKey: StoreEmailTemplateKey) {
  const settingKey = settingByTemplate[templateKey];

  if (!settingKey) {
    return true;
  }

  if (!settings) {
    return templateKey !== "customer_welcome";
  }

  const value = settings[settingKey];
  return value !== false;
}

async function emailEventAlreadyQueued({
  metadata,
  recipient,
  storeId,
  templateKey,
  workspaceId
}: {
  metadata: StoreEmailMetadata;
  recipient: string;
  storeId: string;
  templateKey: StoreEmailTemplateKey;
  workspaceId: string;
}) {
  const dedupeId =
    (typeof metadata.orderId === "string" ? metadata.orderId.trim() : "") ||
    (typeof metadata.cartId === "string" ? metadata.cartId.trim() : "");

  if (!dedupeId) {
    return false;
  }

  const dedupeMetadata = metadata.orderId ? { orderId: dedupeId } : { cartId: dedupeId };

  const admin = createAdminClient();

  if (!admin) {
    return false;
  }

  const { data, error } = await admin
    .from("email_event_logs" as never)
    .select("id")
    .eq("workspace_id" as never, workspaceId as never)
    .eq("store_id" as never, storeId as never)
    .eq("recipient" as never, recipient as never)
    .eq("template_key" as never, templateKey as never)
    .contains("metadata" as never, dedupeMetadata as never)
    .limit(1);

  if (error) {
    console.warn("[store-email] duplicate lookup skipped", {
      message: error.message,
      dedupeId,
      storeId,
      templateKey,
      workspaceId
    });
    return false;
  }

  return Boolean((data ?? []).length);
}

export async function queueStoreEmailEventSafe({
  metadata = {},
  recipient,
  storeId,
  templateKey,
  workspaceId
}: StoreEmailInput) {
  try {
    const email = cleanEmail(recipient);

    if (!email) {
      return false;
    }

    const admin = createAdminClient();

    if (!admin) {
      console.warn("[store-email] skipped without service client", { storeId, templateKey });
      return false;
    }

    const { data: storeRow, error: storeError } = await admin
      .from("stores" as never)
      .select("id, name, user_id, owner_user_id, workspace_id")
      .eq("id" as never, storeId as never)
      .maybeSingle();

    if (storeError || !storeRow) {
      console.warn("[store-email] store lookup failed", {
        message: storeError?.message,
        storeId,
        templateKey
      });
      return false;
    }

    const store = storeRow as {
      id: string;
      name?: string | null;
      owner_user_id?: string | null;
      user_id?: string | null;
      workspace_id?: string | null;
    };
    const resolvedWorkspaceId = workspaceId ?? store.workspace_id ?? store.owner_user_id ?? store.user_id ?? null;

    if (!resolvedWorkspaceId) {
      return false;
    }

    const { data: settingsRow } = await admin
      .from("store_email_settings" as never)
      .select("sender_name, reply_to_email, enable_abandoned_cart_recovery, enable_order_confirmation, enable_order_status_update, enable_review_request, enable_review_reminder, enable_low_stock_alert, enable_customer_welcome, enable_thank_you")
      .eq("workspace_id" as never, resolvedWorkspaceId as never)
      .eq("store_id" as never, storeId as never)
      .maybeSingle();
    const settings = (settingsRow as StoreEmailSettings | null) ?? null;

    if (!enabledForTemplate(settings, templateKey)) {
      return false;
    }

    const safeMetadata = sanitizeMetadata({
      ...metadata,
      replyToEmail: settings?.reply_to_email ?? null,
      senderName: settings?.sender_name ?? null,
      storeName: metadata.storeName ?? store.name ?? "Store"
    });

    if (
      await emailEventAlreadyQueued({
        metadata: safeMetadata,
        recipient: email,
        storeId,
        templateKey,
        workspaceId: resolvedWorkspaceId
      })
    ) {
      return false;
    }

    const template = getStoreEmailTemplate(templateKey, safeMetadata);
    const { error } = await admin.from("email_event_logs" as never).insert({
      metadata: safeMetadata as Json,
      recipient: email,
      status: "pending",
      store_id: storeId,
      subject: template.subject,
      template_key: templateKey,
      workspace_id: resolvedWorkspaceId
    } as never);

    if (error) {
      console.warn("[store-email] queue insert failed", {
        code: error.code,
        message: error.message,
        storeId,
        templateKey,
        workspaceId: resolvedWorkspaceId
      });
      return false;
    }

    revalidatePath("/dashboard/email");
    return true;
  } catch (error) {
    console.warn("[store-email] queue failed safely", {
      message: error instanceof Error ? error.message : String(error),
      storeId,
      templateKey
    });
    return false;
  }
}
