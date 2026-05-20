import { AdminPageShell } from "@/components/admin/admin-page-shell";
import { landingTemplates } from "@/templates/registry";

export default function AdminTemplatesPage() {
  return (
    <AdminPageShell
      cards={[
        {
          label: "Template library",
          value: String(landingTemplates.length),
          note: "Current template count from the existing registry."
        },
        {
          label: "Manager",
          value: "Coming soon",
          note: "Add owner-only template controls here later."
        },
        {
          label: "Quality checks",
          value: "Coming soon",
          note: "Reserve this page for template QA and rollout status."
        }
      ]}
      description="Administrative space for future template operations and rollout controls."
      title="Templates manager"
    />
  );
}
