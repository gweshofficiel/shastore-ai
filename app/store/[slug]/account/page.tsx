import type { Metadata } from "next";
import Link from "next/link";
import {
  AccountLookupForm,
  CustomerAccountShell,
  EmptyAccountCard,
  StatusPill
} from "@/components/storefront/customer-account-shell";
import { WishlistPageClient } from "@/components/storefront/public-store-wishlist";
import { getPublicStorefrontAccess } from "@/lib/billing/publish-access";
import {
  accountStatusLabel,
  formatAccountDate,
  formatAccountMoney,
  loadCustomerAccountPortal,
  orderReference,
  updateCustomerAccountProfile
} from "@/lib/customer-account";
import { getPublicStorefrontPreview } from "@/lib/public-storefront-preview";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type CustomerAccountPageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams: Promise<{
    phone?: string;
    profile?: string;
  }>;
};

function cleanText(value: string | undefined, maxLength = 120) {
  return (value ?? "").trim().slice(0, maxLength);
}

function profileMessage(status: string | undefined) {
  const messages: Record<string, string> = {
    invalid: "Profile details were incomplete.",
    saved: "Profile updated.",
    "save-failed": "Profile could not be saved. The phone or email may already be used for this store.",
    unavailable: "Profile storage is not configured for this store."
  };

  return status ? messages[status] : null;
}

export async function generateMetadata({
  params
}: CustomerAccountPageProps): Promise<Metadata> {
  const { slug } = await params;
  const preview = await getPublicStorefrontPreview(slug);

  if (!preview) {
    return {
      title: "Account not found | SHASTORE AI",
      robots: { follow: false, index: false }
    };
  }

  return {
    title: `Account | ${preview.store.title}`,
    description: `View orders, downloads, licenses, wishlist, and profile details from ${preview.store.title}.`,
    robots: { follow: false, index: false }
  };
}

export default async function CustomerAccountPage({
  params,
  searchParams
}: CustomerAccountPageProps) {
  const { slug } = await params;
  const query = await searchParams;
  const phone = cleanText(query.phone, 80);
  const preview = await getPublicStorefrontPreview(slug);

  if (!preview) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-16 text-ink sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl rounded-[2rem] border border-dashed border-slate-300 bg-white p-10 text-center">
          <h1 className="text-3xl font-black tracking-[-0.04em] text-ink">This account portal is not available.</h1>
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

  const portal = phone ? await loadCustomerAccountPortal({ phone, slug: preview.store.slug }) : null;
  const orders = portal?.orders ?? [];
  const downloads = portal?.downloads ?? [];
  const profile = portal?.profile;
  const message = profileMessage(query.profile);

  return (
    <CustomerAccountShell
      active="overview"
      currency={preview.store.currency}
      description="View recent orders, digital products, license keys, profile details, wishlist products, and saved addresses for this store."
      phone={phone}
      slug={preview.store.slug}
      storeId={preview.store.id}
      storeTitle={preview.store.title}
      title="Account Overview"
    >
      <section className="mb-6 grid gap-5 lg:grid-cols-[1fr_420px]">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Dashboard</p>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">
            {phone ? "Your customer portal" : "Lookup required"}
          </h2>
          <p className="mt-3 text-sm font-semibold leading-6 text-muted">
            Customer data is loaded only for the phone number used at checkout and only for {preview.store.title}.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-4">
            <SummaryCard label="Orders" value={orders.length} />
            <SummaryCard label="Downloads" value={downloads.length} />
            <SummaryCard label="Licenses" value={portal?.licenseCount ?? 0} />
            <SummaryCard label="Wishlist" value="Device" />
          </div>
        </div>
        <AccountLookupForm phone={phone} />
      </section>

      {message ? (
        <div className="mb-6 rounded-3xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm font-bold text-blue-800">
          {message}
        </div>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="grid gap-6">
          <CardSection eyebrow="Recent orders" title={phone ? `${orders.slice(0, 4).length} shown` : "Lookup required"}>
            {!phone ? (
              <EmptyAccountCard title="Enter your phone number" text="Use the same phone number from checkout to load recent orders." />
            ) : orders.length ? (
              <div className="grid gap-3">
                {orders.slice(0, 4).map((order) => (
                  <article className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm" key={`${order.source}-${order.id}`}>
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                          Order {orderReference(order.id)}
                        </p>
                        <h3 className="mt-2 text-xl font-black tracking-[-0.03em] text-ink">
                          {formatAccountMoney(order.total, order.currency)}
                        </h3>
                        <p className="mt-1 text-sm font-bold text-muted">
                          {formatAccountDate(order.createdAt)} · {order.itemCount || 1} item{(order.itemCount || 1) === 1 ? "" : "s"}
                        </p>
                      </div>
                      <Link
                        className="rounded-full bg-slate-100 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-muted transition hover:bg-slate-200"
                        href={`/store/${preview.store.slug}/track?reference=${encodeURIComponent(orderReference(order.id))}&phone=${encodeURIComponent(phone)}`}
                      >
                        Details
                      </Link>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <StatusPill label={`Order: ${accountStatusLabel(order.orderStatus)}`} />
                      <StatusPill label={`Payment: ${accountStatusLabel(order.paymentStatus)}`} />
                    </div>
                  </article>
                ))}
                <div>
                  <Link className="inline-flex rounded-full bg-ink px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-white" href={`/store/${preview.store.slug}/account/orders?phone=${encodeURIComponent(phone)}`}>
                    View all orders
                  </Link>
                </div>
              </div>
            ) : (
              <EmptyAccountCard title="No orders found" text="No recent orders matched this phone number for this store." />
            )}
          </CardSection>

          <CardSection eyebrow="Digital access" title="Downloads and licenses">
            {!phone ? (
              <EmptyAccountCard title="Enter your phone number" text="Use the lookup above to load digital products and assigned license keys." />
            ) : downloads.length ? (
              <div className="grid gap-3">
                {downloads.slice(0, 3).map((download) => (
                  <article className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm" key={`${download.orderSource}-${download.orderId}-${download.productId}`}>
                    <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                      Order {download.orderNumber}
                    </p>
                    <h3 className="mt-2 text-lg font-black tracking-[-0.03em] text-ink">{download.productName}</h3>
                    <p className="mt-1 text-sm font-bold text-muted">{download.fileName}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <StatusPill label={`Download: ${accountStatusLabel(download.downloadStatus)}`} />
                      {download.licenseKey ? <StatusPill label="License assigned" /> : null}
                    </div>
                  </article>
                ))}
                <div className="flex flex-wrap gap-2">
                  <Link className="inline-flex rounded-full bg-ink px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-white" href={`/store/${preview.store.slug}/account/downloads?phone=${encodeURIComponent(phone)}`}>
                    Downloads
                  </Link>
                  <Link className="inline-flex rounded-full bg-slate-100 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-muted" href={`/store/${preview.store.slug}/account/licenses?phone=${encodeURIComponent(phone)}`}>
                    Licenses
                  </Link>
                </div>
              </div>
            ) : (
              <EmptyAccountCard title="No digital products found" text="Paid digital downloads and license keys will appear here." />
            )}
          </CardSection>
        </div>

        <aside className="grid h-fit gap-6">
          <CardSection eyebrow="Profile" title="Account info">
            {phone ? (
              <form action={updateCustomerAccountProfile} className="grid gap-3 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
                <input name="slug" type="hidden" value={preview.store.slug} />
                <input name="currentPhone" type="hidden" value={phone} />
                <ProfileInput defaultValue={profile?.name ?? ""} label="Name" name="name" placeholder="Your name" required />
                <ProfileInput defaultValue={profile?.phone ?? phone} label="Phone" name="phone" placeholder="+15551234567" required />
                <ProfileInput defaultValue={profile?.email ?? ""} label="Email display" name="email" placeholder="you@example.com" type="email" />
                <label className="grid gap-2 text-sm font-semibold text-ink">
                  <span>Preferred contact</span>
                  <select className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink outline-none" defaultValue={profile?.preferredContact ?? "phone"} name="preferredContact">
                    <option value="phone">Phone</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="email">Email</option>
                  </select>
                </label>
                <div className="grid gap-2 rounded-2xl bg-slate-50 p-3 text-sm font-semibold text-muted">
                  <p>Total orders: {profile?.totalOrders ?? orders.length}</p>
                  <p>Total spent: {formatAccountMoney(profile?.totalSpent ?? 0, preview.store.currency)}</p>
                  <p>Loyalty: {profile?.loyaltyTier ?? "Not assigned"}</p>
                </div>
                <button className="h-11 rounded-full bg-ink px-5 text-sm font-black text-white transition hover:bg-slate-800" type="submit">
                  Save profile
                </button>
              </form>
            ) : (
              <EmptyAccountCard title="Lookup required" text="Enter your checkout phone number to edit account profile details." />
            )}
          </CardSection>

          <CardSection eyebrow="Wishlist" title="Saved products">
            <WishlistPageClient
              currency={preview.store.currency}
              products={preview.products}
              slug={preview.store.slug}
              storeId={preview.store.id}
            />
          </CardSection>

          <CardSection eyebrow="Addresses" title="Delivery addresses">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold leading-6 text-muted">
                Manage saved delivery addresses from the dedicated Addresses tab.
              </p>
              <Link className="mt-4 inline-flex rounded-full bg-slate-100 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-muted" href={`/store/${preview.store.slug}/account/addresses${phone ? `?phone=${encodeURIComponent(phone)}` : ""}`}>
                Open addresses
              </Link>
            </div>
          </CardSection>
        </aside>
      </section>
    </CustomerAccountShell>
  );
}

function SummaryCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-black text-ink">{value}</p>
    </div>
  );
}

function CardSection({
  children,
  eyebrow,
  title
}: {
  children: React.ReactNode;
  eyebrow: string;
  title: string;
}) {
  return (
    <section className="grid gap-4">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">{eyebrow}</p>
        <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function ProfileInput({
  defaultValue,
  label,
  name,
  placeholder,
  required,
  type = "text"
}: {
  defaultValue: string;
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-ink">
      <span>{label}</span>
      <input
        className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
        defaultValue={defaultValue}
        maxLength={180}
        name={name}
        placeholder={placeholder}
        required={required}
        type={type}
      />
    </label>
  );
}
