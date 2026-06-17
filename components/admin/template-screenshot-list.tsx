import Link from "next/link";
import { AdminBadge } from "@/components/admin/admin-control";

type TemplateScreenshotListProps = {
  archiveAction: (formData: FormData) => void | Promise<void>;
  previewHref: string;
  publishAction: (formData: FormData) => void | Promise<void>;
  registryId: string;
  reorderAction: (formData: FormData) => void | Promise<void>;
  screenshots: Array<{
    id: string;
    originalFilename: string;
    previewUrl: string | null;
    screenshotType: "desktop" | "gallery" | "hero" | "mobile" | "tablet" | "thumbnail";
    sortOrder: number;
    status: "archived" | "deleted" | "draft" | "published";
  }>;
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

function typeLabel(type: TemplateScreenshotListProps["screenshots"][number]["screenshotType"]) {
  if (type === "desktop") return "Desktop";
  if (type === "mobile") return "Mobile";
  if (type === "tablet") return "Tablet";
  if (type === "thumbnail") return "Thumbnail";
  if (type === "hero") return "Hero";
  return "Gallery";
}

export function TemplateScreenshotList({
  archiveAction,
  previewHref,
  publishAction,
  registryId,
  reorderAction,
  screenshots,
  templateName
}: TemplateScreenshotListProps) {
  if (!screenshots.length) {
    return <p className="text-xs font-semibold text-slate-500">No screenshots uploaded for this template yet.</p>;
  }

  return (
    <div className="grid gap-3">
      {screenshots.map((screenshot, index) => (
        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-3" key={screenshot.id}>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-bold text-slate-950">{typeLabel(screenshot.screenshotType)}</p>
            <AdminBadge tone={toneForStatus(screenshot.status)}>{statusLabel(screenshot.status)}</AdminBadge>
            <p className="text-xs font-semibold text-slate-500">Order {screenshot.sortOrder}</p>
          </div>
          <p className="text-xs font-semibold text-slate-500">{screenshot.originalFilename}</p>
          {screenshot.previewUrl ? (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt={`${templateName} ${typeLabel(screenshot.screenshotType)} screenshot`}
                className="max-h-48 w-full object-cover"
                src={screenshot.previewUrl}
              />
            </div>
          ) : (
            <p className="text-xs font-semibold text-amber-700">Preview URL unavailable.</p>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            {screenshot.previewUrl ? (
              <Link
                className="flex h-8 items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-3 text-[10px] font-black uppercase tracking-[0.14em] text-slate-700"
                href={screenshot.previewUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                Preview image
              </Link>
            ) : null}
            <Link
              className="flex h-8 items-center justify-center rounded-full border border-slate-200 bg-white px-3 text-[10px] font-black uppercase tracking-[0.14em] text-slate-700"
              href={previewHref}
            >
              Template preview
            </Link>
            {screenshot.status !== "published" ? (
              <form action={publishAction}>
                <input name="registryId" type="hidden" value={registryId} />
                <input name="screenshotId" type="hidden" value={screenshot.id} />
                <input name="templateName" type="hidden" value={templateName} />
                <button
                  className="h-8 w-full rounded-full border border-emerald-200 bg-emerald-50 px-3 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700"
                  type="submit"
                >
                  Publish
                </button>
              </form>
            ) : null}
            {screenshot.status !== "archived" ? (
              <form action={archiveAction}>
                <input name="registryId" type="hidden" value={registryId} />
                <input name="screenshotId" type="hidden" value={screenshot.id} />
                <input name="templateName" type="hidden" value={templateName} />
                <button
                  className="h-8 w-full rounded-full border border-red-200 bg-red-50 px-3 text-[10px] font-black uppercase tracking-[0.14em] text-red-700"
                  type="submit"
                >
                  Archive
                </button>
              </form>
            ) : null}
            <form action={reorderAction}>
              <input name="direction" type="hidden" value="up" />
              <input name="registryId" type="hidden" value={registryId} />
              <input name="screenshotId" type="hidden" value={screenshot.id} />
              <input name="templateName" type="hidden" value={templateName} />
              <button
                className="h-8 w-full rounded-full border border-slate-200 bg-white px-3 text-[10px] font-black uppercase tracking-[0.14em] text-slate-700 disabled:opacity-40"
                disabled={index === 0}
                type="submit"
              >
                Move up
              </button>
            </form>
            <form action={reorderAction}>
              <input name="direction" type="hidden" value="down" />
              <input name="registryId" type="hidden" value={registryId} />
              <input name="screenshotId" type="hidden" value={screenshot.id} />
              <input name="templateName" type="hidden" value={templateName} />
              <button
                className="h-8 w-full rounded-full border border-slate-200 bg-white px-3 text-[10px] font-black uppercase tracking-[0.14em] text-slate-700 disabled:opacity-40"
                disabled={index === screenshots.length - 1}
                type="submit"
              >
                Move down
              </button>
            </form>
          </div>
        </div>
      ))}
    </div>
  );
}
