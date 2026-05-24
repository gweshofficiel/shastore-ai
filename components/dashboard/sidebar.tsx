import Link from "next/link";
import { logout } from "@/lib/auth-actions";
import { Button } from "@/components/ui/button";
import { DashboardNavLink } from "@/components/dashboard/nav-link";
import { createClient } from "@/lib/supabase/server";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: "overview" },
  { href: "/dashboard/landings", label: "Landings", icon: "landings" },
  { href: "/dashboard/stores", label: "Stores", icon: "stores" },
  { href: "/dashboard/products", label: "Products", icon: "products" },
  { href: "/dashboard/orders", label: "Orders", icon: "orders" },
  { href: "/dashboard/customers", label: "Customers", icon: "customers" },
  { href: "/dashboard/analytics", label: "Analytics", icon: "analytics" },
  { href: "/dashboard/payments", label: "Payments", icon: "payments" },
  { href: "/dashboard/shipping", label: "Shipping", icon: "shipping" },
  { href: "/dashboard/templates", label: "Templates", icon: "templates" },
  { href: "/dashboard/domains", label: "Domains", icon: "domains" },
  { href: "/dashboard/billing", label: "Billing", icon: "billing" },
  { href: "/dashboard/notifications", label: "Notifications", icon: "notifications" },
  { href: "/dashboard/settings", label: "Settings", icon: "settings" }
] as const;

async function getUnreadNotificationCount() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return 0;
  }

  const { count, error } = await supabase
    .from("notifications" as never)
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("read_at", null);

  if (error) {
    console.warn("[notification-count] unread count failed", {
      message: error.message,
      userId: user.id
    });
    return 0;
  }

  const unreadCount = count ?? 0;

  console.info("[notification-count] unread count loaded", {
    unreadCount,
    userId: user.id
  });

  return unreadCount;
}

export async function Sidebar() {
  const unreadNotifications = await getUnreadNotificationCount();

  return (
    <aside className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl lg:fixed lg:inset-y-0 lg:left-0 lg:w-72 lg:border-b-0 lg:border-r">
      <div className="flex h-full flex-col px-4 py-4 lg:px-5 lg:py-6">
        <div className="flex items-center justify-between gap-4 lg:block">
          <Link className="text-lg font-black tracking-[-0.03em] text-ink" href="/">
            SHASTORE AI
          </Link>
          <p className="hidden text-xs font-semibold text-muted lg:mt-1 lg:block">
            AI landing page studio
          </p>
          <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-slate-400 lg:hidden">
            Dashboard
          </div>
        </div>
        <nav className="mt-4 flex gap-2 overflow-x-auto pb-1 lg:mt-8 lg:grid lg:max-h-[calc(100vh-17rem)] lg:overflow-y-auto lg:pb-1">
          {navItems.map((item) => {
            return (
              <DashboardNavLink
                href={item.href}
                icon={item.icon}
                key={item.href}
                label={item.label}
                badge={item.href === "/dashboard/notifications" ? unreadNotifications : undefined}
              />
            );
          })}
        </nav>
        <div className="mt-auto hidden rounded-3xl border border-slate-200 bg-slate-50 p-4 lg:block">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
            Workspace
          </p>
          <p className="mt-2 text-sm font-semibold leading-6 text-muted">
            Generate copy, publish pages, and manage domains from one place.
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
