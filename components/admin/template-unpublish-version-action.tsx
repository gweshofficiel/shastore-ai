"use client";

type TemplateUnpublishVersionActionProps = {
  action: (formData: FormData) => void | Promise<void>;
  templateId: string;
  versionId: string;
};

const unpublishConfirmMessage =
  "Unpublish this template version? Catalog metadata may move to draft if no other published version exists. Existing stores will not be updated.";

export function TemplateUnpublishVersionAction({
  action,
  templateId,
  versionId
}: TemplateUnpublishVersionActionProps) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(unpublishConfirmMessage)) {
          event.preventDefault();
          return;
        }

        const confirmedInput = event.currentTarget.querySelector('input[name="confirmed"]');
        if (confirmedInput instanceof HTMLInputElement) confirmedInput.value = "1";
      }}
    >
      <input name="confirmed" type="hidden" value="" />
      <input name="templateId" type="hidden" value={templateId} />
      <input name="versionId" type="hidden" value={versionId} />
      <button
        className="h-8 w-full rounded-full border border-slate-200 bg-white px-3 text-[10px] font-black uppercase tracking-[0.14em] text-slate-700"
        type="submit"
      >
        Unpublish version
      </button>
    </form>
  );
}
