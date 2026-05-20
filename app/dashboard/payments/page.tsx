import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { saveCommercePaymentSettings } from "@/lib/commerce/actions";
import {
  commerceMigrationMessage,
  getCommercePaymentSettings
} from "@/lib/commerce/data";

export const dynamic = "force-dynamic";

function Toggle({
  checked,
  description,
  label,
  name
}: {
  checked: boolean;
  description: string;
  label: string;
  name: string;
}) {
  return (
    <label className="flex items-start gap-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
      <input
        className="mt-1 h-5 w-5 rounded border-slate-300 text-ink"
        defaultChecked={checked}
        name={name}
        type="checkbox"
      />
      <span>
        <span className="block font-bold text-ink">{label}</span>
        <span className="mt-1 block text-sm leading-6 text-muted">{description}</span>
      </span>
    </label>
  );
}

export default async function PaymentsPage({
  searchParams
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const params = await searchParams;
  const settings = await getCommercePaymentSettings();
  const current = settings.items;

  return (
    <div className="grid gap-6 lg:gap-8">
      <PageHeader
        description="Configure the shared payment foundation for landing pages and stores. Full Stripe and PayPal automation is intentionally left as a placeholder."
        title="Payments"
      />
      {!settings.ready ? (
        <Card className="border-blue-200 bg-blue-50 p-5">
          <p className="text-sm font-bold text-blue-800">
            {commerceMigrationMessage()}
          </p>
        </Card>
      ) : null}
      {params.saved ? (
        <Card className="border-emerald-200 bg-emerald-50 p-5">
          <p className="text-sm font-bold text-emerald-700">
            Payment settings saved.
          </p>
        </Card>
      ) : null}
      {params.error ? (
        <Card className="border-red-200 bg-red-50 p-5">
          <p className="text-sm font-bold text-red-700">{params.error}</p>
        </Card>
      ) : null}
      <form action={saveCommercePaymentSettings} className="grid gap-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-6 lg:p-8">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
              Checkout methods
            </p>
            <div className="mt-5 grid gap-3">
              <Toggle
                checked={current?.cod_enabled ?? true}
                description="Allow customers to submit orders and pay when delivered."
                label="Cash on Delivery"
                name="codEnabled"
              />
              <Toggle
                checked={current?.whatsapp_orders_enabled ?? true}
                description="Route order intent through WhatsApp CTAs and messages."
                label="WhatsApp Orders"
                name="whatsappOrdersEnabled"
              />
              <Toggle
                checked={current?.stripe_enabled ?? false}
                description="Placeholder for future Stripe Connect or account linking."
                label="Stripe Orders"
                name="stripeEnabled"
              />
              <Toggle
                checked={current?.paypal_enabled ?? false}
                description="Placeholder for future PayPal merchant connection."
                label="PayPal Orders"
                name="paypalEnabled"
              />
            </div>
          </Card>
          <Card className="p-6 lg:p-8">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
              Connection placeholders
            </p>
            <div className="mt-5 grid gap-4">
              <Input
                defaultValue={current?.stripe_account_label ?? ""}
                id="stripeAccountLabel"
                label="Stripe account label"
                name="stripeAccountLabel"
                placeholder="Stripe connection placeholder"
              />
              <Input
                defaultValue={current?.paypal_account_label ?? ""}
                id="paypalAccountLabel"
                label="PayPal account label"
                name="paypalAccountLabel"
                placeholder="PayPal connection placeholder"
              />
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-muted">
                No live payment automation is added here. These settings prepare the
                user dashboard and shared commerce model for later integrations.
              </div>
            </div>
          </Card>
        </div>
        <div>
          <Button type="submit">Save payment settings</Button>
        </div>
      </form>
    </div>
  );
}
