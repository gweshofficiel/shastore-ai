import { Resend } from "resend";
import { getBillingEmailTemplate } from "@/lib/notifications/email-templates";
import { createAdminClient } from "@/lib/supabase/admin";

type EmailProviderName = "disabled" | "resend" | "unknown";

type EmailNotificationMetadata = Record<string, unknown>;

function configuredProvider(): EmailProviderName {
  const provider = process.env.EMAIL_PROVIDER?.trim().toLowerCase();

  if (!provider || provider === "disabled" || provider === "none") {
    return "disabled";
  }

  if (provider === "resend") {
    return "resend";
  }

  return "unknown";
}

function providerReady(provider: EmailProviderName) {
  if (provider === "disabled" || provider === "unknown") {
    return false;
  }

  if (!process.env.EMAIL_FROM?.trim()) {
    return false;
  }

  if (provider === "resend" && !process.env.RESEND_API_KEY?.trim()) {
    return false;
  }

  return true;
}

function emailFromAddress() {
  return process.env.EMAIL_FROM?.trim() ?? "";
}

function resendApiKey() {
  return process.env.RESEND_API_KEY?.trim() ?? "";
}

async function resolveRecipientEmail(userId: string) {
  const client = createAdminClient();

  if (!client) {
    console.warn("[email-notification-skipped] service client unavailable", { userId });
    return null;
  }

  const { data, error } = await client.auth.admin.getUserById(userId);

  if (error) {
    console.warn("[email-notification-error] recipient lookup failed", {
      message: error.message,
      userId
    });
    return null;
  }

  return data.user?.email ?? null;
}

async function sendWithResend({
  html,
  subject,
  text,
  to
}: {
  html: string;
  subject: string;
  text: string;
  to: string;
}) {
  const apiKey = resendApiKey();
  const from = emailFromAddress();

  if (!apiKey || !from) {
    return { error: "Resend environment is not configured", id: null };
  }

  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from,
    html,
    subject,
    text,
    to
  });

  return {
    error: error?.message ?? null,
    id: data?.id ?? null
  };
}

export async function sendBillingNotificationEmailSafe({
  metadata = {},
  type,
  userId
}: {
  metadata?: EmailNotificationMetadata;
  type: string;
  userId: string;
}) {
  try {
    const template = getBillingEmailTemplate(type, metadata);

    if (!template) {
      console.info("[email-notification-skipped] unsupported notification type", { type, userId });
      return;
    }

    const provider = configuredProvider();

    if (provider === "disabled") {
      console.info("[email-notification-skipped] email provider disabled", { type, userId });
      return;
    }

    if (provider === "unknown") {
      console.warn("[email-notification-skipped] unsupported email provider", { type, userId });
      return;
    }

    if (!providerReady(provider)) {
      console.warn("[email-notification-skipped] email provider not configured", {
        hasEmailFrom: Boolean(process.env.EMAIL_FROM?.trim()),
        hasResendApiKey: Boolean(process.env.RESEND_API_KEY?.trim()),
        provider,
        type,
        userId
      });
      return;
    }

    const recipientEmail = await resolveRecipientEmail(userId);

    if (!recipientEmail) {
      console.warn("[email-notification-skipped] recipient email unavailable", { type, userId });
      return;
    }

    console.info("[email-notification] sending billing email", {
      provider,
      type,
      userId
    });

    const result = await sendWithResend({
      html: template.html,
      subject: template.subject,
      text: template.text,
      to: recipientEmail
    });

    if (result.error) {
      console.warn("[email-notification-error] resend send failed", {
        message: result.error,
        provider,
        type,
        userId
      });
      return;
    }

    console.info("[email-notification-sent] billing email sent", {
      provider,
      resendMessageId: result.id,
      type,
      userId
    });
  } catch (error) {
    console.warn("[email-notification-error] email notification failed safely", {
      message: error instanceof Error ? error.message : String(error),
      type,
      userId
    });
  }
}
