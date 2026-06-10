import Link from "next/link";
import { redirect } from "next/navigation";
import { getAccountRoleForUser } from "@/lib/account-roles";
import { getCustomerProfileForUser } from "@/lib/customer-profiles";
import { formatAccountMoney, normalizeCustomerPhone } from "@/lib/customer-account";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function normalizeEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

export default async function CustomerDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/customer/login?next=/customer/dashboard");
  }

  const accountRole = await getAccountRoleForUser(supabase, user.id);

  if (accountRole?.role !== "customer" || accountRole.status !== "active") {
    await supabase.auth.signOut();
    redirect("/customer/login?error=role");
  }

  const profile = await getCustomerProfileForUser(user.id);

  if (!profile) {
    redirect("/customer/login?error=profile");
  }

  const admin = createAdminClient();
  const normalizedEmail = normalizeEmail(profile.email);
  const normalizedPhone = normalizeCustomerPhone(profile.phone);
  const { data } = admin
    ? await admin
        .from("store_customers" as never)
        .select("id, store_id, name, email, phone, total_orders, total_spent, metadata, stores(name, slug, currency)")
        .or(
          [
            `metadata->>auth_user_id.eq.${user.id}`,
            normalizedEmail ? `normalized_email.eq.${normalizedEmail}` : "",
            normalizedPhone ? `normalized_phone.eq.${normalizedPhone}` : ""
          ].filter(Boolean).join(",")
        )
        .order("updated_at" as never, { ascending: false } as never)
    : { data: [] };
  const storeAccounts = (data ?? []) as unknown as Array<{
    id: string;
    name?: string | null;
    store_id: string;
    stores?: { currency?: string | null; name?: string | null; slug?: string | null } | null;
    total_orders?: number | null;
    total_spent?: number | string | null;
  }>;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-16 text-ink sm:px-6 lg:px-8">
      <section className="mx-auto max-w-5xl rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Customer Account</p>
        <h1 className="mt-3 text-4xl font-black tracking-[-0.05em]">Welcome back</h1>
        <p className="mt-3 text-sm font-semibold leading-6 text-muted">
          Signed in as {profile.email}. Orders are shown only when they match your authenticated email,
          verified phone, or linked customer profile.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <SummaryCard label="Verified phone" value={profile.phone} />
          <SummaryCard label="Store accounts" value={storeAccounts.length.toLocaleString()} />
          <SummaryCard
            label="Known orders"
            value={storeAccounts.reduce((sum, row) => sum + (row.total_orders ?? 0), 0).toLocaleString()}
          />
        </div>
      </section>

      <section className="mx-auto mt-6 max-w-5xl rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Stores</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.03em]">Your store-scoped accounts</h2>
          </div>
          <Link className="rounded-full bg-slate-100 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-muted" href="/">
            Browse stores
          </Link>
        </div>

        <div className="mt-5 grid gap-3">
          {storeAccounts.length ? (
            storeAccounts.map((account) => {
              const store = account.stores;
              const slug = store?.slug;
              return (
                <article className="rounded-[2rem] border border-slate-200 bg-slate-50 p-5" key={account.id}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-black tracking-[-0.03em]">
                        {store?.name ?? account.name ?? "Store account"}
                      </h3>
                      <p className="mt-1 text-sm font-semibold text-muted">
                        {account.total_orders ?? 0} orders · {formatAccountMoney(account.total_spent ?? 0, store?.currency ?? "USD")}
                      </p>
                    </div>
                    {slug ? (
                      <Link className="rounded-full bg-ink px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-white" href={`/store/${slug}/account`}>
                        Open account
                      </Link>
                    ) : null}
                  </div>
                </article>
              );
            })
          ) : (
            <div className="rounded-[2rem] border border-dashed border-slate-300 p-8 text-center">
              <h3 className="text-xl font-black tracking-[-0.03em]">No store accounts linked yet</h3>
              <p className="mt-3 text-sm font-semibold leading-6 text-muted">
                Guest checkout still works. Future orders using this email or phone can be linked to your customer account.
              </p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-2 text-lg font-black text-ink">{value}</p>
    </div>
  );
}
