import {
  AdminBadge,
  AdminHeader,
  AdminTable
} from "@/components/admin/admin-control";
import type { LiveStoreRenderingStatus } from "@/src/lib/templates/store-rendering-runtime";

function toneForIsolation(status: string) {
  if (status === "safe") return "green" as const;
  if (status === "warning") return "amber" as const;
  return "red" as const;
}

function toneForSource(source: string) {
  if (source === "store_assignment") return "green" as const;
  if (source === "template_install") return "blue" as const;
  if (source === "store_theme") return "amber" as const;
  return "blue" as const;
}

function optionLabel(value: string) {
  return value.replaceAll("_", " ");
}

function validationSummary(validation: LiveStoreRenderingStatus["validation"]) {
  const checks = [
    validation.renderingBindingActive ? "binding" : null,
    validation.assignmentReadable ? "assignment" : null,
    validation.templateVersionReadable ? "version" : null,
    validation.assetsReadable ? "assets" : null,
    validation.fallbackAvailable ? "fallback" : null,
    validation.isolationSafe ? "isolation" : null
  ].filter(Boolean);

  return checks.length ? checks.join(", ") : "pending";
}

export function TemplateLiveRenderingStatusPanel({
  statuses
}: {
  statuses: LiveStoreRenderingStatus[];
}) {
  return (
    <section className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-5" id="live-store-rendering">
      <AdminHeader
        description="Read-only diagnostics for live store rendering binding. Shows how assigned templates resolve into storefront rendering inputs without mutating customer stores."
        title="Live Store Rendering Status"
      />

      <AdminTable
        empty="No active store template assignments are available for rendering diagnostics."
        headers={[
          "Store",
          "Assigned template",
          "Assigned version",
          "Rendering source",
          "Fallback source",
          "Isolation",
          "Validation"
        ]}
      >
        {statuses.map((status) => (
          <tr key={status.storeId}>
            <td className="px-5 py-4">
              <p className="font-semibold text-slate-700">{status.storeName ?? "Store"}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{status.storeId}</p>
            </td>
            <td className="px-5 py-4 text-slate-600">{status.assignedTemplate ?? "Not assigned"}</td>
            <td className="px-5 py-4 text-slate-600">{status.assignedVersion ?? "Not pinned"}</td>
            <td className="px-5 py-4">
              <AdminBadge tone={toneForSource(status.renderingSource)}>
                {optionLabel(status.renderingSource)}
              </AdminBadge>
            </td>
            <td className="px-5 py-4 text-slate-600">
              {status.fallbackSource ? optionLabel(status.fallbackSource) : "None"}
            </td>
            <td className="px-5 py-4">
              <AdminBadge tone={toneForIsolation(status.isolationStatus)}>
                {optionLabel(status.isolationStatus)}
              </AdminBadge>
            </td>
            <td className="px-5 py-4 text-sm text-slate-600">{validationSummary(status.validation)}</td>
          </tr>
        ))}
      </AdminTable>
    </section>
  );
}
