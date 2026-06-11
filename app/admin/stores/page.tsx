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
  clearAdminStoreRisk,
  markAdminStoreHighRisk,
  markAdminStoreReviewed,
  markAdminStoreUnderReview,
} from "@/lib/admin/store-governance-actions";

type AdminStoresPageProps = {
  searchParams: Promise<{
    domain?: string;
    plan?: string;
    ownerType?: string;
    q?: string;
    risk?: string;
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

function riskTone(status: string) {
  if (status === "high_risk") {
    return "red" as const;
  }

  if (status === "reviewed") {
    return "green" as const;
  }

  return "slate" as const;
}

function domainTone(status: string) {
  if (status === "connected") {
    return "green" as const;
  }

  if (status === "pending") {
    return "amber" as const;
  }

  return "slate" as const;
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
  const statusFilter = cleanFilter(query.status, ["", "all", "published", "draft", "suspended", "under_review", "inactive"]);
  const planFilter = String(query.plan ?? "").trim().toLowerCase();
  const search = String(query.q ?? "").trim().toLowerCase();
  const ownerTypeFilter = cleanFilter(query.ownerType, ["", "all", "owner", "unknown"]);
  const domainFilter = cleanFilter(query.domain, ["", "all", "connected", "not_connected"]);
  const riskFilter = cleanFilter(query.risk, ["", "all", "clear", "reviewed", "high_risk"]);
  const filteredStores = stores.filter((store) => {
    const planMatches = !planFilter || store.plan.toLowerCase() === planFilter || store.planId.toLowerCase() === planFilter;
    const ownerTypeMatches = !ownerTypeFilter || ownerTypeFilter === "all" || store.ownerType === ownerTypeFilter;
    const domainMatches =
      !domainFilter ||
      domainFilter === "all" ||
      (domainFilter === "connected" ? store.hasDomain : !store.hasDomain);
    const riskMatches = !riskFilter || riskFilter === "all" || store.riskStatus === riskFilter;
    const searchMatches =
      !search ||
      store.name.toLowerCase().includes(search) ||
      store.id.toLowerCase().includes(search) ||
      store.ownerEmail.toLowerCase().includes(search) ||
      (store.ownerId ?? "").toLowerCase().includes(search) ||
      (store.slug ?? "").toLowerCase().includes(search) ||
      store.domains.some((domain) => domain.hostname.toLowerCase().includes(search));

    return matchesStatus(store, statusFilter || "all") && planMatches && ownerTypeMatches && domainMatches && riskMatches && searchMatches;
  });
  const activeCount = stores.filter((store) => store.status === "published" || store.status === "active" || store.publicationStatus === "published").length;
  const suspendedCount = stores.filter((store) => store.status === "suspended").length;
  const disabledCount = stores.filter((store) => store.status === "disabled").length;
  const domainCount = stores.filter((store) => store.hasDomain).length;
  const activeSubscriptionCount = stores.filter((store) => store.subscriptionStatus === "active" || store.subscriptionStatus === "trialing").length;
  const highRiskCount = stores.filter((store) => store.riskStatus === "high_risk").length;
  const planOptions = [...new Set(stores.map((store) => store.plan))].sort();

  return (
    <div className="grid gap-6 lg:gap-8">
      <AdminHeader
        description="Global Super Admin control layer over existing store owner data, publishing, ownership, billing plans, and storefront readiness."
        title="Store Governance"
      />

      <AdminStatGrid
        stats={[
          { label: "Total stores", value: stores.length },
          { label: "Active stores", value: activeCount },
          { label: "Suspended/disabled", value: suspendedCount + disabledCount },
          { label: "With domains", value: domainCount },
          { label: "Active subscriptions", value: activeSubscriptionCount },
          { label: "High risk", value: highRiskCount },
          { label: "Filtered", value: filteredStores.length }
        ]}
      />

      <div className="rounded-3xl border border-slate-200 bg-white p-5">
        <form className="grid gap-4 lg:grid-cols-4 xl:grid-cols-[1.4fr_1fr_1fr_1fr_1fr_1fr_auto] lg:items-end">
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            <span>Search</span>
            <input
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none"
              defaultValue={query.q ?? ""}
              name="q"
              placeholder="store, id, owner, domain"
            />
          </label>
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
              <option value="under_review">Under review</option>
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
            <span>Owner type</span>
            <select
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none"
              defaultValue={ownerTypeFilter || "all"}
              name="ownerType"
            >
              <option value="all">All owners</option>
              <option value="owner">Known owner</option>
              <option value="unknown">Unknown owner</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            <span>Domain</span>
            <select
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none"
              defaultValue={domainFilter || "all"}
              name="domain"
            >
              <option value="all">All domains</option>
              <option value="connected">Connected</option>
              <option value="not_connected">Not connected</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            <span>Risk</span>
            <select
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none"
              defaultValue={riskFilter || "all"}
              name="risk"
            >
              <option value="all">All risk</option>
              <option value="clear">Clear</option>
              <option value="reviewed">Reviewed</option>
              <option value="high_risk">High risk</option>
            </select>
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
          "Subscription",
          "Domain",
          "Activity",
          "Snapshot",
          "Risk",
          "Actions"
        ]}
      >
        {filteredStores.map((store) => (
          <tr key={store.id}>
            <td className="px-5 py-4">
              <div className="grid gap-1">
                <span className="font-bold text-slate-950">{store.name}</span>
                <span className="break-all text-slate-500">ID: {store.id}</span>
                <span className="text-slate-500">Slug: {store.slug ?? "Not set"}</span>
                <span className="text-slate-500">Template: {store.template}</span>
                <span className="text-slate-500">Created: {formatAdminDate(store.createdAt)}</span>
                <span className="text-slate-500">Updated: {formatAdminDate(store.updatedAt)}</span>
              </div>
            </td>
            <td className="px-5 py-4 text-slate-600">
              <div className="grid gap-1">
                <span>{store.ownerEmail}</span>
                <span className="break-all text-slate-400">{store.ownerId ?? "Unknown owner"}</span>
              </div>
            </td>
            <td className="px-5 py-4">
              <div className="grid gap-1 break-all text-slate-600">
                <span>{store.workspaceId ?? "No workspace"}</span>
                <span className="text-slate-400">{store.workspaceMembers.length} linked users</span>
              </div>
            </td>
            <td className="px-5 py-4">
              <div className="grid gap-2">
                <AdminBadge tone={statusTone(store.status)}>{store.status}</AdminBadge>
                <AdminBadge tone={store.publicationStatus === "published" ? "green" : "slate"}>
                  {store.publicationStatus}
                </AdminBadge>
              </div>
            </td>
            <td className="px-5 py-4">
              <div className="grid gap-2">
                <AdminBadge tone="blue">{store.plan}</AdminBadge>
                <AdminBadge tone={store.subscriptionStatus === "active" || store.subscriptionStatus === "trialing" ? "green" : "slate"}>
                  {store.subscriptionStatus}
                </AdminBadge>
                <span className="text-xs font-semibold text-slate-500">{store.planId}</span>
              </div>
            </td>
            <td className="px-5 py-4">
              <div className="grid gap-2">
                <AdminBadge tone={domainTone(store.domainStatus)}>{store.domainStatus}</AdminBadge>
                {store.domains.length ? (
                  <div className="grid gap-1 text-xs text-slate-500">
                    {store.domains.slice(0, 2).map((domain) => (
                      <span className="break-all" key={`${store.id}-${domain.hostname}`}>
                        {domain.hostname} · {domain.status}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-slate-500">No domain records</span>
                )}
              </div>
            </td>
            <td className="px-5 py-4 text-slate-600">
              <div className="grid gap-1">
                <span>Products: {store.productsCount}</span>
                <span>Orders: {store.ordersCount}</span>
                <span>Revenue: {formatAdminMoney(store.revenue)}</span>
                <span>Views: {store.viewsCount}</span>
              </div>
            </td>
            <td className="px-5 py-4">
              <details className="min-w-72 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.14em] text-slate-600">
                  Store snapshot
                </summary>
                <div className="mt-3 grid gap-3 text-sm text-slate-600">
                  <p>
                    Owner <span className="block break-all font-bold text-slate-950">{store.ownerEmail}</span>
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
                  <div>
                    <p className="font-bold text-slate-950">Runtime health</p>
                    <div className="mt-2 flex max-w-sm flex-wrap gap-2">
                      {store.health.map((item) => (
                        <AdminBadge key={item.key} tone={healthTone(item.status)}>
                          {item.label}
                        </AdminBadge>
                      ))}
                    </div>
                  </div>
                  <p className="rounded-xl border border-blue-200 bg-blue-50 p-2 font-bold text-blue-800">
                    Subscription: {store.plan} · {store.subscriptionStatus}
                  </p>
                </div>
              </details>
            </td>
            <td className="px-5 py-4">
              <div className="grid gap-2">
                <AdminBadge tone={riskTone(store.riskStatus)}>{store.riskStatus}</AdminBadge>
                {store.reviewedAt ? <span className="text-xs text-slate-500">Reviewed: {formatAdminDate(store.reviewedAt)}</span> : null}
                {store.riskSignals.length ? (
                  <details className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.14em] text-slate-600">
                      Signals
                    </summary>
                    <div className="mt-2 grid gap-2">
                      {store.riskSignals.map((signal, index) => (
                        <p className="text-xs text-slate-600" key={`${store.id}-risk-${index}`}>
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
              <div className="grid min-w-52 gap-2">
                {store.ownerId ? (
                  <Link
                    className="inline-flex h-9 items-center justify-center rounded-full border border-slate-200 bg-white px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-700"
                    href={`/admin/users/${encodeURIComponent(store.ownerId)}`}
                  >
                    Open owner profile
                  </Link>
                ) : null}
                <Link
                  className="inline-flex h-9 items-center justify-center rounded-full border border-blue-200 bg-blue-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-blue-700"
                  href={`/dashboard/stores/${encodeURIComponent(store.id)}`}
                >
                  Store dashboard
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
                <form action={markAdminStoreReviewed}>
                  <input name="storeId" type="hidden" value={store.id} />
                  <button
                    className="h-9 w-full rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-emerald-700 disabled:opacity-50"
                    disabled={store.riskStatus === "reviewed"}
                    type="submit"
                  >
                    Mark reviewed
                  </button>
                </form>
                <form action={markAdminStoreHighRisk}>
                  <input name="storeId" type="hidden" value={store.id} />
                  <button
                    className="h-9 w-full rounded-full border border-red-200 bg-red-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-red-700 disabled:opacity-50"
                    disabled={store.riskStatus === "high_risk"}
                    type="submit"
                  >
                    Mark high risk
                  </button>
                </form>
                <form action={clearAdminStoreRisk}>
                  <input name="storeId" type="hidden" value={store.id} />
                  <button
                    className="h-9 w-full rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-700 disabled:opacity-50"
                    disabled={store.riskStatus === "clear"}
                    type="submit"
                  >
                    Clear risk
                  </button>
                </form>
                <button
                  className="h-9 w-full rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-400"
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
