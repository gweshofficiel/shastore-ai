import Link from "next/link";
import {
  AdminBadge,
  AdminHeader,
  AdminStatGrid,
  AdminTable
} from "@/components/admin/admin-control";
import { getTestEnvironmentData } from "@/lib/admin/test-environment-data";

export const dynamic = "force-dynamic";

function statusTone(status: string) {
  return status === "available" ? "green" : "amber";
}

function HealthCard({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className={`mt-2 text-sm font-black ${ok ? "text-emerald-700" : "text-amber-700"}`}>
        {ok ? "Ready" : "Missing"}
      </p>
    </div>
  );
}

function ActionLink({ href, label }: { href: string; label: string }) {
  return (
    <Link className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-slate-700 transition hover:border-slate-300 hover:bg-slate-50" href={href}>
      {label}
    </Link>
  );
}

export default async function AdminTestEnvironmentPage() {
  const data = await getTestEnvironmentData();
  const readyCount = data.health.filter((item) => item.ok).length;

  return (
    <div className="grid gap-6 lg:gap-8">
      <AdminHeader
        description="Permanent read-only test environment registry for validating accounts, store data, products, orders, delivery, and reseller assets before real commerce activation."
        title="Test Environment"
      />

      <AdminStatGrid
        stats={[
          { label: "Health checks", value: `${readyCount}/${data.health.length}`, note: "Existing test fixture coverage." },
          { label: "Accounts", value: data.accounts.filter((account) => account.status === "available").length, note: "Admin, owner, reseller, customer, delivery." },
          { label: "Store registry", value: data.store.registryStatus === "available" ? "Ready" : "Missing", note: data.store.name },
          { label: "No payouts", value: "Safe", note: "No wallet, payout, withdrawal, or reset action exists." }
        ]}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {data.health.map((item) => (
          <HealthCard key={item.label} label={item.label} ok={item.ok} />
        ))}
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Actions</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-slate-950">Registry shortcuts</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <ActionLink href="/admin/users" label="View Accounts" />
            <ActionLink href="/admin/stores" label="View Store" />
            <ActionLink href="#product-registry" label="View Product" />
            <ActionLink href="/admin/orders" label="View Orders" />
            <ActionLink href="#delivery-registry" label="View Delivery" />
            <ActionLink href="/admin/resellers" label="View Reseller Assets" />
          </div>
        </div>
      </section>

      <AdminTable headers={["Account", "Email", "User ID", "Status"]}>
        {data.accounts.map((account) => (
          <tr key={account.label}>
            <td className="px-5 py-4 font-bold text-slate-950">{account.label}</td>
            <td className="px-5 py-4 text-slate-600">{account.email}</td>
            <td className="max-w-72 break-all px-5 py-4 text-slate-500">{account.id}</td>
            <td className="px-5 py-4">
              <AdminBadge tone={statusTone(account.status)}>{account.status}</AdminBadge>
            </td>
          </tr>
        ))}
      </AdminTable>

      <div className="grid gap-6 xl:grid-cols-2">
        <AdminTable headers={["Store Name", "Store ID", "Owner", "Status"]}>
          <tr>
            <td className="px-5 py-4 font-bold text-slate-950">{data.store.name}</td>
            <td className="max-w-72 break-all px-5 py-4 text-slate-500">{data.store.id}</td>
            <td className="px-5 py-4 text-slate-600">{data.store.owner}</td>
            <td className="px-5 py-4">
              <AdminBadge tone={statusTone(data.store.registryStatus)}>{data.store.status}</AdminBadge>
            </td>
          </tr>
        </AdminTable>

        <div id="product-registry">
        <AdminTable headers={["Product Name", "SKU", "Price", "Inventory"]}>
          <tr>
            <td className="px-5 py-4 font-bold text-slate-950">{data.product.name}</td>
            <td className="px-5 py-4 text-slate-600">{data.product.sku}</td>
            <td className="px-5 py-4 text-slate-600">{data.product.price}</td>
            <td className="px-5 py-4">
              <AdminBadge tone={statusTone(data.product.registryStatus)}>{data.product.inventory}</AdminBadge>
            </td>
          </tr>
        </AdminTable>
        </div>

        <AdminTable headers={["Test Order", "Status", "Customer", "Owner"]}>
          <tr>
            <td className="max-w-72 break-all px-5 py-4 font-bold text-slate-950">{data.order.id}</td>
            <td className="px-5 py-4">
              <AdminBadge tone={statusTone(data.order.registryStatus)}>{data.order.status}</AdminBadge>
            </td>
            <td className="px-5 py-4 text-slate-600">{data.order.customer}</td>
            <td className="px-5 py-4 text-slate-600">{data.order.owner}</td>
          </tr>
        </AdminTable>

        <div id="delivery-registry">
        <AdminTable headers={["Assigned Delivery Agent", "Agent ID", "Current Status", "Registry"]}>
          <tr>
            <td className="px-5 py-4 font-bold text-slate-950">{data.delivery.agent}</td>
            <td className="max-w-72 break-all px-5 py-4 text-slate-500">{data.delivery.id}</td>
            <td className="px-5 py-4 text-slate-600">{data.delivery.currentStatus}</td>
            <td className="px-5 py-4">
              <AdminBadge tone={statusTone(data.delivery.status)}>{data.delivery.status}</AdminBadge>
            </td>
          </tr>
        </AdminTable>
        </div>
      </div>

      <AdminTable headers={["Test Reseller", "Test Template", "Test Marketplace Listing", "Status"]}>
        <tr>
          <td className="px-5 py-4 font-bold text-slate-950">{data.reseller.name}</td>
          <td className="px-5 py-4 text-slate-600">{data.reseller.template}</td>
          <td className="px-5 py-4 text-slate-600">{data.reseller.marketplaceListing}</td>
          <td className="px-5 py-4">
            <AdminBadge tone={statusTone(data.reseller.registryStatus)}>{data.reseller.registryStatus}</AdminBadge>
          </td>
        </tr>
      </AdminTable>

      <section className="rounded-[2rem] border border-dashed border-blue-200 bg-blue-50 p-5 lg:p-6">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">
          Future hooks prepared
        </p>
        <p className="mt-2 text-sm font-semibold leading-6 text-blue-950">
          Generate Test Accounts, Generate Test Orders, Generate Test Deliveries, Generate Test Marketplace Sales, and Environment Reset Placeholder.
        </p>
        <p className="mt-3 text-xs font-black uppercase tracking-[0.16em] text-blue-700">
          Read-only foundation · no production reset · no commerce mutation
        </p>
      </section>
    </div>
  );
}
