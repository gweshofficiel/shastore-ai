import { revalidatePath } from "next/cache";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getStoreEmailTemplate,
  type StoreEmailTemplateKey
} from "@/lib/store-email-templates";
import type { Json } from "@/types/database";

type ClaimedEmailLog = {
  attempt_count: number;
  id: string;
  metadata: Record<string, unknown> | null;
  recipient: string;
  retry_count?: number | null;
  store_id: string;
  subject: string;
  template_key: StoreEmailTemplateKey;
  workspace_id: string;
};

type ProcessQueueInput = {
  limit?: number;
  storeId?: string | null;
  workspaceId: string;
};

type ProcessQueueResult = {
  failed: number;
  processed: number;
  sent: number;
  skipped: number;
};

const supportedTemplates = new Set<string>([
  "customer_welcome",
  "order_confirmation",
  "order_status_update",
  "review_reminder",
  "review_request",
  "thank_you"
]);

function configuredForResend() {
  return (
    process.env.EMAIL_PROVIDER?.trim().toLowerCase() === "resend" &&
    Boolean(process.env.RESEND_API_KEY?.trim()) &&
    Boolean(process.env.EMAIL_FROM?.trim())
  );
}

function fromAddress(senderName?: unknown) {
  const emailFrom = process.env.EMAIL_FROM?.trim() ?? "";
  const cleanName = typeof senderName === "string" ? senderName.trim().replace(/"/g, "'") : "";

  return cleanName ? `"${cleanName}" <${emailFrom}>` : emailFrom;
}

function cleanReplyTo(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const email = value.trim().toLowerCase();
  return email.includes("@") ? email : null;
}

function isSupportedTemplate(value: string): value is StoreEmailTemplateKey {
  return supportedTemplates.has(value);
}

function retryDelayMs(nextRetryCount: number) {
  if (nextRetryCount <= 1) {
    return 5_000;
  }

  if (nextRetryCount === 2) {
    return 30_000;
  }

  return 5 * 60_000;
}

function classifyTemporaryError(error: unknown) {
  const detail = error as { message?: string; name?: string; statusCode?: number };
  const message = detail?.message ?? String(error ?? "");
  const statusCode = typeof detail?.statusCode === "number" ? detail.statusCode : null;
  const normalized = message.toLowerCase();

  return (
    statusCode === 429 ||
    statusCode === 408 ||
    (statusCode !== null && statusCode >= 500) ||
    normalized.includes("429") ||
    normalized.includes("rate limit") ||
    normalized.includes("timeout") ||
    normalized.includes("timed out") ||
    normalized.includes("temporar") ||
    normalized.includes("unavailable") ||
    normalized.includes("network")
  );
}

async function markEmailLogFailed(id: string, errorMessage: string) {
  const admin = createAdminClient();

  if (!admin) {
    return;
  }

  await admin
    .from("email_event_logs" as never)
    .update({
      error_message: errorMessage.slice(0, 500),
      last_error: errorMessage.slice(0, 500),
      locked_at: null,
      locked_by: null,
      next_retry_at: null,
      status: "failed",
      updated_at: new Date().toISOString()
    } as never)
    .eq("id" as never, id as never)
    .eq("status" as never, "pending" as never);
}

async function markEmailLogSent(id: string, resendMessageId: string | null) {
  const admin = createAdminClient();

  if (!admin) {
    return;
  }

  await admin
    .from("email_event_logs" as never)
    .update({
      error_message: null,
      last_error: null,
      locked_at: null,
      locked_by: null,
      next_retry_at: null,
      provider: "resend",
      resend_message_id: resendMessageId,
      sent_at: new Date().toISOString(),
      status: "sent",
      updated_at: new Date().toISOString()
    } as never)
    .eq("id" as never, id as never)
    .eq("status" as never, "pending" as never)
    .is("resend_message_id" as never, null);
}

async function scheduleEmailLogRetry(id: string, errorMessage: string, currentRetryCount: number) {
  const admin = createAdminClient();

  if (!admin) {
    return;
  }

  const nextRetryCount = currentRetryCount + 1;

  if (nextRetryCount > 3) {
    await markEmailLogFailed(id, errorMessage);
    return;
  }

  const nextRetryAt = new Date(Date.now() + retryDelayMs(nextRetryCount)).toISOString();

  await admin
    .from("email_event_logs" as never)
    .update({
      error_message: errorMessage.slice(0, 500),
      last_error: errorMessage.slice(0, 500),
      locked_at: null,
      locked_by: null,
      next_retry_at: nextRetryAt,
      retry_count: nextRetryCount,
      status: "retry_pending",
      updated_at: new Date().toISOString()
    } as never)
    .eq("id" as never, id as never)
    .eq("status" as never, "pending" as never);
}

async function sendEmailLog(log: ClaimedEmailLog) {
  if (!isSupportedTemplate(log.template_key)) {
    await markEmailLogFailed(log.id, "Unsupported store email template.");
    return false;
  }

  if (!configuredForResend()) {
    await markEmailLogFailed(log.id, "Resend is not configured.");
    return false;
  }

  const metadata = log.metadata ?? {};
  const template = getStoreEmailTemplate(log.template_key, metadata);
  const resend = new Resend(process.env.RESEND_API_KEY?.trim());
  const replyTo = cleanReplyTo(metadata.replyToEmail);
  const { data, error } = await resend.emails.send({
    from: fromAddress(metadata.senderName),
    html: template.html,
    replyTo: replyTo ?? undefined,
    subject: log.subject || template.subject,
    text: template.text,
    to: log.recipient
  });

  if (error) {
    const message = error.message || "Resend delivery failed.";

    if (classifyTemporaryError(error)) {
      await scheduleEmailLogRetry(log.id, message, log.retry_count ?? 0);
    } else {
      await markEmailLogFailed(log.id, message);
    }

    return false;
  }

  await markEmailLogSent(log.id, data?.id ?? null);
  return true;
}

export async function processPendingStoreEmailQueue({
  limit = 10,
  storeId,
  workspaceId
}: ProcessQueueInput): Promise<ProcessQueueResult> {
  const admin = createAdminClient();
  const result: ProcessQueueResult = {
    failed: 0,
    processed: 0,
    sent: 0,
    skipped: 0
  };

  if (!admin) {
    return result;
  }

  const workerId = `store-email-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const { data, error } = await admin.rpc("claim_pending_email_events" as never, {
    batch_limit: Math.max(1, Math.min(limit, 50)),
    target_store_id: storeId ?? null,
    target_workspace_id: workspaceId,
    worker_id: workerId
  } as never);

  if (error) {
    console.warn("[store-email-delivery] claim failed", {
      code: error.code,
      message: error.message,
      storeId,
      workspaceId
    });
    return result;
  }

  const logs = ((data ?? []) as unknown as ClaimedEmailLog[]).map((log) => ({
    ...log,
    metadata: (log.metadata ?? {}) as Json as Record<string, unknown> | null
  }));

  for (const log of logs) {
    result.processed += 1;

    try {
      const sent = await sendEmailLog(log);

      if (sent) {
        result.sent += 1;
      } else {
        result.failed += 1;
      }
    } catch (error) {
      result.failed += 1;
      await scheduleEmailLogRetry(
        log.id,
        error instanceof Error ? error.message : "Unexpected delivery error.",
        log.retry_count ?? 0
      );
    }
  }

  result.skipped = Math.max(0, limit - result.processed);
  revalidatePath("/dashboard/email");
  return result;
}
