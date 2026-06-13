import {
  AdminBadge,
  AdminHeader,
  AdminStatGrid,
  AdminTable,
  formatAdminDate,
} from "@/components/admin/admin-control";
import { DomainDetailsDrawer } from "@/app/admin/domains-hosting/domain-details-drawer";
import {
  clearDomainReview,
  clearEmailReview,
  markDomainUnderReview,
  markEmailUnderReview,
  viewInternalTimeline
} from "@/lib/admin/domain-hosting-actions";
import { getAdminDomainsHostingControl } from "@/lib/admin/data";

function statusTone(status: string) {
  if (["active", "connected", "ready_for_registration", "ready", "verified", "ssl_active"].includes(status)) {
    return "green" as const;
  }

  if (status.includes("failed")) {
    return "red" as const;
  }

  if (status === "placeholder") {
    return "blue" as const;
  }

  return "amber" as const;
}

const futureHooks = [
  "Check provider balance",
  "Search domain provider",
  "Register domain",
  "Create mailbox",
  "Provision hosting",
  "Verify DNS",
  "Request SSL",
  "Renew domain",
  "Cancel service"
];

export default async function AdminDomainsHostingPage() {
  const control = await getAdminDomainsHostingControl();

  return (
    <div className="grid gap-6 lg:gap-8">
      <AdminHeader
        description="Global Super Admin monitoring for Owner Domains, Professional Email, DNS, SSL, and future Hosting foundations. No provider APIs, registrations, mailboxes, hosting, charges, or secrets are used here."
        title="Domain & Hosting Control Center"
      />

      <AdminStatGrid
        stats={[
          { label: "Domain drafts", value: control.overview.domainDrafts },
          { label: "Pending domain orders", value: control.overview.pendingDomainOrders },
          { label: "Ready for registration", value: control.overview.readyForRegistration },
          { label: "DNS pending", value: control.overview.dnsPending },
          { label: "SSL pending", value: control.overview.sslPending },
          { label: "Connected domains", value: control.overview.connectedDomains },
          { label: "Email mailbox drafts", value: control.overview.emailMailboxDrafts },
          { label: "Failed operations", value: control.overview.failedOperations }
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Hosting placeholder</p>
          <div className="mt-4 grid gap-3 text-sm font-semibold text-slate-600">
            <p>{control.hostingPlaceholder.orders}</p>
            <p>{control.hostingPlaceholder.providerHook}</p>
            <p>{control.hostingPlaceholder.provisioning}</p>
          </div>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Platform balance</p>
          <p className="mt-4 font-black text-slate-950">{control.platformBalance.status}</p>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">{control.platformBalance.note}</p>
        </div>
      </div>

      <AdminTable
        empty={!control.providerHealth.length ? "No provider health placeholders configured." : null}
        headers={["Service", "Health", "Internal note"]}
      >
        {control.providerHealth.map((service) => (
          <tr key={service.service}>
            <td className="px-5 py-4 font-bold text-slate-950">{service.service}</td>
            <td className="px-5 py-4"><AdminBadge tone={statusTone(service.status)}>{service.status}</AdminBadge></td>
            <td className="px-5 py-4 text-slate-600">{service.note}</td>
          </tr>
        ))}
      </AdminTable>

      <DomainDetailsDrawer
        clearDomainReview={clearDomainReview}
        domainOrders={control.domainOrders}
        markDomainUnderReview={markDomainUnderReview}
        viewInternalTimeline={viewInternalTimeline}
      />

      <AdminTable
        empty={!control.emailOrders.length ? "No professional email mailbox drafts found." : null}
        headers={["Store", "Owner", "Mailbox", "Domain", "Plan", "Status", "Created", "DNS / activation", "Actions"]}
      >
        {control.emailOrders.map((email) => (
          <tr key={email.id}>
            <td className="px-5 py-4 font-bold text-slate-950">{email.storeName}</td>
            <td className="px-5 py-4 text-slate-600">{email.ownerEmail}</td>
            <td className="px-5 py-4 font-bold text-slate-950">{email.mailboxAddress}</td>
            <td className="px-5 py-4 text-slate-600">{email.domain}</td>
            <td className="px-5 py-4"><AdminBadge tone="blue">{email.mailboxPlan}</AdminBadge></td>
            <td className="px-5 py-4"><AdminBadge tone={statusTone(email.status)}>{email.status}</AdminBadge></td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(email.createdAt)}</td>
            <td className="px-5 py-4">
              <div className="flex flex-wrap gap-2">
                <AdminBadge tone={statusTone(email.dnsStatus)}>{email.dnsStatus}</AdminBadge>
                <AdminBadge tone={statusTone(email.activationStatus)}>{email.activationStatus}</AdminBadge>
              </div>
            </td>
            <td className="px-5 py-4">
              <div className="grid min-w-48 gap-2">
                <form action={markEmailUnderReview}>
                  <input name="storeId" type="hidden" value={email.storeId} />
                  <input name="targetId" type="hidden" value={email.id} />
                  <input name="targetType" type="hidden" value="email" />
                  <button className="h-9 w-full rounded-full border border-amber-200 bg-amber-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-amber-700" type="submit">
                    Mark review
                  </button>
                </form>
                <form action={clearEmailReview}>
                  <input name="storeId" type="hidden" value={email.storeId} />
                  <input name="targetId" type="hidden" value={email.id} />
                  <input name="targetType" type="hidden" value="email" />
                  <button className="h-9 w-full rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-emerald-700" type="submit">
                    Clear review
                  </button>
                </form>
              </div>
            </td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable
        empty={!control.sslStatuses.length ? "No DNS or SSL status records found." : null}
        headers={["Domain", "Store", "DNS status", "SSL status", "Primary status"]}
      >
        {control.sslStatuses.map((domain) => (
          <tr key={domain.id}>
            <td className="px-5 py-4 font-bold text-slate-950">{domain.domain}</td>
            <td className="px-5 py-4 text-slate-600">{domain.storeName}</td>
            <td className="px-5 py-4"><AdminBadge tone={statusTone(domain.dnsStatus)}>{domain.dnsStatus}</AdminBadge></td>
            <td className="px-5 py-4"><AdminBadge tone={statusTone(domain.sslStatus)}>{domain.sslStatus}</AdminBadge></td>
            <td className="px-5 py-4"><AdminBadge>{domain.primaryDomainStatus}</AdminBadge></td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable headers={["Future hook", "Status"]}>
        {futureHooks.map((hook) => (
          <tr key={hook}>
            <td className="px-5 py-4 font-bold text-slate-950">{hook}</td>
            <td className="px-5 py-4">
              <button
                className="h-8 rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-400"
                disabled
                type="button"
              >
                Reserved placeholder
              </button>
            </td>
          </tr>
        ))}
      </AdminTable>
    </div>
  );
}
