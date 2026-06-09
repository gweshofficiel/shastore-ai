import Link from "next/link";
import { AdminNavLink } from "@/components/admin/admin-nav-link";

export const adminNavItems = [
  { href: "/admin", label: "Overview", icon: "overview" },
  { href: "/admin/foundation-report", label: "Foundation Report", icon: "reports" },
  { href: "/admin/test-environment", label: "Test Environment", icon: "reports" },
  { href: "/admin/users", label: "Users", icon: "users" },
  { href: "/admin/team", label: "Internal Team", icon: "users" },
  { href: "/admin/stores", label: "Stores", icon: "stores" },
  { href: "/admin/sellers", label: "Sellers", icon: "sellers" },
  { href: "/admin/resellers", label: "Resellers", icon: "resellers" },
  { href: "/admin/subscriptions", label: "Subscriptions", icon: "subscriptions" },
  { href: "/admin/billing/payment-providers", label: "Payment Providers", icon: "subscriptions" },
  { href: "/admin/domains-hosting", label: "Domains & Hosting", icon: "domains" },
  { href: "/admin/integrations", label: "Integrations", icon: "analytics" },
  { href: "/admin/ai", label: "AI Control", icon: "templates" },
  { href: "/admin/platform-website", label: "Platform Website", icon: "templates" },
  { href: "/admin/platform-theme", label: "Platform Theme", icon: "templates" },
  { href: "/admin/templates", label: "Templates", icon: "templates" },
  { href: "/admin/marketplace", label: "Marketplace", icon: "templates" },
  { href: "/admin/marketing", label: "Marketing", icon: "analytics" },
  { href: "/admin/email", label: "Email", icon: "analytics" },
  { href: "/admin/notifications", label: "Notifications", icon: "analytics" },
  { href: "/admin/seo", label: "SEO", icon: "analytics" },
  { href: "/admin/reports", label: "Reports", icon: "reports" },
  { href: "/admin/operations", label: "Operations", icon: "reports" },
  { href: "/admin/support", label: "Support", icon: "support" },
  { href: "/admin/security", label: "Security", icon: "security" },
  { href: "/admin/moderation", label: "Moderation", icon: "moderation" },
  { href: "/admin/settings", label: "Settings", icon: "settings" }
] as const;

export function AdminSidebar() {
  return (
    <aside className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-xl lg:fixed lg:inset-y-0 lg:left-0 lg:w-72 lg:border-b-0 lg:border-r">
      <div className="flex h-full flex-col px-4 py-4 lg:px-5 lg:py-6">
        <div className="flex items-center justify-between gap-4 lg:block">
          <Link className="text-lg font-black tracking-[-0.03em] text-slate-950" href="/admin">
            SHASTORE Admin
          </Link>
          <p className="hidden text-xs font-semibold text-slate-500 lg:mt-1 lg:block">
            Platform operations
          </p>
          <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-slate-400 lg:hidden">
            Admin
          </div>
        </div>
        <nav className="mt-4 flex gap-2 overflow-x-auto pb-1 lg:mt-8 lg:grid lg:max-h-[calc(100vh-17rem)] lg:overflow-y-auto lg:pb-1">
          {adminNavItems.map((item) => (
            <AdminNavLink
              href={item.href}
              icon={item.icon}
              key={item.href}
              label={item.label}
            />
          ))}
        </nav>
        <div className="mt-auto hidden rounded-3xl border border-slate-200 bg-slate-50 p-4 lg:block">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
            Admin Panel
          </p>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
            Monitor users, landings, subscriptions, domains, and platform settings.
          </p>
        </div>
      </div>
    </aside>
  );
}
