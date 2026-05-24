import { getBillingEmailTemplate } from "@/lib/notifications/email-templates";
import { createAdminClient } from "@/lib/supabase/admin";

type EmailProviderName = "disabled" | "resend" | "postmark" | "sendgrid" | "unknown";

type EmailNotificationMetadata = Record<string, unknown>;

function configuredProvider(): EmailProviderName {
  const provider = process.env.EMAIL_PROVIDER?.trim().toLowerCase();

  if (!provider || provider === "disabled" || provider === "none") {
    return "disabled";
  }

  if (provider === "resend" || provider === "postmark" || provider === "sendgrid") {
    return provider;
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

    console.info("[email-notification-skipped] email provider adapter not implemented", {
      provider,
      subject: template.subject,
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
