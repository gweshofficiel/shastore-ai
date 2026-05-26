import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";

export function AccessDeniedSection({
  description = "This section is restricted for your current workspace role.",
  message = "You do not have permission to access this section.",
  title = "Access denied"
}: {
  description?: string;
  message?: string;
  title?: string;
}) {
  return (
    <div className="grid gap-6 lg:gap-8">
      <PageHeader description={description} title={title} />
      <Card className="border-amber-200 bg-amber-50 p-5">
        <p className="text-sm font-bold text-amber-800">{message}</p>
      </Card>
    </div>
  );
}
