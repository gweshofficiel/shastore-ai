export type EmailNotificationType =
  | "grace_period_started"
  | "payment_failed"
  | "payment_recovered"
  | "subscription_canceled"
  | "subscription_reactivated";

type EmailTemplate = {
  html: string;
  subject: string;
  text: string;
};

type EmailTemplateMetadata = Record<string, unknown>;

const supportedEmailTypes = new Set<string>([
  "grace_period_started",
  "payment_failed",
  "payment_recovered",
  "subscription_canceled",
  "subscription_reactivated"
]);

function isEmailNotificationType(type: string): type is EmailNotificationType {
  return supportedEmailTypes.has(type);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDate(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(date);
}

function templateContent(type: EmailNotificationType, metadata: EmailTemplateMetadata) {
  const gracePeriodUntil = formatDate(metadata.gracePeriodUntil);

  switch (type) {
    case "payment_failed":
      return {
        subject: "Payment failed for your SHASTORE AI subscription",
        text:
          "Stripe could not collect your latest subscription payment. Update billing to avoid access restrictions."
      };
    case "grace_period_started":
      return {
        subject: "Your SHASTORE AI grace period has started",
        text: gracePeriodUntil
          ? `Your storefronts remain online during grace period. Protected billing actions are paused until payment is recovered. Grace period ends on ${gracePeriodUntil}.`
          : "Your storefronts remain online during grace period. Protected billing actions are paused until payment is recovered."
      };
    case "payment_recovered":
      return {
        subject: "Payment recovered for your SHASTORE AI subscription",
        text: "Your payment succeeded and protected SHASTORE AI billing access has been restored."
      };
    case "subscription_canceled":
      return {
        subject: "Your SHASTORE AI subscription was canceled",
        text:
          "Your subscription has ended. Your data remains safe, but paid access is locked until you reactivate."
      };
    case "subscription_reactivated":
      return {
        subject: "Your SHASTORE AI subscription is active again",
        text: "Your subscription is active again and paid features are available."
      };
  }
}

export function getBillingEmailTemplate(
  type: string,
  metadata: EmailTemplateMetadata = {}
): EmailTemplate | null {
  if (!isEmailNotificationType(type)) {
    return null;
  }

  const content = templateContent(type, metadata);
  const escapedText = escapeHtml(content.text);

  return {
    subject: content.subject,
    text: content.text,
    html: `<p>${escapedText}</p><p>Open your SHASTORE AI dashboard to review billing and account notifications.</p>`
  };
}
