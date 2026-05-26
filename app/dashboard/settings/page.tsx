import { PageHeader } from "@/components/dashboard/page-header";
import { AccountIdCard } from "@/components/account/account-id-card";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  accountProfileUnavailableMessage,
  getOrCreateAccountProfile
} from "@/lib/account-profiles";
import { createClient } from "@/lib/supabase/server";
import { getUserPrimaryWorkspaceId, getUserWorkspaceRole, hasPermission } from "@/lib/permissions/rbac";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const workspaceId = user ? await getUserPrimaryWorkspaceId(supabase, user.id) : null;
  const role = user && workspaceId ? await getUserWorkspaceRole(supabase, workspaceId, user.id) : null;
  const canManageCommerce = hasPermission(role, "can_manage_shipping");
  const account = await getOrCreateAccountProfile("user");

  return (
    <div className="grid gap-8">
      <PageHeader
        description="Keep account and default brand settings ready for future landing page creation."
        title="Settings"
      />
      <AccountIdCard account={account} unavailableMessage={accountProfileUnavailableMessage()} />
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
      <Card className="max-w-2xl">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
          Commerce Operations
        </p>
        <h2 className="mt-3 text-2xl font-black tracking-[-0.03em] text-ink">
          Business policies and fulfillment
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          Configure seller business details, policies, countries, shipping, and delivery
          agents without changing checkout, payments, storefronts, or billing.
        </p>
        {canManageCommerce ? (
          <div className="mt-5 flex flex-wrap gap-3">
            <ButtonLink href="/dashboard/settings/commerce" variant="secondary">
              Commerce settings
            </ButtonLink>
            <ButtonLink href="/dashboard/shipping" variant="secondary">
              Shipping
            </ButtonLink>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
