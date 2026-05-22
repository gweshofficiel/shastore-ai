import { getDomainBase } from "@/lib/domains/hostinsh";
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

export type StoreDomainsDashboardData = {
  activeStore: ClaimedStoreForDomains | null;
  domains: StoreDomainRecord[];
  domainBase: string;
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

export async function getStoreDomainsDashboardData(
  requestedStoreId?: string
): Promise<StoreDomainsDashboardData> {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      activeStore: null,
      domains: [],
      domainBase: getDomainBase(),
      ready: true,
      stores: []
    };
  }

  const { data: storesData } = await supabase.rpc(
    "get_claimed_store_instances_for_current_user" as never
  );
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
      domains: [],
      domainBase: getDomainBase(),
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

  return {
    activeStore,
    domains: domainsResult.error
      ? []
      : ((domainsResult.data ?? []) as StoreDomainRecord[]),
    domainBase: getDomainBase(),
    ready: !isMissingStoreDomainsTable(domainsResult.error),
    stores
  };
}
