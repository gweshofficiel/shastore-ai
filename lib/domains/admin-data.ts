import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getAdminAccess } from "@/lib/admin-access";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type AnyRecord = Record<string, unknown>;

function text(value: unknown, fallback = "") {
  return typeof value === "string" && value ? value : fallback;
}

function asRecords(value: unknown): AnyRecord[] {
  return Array.isArray(value) ? (value as AnyRecord[]) : [];
}

async function getAdminDomainClient() {
  await getAdminAccess();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (url && serviceRoleKey) {
    return createServiceClient<Database>(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }

  return createClient();
}

async function safeSelect(table: string, columns = "*") {
  const supabase = await getAdminDomainClient();
  const { data } = await supabase
    .from(table as never)
    .select(columns)
    .limit(1000);
  return asRecords(data);
}

export async function getAdminDomainOverview() {
  const [domains, hosts, verifications] = await Promise.all([
    safeSelect("domains", "id, hostname, kind, status, ssl_status, user_id, created_at"),
    safeSelect("publication_hosts", "id, hostname, source_type, source_slug, status, user_id"),
    safeSelect("dns_verifications", "id, hostname, status, checked_at, user_id")
  ]);
  const hostnameCounts = new Map<string, number>();

  for (const host of hosts) {
    const hostname = text(host.hostname);
    if (hostname) {
      hostnameCounts.set(hostname, (hostnameCounts.get(hostname) ?? 0) + 1);
    }
  }

  const conflicts = [...hostnameCounts.values()].filter((count) => count > 1).length;

  return {
    connectedDomains: domains.filter((domain) => domain.status === "verified").length,
    domains,
    hostnameConflicts: conflicts,
    hosts,
    pendingSsl: domains.filter((domain) => domain.ssl_status === "pending").length,
    pendingVerification: verifications.filter((verification) => verification.status === "pending")
      .length,
    verifications
  };
}
