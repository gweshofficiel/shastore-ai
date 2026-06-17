"use client";

type ResellerTemplateRowActionsProps = {
  access: {
    accessId: string;
    accessStatus: string;
    resellerName: string;
    templateName: string;
  };
  revokeAction: (formData: FormData) => void | Promise<void>;
  suspendAction: (formData: FormData) => void | Promise<void>;
};

const suspendConfirmMessage =
  "Suspend this reseller template assignment? It will be hidden from the reseller catalog. Existing installations are not affected.";

const revokeConfirmMessage =
  "Revoke this reseller template assignment? Future catalog access is removed. Existing store installations are not uninstalled.";

export function ResellerTemplateRowActions({
  access,
  revokeAction,
  suspendAction
}: ResellerTemplateRowActionsProps) {
  const hiddenFields = (
    <>
      <input name="accessId" type="hidden" value={access.accessId} />
      <input name="resellerName" type="hidden" value={access.resellerName} />
      <input name="templateName" type="hidden" value={access.templateName} />
    </>
  );

  return (
    <div className="grid min-w-44 gap-2">
      {access.accessStatus === "active" ? (
        <form
          action={suspendAction}
          onSubmit={(event) => {
            if (!window.confirm(suspendConfirmMessage)) {
              event.preventDefault();
              return;
            }

            const confirmedInput = event.currentTarget.querySelector('input[name="confirmed"]');
            if (confirmedInput instanceof HTMLInputElement) confirmedInput.value = "1";
          }}
        >
          {hiddenFields}
          <input name="confirmed" type="hidden" value="" />
          <button
            className="h-9 w-full rounded-full border border-amber-200 bg-amber-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-amber-700"
            type="submit"
          >
            Suspend
          </button>
        </form>
      ) : null}

      {access.accessStatus !== "revoked" ? (
        <form
          action={revokeAction}
          onSubmit={(event) => {
            if (!window.confirm(revokeConfirmMessage)) {
              event.preventDefault();
              return;
            }

            const confirmedInput = event.currentTarget.querySelector('input[name="confirmed"]');
            if (confirmedInput instanceof HTMLInputElement) confirmedInput.value = "1";
          }}
        >
          {hiddenFields}
          <input name="confirmed" type="hidden" value="" />
          <button
            className="h-9 w-full rounded-full border border-red-200 bg-red-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-red-700"
            type="submit"
          >
            Revoke
          </button>
        </form>
      ) : (
        <span className="text-xs font-semibold text-slate-400">Revoked</span>
      )}
    </div>
  );
}
