import Stripe from "stripe";

export function getStorePaymentsStripeSecretKey() {
  return process.env.STORE_PAYMENTS_STRIPE_SECRET_KEY ?? process.env.STRIPE_CONNECT_SECRET_KEY ?? null;
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
