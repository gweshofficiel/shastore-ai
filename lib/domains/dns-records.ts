import "server-only";
import type { DomainDnsRecordInstruction, DomainDnsSetup } from "@/lib/domains/domain-dns-ssl";

type SupabaseClient = {
  from: (table: string) => unknown;
};

type DomainDnsRecordsTable = {
  select: (columns: string) => {
    in: (column: string, values: string[]) => {
      order: (column: string, options: { ascending: boolean }) => PromiseLike<{
        data: unknown[] | null;
        error: { message: string } | null;
      }>;
    };
  };
  upsert: (
    values: never,
    options: { onConflict: string }
  ) => PromiseLike<{ error: { message: string } | null }>;
};

export type DomainDnsRecordStatus = "pending" | "configured" | "verified" | "failed";
export type DomainDnsRecordType = "A" | "ALIAS" | "CNAME" | "TXT";

export type DomainDnsRuntimeRecord = {
  createdAt: string | null;
  domainName: string;
  domainOrderId: string;
  id: string;
  name: string;
  priority: number | null;
  recordType: DomainDnsRecordType;
  status: DomainDnsRecordStatus;
  ttl: number;
  updatedAt: string | null;
  value: string;
  verificationStatus: DomainDnsRecordStatus;
};

type DomainDnsSeedInput = {
  domainName: string;
  domainOrderId: string;
  dnsSetup?: DomainDnsSetup | null;
  verificationToken?: string | null;
};

const DNS_TARGET = "domains.shastore.ai";
const DEFAULT_TTL = 3600;
const recordStatuses = ["pending", "configured", "verified", "failed"] as const;
const recordTypes = ["A", "ALIAS", "CNAME", "TXT"] as const;

function deterministicVerificationToken(domainOrderId: string) {
  return `shastore-${domainOrderId.replace(/-/g, "").slice(0, 24)}`;
}

function runtimeStatus(value: unknown): DomainDnsRecordStatus {
  return recordStatuses.includes(value as DomainDnsRecordStatus)
    ? (value as DomainDnsRecordStatus)
    : "pending";
}

function runtimeRecordType(value: unknown): DomainDnsRecordType {
  return recordTypes.includes(value as DomainDnsRecordType)
    ? (value as DomainDnsRecordType)
    : "TXT";
}

function numberOrDefault(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function textOrDefault(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export function buildDefaultDomainDnsRecords({
  domainName,
  domainOrderId,
  dnsSetup,
  verificationToken
}: DomainDnsSeedInput): DomainDnsRuntimeRecord[] {
  const token =
    verificationToken?.trim() ||
    dnsSetup?.records.find((record) => record.type === "TXT")?.value ||
    deterministicVerificationToken(domainOrderId);
  const setupRecordByKey = new Map(
    (dnsSetup?.records ?? []).map((record) => [`${record.type}:${record.host}`, record])
  );

  return [
    {
      domainName,
      domainOrderId,
      id: "",
      name: "www",
      priority: null,
      recordType: "CNAME",
      status: "pending",
      ttl: DEFAULT_TTL,
      value: DNS_TARGET,
      verificationStatus: "pending"
    },
    {
      domainName,
      domainOrderId,
      id: "",
      name: "@",
      priority: null,
      recordType: "ALIAS",
      status: "pending",
      ttl: DEFAULT_TTL,
      value: DNS_TARGET,
      verificationStatus: "pending"
    },
    {
      domainName,
      domainOrderId,
      id: "",
      name: "_shastore-verification",
      priority: null,
      recordType: "TXT",
      status: "pending",
      ttl: DEFAULT_TTL,
      value: token,
      verificationStatus: "pending"
    }
  ].map((record) => {
    const setupRecord: DomainDnsRecordInstruction | undefined = setupRecordByKey.get(
      `${record.recordType}:${record.name}`
    );

    return {
      ...record,
      createdAt: null,
      recordType: record.recordType as DomainDnsRecordType,
      status: runtimeStatus(setupRecord?.status),
      ttl: setupRecord?.ttl ?? record.ttl,
      updatedAt: null,
      value: setupRecord?.value ?? record.value,
      verificationStatus: runtimeStatus(setupRecord?.verificationStatus ?? setupRecord?.status)
    };
  });
}

function parseRuntimeDnsRecord(value: unknown): DomainDnsRuntimeRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const row = value as Record<string, unknown>;
  const domainOrderId = textOrDefault(row.domain_order_id, "");
  const domainName = textOrDefault(row.domain_name, "");
  const name = textOrDefault(row.name, "");
  const recordType = runtimeRecordType(row.record_type);
  const recordValue = textOrDefault(row.value, "");

  if (!domainOrderId || !domainName || !name || !recordValue) {
    return null;
  }

  return {
    createdAt: typeof row.created_at === "string" ? row.created_at : null,
    domainName,
    domainOrderId,
    id: textOrDefault(row.id, `${domainOrderId}-${recordType}-${name}`),
    name,
    priority: typeof row.priority === "number" ? row.priority : null,
    recordType,
    status: runtimeStatus(row.status),
    ttl: numberOrDefault(row.ttl, DEFAULT_TTL),
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : null,
    value: recordValue,
    verificationStatus: runtimeStatus(row.verification_status)
  };
}

export async function seedDomainDnsRecords({
  domainName,
  domainOrderId,
  dnsSetup,
  supabase,
  verificationToken
}: DomainDnsSeedInput & {
  supabase: SupabaseClient;
}) {
  console.info("dns_records_seed_started", {
    domainName,
    domainOrderId,
    recordCount: 3
  });

  const records = buildDefaultDomainDnsRecords({
    domainName,
    domainOrderId,
    dnsSetup,
    verificationToken
  });
  const domainDnsRecords = supabase.from("domain_dns_records") as DomainDnsRecordsTable;
  const { error } = await domainDnsRecords.upsert(
    records.map((record) => ({
      domain_name: record.domainName,
      domain_order_id: record.domainOrderId,
      name: record.name,
      priority: record.priority,
      record_type: record.recordType,
      status: record.status,
      ttl: record.ttl,
      value: record.value,
      verification_status: record.verificationStatus
    })) as never,
    { onConflict: "domain_order_id,record_type,name" }
  );

  if (error) {
    console.error("dns_records_seed_failed", {
      domainName,
      domainOrderId,
      message: error.message
    });

    return { error };
  }

  console.info("dns_records_seed_success", {
    domainName,
    domainOrderId,
    recordCount: records.length
  });

  return { error: null };
}

export async function listDomainDnsRecordsByOrderIds({
  domainOrderIds,
  supabase
}: {
  domainOrderIds: string[];
  supabase: SupabaseClient;
}) {
  const ids = Array.from(new Set(domainOrderIds.map((id) => id.trim()).filter(Boolean)));

  if (!ids.length) {
    return [];
  }

  const domainDnsRecords = supabase.from("domain_dns_records") as DomainDnsRecordsTable;
  const { data, error } = await domainDnsRecords
    .select("id, domain_order_id, domain_name, record_type, name, value, ttl, priority, status, verification_status, created_at, updated_at")
    .in("domain_order_id", ids)
    .order("created_at", { ascending: true });

  if (error) {
    return [];
  }

  return (data ?? [])
    .map(parseRuntimeDnsRecord)
    .filter((record): record is DomainDnsRuntimeRecord => Boolean(record));
}
