import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminBadge, AdminHeader, AdminTable, formatAdminDate } from "@/components/admin/admin-control";
import { Card } from "@/components/ui/card";
import {
  getThemeVersion,
  snapshotTypeLabel
} from "@/src/lib/platform-theme/platform-theme-versions";

export const dynamic = "force-dynamic";

type VersionPageProps = {
  params: Promise<{ versionId: string }>;
};

function text(value: unknown, maxLength = 500) {
  if (typeof value !== "string") return "";

  return value.trim().slice(0, maxLength);
}

function valueDisplay(value: Record<string, unknown>) {
  return text(value.value) ||
    text(value.hex) ||
    text(value.path) ||
    text(value.url) ||
    text(value.stack) ||
    text(value.mode) ||
    text(value.fileName) ||
    "Not configured";
}

function createdByLabel(createdBy: string | null) {
  if (!createdBy) return "Not recorded";

  return createdBy.length > 12 ? `${createdBy.slice(0, 8)}…` : createdBy;
}

function toneForSnapshotType(snapshotType: string) {
  if (snapshotType === "published") return "green" as const;
  if (snapshotType === "draft_saved") return "amber" as const;
  if (snapshotType === "asset_uploaded") return "blue" as const;
  return "slate" as const;
}

export default async function AdminPlatformThemeVersionPage({ params }: VersionPageProps) {
  const { versionId } = await params;
  const version = await getThemeVersion(versionId);

  if (!version) {
    notFound();
  }

  return (
    <div className="grid gap-6 lg:gap-8">
      <AdminHeader
        description="Read-only snapshot of platform theme settings captured for audit. Rollback is not available in this phase."
        title={`Theme Version #${version.versionNumber}`}
      />

      <Card className="grid gap-4 p-5 lg:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <AdminBadge tone={toneForSnapshotType(version.snapshotType)}>
            {snapshotTypeLabel(version.snapshotType)}
          </AdminBadge>
          <AdminBadge tone="blue">Admin-only</AdminBadge>
          <AdminBadge tone="green">View snapshot</AdminBadge>
        </div>
        <div className="grid gap-2 text-sm leading-6 text-slate-500">
          <p><span className="font-black text-slate-800">Created:</span> {formatAdminDate(version.createdAt)}</p>
          <p><span className="font-black text-slate-800">Created by:</span> {createdByLabel(version.createdBy)}</p>
          <p><span className="font-black text-slate-800">Note:</span> {version.note ?? "Snapshot"}</p>
          <p><span className="font-black text-slate-800">Captured at:</span> {formatAdminDate(version.snapshot.capturedAt)}</p>
          <p><span className="font-black text-slate-800">Summary:</span> {version.changedSettingsSummary}</p>
        </div>
        <Link
          className="inline-flex h-9 w-fit items-center rounded-full border border-blue-200 bg-blue-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-blue-700"
          href="/admin/platform-theme#theme-version-history"
        >
          Back to version history
        </Link>
      </Card>

      <section className="grid gap-5 rounded-3xl border border-slate-200 bg-white p-5">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Brand settings snapshot</p>
          <h2 className="mt-2 text-xl font-black tracking-[-0.03em] text-slate-950">Settings at capture time</h2>
        </div>
        <AdminTable
          empty={!version.snapshot.settings.length ? "No brand settings were captured in this snapshot." : null}
          headers={["Setting", "Type", "Draft value", "Published value", "Validation"]}
        >
          {version.snapshot.settings.map((setting) => (
            <tr key={setting.settingKey}>
              <td className="px-5 py-4 font-bold text-slate-950">{setting.settingKey}</td>
              <td className="px-5 py-4 text-slate-600">{setting.settingType}</td>
              <td className="px-5 py-4 text-sm font-semibold text-slate-600">{valueDisplay(setting.draftValue)}</td>
              <td className="px-5 py-4 text-sm font-semibold text-slate-600">{valueDisplay(setting.publishedValue)}</td>
              <td className="px-5 py-4">
                <AdminBadge tone={setting.validationStatus === "ready" ? "green" : setting.validationStatus === "invalid" ? "red" : "amber"}>
                  {setting.validationStatus}
                </AdminBadge>
              </td>
            </tr>
          ))}
        </AdminTable>
      </section>

      <section className="grid gap-5 rounded-3xl border border-slate-200 bg-white p-5">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Asset references</p>
          <h2 className="mt-2 text-xl font-black tracking-[-0.03em] text-slate-950">Theme assets at capture time</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            Only safe preview URLs and metadata are shown. Private storage paths and credentials are never stored in version snapshots.
          </p>
        </div>
        <AdminTable
          empty={!version.snapshot.assets.length ? "No theme assets were captured in this snapshot." : null}
          headers={["Type", "Filename", "MIME", "Size", "Status", "Preview"]}
        >
          {version.snapshot.assets.map((asset) => (
            <tr key={asset.assetId}>
              <td className="px-5 py-4 font-bold text-slate-950">{asset.assetType}</td>
              <td className="px-5 py-4 text-slate-600">{asset.fileName}</td>
              <td className="px-5 py-4 text-slate-600">{asset.mimeType}</td>
              <td className="px-5 py-4 text-slate-600">{(asset.fileSize / 1024).toFixed(1)} KB</td>
              <td className="px-5 py-4">
                <AdminBadge tone={asset.status === "published" ? "green" : "amber"}>{asset.status}</AdminBadge>
              </td>
              <td className="px-5 py-4">
                {asset.previewUrl ? (
                  <object
                    aria-label={`${asset.assetType} preview`}
                    className="h-8 w-8 rounded-lg border border-slate-200 bg-white p-1"
                    data={asset.previewUrl}
                    type={asset.mimeType}
                  >
                    <span className="text-xs text-slate-400">—</span>
                  </object>
                ) : (
                  <span className="text-xs font-semibold text-slate-400">No preview</span>
                )}
              </td>
            </tr>
          ))}
        </AdminTable>
      </section>
    </div>
  );
}
