"use client";

type TemplateRecommendationControlsProps = {
  isRecommended: boolean;
  recommendAction: (formData: FormData) => void | Promise<void>;
  registryId: string;
  templateName: string;
  unrecommendAction: (formData: FormData) => void | Promise<void>;
  visibility: "internal" | "marketplace" | "owner" | "reseller";
};

const recommendConfirmMessage =
  "Recommended templates are highlighted in selection catalogs but are not installed into stores automatically.";

const internalRecommendConfirmMessage =
  "This template is internal-only. Recommending it will not expose it in owner, reseller, or marketplace catalogs without a visibility change. Continue?";

export function TemplateRecommendationControls({
  isRecommended,
  recommendAction,
  registryId,
  templateName,
  unrecommendAction,
  visibility
}: TemplateRecommendationControlsProps) {
  return (
    <>
      <form
        action={recommendAction}
        onSubmit={(event) => {
          const form = event.currentTarget;

          if (!window.confirm(recommendConfirmMessage)) {
            event.preventDefault();
            return;
          }

          if (visibility === "internal" && !window.confirm(internalRecommendConfirmMessage)) {
            event.preventDefault();
            return;
          }

          if (visibility === "internal") {
            const field = form.elements.namedItem("confirmInternalRecommendation");

            if (field instanceof HTMLInputElement) {
              field.value = "1";
            }
          }
        }}
      >
        <input name="registryId" type="hidden" value={registryId} />
        <input name="templateName" type="hidden" value={templateName} />
        {visibility === "internal" ? (
          <input name="confirmInternalRecommendation" type="hidden" value="0" />
        ) : null}
        <button
          className="h-9 w-full rounded-full border border-amber-200 bg-amber-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isRecommended}
          type="submit"
        >
          Recommend
        </button>
      </form>
      <form action={unrecommendAction}>
        <input name="registryId" type="hidden" value={registryId} />
        <input name="templateName" type="hidden" value={templateName} />
        <button
          className="h-9 w-full rounded-full border border-slate-200 bg-white px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!isRecommended}
          type="submit"
        >
          Remove recommendation
        </button>
      </form>
    </>
  );
}
