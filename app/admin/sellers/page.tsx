import {
  AdminBadge,
  AdminHeader,
  AdminStatGrid,
  AdminTable,
  formatAdminDate,
  formatAdminMoney
} from "@/components/admin/admin-control";
import { getAdminSellers } from "@/lib/admin/data";
import { markSellerUnderReview, restoreSeller, suspendSeller } from "@/lib/admin/seller-actions";

type AdminSellersPageProps = {
  searchParams: Promise<{
    plan?: string;
    q?: string;
    status?: string;
  }>;
};

function statusTone(status: string) {
  if (status === "active") {
    return "green" as const;
  }

  if (status === "under_review") {
    return "amber" as const;
  }

  return "red" as const;
}

function cleanStatusFilter(value: string | undefined) {
  return value === "active" || value === "suspended" || value === "under_review" ? value : "all";
}

export default async function AdminSellersPage({ searchParams }: AdminSellersPageProps) {
  const query = await searchParams;
  const sellers = await getAdminSellers();
  const statusFilter = cleanStatusFilter(query.status);
  const planFilter = String(query.plan ?? "").trim().toLowerCase();
  const searchTerm = String(query.q ?? "").trim().toLowerCase();
  const filteredSellers = sellers.filter((seller) => {
    const matchesStatus = statusFilter === "all" || seller.status === statusFilter;
    const matchesPlan = !planFilter || seller.plan.toLowerCase() === planFilter;
    const matchesSearch =
      !searchTerm ||
      seller.email.toLowerCase().includes(searchTerm) ||
      seller.userId.toLowerCase().includes(searchTerm) ||
      seller.stores.some((store) => store.name.toLowerCase().includes(searchTerm));

    return matchesStatus && matchesPlan && matchesSearch;
  });
  const planOptions = [...new Set(sellers.map((seller) => seller.plan))].sort();

  return (
    <div className="grid gap-6 lg:gap-8">
      <AdminHeader
        description="Global Super Admin control layer over existing store-owner accounts, stores, orders, products, customers, and plans."
        title="Seller Management"
      />

      <AdminStatGrid
        stats={[
          { label: "Sellers", value: sellers.length },
          { label: "Active", value: sellers.filter((seller) => seller.status === "active").length },
          { label: "Suspended", value: sellers.filter((seller) => seller.status === "suspended").length },
          { label: "Under review", value: sellers.filter((seller) => seller.status === "under_review").length },
          { label: "Stores owned", value: sellers.reduce((total, seller) => total + seller.storesOwned, 0) },
          { label: "Orders", value: sellers.reduce((total, seller) => total + seller.ordersCount, 0) },
          { label: "Customers", value: sellers.reduce((total, seller) => total + seller.customersCount, 0) },
          { label: "Revenue", value: formatAdminMoney(sellers.reduce((total, seller) => total + seller.revenue, 0)) }
        ]}
      />

      <div className="rounded-3xl border border-slate-200 bg-white p-5">
        <form className="grid gap-4 lg:grid-cols-[1fr_220px_220px_auto] lg:items-end">
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            <span>Search sellers</span>
            <input
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none"
              defaultValue={query.q ?? ""}
              name="q"
              placeholder="Email, user ID, or store name"
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
          <button className="h-11 rounded-full bg-slate-950 px-5 text-sm font-black text-white" type="submit">
            Filter sellers
          </button>
        </form>
      </div>

      <AdminTable
        empty={!filteredSellers.length ? "No sellers matched the selected search or filters." : null}
        headers={[
          "Seller",
          "Stores",
          "Published",
          "Products",
          "Orders",
          "Customers",
          "Revenue",
          "Plan",
          "Status",
          "Details",
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
              </div>
            </td>
            <td className="px-5 py-4 text-slate-600">{seller.storesOwned}</td>
            <td className="px-5 py-4 text-slate-600">{seller.publishedStores}</td>
            <td className="px-5 py-4 text-slate-600">{seller.productsCount}</td>
            <td className="px-5 py-4 text-slate-600">{seller.ordersCount}</td>
            <td className="px-5 py-4 text-slate-600">{seller.customersCount}</td>
            <td className="px-5 py-4 text-slate-600">{formatAdminMoney(seller.revenue)}</td>
            <td className="px-5 py-4"><AdminBadge tone="blue">{seller.plan}</AdminBadge></td>
            <td className="px-5 py-4"><AdminBadge tone={statusTone(seller.status)}>{seller.status}</AdminBadge></td>
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
                    <p className="mt-2">State is stored on existing subscription metadata and owned store governance metadata.</p>
                  </section>
                  <section className="rounded-xl bg-white p-3">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Stores</p>
                    <div className="mt-2 grid gap-2">
                      {seller.stores.map((store) => (
                        <p className="rounded-lg bg-slate-50 p-2" key={store.id}>
                          <span className="block font-bold text-slate-950">{store.name}</span>
                          {store.status} · {store.slug ?? "no slug"} · {formatAdminDate(store.createdAt)}
                        </p>
                      ))}
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
                <form action={suspendSeller}>
                  <input name="sellerId" type="hidden" value={seller.userId} />
                  <button
                    className="h-9 w-full rounded-full border border-red-200 bg-red-50 px-3 text-xs font-black uppercase tracking-[0.16em] text-red-700 disabled:opacity-50"
                    disabled={seller.status === "suspended"}
                    type="submit"
                  >
                    Suspend seller
                  </button>
                </form>
                <form action={restoreSeller}>
                  <input name="sellerId" type="hidden" value={seller.userId} />
                  <button
                    className="h-9 w-full rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-black uppercase tracking-[0.16em] text-emerald-700 disabled:opacity-50"
                    disabled={seller.status === "active"}
                    type="submit"
                  >
                    Restore seller
                  </button>
                </form>
                <button
                  className="h-9 w-full rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-black uppercase tracking-[0.16em] text-slate-400"
                  disabled
                  type="button"
                >
                  Delete disabled
                </button>
              </div>
            </td>
          </tr>
        ))}
      </AdminTable>
    </div>
  );
}
