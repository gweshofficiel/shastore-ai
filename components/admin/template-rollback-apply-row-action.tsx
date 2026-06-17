"use client";

type TemplateRollbackApplyRowActionProps = {
  action: (formData: FormData) => void | Promise<void>;
  jobId: string;
  storeName: string;
  templateName: string;
};

const applyConfirmMessage =
  "Apply this prepared template rollback? Assignment version will be restored where supported. No destructive overwrite of customer store data.";

export function TemplateRollbackApplyRowAction({
  action,
  jobId,
  storeName,
  templateName
}: TemplateRollbackApplyRowActionProps) {
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
      <input name="rollbackJobId" type="hidden" value={jobId} />
      <input name="storeName" type="hidden" value={storeName} />
      <input name="templateName" type="hidden" value={templateName} />
      <button
        className="h-8 rounded-full border border-fuchsia-200 bg-fuchsia-50 px-3 text-[10px] font-black uppercase tracking-[0.12em] text-fuchsia-700"
        type="submit"
      >
        Apply rollback
      </button>
    </form>
  );
}
