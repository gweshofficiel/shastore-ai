import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default function SellerProductsPage() {
  return (
    <div className="grid gap-6 lg:gap-8">
      <PageHeader
        description="Seller product management foundation. Product editing remains available inside each store while a unified catalog is prepared."
        title="Products"
      />
      <Card className="p-8 text-center">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
          Seller Dashboard
        </p>
        <h2 className="mt-3 text-2xl font-black tracking-[-0.03em] text-ink">
          Unified product catalog coming soon
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-muted">
          Products are currently managed from individual store drafts. This page keeps
          normal seller navigation complete without touching storefronts, templates,
          checkout, orders, payments, or billing.
        </p>
      </Card>
    </div>
  );
}
