"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const resellerNavItems = [
  { href: "/reseller/dashboard", label: "Home" },
  { href: "/reseller/dashboard/showcase", label: "Showcase" },
  { href: "/reseller/dashboard/listings", label: "Listings" },
  { href: "/reseller/dashboard/verification", label: "Verification" },
  { href: "/reseller/dashboard/orders", label: "Orders" },
  { href: "/reseller/dashboard/leads", label: "Leads" },
  { href: "/reseller/dashboard/requests", label: "Requests" },
  { href: "/reseller/dashboard/messages", label: "Messages" },
  { href: "/reseller/dashboard/notifications", label: "Notifications" },
  { href: "/reseller/dashboard/reviews", label: "Reviews" },
  { href: "/reseller/dashboard/analytics", label: "Analytics" },
  { href: "/reseller/dashboard/reports", label: "Reports" },
  { href: "/reseller/dashboard/subscription", label: "Subscription" },
  { href: "/reseller/dashboard/earnings", label: "Earnings" },
  { href: "/reseller/dashboard/settings", label: "Settings" }
] as const;

export function ResellerDashboardNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-2 overflow-x-auto rounded-[2rem] border border-slate-200/80 bg-white/80 p-2 shadow-[0_18px_60px_-48px_rgba(15,23,42,0.8)] backdrop-blur">
      {resellerNavItems.map((item) => {
        const isActive =
          item.href === "/reseller/dashboard"
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            className={cn(
              "inline-flex h-10 shrink-0 items-center rounded-full px-4 text-sm font-black transition",
              isActive ? "bg-ink text-white" : "text-slate-500 hover:bg-slate-100 hover:text-ink"
            )}
            href={item.href}
            key={item.href}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
