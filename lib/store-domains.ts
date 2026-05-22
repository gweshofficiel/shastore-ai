import {
  buildDnsVerification,
  getDefaultDnsTarget,
  getDomainBase
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
  primary_domain: string | null;
  is_primary: boolean;
  verification_status: "pending" | "verified" | "failed" | "revoked";
  dns_status: "not_configured" | "pending" | "verified" | "failed";
  ssl_status: "not_configured" | "pending" | "ready" | "active" | "failed";
  created_at: string;
  updated_at: string;
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
  domainBase: string;
  error: string | null;
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
    `pending-${domain.id.replace(/-/g, "").slice(0, 16)}`
  );

  return {
    cnameTarget: getDefaultDnsTarget(),
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
      domainBase: getDomainBase(),
      error: null,
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
      domainBase: getDomainBase(),
      error: "Unable to load claimed buyer stores for domain management.",
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
      domainBase: getDomainBase(),
      error: null,
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

  return {
    activeStore,
    availability: await checkSubdomainAvailability(supabase, availabilitySubdomain),
    domains,
    domainBase: getDomainBase(),
    error:
      domainsResult.error && !isMissingStoreDomainsTable(domainsResult.error)
        ? "Unable to load domains for this store."
        : null,
    provisioning: Object.fromEntries(
      domains.map((domain) => [domain.id, buildProvisioning(domain)])
    ),
    reservedSubdomains: getReservedSubdomains(),
    ready: !isMissingStoreDomainsTable(domainsResult.error),
    stores
  };
}
