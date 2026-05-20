import {
  AdminHeader,
  AdminTable,
  formatAdminMoney
} from "@/components/admin/admin-control";
import { getAdminCustomers } from "@/lib/admin/data";

export default async function AdminCustomersPage() {
  const customers = await getAdminCustomers();

  return (
    <div className="grid gap-6 lg:gap-8">
      <AdminHeader
        description="All platform customers captured from unified checkout and order forms."
        title="Customers"
      />
      <AdminTable
        empty={!customers.length ? "No customers found." : null}
        headers={["Owner", "Name", "Phone", "Email", "Total spent", "Orders"]}
      >
        {customers.map((customer) => (
          <tr key={customer.id}>
            <td className="px-5 py-4 text-slate-600">{customer.ownerEmail}</td>
            <td className="px-5 py-4 font-bold text-slate-950">{customer.name}</td>
            <td className="px-5 py-4 text-slate-600">{customer.phone ?? "Not set"}</td>
            <td className="px-5 py-4 text-slate-600">{customer.email ?? "Not set"}</td>
            <td className="px-5 py-4 text-slate-600">{formatAdminMoney(customer.totalSpent)}</td>
            <td className="px-5 py-4 text-slate-600">{customer.ordersCount}</td>
          </tr>
        ))}
      </AdminTable>
    </div>
  );
}
