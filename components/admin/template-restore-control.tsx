"use client";

type TemplateRestoreControlProps = {
  action: (formData: FormData) => void | Promise<void>;
  registryId: string;
  templateName: string;
};

const restoreConfirmMessage =
  "Restoring moves this template to Draft. It will not become active until activated manually.";

export function TemplateRestoreControl({ action, registryId, templateName }: TemplateRestoreControlProps) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(restoreConfirmMessage)) {
          event.preventDefault();
        }
      }}
    >
      <input name="registryId" type="hidden" value={registryId} />
      <input name="templateName" type="hidden" value={templateName} />
      <button
        className="h-9 rounded-full border border-amber-200 bg-amber-50 px-4 text-xs font-black uppercase tracking-[0.14em] text-amber-700"
        type="submit"
      >
        Restore to draft
      </button>
    </form>
  );
}
