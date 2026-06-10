import Link from "next/link";
import { redirect } from "next/navigation";
import { getAccountRoleForUser } from "@/lib/account-roles";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function CustomerHomePage() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/customer/login");
  }

  const accountRole = await getAccountRoleForUser(supabase, user.id);

  if (accountRole?.role !== "customer" || accountRole.status !== "active") {
    await supabase.auth.signOut();
    redirect("/customer/login?error=role");
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-16 text-ink sm:px-6 lg:px-8">
      <section className="mx-auto max-w-3xl rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Customer Account</p>
        <h1 className="mt-3 text-4xl font-black tracking-[-0.05em]">Welcome back</h1>
        <p className="mt-3 text-sm font-semibold leading-6 text-muted">
          Your customer login is active. Store-specific order portals remain linked from each store account
          page and can still use phone lookup where supported.
        </p>
        <Link className="mt-6 inline-flex font-black text-blue-700 hover:underline" href="/">
          Browse stores
        </Link>
      </section>
    </main>
  );
}
