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
  const isPlanChangeEmail = type === "subscription_plan_changed";

  try {
    const template = getBillingEmailTemplate(type, metadata);

    if (!template) {
      if (isPlanChangeEmail) {
        console.info("[plan-change-email] skipped unsupported template", { type, userId });
      }
      console.info("[email-notification-skipped] unsupported notification type", { type, userId });
      return;
    }

    const provider = configuredProvider();

    if (provider === "disabled") {
      if (isPlanChangeEmail) {
        console.info("[plan-change-email] skipped disabled provider", { type, userId });
      }
      console.info("[email-notification-skipped] email provider disabled", { type, userId });
      return;
    }

    if (provider === "unknown") {
      if (isPlanChangeEmail) {
        console.warn("[plan-change-email] skipped unsupported provider", { type, userId });
      }
      console.warn("[email-notification-skipped] unsupported email provider", { type, userId });
      return;
    }

    if (!providerReady(provider)) {
      if (isPlanChangeEmail) {
        console.warn("[plan-change-email] skipped provider not configured", {
          hasEmailFrom: Boolean(process.env.EMAIL_FROM?.trim()),
          hasResendApiKey: Boolean(process.env.RESEND_API_KEY?.trim()),
          provider,
          type,
          userId
        });
      }
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
      if (isPlanChangeEmail) {
        console.warn("[plan-change-email] skipped missing recipient", { type, userId });
      }
      console.warn("[email-notification-skipped] recipient email unavailable", { type, userId });
      return;
    }

    if (isPlanChangeEmail) {
      console.info("[plan-change-email] sending plan change email", {
        provider,
        type,
        userId
      });
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
      if (isPlanChangeEmail) {
        console.warn("[plan-change-email] send failed", {
          message: result.error,
          provider,
          type,
          userId
        });
      }
      console.warn("[email-notification-error] resend send failed", {
        message: result.error,
        provider,
        type,
        userId
      });
      return;
    }

    if (isPlanChangeEmail) {
      console.info("[plan-change-email] sent", {
        provider,
        resendMessageId: result.id,
        type,
        userId
      });
    }

    console.info("[email-notification-sent] billing email sent", {
      provider,
      resendMessageId: result.id,
      type,
      userId
    });
  } catch (error) {
    if (isPlanChangeEmail) {
      console.warn("[plan-change-email] failed safely", {
        message: error instanceof Error ? error.message : String(error),
        type,
        userId
      });
    }
    console.warn("[email-notification-error] email notification failed safely", {
      message: error instanceof Error ? error.message : String(error),
      type,
      userId
    });
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function sendWorkspaceInviteEmailSafe({
  acceptUrl,
  email,
  role
}: {
  acceptUrl: string;
  email: string;
  role: string;
}) {
  try {
    const provider = configuredProvider();

    if (provider !== "resend" || !providerReady(provider)) {
      console.warn("[team-invite-email] skipped provider unavailable", {
        hasEmailFrom: Boolean(process.env.EMAIL_FROM?.trim()),
        hasResendApiKey: Boolean(process.env.RESEND_API_KEY?.trim()),
        provider
      });
      return;
    }

    console.info("[team-invite-email] sending invite", { email, role });

    const safeUrl = escapeHtml(acceptUrl);
    const safeRole = escapeHtml(role);
    const result = await sendWithResend({
      html: `<p>You are invited to join SHASTORE AI as ${safeRole}.</p><p><a href="${safeUrl}" style="display:inline-block;padding:12px 18px;border-radius:999px;background:#0f172a;color:#ffffff;text-decoration:none;font-weight:700;">Accept invitation</a></p><p>If the button does not work, copy and paste this link:</p><p><a href="${safeUrl}">${safeUrl}</a></p>`,
      subject: "You are invited to join SHASTORE AI",
      text: `You are invited to join SHASTORE AI as ${role}.\n\nAccept invitation: ${acceptUrl}`,
      to: email
    });

    if (result.error) {
      console.warn("[team-invite-email] send failed", {
        email,
        message: result.error
      });
      return;
    }

    console.info("[team-invite-email] sent", {
      email,
      resendMessageId: result.id
    });
  } catch (error) {
    console.warn("[team-invite-email] failed safely", {
      email,
      message: error instanceof Error ? error.message : String(error)
    });
  }
}
