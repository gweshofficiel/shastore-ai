import Stripe from "stripe";

export function getPlatformBillingStripe() {
  if (!process.env.PLATFORM_BILLING_STRIPE_SECRET_KEY) {
    throw new Error("Missing PLATFORM_BILLING_STRIPE_SECRET_KEY");
  }

  return new Stripe(process.env.PLATFORM_BILLING_STRIPE_SECRET_KEY, {
    typescript: true
  });
}
