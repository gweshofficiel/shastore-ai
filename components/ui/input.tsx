import { cn } from "@/lib/utils";

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
};

export function Input({ className, label, id, ...props }: InputProps) {
  return (
    <label className="grid min-w-0 gap-2 text-sm font-semibold text-ink" htmlFor={id}>
      {label ? <span>{label}</span> : null}
      <input
        id={id}
        className={cn(
          "h-12 min-w-0 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink shadow-sm outline-none transition placeholder:text-slate-400",
          "file:mr-4 file:rounded-full file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:text-sm file:font-bold file:text-ink",
          "focus:border-slate-400 focus:ring-4 focus:ring-slate-100",
          className
        )}
        {...props}
      />
    </label>
  );
}
