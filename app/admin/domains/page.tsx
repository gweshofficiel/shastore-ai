import {
  AdminBadge,
  AdminHeader,
  AdminStatGrid,
  AdminTable
} from "@/components/admin/admin-control";
import { getAdminDomainOverview } from "@/lib/domains/admin-data";

export default async function AdminDomainsPage() {
  const overview = await getAdminDomainOverview();

  return (
    <div className="grid gap-6 lg:gap-8">
      <AdminHeader
        description="Monitor connected domains, publication hosts, SSL placeholders, verification state, and hostname conflicts."
        title="Domains overview"
      />
      <AdminStatGrid
        stats={[
          { label: "Connected domains", value: overview.connectedDomains },
          { label: "Pending verification", value: overview.pendingVerification },
          { label: "Pending SSL", value: overview.pendingSsl },
          { label: "Hostname conflicts", value: overview.hostnameConflicts }
        ]}
      />
      <AdminTable
        empty={!overview.domains.length ? "No domain records found." : null}
        headers={["Hostname", "Kind", "Status", "SSL", "Owner", "Created"]}
      >
        {overview.domains.map((domain) => (
          <tr key={String(domain.id)}>
            <td className="px-5 py-4 font-bold text-slate-950">
              {String(domain.hostname)}
            </td>
            <td className="px-5 py-4"><AdminBadge tone="blue">{String(domain.kind)}</AdminBadge></td>
            <td className="px-5 py-4"><AdminBadge>{String(domain.status)}</AdminBadge></td>
            <td className="px-5 py-4"><AdminBadge tone="amber">{String(domain.ssl_status)}</AdminBadge></td>
            <td className="px-5 py-4 text-slate-600">{String(domain.user_id)}</td>
            <td className="px-5 py-4 text-slate-600">{String(domain.created_at ?? "")}</td>
          </tr>
        ))}
      </AdminTable>
      <AdminTable
        empty={!overview.hosts.length ? "No publication host mappings found." : null}
        headers={["Hostname", "Source", "Slug", "Status", "Owner"]}
      >
        {overview.hosts.map((host) => (
          <tr key={String(host.id)}>
            <td className="px-5 py-4 font-bold text-slate-950">
              {String(host.hostname)}
            </td>
            <td className="px-5 py-4"><AdminBadge tone="blue">{String(host.source_type)}</AdminBadge></td>
            <td className="px-5 py-4 text-slate-600">{String(host.source_slug)}</td>
            <td className="px-5 py-4"><AdminBadge>{String(host.status)}</AdminBadge></td>
            <td className="px-5 py-4 text-slate-600">{String(host.user_id)}</td>
          </tr>
        ))}
      </AdminTable>
    </div>
  );
}
