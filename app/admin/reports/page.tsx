import { AdminHeader } from "@/components/admin/admin-control";

export default function AdminReportsPage() {
  return (
    <div className="grid gap-6 lg:gap-8">
      <AdminHeader
        description="Platform reporting placeholder for users, sellers, resellers, subscriptions, and marketplace activity."
        title="Reports"
      />
      <div className="rounded-3xl border border-slate-200 bg-white p-8 text-sm font-semibold leading-6 text-slate-500">
        Reports placeholder. Existing analytics remains separate and available by direct
        admin route until a consolidated reporting dashboard is implemented.
      </div>
    </div>
  );
}
