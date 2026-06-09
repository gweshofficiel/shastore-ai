"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const deliveryNavItems = [
  { href: "/delivery/dashboard", label: "Overview" },
  { href: "/delivery/dashboard/profile", label: "Profile" },
  { href: "/delivery/dashboard/orders", label: "Assigned Orders" },
  { href: "/delivery/dashboard/status", label: "Delivery Status" },
  { href: "/delivery/dashboard/performance", label: "Performance" },
  { href: "/delivery/analytics", label: "Analytics" },
  { href: "/delivery/compliance", label: "Compliance" },
  { href: "/delivery/notifications", label: "Notifications" },
  { href: "/delivery/messages", label: "Messages" },
  { href: "/delivery/dashboard/support", label: "Support" },
  { href: "/delivery/dashboard/settings", label: "Settings" }
] as const;

export function DeliverySidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 z-40 border-b border-emerald-100 bg-white/95 backdrop-blur-xl lg:fixed lg:inset-y-0 lg:left-0 lg:w-72 lg:border-b-0 lg:border-r">
      <div className="flex h-full flex-col px-4 py-4 lg:px-5 lg:py-6">
        <div className="flex items-center justify-between gap-4 lg:block">
          <Link className="text-lg font-black tracking-[-0.03em] text-emerald-950" href="/delivery/dashboard">
            SHASTORE Delivery
          </Link>
          <p className="hidden text-xs font-semibold text-slate-500 lg:mt-1 lg:block">
            Fulfillment access shell
          </p>
          <div className="rounded-full border border-emerald-100 bg-white px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-emerald-500 lg:hidden">
            Delivery
          </div>
        </div>
        <nav className="mt-4 flex gap-2 overflow-x-auto pb-1 lg:mt-8 lg:grid lg:max-h-[calc(100vh-15rem)] lg:overflow-y-auto lg:pb-1">
          {deliveryNavItems.map((item) => {
            const isActive =
              item.href === "/delivery/dashboard"
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                className={cn(
                  "inline-flex h-11 shrink-0 items-center rounded-2xl px-4 text-sm font-bold transition lg:w-full",
                  isActive
                    ? "bg-emerald-950 text-white shadow-[0_18px_42px_-28px_rgba(6,78,59,0.9)]"
                    : "text-slate-500 hover:bg-emerald-50 hover:text-emerald-950"
                )}
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto hidden rounded-3xl border border-emerald-100 bg-emerald-50 p-4 lg:block">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-500">
            Delivery shell
          </p>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
            Order assignment, proof of delivery, COD, returns, and performance are store-scoped.
          </p>
        </div>
      </div>
    </aside>
  );
}
