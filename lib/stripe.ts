import Stripe from "stripe";
import { getPlatformStripeSecretKey } from "@/lib/billing/platform-checkout";

export function getPlatformBillingStripe() {
  const secretKey = getPlatformStripeSecretKey();

  if (!secretKey) {
    throw new Error("Missing STRIPE_SECRET_KEY or PLATFORM_BILLING_STRIPE_SECRET_KEY");
  }

  return new Stripe(secretKey, {
    typescript: true
  });
}
