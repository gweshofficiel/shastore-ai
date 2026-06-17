import Link from "next/link";

import { AdminHeader, AdminStatGrid, AdminTable } from "@/components/admin/admin-control";
import type { TemplateAnalyticsDashboard, TemplateAnalyticsRange } from "@/src/lib/templates/template-analytics";

const ranges: Array<{ id: TemplateAnalyticsRange; label: string }> = [
  { id: "today", label: "Today" },
  { id: "last_7_days", label: "Last 7 days" },
  { id: "last_30_days", label: "Last 30 days" },
  { id: "all_time", label: "All time" }
];

type TemplateAnalyticsPanelProps = {
  analytics: TemplateAnalyticsDashboard;
  currentRange: TemplateAnalyticsRange;
};

function outcomeRows(stats: Record<string, number>) {
  return Object.entries(stats).map(([label, value]) => (
    <tr key={label}>
      <td className="px-5 py-4 font-semibold capitalize text-slate-700">{label.replace(/_/g, " ")}</td>
      <td className="px-5 py-4 text-slate-600">{value}</td>
    </tr>
  ));
}

function topTable(title: string, rows: Array<{ count: number; templateId: string; templateName: string }>) {
  return (
    <div className="grid gap-3">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{title}</p>
      <AdminTable empty={!rows.length ? "No activity in this range." : null} headers={["Template", "Count"]}>
        {rows.map((row) => (
          <tr key={`${title}-${row.templateId}`}>
            <td className="px-5 py-4">
              <p className="font-semibold text-slate-700">{row.templateName}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{row.templateId}</p>
            </td>
            <td className="px-5 py-4 text-slate-600">{row.count}</td>
          </tr>
        ))}
      </AdminTable>
    </div>
  );
}

export function TemplateAnalyticsPanel({ analytics, currentRange }: TemplateAnalyticsPanelProps) {
  return (
    <section className="grid gap-4">
      <AdminHeader
        description="Read-only Super Admin analytics for template runtime activity. Counts and safe identifiers only. No mutations, installs, updates, or customer store changes."
        title="Template Analytics"
      />

      <div className="flex flex-wrap gap-2">
        {ranges.map((range) => (
          <Link
            className={`h-9 rounded-full border px-4 text-xs font-black uppercase tracking-[0.14em] ${
              currentRange === range.id
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-700"
            }`}
            href={`/admin/templates?analyticsRange=${range.id}`}
            key={range.id}
          >
            {range.label}
          </Link>
        ))}
      </div>

      <AdminStatGrid
        stats={[
          { label: "Total Templates", value: analytics.overview.totalTemplates },
          { label: "Active Templates", value: analytics.overview.activeTemplates },
          { label: "Total Installs", value: analytics.usageStats.totalInstalls },
          { label: "Active Assignments", value: analytics.usageStats.activeAssignments },
          { label: "Marketplace Listings", value: analytics.marketplaceStats.totalListings },
          { label: "Reseller Access", value: analytics.resellerStats.totalAssignments }
        ]}
      />

      <div className="grid gap-4 xl:grid-cols-2">
        {topTable("Most Installed", analytics.topTemplates.mostInstalled)}
        {topTable("Most Assigned", analytics.topTemplates.mostAssigned)}
        {topTable("Most Updated", analytics.topTemplates.mostUpdated)}
        {topTable("Most Marketplace Listed", analytics.topTemplates.mostListedMarketplace)}
        {topTable("Most Reseller Assigned", analytics.topTemplates.mostResellerAssigned)}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <AdminTable headers={["Install outcomes", "Count"]}>
          {outcomeRows({
            cancelled: analytics.installStats.cancelledInstalls,
            completed: analytics.installStats.completedInstalls,
            failed: analytics.installStats.failedInstalls,
            prepared: analytics.installStats.preparedInstalls,
            total: analytics.installStats.totalInstalls
          })}
        </AdminTable>

        <AdminTable headers={["Update outcomes", "Count"]}>
          {outcomeRows({
            cancelled: analytics.updateStats.cancelledUpdates,
            completed: analytics.updateStats.completedUpdates,
            failed: analytics.updateStats.failedUpdates,
            prepared: analytics.updateStats.preparedUpdates,
            total: analytics.updateStats.totalUpdates
          })}
        </AdminTable>

        <AdminTable headers={["Rollback outcomes", "Count"]}>
          {outcomeRows({
            cancelled: analytics.rollbackStats.cancelledRollbacks,
            completed: analytics.rollbackStats.completedRollbacks,
            failed: analytics.rollbackStats.failedRollbacks,
            prepared: analytics.rollbackStats.preparedRollbacks,
            total: analytics.rollbackStats.totalRollbacks
          })}
        </AdminTable>

        <AdminTable headers={["Marketplace status", "Count"]}>
          {outcomeRows({
            approved: analytics.marketplaceStats.approvedListings,
            changes_requested: analytics.marketplaceStats.changesRequestedListings,
            draft: analytics.marketplaceStats.draftListings,
            featured: analytics.marketplaceStats.featuredListings,
            pending_review: analytics.marketplaceStats.pendingApprovals,
            published: analytics.marketplaceStats.publishedListings,
            rejected: analytics.marketplaceStats.rejectedListings,
            total: analytics.marketplaceStats.totalListings
          })}
        </AdminTable>

        <AdminTable headers={["Reseller access status", "Count"]}>
          {outcomeRows({
            active: analytics.resellerStats.activeAssignments,
            assigned_templates: analytics.resellerStats.assignedTemplates,
            inherited: analytics.resellerStats.inheritedAssignments,
            marketplace: analytics.resellerStats.marketplaceAssignments,
            revoked: analytics.resellerStats.revokedAssignments,
            suspended: analytics.resellerStats.suspendedAssignments,
            total: analytics.resellerStats.totalAssignments
          })}
        </AdminTable>

        <AdminTable headers={["Assignment status", "Count"]}>
          {outcomeRows({
            active: analytics.assignmentStats.activeAssignments,
            assigned: analytics.assignmentStats.assignedAssignments,
            failed: analytics.assignmentStats.failedAssignments,
            inactive: analytics.assignmentStats.inactiveAssignments,
            total: analytics.assignmentStats.totalAssignments,
            unassigned: analytics.assignmentStats.unassignedAssignments
          })}
        </AdminTable>
      </div>
    </section>
  );
}
