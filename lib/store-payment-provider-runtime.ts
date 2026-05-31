import Stripe from "stripe";

export function getStorePaymentsStripeSecretKey() {
  return process.env.STORE_PAYMENTS_STRIPE_SECRET_KEY ?? process.env.STRIPE_CONNECT_SECRET_KEY ?? null;
}

export function missingStorePaymentsStripeEnvNames() {
  return getStorePaymentsStripeSecretKey()
    ? []
    : ["STORE_PAYMENTS_STRIPE_SECRET_KEY", "STRIPE_CONNECT_SECRET_KEY"];
}

export function getStorePaymentsStripe() {
  const secretKey = getStorePaymentsStripeSecretKey();

  if (!secretKey) {
    throw new Error("Missing STORE_PAYMENTS_STRIPE_SECRET_KEY or STRIPE_CONNECT_SECRET_KEY");
  }

  return new Stripe(secretKey, {
    typescript: true
  });
}

export function paypalPartnerOnboardingUrl() {
  return process.env.PAYPAL_PARTNER_ONBOARDING_URL ?? null;
}

type PayPalApiLink = {
  href?: string;
  rel?: string;
};

type PayPalApiError = {
  details?: Array<{ issue?: string; description?: string }>;
  message?: string;
  name?: string;
};

type PayPalMerchantIntegration = {
  merchant_id?: string;
  payments_receivable?: boolean;
  primary_email_confirmed?: boolean;
  products?: Array<{ name?: string; status?: string }>;
};

type PayPalOrderResponse = {
  id?: string;
  links?: PayPalApiLink[];
  status?: string;
};

type PayPalCaptureResponse = PayPalOrderResponse & {
  purchase_units?: Array<{
    custom_id?: string;
    payments?: {
      captures?: Array<{
        id?: string;
        status?: string;
      }>;
    };
    reference_id?: string;
  }>;
};

function paypalEnvironment() {
  return process.env.PAYPAL_ENVIRONMENT === "live" ? "live" : "sandbox";
}

function paypalApiBaseUrl() {
  return paypalEnvironment() === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

export function missingStorePayPalEnvNames() {
  return [
    ["PAYPAL_CLIENT_ID", process.env.PAYPAL_CLIENT_ID],
    ["PAYPAL_CLIENT_SECRET", process.env.PAYPAL_CLIENT_SECRET],
    ["PAYPAL_PARTNER_MERCHANT_ID", process.env.PAYPAL_PARTNER_MERCHANT_ID]
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);
}

function paypalClientId() {
  return process.env.PAYPAL_CLIENT_ID ?? "";
}

function paypalClientSecret() {
  return process.env.PAYPAL_CLIENT_SECRET ?? "";
}

function paypalPartnerMerchantId() {
  return process.env.PAYPAL_PARTNER_MERCHANT_ID ?? "";
}

function paypalErrorMessage(payload: PayPalApiError, fallback: string) {
  return payload.details?.[0]?.description || payload.details?.[0]?.issue || payload.message || payload.name || fallback;
}

async function getPayPalAccessToken() {
  const missingEnv = missingStorePayPalEnvNames();

  if (missingEnv.length) {
    throw new Error(`Missing PayPal store payment env vars: ${missingEnv.join(", ")}`);
  }

  const response = await fetch(`${paypalApiBaseUrl()}/v1/oauth2/token`, {
    body: "grant_type=client_credentials",
    headers: {
      Authorization: `Basic ${Buffer.from(`${paypalClientId()}:${paypalClientSecret()}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    method: "POST"
  });
  const payload = await response.json().catch(() => ({})) as { access_token?: string } & PayPalApiError;

  if (!response.ok || !payload.access_token) {
    throw new Error(paypalErrorMessage(payload, "PayPal access token request failed."));
  }

  return payload.access_token;
}

async function paypalApi<T>(path: string, init: RequestInit = {}) {
  const token = await getPayPalAccessToken();
  const response = await fetch(`${paypalApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    }
  });
  const payload = await response.json().catch(() => ({})) as T & PayPalApiError;

  if (!response.ok) {
    throw new Error(paypalErrorMessage(payload, "PayPal API request failed."));
  }

  return payload as T;
}

function moneyValue(value: number) {
  return Math.max(0, value).toFixed(2);
}

export async function createPayPalPartnerReferral({
  returnUrl,
  trackingId
}: {
  returnUrl: string;
  trackingId: string;
}) {
  const payload = await paypalApi<{ links?: PayPalApiLink[] }>("/v2/customer/partner-referrals", {
    body: JSON.stringify({
      operations: [
        {
          api_integration_preference: {
            rest_api_integration: {
              integration_method: "PAYPAL",
              integration_type: "THIRD_PARTY",
              third_party_details: {
                features: ["PAYMENT", "REFUND"]
              }
            }
          },
          operation: "API_INTEGRATION"
        }
      ],
      partner_config_override: {
        return_url: returnUrl,
        return_url_description: "Return to SHASTORE AI payment settings"
      },
      products: ["EXPRESS_CHECKOUT"],
      tracking_id: trackingId
    }),
    method: "POST"
  });

  return payload.links?.find((link) => link.rel === "action_url")?.href ?? null;
}

export async function getPayPalMerchantIntegration(merchantId: string) {
  return paypalApi<PayPalMerchantIntegration>(
    `/v1/customer/partners/${encodeURIComponent(paypalPartnerMerchantId())}/merchant-integrations/${encodeURIComponent(merchantId)}`
  );
}

export async function createPayPalCheckoutOrder({
  cancelUrl,
  currency,
  merchantId,
  orderId,
  returnUrl,
  total
}: {
  cancelUrl: string;
  currency: string;
  merchantId: string;
  orderId: string;
  returnUrl: string;
  total: number;
}) {
  const payload = await paypalApi<PayPalOrderResponse>("/v2/checkout/orders", {
    body: JSON.stringify({
      intent: "CAPTURE",
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: "SHASTORE AI",
            cancel_url: cancelUrl,
            landing_page: "LOGIN",
            return_url: returnUrl,
            shipping_preference: "NO_SHIPPING",
            user_action: "PAY_NOW"
          }
        }
      },
      purchase_units: [
        {
          amount: {
            currency_code: currency.toUpperCase(),
            value: moneyValue(total)
          },
          custom_id: orderId,
          invoice_id: orderId,
          payee: {
            merchant_id: merchantId
          },
          reference_id: orderId
        }
      ]
    }),
    method: "POST"
  });

  return {
    approvalUrl: payload.links?.find((link) => link.rel === "approve")?.href ?? null,
    id: payload.id ?? null,
    status: payload.status ?? null
  };
}

export async function capturePayPalCheckoutOrder(orderId: string) {
  return paypalApi<PayPalCaptureResponse>(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
    body: "{}",
    method: "POST"
  });
}
