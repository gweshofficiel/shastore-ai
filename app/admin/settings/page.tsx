import { AdminPageShell } from "@/components/admin/admin-page-shell";

export default function AdminSettingsPage() {
  return (
    <AdminPageShell
      cards={[
        {
          label: "Role access",
          value: "Prepared",
          note: "Set `ADMIN_EMAILS` to restrict `/admin` to platform owner accounts."
        },
        {
          label: "Platform defaults",
          value: "Coming soon",
          note: "Add owner-only defaults and operational settings here."
        },
        {
          label: "System controls",
          value: "Coming soon",
          note: "Reserve this area for future platform configuration."
        }
      ]}
      description="Owner-only platform settings, separate from customer account settings."
      title="Platform settings"
    />
  );
}
