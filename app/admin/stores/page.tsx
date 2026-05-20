import {
  AdminBadge,
  AdminHeader,
  AdminTable,
  formatAdminDate
} from "@/components/admin/admin-control";
import { getAdminStores } from "@/lib/admin/data";

export default async function AdminStoresPage() {
  const stores = await getAdminStores();

  return (
    <div className="grid gap-6 lg:gap-8">
      <AdminHeader
        description="Platform-level store reporting with owners, publication status, URLs, templates, orders, and views."
        title="Stores"
      />
      <AdminTable
        empty={!stores.length ? "No stores found." : null}
        headers={["Owner", "Name", "Status", "Template", "Published URL", "Created", "Orders", "Views"]}
      >
        {stores.map((store) => (
          <tr key={store.id}>
            <td className="px-5 py-4 text-slate-600">{store.ownerEmail}</td>
            <td className="px-5 py-4 font-bold text-slate-950">{store.name}</td>
            <td className="px-5 py-4"><AdminBadge>{store.status}</AdminBadge></td>
            <td className="px-5 py-4 text-slate-600">{store.template}</td>
            <td className="px-5 py-4 text-slate-600">{store.publishedUrl ?? "Not published"}</td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(store.createdAt)}</td>
            <td className="px-5 py-4 text-slate-600">{store.ordersCount}</td>
            <td className="px-5 py-4 text-slate-600">{store.viewsCount}</td>
          </tr>
        ))}
      </AdminTable>
    </div>
  );
}
