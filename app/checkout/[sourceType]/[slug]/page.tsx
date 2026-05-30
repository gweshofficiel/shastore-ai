import { notFound } from "next/navigation";
import { BuyerCheckoutForm } from "@/components/commerce/buyer-checkout-form";
import { getBuyerCheckoutSource } from "@/lib/commerce/buyer-checkout";
import { getPublicStorefrontPreview } from "@/lib/public-storefront-preview";
import { buttonRadiusClass, fontClass, fontScaleClass } from "@/lib/store-theme";

export const dynamic = "force-dynamic";

const errorMessages: Record<string, string> = {
  "invalid-quantity": "Quantity must be greater than zero.",
  "missing-customer": "Name and phone are required.",
  "order-save-failed": "Order could not be saved. Please try again.",
  "payment-method-disabled": "That payment method is not enabled by this seller.",
  "product-not-found": "Selected product could not be found.",
  "source-not-found": "Checkout source could not be found."
};

export default async function BuyerCheckoutPage({
  params,
  searchParams
}: {
  params: Promise<{ sourceType: string; slug: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ sourceType, slug }, query] = await Promise.all([params, searchParams]);
  const [source, preview] = await Promise.all([
    getBuyerCheckoutSource({ sourceSlug: slug, sourceType }),
    sourceType === "store" ? getPublicStorefrontPreview(slug) : Promise.resolve(null)
  ]);

  if (!source) {
    notFound();
  }

  const hasProducts = source.items.length > 0;
  const hasPaymentMethods = source.paymentMethods.length > 0;
  const theme = preview?.themeSettings;
  const primaryColor = theme?.primaryColor ?? "#0f172a";
  const secondaryColor = theme?.secondaryColor ?? "#334155";

  return (
    <main
      className={`min-h-screen px-4 py-6 text-slate-950 sm:px-6 lg:px-8 ${theme ? `${fontClass(theme.bodyFont)} ${fontScaleClass(theme.fontScale)}` : ""}`}
      style={{ backgroundColor: `${primaryColor}08` }}
    >
      <div className="mx-auto grid max-w-6xl gap-6">
        <section
          className={`overflow-hidden p-6 text-white shadow-2xl lg:p-8 ${theme ? buttonRadiusClass(theme.buttonStyle) : "rounded-[2rem]"}`}
          style={{
            background: `radial-gradient(circle at 18% 10%, ${secondaryColor}66, transparent 34%), linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`
          }}
        >
          <p className="text-xs font-black uppercase tracking-[0.24em] text-white/45">
            Buyer checkout
          </p>
          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <h1 className="text-4xl font-black tracking-[-0.06em] lg:text-5xl">
                Complete your order
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/65">
                Orders are captured for the seller using enabled buyer payment methods only.
                Online payment providers are reserved for future seller-owned integrations.
              </p>
              {preview ? (
                <p className="mt-3 text-xs font-black uppercase tracking-[0.2em] text-white/45">
                  Theme: {preview.themeRuntime.themeKey}
                </p>
              ) : null}
            </div>
            <div className="rounded-3xl bg-white/10 px-4 py-3 text-sm font-bold text-white/80">
              {source.sourceType === "store" ? "Store" : "Landing"} / {source.sourceSlug}
            </div>
          </div>
        </section>

        {query.error ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
            {errorMessages[query.error] ?? "Checkout could not be completed."}
          </div>
        ) : null}

        {!hasProducts ? (
          <div className="rounded-[2rem] border border-amber-200 bg-amber-50 p-6 text-sm font-bold leading-6 text-amber-800">
            This seller has not published checkout products yet.
          </div>
        ) : !hasPaymentMethods ? (
          <div className="rounded-[2rem] border border-amber-200 bg-amber-50 p-6 text-sm font-bold leading-6 text-amber-800">
            This seller has not enabled any buyer payment methods yet.
          </div>
        ) : (
          <BuyerCheckoutForm source={source} />
        )}
      </div>
    </main>
  );
}
