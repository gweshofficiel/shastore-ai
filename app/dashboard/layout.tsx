import type { CSSProperties } from "react";
import { Sidebar } from "@/components/dashboard/sidebar";
import { AccessDeniedSection } from "@/components/dashboard/access-denied";
import { getDashboardPageAccess } from "@/lib/workspaces/data-access";
import { resolveAdminBranding } from "@/src/lib/platform-theme/admin-platform-theme-resolver";
import { headers } from "next/headers";

export default async function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const headerStore = await headers();
  const pathname = headerStore.get("x-shastore-path") ?? "/dashboard";
  const access = await getDashboardPageAccess({ pathname });
  const content = access.allowed ? children : <AccessDeniedSection />;
  const adminBranding = await resolveAdminBranding();
  const sidebarThemeStyle = adminBranding.cssVariables as CSSProperties;

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_36%,#f1f5f9_100%)]">
      <div style={sidebarThemeStyle}>
        <Sidebar logoUrl={adminBranding.logoUrl} />
      </div>
      <main className="min-w-0 px-4 py-6 sm:px-6 lg:ml-72 lg:px-8 lg:py-8 xl:px-10">
        <div className="mx-auto grid w-full max-w-7xl gap-8">{content}</div>
      </main>
    </div>
  );
}
