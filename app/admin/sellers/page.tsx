import Link from "next/link";
import {
  AdminBadge,
  AdminHeader,
  AdminStatGrid,
  AdminTable,
  formatAdminDate,
  formatAdminMoney
} from "@/components/admin/admin-control";
import { getAdminSellers } from "@/lib/admin/data";
import {
  clearSellerRisk,
  markSellerHighRisk,
  markSellerReviewed,
  markSellerUnderReview
} from "@/lib/admin/seller-actions";

type AdminSellersPageProps = {
  searchParams: Promise<{
    plan?: string;
    q?: string;
    risk?: string;
    role?: string;
    storeRelation?: string;
    status?: string;
  }>;
};

function statusTone(status: string) {
  if (status === "active") {
    return "green" as const;
  }

  if (status === "under_review" || status === "pending") {
    return "amber" as const;
  }

  return "red" as const;
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

function cleanStatusFilter(value: string | undefined) {
  return value === "active" || value === "pending" || value === "suspended" || value === "under_review" ? value : "all";
}

function cleanFilter(value: string | undefined, allowed: string[]) {
  return allowed.includes(value ?? "") ? value ?? "" : "all";
}

export default async function AdminSellersPage({ searchParams }: AdminSellersPageProps) {
  const query = await searchParams;
  const sellers = await getAdminSellers();
  const statusFilter = cleanStatusFilter(query.status);
  const planFilter = String(query.plan ?? "").trim().toLowerCase();
  const searchTerm = String(query.q ?? "").trim().toLowerCase();
  const roleFilter = cleanFilter(query.role, ["all", "owner", "unknown"]);
  const storeRelationFilter = cleanFilter(query.storeRelation, ["all", "with_stores", "with_products", "with_orders", "no_stores"]);
  const riskFilter = cleanFilter(query.risk, ["all", "clear", "reviewed", "high_risk"]);
  const filteredSellers = sellers.filter((seller) => {
    const matchesStatus =
      statusFilter === "all" ||
      seller.status === statusFilter ||
      seller.accountStatus === statusFilter;
    const matchesPlan = !planFilter || seller.plan.toLowerCase() === planFilter || seller.planId.toLowerCase() === planFilter;
    const matchesRole = roleFilter === "all" || seller.roleType === roleFilter;
    const matchesStoreRelation =
      storeRelationFilter === "all" ||
      (storeRelationFilter === "with_stores" && seller.storesOwned > 0) ||
      (storeRelationFilter === "with_products" && seller.productsCount > 0) ||
      (storeRelationFilter === "with_orders" && seller.ordersCount > 0) ||
      (storeRelationFilter === "no_stores" && seller.storesOwned === 0);
    const matchesRisk = riskFilter === "all" || seller.riskStatus === riskFilter;
    const matchesSearch =
      !searchTerm ||
      (seller.fullName ?? "").toLowerCase().includes(searchTerm) ||
      seller.email.toLowerCase().includes(searchTerm) ||
      seller.userId.toLowerCase().includes(searchTerm) ||
      seller.stores.some((store) => store.name.toLowerCase().includes(searchTerm));

    return matchesStatus && matchesPlan && matchesRole && matchesStoreRelation && matchesRisk && matchesSearch;
  });
  const planOptions = [...new Set(sellers.map((seller) => seller.plan))].sort();
  const activeSellers = sellers.filter((seller) => seller.status === "active").length;
  const pendingSellers = sellers.filter((seller) => seller.status === "under_review" || seller.accountStatus === "pending").length;
  const suspendedSellers = sellers.filter((seller) => seller.status === "suspended" || seller.accountStatus === "disabled").length;
  const sellersWithStores = sellers.filter((seller) => seller.storesOwned > 0).length;
  const sellersWithProducts = sellers.filter((seller) => seller.productsCount > 0).length;
  const sellersWithOrders = sellers.filter((seller) => seller.ordersCount > 0).length;

  return (
    <div className="grid gap-6 lg:gap-8">
      <AdminHeader
        description="Global Super Admin control layer over existing store-owner accounts, stores, orders, products, customers, and plans."
        title="Seller Management"
      />

      <AdminStatGrid
        stats={[
          { label: "Total sellers", value: sellers.length },
          { label: "Active sellers", value: activeSellers },
          { label: "Pending sellers", value: pendingSellers },
          { label: "Suspended/disabled", value: suspendedSellers },
          { label: "With stores", value: sellersWithStores },
          { label: "With products", value: sellersWithProducts },
          { label: "With orders", value: sellersWithOrders },
          { label: "Filtered", value: filteredSellers.length }
        ]}
      />

      <div className="rounded-3xl border border-slate-200 bg-white p-5">
        <form className="grid gap-4 lg:grid-cols-4 xl:grid-cols-[1.4fr_1fr_1fr_1fr_1fr_1fr_auto] lg:items-end">
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            <span>Search sellers</span>
            <input
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none"
              defaultValue={query.q ?? ""}
              name="q"
              placeholder="Name, email, user ID, or store"
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
              <option value="pending">Pending</option>
              <option value="suspended">Suspended</option>
              <option value="under_review">Under review</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            <span>Plan</span>
            <select
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none"
              defaultValue={query.plan ?? ""}
              name="plan"
            >
              <option value="">All plans</option>
              {planOptions.map((plan) => (
                <option key={plan} value={plan}>
                  {plan}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            <span>Role/type</span>
            <select
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none"
              defaultValue={roleFilter}
              name="role"
            >
              <option value="all">All roles</option>
              <option value="owner">Owner</option>
              <option value="unknown">Unknown</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            <span>Store relation</span>
            <select
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none"
              defaultValue={storeRelationFilter}
              name="storeRelation"
            >
              <option value="all">All relations</option>
              <option value="with_stores">With stores</option>
              <option value="with_products">With products</option>
              <option value="with_orders">With orders</option>
              <option value="no_stores">No stores</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            <span>Risk</span>
            <select
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none"
              defaultValue={riskFilter}
              name="risk"
            >
              <option value="all">All risk</option>
              <option value="clear">Clear</option>
              <option value="reviewed">Reviewed</option>
              <option value="high_risk">High risk</option>
            </select>
          </label>
          <button className="h-11 rounded-full bg-slate-950 px-5 text-sm font-black text-white" type="submit">
            Filter sellers
          </button>
        </form>
      </div>

      <AdminTable
        empty={!filteredSellers.length ? "No sellers matched the selected search or filters." : null}
        headers={[
          "Seller",
          "Role",
          "Store/workspace",
          "Metrics",
          "Subscription",
          "Status",
          "Risk",
          "Snapshot",
          "Actions"
        ]}
      >
        {filteredSellers.map((seller) => (
          <tr key={seller.userId}>
            <td className="px-5 py-4">
              <div className="grid gap-1">
                <span className="font-bold text-slate-950">{seller.email}</span>
                <span className="break-all text-slate-500">{seller.userId}</span>
                <span className="text-slate-500">{seller.fullName ?? "No full name"}</span>
                <span className="text-slate-500">Created: {formatAdminDate(seller.createdAt)}</span>
              </div>
            </td>
            <td className="px-5 py-4">
              <div className="grid gap-2">
                <AdminBadge tone="blue">{seller.roleType}</AdminBadge>
                <AdminBadge tone={statusTone(seller.accountStatus)}>{seller.accountStatus}</AdminBadge>
              </div>
            </td>
            <td className="px-5 py-4 text-slate-600">
              <div className="grid gap-1">
                <span>Stores: {seller.storesOwned}</span>
                <span>Published: {seller.publishedStores}</span>
                <span>Workspaces: {seller.workspaceIds.length}</span>
                {seller.stores[0] ? (
                  <Link
                    className="font-bold text-blue-700 underline"
                    href={`/dashboard/stores/${encodeURIComponent(seller.stores[0].id)}`}
                  >
                    Open linked store
                  </Link>
                ) : null}
              </div>
            </td>
            <td className="px-5 py-4 text-slate-600">
              <div className="grid gap-1">
                <span>Products: {seller.productsCount}</span>
                <span>Orders: {seller.ordersCount}</span>
                <span>Customers: {seller.customersCount}</span>
                <span>Revenue: {formatAdminMoney(seller.revenue)}</span>
              </div>
            </td>
            <td className="px-5 py-4">
              <div className="grid gap-2">
                <AdminBadge tone="blue">{seller.plan}</AdminBadge>
                <AdminBadge tone={seller.subscription.status === "active" || seller.subscription.status === "trialing" ? "green" : "slate"}>
                  {seller.subscription.status}
                </AdminBadge>
                <span className="text-xs font-semibold text-slate-500">{seller.planId}</span>
              </div>
            </td>
            <td className="px-5 py-4">
              <div className="grid gap-2">
                <AdminBadge tone={statusTone(seller.status)}>{seller.status}</AdminBadge>
                <AdminBadge tone={statusTone(seller.governanceStatus)}>{seller.governanceStatus}</AdminBadge>
              </div>
            </td>
            <td className="px-5 py-4">
              <div className="grid gap-2">
                <AdminBadge tone={riskTone(seller.riskStatus)}>{seller.riskStatus}</AdminBadge>
                {seller.reviewedAt ? <span className="text-xs text-slate-500">Reviewed: {formatAdminDate(seller.reviewedAt)}</span> : null}
                {seller.riskSignals.length ? (
                  <details className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.14em] text-slate-600">
                      Signals
                    </summary>
                    <div className="mt-2 grid gap-2">
                      {seller.riskSignals.map((signal, index) => (
                        <p className="text-xs text-slate-600" key={`${seller.userId}-risk-${index}`}>
                          <AdminBadge tone={signal.severity === "high" ? "red" : signal.severity === "medium" ? "amber" : "slate"}>
                            {signal.severity}
                          </AdminBadge>{" "}
                          {signal.label}
                        </p>
                      ))}
                    </div>
                  </details>
                ) : (
                  <span className="text-xs text-slate-500">No risk signals</span>
                )}
              </div>
            </td>
            <td className="px-5 py-4">
              <details className="min-w-80 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.14em] text-slate-600">
                  Seller details
                </summary>
                <div className="mt-3 grid gap-4 text-sm text-slate-600">
                  <section className="rounded-xl bg-white p-3">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Profile</p>
                    <p className="mt-2 break-all font-bold text-slate-950">{seller.email}</p>
                    <p>{seller.fullName ?? "No full name"}</p>
                    <p className="break-all text-slate-400">{seller.userId}</p>
                    <p>Role: {seller.roleType}</p>
                    <p>Account status: {seller.accountStatus}</p>
                  </section>
                  <section className="rounded-xl bg-white p-3">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Subscription</p>
                    <p className="mt-2 font-bold text-slate-950">{seller.subscription.planName}</p>
                    <p>Status: {seller.subscription.status}</p>
                    <p>Plan ID: {seller.subscription.planId}</p>
                  </section>
                  <section className="rounded-xl bg-white p-3">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Governance</p>
                    <p className="mt-2">
                      <AdminBadge tone={statusTone(seller.governanceStatus)}>{seller.governanceStatus}</AdminBadge>
                    </p>
                    <p className="mt-2">Risk: {seller.riskStatus}</p>
                    <p className="mt-2">State is stored on existing subscription metadata and owned store governance metadata.</p>
                  </section>
                  <section className="rounded-xl bg-white p-3">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Workspaces</p>
                    <div className="mt-2 grid gap-2">
                      {seller.workspaceIds.length ? (
                        seller.workspaceIds.map((workspaceId) => (
                          <p className="break-all rounded-lg bg-slate-50 p-2" key={`${seller.userId}-${workspaceId}`}>
                            {workspaceId}
                          </p>
                        ))
                      ) : (
                        <p>No workspace relation found.</p>
                      )}
                    </div>
                  </section>
                  <section className="rounded-xl bg-white p-3">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Stores</p>
                    <div className="mt-2 grid gap-2">
                      {seller.stores.length ? (
                        seller.stores.map((store) => (
                          <p className="rounded-lg bg-slate-50 p-2" key={store.id}>
                            <span className="block font-bold text-slate-950">{store.name}</span>
                            {store.status} · {store.slug ?? "no slug"} · {formatAdminDate(store.createdAt)}
                            <span className="block break-all text-slate-400">{store.workspaceId ?? "No workspace"}</span>
                          </p>
                        ))
                      ) : (
                        <p>No linked stores found.</p>
                      )}
                    </div>
                  </section>
                  <section className="rounded-xl bg-white p-3">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Recent orders</p>
                    <div className="mt-2 grid gap-2">
                      {seller.recentOrders.length ? (
                        seller.recentOrders.map((order) => (
                          <p className="rounded-lg bg-slate-50 p-2" key={`${seller.userId}-${order.source}-${order.id}`}>
                            <span className="block break-all font-bold text-slate-950">{order.id}</span>
                            {order.status} · {formatAdminMoney(order.total, order.currency)} · {formatAdminDate(order.createdAt)}
                          </p>
                        ))
                      ) : (
                        <p>No recent orders found.</p>
                      )}
                    </div>
                  </section>
                </div>
              </details>
            </td>
            <td className="px-5 py-4">
              <div className="grid min-w-52 gap-2">
                <Link
                  className="inline-flex h-9 items-center justify-center rounded-full border border-slate-200 bg-white px-3 text-xs font-black uppercase tracking-[0.16em] text-slate-700"
                  href={`/admin/users/${encodeURIComponent(seller.userId)}`}
                >
                  Open seller profile
                </Link>
                <form action={markSellerUnderReview}>
                  <input name="sellerId" type="hidden" value={seller.userId} />
                  <button
                    className="h-9 w-full rounded-full border border-amber-200 bg-amber-50 px-3 text-xs font-black uppercase tracking-[0.16em] text-amber-700 disabled:opacity-50"
                    disabled={seller.status === "under_review"}
                    type="submit"
                  >
                    Mark under review
                  </button>
                </form>
                <form action={markSellerReviewed}>
                  <input name="sellerId" type="hidden" value={seller.userId} />
                  <button
                    className="h-9 w-full rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-black uppercase tracking-[0.16em] text-emerald-700 disabled:opacity-50"
                    disabled={seller.riskStatus === "reviewed"}
                    type="submit"
                  >
                    Mark reviewed
                  </button>
                </form>
                <form action={markSellerHighRisk}>
                  <input name="sellerId" type="hidden" value={seller.userId} />
                  <button
                    className="h-9 w-full rounded-full border border-red-200 bg-red-50 px-3 text-xs font-black uppercase tracking-[0.16em] text-red-700 disabled:opacity-50"
                    disabled={seller.riskStatus === "high_risk"}
                    type="submit"
                  >
                    Mark high risk
                  </button>
                </form>
                <form action={clearSellerRisk}>
                  <input name="sellerId" type="hidden" value={seller.userId} />
                  <button
                    className="h-9 w-full rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-black uppercase tracking-[0.16em] text-slate-700 disabled:opacity-50"
                    disabled={seller.riskStatus === "clear"}
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
