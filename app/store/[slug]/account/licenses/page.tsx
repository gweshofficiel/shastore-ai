import type { Metadata } from "next";
import {
  CustomerAccountShell,
  EmptyAccountCard,
  StatusPill
} from "@/components/storefront/customer-account-shell";
import { getAccountRoleForUser } from "@/lib/account-roles";
import { getPublicStorefrontAccess } from "@/lib/billing/publish-access";
import { formatAccountDate, loadAuthenticatedCustomerAccountPortal } from "@/lib/customer-account";
import { getPublicStorefrontPreview } from "@/lib/public-storefront-preview";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type LicensesPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ phone?: string }>;
};

export async function generateMetadata({ params }: LicensesPageProps): Promise<Metadata> {
  const { slug } = await params;
  const preview = await getPublicStorefrontPreview(slug);

  return {
    title: preview ? `Licenses | ${preview.store.title}` : "Licenses not found | SHASTORE AI",
    robots: { follow: false, index: false }
  };
}

export default async function CustomerLicensesPage({ params, searchParams }: LicensesPageProps) {
  const { slug } = await params;
  await searchParams;
  const preview = await getPublicStorefrontPreview(slug);

  if (!preview) {
    return <Unavailable title="This licenses portal is not available." />;
  }

  const admin = createAdminClient();
  const storefrontAccess = admin
    ? await getPublicStorefrontAccess({ storeId: preview.store.id, supabase: admin })
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
  const licensedDownloads = (portal?.downloads ?? []).filter((download) => download.licenseKey);
  const phone = portal?.profile?.phone ?? "";

  return (
    <CustomerAccountShell
      active="licenses"
      currency={preview.store.currency}
      description="View license keys assigned to your paid digital products for this store."
      phone={phone}
      slug={preview.store.slug}
      storeId={preview.store.id}
      storeTitle={preview.store.title}
      title="Licenses"
    >
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Assigned keys</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">
              {isAuthenticatedCustomer ? `${licensedDownloads.length} ${licensedDownloads.length === 1 ? "license" : "licenses"}` : "Login required"}
            </h2>
          </div>
          {!isAuthenticatedCustomer ? (
            <EmptyAccountCard title="Log in to view licenses" text="Phone-only access is not used for secure license keys." />
          ) : licensedDownloads.length ? (
            licensedDownloads.map((download) => (
              <article className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm" key={`${download.orderSource}-${download.orderId}-${download.productId}`}>
                <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                  Order {download.orderNumber}
                </p>
                <h3 className="mt-2 text-xl font-black tracking-[-0.03em] text-ink">{download.productName}</h3>
                <p className="mt-1 text-sm font-bold text-muted">{download.fileName}</p>
                <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">License key</p>
                  <p className="mt-2 break-all font-mono text-sm font-black text-ink">{download.licenseKey}</p>
                  {download.licenseAssignedAt ? (
                    <p className="mt-2 text-xs font-bold text-muted">Assigned {formatAccountDate(download.licenseAssignedAt)}</p>
                  ) : null}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <StatusPill label="Store scoped" />
                  <StatusPill label="Customer verified" />
                </div>
              </article>
            ))
          ) : (
            <EmptyAccountCard title="No licenses found" text="Assigned license keys for paid digital products will appear here." />
          )}
        </div>
        <div className="rounded-[2rem] border border-slate-200 bg-white p-5 text-sm font-bold leading-6 text-muted shadow-sm">
          License keys require an authenticated customer account.
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
