import {
  AdminBadge,
  AdminHeader,
  AdminStatGrid,
  AdminTable,
  formatAdminDate,
  formatAdminMoney
} from "@/components/admin/admin-control";
import { getAdminResellers } from "@/lib/admin/data";
import {
  markResellerPendingReview,
  markResellerVerified,
  restoreReseller,
  suspendReseller
} from "@/lib/admin/reseller-actions";

type AdminResellersPageProps = {
  searchParams: Promise<{
    q?: string;
    status?: string;
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

export default async function AdminResellersPage({ searchParams }: AdminResellersPageProps) {
  const query = await searchParams;
  const resellers = await getAdminResellers();
  const statusFilter = cleanStatusFilter(query.status);
  const searchTerm = String(query.q ?? "").trim().toLowerCase();
  const filteredResellers = resellers.filter((reseller) => {
    const matchesSearch =
      !searchTerm ||
      reseller.email.toLowerCase().includes(searchTerm) ||
      reseller.userId.toLowerCase().includes(searchTerm);
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active"
        ? reseller.status !== "suspended"
        : reseller.status === statusFilter);

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="grid gap-6 lg:gap-8">
      <AdminHeader
        description="Super Admin foundation over existing reseller profiles, reseller accounts, stores, and delivery records. Payouts and reseller billing remain future systems."
        title="Reseller Management"
      />

      <AdminStatGrid
        stats={[
          { label: "Resellers", value: resellers.length },
          { label: "Verified", value: resellers.filter((reseller) => reseller.status === "verified").length },
          { label: "Pending verification", value: resellers.filter((reseller) => reseller.status === "pending_verification").length },
          { label: "Suspended", value: resellers.filter((reseller) => reseller.status === "suspended").length },
          { label: "Stores created", value: resellers.reduce((total, reseller) => total + reseller.storesCreated, 0) },
          { label: "Stores sold", value: resellers.reduce((total, reseller) => total + reseller.storesSold, 0) },
          { label: "Customers referred", value: resellers.reduce((total, reseller) => total + reseller.customersReferred, 0) },
          { label: "Commissions", value: "$0.00", note: "Real reseller payouts are not implemented yet." }
        ]}
      />

      <div className="rounded-3xl border border-slate-200 bg-white p-5">
        <form className="grid gap-4 lg:grid-cols-[1fr_260px_auto] lg:items-end">
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            <span>Search resellers</span>
            <input
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none"
              defaultValue={query.q ?? ""}
              name="q"
              placeholder="Email or user ID"
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
          "Stores created",
          "Stores sold",
          "Customers referred",
          "Commissions",
          "Verification",
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
            <td className="px-5 py-4 text-slate-600">{reseller.storesCreated}</td>
            <td className="px-5 py-4 text-slate-600">{reseller.storesSold}</td>
            <td className="px-5 py-4 text-slate-600">{reseller.customersReferred}</td>
            <td className="px-5 py-4 text-slate-600">{reseller.commissionsPlaceholder}</td>
            <td className="px-5 py-4">
              <AdminBadge tone={statusTone(reseller.verificationStatus)}>{reseller.verificationStatus}</AdminBadge>
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
                    <p>Slug: {reseller.profile.slug ?? "Not created"}</p>
                    <p>Published showcase: {reseller.profile.isPublished ? "Yes" : "No"}</p>
                  </section>
                  <section className="rounded-xl bg-white p-3">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Governance</p>
                    <p className="mt-2">
                      <AdminBadge tone={statusTone(reseller.governanceStatus)}>{reseller.governanceStatus}</AdminBadge>
                    </p>
                    <p className="mt-2">Verification: {reseller.verificationStatus}</p>
                  </section>
                  <section className="rounded-xl bg-white p-3">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Owned stores</p>
                    <div className="mt-2 grid gap-2">
                      {reseller.ownedStores.length ? (
                        reseller.ownedStores.map((store) => (
                          <p className="rounded-lg bg-slate-50 p-2" key={store.id}>
                            <span className="block font-bold text-slate-950">{store.name}</span>
                            {store.status} · {store.slug ?? "no slug"} · {formatAdminDate(store.createdAt)}
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
                    <p>{reseller.commissionSummary.note}</p>
                  </section>
                </div>
              </details>
            </td>
            <td className="px-5 py-4">
              <div className="grid min-w-52 gap-2">
                <form action={markResellerVerified}>
                  <input name="resellerId" type="hidden" value={reseller.userId} />
                  <button
                    className="h-9 w-full rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-black uppercase tracking-[0.16em] text-emerald-700 disabled:opacity-50"
                    disabled={reseller.verificationStatus === "verified" && reseller.governanceStatus === "active"}
                    type="submit"
                  >
                    Mark verified
                  </button>
                </form>
                <form action={markResellerPendingReview}>
                  <input name="resellerId" type="hidden" value={reseller.userId} />
                  <button
                    className="h-9 w-full rounded-full border border-amber-200 bg-amber-50 px-3 text-xs font-black uppercase tracking-[0.16em] text-amber-700 disabled:opacity-50"
                    disabled={reseller.governanceStatus === "pending_review"}
                    type="submit"
                  >
                    Pending review
                  </button>
                </form>
                <form action={suspendReseller}>
                  <input name="resellerId" type="hidden" value={reseller.userId} />
                  <button
                    className="h-9 w-full rounded-full border border-red-200 bg-red-50 px-3 text-xs font-black uppercase tracking-[0.16em] text-red-700 disabled:opacity-50"
                    disabled={reseller.status === "suspended"}
                    type="submit"
                  >
                    Suspend reseller
                  </button>
                </form>
                <form action={restoreReseller}>
                  <input name="resellerId" type="hidden" value={reseller.userId} />
                  <button
                    className="h-9 w-full rounded-full border border-blue-200 bg-blue-50 px-3 text-xs font-black uppercase tracking-[0.16em] text-blue-700 disabled:opacity-50"
                    disabled={reseller.governanceStatus === "active" && reseller.status !== "suspended"}
                    type="submit"
                  >
                    Restore reseller
                  </button>
                </form>
              </div>
            </td>
          </tr>
        ))}
      </AdminTable>
    </div>
  );
}
