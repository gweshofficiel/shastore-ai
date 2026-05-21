import { AdminHeader } from "@/components/admin/admin-control";

export default function AdminModerationPage() {
  return (
    <div className="grid gap-6 lg:gap-8">
      <AdminHeader
        description="Abuse, content review, and moderation placeholder for future platform safety workflows."
        title="Abuse and Moderation"
      />
      <div className="rounded-3xl border border-slate-200 bg-white p-8 text-sm font-semibold leading-6 text-slate-500">
        Moderation placeholder. Future reports can cover public storefronts, reseller
        showcases, marketplace listings, and suspicious account activity.
      </div>
    </div>
  );
}
