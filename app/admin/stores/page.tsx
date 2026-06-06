import Link from "next/link";
import {
  AdminBadge,
  AdminHeader,
  AdminStatGrid,
  AdminTable,
  formatAdminDate,
  formatAdminMoney
} from "@/components/admin/admin-control";
import { getAdminStores } from "@/lib/admin/data";
import {
  markAdminStoreUnderReview,
  restoreAdminStore,
  suspendAdminStore
} from "@/lib/admin/store-governance-actions";

type AdminStoresPageProps = {
  searchParams: Promise<{
    owner?: string;
    plan?: string;
    status?: string;
  }>;
};

function statusTone(status: string) {
  if (status === "published" || status === "active") {
    return "green" as const;
  }

  if (status === "suspended") {
    return "red" as const;
  }

  if (status === "under_review" || status === "draft") {
    return "amber" as const;
  }

  return "slate" as const;
}

function healthTone(status: "blocked" | "ready" | "warning") {
  if (status === "ready") {
    return "green" as const;
  }

  if (status === "blocked") {
    return "red" as const;
  }

  return "amber" as const;
}

function cleanFilter(value: string | undefined, allowed: string[]) {
  return allowed.includes(value ?? "") ? value ?? "" : "";
}

function matchesStatus(store: Awaited<ReturnType<typeof getAdminStores>>[number], status: string) {
  if (!status || status === "all") {
    return true;
  }

  if (status === "published") {
    return store.status === "published" || store.publicationStatus === "published";
  }

  if (status === "inactive") {
    return store.status !== "published" && store.status !== "suspended";
  }

  return store.status === status;
}

export default async function AdminStoresPage({ searchParams }: AdminStoresPageProps) {
  const query = await searchParams;
  const stores = await getAdminStores();
  const statusFilter = cleanFilter(query.status, ["", "all", "published", "draft", "suspended", "inactive"]);
  const planFilter = String(query.plan ?? "").trim().toLowerCase();
  const ownerFilter = String(query.owner ?? "").trim().toLowerCase();
  const filteredStores = stores.filter((store) => {
    const planMatches = !planFilter || store.plan.toLowerCase() === planFilter;
    const ownerMatches =
      !ownerFilter ||
      store.ownerEmail.toLowerCase().includes(ownerFilter) ||
      (store.ownerId ?? "").toLowerCase().includes(ownerFilter);

    return matchesStatus(store, statusFilter || "all") && planMatches && ownerMatches;
  });
  const publishedCount = stores.filter((store) => store.status === "published" || store.publicationStatus === "published").length;
  const suspendedCount = stores.filter((store) => store.status === "suspended").length;
  const underReviewCount = stores.filter((store) => store.status === "under_review").length;
  const totalRevenue = stores.reduce((total, store) => total + store.revenue, 0);
  const planOptions = [...new Set(stores.map((store) => store.plan))].sort();

  return (
    <div className="grid gap-6 lg:gap-8">
      <AdminHeader
        description="Global Super Admin control layer over existing store owner data, publishing, ownership, billing plans, and storefront readiness."
        title="Store Governance"
      />

      <AdminStatGrid
        stats={[
          { label: "Stores", value: stores.length },
          { label: "Published", value: publishedCount },
          { label: "Suspended", value: suspendedCount },
          { label: "Under review", value: underReviewCount },
          { label: "Orders", value: stores.reduce((total, store) => total + store.ordersCount, 0) },
          { label: "Revenue", value: formatAdminMoney(totalRevenue) },
          { label: "Products", value: stores.reduce((total, store) => total + store.productsCount, 0) },
          { label: "Filtered", value: filteredStores.length }
        ]}
      />

      <div className="rounded-3xl border border-slate-200 bg-white p-5">
        <form className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end">
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            <span>Status</span>
            <select
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none"
              defaultValue={statusFilter || "all"}
              name="status"
            >
              <option value="all">All</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
              <option value="suspended">Suspended</option>
              <option value="inactive">Inactive</option>
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
            <span>Owner</span>
            <input
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none"
              defaultValue={query.owner ?? ""}
              name="owner"
              placeholder="email or user id"
            />
          </label>
          <button className="h-11 rounded-full bg-slate-950 px-5 text-sm font-black text-white" type="submit">
            Filter stores
          </button>
        </form>
      </div>

      <AdminTable
        empty={!filteredStores.length ? "No stores matched the selected filters." : null}
        headers={[
          "Store",
          "Owner",
          "Workspace",
          "Status",
          "Plan",
          "Products",
          "Orders",
          "Revenue",
          "Health",
          "Ownership",
          "Actions"
        ]}
      >
        {filteredStores.map((store) => (
          <tr key={store.id}>
            <td className="px-5 py-4">
              <div className="grid gap-1">
                <span className="font-bold text-slate-950">{store.name}</span>
                <span className="text-slate-500">Slug: {store.slug ?? "Not set"}</span>
                <span className="text-slate-500">Template: {store.template}</span>
                <span className="text-slate-500">Created: {formatAdminDate(store.createdAt)}</span>
              </div>
            </td>
            <td className="px-5 py-4 text-slate-600">
              <div className="grid gap-1">
                <span>{store.ownerEmail}</span>
                <span className="break-all text-slate-400">{store.ownerId ?? "Unknown owner"}</span>
              </div>
            </td>
            <td className="px-5 py-4 break-all text-slate-600">{store.workspaceId ?? "No workspace"}</td>
            <td className="px-5 py-4">
              <div className="grid gap-2">
                <AdminBadge tone={statusTone(store.status)}>{store.status}</AdminBadge>
                <AdminBadge tone={store.publicationStatus === "published" ? "green" : "slate"}>
                  {store.publicationStatus}
                </AdminBadge>
              </div>
            </td>
            <td className="px-5 py-4"><AdminBadge tone="blue">{store.plan}</AdminBadge></td>
            <td className="px-5 py-4 text-slate-600">{store.productsCount}</td>
            <td className="px-5 py-4 text-slate-600">{store.ordersCount}</td>
            <td className="px-5 py-4 text-slate-600">{formatAdminMoney(store.revenue)}</td>
            <td className="px-5 py-4">
              <div className="flex max-w-sm flex-wrap gap-2">
                {store.health.map((item) => (
                  <AdminBadge key={item.key} tone={healthTone(item.status)}>
                    {item.label}
                  </AdminBadge>
                ))}
              </div>
            </td>
            <td className="px-5 py-4">
              <details className="min-w-64 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.14em] text-slate-600">
                  Ownership
                </summary>
                <div className="mt-3 grid gap-3 text-sm text-slate-600">
                  <p>
                    Current owner <span className="block break-all font-bold text-slate-950">{store.ownerEmail}</span>
                  </p>
                  <div>
                    <p className="font-bold text-slate-950">Workspace members</p>
                    <div className="mt-2 grid gap-2">
                      {store.workspaceMembers.length ? (
                        store.workspaceMembers.map((member) => (
                          <p className="rounded-xl bg-white p-2" key={`${store.id}-${member.userId}-${member.role}`}>
                            <span className="block break-all font-bold text-slate-950">{member.email}</span>
                            {member.role} · {member.status}
                          </p>
                        ))
                      ) : (
                        <p>No workspace members found.</p>
                      )}
                    </div>
                  </div>
                  <p className="rounded-xl border border-amber-200 bg-amber-50 p-2 font-bold text-amber-800">
                    Ownership transfer tools are reserved for a future phase.
                  </p>
                </div>
              </details>
            </td>
            <td className="px-5 py-4">
              <div className="grid min-w-52 gap-2">
                <Link
                  className="inline-flex h-9 items-center justify-center rounded-full border border-slate-200 bg-white px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-700"
                  href={`/admin/stores?owner=${encodeURIComponent(store.ownerId ?? store.ownerEmail)}`}
                >
                  View store
                </Link>
                <Link
                  className="inline-flex h-9 items-center justify-center rounded-full border border-blue-200 bg-blue-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-blue-700"
                  href={`/dashboard/stores/${encodeURIComponent(store.id)}`}
                >
                  Owner dashboard
                </Link>
                {store.publishedUrl ? (
                  <Link
                    className="inline-flex h-9 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-emerald-700"
                    href={store.publishedUrl}
                  >
                    Public storefront
                  </Link>
                ) : (
                  <span className="inline-flex h-9 items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                    Public storefront unavailable
                  </span>
                )}
                <form action={markAdminStoreUnderReview}>
                  <input name="storeId" type="hidden" value={store.id} />
                  <button
                    className="h-9 w-full rounded-full border border-amber-200 bg-amber-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-amber-700 disabled:opacity-50"
                    disabled={store.status === "under_review"}
                    type="submit"
                  >
                    Mark under review
                  </button>
                </form>
                <form action={suspendAdminStore}>
                  <input name="storeId" type="hidden" value={store.id} />
                  <button
                    className="h-9 w-full rounded-full border border-red-200 bg-red-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-red-700 disabled:opacity-50"
                    disabled={store.status === "suspended"}
                    type="submit"
                  >
                    Suspend store
                  </button>
                </form>
                <form action={restoreAdminStore}>
                  <input name="storeId" type="hidden" value={store.id} />
                  <button
                    className="h-9 w-full rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-emerald-700 disabled:opacity-50"
                    disabled={store.status !== "suspended" && store.status !== "under_review"}
                    type="submit"
                  >
                    Restore store
                  </button>
                </form>
                <button
                  className="h-9 w-full rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-400"
                  disabled
                  type="button"
                >
                  Delete coming later
                </button>
              </div>
            </td>
          </tr>
        ))}
      </AdminTable>
    </div>
  );
}
