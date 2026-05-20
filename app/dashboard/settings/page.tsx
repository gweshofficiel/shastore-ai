import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function SettingsPage() {
  return (
    <div className="grid gap-8">
      <PageHeader
        description="Keep account and default brand settings ready for future landing page creation."
        title="Settings"
      />
      <Card className="max-w-2xl">
        <form className="grid gap-4">
          <Input id="name" label="Full name" placeholder="Your name" />
          <Input id="brand" label="Default brand color" type="color" defaultValue="#0f172a" />
          <Input id="whatsapp" label="Default WhatsApp number" placeholder="+15551234567" />
          <Button className="w-fit" type="button">
            Save settings
          </Button>
        </form>
      </Card>
    </div>
  );
}
