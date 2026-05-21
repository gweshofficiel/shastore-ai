import { AdminHeader } from "@/components/admin/admin-control";

export default function AdminSellersPage() {
  return (
    <div className="grid gap-6 lg:gap-8">
      <AdminHeader
        description="Platform owner view for seller accounts and store-owner operations. Detailed seller moderation can be connected later."
        title="Sellers"
      />
      <div className="rounded-3xl border border-slate-200 bg-white p-8 text-sm font-semibold leading-6 text-slate-500">
        Seller administration placeholder. Existing stores, landings, orders, and customers
        admin pages remain available by direct route, but the main admin navigation now
        separates platform roles at a higher level.
      </div>
    </div>
  );
}
