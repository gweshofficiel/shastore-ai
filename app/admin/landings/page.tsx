import {
  AdminBadge,
  AdminHeader,
  AdminTable,
  formatAdminDate
} from "@/components/admin/admin-control";
import { getAdminLandings } from "@/lib/admin/data";

export default async function AdminLandingsPage() {
  const landings = await getAdminLandings();

  return (
    <div className="grid gap-6 lg:gap-8">
      <AdminHeader
        description="Platform-level landing page reporting with owners, URLs, templates, orders, and views."
        title="Landing pages"
      />
      <AdminTable
        empty={!landings.length ? "No landing pages found." : null}
        headers={["Owner", "Title", "Status", "Template", "Published URL", "Created", "Orders", "Views"]}
      >
        {landings.map((landing) => (
          <tr key={landing.id}>
            <td className="px-5 py-4 text-slate-600">{landing.ownerEmail}</td>
            <td className="px-5 py-4 font-bold text-slate-950">{landing.title}</td>
            <td className="px-5 py-4"><AdminBadge>{landing.status}</AdminBadge></td>
            <td className="px-5 py-4 text-slate-600">{landing.template}</td>
            <td className="px-5 py-4 text-slate-600">{landing.publishedUrl ?? "Not published"}</td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(landing.createdAt)}</td>
            <td className="px-5 py-4 text-slate-600">{landing.ordersCount}</td>
            <td className="px-5 py-4 text-slate-600">{landing.viewsCount}</td>
          </tr>
        ))}
      </AdminTable>
    </div>
  );
}
