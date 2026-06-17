"use client";

type TemplateUpdateApplyRowActionProps = {
  action: (formData: FormData) => void | Promise<void>;
  jobId: string;
  storeName: string;
  templateName: string;
};

const applyConfirmMessage =
  "Apply this prepared template update? Conflicts are skipped safely and recorded. No destructive overwrite of customer store data.";

export function TemplateUpdateApplyRowAction({
  action,
  jobId,
  storeName,
  templateName
}: TemplateUpdateApplyRowActionProps) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(applyConfirmMessage)) {
          event.preventDefault();
          return;
        }

        const confirmedInput = event.currentTarget.querySelector('input[name="confirmed"]');

        if (confirmedInput instanceof HTMLInputElement) {
          confirmedInput.value = "1";
        }
      }}
    >
      <input name="confirmed" type="hidden" value="0" />
      <input name="updateJobId" type="hidden" value={jobId} />
      <input name="storeName" type="hidden" value={storeName} />
      <input name="templateName" type="hidden" value={templateName} />
      <button
        className="h-8 rounded-full border border-emerald-200 bg-emerald-50 px-3 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700"
        type="submit"
      >
        Apply update
      </button>
    </form>
  );
}
