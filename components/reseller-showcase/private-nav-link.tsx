"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CreditCard,
  DollarSign,
  LayoutDashboard,
  PackageCheck,
  PanelsTopLeft,
  Settings,
  ShoppingBag,
  Truck
} from "lucide-react";
import { cn } from "@/lib/utils";

const icons = {
  earnings: DollarSign,
  overview: LayoutDashboard,
  orders: PackageCheck,
  reports: BarChart3,
  settings: Settings,
  shipping: Truck,
  showcase: PanelsTopLeft,
  stores: ShoppingBag,
  subscription: CreditCard
};

export function ResellerPrivateNavLink({
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
    href === "/reseller/dashboard"
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      className={cn(
        "group inline-flex h-11 shrink-0 items-center gap-3 rounded-2xl px-4 text-sm font-bold transition lg:w-full",
        isActive
          ? "bg-violet-950 text-white shadow-[0_18px_42px_-28px_rgba(76,29,149,0.9)]"
          : "text-slate-500 hover:bg-violet-50 hover:text-violet-950"
      )}
      href={href}
    >
      <Icon
        className={cn(
          "h-4 w-4 shrink-0 transition",
          isActive ? "text-white" : "text-slate-400 group-hover:text-violet-950"
        )}
      />
      <span>{label}</span>
    </Link>
  );
}
