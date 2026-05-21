import { ResellerDashboardNav } from "@/components/reseller-showcase/dashboard-nav";

export default function ResellerDashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-6 lg:gap-8">
      <ResellerDashboardNav />
      {children}
    </div>
  );
}
