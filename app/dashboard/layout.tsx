import { Sidebar } from "@/components/dashboard/sidebar";

export default function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_36%,#f1f5f9_100%)]">
      <Sidebar />
      <main className="min-w-0 px-4 py-6 sm:px-6 lg:ml-72 lg:px-8 lg:py-8 xl:px-10">
        <div className="mx-auto grid w-full max-w-7xl gap-8">{children}</div>
      </main>
    </div>
  );
}
