import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { saveCommerceOperationsSettings } from "@/lib/commerce-operations/actions";
import type {
  CommerceOperationsScope,
  SellerCommerceSettings
} from "@/lib/commerce-operations/types";

function listValue(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item)).join("\n") : "";
}

export function CommerceSettingsPanel({
  returnPath,
  scope,
  settings
}: {
  returnPath: string;
  scope: CommerceOperationsScope;
  settings: SellerCommerceSettings | null;
}) {
  return (
    <form action={saveCommerceOperationsSettings} className="grid gap-6">
      <input name="scope" type="hidden" value={scope} />
      <input name="returnTo" type="hidden" value={returnPath} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6 lg:p-8">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
            Business Information
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Input
              defaultValue={settings?.business_name ?? ""}
              id="businessName"
              label="Business name"
              name="businessName"
              placeholder="Your store company"
            />
            <Input
              defaultValue={settings?.business_email ?? ""}
              id="businessEmail"
              label="Business email"
              name="businessEmail"
              placeholder="support@example.com"
              type="email"
            />
            <Input
              defaultValue={settings?.support_phone ?? ""}
              id="supportPhone"
              label="Support phone"
              name="supportPhone"
              placeholder="+1 555 000 0000"
            />
            <Input
              defaultValue={settings?.support_whatsapp ?? ""}
              id="supportWhatsapp"
              label="Support WhatsApp"
              name="supportWhatsapp"
              placeholder="+1 555 000 0000"
            />
          </div>
          <div className="mt-4">
            <Textarea
              defaultValue={settings?.business_address ?? ""}
              id="businessAddress"
              label="Business address"
              name="businessAddress"
              placeholder="Street, city, country"
            />
          </div>
        </Card>

        <Card className="p-6 lg:p-8">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
            Checkout Preferences
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Input
              defaultValue={settings?.currency ?? "USD"}
              id="currency"
              label="Currency"
              name="currency"
              placeholder="USD"
            />
            <Input
              defaultValue={settings?.timezone ?? "UTC"}
              id="timezone"
              label="Timezone"
              name="timezone"
              placeholder="UTC"
            />
            <label className="grid min-w-0 gap-2 text-sm font-semibold text-ink md:col-span-2">
              Order confirmation mode
              <select
                className="h-12 min-w-0 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink shadow-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                defaultValue={settings?.order_confirmation_mode ?? "manual"}
                name="orderConfirmationMode"
              >
                <option value="manual">Manual confirmation</option>
                <option value="whatsapp">WhatsApp confirmation</option>
                <option value="email_placeholder">Email automation placeholder</option>
                <option value="auto_placeholder">Automatic confirmation placeholder</option>
              </select>
            </label>
          </div>
          <label className="mt-5 flex items-start gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-ink">
            <input
              className="mt-1 h-4 w-4"
              defaultChecked={settings?.taxes_enabled ?? false}
              name="taxesEnabled"
              type="checkbox"
            />
            Enable taxes placeholder
          </label>
          <div className="mt-4">
            <Textarea
              defaultValue={settings?.tax_notes ?? ""}
              id="taxNotes"
              label="Taxes placeholder notes"
              name="taxNotes"
              placeholder="Future VAT/GST setup, tax registration notes, or regional tax rules."
            />
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <Card className="p-6 lg:p-8">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
            Supported Countries
          </p>
          <div className="mt-5">
            <Textarea
              defaultValue={listValue(settings?.supported_countries)}
              id="supportedCountries"
              label="Countries"
              name="supportedCountries"
              placeholder="United States&#10;United Arab Emirates&#10;Morocco"
            />
          </div>
        </Card>
        <Card className="p-6 lg:p-8">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
            Store Policies
          </p>
          <div className="mt-5 grid gap-4">
            <Textarea
              defaultValue={settings?.return_policy ?? ""}
              id="returnPolicy"
              label="Return policy"
              name="returnPolicy"
              placeholder="Describe returns, exchanges, and refunds."
            />
            <Textarea
              defaultValue={settings?.shipping_policy ?? ""}
              id="shippingPolicy"
              label="Shipping policy"
              name="shippingPolicy"
              placeholder="Describe delivery regions, timelines, and shipping fees."
            />
            <Textarea
              defaultValue={settings?.privacy_policy ?? ""}
              id="privacyPolicy"
              label="Privacy policy"
              name="privacyPolicy"
              placeholder="Describe how customer data is handled."
            />
          </div>
        </Card>
      </div>

      <div>
        <Button type="submit">Save commerce settings</Button>
      </div>
    </form>
  );
}
