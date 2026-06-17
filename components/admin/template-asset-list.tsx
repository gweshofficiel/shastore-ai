import Link from "next/link";
import { AdminBadge, formatAdminDate } from "@/components/admin/admin-control";

type TemplateAssetListProps = {
  archiveAction: (formData: FormData) => void | Promise<void>;
  assets: Array<{
    assetType: string;
    fileSize: number;
    id: string;
    managedExternally: boolean;
    mimeType: string;
    originalFilename: string;
    previewUrl: string | null;
    status: "archived" | "deleted" | "draft" | "published";
    uploadedAt: string | null;
  }>;
  deleteDraftAction: (formData: FormData) => void | Promise<void>;
  publishAction: (formData: FormData) => void | Promise<void>;
  registryId: string;
  screenshotDrawerId?: string;
  templateName: string;
};

function toneForStatus(status: string) {
  if (status === "published") return "green" as const;
  if (status === "archived" || status === "deleted") return "red" as const;
  return "amber" as const;
}

function statusLabel(status: string) {
  if (status === "published") return "Published";
  if (status === "archived") return "Archived";
  if (status === "deleted") return "Deleted";
  return "Draft";
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function assetTypeLabel(type: string) {
  if (type === "screenshot") return "Screenshot";
  if (type === "preview_image") return "Preview image";
  if (type === "icon") return "Icon";
  if (type === "demo_media") return "Demo media";
  if (type === "package_file") return "Package file";
  if (type === "documentation") return "Documentation";
  return type;
}

export function TemplateAssetList({
  archiveAction,
  assets,
  deleteDraftAction,
  publishAction,
  registryId,
  screenshotDrawerId,
  templateName
}: TemplateAssetListProps) {
  if (!assets.length) {
    return <p className="text-xs font-semibold text-slate-500">No template assets recorded for this template yet.</p>;
  }

  return (
    <div className="mt-3 grid gap-3">
      {assets.map((asset) => (
        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-3" key={asset.id}>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-bold text-slate-950">{assetTypeLabel(asset.assetType)}</p>
            <AdminBadge tone={toneForStatus(asset.status)}>{statusLabel(asset.status)}</AdminBadge>
            {asset.managedExternally ? <AdminBadge tone="slate">Screenshot runtime</AdminBadge> : null}
          </div>
          <p className="text-xs font-semibold text-slate-600">{asset.originalFilename}</p>
          <p className="text-xs font-semibold text-slate-500">
            {asset.mimeType} · {formatFileSize(asset.fileSize)} · Uploaded {formatAdminDate(asset.uploadedAt)}
          </p>
          {asset.previewUrl ? (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
              {asset.mimeType.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt={`${templateName} ${assetTypeLabel(asset.assetType)}`}
                  className="max-h-40 w-full object-cover"
                  src={asset.previewUrl}
                />
              ) : (
                <Link
                  className="flex h-10 items-center justify-center text-xs font-black uppercase tracking-[0.14em] text-slate-700 underline"
                  href={asset.previewUrl}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Preview file
                </Link>
              )}
            </div>
          ) : null}
          {asset.managedExternally ? (
            screenshotDrawerId ? (
              <p className="text-xs font-semibold text-slate-500">
                Managed in{" "}
                <a className="font-bold text-slate-700 underline" href={`#${screenshotDrawerId}`}>
                  Screenshot Management
                </a>
                .
              </p>
            ) : (
              <p className="text-xs font-semibold text-slate-500">Managed in Screenshot Management.</p>
            )
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {asset.previewUrl ? (
                <Link
                  className="flex h-8 items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-3 text-[10px] font-black uppercase tracking-[0.14em] text-slate-700"
                  href={asset.previewUrl}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Preview
                </Link>
              ) : null}
              {asset.status !== "published" ? (
                <form action={publishAction}>
                  <input name="assetId" type="hidden" value={asset.id} />
                  <input name="registryId" type="hidden" value={registryId} />
                  <input name="templateName" type="hidden" value={templateName} />
                  <button
                    className="h-8 w-full rounded-full border border-emerald-200 bg-emerald-50 px-3 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700"
                    type="submit"
                  >
                    Publish
                  </button>
                </form>
              ) : null}
              {asset.status !== "archived" ? (
                <form action={archiveAction}>
                  <input name="assetId" type="hidden" value={asset.id} />
                  <input name="registryId" type="hidden" value={registryId} />
                  <input name="templateName" type="hidden" value={templateName} />
                  <button
                    className="h-8 w-full rounded-full border border-red-200 bg-red-50 px-3 text-[10px] font-black uppercase tracking-[0.14em] text-red-700"
                    type="submit"
                  >
                    Archive
                  </button>
                </form>
              ) : null}
              {asset.status === "draft" ? (
                <form action={deleteDraftAction}>
                  <input name="assetId" type="hidden" value={asset.id} />
                  <input name="registryId" type="hidden" value={registryId} />
                  <input name="templateName" type="hidden" value={templateName} />
                  <button
                    className="h-8 w-full rounded-full border border-slate-200 bg-white px-3 text-[10px] font-black uppercase tracking-[0.14em] text-slate-700"
                    type="submit"
                  >
                    Delete draft
                  </button>
                </form>
              ) : null}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
