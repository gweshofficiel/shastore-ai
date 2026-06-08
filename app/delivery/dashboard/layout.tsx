import { DeliverySidebar } from "@/components/delivery/delivery-sidebar";
import { requireDeliveryAccess } from "@/lib/delivery/access";

export const dynamic = "force-dynamic";

export default async function DeliveryDashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  await requireDeliveryAccess();

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#ffffff_0%,#ecfdf5_38%,#f1f5f9_100%)]">
      <DeliverySidebar />
      <main className="min-w-0 px-4 py-6 sm:px-6 lg:ml-72 lg:px-8 lg:py-8 xl:px-10">
        <div className="mx-auto grid w-full max-w-7xl gap-8">{children}</div>
      </main>
    </div>
  );
}
