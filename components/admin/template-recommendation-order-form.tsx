"use client";

type TemplateRecommendationOrderFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  currentOrder: number | null;
  registryId: string;
  templateName: string;
};

export function TemplateRecommendationOrderForm({
  action,
  currentOrder,
  registryId,
  templateName
}: TemplateRecommendationOrderFormProps) {
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input name="registryId" type="hidden" value={registryId} />
      <input name="templateName" type="hidden" value={templateName} />
      <input
        className="h-9 w-24 rounded-full border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600"
        defaultValue={currentOrder ?? 0}
        min={0}
        name="recommendationOrder"
        type="number"
      />
      <button
        className="h-9 rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-700"
        type="submit"
      >
        Update order
      </button>
    </form>
  );
}
