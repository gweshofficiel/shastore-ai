import {
  AdminBadge,
  AdminHeader,
  AdminStatGrid,
  AdminTable,
  formatAdminDate
} from "@/components/admin/admin-control";
import { getAdminEmailControl } from "@/lib/admin/data";
import {
  disableEmailTemplatePlaceholder,
  markFailedEmailReviewed,
  previewEmailTemplate,
  retryEmailPlaceholder
} from "@/lib/admin/email-actions";

function toneForStatus(status: string) {
  if (["active", "configured", "healthy", "monitoring", "sent"].includes(status)) {
    return "green" as const;
  }

  if (["disabled", "failed", "missing", "missing_config"].includes(status)) {
    return "red" as const;
  }

  if (["draft", "partial", "retry_pending", "warning"].includes(status)) {
    return "amber" as const;
  }

  return "blue" as const;
}

function TemplateHiddenFields({
  template
}: {
  template: Awaited<ReturnType<typeof getAdminEmailControl>>["templates"][number];
}) {
  return (
    <>
      <input name="templateId" type="hidden" value={template.id} />
      <input name="templateName" type="hidden" value={template.name} />
      <input name="emailType" type="hidden" value={template.category} />
    </>
  );
}

function FailedEmailHiddenFields({
  email
}: {
  email: Awaited<ReturnType<typeof getAdminEmailControl>>["failedEmails"][number];
}) {
  return (
    <>
      <input name="failedEmailId" type="hidden" value={email.id} />
      <input name="emailType" type="hidden" value={email.emailType} />
    </>
  );
}

export default async function AdminEmailPage() {
  const control = await getAdminEmailControl();

  return (
    <div className="grid gap-6 lg:gap-8">
      <AdminHeader
        description="Platform-level monitoring for shared SHASTORE transactional emails, templates, provider status, queues, and failures. Store Owner campaigns and Professional Email mailboxes remain managed in their own systems."
        title="Email Center"
      />

      <AdminStatGrid
        stats={[
          { label: "Providers configured", value: control.overview.providersConfigured },
          { label: "Templates", value: control.overview.totalTemplates },
          { label: "Active templates", value: control.overview.activeTemplates },
          { label: "Queued/retry", value: control.overview.queuedEmails },
          { label: "Sent", value: control.overview.sentEmails },
          { label: "Failed", value: control.overview.failedEmails },
          { label: "Mass sends", value: 0 },
          { label: "Mailbox changes", value: 0 }
        ]}
      />

      <AdminTable headers={["Provider", "Configured", "Health", "Secrets"]}>
        {control.providers.map((provider) => (
          <tr key={provider.provider}>
            <td className="px-5 py-4">
              <p className="font-bold text-slate-950">{provider.name}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{provider.provider}</p>
            </td>
            <td className="px-5 py-4"><AdminBadge tone={toneForStatus(provider.configurationStatus)}>{provider.configurationStatus}</AdminBadge></td>
            <td className="px-5 py-4"><AdminBadge tone={toneForStatus(provider.healthStatus)}>{provider.healthStatus}</AdminBadge></td>
            <td className="px-5 py-4"><AdminBadge tone={provider.secretStatus === "missing" ? "red" : "slate"}>{provider.secretStatus}</AdminBadge></td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable headers={["Transactional section", "Status", "Notes"]}>
        {control.transactionalSections.map((section) => (
          <tr key={section.key}>
            <td className="px-5 py-4 font-bold text-slate-950">{section.name}</td>
            <td className="px-5 py-4"><AdminBadge tone={toneForStatus(section.status)}>{section.status}</AdminBadge></td>
            <td className="px-5 py-4 text-slate-600">{section.note}</td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable headers={["Template", "Category", "Status", "Language", "Last updated", "Preview / controls"]}>
        {control.templates.map((template) => (
          <tr key={template.id}>
            <td className="px-5 py-4">
              <p className="font-bold text-slate-950">{template.name}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{template.id}</p>
            </td>
            <td className="px-5 py-4"><AdminBadge tone="blue">{template.category}</AdminBadge></td>
            <td className="px-5 py-4"><AdminBadge tone={toneForStatus(template.status)}>{template.status}</AdminBadge></td>
            <td className="px-5 py-4 text-slate-600">{template.language}</td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(template.lastUpdated)}</td>
            <td className="px-5 py-4">
              <div className="grid min-w-52 gap-2">
                <form action={previewEmailTemplate}>
                  <TemplateHiddenFields template={template} />
                  <button className="h-9 w-full rounded-full border border-blue-200 bg-blue-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-blue-700" type="submit">
                    Preview
                  </button>
                </form>
                <form action={disableEmailTemplatePlaceholder}>
                  <TemplateHiddenFields template={template} />
                  <button className="h-9 w-full rounded-full border border-red-200 bg-red-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-red-700" type="submit">
                    Disable
                  </button>
                </form>
              </div>
            </td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable headers={["Queued", "Sent", "Failed", "Retry pending", "Cancelled"]}>
        <tr>
          <td className="px-5 py-4 text-slate-600">{control.queue.queued}</td>
          <td className="px-5 py-4 text-slate-600">{control.queue.sent}</td>
          <td className="px-5 py-4 text-slate-600">{control.queue.failed}</td>
          <td className="px-5 py-4 text-slate-600">{control.queue.retryPending}</td>
          <td className="px-5 py-4 text-slate-600">{control.queue.cancelled}</td>
        </tr>
      </AdminTable>

      <AdminTable
        empty={!control.failedEmails.length ? "No failed platform/store email log entries found." : null}
        headers={["Recipient", "Email type", "Error summary", "Created", "Review / retry"]}
      >
        {control.failedEmails.map((email) => (
          <tr key={email.id}>
            <td className="px-5 py-4 font-bold text-slate-950">{email.recipientMasked}</td>
            <td className="px-5 py-4"><AdminBadge tone="red">{email.emailType}</AdminBadge></td>
            <td className="px-5 py-4 text-slate-600">{email.errorSummary}</td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(email.createdAt)}</td>
            <td className="px-5 py-4">
              <div className="grid min-w-52 gap-2">
                <form action={markFailedEmailReviewed}>
                  <FailedEmailHiddenFields email={email} />
                  <button className="h-9 w-full rounded-full border border-slate-200 bg-white px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-700" type="submit">
                    Mark reviewed
                  </button>
                </form>
                <form action={retryEmailPlaceholder}>
                  <FailedEmailHiddenFields email={email} />
                  <button className="h-9 w-full rounded-full border border-amber-200 bg-amber-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-amber-700" type="submit">
                    Retry placeholder
                  </button>
                </form>
              </div>
            </td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable headers={["Campaign scope", "Total", "Last activity", "Status", "Notes"]}>
        {control.campaignMonitoring.map((campaign) => (
          <tr key={campaign.name}>
            <td className="px-5 py-4 font-bold text-slate-950">{campaign.name}</td>
            <td className="px-5 py-4 text-slate-600">{campaign.total}</td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(campaign.lastActivity)}</td>
            <td className="px-5 py-4"><AdminBadge tone={toneForStatus(campaign.status)}>{campaign.status}</AdminBadge></td>
            <td className="px-5 py-4 text-slate-600">{campaign.note}</td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable headers={["Future hook", "Status"]}>
        {control.futureHooks.map((hook) => (
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
