"use client";

type TemplatePackageSummaryLinkProps = {
  children: React.ReactNode;
  targetId: string;
};

export function TemplatePackageSummaryLink({ children, targetId }: TemplatePackageSummaryLinkProps) {
  return (
    <button
      className="h-9 w-full rounded-full border border-slate-200 bg-white px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-700"
      onClick={() => {
        const element = document.getElementById(targetId);

        if (element instanceof HTMLDetailsElement) {
          element.open = true;
          element.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      }}
      type="button"
    >
      {children}
    </button>
  );
}
