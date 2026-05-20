import {
  AdminBadge,
  AdminHeader,
  AdminTable,
  formatAdminDate,
  formatAdminMoney
} from "@/components/admin/admin-control";
import { getAdminOrders } from "@/lib/admin/data";

export default async function AdminOrdersPage() {
  const orders = await getAdminOrders();

  return (
    <div className="grid gap-6 lg:gap-8">
      <AdminHeader
        description="All platform orders captured through landing pages and ecommerce stores."
        title="Orders"
      />
      <AdminTable
        empty={!orders.length ? "No orders found." : null}
        headers={["Owner", "Source", "Customer", "Payment", "Status", "Total", "Created"]}
      >
        {orders.map((order) => (
          <tr key={order.id}>
            <td className="px-5 py-4 text-slate-600">{order.ownerEmail}</td>
            <td className="px-5 py-4"><AdminBadge tone="blue">{order.sourceType}</AdminBadge></td>
            <td className="px-5 py-4 font-bold text-slate-950">{order.customer}</td>
            <td className="px-5 py-4 text-slate-600">{order.paymentMethod}</td>
            <td className="px-5 py-4"><AdminBadge>{order.status}</AdminBadge></td>
            <td className="px-5 py-4 text-slate-600">{formatAdminMoney(order.total, order.currency)}</td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(order.createdAt)}</td>
          </tr>
        ))}
      </AdminTable>
    </div>
  );
}
