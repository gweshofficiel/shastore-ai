import Link from "next/link";
import {
  AdminBadge,
  AdminHeader,
  AdminStatGrid,
  AdminTable,
  formatAdminDate
} from "@/components/admin/admin-control";
import { TestAccountActions } from "@/components/admin/test-account-actions";
import { getTestEnvironmentData } from "@/lib/admin/test-environment-data";

export const dynamic = "force-dynamic";

function statusTone(status: string): "amber" | "green" | "red" {
  if (status === "available" || status === "active" || status === "verified") {
    return "green";
  }

  if (
    status === "linked" ||
    status === "visible" ||
    status === "submitted" ||
    status === "created" ||
    status === "delivered" ||
    status === "confirmed" ||
    status === "processing" ||
    status === "fulfilled" ||
    status === "assigned" ||
    status === "accepted" ||
    status === "picked_up" ||
    status === "collected" ||
    status === "settled_to_store"
  ) {
    return "green";
  }

  if (status === "ready" || status === "enabled") {
    return "green";
  }

  if (
    status === "missing" ||
    status === "pending" ||
    status === "pending_verification" ||
    status === "reserved" ||
    status === "waiting" ||
    status === "none" ||
    status === "not created"
  ) {
    return "amber";
  }

  return "red";
}

function HealthCard({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className={`mt-2 text-sm font-black ${ok ? "text-emerald-700" : "text-red-700"}`}>
        {ok ? "Green" : "Red"}
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

function WorkflowPanel({
  items,
  title,
  eyebrow = "Real workflow"
}: {
  eyebrow?: string;
  items: Array<{ label: string; note: string; ok: boolean; status: string }>;
  title: string;
}) {
  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">{eyebrow}</p>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-slate-950">{title}</h2>
        </div>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4" key={item.label}>
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-black text-slate-950">{item.label}</p>
              <AdminBadge tone={item.ok ? statusTone(item.status) : "red"}>{item.ok ? item.status : "red"}</AdminBadge>
            </div>
            <p className="mt-3 break-all text-sm leading-6 text-slate-500">{item.note}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function ReservedPanel({
  items,
  title
}: {
  items: Array<{ label: string; note: string; status: string }>;
  title: string;
}) {
  return (
    <section className="rounded-[2rem] border border-dashed border-blue-200 bg-blue-50 p-5">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Reserved hooks</p>
      <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-blue-950">{title}</h2>
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {items.map((item) => (
          <div className="rounded-2xl border border-blue-100 bg-white/80 p-4" key={item.label}>
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-black text-blue-950">{item.label}</p>
              <AdminBadge tone={statusTone(item.status)}>{item.status}</AdminBadge>
            </div>
            <p className="mt-3 text-sm leading-6 text-blue-900">{item.note}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default async function AdminTestEnvironmentPage() {
  const data = await getTestEnvironmentData();
  const readyCount = data.health.filter((item) => item.ok).length;

  return (
    <div className="grid gap-6 lg:gap-8">
      <AdminHeader
        description="Permanent admin-only registry for dedicated SHASTORE test accounts, linked assets, ecosystem readiness, and future provisioning hooks before real commerce activation."
        title="Test Environment"
      />

      <section className="rounded-[2rem] border border-slate-200 bg-slate-950 p-5 text-white lg:p-6">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Testing Workspace</p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-black tracking-[-0.04em]">{data.testingWorkspace.title}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{data.testingWorkspace.summary}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-300">Workflow readiness</p>
            <p className="mt-1 text-2xl font-black">{data.testingWorkspace.readiness}</p>
          </div>
        </div>
      </section>

      <AdminStatGrid
        stats={[
          { label: "Account health", value: `${readyCount}/${data.health.length}`, note: "Super Admin, owner, reseller, customer, delivery." },
          { label: "Dedicated accounts", value: data.accounts.filter((account) => account.status === "available").length, note: "Permanent role workflow accounts." },
          { label: "Store registry", value: data.store.registryStatus === "available" ? "Ready" : "Missing", note: data.store.name },
          { label: "Provisioning mode", value: "Reserved", note: "Reset, suspend, replace, and regenerate actions are placeholders." }
        ]}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {data.health.map((item) => (
          <HealthCard key={item.label} label={item.label} ok={item.ok} />
        ))}
      </section>

      <WorkflowPanel eyebrow="Role access panel" items={data.roleAccess} title="Multi-role access" />

      <section className="rounded-[2rem] border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Quick access</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-slate-950">Daily testing dashboards</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Opens existing role dashboards and portals only. Authentication and RLS remain unchanged.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ActionLink href="/admin" label="Open Admin Dashboard" />
            <ActionLink href="/dashboard" label="Open Owner Dashboard" />
            <ActionLink href="/reseller/dashboard" label="Open Reseller Dashboard" />
            <ActionLink href={data.shortcuts.find((shortcut) => shortcut.label === "Open Customer Portal")?.href ?? "#customer-flow"} label="Open Customer Portal" />
            <ActionLink href="/delivery/dashboard" label="Open Delivery Dashboard" />
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <WorkflowPanel eyebrow="Test assets" items={data.testAssets} title="Permanent test assets" />
        <WorkflowPanel eyebrow="Workflow status" items={data.workflowStatus} title="Readiness summary" />
      </div>

      <WorkflowPanel eyebrow="Last test results" items={data.lastTestResults} title="Latest real workflow records" />
      <WorkflowPanel eyebrow="Health monitor" items={data.healthMonitor} title="Platform testing health" />
      <ReservedPanel items={data.testRunCenter} title="Test Run Center" />
      <ReservedPanel items={data.futureHooks} title="Future Hooks" />

      <WorkflowPanel items={data.workflowMap} title="Test Environment Workflow Map" />
      <WorkflowPanel items={data.workflowHealth} title="Workflow Health Checks" />

      <section className="rounded-[2rem] border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Admin actions</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-slate-950">Real workflow shortcuts</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              These open existing SHASTORE routes only. They do not impersonate roles or bypass RLS.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {data.shortcuts.map((shortcut) => (
              <ActionLink href={shortcut.href} key={shortcut.label} label={shortcut.label} />
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <WorkflowPanel items={data.orderFlow} title="Test Order Flow Status" />
        <WorkflowPanel items={data.deliveryFlow} title="Delivery Flow Status" />
        <WorkflowPanel items={data.customerFlow} title="Customer Flow Status" />
        <WorkflowPanel items={data.adminMonitoring} title="Admin Monitoring" />
      </div>

      <WorkflowPanel items={data.resellerFlow} title="Reseller Flow Placeholder" />

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

      <AdminTable
        headers={[
          "Account",
          "Email",
          "Role",
          "Creation Date",
          "Last Login",
          "Status",
          "Verified",
          "Linked Asset",
          "Actions"
        ]}
      >
        {data.accounts.map((account) => (
          <tr key={account.label}>
            <td className="px-5 py-4 font-bold text-slate-950">{account.label}</td>
            <td className="px-5 py-4 text-slate-600">{account.email}</td>
            <td className="px-5 py-4">
              <AdminBadge tone="blue">{account.role}</AdminBadge>
            </td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(account.createdAt)}</td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(account.lastLoginAt)}</td>
            <td className="px-5 py-4">
              <AdminBadge tone={statusTone(account.accountStatus)}>{account.accountStatus}</AdminBadge>
            </td>
            <td className="px-5 py-4">
              <AdminBadge tone={account.verified ? "green" : "amber"}>{account.verified ? "Verified" : "Unverified"}</AdminBadge>
            </td>
            <td className="px-5 py-4">
              <Link className="font-bold text-slate-950 underline-offset-4 hover:underline" href={account.linkedAsset.href}>
                {account.linkedAsset.label}
              </Link>
              <p className="mt-1">
                <AdminBadge tone={statusTone(account.linkedAsset.status)}>{account.linkedAsset.status}</AdminBadge>
              </p>
            </td>
            <td className="px-5 py-4">
              <TestAccountActions email={account.email} userId={account.id} />
            </td>
          </tr>
        ))}
      </AdminTable>

      <div className="grid gap-6 xl:grid-cols-2">
        <div id="store-registry">
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
        </div>

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

      <div id="reseller-registry">
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
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {["Reset Password", "Regenerate Test Data", "Suspend Test Account", "Replace Test Account"].map((label) => (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-5" key={label}>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Reserved</p>
            <h3 className="mt-2 text-lg font-black text-slate-950">{label}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Prepared for a future audited admin action. No mutation is wired in this phase.
            </p>
          </div>
        ))}
      </section>

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
