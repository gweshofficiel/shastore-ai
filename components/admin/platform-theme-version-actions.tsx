"use client";

import Link from "next/link";
import { rollbackThemeVersionToDraftAction } from "@/lib/admin/platform-theme-actions";

type PlatformThemeVersionActionsProps = {
  canRollback: boolean;
  versionId: string;
  versionNumber: number;
};

const rollbackConfirmMessage =
  "Rollback will replace current draft values only. Published theme will not change until you publish. Continue?";

export function PlatformThemeVersionActions({
  canRollback,
  versionId
}: PlatformThemeVersionActionsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <Link
        className="inline-flex h-9 items-center rounded-full border border-blue-200 bg-blue-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-blue-700"
        href={`/admin/platform-theme/preview?versionId=${versionId}&locale=en`}
      >
        Preview version
      </Link>
      {canRollback ? (
        <form
          action={rollbackThemeVersionToDraftAction}
          onSubmit={(event) => {
            if (!window.confirm(rollbackConfirmMessage)) {
              event.preventDefault();
            }
          }}
        >
          <input name="versionId" type="hidden" value={versionId} />
          <button
            className="inline-flex h-9 items-center rounded-full border border-amber-200 bg-amber-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-amber-700"
            type="submit"
          >
            Rollback to Draft
          </button>
        </form>
      ) : null}
      <Link
        className="inline-flex h-9 items-center rounded-full border border-blue-200 bg-blue-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-blue-700"
        href={`/admin/platform-theme/versions/${versionId}`}
      >
        View snapshot
      </Link>
    </div>
  );
}
