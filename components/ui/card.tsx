import { cn } from "@/lib/utils";

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-slate-200/80 bg-white/95 p-6 shadow-[0_18px_60px_-45px_rgba(15,23,42,0.9)] backdrop-blur",
        className
      )}
      {...props}
    />
  );
}
