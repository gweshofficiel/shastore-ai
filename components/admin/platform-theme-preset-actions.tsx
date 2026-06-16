"use client";

import Link from "next/link";
import {
  applyThemePresetToDraftAction,
  archiveThemePresetAction
} from "@/lib/admin/platform-theme-actions";

type PlatformThemePresetActionsProps = {
  canArchive: boolean;
  canApply: boolean;
  presetId: string;
  presetKey: string;
};

const applyConfirmMessage =
  "Applying a preset will replace current draft values only. Published theme will not change until you publish. Continue?";

const archiveConfirmMessage = "Archive this custom preset? It will no longer be available to apply.";

export function PlatformThemePresetActions({
  canArchive,
  canApply,
  presetId,
  presetKey
}: PlatformThemePresetActionsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <Link
        className="inline-flex h-9 items-center rounded-full border border-blue-200 bg-blue-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-blue-700"
        href={`/admin/platform-theme/preview?presetKey=${presetKey}&locale=en`}
      >
        Preview preset
      </Link>
      {canApply ? (
        <form
          action={applyThemePresetToDraftAction}
          onSubmit={(event) => {
            if (!window.confirm(applyConfirmMessage)) {
              event.preventDefault();
            }
          }}
        >
          <input name="presetKey" type="hidden" value={presetKey} />
          <button
            className="inline-flex h-9 items-center rounded-full border border-amber-200 bg-amber-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-amber-700"
            type="submit"
          >
            Apply to Draft
          </button>
        </form>
      ) : null}
      {canArchive ? (
        <form
          action={archiveThemePresetAction}
          onSubmit={(event) => {
            if (!window.confirm(archiveConfirmMessage)) {
              event.preventDefault();
            }
          }}
        >
          <input name="presetId" type="hidden" value={presetId} />
          <button
            className="inline-flex h-9 items-center rounded-full border border-red-200 bg-red-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-red-700"
            type="submit"
          >
            Archive
          </button>
        </form>
      ) : null}
    </div>
  );
}
