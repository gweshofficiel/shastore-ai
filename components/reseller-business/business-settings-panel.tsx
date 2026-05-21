import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { saveResellerBusinessSettings } from "@/lib/reseller-business/actions";
import type { ResellerBusinessSettings } from "@/lib/reseller-business/types";

export function ResellerBusinessSettingsPanel({
  settings
}: {
  settings: ResellerBusinessSettings | null;
}) {
  return (
    <form action={saveResellerBusinessSettings} className="grid gap-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6 lg:p-8">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
            Reseller Business
          </p>
          <h2 className="mt-3 text-2xl font-black tracking-[-0.03em] text-ink">
            Business and support details
          </h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Input
              defaultValue={settings?.business_name ?? ""}
              id="businessName"
              label="Reseller business name"
              name="businessName"
              placeholder="Acme Store Studio"
            />
            <Input
              defaultValue={settings?.support_email ?? ""}
              id="supportEmail"
              label="Support email"
              name="supportEmail"
              placeholder="support@example.com"
              type="email"
            />
            <Input
              defaultValue={settings?.support_whatsapp ?? ""}
              id="supportWhatsapp"
              label="Support WhatsApp"
              name="supportWhatsapp"
              placeholder="+1 555 000 0000"
            />
            <Input
              defaultValue={settings?.business_website ?? ""}
              id="businessWebsite"
              label="Business website"
              name="businessWebsite"
              placeholder="https://..."
            />
          </div>
          <div className="mt-4">
            <Textarea
              defaultValue={settings?.invoice_notes ?? ""}
              id="invoiceNotes"
              label="Invoice notes"
              name="invoiceNotes"
              placeholder="Notes to include when reseller invoice PDFs are generated later."
            />
          </div>
        </Card>

        <Card className="p-6 lg:p-8">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
            Store Delivery Settings
          </p>
          <h2 className="mt-3 text-2xl font-black tracking-[-0.03em] text-ink">
            How buyers receive stores
          </h2>
          <label className="mt-5 grid min-w-0 gap-2 text-sm font-semibold text-ink">
            Delivery method to client
            <select
              className="h-12 min-w-0 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink shadow-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
              defaultValue={settings?.store_delivery_method ?? "manual"}
              name="storeDeliveryMethod"
            >
              <option value="manual">Manual handoff</option>
              <option value="email_placeholder">Email delivery placeholder</option>
              <option value="whatsapp_placeholder">WhatsApp delivery placeholder</option>
              <option value="pdf_access_placeholder">PDF access file placeholder</option>
              <option value="ownership_transfer_placeholder">Future ownership transfer flow</option>
            </select>
          </label>
          <div className="mt-5 grid gap-3">
            {[
              ["sendStoreAccessEmail", "Send store access by email placeholder", settings?.send_store_access_email],
              ["sendStoreAccessWhatsapp", "Send store access by WhatsApp placeholder", settings?.send_store_access_whatsapp],
              ["generatePdfAccessFile", "Generate PDF access file placeholder", settings?.generate_pdf_access_file],
              ["generateInvoicePdf", "Generate invoice PDF placeholder", settings?.generate_invoice_pdf]
            ].map(([name, label, checked]) => (
              <label
                className="flex items-start gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-ink"
                key={String(name)}
              >
                <input
                  className="mt-1 h-4 w-4"
                  defaultChecked={Boolean(checked)}
                  name={String(name)}
                  type="checkbox"
                />
                {label}
              </label>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6 lg:p-8">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
            Buyer Thank-you Message
          </p>
          <Textarea
            defaultValue={settings?.buyer_thank_you_message ?? ""}
            id="buyerThankYouMessage"
            label="Thank-you message"
            name="buyerThankYouMessage"
            placeholder="Thanks for purchasing this ready-made store. We will send your access details shortly."
          />
        </Card>
        <Card className="p-6 lg:p-8">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
            Client Onboarding
          </p>
          <Textarea
            defaultValue={settings?.client_onboarding_instructions ?? ""}
            id="clientOnboardingInstructions"
            label="Client onboarding instructions"
            name="clientOnboardingInstructions"
            placeholder="Explain how clients receive login/access info, setup steps, revision process, or takeover instructions."
          />
        </Card>
      </div>

      <Card className="border-blue-200 bg-blue-50 p-5">
        <p className="text-sm font-semibold leading-6 text-blue-900">
          Future expansion points: store ownership transfer, automatic login credential
          delivery, PDF invoice generation, PDF access file generation, and email/WhatsApp
          notifications can attach here. No physical shipping, couriers, pickup, or local
          delivery are part of reseller operations.
        </p>
      </Card>

      <div>
        <Button type="submit">Save reseller business settings</Button>
      </div>
    </form>
  );
}
