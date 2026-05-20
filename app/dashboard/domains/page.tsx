import { Globe2 } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  connectCustomDomain,
  reserveFreeSubdomain,
  verifyDomainAction
} from "@/lib/domains/actions";
import {
  domainsMigrationMessage,
  getDomainsDashboardData
} from "@/lib/domains/data";

const dnsSteps = [
  "Reserve an automatic SHASTORE subdomain for every published page.",
  "Store custom domain requests with DNS verification tokens.",
  "Verify DNS and attach domains through the HOSTINSH API when credentials are configured."
];

export const dynamic = "force-dynamic";

export default async function DomainsPage({
  searchParams
}: {
  searchParams: Promise<{ saved?: string; error?: string; verified?: string }>;
}) {
  const params = await searchParams;
  const domains = await getDomainsDashboardData();

  return (
    <div className="grid gap-6 lg:gap-8">
      <PageHeader
        description="Shared domain foundation for landing pages and stores: free subdomains, custom domain placeholders, and publication hostnames."
        title="Domains"
      />
      {!domains.ready ? (
        <Card className="border-blue-200 bg-blue-50 p-5">
          <p className="text-sm font-bold text-blue-800">
            {domainsMigrationMessage()}
          </p>
        </Card>
      ) : null}
      {params.saved ? (
        <Card className="border-emerald-200 bg-emerald-50 p-5">
          <p className="text-sm font-bold text-emerald-700">
            Domain mapping saved.
          </p>
        </Card>
      ) : null}
      {params.error ? (
        <Card className="border-red-200 bg-red-50 p-5">
          <p className="text-sm font-bold text-red-700">{params.error}</p>
        </Card>
      ) : null}
      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="p-6 lg:p-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50">
            <Globe2 className="h-5 w-5 text-ink" />
          </div>
          <h2 className="mt-5 text-2xl font-black tracking-[-0.03em] text-ink">
            Reserve a free subdomain
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Automatically generate a collision-safe SHASTORE hostname like
            brand.shastore.ai and map it to a published landing page or store.
          </p>
          <form action={reserveFreeSubdomain} className="mt-6 grid gap-4">
            <label className="grid min-w-0 gap-2 text-sm font-semibold text-ink" htmlFor="sourceType">
              <span>Source type</span>
              <select
                className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink shadow-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                id="sourceType"
                name="sourceType"
              >
                <option value="landing">Landing page</option>
                <option value="store">Store</option>
              </select>
            </label>
            <Input
              id="sourceSlug"
              label="Source slug"
              name="sourceSlug"
              placeholder="published-page-or-store-slug"
            />
            <Input
              id="freeSubdomain"
              label="Preferred subdomain"
              name="freeSubdomain"
              placeholder="my-brand"
            />
            <Button type="submit">Reserve subdomain</Button>
          </form>
        </Card>
        <Card className="p-6 lg:p-8">
          <h2 className="text-xl font-black tracking-[-0.02em] text-ink">
            Connect a custom domain
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Prepare DNS verification and HOSTINSH-ready records without requiring live API credentials yet.
          </p>
          <form action={connectCustomDomain} className="mt-6 grid gap-4">
            <label className="grid min-w-0 gap-2 text-sm font-semibold text-ink" htmlFor="customSourceType">
              <span>Source type</span>
              <select
                className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink shadow-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                id="customSourceType"
                name="sourceType"
              >
                <option value="landing">Landing page</option>
                <option value="store">Store</option>
              </select>
            </label>
            <Input
              id="customSourceSlug"
              label="Source slug"
              name="sourceSlug"
              placeholder="published-page-or-store-slug"
            />
            <Input
              id="customDomain"
              label="Custom domain"
              name="customDomain"
              placeholder="store.client.com"
            />
            <Button type="submit">Prepare DNS verification</Button>
          </form>
        </Card>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6 lg:p-8">
          <h2 className="text-xl font-black tracking-[-0.02em] text-ink">
            Publication hostnames
          </h2>
          <div className="mt-5 grid gap-3">
            {domains.domains.length ? (
              domains.domains.map((domain) => (
                <div
                  className="rounded-3xl border border-slate-200 bg-slate-50 p-4"
                  key={domain.id}
                >
                  <p className="font-bold text-ink">{domain.hostname}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-muted">
                      {domain.kind}
                    </span>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-muted">
                      {domain.status}
                    </span>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-muted">
                      SSL {domain.ssl_status}
                    </span>
                  </div>
                  {domain.status !== "verified" ? (
                    <form action={verifyDomainAction} className="mt-4">
                      <input name="domainId" type="hidden" value={domain.id} />
                      <Button type="submit" variant="secondary">Check DNS</Button>
                    </form>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="text-sm leading-6 text-muted">
                Prepared domain records for landing pages and stores will appear here.
              </p>
            )}
          </div>
        </Card>
        <Card className="p-6 lg:p-8">
          <h2 className="text-xl font-black tracking-[-0.02em] text-ink">
            Existing publications
          </h2>
          <div className="mt-5 grid gap-3">
            {domains.publicationHosts.length ? (
              domains.publicationHosts.slice(0, 8).map((publication) => (
                <div
                  className="rounded-3xl border border-slate-200 bg-slate-50 p-4"
                  key={publication.id}
                >
                  <p className="font-bold text-ink">
                    https://{publication.hostname}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {publication.publication_url} · {publication.status}
                  </p>
                </div>
              ))
            ) : null}
            {[...domains.landingPublications, ...domains.storePublications]
              .slice(0, 8)
              .map((publication) => (
                <div
                  className="rounded-3xl border border-slate-200 bg-slate-50 p-4"
                  key={publication.id}
                >
                  <p className="font-bold text-ink">
                    {"slug" in publication ? `/store/${publication.slug}` : publication.url}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {"hostname" in publication && publication.hostname
                      ? publication.hostname
                      : "Default SHASTORE route"}
                  </p>
                </div>
              ))}
            {!domains.landingPublications.length &&
            !domains.storePublications.length &&
            !domains.publicationHosts.length ? (
              <p className="text-sm leading-6 text-muted">
                Publish landing pages or stores to see domain-ready routes here.
              </p>
            ) : null}
          </div>
        </Card>
      </div>
      <Card className="p-6 lg:p-8">
        <h2 className="text-xl font-black tracking-[-0.02em] text-ink">
          DNS and HOSTINSH foundation
        </h2>
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {dnsSteps.map((step, index) => (
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4" key={step}>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                Step {index + 1}
              </p>
              <p className="mt-2 text-sm font-semibold leading-6 text-ink">{step}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 grid gap-3">
          {domains.dnsVerifications.map((verification) => (
            <div
              className="rounded-3xl border border-slate-200 bg-white p-4 text-sm"
              key={verification.id}
            >
              <p className="font-black text-ink">{verification.hostname}</p>
              <p className="mt-2 text-muted">
                Add {verification.record_type} record{" "}
                <code>{verification.record_name}</code> with value{" "}
                <code>{verification.record_value}</code>
              </p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
