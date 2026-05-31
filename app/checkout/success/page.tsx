import Link from "next/link";
import { WhatsAppOrderLauncher } from "@/components/commerce/whatsapp-order-launcher";

export const dynamic = "force-dynamic";

export default async function CheckoutSuccessPage({
  searchParams
}: {
  searchParams: Promise<{
    method?: string;
    order?: string;
    source?: string;
    type?: string;
    whatsapp?: string;
  }>;
}) {
  const params = await searchParams;
  const checkoutHref =
    params.type && params.source ? `/checkout/${params.type}/${params.source}` : "/";
  const isWhatsApp = params.method === "whatsapp" && params.whatsapp;
  const isOnlinePlaceholder = params.method === "paypal" || params.method === "youcan_pay";

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-950 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-2xl rounded-[2rem] border border-slate-200 bg-white p-6 text-center shadow-sm lg:p-8">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-600">
          Order received
        </p>
        <h1 className="mt-4 text-4xl font-black tracking-[-0.06em]">
          Your order was placed
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-500">
          The seller can now review this order in their SHASTORE AI dashboard. Payment
          remains seller-managed for Cash on Delivery and WhatsApp orders.
        </p>
        {params.order ? (
          <div className="mx-auto mt-6 rounded-3xl bg-slate-50 p-4 font-mono text-xs font-bold text-slate-500">
            {params.order}
          </div>
        ) : null}
        {isWhatsApp ? (
          <div className="mt-6 grid gap-3">
            <p className="text-sm font-semibold text-slate-600">
              WhatsApp should open automatically with your prepared order message.
            </p>
            <WhatsAppOrderLauncher url={params.whatsapp ?? ""} />
          </div>
        ) : isOnlinePlaceholder ? (
          <p className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-900">
            Online payment integration foundation selected. No online payment was processed; the seller will confirm payment instructions manually.
          </p>
        ) : (
          <p className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-600">
            Cash on Delivery selected. The seller will confirm delivery and payment details.
          </p>
        )}
        <div className="mt-6">
          <Link
            className="inline-flex h-12 items-center justify-center rounded-full border border-slate-200 px-6 text-sm font-black text-slate-700 transition hover:border-slate-300"
            href={checkoutHref}
          >
            Back to checkout
          </Link>
        </div>
      </section>
    </main>
  );
}
