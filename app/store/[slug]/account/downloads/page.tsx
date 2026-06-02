import type { Metadata } from "next";
import Link from "next/link";
import { CartNavLink } from "@/components/storefront/public-store-cart";
import { getPublicStorefrontAccess } from "@/lib/billing/publish-access";
import { loadCustomerDownloads } from "@/lib/customer-downloads";
import { getPublicStorefrontPreview } from "@/lib/public-storefront-preview";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type DownloadsPageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams: Promise<{
    download?: string;
    phone?: string;
  }>;
};

function cleanText(value: string | undefined, maxLength = 120) {
  return (value ?? "").trim().slice(0, maxLength);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

function statusLabel(status: string | null | undefined) {
  const normalized = status?.trim() || "pending";
  const labels: Record<string, string> = {
    delivered: "Delivered",
    none: "Not available",
    pending: "Pending",
    ready: "Ready"
  };

  return labels[normalized] ?? normalized.replaceAll("_", " ");
}

function downloadMessage(status: string | undefined) {
  const messages: Record<string, string> = {
    denied: "This download is not available for this customer/order.",
    missing: "Download details were incomplete.",
    unavailable: "Secure download signing is not configured for this file yet."
  };

  return status ? messages[status] : null;
}

export async function generateMetadata({
  params
}: DownloadsPageProps): Promise<Metadata> {
  const { slug } = await params;
  const preview = await getPublicStorefrontPreview(slug);

  if (!preview) {
    return {
      title: "Downloads not found | SHASTORE AI",
      robots: { follow: false, index: false }
    };
  }

  return {
    title: `Downloads | ${preview.store.title}`,
    description: `Access purchased digital downloads from ${preview.store.title}.`,
    robots: { follow: false, index: false }
  };
}

export default async function CustomerDownloadsPage({
  params,
  searchParams
}: DownloadsPageProps) {
  const { slug } = await params;
  const query = await searchParams;
  const phone = cleanText(query.phone, 80);
  const preview = await getPublicStorefrontPreview(slug);

  if (!preview) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-16 text-ink sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl rounded-[2rem] border border-dashed border-slate-300 bg-white p-10 text-center">
          <h1 className="text-3xl font-black tracking-[-0.04em] text-ink">This downloads portal is not available.</h1>
        </div>
      </main>
    );
  }

  const admin = createAdminClient();
  const storefrontAccess = admin
    ? await getPublicStorefrontAccess({
        storeId: preview.store.id,
        supabase: admin
      })
    : { allowed: true };

  if (!storefrontAccess.allowed) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-16 text-ink sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl rounded-[2rem] border border-slate-200 bg-white p-8 text-center">
          <h1 className="text-4xl font-black tracking-[-0.05em]">This storefront is temporarily unavailable.</h1>
        </div>
      </main>
    );
  }

  const downloads = phone ? await loadCustomerDownloads({ phone, slug: preview.store.slug }) : [];
  const message = downloadMessage(query.download);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-full border border-slate-200 bg-white/90 px-5 py-3 shadow-sm backdrop-blur">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">SHASTORE AI Store</p>
            <p className="mt-1 text-sm font-black text-ink">{preview.store.title}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <CartNavLink currency={preview.store.currency} slug={preview.store.slug} storeId={preview.store.id} />
            <Link className="rounded-full bg-slate-100 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-muted transition hover:bg-slate-200" href={`/store/${preview.store.slug}/account${phone ? `?phone=${encodeURIComponent(phone)}` : ""}`}>
              Account
            </Link>
            <Link className="rounded-full bg-slate-100 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-muted transition hover:bg-slate-200" href={`/store/${preview.store.slug}`}>
              Back to store
            </Link>
          </div>
        </header>

        <section className="mb-6 grid gap-5 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm lg:grid-cols-[1fr_420px]">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Customer account</p>
            <h1 className="mt-2 text-4xl font-black tracking-[-0.05em] text-ink">Downloads</h1>
            <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-muted">
              Enter the phone number used at checkout to access paid digital products from this store. Physical products never appear here.
            </p>
          </div>
          <form className="grid gap-3" method="get">
            <label className="grid gap-2 text-sm font-semibold text-ink">
              <span>Checkout phone number</span>
              <input
                className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                defaultValue={phone}
                name="phone"
                placeholder="+15551234567"
                required
              />
            </label>
            <button className="h-11 rounded-full bg-ink px-5 text-sm font-black text-white transition hover:bg-slate-800" type="submit">
              View downloads
            </button>
          </form>
        </section>

        {message ? (
          <div className="mb-6 rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-800">
            {message}
          </div>
        ) : null}

        <section className="grid gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Digital products / Licenses</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">
              {phone ? `${downloads.length} ${downloads.length === 1 ? "download" : "downloads"}` : "Lookup required"}
            </h2>
          </div>
          {!phone ? (
            <EmptyCard title="Enter your phone number" text="Use the same phone number from checkout to load purchased digital downloads." />
          ) : downloads.length ? (
            downloads.map((download) => {
              const href = `/api/store-downloads?${new URLSearchParams({
                orderId: download.orderId,
                phone,
                productId: download.productId,
                slug: preview.store.slug,
                source: download.orderSource
              }).toString()}`;

              return (
                <article className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm" key={`${download.orderSource}-${download.orderId}-${download.productId}`}>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                        Order {download.orderNumber}
                      </p>
                      <h3 className="mt-2 text-xl font-black tracking-[-0.03em] text-ink">
                        {download.productName}
                      </h3>
                      <p className="mt-1 text-sm font-bold text-muted">{download.fileName}</p>
                      <p className="mt-1 text-sm font-bold text-muted">{formatDate(download.purchasedAt)}</p>
                    </div>
                    <a
                      className="rounded-full bg-ink px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-white transition hover:bg-slate-800"
                      href={href}
                    >
                      Download
                    </a>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <StatusPill label={`Download: ${statusLabel(download.downloadStatus)}`} />
                    {download.licenseKey ? <StatusPill label="License assigned" /> : null}
                    <StatusPill label="Secure link" />
                  </div>
                  {download.licenseKey ? (
                    <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">License key</p>
                      <p className="mt-2 break-all font-mono text-sm font-black text-ink">{download.licenseKey}</p>
                    </div>
                  ) : null}
                </article>
              );
            })
          ) : (
            <EmptyCard title="No downloads found" text="No paid digital products matched this phone number for this store." />
          )}
        </section>
      </div>
    </main>
  );
}

function StatusPill({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-muted">
      {label}
    </span>
  );
}

function EmptyCard({ text, title }: { text: string; title: string }) {
  return (
    <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-8 text-center">
      <h3 className="text-xl font-black tracking-[-0.03em] text-ink">{title}</h3>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted">{text}</p>
    </div>
  );
}
