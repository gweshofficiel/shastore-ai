import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspaceForUser } from "@/lib/workspaces/active-workspace";
import type {
  DnsVerification,
  DomainRecord,
  PublicationHost,
  PublishEvent
} from "@/lib/domains/types";

export type DomainsDashboardData = {
  ready: boolean;
  domains: DomainRecord[];
  publicationHosts: PublicationHost[];
  dnsVerifications: DnsVerification[];
  publishEvents: PublishEvent[];
  landingPublications: Array<{
    id: string;
    url: string;
    status: string;
    published_at: string | null;
  }>;
  storePublications: Array<{
    id: string;
    slug: string;
    url: string;
    status: string;
    hostname?: string | null;
    published_at?: string | null;
  }>;
};

function isMissingDomainTable(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const record = error as { code?: string; message?: string };
  const message = (record.message ?? "").toLowerCase();
  return (
    record.code === "PGRST205" ||
    record.code === "PGRST204" ||
    message.includes("domains") ||
    message.includes("publication_hosts") ||
    message.includes("dns_verifications") ||
    message.includes("publish_events") ||
    message.includes("could not find the table")
  );
}

export function domainsMigrationMessage() {
  return "Apply supabase/migrations/domain-publishing-safe.sql to enable production domain mapping. Existing /l and /store routes continue to work while the domain foundation is pending.";
}

export async function getDomainsDashboardData(): Promise<DomainsDashboardData> {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ready: true,
      domains: [],
      publicationHosts: [],
      dnsVerifications: [],
      publishEvents: [],
      landingPublications: [],
      storePublications: []
    };
  }

  const selection = await getActiveWorkspaceForUser({ supabase, userId: user.id });
  const workspaceId = selection.activeWorkspaceId;

  console.log("[workspace-data-access] domains dashboard scoped", {
    userId: user.id,
    workspaceId
  });

  const [
    domainsResult,
    hostsResult,
    dnsResult,
    eventsResult,
    landingResult,
    storeResult
  ] = await Promise.all([
    supabase
      .from("domains" as never)
      .select("*")
      .eq("workspace_id" as never, workspaceId as never)
      .order("created_at", { ascending: false }),
    supabase
      .from("publication_hosts" as never)
      .select("*")
      .eq("workspace_id" as never, workspaceId as never)
      .order("created_at", { ascending: false }),
    supabase
      .from("dns_verifications" as never)
      .select("*")
      .eq("workspace_id" as never, workspaceId as never)
      .order("created_at", { ascending: false }),
    supabase
      .from("publish_events" as never)
      .select("*")
      .eq("workspace_id" as never, workspaceId as never)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("publications")
      .select("id, url, status, published_at")
      .eq("workspace_id" as never, workspaceId as never)
      .order("created_at", { ascending: false }),
    supabase
      .from("published_stores")
      .select("id, slug, url, status, published_at")
      .eq("workspace_id" as never, workspaceId as never)
      .order("created_at", { ascending: false })
  ]);

  const ready =
    !isMissingDomainTable(domainsResult.error) &&
    !isMissingDomainTable(hostsResult.error) &&
    !isMissingDomainTable(dnsResult.error) &&
    !isMissingDomainTable(eventsResult.error);

  return {
    ready,
    domains: domainsResult.error ? [] : ((domainsResult.data ?? []) as DomainRecord[]),
    publicationHosts: hostsResult.error
      ? []
      : ((hostsResult.data ?? []) as PublicationHost[]),
    dnsVerifications: dnsResult.error
      ? []
      : ((dnsResult.data ?? []) as DnsVerification[]),
    publishEvents: eventsResult.error ? [] : ((eventsResult.data ?? []) as PublishEvent[]),
    landingPublications: landingResult.data ?? [],
    storePublications: (storeResult.data ?? []) as unknown as DomainsDashboardData["storePublications"]
  };
}

export async function resolvePublicationHostname(hostname: string) {
  const supabase = await createClient();
  const normalizedHostname = hostname.toLowerCase();
  const { data } = await supabase
    .from("publication_hosts" as never)
    .select("*")
    .eq("hostname", normalizedHostname)
    .eq("status", "published")
    .maybeSingle();

  return (data as PublicationHost | null) ?? null;
}
