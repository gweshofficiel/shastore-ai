import { AdminHeader } from "@/components/admin/admin-control";

export default function AdminResellersPage() {
  return (
    <div className="grid gap-6 lg:gap-8">
      <AdminHeader
        description="Platform owner view for reseller profiles, showcase listings, and future reseller verification."
        title="Resellers"
      />
      <div className="rounded-3xl border border-slate-200 bg-white p-8 text-sm font-semibold leading-6 text-slate-500">
        Reseller administration placeholder. Future controls can review reseller showcases,
        listings, verification, and ownership transfer eligibility.
      </div>
    </div>
  );
}
