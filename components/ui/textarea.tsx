import { cn } from "@/lib/utils";

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
};

export function Textarea({ className, label, id, ...props }: TextareaProps) {
  return (
    <label className="grid min-w-0 gap-2 text-sm font-semibold text-ink" htmlFor={id}>
      {label ? <span>{label}</span> : null}
      <textarea
        id={id}
        className={cn(
          "min-h-32 min-w-0 resize-y rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-ink shadow-sm outline-none transition placeholder:text-slate-400",
          "focus:border-slate-400 focus:ring-4 focus:ring-slate-100",
          className
        )}
        {...props}
      />
    </label>
  );
}
