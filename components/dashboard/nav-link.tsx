"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CreditCard,
  Globe2,
  LayoutDashboard,
  PackageCheck,
  Palette,
  PanelsTopLeft,
  ShoppingBag,
  Settings,
  Store,
  UserRoundCheck,
  WalletCards
} from "lucide-react";
import { cn } from "@/lib/utils";

const icons = {
  analytics: BarChart3,
  billing: CreditCard,
  customers: UserRoundCheck,
  domains: Globe2,
  overview: LayoutDashboard,
  orders: PackageCheck,
  payments: WalletCards,
  reseller: PanelsTopLeft,
  templates: Palette,
  settings: Settings,
  landings: Store,
  stores: ShoppingBag
};

export function DashboardNavLink({
  href,
  icon,
  label
}: {
  href: string;
  icon: keyof typeof icons;
  label: string;
}) {
  const pathname = usePathname();
  const Icon = icons[icon];
  const isActive =
    href === "/dashboard"
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      className={cn(
        "group inline-flex h-11 shrink-0 items-center gap-3 rounded-2xl px-4 text-sm font-bold transition lg:w-full",
        isActive
          ? "bg-ink text-white shadow-[0_18px_42px_-28px_rgba(15,23,42,0.9)]"
          : "text-slate-500 hover:bg-slate-100 hover:text-ink"
      )}
      href={href}
    >
      <Icon
        className={cn(
          "h-4 w-4 shrink-0 transition",
          isActive ? "text-white" : "text-slate-400 group-hover:text-ink"
        )}
      />
      <span>{label}</span>
    </Link>
  );
}
