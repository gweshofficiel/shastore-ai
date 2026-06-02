import type { Metadata } from "next";
import { headers } from "next/headers";
import {
  AccountLookupForm,
  CustomerAccountShell,
  EmptyAccountCard,
  StatusPill
} from "@/components/storefront/customer-account-shell";
import { getPublicStorefrontAccess } from "@/lib/billing/publish-access";
import { formatAccountDate } from "@/lib/customer-account";
import { loadCustomerReferralOverview } from "@/lib/customer-referrals";
import { getPublicStorefrontPreview } from "@/lib/public-storefront-preview";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type ReferralsPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ phone?: string }>;
};

function cleanText(value: string | undefined, maxLength = 120) {
  return (value ?? "").trim().slice(0, maxLength);
}

function baseUrlFromHeaders(headerList: Headers) {
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "";
  const proto = headerList.get("x-forwarded-proto") ?? "http";

  return host ? `${proto}://${host}` : "";
}

export async function generateMetadata({ params }: ReferralsPageProps): Promise<Metadata> {
  const { slug } = await params;
  const preview = await getPublicStorefrontPreview(slug);

  return {
    title: preview ? `Referrals | ${preview.store.title}` : "Referrals not found | SHASTORE AI",
    robots: { follow: false, index: false }
  };
}

export default async function CustomerReferralsPage({ params, searchParams }: ReferralsPageProps) {
  const { slug } = await params;
  const query = await searchParams;
  const phone = cleanText(query.phone, 80);
  const preview = await getPublicStorefrontPreview(slug);

  if (!preview) {
    return <Unavailable title="This referrals portal is not available." />;
  }

  const admin = createAdminClient();
  const storefrontAccess = admin
    ? await getPublicStorefrontAccess({ storeId: preview.store.id, supabase: admin })
    : { allowed: true };

  if (!storefrontAccess.allowed) {
    return <Unavailable title="This storefront is temporarily unavailable." />;
  }

  const referralOverview = phone && admin
    ? await loadCustomerReferralOverview({
        baseUrl: baseUrlFromHeaders(await headers()),
        phone,
        slug: preview.store.slug,
        storeId: preview.store.id,
        supabase: admin,
        workspaceId: preview.store.workspaceId
      })
    : null;
  const referrals = referralOverview?.referrals ?? [];

  return (
    <CustomerAccountShell
      active="referrals"
      currency={preview.store.currency}
      description="Invite friends with your referral link and track referral status for this store."
      phone={phone}
      slug={preview.store.slug}
      storeId={preview.store.id}
      storeTitle={preview.store.title}
      title="Referrals"
    >
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-5">
          {!phone ? (
            <EmptyAccountCard title="Enter your phone number" text="Use the same phone number from checkout to load your referral code." />
          ) : referralOverview?.code ? (
            <>
              <article className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Your referral code</p>
                <h2 className="mt-3 font-mono text-3xl font-black tracking-[-0.03em] text-ink">{referralOverview.code}</h2>
                <p className="mt-4 text-sm font-semibold leading-6 text-muted">
                  Share this link with friends. Rewards are tracked for future rules but are not paid automatically yet.
                </p>
                <div className="mt-4 break-all rounded-2xl bg-slate-50 p-4 font-mono text-sm font-bold text-ink">
                  {referralOverview.referralLink}
                </div>
              </article>

              <article className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Referral activity</p>
                    <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">{referrals.length} tracked</h2>
                  </div>
                </div>
                <div className="mt-5 grid gap-3">
                  {referrals.length ? (
                    referrals.map((referral) => (
                      <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4" key={referral.id}>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-black text-ink">
                              {referral.referred_email || referral.referred_phone || "Referred customer"}
                            </p>
                            <p className="mt-1 text-xs font-semibold text-muted">{formatAccountDate(referral.created_at)}</p>
                          </div>
                          <StatusPill label={referral.status} />
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm font-semibold leading-6 text-muted">
                      Referrals will appear here after someone orders with your referral code.
                    </p>
                  )}
                </div>
              </article>
            </>
          ) : (
            <EmptyAccountCard title="Customer profile not found" text="Place an order or update your account profile before generating referrals." />
          )}
        </div>
        <AccountLookupForm buttonLabel="View referrals" phone={phone} />
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
