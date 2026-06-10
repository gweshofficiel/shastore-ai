import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminTopbar } from "@/components/admin/admin-topbar";
import { getAdminAccess } from "@/lib/admin-access";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const headerStore = await headers();
  const pathname = headerStore.get("x-shastore-path") ?? "/admin";

  if (pathname === "/admin/login") {
    return children;
  }

  const access = await getAdminAccess();

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_36%,#f1f5f9_100%)]">
      <AdminSidebar />
      <main className="min-w-0 px-4 py-6 sm:px-6 lg:ml-72 lg:px-8 lg:py-8 xl:px-10">
        <div className="mx-auto grid w-full max-w-7xl gap-8">
          <AdminTopbar isRoleConfigured={access.isConfigured} />
          {children}
        </div>
      </main>
    </div>
  );
}
