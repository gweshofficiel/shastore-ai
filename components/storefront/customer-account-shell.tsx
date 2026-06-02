import Link from "next/link";
import type { ReactNode } from "react";
import { CartNavLink } from "@/components/storefront/public-store-cart";

type AccountNavItem = {
  href: string;
  key: string;
  label: string;
};

function accountHref(slug: string, path: string, phone: string) {
  const query = phone ? `?phone=${encodeURIComponent(phone)}` : "";
  return `/store/${slug}/account${path}${query}`;
}

export function customerAccountNavItems(slug: string, phone: string): AccountNavItem[] {
  return [
    { href: accountHref(slug, "", phone), key: "overview", label: "Overview" },
    { href: accountHref(slug, "/orders", phone), key: "orders", label: "Orders" },
    { href: accountHref(slug, "/downloads", phone), key: "downloads", label: "Downloads" },
    { href: accountHref(slug, "/licenses", phone), key: "licenses", label: "Licenses" },
    { href: accountHref(slug, "/wishlist", phone), key: "wishlist", label: "Wishlist" },
    { href: accountHref(slug, "/addresses", phone), key: "addresses", label: "Addresses" },
    { href: accountHref(slug, "/referrals", phone), key: "referrals", label: "Referrals" }
  ];
}

export function CustomerAccountShell({
  active,
  children,
  currency,
  description,
  phone,
  slug,
  storeId,
  storeTitle,
  title
}: {
  active: string;
  children: ReactNode;
  currency: string;
  description: string;
  phone: string;
  slug: string;
  storeId: string;
  storeTitle: string;
  title: string;
}) {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-full border border-slate-200 bg-white/90 px-5 py-3 shadow-sm backdrop-blur">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">SHASTORE AI Store</p>
            <p className="mt-1 text-sm font-black text-ink">{storeTitle}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <CartNavLink currency={currency} slug={slug} storeId={storeId} />
            <Link className="rounded-full bg-slate-100 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-muted transition hover:bg-slate-200" href={`/store/${slug}`}>
              Back to store
            </Link>
          </div>
        </header>

        <section className="mb-6 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Customer account</p>
          <h1 className="mt-2 text-4xl font-black tracking-[-0.05em] text-ink">{title}</h1>
          <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-muted">{description}</p>
          <nav className="mt-5 flex flex-wrap gap-2">
            {customerAccountNavItems(slug, phone).map((item) => (
              <Link
                className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.16em] transition ${
                  active === item.key
                    ? "bg-ink text-white"
                    : "bg-slate-100 text-muted hover:bg-slate-200"
                }`}
                href={item.href}
                key={item.key}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </section>

        {children}
      </div>
    </main>
  );
}

export function AccountLookupForm({
  buttonLabel = "View account",
  phone
}: {
  buttonLabel?: string;
  phone: string;
}) {
  return (
    <form className="grid gap-3 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm" method="get">
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
        {buttonLabel}
      </button>
    </form>
  );
}

export function StatusPill({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-muted">
      {label}
    </span>
  );
}

export function EmptyAccountCard({ text, title }: { text: string; title: string }) {
  return (
    <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-8 text-center">
      <h3 className="text-xl font-black tracking-[-0.03em] text-ink">{title}</h3>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted">{text}</p>
    </div>
  );
}
