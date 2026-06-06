import { CheckCircle2, Copy, Globe2, ShieldCheck } from "lucide-react";
import { UpgradeRequiredCard } from "@/components/billing/UpgradeRequiredCard";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button, ButtonLink } from "@/components/ui/button";
import {
  activateVerifiedStoreDomain,
  attachCustomDomain,
  createStoreSubdomain,
  markStoreDomainVerificationPending,
  prepareDomainOrderDraft,
  removeDomain,
  setPrimaryDomain
} from "@/lib/store-domain-actions";
import {
  getStoreDomainsDashboardData,
  storeDomainsMigrationMessage
} from "@/lib/store-domains";
import { getCurrentUserSubscriptionAccess } from "@/lib/billing/access";
import { getBillingPlan } from "@/lib/billing/plans";
import {
  canUseCustomDomains,
  getRemainingDomainQuota
} from "@/lib/billing/domain-access";
import { getRecommendedUpgrade } from "@/lib/billing/upgrade";
import {
  allDomainExtensions,
  buildDomainCommercePreview,
  defaultDomainExtensions
} from "@/lib/domains/domain-commerce";
import {
  domainExtensionCatalog,
  topDomainExtensions
} from "@/lib/domains/extension-catalog";
import { calculateDomainLineCreditQuote } from "@/lib/domains/domain-credit";
import { formatDomainMoney } from "@/lib/domains/domain-pricing";
import { getUserPrimaryWorkspaceId, getUserWorkspaceRole, hasPermission } from "@/lib/permissions/rbac";
import { createClient } from "@/lib/supabase/server";

const statusMessages: Record<string, string> = {
  "activation-failed": "Verified domain could not be activated.",
  "custom-domain-saved": "Custom domain prepared for DNS verification.",
  "delete-failed": "Domain record could not be deleted.",
  "domain-not-found": "Domain record was not found for this store.",
  "domain-activated": "Verified domain activated for this store.",
  "domain-deleted": "Domain record deleted.",
  "domain-order-draft-failed": "Domain order draft could not be prepared.",
  "domain-order-draft-prepared": "Draft prepared. Awaiting payment / future activation.",
  "duplicate-domain": "That domain is already connected to another store.",
  "invalid-domain": "Enter a valid custom hostname, for example shop.example.com.",
  "invalid-subdomain": "Choose a subdomain with at least 3 valid characters.",
  "limit-reached": "Your current plan has reached its domain limit.",
  "missing-domain": "Choose a domain record first.",
  "missing-store": "Choose a claimed store first.",
  "not-verified": "Domain must be verified before it can be activated.",
  "not-authorized": "You can only manage domains for stores you own or administer.",
  "primary-updated": "Primary domain updated.",
  "reserved-subdomain": "That subdomain is reserved by SHASTORE AI.",
  "save-failed": "Domain settings could not be saved yet. Confirm the migration is applied.",
  "store-locked": "Store locked due to current subscription limits.",
  "subdomain-saved": "Subdomain connected and marked as the primary store domain.",
  "use-subdomain-form": "Use the subdomain form for SHASTORE AI subdomains.",
  "verification-pending": "Verification was queued for this domain.",
  "verify-failed": "Verification status could not be updated."
};

const successStatuses = new Set([
  "custom-domain-saved",
  "domain-deleted",
  "domain-activated",
  "domain-order-draft-prepared",
  "primary-updated",
  "subdomain-saved",
  "verification-pending"
]);

const badgeStyles: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700",
  draft: "bg-amber-50 text-amber-700",
  failed: "bg-red-50 text-red-700",
  not_configured: "bg-slate-100 text-muted",
  pending: "bg-amber-50 text-amber-700",
  ready: "bg-emerald-50 text-emerald-700",
  revoked: "bg-red-50 text-red-700",
  verified: "bg-emerald-50 text-emerald-700",
  verifying: "bg-blue-50 text-blue-700"
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

function Toast({ status }: { status: string }) {
  const message = statusMessages[status];

  if (!message) {
    return null;
  }

  const isSuccess = successStatuses.has(status);

  return (
    <div
      className={`fixed right-4 top-4 z-50 max-w-sm rounded-3xl border p-4 text-sm font-bold shadow-[0_20px_70px_-45px_rgba(15,23,42,0.9)] ${
        isSuccess
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-red-200 bg-red-50 text-red-700"
      }`}
      role="status"
    >
      {message}
    </div>
  );
}

export const dynamic = "force-dynamic";

function queryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function queryValues(value: string | string[] | undefined) {
  return Array.isArray(value) ? value : value ? [value] : [];
}

function domainsSearchHref(params: {
  domainSearch?: string;
  idnSearch?: string;
  selectedDomain?: string;
  selectAll?: boolean;
  showAll?: boolean;
  storeId?: string;
}) {
  const search = new URLSearchParams();

  if (params.storeId) {
    search.set("storeId", params.storeId);
  }

  if (params.domainSearch) {
    search.set("domainSearch", params.domainSearch);
  }

  if (params.idnSearch) {
    search.set("idnSearch", params.idnSearch);
  }

  if (params.showAll) {
    search.set("viewMoreExtensions", "true");
  }

  if (params.selectedDomain) {
    search.set("selectedDomain", params.selectedDomain);
  }

  const extensions = params.selectAll ? allDomainExtensions() : defaultDomainExtensions();

  for (const extension of extensions) {
    search.append("extensions", extension);
  }

  return `/dashboard/domains?${search.toString()}`;
}

function selectedDomainHref({
  domainName,
  domainSearch,
  extensions,
  idnSearch,
  showAll,
  storeId
}: {
  domainName: string;
  domainSearch: string;
  extensions: string[];
  idnSearch: string;
  showAll: boolean;
  storeId: string;
}) {
  const search = new URLSearchParams();

  if (storeId) {
    search.set("storeId", storeId);
  }

  if (domainSearch) {
    search.set("domainSearch", domainSearch);
  }

  if (idnSearch) {
    search.set("idnSearch", idnSearch);
  }

  if (showAll) {
    search.set("viewMoreExtensions", "true");
  }

  for (const extension of extensions) {
    search.append("extensions", extension);
  }

  search.set("selectedDomain", domainName);

  return `/dashboard/domains?${search.toString()}`;
}

export default async function DomainsPage({
  searchParams
}: {
  searchParams: Promise<{
    checkSubdomain?: string;
    domainSearch?: string;
    domains?: string;
    extensions?: string | string[];
    idnSearch?: string;
    selectedDomain?: string;
    storeId?: string;
    viewMoreExtensions?: string;
  }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const workspaceId = user ? await getUserPrimaryWorkspaceId(supabase, user.id) : null;
  const role = user && workspaceId ? await getUserWorkspaceRole(supabase, workspaceId, user.id) : null;
  const canManageDomainsPermission = hasPermission(role, "manage_domains");

  if (user && !canManageDomainsPermission) {
    console.warn("[permission-denied] domains page denied", {
      permission: "manage_domains",
      role,
      userId: user.id,
      workspaceId
    });

    return (
      <div className="grid gap-6 lg:gap-8">
        <PageHeader
          description="Production-safe domain foundation for buyer-owned stores: SHASTORE subdomains, future custom domains, verification state, and hostname resolution."
          title="Store Domains"
        />
        <Card className="border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-bold text-amber-800">
            You do not have permission to manage domains.
          </p>
        </Card>
      </div>
    );
  }

  const [access, data] = await Promise.all([
    getCurrentUserSubscriptionAccess(),
    getStoreDomainsDashboardData(params.storeId, params.checkSubdomain)
  ]);
  const primaryDomain = data.domains.find((domain) => domain.is_primary);
  const activeStoreId = data.activeStore?.id ?? "";
  const defaultStoreSlug = data.activeStore?.internal_slug ?? data.activeStore?.id ?? "";
  const defaultStoreUrl = defaultStoreSlug ? `/store/${defaultStoreSlug}` : "/store/[store-slug]";
  const domainUpgrade = access
    ? getRecommendedUpgrade({
        blockedFeature: "custom_domains",
        blockedResource: "domains",
        currentPlanId: access.plan.id,
        needsUnlimited: access.plan.id === "pro"
      })
    : null;
  const remainingDomainQuota = access ? getRemainingDomainQuota(access) : null;
  const domainLimitReached =
    Boolean(access) &&
    access?.usage.domainLimit !== null &&
    (remainingDomainQuota ?? 0) <= 0;
  const customDomainsAvailable = access ? canUseCustomDomains(access) : false;
  const domainSearch = queryValue(params.domainSearch);
  const idnSearch = queryValue(params.idnSearch);
  const selectedDomainName = queryValue(params.selectedDomain);
  const selectedExtensions = queryValues(params.extensions);
  const showAllExtensions = params.viewMoreExtensions === "true";
  const visibleExtensions = showAllExtensions
    ? domainExtensionCatalog
    : domainExtensionCatalog.filter((extension) => extension.featured);
  const commercePreview = buildDomainCommercePreview({
    idnSearchTerm: idnSearch,
    plan: access?.plan ?? getBillingPlan("free"),
    searchTerm: domainSearch,
    selectedExtensions
  });
  const hasDomainSearch = Boolean(domainSearch.trim() || idnSearch.trim());
  const currentSubdomain =
    data.domains.find((domain) => domain.domain_type === "subdomain")?.hostname ??
    (defaultStoreSlug ? `${defaultStoreSlug}.${data.domainBase}` : `store-name.${data.domainBase}`);
  const subdomainStatus =
    data.availability.checked
      ? data.availability.status === "available"
        ? "available"
        : "blocked"
      : data.domains.some((domain) => domain.domain_type === "subdomain" && domain.status === "active")
        ? "active"
        : "available";
  const selectedDomainLine =
    commercePreview.pricing.lines.find((line) => line.domainName === selectedDomainName) ??
    commercePreview.pricing.lines[0] ??
    null;
  const selectedDomainCredit = selectedDomainLine
    ? calculateDomainLineCreditQuote({
        domainPriceCents: selectedDomainLine.priceCents,
        plan: access?.plan ?? getBillingPlan("free")
      })
    : null;
  const selectedPlanPlusDomainDueCents =
    (access?.plan.priceCents ?? getBillingPlan("free").priceCents) +
    (selectedDomainCredit?.customerDueCents ?? 0);

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
      {params.domains && params.domains !== "limit-reached" ? (
        <Toast status={params.domains} />
      ) : null}
      {data.error ? (
        <Card className="border-red-200 bg-red-50 p-5">
          <p className="text-sm font-bold text-red-700">{data.error}</p>
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
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
            Store plan
          </p>
          <h2 className="mt-3 text-2xl font-black tracking-[-0.03em] text-ink">
            {commercePreview.credit.planName} · {commercePreview.credit.planPrice}
          </h2>
          <div className="mt-5 grid gap-3 text-sm font-semibold text-muted">
            <div className="flex justify-between rounded-2xl bg-slate-50 p-3">
              <span>Custom domain quota</span>
              <span className="font-black text-ink">
                {access
                  ? `${access.usage.domainsUsed} / ${access.usage.domainLimit === null ? "Unlimited" : access.usage.domainLimit}`
                  : "Unavailable"}
              </span>
            </div>
            <div className="flex justify-between rounded-2xl bg-slate-50 p-3">
              <span>Included domain credit</span>
              <span className="font-black text-ink">
                {formatDomainMoney(commercePreview.credit.includedCreditCents)}
              </span>
            </div>
            <div className="flex justify-between rounded-2xl bg-slate-50 p-3">
              <span>Remaining quota</span>
              <span className="font-black text-ink">
                {remainingDomainQuota === null ? "Unlimited" : remainingDomainQuota?.toLocaleString() ?? "0"}
              </span>
            </div>
          </div>
        </Card>
        <Card className="p-6 lg:p-8">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
            Default SHASTORE URL
          </p>
          <h2 className="mt-3 break-all text-2xl font-black tracking-[-0.03em] text-ink">
            {defaultStoreUrl}
          </h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-muted">
            The default storefront route remains active while domain search, checkout, DNS, and SSL are prepared.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <StatusBadge label="Default URL" value="active" />
            <StatusBadge label="Custom DNS" value={primaryDomain?.dns_status ?? "not_configured"} />
            <StatusBadge label="SSL" value={primaryDomain?.ssl_status ?? "not_configured"} />
          </div>
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
                <StatusBadge label="Status" value={primaryDomain.status ?? primaryDomain.verification_status} />
                <StatusBadge label="DNS" value={primaryDomain.verification_status} />
                <StatusBadge label="SSL" value={primaryDomain.ssl_status} />
              </div>
              <p className="mt-4 text-sm leading-6 text-muted">
                Active custom domains resolve this host to the correct public store while
                default SHASTORE URLs continue to work.
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
      {(params.domains === "limit-reached" || domainLimitReached || !customDomainsAvailable) && access ? (
        <UpgradeRequiredCard
          blockedAction={
            customDomainsAvailable ? "Custom domain limit reached" : "Custom domains unavailable"
          }
          currentPlan={access.plan.name}
          reason={
            customDomainsAvailable
              ? "Your current plan has reached its custom domain limit."
              : domainUpgrade?.reason ?? "Custom domains are not available on your current subscription."
          }
          recommendedPlan={domainUpgrade?.planName ?? "Starter"}
          recommendedPlanId={domainUpgrade?.planId}
        />
      ) : null}
      <Card className="p-6 lg:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
              Step 2
            </p>
            <h2 className="mt-3 text-2xl font-black tracking-[-0.03em] text-ink">
              SHASTORE subdomain
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Current default subdomain: <strong>{currentSubdomain}</strong>. Edit the preferred subdomain before connecting a custom domain.
            </p>
          </div>
          <StatusBadge label="Subdomain" value={subdomainStatus} />
        </div>
        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <div>
          <form className="mt-6 grid gap-4">
            <input name="storeId" type="hidden" value={activeStoreId} />
            <Input
              defaultValue={data.availability.subdomain ?? ""}
              id="checkSubdomain"
              label="Check subdomain availability"
              name="checkSubdomain"
              placeholder="my-brand"
            />
            <Button className="w-fit" disabled={!data.activeStore || !data.ready} type="submit" variant="secondary">
              Check availability
            </Button>
          </form>
          {data.availability.checked ? (
            <div
              className={`mt-4 rounded-3xl border p-4 text-sm font-semibold ${
                data.availability.status === "available"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-amber-200 bg-amber-50 text-amber-800"
              }`}
            >
              <p>{data.availability.message}</p>
              {data.availability.hostname ? (
                <p className="mt-1 font-black">{data.availability.hostname}</p>
              ) : null}
            </div>
          ) : null}
          </div>
          <div>
          <form action={createStoreSubdomain} className="mt-6 grid gap-4 border-t border-slate-100 pt-6">
            <input name="storeId" type="hidden" value={activeStoreId} />
            <Input
              defaultValue={data.availability.subdomain ?? ""}
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
          <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
              Reserved names
            </p>
            <p className="mt-2 text-sm leading-6 text-muted">
              {data.reservedSubdomains
                .filter((name) =>
                  ["admin", "app", "dashboard", "docs", "help", "mail", "root", "shastore", "support", "www"].includes(name)
                )
                .join(", ")}
            </p>
          </div>
          </div>
        </div>
      </Card>
      <Card className="p-6 lg:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
              Step 3
            </p>
            <h2 className="mt-3 text-2xl font-black tracking-[-0.03em] text-ink">
              Search for a domain
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Choose a standard domain search or IDN search, then select extensions to calculate a preview.
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-muted">
            Preview only
          </span>
        </div>
        <form className="mt-6 grid gap-5">
          <input name="storeId" type="hidden" value={activeStoreId} />
          {showAllExtensions ? <input name="viewMoreExtensions" type="hidden" value="true" /> : null}
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-ink px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-white">
              Domain Search
            </span>
            <span className="rounded-full bg-slate-100 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-muted">
              IDN Search
            </span>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              defaultValue={domainSearch}
              id="domainSearch"
              label="Domain Search"
              name="domainSearch"
              placeholder="yourbrand"
            />
            <Input
              defaultValue={idnSearch}
              id="idnSearch"
              label="IDN Search"
              name="idnSearch"
              placeholder="café-store"
            />
          </div>
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black text-ink">Top 10 Extensions</p>
                <p className="mt-1 text-xs font-semibold text-muted">
                  {topDomainExtensions.join(", ")}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <ButtonLink
                  href={domainsSearchHref({
                    domainSearch,
                    idnSearch,
                    showAll: true,
                    storeId: activeStoreId
                  })}
                  variant="secondary"
                >
                  View More
                </ButtonLink>
                <ButtonLink
                  href={domainsSearchHref({
                    domainSearch,
                    idnSearch,
                    selectAll: true,
                    showAll: true,
                    storeId: activeStoreId
                  })}
                  variant="secondary"
                >
                  Select All
                </ButtonLink>
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {visibleExtensions.map((extension) => (
                <label
                  className="flex cursor-pointer items-start gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4"
                  key={extension.extension}
                >
                  <input
                    className="mt-1 h-4 w-4 rounded border-slate-300"
                    defaultChecked={commercePreview.selectedExtensions.includes(extension.extension)}
                    name="extensions"
                    type="checkbox"
                    value={extension.extension}
                  />
                  <span>
                    <span className="block text-sm font-black text-ink">{extension.extension}</span>
                    <span className="mt-1 block text-xs font-semibold text-muted">
                      {extension.label}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>
          <Button className="w-fit" type="submit">
            Calculate/Search
          </Button>
        </form>
      </Card>
      {hasDomainSearch ? (
        <>
          <Card className="p-6 lg:p-8">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
              Step 4
            </p>
            <h2 className="mt-3 text-2xl font-black tracking-[-0.03em] text-ink">
              Results and pricing preview
            </h2>
            <div className="mt-5 grid gap-3">
              {commercePreview.pricing.lines.map((line) => {
                const lineCredit = calculateDomainLineCreditQuote({
                  domainPriceCents: line.priceCents,
                  plan: access?.plan ?? getBillingPlan("free")
                });
                const selected = selectedDomainLine?.domainName === line.domainName;

                return (
                  <div
                    className={`grid gap-4 rounded-3xl border p-4 ${
                      selected ? "border-ink bg-white" : "border-slate-200 bg-slate-50"
                    }`}
                    key={line.domainName}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                          Full domain name
                        </p>
                        <p className="mt-1 break-all text-xl font-black tracking-[-0.03em] text-ink">
                          {line.domainName}
                        </p>
                      </div>
                      <ButtonLink
                        href={selectedDomainHref({
                          domainName: line.domainName,
                          domainSearch,
                          extensions: commercePreview.selectedExtensions,
                          idnSearch,
                          showAll: showAllExtensions,
                          storeId: activeStoreId
                        })}
                        variant={selected ? "primary" : "secondary"}
                      >
                        {selected ? "Selected" : "Select domain"}
                      </ButtonLink>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="rounded-2xl bg-white p-3">
                        <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Extension</p>
                        <p className="mt-1 text-sm font-black text-ink">{line.extension}</p>
                      </div>
                      <div className="rounded-2xl bg-white p-3">
                        <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Availability</p>
                        <p className="mt-1 text-sm font-black text-amber-700">Preview placeholder</p>
                      </div>
                      <div className="rounded-2xl bg-white p-3">
                        <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Domain price</p>
                        <p className="mt-1 text-sm font-black text-ink">{formatDomainMoney(line.priceCents)}</p>
                      </div>
                      <div className="rounded-2xl bg-white p-3">
                        <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Extra due</p>
                        <p className="mt-1 text-sm font-black text-ink">{formatDomainMoney(lineCredit.customerDueCents)}</p>
                      </div>
                      <div className="rounded-2xl bg-white p-3">
                        <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Included credit</p>
                        <p className="mt-1 text-sm font-black text-ink">{formatDomainMoney(lineCredit.includedCreditCents)}</p>
                      </div>
                      <div className="rounded-2xl bg-white p-3">
                        <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Credit used</p>
                        <p className="mt-1 text-sm font-black text-ink">{formatDomainMoney(lineCredit.creditUsedCents)}</p>
                      </div>
                      <div className="rounded-2xl bg-white p-3 lg:col-span-2">
                        <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Renewal note</p>
                        <p className="mt-1 text-sm font-semibold text-muted">
                          Renewal pricing will be confirmed when live availability and checkout are enabled.
                        </p>
                      </div>
                    </div>
                    <p className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900">
                      Preview only. No purchase yet. No charge yet.
                    </p>
                  </div>
                );
              })}
            </div>
          </Card>
          <div className="grid gap-6 xl:grid-cols-2">
            <Card className="p-6 lg:p-8">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                Step 5
              </p>
              <h2 className="mt-3 text-2xl font-black tracking-[-0.03em] text-ink">
                Selected domain checkout preview
              </h2>
              {selectedDomainLine && selectedDomainCredit ? (
                <>
                  <div className="mt-5 grid gap-3 text-sm font-semibold text-muted">
                    <div className="flex justify-between rounded-2xl bg-slate-50 p-3">
                      <span>Selected store</span>
                      <span className="font-black text-ink">
                        {data.activeStore?.store_name ?? data.activeStore?.internal_slug ?? "Selected store"}
                      </span>
                    </div>
                    <div className="flex justify-between rounded-2xl bg-slate-50 p-3">
                      <span>Selected domain</span>
                      <span className="break-all font-black text-ink">{selectedDomainLine.domainName}</span>
                    </div>
                    <div className="flex justify-between rounded-2xl bg-slate-50 p-3">
                      <span>Plan name</span>
                      <span className="font-black text-ink">{selectedDomainCredit.planName}</span>
                    </div>
                    <div className="flex justify-between rounded-2xl bg-slate-50 p-3">
                      <span>Plan monthly price</span>
                      <span className="font-black text-ink">{selectedDomainCredit.planPrice}</span>
                    </div>
                    <div className="flex justify-between rounded-2xl bg-slate-50 p-3">
                      <span>Included domain credit</span>
                      <span className="font-black text-ink">{formatDomainMoney(selectedDomainCredit.includedCreditCents)}</span>
                    </div>
                    <div className="flex justify-between rounded-2xl bg-slate-50 p-3">
                      <span>Domain price</span>
                      <span className="font-black text-ink">{formatDomainMoney(selectedDomainCredit.domainPriceCents)}</span>
                    </div>
                    <div className="flex justify-between rounded-2xl bg-slate-50 p-3">
                      <span>Credit used</span>
                      <span className="font-black text-ink">{formatDomainMoney(selectedDomainCredit.creditUsedCents)}</span>
                    </div>
                    <div className="flex justify-between rounded-2xl bg-slate-50 p-3">
                      <span>Customer pays now</span>
                      <span className="font-black text-ink">{formatDomainMoney(selectedDomainCredit.customerDueCents)}</span>
                    </div>
                    <div className="flex justify-between rounded-2xl bg-slate-50 p-3">
                      <span>Future subscription value preview</span>
                      <span className="font-black text-ink">{formatDomainMoney(selectedPlanPlusDomainDueCents)}</span>
                    </div>
                  </div>
                  <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900">
                    Preview only. No purchase yet. No charge yet. Included credit logic will be confirmed during the future checkout integration.
                  </p>
                  <form action={prepareDomainOrderDraft} className="mt-4">
                    <input name="storeId" type="hidden" value={activeStoreId} />
                    <input name="selectedDomain" type="hidden" value={selectedDomainLine.domainName} />
                    <input name="extension" type="hidden" value={selectedDomainLine.extension} />
                    <Button type="submit">Prepare domain order</Button>
                  </form>
                </>
              ) : (
                <p className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm font-semibold text-muted">
                  Select a domain result to preview checkout.
                </p>
              )}
            </Card>
            <Card className="p-6 lg:p-8">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                Step 6
              </p>
              <h2 className="mt-3 text-2xl font-black tracking-[-0.03em] text-ink">
                After purchase placeholder
              </h2>
              <div className="mt-5 grid gap-3 text-sm font-semibold text-muted">
                <p className="rounded-2xl bg-slate-50 p-3">Auto connect selected domain to {data.activeStore?.store_name ?? "selected store"}.</p>
                <p className="rounded-2xl bg-slate-50 p-3">Show DNS instructions after checkout is ready.</p>
                <p className="rounded-2xl bg-slate-50 p-3">SSL provisioning status starts as pending.</p>
                <p className="rounded-2xl bg-slate-50 p-3">Primary domain status remains unchanged until verified.</p>
              </div>
              <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900">
                Preview only: no payment session, domain registration, external lookup, or charge is created.
              </p>
            </Card>
          </div>
        </>
      ) : null}
      <Card className="p-6 lg:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
              Domain order preparation
            </p>
            <h2 className="mt-3 text-2xl font-black tracking-[-0.03em] text-ink">
              Prepared order drafts
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              This is a preparation step. No domain has been purchased yet.
            </p>
          </div>
          <span className="rounded-full bg-amber-50 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-amber-800">
            Awaiting payment / future activation
          </span>
        </div>
        <div className="mt-5 grid gap-3">
          {data.domainOrderDrafts.length ? (
            data.domainOrderDrafts.map((draft) => (
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4" key={draft.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                      Draft prepared
                    </p>
                    <p className="mt-1 break-all text-xl font-black tracking-[-0.03em] text-ink">
                      {draft.selectedDomain}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-muted">
                      {new Date(draft.createdAt).toLocaleString()} · {draft.extension}
                    </p>
                  </div>
                  <StatusBadge label="Status" value={draft.status} />
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-2xl bg-white p-3">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Plan</p>
                    <p className="mt-1 text-sm font-black text-ink">{draft.selectedPlan.name}</p>
                  </div>
                  <div className="rounded-2xl bg-white p-3">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Monthly price</p>
                    <p className="mt-1 text-sm font-black text-ink">{draft.planMonthlyPrice}</p>
                  </div>
                  <div className="rounded-2xl bg-white p-3">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Included credit</p>
                    <p className="mt-1 text-sm font-black text-ink">{formatDomainMoney(draft.includedDomainCreditCents)}</p>
                  </div>
                  <div className="rounded-2xl bg-white p-3">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Domain price</p>
                    <p className="mt-1 text-sm font-black text-ink">{formatDomainMoney(draft.domainPriceCents)}</p>
                  </div>
                  <div className="rounded-2xl bg-white p-3">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Credit used</p>
                    <p className="mt-1 text-sm font-black text-ink">{formatDomainMoney(draft.creditUsedCents)}</p>
                  </div>
                  <div className="rounded-2xl bg-white p-3">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Customer due</p>
                    <p className="mt-1 text-sm font-black text-ink">{formatDomainMoney(draft.customerDueCents)}</p>
                  </div>
                  <div className="rounded-2xl bg-amber-50 p-3 sm:col-span-2">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">Owner status</p>
                    <p className="mt-1 text-sm font-black text-amber-900">
                      Draft prepared · Awaiting payment / future activation
                    </p>
                  </div>
                </div>
                <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900">
                  No purchase yet. No charge yet. No registration yet.
                </p>
              </div>
            ))
          ) : (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-muted">
              <p className="font-bold text-ink">No prepared domain order drafts yet.</p>
              <p className="mt-1 leading-6">
                Select a domain from search results, then prepare an order draft from the checkout preview.
              </p>
            </div>
          )}
        </div>
        <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
            Future checkout steps
          </p>
          <div className="mt-3 grid gap-2 text-sm font-semibold text-muted sm:grid-cols-2 lg:grid-cols-5">
            <p className="rounded-2xl bg-slate-50 p-3">Payment session</p>
            <p className="rounded-2xl bg-slate-50 p-3">Availability refresh</p>
            <p className="rounded-2xl bg-slate-50 p-3">Registration request</p>
            <p className="rounded-2xl bg-slate-50 p-3">Auto connect after purchase</p>
            <p className="rounded-2xl bg-slate-50 p-3">SSL provisioning after connection</p>
          </div>
        </div>
      </Card>
      <Card className="p-6 lg:p-8">
        <h2 className="text-xl font-black tracking-[-0.02em] text-ink">
          Connect an existing custom domain
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          Adds the hostname in pending status and generates DNS records for ownership
          verification. Activation only happens after the domain is verified.
        </p>
          <form action={attachCustomDomain} className="mt-6 grid gap-4">
            <input name="storeId" type="hidden" value={activeStoreId} />
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
      <Card className="p-6 lg:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black tracking-[-0.02em] text-ink">
              Store domain records
            </h2>
            <p className="mt-1 text-sm text-muted">
              Saved records are read directly from Supabase for the selected store.
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-muted">
            {data.domains.length} connected
          </span>
        </div>
        <div className="mt-5 grid gap-4">
          {data.domains.length ? (
            data.domains.map((domain) => (
              <div
                className="rounded-3xl border border-slate-200 bg-slate-50 p-4 sm:p-5"
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
                    <span className="inline-flex items-center gap-2 rounded-full bg-ink px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-white">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Primary domain
                    </span>
                  ) : null}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <StatusBadge label="Status" value={domain.status ?? domain.verification_status} />
                  <StatusBadge label="Verify" value={domain.verification_status} />
                  <StatusBadge label="DNS" value={domain.dns_status} />
                  <StatusBadge label="SSL" value={domain.ssl_status} />
                </div>
                {domain.error_message ? (
                  <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
                    {domain.error_message}
                  </p>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-3">
                  {!domain.is_primary ? (
                    <form action={setPrimaryDomain}>
                      <input name="storeId" type="hidden" value={domain.store_instance_id} />
                      <input name="domainId" type="hidden" value={domain.id} />
                      <Button type="submit" variant="secondary">
                        Make primary
                      </Button>
                    </form>
                  ) : null}
                  {(domain.status === "verified" || domain.verification_status === "verified") &&
                  domain.status !== "active" ? (
                    <form action={activateVerifiedStoreDomain}>
                      <input name="storeId" type="hidden" value={domain.store_instance_id} />
                      <input name="domainId" type="hidden" value={domain.id} />
                      <Button type="submit" variant="secondary">
                        Activate verified domain
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
                  <form action={removeDomain}>
                    <input name="storeId" type="hidden" value={domain.store_instance_id} />
                    <input name="domainId" type="hidden" value={domain.id} />
                    <Button type="submit" variant="ghost">
                      Delete
                    </Button>
                  </form>
                </div>
                {data.provisioning[domain.id] ? (
                  <div className="mt-5 grid gap-3 rounded-3xl border border-slate-200 bg-white p-4 text-sm md:grid-cols-2">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                        CNAME target
                      </p>
                      <p className="mt-2 break-all font-black text-ink">
                        {data.provisioning[domain.id].cnameTarget}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-muted">
                        Point {domain.hostname} to this target.
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                        TXT verification record
                      </p>
                      <p className="mt-2 break-all text-muted">
                        <span className="font-black text-ink">{data.provisioning[domain.id].recordName}</span>{" "}
                        = {data.provisioning[domain.id].recordValue}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-muted">
                        Keep this record until the domain is verified.
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            ))
          ) : (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-muted">
              <Copy className="h-5 w-5 text-slate-400" />
              <p className="mt-3 font-bold text-ink">No domains connected yet.</p>
              <p className="mt-1 leading-6">
                Set a SHASTORE subdomain or attach a custom domain to generate
                provisioning instructions for this store.
              </p>
            </div>
          )}
        </div>
      </Card>
      <Card className="p-6 lg:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black tracking-[-0.02em] text-ink">
              Verification logs
            </h2>
            <p className="mt-1 text-sm text-muted">
              Recent status changes and verification attempts for the selected store.
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-muted">
            {data.logs.length} recent
          </span>
        </div>
        <div className="mt-5 grid gap-3">
          {data.logs.length ? (
            data.logs.map((log) => (
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4" key={log.id}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="break-all text-sm font-black text-ink">{log.hostname}</p>
                  <StatusBadge label="Log" value={log.status} />
                </div>
                <p className="mt-2 text-sm font-semibold leading-6 text-muted">
                  {log.message ?? "Domain verification event recorded."}
                </p>
                <p className="mt-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                  {new Date(log.checked_at).toLocaleString()}
                </p>
              </div>
            ))
          ) : (
            <p className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm font-semibold text-muted">
              No verification logs yet. Add a custom domain or queue verification to create the first log.
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
            "Production subdomains resolve through active domain records.",
            "Custom domains resolve only after verification and activation."
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
      <Card className="p-6 lg:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-black tracking-[-0.02em] text-ink">
              Future purchase service hooks
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              These lower-level placeholders reserve integration points for future domain search,
              domain purchase, email purchase, and credit checks. They do not call external
              services and do not charge customers yet.
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-muted">
            Placeholder only
          </span>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-4">
          {data.hostinshHooks.map((hook) => (
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4" key={hook.hook}>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                {hook.hook.replace(/_/g, " ")}
              </p>
              <p className="mt-2 text-sm font-black text-ink">
                {hook.configured ? "Service settings detected" : "Service settings not configured"}
              </p>
              <p className="mt-2 text-xs font-semibold leading-5 text-muted">
                {hook.message}
              </p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
