import {
  AdminBadge,
  AdminHeader,
  AdminStatGrid,
  AdminTable,
  formatAdminDate,
  formatAdminMoney
} from "@/components/admin/admin-control";
import Link from "next/link";
import { getAdminResellers } from "@/lib/admin/data";
import {
  clearResellerRisk,
  markResellerHighRisk,
  markResellerReviewed
} from "@/lib/admin/reseller-actions";

type AdminResellersPageProps = {
  searchParams: Promise<{
    q?: string;
    commission?: string;
    plan?: string;
    risk?: string;
    status?: string;
    storeCount?: string;
  }>;
};

function statusTone(status: string) {
  if (status === "active" || status === "verified") {
    return "green" as const;
  }

  if (status === "pending_verification" || status === "pending_review") {
    return "amber" as const;
  }

  return "red" as const;
}

function cleanStatusFilter(value: string | undefined) {
  return value === "active" ||
    value === "suspended" ||
    value === "pending_verification" ||
    value === "verified"
    ? value
    : "all";
}

function cleanFilter(value: string | undefined, allowed: string[]) {
  return value && allowed.includes(value) ? value : "all";
}

function riskTone(status: string) {
  if (status === "high_risk") {
    return "red" as const;
  }

  if (status === "reviewed") {
    return "green" as const;
  }

  return "slate" as const;
}

function commissionTone(status: string) {
  if (status === "paid" || status === "approved") {
    return "green" as const;
  }

  if (status === "pending" || status === "mixed") {
    return "amber" as const;
  }

  return "slate" as const;
}

export default async function AdminResellersPage({ searchParams }: AdminResellersPageProps) {
  const query = await searchParams;
  const resellers = await getAdminResellers();
  const statusFilter = cleanStatusFilter(query.status);
  const planFilter = cleanFilter(query.plan, ["free", "starter", "pro", "agency"]);
  const storeCountFilter = cleanFilter(query.storeCount, ["none", "one", "many"]);
  const commissionFilter = cleanFilter(query.commission, ["not_available", "pending", "approved", "paid", "mixed"]);
  const riskFilter = cleanFilter(query.risk, ["clear", "reviewed", "high_risk"]);
  const searchTerm = String(query.q ?? "").trim().toLowerCase();
  const filteredResellers = resellers.filter((reseller) => {
    const relationHaystack = [
      reseller.email,
      reseller.fullName ?? "",
      reseller.userId,
      reseller.profile.id ?? "",
      reseller.profile.slug ?? "",
      ...reseller.workspaceIds,
      ...reseller.ownedStores.flatMap((store) => [store.id, store.name, store.slug ?? "", store.workspaceId ?? ""]),
      ...reseller.transferredStores.flatMap((store) => [store.id, store.name, store.buyerEmail ?? ""])
    ].join(" ").toLowerCase();
    const matchesSearch =
      !searchTerm ||
      relationHaystack.includes(searchTerm);
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active"
        ? reseller.status !== "suspended"
        : reseller.status === statusFilter);
    const matchesPlan = planFilter === "all" || reseller.planId === planFilter;
    const matchesStoreCount =
      storeCountFilter === "all" ||
      (storeCountFilter === "none"
        ? reseller.storesCreated === 0
        : storeCountFilter === "one"
          ? reseller.storesCreated === 1
          : reseller.storesCreated > 1);
    const matchesCommission = commissionFilter === "all" || reseller.commissionStatus === commissionFilter;
    const matchesRisk = riskFilter === "all" || reseller.riskStatus === riskFilter;

    return matchesSearch && matchesStatus && matchesPlan && matchesStoreCount && matchesCommission && matchesRisk;
  });
  const totalCommissions = resellers.reduce((total, reseller) => total + reseller.commissionSummary.total, 0);

  return (
    <div className="grid gap-6 lg:gap-8">
      <AdminHeader
        description="Super Admin foundation over existing reseller profiles, reseller accounts, stores, and delivery records. Payouts and reseller billing remain future systems."
        title="Reseller Management"
      />

      <AdminStatGrid
        stats={[
          { label: "Resellers", value: resellers.length },
          { label: "Active", value: resellers.filter((reseller) => reseller.status !== "suspended").length },
          { label: "Pending verification", value: resellers.filter((reseller) => reseller.status === "pending_verification").length },
          { label: "Suspended", value: resellers.filter((reseller) => reseller.status === "suspended").length },
          { label: "Stores created", value: resellers.reduce((total, reseller) => total + reseller.storesCreated, 0) },
          { label: "Stores sold", value: resellers.reduce((total, reseller) => total + reseller.storesSold, 0) },
          { label: "Customers referred", value: resellers.reduce((total, reseller) => total + reseller.customersReferred, 0) },
          { label: "Commissions", value: formatAdminMoney(totalCommissions), note: "From available affiliate commission records." }
        ]}
      />

      <div className="rounded-3xl border border-slate-200 bg-white p-5">
        <form className="grid gap-4 lg:grid-cols-[1.3fr_repeat(5,minmax(160px,1fr))_auto] lg:items-end">
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            <span>Search resellers</span>
            <input
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none"
              defaultValue={query.q ?? ""}
              name="q"
              placeholder="Name, email, ID, workspace, store, customer"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            <span>Status</span>
            <select
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none"
              defaultValue={statusFilter}
              name="status"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="pending_verification">Pending verification</option>
              <option value="verified">Verified</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            <span>Plan</span>
            <select
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none"
              defaultValue={planFilter}
              name="plan"
            >
              <option value="all">All</option>
              <option value="free">Free</option>
              <option value="starter">Starter</option>
              <option value="pro">Pro</option>
              <option value="agency">Agency</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            <span>Stores</span>
            <select
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none"
              defaultValue={storeCountFilter}
              name="storeCount"
            >
              <option value="all">All</option>
              <option value="none">No stores</option>
              <option value="one">One store</option>
              <option value="many">Multiple stores</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            <span>Commission</span>
            <select
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none"
              defaultValue={commissionFilter}
              name="commission"
            >
              <option value="all">All</option>
              <option value="not_available">No records</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="paid">Paid</option>
              <option value="mixed">Mixed</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            <span>Risk</span>
            <select
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none"
              defaultValue={riskFilter}
              name="risk"
            >
              <option value="all">All</option>
              <option value="clear">Clear</option>
              <option value="reviewed">Reviewed</option>
              <option value="high_risk">High risk</option>
            </select>
          </label>
          <button className="h-11 rounded-full bg-slate-950 px-5 text-sm font-black text-white" type="submit">
            Filter resellers
          </button>
        </form>
      </div>

      <AdminTable
        empty={!filteredResellers.length ? "No resellers matched the selected search or filters." : null}
        headers={[
          "Reseller",
          "Status",
          "Workspace / Stores",
          "Customers",
          "Subscription",
          "Commissions",
          "Risk",
          "Created",
          "Details",
          "Actions"
        ]}
      >
        {filteredResellers.map((reseller) => (
          <tr key={reseller.userId}>
            <td className="px-5 py-4">
              <div className="grid gap-1">
                <span className="font-bold text-slate-950">{reseller.email}</span>
                <span className="break-all text-slate-500">{reseller.userId}</span>
                <span className="text-slate-500">{reseller.fullName ?? reseller.profile.displayName ?? "No profile name"}</span>
              </div>
            </td>
            <td className="px-5 py-4"><AdminBadge tone={statusTone(reseller.status)}>{reseller.status}</AdminBadge></td>
            <td className="px-5 py-4">
              <div className="grid gap-1 text-slate-600">
                <span>{reseller.workspaceIds.length} workspace links</span>
                <span>{reseller.storesCreated} created · {reseller.storesSold} sold/transferred</span>
              </div>
            </td>
            <td className="px-5 py-4 text-slate-600">{reseller.customersReferred}</td>
            <td className="px-5 py-4">
              <div className="grid gap-1 text-slate-600">
                <span className="font-bold text-slate-950">{reseller.plan}</span>
                <span>{reseller.subscriptionStatus}</span>
              </div>
            </td>
            <td className="px-5 py-4">
              <div className="grid gap-2">
                <span className="font-bold text-slate-950">{reseller.commissionsPlaceholder}</span>
                <AdminBadge tone={commissionTone(reseller.commissionStatus)}>{reseller.commissionStatus}</AdminBadge>
              </div>
            </td>
            <td className="px-5 py-4">
              <div className="grid gap-2">
                <AdminBadge tone={riskTone(reseller.riskStatus)}>{reseller.riskStatus}</AdminBadge>
                {reseller.reviewedAt ? <span className="text-xs text-slate-500">{formatAdminDate(reseller.reviewedAt)}</span> : null}
              </div>
            </td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(reseller.createdAt)}</td>
            <td className="px-5 py-4">
              <details className="min-w-80 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.14em] text-slate-600">
                  Reseller details
                </summary>
                <div className="mt-3 grid gap-4 text-sm text-slate-600">
                  <section className="rounded-xl bg-white p-3">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Profile</p>
                    <p className="mt-2 break-all font-bold text-slate-950">{reseller.email}</p>
                    <p>{reseller.profile.displayName ?? reseller.fullName ?? "No display name"}</p>
                    <p className="break-all text-slate-400">{reseller.userId}</p>
                    <p>Plan: {reseller.plan} ({reseller.subscriptionStatus})</p>
                    <p>Slug: {reseller.profile.slug ?? "Not created"}</p>
                    <p>Published showcase: {reseller.profile.isPublished ? "Yes" : "No"}</p>
                  </section>
                  <section className="rounded-xl bg-white p-3">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Governance</p>
                    <p className="mt-2">
                      <AdminBadge tone={statusTone(reseller.governanceStatus)}>{reseller.governanceStatus}</AdminBadge>
                    </p>
                    <p className="mt-2">Verification: {reseller.verificationStatus}</p>
                    <p className="mt-2">Risk: <AdminBadge tone={riskTone(reseller.riskStatus)}>{reseller.riskStatus}</AdminBadge></p>
                    <p className="mt-2">Reviewed: {formatAdminDate(reseller.reviewedAt)}</p>
                  </section>
                  <section className="rounded-xl bg-white p-3">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Workspace links</p>
                    <div className="mt-2 grid gap-2">
                      {reseller.workspaceIds.length ? (
                        reseller.workspaceIds.map((workspaceId) => (
                          <p className="break-all rounded-lg bg-slate-50 p-2" key={`${reseller.userId}-${workspaceId}`}>
                            {workspaceId}
                          </p>
                        ))
                      ) : (
                        <p>No workspace links found.</p>
                      )}
                    </div>
                  </section>
                  <section className="rounded-xl bg-white p-3">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Owned stores</p>
                    <div className="mt-2 grid gap-2">
                      {reseller.ownedStores.length ? (
                        reseller.ownedStores.map((store) => (
                          <p className="rounded-lg bg-slate-50 p-2" key={store.id}>
                            <span className="block font-bold text-slate-950">{store.name}</span>
                            {store.status} · {store.slug ?? "no slug"} · {formatAdminDate(store.createdAt)}
                            <Link className="mt-1 block text-xs font-black uppercase tracking-[0.14em] text-blue-700" href={`/admin/stores?q=${store.id}`}>
                              Open linked store
                            </Link>
                          </p>
                        ))
                      ) : (
                        <p>No owned stores found.</p>
                      )}
                    </div>
                  </section>
                  <section className="rounded-xl bg-white p-3">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Transferred stores</p>
                    <div className="mt-2 grid gap-2">
                      {reseller.transferredStores.length ? (
                        reseller.transferredStores.map((store) => (
                          <p className="rounded-lg bg-slate-50 p-2" key={`${reseller.userId}-${store.id}`}>
                            <span className="block font-bold text-slate-950">{store.name}</span>
                            {store.status} · {store.buyerEmail ?? "No buyer email"} · {formatAdminDate(store.transferredAt)}
                          </p>
                        ))
                      ) : (
                        <p>No transferred stores found.</p>
                      )}
                    </div>
                  </section>
                  <section className="rounded-xl bg-white p-3">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Commission summary</p>
                    <p className="mt-2 font-bold text-slate-950">{formatAdminMoney(reseller.commissionSummary.total)}</p>
                    <p>Status: <AdminBadge tone={commissionTone(reseller.commissionStatus)}>{reseller.commissionStatus}</AdminBadge></p>
                    <p>{reseller.commissionSummary.note}</p>
                  </section>
                  <section className="rounded-xl bg-white p-3">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Risk signals</p>
                    <div className="mt-2 grid gap-2">
                      {reseller.riskSignals.length ? (
                        reseller.riskSignals.map((signal) => (
                          <p className="rounded-lg bg-slate-50 p-2" key={`${reseller.userId}-${signal.label}-${signal.createdAt ?? "unknown"}`}>
                            <span className="block font-bold text-slate-950">{signal.label}</span>
                            {signal.severity} · {formatAdminDate(signal.createdAt)}
                          </p>
                        ))
                      ) : (
                        <p>No risk or security signals found.</p>
                      )}
                    </div>
                  </section>
                  <section className="rounded-xl bg-white p-3">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Admin links</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Link className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-slate-700" href={`/admin/users/${reseller.userId}`}>
                        Open reseller profile
                      </Link>
                      <Link className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-slate-700" href={`/admin/stores?q=${reseller.userId}`}>
                        Open linked stores
                      </Link>
                    </div>
                  </section>
                </div>
              </details>
            </td>
            <td className="px-5 py-4">
              <div className="grid min-w-52 gap-2">
                <form action={markResellerReviewed}>
                  <input name="resellerId" type="hidden" value={reseller.userId} />
                  <button
                    className="h-9 w-full rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-black uppercase tracking-[0.16em] text-emerald-700 disabled:opacity-50"
                    disabled={reseller.riskStatus === "reviewed"}
                    type="submit"
                  >
                    Mark reviewed
                  </button>
                </form>
                <form action={markResellerHighRisk}>
                  <input name="resellerId" type="hidden" value={reseller.userId} />
                  <button
                    className="h-9 w-full rounded-full border border-amber-200 bg-amber-50 px-3 text-xs font-black uppercase tracking-[0.16em] text-amber-700 disabled:opacity-50"
                    disabled={reseller.riskStatus === "high_risk"}
                    type="submit"
                  >
                    Mark high risk
                  </button>
                </form>
                <form action={clearResellerRisk}>
                  <input name="resellerId" type="hidden" value={reseller.userId} />
                  <button
                    className="h-9 w-full rounded-full border border-blue-200 bg-blue-50 px-3 text-xs font-black uppercase tracking-[0.16em] text-blue-700 disabled:opacity-50"
                    disabled={reseller.riskStatus === "clear"}
                    type="submit"
                  >
                    Clear risk
                  </button>
                </form>
                <button
                  className="h-9 w-full rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-black uppercase tracking-[0.16em] text-slate-400"
                  disabled
                  type="button"
                >
                  Suspend placeholder
                </button>
              </div>
            </td>
          </tr>
        ))}
      </AdminTable>
    </div>
  );
}
