import {
  buildDnsVerification,
  checkHostinshResellerBalance,
  getDefaultDnsTarget,
  getDomainBase,
  purchaseHostinshDomain,
  purchaseHostinshEmail,
  searchHostinshDomain,
  type HostinshHookResult
} from "@/lib/domains/hostinsh";
import {
  buildFreeHostname,
  getReservedSubdomains,
  isReservedSubdomain,
  isValidHostname,
  normalizeSubdomain
} from "@/lib/domains/utils";
import { createClient } from "@/lib/supabase/server";

export type ClaimedStoreForDomains = {
  id: string;
  store_name: string | null;
  internal_slug: string | null;
  access_role: string | null;
};

export type StoreDomainRecord = {
  id: string;
  store_instance_id: string;
  owner_user_id: string | null;
  domain_type: "subdomain" | "custom";
  hostname: string;
  subdomain: string | null;
  custom_domain: string | null;
  cname_target?: string | null;
  error_message?: string | null;
  primary_domain: string | null;
  is_primary: boolean;
  last_checked_at?: string | null;
  status?: "pending" | "verifying" | "verified" | "active" | "failed" | null;
  verification_token?: string | null;
  verification_status: "pending" | "verified" | "failed" | "revoked";
  verified_at?: string | null;
  dns_status: "not_configured" | "pending" | "verified" | "failed";
  ssl_status: "not_configured" | "pending" | "ready" | "active" | "failed";
  created_at: string;
  updated_at: string;
};

export type StoreDomainVerificationLog = {
  checked_at: string;
  hostname: string;
  id: string;
  message: string | null;
  status: string;
  store_domain_id: string | null;
};

export type DomainOrderDraft = {
  createdAt: string;
  creditUsedCents: number;
  customerDueCents: number;
  domainPriceCents: number;
  extension: string;
  id: string;
  includedDomainCreditCents: number;
  planMonthlyPrice: string;
  selectedDomain: string;
  selectedPlan: {
    id: string;
    name: string;
  };
  status: "draft";
  storeId: string;
};

export type DomainAvailability = {
  checked: boolean;
  hostname: string | null;
  message: string | null;
  status: "available" | "duplicate" | "invalid" | "reserved" | null;
  subdomain: string | null;
};

export type DomainProvisioningInstruction = {
  cnameTarget: string;
  recordName: string;
  recordType: "TXT";
  recordValue: string;
};

export type StoreDomainsDashboardData = {
  activeStore: ClaimedStoreForDomains | null;
  availability: DomainAvailability;
  domains: StoreDomainRecord[];
  domainOrderDrafts: DomainOrderDraft[];
  domainBase: string;
  error: string | null;
  logs: StoreDomainVerificationLog[];
  hostinshHooks: HostinshHookResult[];
  provisioning: Record<string, DomainProvisioningInstruction>;
  reservedSubdomains: string[];
  ready: boolean;
  stores: ClaimedStoreForDomains[];
};

function isMissingStoreDomainsTable(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const record = error as { code?: string; message?: string };
  const message = (record.message ?? "").toLowerCase();
  return (
    record.code === "PGRST205" ||
    record.code === "PGRST204" ||
    message.includes("store_domains") ||
    message.includes("could not find the table") ||
    message.includes("owner_user_id")
  );
}

export function storeDomainsMigrationMessage() {
  return "Apply supabase/migrations/20260522124000_store_domains_foundation.sql to enable store subdomains and custom domains.";
}

function emptyAvailability(): DomainAvailability {
  return {
    checked: false,
    hostname: null,
    message: null,
    status: null,
    subdomain: null
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function parseDomainOrderDraft(value: unknown): DomainOrderDraft | null {
  if (!isRecord(value) || value.status !== "draft") {
    return null;
  }

  const selectedPlan = isRecord(value.selectedPlan) ? value.selectedPlan : {};

  if (
    typeof value.id !== "string" ||
    typeof value.storeId !== "string" ||
    typeof value.selectedDomain !== "string" ||
    typeof value.extension !== "string" ||
    typeof value.createdAt !== "string" ||
    typeof value.planMonthlyPrice !== "string" ||
    typeof selectedPlan.id !== "string" ||
    typeof selectedPlan.name !== "string" ||
    typeof value.includedDomainCreditCents !== "number" ||
    typeof value.domainPriceCents !== "number" ||
    typeof value.creditUsedCents !== "number" ||
    typeof value.customerDueCents !== "number"
  ) {
    return null;
  }

  return {
    createdAt: value.createdAt,
    creditUsedCents: value.creditUsedCents,
    customerDueCents: value.customerDueCents,
    domainPriceCents: value.domainPriceCents,
    extension: value.extension,
    id: value.id,
    includedDomainCreditCents: value.includedDomainCreditCents,
    planMonthlyPrice: value.planMonthlyPrice,
    selectedDomain: value.selectedDomain,
    selectedPlan: {
      id: selectedPlan.id,
      name: selectedPlan.name
    },
    status: "draft",
    storeId: value.storeId
  };
}

function parseDomainOrderDrafts(storeData: unknown) {
  if (!isRecord(storeData) || !isRecord(storeData.domainOrderDrafts)) {
    return [];
  }

  return Object.values(storeData.domainOrderDrafts)
    .map(parseDomainOrderDraft)
    .filter((draft): draft is DomainOrderDraft => Boolean(draft))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function checkSubdomainAvailability(
  supabase: Awaited<ReturnType<typeof createClient>>,
  value?: string
): Promise<DomainAvailability> {
  const subdomain = normalizeSubdomain(value ?? "");

  if (!subdomain) {
    return emptyAvailability();
  }

  if (subdomain.length < 3) {
    return {
      checked: true,
      hostname: null,
      message: "Use at least 3 valid characters.",
      status: "invalid",
      subdomain
    };
  }

  if (isReservedSubdomain(subdomain)) {
    return {
      checked: true,
      hostname: null,
      message: "This subdomain is reserved by SHASTORE AI.",
      status: "reserved",
      subdomain
    };
  }

  const hostname = buildFreeHostname(subdomain);

  if (!isValidHostname(hostname)) {
    return {
      checked: true,
      hostname,
      message: "This hostname is not valid.",
      status: "invalid",
      subdomain
    };
  }

  const { data } = await supabase
    .from("store_domains" as never)
    .select("id")
    .eq("hostname", hostname)
    .maybeSingle();

  return {
    checked: true,
    hostname,
    message: data
      ? "This subdomain is already connected to another store."
      : "This subdomain is available to reserve.",
    status: data ? "duplicate" : "available",
    subdomain
  };
}

function buildProvisioning(domain: StoreDomainRecord): DomainProvisioningInstruction {
  const verification = buildDnsVerification(
    domain.hostname,
    domain.verification_token ?? `pending-${domain.id.replace(/-/g, "").slice(0, 16)}`
  );

  return {
    cnameTarget: domain.cname_target ?? getDefaultDnsTarget(),
    recordName: verification.recordName,
    recordType: verification.recordType,
    recordValue: verification.recordValue
  };
}

export async function getStoreDomainsDashboardData(
  requestedStoreId?: string,
  availabilitySubdomain?: string
): Promise<StoreDomainsDashboardData> {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      activeStore: null,
      availability: emptyAvailability(),
      domains: [],
      domainOrderDrafts: [],
      domainBase: getDomainBase(),
      error: null,
      logs: [],
      hostinshHooks: [],
      provisioning: {},
      reservedSubdomains: getReservedSubdomains(),
      ready: true,
      stores: []
    };
  }

  const { data: storesData, error: storesError } = await supabase.rpc(
    "get_claimed_store_instances_for_current_user" as never
  );

  if (storesError) {
    return {
      activeStore: null,
      availability: emptyAvailability(),
      domains: [],
      domainOrderDrafts: [],
      domainBase: getDomainBase(),
      error: "Unable to load claimed buyer stores for domain management.",
      logs: [],
      hostinshHooks: [],
      provisioning: {},
      reservedSubdomains: getReservedSubdomains(),
      ready: true,
      stores: []
    };
  }

  const stores = Array.isArray(storesData)
    ? ((storesData as ClaimedStoreForDomains[]).filter(
        (store) =>
          !store.access_role || store.access_role === "owner" || store.access_role === "admin"
      ) ?? [])
    : [];
  const activeStore =
    stores.find((store) => store.id === requestedStoreId) ?? stores[0] ?? null;

  if (!activeStore) {
    return {
      activeStore: null,
      availability: emptyAvailability(),
      domains: [],
      domainOrderDrafts: [],
      domainBase: getDomainBase(),
      error: null,
      logs: [],
      hostinshHooks: [],
      provisioning: {},
      reservedSubdomains: getReservedSubdomains(),
      ready: true,
      stores
    };
  }

  const domainsResult = await supabase
    .from("store_domains" as never)
    .select("*")
    .eq("store_instance_id", activeStore.id)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: false });

  const domains = domainsResult.error
    ? []
    : ((domainsResult.data ?? []) as StoreDomainRecord[]);
  const logsResult = domains.length
    ? await supabase
        .from("store_domain_verification_logs" as never)
        .select("id, store_domain_id, hostname, status, message, checked_at")
        .eq("store_instance_id", activeStore.id)
        .order("checked_at", { ascending: false })
        .limit(12)
    : { data: [], error: null };
  const hostinshHooks = await Promise.all([
    searchHostinshDomain(),
    purchaseHostinshDomain(),
    purchaseHostinshEmail(),
    checkHostinshResellerBalance()
  ]);
  const storeDataResult = await supabase
    .from("stores" as never)
    .select("store_data")
    .eq("id" as never, activeStore.id as never)
    .maybeSingle();
  const storeRow: Record<string, unknown> = isRecord(storeDataResult.data)
    ? storeDataResult.data
    : {};
  const storeData = isRecord(storeRow.store_data) ? storeRow.store_data : {};

  return {
    activeStore,
    availability: await checkSubdomainAvailability(supabase, availabilitySubdomain),
    domains,
    domainOrderDrafts: parseDomainOrderDrafts(storeData),
    domainBase: getDomainBase(),
    error:
      domainsResult.error && !isMissingStoreDomainsTable(domainsResult.error)
        ? "Unable to load domains for this store."
        : null,
    logs: logsResult.error ? [] : ((logsResult.data ?? []) as StoreDomainVerificationLog[]),
    hostinshHooks,
    provisioning: Object.fromEntries(
      domains.map((domain) => [domain.id, buildProvisioning(domain)])
    ),
    reservedSubdomains: getReservedSubdomains(),
    ready: !isMissingStoreDomainsTable(domainsResult.error),
    stores
  };
}
