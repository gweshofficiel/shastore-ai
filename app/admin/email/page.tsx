import {
  AdminBadge,
  AdminHeader,
  AdminStatGrid,
  AdminTable,
  formatAdminDate
} from "@/components/admin/admin-control";
import type { AdminEmailControl } from "@/lib/admin/data";
import { loadPlatformEmailControlSafe } from "@/lib/admin/email-loader";
import {
  normalizeEmailAdminCountSafe,
  sanitizeEmailAdminDisplayTextSafe
} from "@/src/lib/email/email-production-hardening";
import { sanitizeEmailProductionCertificationText } from "@/src/lib/email/email-production-certification";
import { sanitizeEmailSecurityText } from "@/src/lib/email/email-security-certification";
import {
  disableEmailTemplatePlaceholder,
  markFailedEmailReviewed,
  previewEmailTemplate,
  retryEmailPlaceholder
} from "@/lib/admin/email-actions";

function EmailRuntimeRecoveryNotice({ message }: { message: string }) {
  return (
    <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">Email registry recovery</p>
      <p className="mt-2 text-sm font-semibold text-amber-900">
        Email registry data could not be loaded from runtime storage. The admin shell is still available with fallback
        registry rows.
      </p>
      <p className="mt-2 text-xs font-semibold text-amber-800">{message}</p>
    </div>
  );
}

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
  template: AdminEmailControl["templates"][number];
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
  email: AdminEmailControl["failedEmails"][number];
}) {
  return (
    <>
      <input name="failedEmailId" type="hidden" value={email.id} />
      <input name="emailType" type="hidden" value={email.emailType} />
    </>
  );
}

export default async function AdminEmailPage() {
  const { control, ok, warning } = await loadPlatformEmailControlSafe();
  const recoveryMessage = warning ?? control.runtimeWarning ?? null;

  return (
    <div className="grid gap-6 lg:gap-8">
      <AdminHeader
        description="Platform-level monitoring for shared SHASTORE transactional emails, templates, provider status, queues, and failures. Store Owner campaigns and Professional Email mailboxes remain managed in their own systems."
        title="Email Center"
      />

      {!ok && recoveryMessage ? (
        <EmailRuntimeRecoveryNotice message={sanitizeEmailSecurityText(recoveryMessage, 500)} />
      ) : null}

      {!control.emailSecurityCertification.securityReviewPassed ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">Email security certification</p>
          <p className="mt-2 text-sm font-semibold text-amber-900">
            {sanitizeEmailSecurityText(control.emailSecurityCertification.certificationDescription, 500)}
          </p>
        </div>
      ) : null}

      {!control.emailProductionHardening.hardeningPassed ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">Email production hardening</p>
          <p className="mt-2 text-sm font-semibold text-amber-900">
            {sanitizeEmailAdminDisplayTextSafe(control.emailProductionHardening.hardeningDescription, 500)}
          </p>
        </div>
      ) : null}

      {!control.emailProductionCertification.productionCertified ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">Email production certification</p>
          <p className="mt-2 text-sm font-semibold text-amber-900">
            {sanitizeEmailProductionCertificationText(control.emailProductionCertification.certificationDescription, 500)}
          </p>
        </div>
      ) : (
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Email production certification</p>
          <p className="mt-2 text-sm font-semibold text-emerald-900">
            {sanitizeEmailProductionCertificationText(control.emailProductionCertification.certificationDescription, 500)}
          </p>
        </div>
      )}

      <AdminStatGrid
        stats={[
          { label: "Providers configured", value: normalizeEmailAdminCountSafe(control.overview.providersConfigured) },
          { label: "Templates", value: normalizeEmailAdminCountSafe(control.overview.totalTemplates) },
          { label: "Active templates", value: normalizeEmailAdminCountSafe(control.overview.activeTemplates) },
          { label: "Queued/retry", value: normalizeEmailAdminCountSafe(control.overview.queuedEmails) },
          { label: "Sent", value: normalizeEmailAdminCountSafe(control.overview.sentEmails) },
          { label: "Failed", value: normalizeEmailAdminCountSafe(control.overview.failedEmails) },
          { label: "Mass sends", value: 0 },
          { label: "Mailbox changes", value: 0 }
        ]}
      />

      <AdminStatGrid
        stats={[
          {
            label: "Security review",
            value: control.emailSecurityCertification.securityReviewPassed ? "Passed" : "Needs attention"
          },
          { label: "Checks passed", value: control.emailSecurityCertification.passedChecks },
          { label: "Checks failed", value: control.emailSecurityCertification.failedChecks },
          { label: "Total checks", value: control.emailSecurityCertification.totalChecks },
          {
            label: "Certified at",
            value: control.emailSecurityCertification.certifiedAt
              ? formatAdminDate(control.emailSecurityCertification.certifiedAt)
              : "Unknown"
          },
          { label: "Page load", value: "Read-only" },
          { label: "Execution", value: "Disabled" },
          { label: "Provider secrets", value: "Masked only" }
        ]}
      />
      <p className="-mt-4 text-xs font-semibold text-slate-500">
        {sanitizeEmailSecurityText(control.emailSecurityCertification.certificationDescription, 500)}
      </p>

      <AdminStatGrid
        stats={[
          {
            label: "Production status",
            value: control.emailProductionHardening.productionStable ? "Stable" : "Needs attention"
          },
          {
            label: "Conversion EM-28",
            value: control.emailProductionHardening.conversionComplete ? "Hardened" : "Incomplete"
          },
          { label: "Checks passed", value: normalizeEmailAdminCountSafe(control.emailProductionHardening.passedChecks) },
          { label: "Checks failed", value: normalizeEmailAdminCountSafe(control.emailProductionHardening.failedChecks) },
          { label: "Total checks", value: normalizeEmailAdminCountSafe(control.emailProductionHardening.totalChecks) },
          {
            label: "Hardened at",
            value: control.emailProductionHardening.hardenedAt
              ? formatAdminDate(control.emailProductionHardening.hardenedAt)
              : "Unknown"
          },
          { label: "Page load", value: "Read-only" },
          { label: "Execution", value: "Disabled" }
        ]}
      />
      <p className="-mt-4 text-xs font-semibold text-slate-500">
        {sanitizeEmailAdminDisplayTextSafe(control.emailProductionHardening.hardeningDescription, 500)}
      </p>

      <AdminStatGrid
        stats={[
          {
            label: "Production certified",
            value: control.emailProductionCertification.productionCertified ? "Certified" : "Needs attention"
          },
          {
            label: "Conversion EM-29",
            value: control.emailProductionCertification.conversionComplete ? "Complete" : "Incomplete"
          },
          {
            label: "Production ready",
            value: control.emailProductionCertification.productionReady ? "Ready" : "Needs attention"
          },
          {
            label: "Checks passed",
            value: normalizeEmailAdminCountSafe(control.emailProductionCertification.passedChecks)
          },
          {
            label: "Checks failed",
            value: normalizeEmailAdminCountSafe(control.emailProductionCertification.failedChecks)
          },
          {
            label: "Total checks",
            value: normalizeEmailAdminCountSafe(control.emailProductionCertification.totalChecks)
          },
          {
            label: "Certified at",
            value: control.emailProductionCertification.certifiedAt
              ? formatAdminDate(control.emailProductionCertification.certifiedAt)
              : "Unknown"
          },
          { label: "Admin stability", value: "Stable" }
        ]}
      />
      <p className="-mt-4 text-xs font-semibold text-slate-500">
        {sanitizeEmailProductionCertificationText(control.emailProductionCertification.certificationDescription, 500)}
      </p>

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
            <td className="px-5 py-4 text-slate-600">
              {sanitizeEmailAdminDisplayTextSafe(section.note, 240)}
            </td>
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
          <td className="px-5 py-4 text-slate-600">{normalizeEmailAdminCountSafe(control.queue.queued)}</td>
          <td className="px-5 py-4 text-slate-600">{normalizeEmailAdminCountSafe(control.queue.sent)}</td>
          <td className="px-5 py-4 text-slate-600">{normalizeEmailAdminCountSafe(control.queue.failed)}</td>
          <td className="px-5 py-4 text-slate-600">{normalizeEmailAdminCountSafe(control.queue.retryPending)}</td>
          <td className="px-5 py-4 text-slate-600">{normalizeEmailAdminCountSafe(control.queue.cancelled)}</td>
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
            <td className="px-5 py-4 text-slate-600">
              {sanitizeEmailAdminDisplayTextSafe(email.errorSummary, 240)}
            </td>
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
            <td className="px-5 py-4 text-slate-600">{normalizeEmailAdminCountSafe(campaign.total)}</td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(campaign.lastActivity)}</td>
            <td className="px-5 py-4"><AdminBadge tone={toneForStatus(campaign.status)}>{campaign.status}</AdminBadge></td>
            <td className="px-5 py-4 text-slate-600">
              {sanitizeEmailAdminDisplayTextSafe(campaign.note, 240)}
            </td>
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
