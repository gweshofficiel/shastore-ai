"use client";

type TemplateAssignmentRowActionsProps = {
  assignmentId: string;
  assignmentStatus: string;
  markActiveAction: (formData: FormData) => void | Promise<void>;
  storeName: string;
  templateName: string;
  unassignAction: (formData: FormData) => void | Promise<void>;
};

const markActiveConfirmMessage =
  "Mark this template assignment as active for the store? Other active assignments for this store will be marked inactive. Store content is not modified.";

const unassignConfirmMessage =
  "Unassign this template from the store? This updates assignment metadata only. Store content, pages, products, and themes are not deleted.";

export function TemplateAssignmentRowActions({
  assignmentId,
  assignmentStatus,
  markActiveAction,
  storeName,
  templateName,
  unassignAction
}: TemplateAssignmentRowActionsProps) {
  const canMarkActive = assignmentStatus === "assigned" || assignmentStatus === "inactive";
  const canUnassign = assignmentStatus !== "unassigned";

  return (
    <div className="flex flex-wrap gap-2">
      {canMarkActive ? (
        <form
          action={markActiveAction}
          onSubmit={(event) => {
            if (!window.confirm(markActiveConfirmMessage)) {
              event.preventDefault();
            }
          }}
        >
          <input name="assignmentId" type="hidden" value={assignmentId} />
          <input name="storeName" type="hidden" value={storeName} />
          <input name="templateName" type="hidden" value={templateName} />
          <button
            className="h-8 rounded-full border border-emerald-200 bg-emerald-50 px-3 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700"
            type="submit"
          >
            Mark active
          </button>
        </form>
      ) : null}
      {canUnassign ? (
        <form
          action={unassignAction}
          onSubmit={(event) => {
            if (!window.confirm(unassignConfirmMessage)) {
              event.preventDefault();
            }
          }}
        >
          <input name="assignmentId" type="hidden" value={assignmentId} />
          <input name="storeName" type="hidden" value={storeName} />
          <input name="templateName" type="hidden" value={templateName} />
          <button
            className="h-8 rounded-full border border-rose-200 bg-rose-50 px-3 text-[10px] font-black uppercase tracking-[0.12em] text-rose-700"
            type="submit"
          >
            Unassign
          </button>
        </form>
      ) : null}
    </div>
  );
}
