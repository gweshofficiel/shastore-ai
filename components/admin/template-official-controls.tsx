"use client";

type TemplateOfficialControlsProps = {
  isOfficial: boolean;
  markOfficialAction: (formData: FormData) => void | Promise<void>;
  registryId: string;
  templateName: string;
  unmarkOfficialAction: (formData: FormData) => void | Promise<void>;
};

const markOfficialConfirmMessage =
  "Official templates are highlighted in the catalog but are not installed into stores automatically.";

export function TemplateOfficialControls({
  isOfficial,
  markOfficialAction,
  registryId,
  templateName,
  unmarkOfficialAction
}: TemplateOfficialControlsProps) {
  return (
    <>
      <form
        action={markOfficialAction}
        onSubmit={(event) => {
          if (!window.confirm(markOfficialConfirmMessage)) {
            event.preventDefault();
          }
        }}
      >
        <input name="registryId" type="hidden" value={registryId} />
        <input name="templateName" type="hidden" value={templateName} />
        <button
          className="h-9 w-full rounded-full border border-blue-200 bg-blue-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isOfficial}
          type="submit"
        >
          Mark official
        </button>
      </form>
      <form action={unmarkOfficialAction}>
        <input name="registryId" type="hidden" value={registryId} />
        <input name="templateName" type="hidden" value={templateName} />
        <button
          className="h-9 w-full rounded-full border border-slate-200 bg-white px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!isOfficial}
          type="submit"
        >
          Remove official
        </button>
      </form>
    </>
  );
}
