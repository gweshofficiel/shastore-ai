"use client";

type TemplatePublishVersionActionProps = {
  action: (formData: FormData) => void | Promise<void>;
  canPublish: boolean;
  readinessIssues: string[];
  templateId: string;
  templateName: string;
  versionId: string;
  versionNumber: string;
};

const publishConfirmMessage =
  "Publishing this template version updates the template catalog metadata only. Existing stores will not be updated automatically.";

export function TemplatePublishVersionAction({
  action,
  canPublish,
  readinessIssues,
  templateId,
  templateName,
  versionId,
  versionNumber
}: TemplatePublishVersionActionProps) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!canPublish) {
          event.preventDefault();
          window.alert(readinessIssues.join(" ") || "This version is not ready to publish.");
          return;
        }

        if (!window.confirm(publishConfirmMessage)) {
          event.preventDefault();
          return;
        }

        const confirmedInput = event.currentTarget.querySelector('input[name="confirmed"]');
        if (confirmedInput instanceof HTMLInputElement) confirmedInput.value = "1";
      }}
    >
      <input name="confirmed" type="hidden" value="" />
      <input name="templateId" type="hidden" value={templateId} />
      <input name="templateName" type="hidden" value={templateName} />
      <input name="versionId" type="hidden" value={versionId} />
      <input name="versionNumber" type="hidden" value={versionNumber} />
      <button
        className="h-8 w-full rounded-full border border-amber-200 bg-amber-50 px-3 text-[10px] font-black uppercase tracking-[0.14em] text-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={!canPublish}
        title={readinessIssues.join(" · ") || undefined}
        type="submit"
      >
        Publish template update
      </button>
    </form>
  );
}
