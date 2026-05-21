import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { saveCommercePaymentSettings } from "@/lib/commerce/actions";
import {
  commerceMigrationMessage,
  getCommercePaymentSettings
} from "@/lib/commerce/data";

export const dynamic = "force-dynamic";

function Toggle({
  checked,
  description,
  disabled = false,
  label,
  name
}: {
  checked: boolean;
  description: string;
  disabled?: boolean;
  label: string;
  name: string;
}) {
  return (
    <label className="flex items-start gap-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
      <input
        className="mt-1 h-5 w-5 rounded border-slate-300 text-ink"
        defaultChecked={checked}
        disabled={disabled}
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
        description="Configure seller-owned buyer payment methods. These settings are separate from SHASTORE AI platform billing."
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
              Manual payments
            </p>
            <h2 className="mt-3 text-2xl font-black tracking-[-0.03em] text-ink">
              Offline buyer payments
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Let buyers place orders that the seller collects manually outside SHASTORE AI.
            </p>
            <div className="mt-5 grid gap-3">
              <Toggle
                checked={current?.cod_enabled ?? true}
                description="Allow customers to submit orders and pay when delivered."
                label="Cash on Delivery"
                name="codEnabled"
              />
            </div>
          </Card>

          <Card className="p-6 lg:p-8">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
              WhatsApp orders
            </p>
            <h2 className="mt-3 text-2xl font-black tracking-[-0.03em] text-ink">
              Seller WhatsApp routing
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Store a default seller WhatsApp number for future checkout integrations.
            </p>
            <div className="mt-5 grid gap-4">
              <Toggle
                checked={current?.whatsapp_orders_enabled ?? true}
                description="Route order intent through WhatsApp CTAs and messages."
                label="WhatsApp Orders"
                name="whatsappOrdersEnabled"
              />
              <Input
                defaultValue={current?.default_whatsapp_number ?? ""}
                id="defaultWhatsappNumber"
                label="Default WhatsApp number"
                name="defaultWhatsappNumber"
                placeholder="+1 555 000 0000"
              />
            </div>
          </Card>
        </div>

        <Card className="p-6 lg:p-8">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
            Online payments coming soon
          </p>
          <h2 className="mt-3 text-2xl font-black tracking-[-0.03em] text-ink">
            Seller connection placeholders
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            These toggles prepare each seller account for future buyer checkout. No real
            payment credentials or secret keys are stored here.
          </p>
          <div className="mt-5 grid gap-3 lg:grid-cols-3">
            <Toggle
              checked={current?.stripe_seller_enabled ?? false}
              description="Placeholder for a future seller-owned Stripe connection."
              label="Stripe seller connection"
              name="stripeSellerEnabled"
            />
            <Toggle
              checked={current?.paypal_seller_enabled ?? false}
              description="Placeholder for a future seller-owned PayPal merchant connection."
              label="PayPal seller connection"
              name="paypalSellerEnabled"
            />
            <Toggle
              checked={current?.crypto_enabled ?? false}
              description="Placeholder for future seller-managed crypto payment instructions."
              label="Crypto payments"
              name="cryptoEnabled"
            />
          </div>
          <div className="mt-5 rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-800">
            Buyer checkout is not implemented for these online methods yet. Platform
            billing Stripe credentials are never used for seller payments.
          </div>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[1fr_0.85fr]">
          <Card className="p-6 lg:p-8">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
              Payment instructions
            </p>
            <h2 className="mt-3 text-2xl font-black tracking-[-0.03em] text-ink">
              Buyer-facing notes
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Save seller-specific instructions for manual payments or future checkout displays.
            </p>
            <div className="mt-5">
              <Textarea
                defaultValue={current?.payment_instructions ?? ""}
                id="paymentInstructions"
                label="Payment instructions"
                name="paymentInstructions"
                placeholder="Example: We confirm WhatsApp orders before delivery. Cash is collected by the courier."
              />
            </div>
          </Card>

          <Card className="p-6 lg:p-8">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
              Separation guardrail
            </p>
            <h2 className="mt-3 text-2xl font-black tracking-[-0.03em] text-ink">
              Client payments only
            </h2>
            <div className="mt-5 grid gap-3 text-sm leading-6 text-muted">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-muted">
                These settings belong to the authenticated seller account and are ready for
                future checkout integration.
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-muted">
                No platform billing subscriptions, admin billing, or platform Stripe checkout
                code is used by this page.
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
