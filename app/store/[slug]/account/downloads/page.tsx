import type { Metadata } from "next";
import {
  CustomerAccountShell,
  EmptyAccountCard,
  StatusPill
} from "@/components/storefront/customer-account-shell";
import { getAccountRoleForUser } from "@/lib/account-roles";
import { getPublicStorefrontAccess } from "@/lib/billing/publish-access";
import { accountStatusLabel, formatAccountDate, loadAuthenticatedCustomerAccountPortal } from "@/lib/customer-account";
import { getPublicStorefrontPreview } from "@/lib/public-storefront-preview";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

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
  const preview = await getPublicStorefrontPreview(slug);

  if (!preview) {
    return <Unavailable title="This downloads portal is not available." />;
  }

  const admin = createAdminClient();
  const storefrontAccess = admin
    ? await getPublicStorefrontAccess({
        storeId: preview.store.id,
        supabase: admin
      })
    : { allowed: true };

  if (!storefrontAccess.allowed) {
    return <Unavailable title="This storefront is temporarily unavailable." />;
  }

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const accountRole = user ? await getAccountRoleForUser(supabase, user.id) : null;
  const isAuthenticatedCustomer = Boolean(user && accountRole?.role === "customer" && accountRole.status === "active");
  const portal = isAuthenticatedCustomer && user
    ? await loadAuthenticatedCustomerAccountPortal({ slug: preview.store.slug, userId: user.id })
    : null;
  const downloads = portal?.downloads ?? [];
  const phone = portal?.profile?.phone ?? "";
  const message = downloadMessage(query.download);

  return (
    <CustomerAccountShell
      active="downloads"
      currency={preview.store.currency}
      description="Access paid digital products from this store. Physical products never appear here."
      phone={phone}
      slug={preview.store.slug}
      storeId={preview.store.id}
      storeTitle={preview.store.title}
      title="Downloads"
    >
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Digital products</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">
              {isAuthenticatedCustomer ? `${downloads.length} ${downloads.length === 1 ? "download" : "downloads"}` : "Login required"}
            </h2>
          </div>
          {message ? (
            <div className="rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-800">
              {message}
            </div>
          ) : null}
          {!isAuthenticatedCustomer ? (
            <EmptyAccountCard title="Log in to view downloads" text="Phone-only access is not used for secure digital downloads." />
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
                      <p className="mt-1 text-sm font-bold text-muted">{formatAccountDate(download.purchasedAt)}</p>
                    </div>
                    <a
                      className="rounded-full bg-ink px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-white transition hover:bg-slate-800"
                      href={href}
                    >
                      Download
                    </a>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <StatusPill label={`Download: ${accountStatusLabel(download.downloadStatus)}`} />
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
            <EmptyAccountCard title="No downloads found" text="No paid digital products matched this phone number for this store." />
          )}
        </div>
        <div className="rounded-[2rem] border border-slate-200 bg-white p-5 text-sm font-bold leading-6 text-muted shadow-sm">
          Digital downloads require an authenticated customer account.
        </div>
      </section>
    </CustomerAccountShell>
  );
}

function Unavailable({ title }: { title: string }) {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-16 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl rounded-[2rem] border border-dashed border-slate-300 bg-white p-10 text-center">
        <h1 className="text-3xl font-black tracking-[-0.04em] text-ink">{title}</h1>
      </div>
    </main>
  );
}
