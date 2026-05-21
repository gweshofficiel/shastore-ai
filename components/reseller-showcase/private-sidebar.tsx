import Link from "next/link";
import { logout } from "@/lib/auth-actions";
import { Button } from "@/components/ui/button";
import { ResellerPrivateNavLink } from "@/components/reseller-showcase/private-nav-link";

const navItems = [
  { href: "/reseller/dashboard", label: "Overview", icon: "overview" },
  { href: "/reseller/dashboard/showcase", label: "Showcase", icon: "showcase" },
  { href: "/reseller/dashboard/stores", label: "Store Listings", icon: "stores" },
  { href: "/reseller/dashboard/orders", label: "Orders", icon: "orders" },
  { href: "/reseller/dashboard/reports", label: "Reports", icon: "reports" },
  { href: "/reseller/dashboard/subscription", label: "Subscription", icon: "subscription" },
  { href: "/reseller/dashboard/earnings", label: "Earnings", icon: "earnings" },
  { href: "/reseller/dashboard/settings", label: "Settings", icon: "settings" }
] as const;

export function ResellerPrivateSidebar() {
  return (
    <aside className="sticky top-0 z-40 border-b border-violet-100 bg-white/95 backdrop-blur-xl lg:fixed lg:inset-y-0 lg:left-0 lg:w-72 lg:border-b-0 lg:border-r">
      <div className="flex h-full flex-col px-4 py-4 lg:px-5 lg:py-6">
        <div className="flex items-center justify-between gap-4 lg:block">
          <Link className="text-lg font-black tracking-[-0.03em] text-violet-950" href="/reseller/dashboard">
            SHASTORE Reseller
          </Link>
          <p className="hidden text-xs font-semibold text-slate-500 lg:mt-1 lg:block">
            Marketplace and showcase tools
          </p>
          <div className="rounded-full border border-violet-100 bg-white px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-violet-400 lg:hidden">
            Reseller
          </div>
        </div>
        <nav className="mt-4 flex gap-2 overflow-x-auto pb-1 lg:mt-8 lg:grid lg:max-h-[calc(100vh-17rem)] lg:overflow-y-auto lg:pb-1">
          {navItems.map((item) => (
            <ResellerPrivateNavLink
              href={item.href}
              icon={item.icon}
              key={item.href}
              label={item.label}
            />
          ))}
        </nav>
        <div className="mt-auto hidden rounded-3xl border border-violet-100 bg-violet-50 p-4 lg:block">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-400">
            Reseller Tools
          </p>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
            Manage showcase listings separately from seller stores, checkout, and billing.
          </p>
        </div>
        <form action={logout} className="hidden pt-4 lg:block">
          <Button className="w-full" type="submit" variant="secondary">
            Sign out
          </Button>
        </form>
      </div>
    </aside>
  );
}
