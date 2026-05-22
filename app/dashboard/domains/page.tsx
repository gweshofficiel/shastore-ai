import { Globe2, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  connectStoreCustomDomain,
  markStoreDomainVerificationPending,
  setPrimaryStoreDomain,
  setStoreSubdomain
} from "@/lib/store-domain-actions";
import {
  getStoreDomainsDashboardData,
  storeDomainsMigrationMessage
} from "@/lib/store-domains";

const statusMessages: Record<string, string> = {
  "custom-domain-saved": "Custom domain prepared for DNS verification.",
  "domain-not-found": "Domain record was not found for this store.",
  "duplicate-domain": "That domain is already connected to another store.",
  "invalid-domain": "Enter a valid custom hostname, for example shop.example.com.",
  "invalid-subdomain": "Choose a subdomain with at least 3 valid characters.",
  "missing-domain": "Choose a domain record first.",
  "missing-store": "Choose a claimed store first.",
  "not-authorized": "You can only manage domains for stores you own or administer.",
  "primary-updated": "Primary domain updated.",
  "reserved-subdomain": "That subdomain is reserved by SHASTORE AI.",
  "save-failed": "Domain settings could not be saved yet. Confirm the migration is applied.",
  "subdomain-saved": "Subdomain connected and marked as the primary store domain.",
  "use-subdomain-form": "Use the subdomain form for SHASTORE AI subdomains.",
  "verification-pending": "Verification was queued for this domain.",
  "verify-failed": "Verification status could not be updated."
};

const badgeStyles: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700",
  failed: "bg-red-50 text-red-700",
  not_configured: "bg-slate-100 text-muted",
  pending: "bg-amber-50 text-amber-700",
  ready: "bg-emerald-50 text-emerald-700",
  revoked: "bg-red-50 text-red-700",
  verified: "bg-emerald-50 text-emerald-700"
};

function StatusBadge({ label, value }: { label: string; value: string }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.16em] ${
        badgeStyles[value] ?? "bg-slate-100 text-muted"
      }`}
    >
      {label} {value.replace("_", " ")}
    </span>
  );
}

export const dynamic = "force-dynamic";

export default async function DomainsPage({
  searchParams
}: {
  searchParams: Promise<{ domains?: string; storeId?: string }>;
}) {
  const params = await searchParams;
  const data = await getStoreDomainsDashboardData(params.storeId);
  const primaryDomain = data.domains.find((domain) => domain.is_primary);
  const message = params.domains ? statusMessages[params.domains] : null;

  return (
    <div className="grid gap-6 lg:gap-8">
      <PageHeader
        description="Production-safe domain foundation for buyer-owned stores: SHASTORE subdomains, future custom domains, verification state, and hostname resolution."
        title="Store Domains"
      />
      {!data.ready ? (
        <Card className="border-blue-200 bg-blue-50 p-5">
          <p className="text-sm font-bold text-blue-800">
            {storeDomainsMigrationMessage()}
          </p>
        </Card>
      ) : null}
      {message ? (
        <Card className="border-slate-200 bg-white p-5">
          <p className="text-sm font-bold text-ink">{message}</p>
        </Card>
      ) : null}
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="p-6 lg:p-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50">
            <Globe2 className="h-5 w-5 text-ink" />
          </div>
          <h2 className="mt-5 text-2xl font-black tracking-[-0.03em] text-ink">
            Select store
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Domains are scoped to claimed buyer-owned stores. Existing public
            storefront routes keep working while hostnames are prepared.
          </p>
          {data.stores.length ? (
            <form className="mt-6">
              <label className="grid min-w-0 gap-2 text-sm font-semibold text-ink" htmlFor="storeId">
                <span>Active store</span>
                <select
                  className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink shadow-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                  defaultValue={data.activeStore?.id}
                  id="storeId"
                  name="storeId"
                >
                  {data.stores.map((store) => (
                    <option key={store.id} value={store.id}>
                      {store.store_name ?? store.internal_slug ?? store.id}
                    </option>
                  ))}
                </select>
              </label>
              <Button className="mt-4" type="submit" variant="secondary">
                Switch store
              </Button>
            </form>
          ) : (
            <p className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm font-semibold text-muted">
              Claim a store before connecting domains.
            </p>
          )}
        </Card>
        <Card className="p-6 lg:p-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50">
            <ShieldCheck className="h-5 w-5 text-emerald-700" />
          </div>
          <h2 className="mt-5 text-2xl font-black tracking-[-0.03em] text-ink">
            Primary domain
          </h2>
          {primaryDomain ? (
            <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-2xl font-black tracking-[-0.04em] text-ink">
                {primaryDomain.hostname}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <StatusBadge label="DNS" value={primaryDomain.verification_status} />
                <StatusBadge label="SSL" value={primaryDomain.ssl_status} />
              </div>
              <p className="mt-4 text-sm leading-6 text-muted">
                Hostname resolver support is prepared for this domain once DNS
                and SSL are verified in production.
              </p>
            </div>
          ) : (
            <p className="mt-5 rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm font-semibold text-muted">
              No primary domain yet. Set a SHASTORE subdomain or mark a custom
              domain as primary.
            </p>
          )}
        </Card>
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="p-6 lg:p-8">
          <h2 className="text-xl font-black tracking-[-0.02em] text-ink">
            Set SHASTORE subdomain
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Creates a verified hostname like <strong>brand.{data.domainBase}</strong>.
            Reserved platform names are blocked.
          </p>
          <form action={setStoreSubdomain} className="mt-6 grid gap-4">
            <input name="storeId" type="hidden" value={data.activeStore?.id ?? ""} />
            <Input
              id="storeSubdomain"
              label="Preferred subdomain"
              name="subdomain"
              placeholder="my-brand"
              required
            />
            <Button className="w-fit" disabled={!data.activeStore || !data.ready} type="submit">
              Set subdomain
            </Button>
          </form>
        </Card>
        <Card className="p-6 lg:p-8">
          <h2 className="text-xl font-black tracking-[-0.02em] text-ink">
            Connect custom domain
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Stores custom hostnames for future DNS and SSL verification without
            changing checkout, products, or publishing systems.
          </p>
          <form action={connectStoreCustomDomain} className="mt-6 grid gap-4">
            <input name="storeId" type="hidden" value={data.activeStore?.id ?? ""} />
            <Input
              id="customDomain"
              label="Custom domain"
              name="customDomain"
              placeholder="shop.example.com"
              required
            />
            <label className="flex items-center gap-3 text-sm font-bold text-ink">
              <input className="h-4 w-4 rounded border-slate-300" name="makePrimary" type="checkbox" />
              Make primary after verification is ready
            </label>
            <Button className="w-fit" disabled={!data.activeStore || !data.ready} type="submit">
              Connect domain
            </Button>
          </form>
        </Card>
      </div>
      <Card className="p-6 lg:p-8">
        <h2 className="text-xl font-black tracking-[-0.02em] text-ink">
          Store domain records
        </h2>
        <div className="mt-5 grid gap-3">
          {data.domains.length ? (
            data.domains.map((domain) => (
              <div
                className="rounded-3xl border border-slate-200 bg-slate-50 p-4"
                key={domain.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="font-bold text-ink">{domain.hostname}</p>
                    <p className="mt-1 text-sm text-muted">
                      {domain.domain_type === "subdomain"
                        ? `Subdomain: ${domain.subdomain}`
                        : `Custom domain: ${domain.custom_domain}`}
                    </p>
                  </div>
                  {domain.is_primary ? (
                    <span className="rounded-full bg-ink px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-white">
                      Primary
                    </span>
                  ) : null}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <StatusBadge label="Verify" value={domain.verification_status} />
                  <StatusBadge label="DNS" value={domain.dns_status} />
                  <StatusBadge label="SSL" value={domain.ssl_status} />
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  {!domain.is_primary ? (
                    <form action={setPrimaryStoreDomain}>
                      <input name="storeId" type="hidden" value={domain.store_instance_id} />
                      <input name="domainId" type="hidden" value={domain.id} />
                      <Button type="submit" variant="secondary">
                        Make primary
                      </Button>
                    </form>
                  ) : null}
                  {domain.verification_status !== "verified" ? (
                    <form action={markStoreDomainVerificationPending}>
                      <input name="storeId" type="hidden" value={domain.store_instance_id} />
                      <input name="domainId" type="hidden" value={domain.id} />
                      <Button type="submit" variant="ghost">
                        Queue verification
                      </Button>
                    </form>
                  ) : null}
                </div>
              </div>
            ))
          ) : (
            <p className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm font-semibold text-muted">
              No domains connected for this store yet.
            </p>
          )}
        </div>
      </Card>
      <Card className="p-6 lg:p-8">
        <h2 className="text-xl font-black tracking-[-0.02em] text-ink">
          Hostname routing preparation
        </h2>
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {[
            "localhost keeps using /store/[slug] safely during development.",
            "Production subdomains resolve through verified store_domains records.",
            "Custom domains are stored now and can be activated when DNS/SSL automation is connected."
          ].map((step, index) => (
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4" key={step}>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                Layer {index + 1}
              </p>
              <p className="mt-2 text-sm font-semibold leading-6 text-ink">{step}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
