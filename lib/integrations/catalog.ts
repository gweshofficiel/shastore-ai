export type IntegrationDefinition = {
  category: string;
  key: string;
  name: string;
  requiredEnv: string[];
};

export const integrationDefinitions: IntegrationDefinition[] = [
  {
    category: "AI Providers",
    key: "openai",
    name: "OpenAI",
    requiredEnv: ["OPENAI_API_KEY"]
  },
  {
    category: "Payment Providers",
    key: "stripe",
    name: "Stripe",
    requiredEnv: ["PLATFORM_BILLING_STRIPE_SECRET_KEY", "PLATFORM_BILLING_STRIPE_WEBHOOK_SECRET"]
  },
  {
    category: "Payment Providers",
    key: "nowpayments",
    name: "NOWPayments",
    requiredEnv: ["NOWPAYMENTS_API_KEY", "NOWPAYMENTS_IPN_SECRET"]
  },
  {
    category: "Payment Providers",
    key: "paypal_platform",
    name: "PayPal Platform Billing",
    requiredEnv: ["PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET", "PAYPAL_WEBHOOK_ID"]
  },
  {
    category: "Payment Providers",
    key: "paypal",
    name: "PayPal",
    requiredEnv: ["PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET", "PAYPAL_PARTNER_MERCHANT_ID"]
  },
  {
    category: "Payment Providers",
    key: "youcan_pay",
    name: "YouCan Pay",
    requiredEnv: ["YOUCANPAY_PUBLIC_KEY", "YOUCANPAY_PRIVATE_KEY", "YOUCANPAY_SANDBOX"]
  },
  {
    category: "Email Sending Providers",
    key: "resend",
    name: "Resend",
    requiredEnv: ["RESEND_API_KEY", "EMAIL_FROM"]
  },
  {
    category: "Storage Providers",
    key: "cloudflare_r2",
    name: "Cloudflare R2",
    requiredEnv: [
      "CLOUDFLARE_R2_ACCOUNT_ID",
      "CLOUDFLARE_R2_ACCESS_KEY_ID",
      "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
      "CLOUDFLARE_R2_BUCKET",
      "CLOUDFLARE_R2_PUBLIC_URL"
    ]
  },
  {
    category: "Domain / Email / Hosting Providers",
    key: "domain_service",
    name: "Domain service",
    requiredEnv: ["HTTPAPI_BASE_URL", "HTTPAPI_RESELLER_ID", "HTTPAPI_API_KEY"]
  },
  {
    category: "Domain / Email / Hosting Providers",
    key: "email_service",
    name: "Email service",
    requiredEnv: ["RESEND_API_KEY"]
  },
  {
    category: "Domain / Email / Hosting Providers",
    key: "hosting_service",
    name: "Hosting service",
    requiredEnv: []
  },
  {
    category: "SMS / WhatsApp Providers",
    key: "whatsapp",
    name: "WhatsApp provider",
    requiredEnv: ["WHATSAPP_BUSINESS_API_TOKEN", "WHATSAPP_PHONE_NUMBER_ID"]
  },
  {
    category: "SMS / WhatsApp Providers",
    key: "sms",
    name: "SMS provider",
    requiredEnv: ["SMS_PROVIDER_API_KEY"]
  },
  {
    category: "Analytics Providers",
    key: "analytics",
    name: "Analytics provider",
    requiredEnv: ["NEXT_PUBLIC_GA_ID", "NEXT_PUBLIC_META_PIXEL_ID"]
  },
  {
    category: "Webhooks",
    key: "platform_webhooks",
    name: "Platform webhooks",
    requiredEnv: ["STRIPE_WEBHOOK_SECRET", "PLATFORM_BILLING_STRIPE_WEBHOOK_SECRET", "NOWPAYMENTS_IPN_SECRET"]
  }
];
