"use client";

type TemplateActivationControlsProps = {
  activateAction: (formData: FormData) => void | Promise<void>;
  archiveAction: (formData: FormData) => void | Promise<void>;
  markDraftAction: (formData: FormData) => void | Promise<void>;
  registryId: string;
  templateName: string;
};

const activateConfirmMessage =
  "Activating makes this template available according to its visibility, but does not install it into stores.";

const archiveConfirmMessage =
  "Archiving hides this template from future selection. Existing stores using this template will not be changed.";

export function TemplateActivationControls({
  activateAction,
  archiveAction,
  markDraftAction,
  registryId,
  templateName
}: TemplateActivationControlsProps) {
  return (
    <>
      <form
        action={activateAction}
        onSubmit={(event) => {
          if (!window.confirm(activateConfirmMessage)) {
            event.preventDefault();
          }
        }}
      >
        <input name="registryId" type="hidden" value={registryId} />
        <input name="templateName" type="hidden" value={templateName} />
        <button
          className="h-9 w-full rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-emerald-700"
          type="submit"
        >
          Activate
        </button>
      </form>
      <form action={markDraftAction}>
        <input name="registryId" type="hidden" value={registryId} />
        <input name="templateName" type="hidden" value={templateName} />
        <button
          className="h-9 w-full rounded-full border border-amber-200 bg-amber-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-amber-700"
          type="submit"
        >
          Mark draft
        </button>
      </form>
      <form
        action={archiveAction}
        onSubmit={(event) => {
          if (!window.confirm(archiveConfirmMessage)) {
            event.preventDefault();
          }
        }}
      >
        <input name="registryId" type="hidden" value={registryId} />
        <input name="templateName" type="hidden" value={templateName} />
        <button
          className="h-9 w-full rounded-full border border-red-200 bg-red-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-red-700"
          type="submit"
        >
          Archive
        </button>
      </form>
    </>
  );
}
