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
import { fetchStoresForAuthUser, type UserStoreRow } from "@/lib/stores/user-stores";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspaceForUser } from "@/lib/workspaces/active-workspace";
import {
  buildDomainPaymentPreparation,
  type DomainPaymentPreparationStatus
} from "@/lib/domains/domain-payment-preparation";
import {
  buildDomainDnsSetup,
  buildDomainSslSetup,
  type DomainDnsRecordInstruction,
  type DomainDnsSetup,
  type DomainDnsSetupStatus,
  type DomainSslSetup,
  type DomainSslStatus
} from "@/lib/domains/domain-dns-ssl";

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
  creditUsed: number;
  creditUsedCents: number;
  customerDue: number;
  customerDueCents: number;
  domainPrice: number;
  domainPriceCents: number;
  extension: string;
  id: string;
  includedDomainCredit: number;
  includedDomainCreditCents: number;
  planMonthlyPrice: string;
  paymentPreparation: {
    amountDueNowCents: number;
    nextStep: DomainPaymentPreparationStatus;
    paymentRequired: boolean;
    primaryStatus: DomainPaymentPreparationStatus;
    statuses: DomainPaymentPreparationStatus[];
  };
  paymentPreparationStatus: DomainPaymentPreparationStatus;
  platformBalanceSafetyStatus: "blocked_until_platform_balance_check";
  selectedDomain: string;
  selectedPlan: {
    id: string;
    name: string;
  };
  status: "draft";
  storeId: string;
  storeName: string;
};

export type DomainCheckoutPreview = {
  createdAt: string;
  customerDue: number;
  customerDueCents: number;
  domain: string;
  domainOrderDraftId: string;
  domainPrice: number;
  domainPriceCents: number;
  id: string;
  planCreditUsed: number;
  planCreditUsedCents: number;
  status: "checkout_preview";
  storeId: string;
};

export type DomainRegistrationWorkflowStatus =
  | "ready_for_registration"
  | "registration_pending"
  | "registration_processing"
  | "registration_completed"
  | "registration_failed"
  | "awaiting_dns"
  | "ssl_pending"
  | "ssl_active";

export type DomainRegistrationWorkflow = {
  createdAt: string;
  customerDue: number;
  customerDueCents: number;
  dnsSetup: DomainDnsSetup;
  domain: string;
  domainCheckoutPreviewId: string;
  domainOrderDraftId: string;
  id: string;
  paymentConfirmationStatus: "covered_by_credit" | "future_payment_confirmed";
  sslSetup: DomainSslSetup;
  status: DomainRegistrationWorkflowStatus;
  statuses: DomainRegistrationWorkflowStatus[];
  storeId: string;
  updatedAt: string;
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
  domainCheckoutPreviews: DomainCheckoutPreview[];
  domainRegistrationWorkflows: DomainRegistrationWorkflow[];
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
  const storeName =
    typeof value.storeName === "string" && value.storeName.trim()
      ? value.storeName
      : "Selected store";
  const includedDomainCredit =
    typeof value.includedDomainCredit === "number"
      ? value.includedDomainCredit
      : value.includedDomainCreditCents;
  const domainPrice =
    typeof value.domainPrice === "number" ? value.domainPrice : value.domainPriceCents;
  const creditUsed =
    typeof value.creditUsed === "number" ? value.creditUsed : value.creditUsedCents;
  const customerDue =
    typeof value.customerDue === "number" ? value.customerDue : value.customerDueCents;
  const fallbackPaymentPreparation = buildDomainPaymentPreparation(customerDue);
  const paymentPreparation = isRecord(value.paymentPreparation)
    ? {
        amountDueNowCents:
          typeof value.paymentPreparation.amountDueNowCents === "number"
            ? value.paymentPreparation.amountDueNowCents
            : fallbackPaymentPreparation.amountDueNowCents,
        nextStep:
          typeof value.paymentPreparation.nextStep === "string"
            ? (value.paymentPreparation.nextStep as DomainPaymentPreparationStatus)
            : fallbackPaymentPreparation.nextStep,
        paymentRequired:
          typeof value.paymentPreparation.paymentRequired === "boolean"
            ? value.paymentPreparation.paymentRequired
            : fallbackPaymentPreparation.paymentRequired,
        primaryStatus:
          typeof value.paymentPreparation.primaryStatus === "string"
            ? (value.paymentPreparation.primaryStatus as DomainPaymentPreparationStatus)
            : fallbackPaymentPreparation.primaryStatus,
        statuses: Array.isArray(value.paymentPreparation.statuses)
          ? (value.paymentPreparation.statuses.filter(
              (status): status is DomainPaymentPreparationStatus => typeof status === "string"
            ))
          : fallbackPaymentPreparation.statuses
      }
    : fallbackPaymentPreparation;

  return {
    createdAt: value.createdAt,
    creditUsed,
    creditUsedCents: value.creditUsedCents,
    customerDue,
    customerDueCents: value.customerDueCents,
    domainPrice,
    domainPriceCents: value.domainPriceCents,
    extension: value.extension,
    id: value.id,
    includedDomainCredit,
    includedDomainCreditCents: value.includedDomainCreditCents,
    planMonthlyPrice: value.planMonthlyPrice,
    paymentPreparation,
    paymentPreparationStatus:
      typeof value.paymentPreparationStatus === "string"
        ? (value.paymentPreparationStatus as DomainPaymentPreparationStatus)
        : paymentPreparation.primaryStatus,
    platformBalanceSafetyStatus: "blocked_until_platform_balance_check",
    selectedDomain: value.selectedDomain,
    selectedPlan: {
      id: selectedPlan.id,
      name: selectedPlan.name
    },
    status: "draft",
    storeId: value.storeId,
    storeName
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

function parseDomainCheckoutPreview(value: unknown): DomainCheckoutPreview | null {
  if (!isRecord(value) || value.status !== "checkout_preview") {
    return null;
  }

  if (
    typeof value.id !== "string" ||
    typeof value.storeId !== "string" ||
    typeof value.domain !== "string" ||
    typeof value.domainOrderDraftId !== "string" ||
    typeof value.createdAt !== "string" ||
    typeof value.domainPriceCents !== "number" ||
    typeof value.planCreditUsedCents !== "number" ||
    typeof value.customerDueCents !== "number"
  ) {
    return null;
  }

  const domainPrice =
    typeof value.domainPrice === "number" ? value.domainPrice : value.domainPriceCents;
  const planCreditUsed =
    typeof value.planCreditUsed === "number" ? value.planCreditUsed : value.planCreditUsedCents;
  const customerDue =
    typeof value.customerDue === "number" ? value.customerDue : value.customerDueCents;

  return {
    createdAt: value.createdAt,
    customerDue,
    customerDueCents: value.customerDueCents,
    domain: value.domain,
    domainOrderDraftId: value.domainOrderDraftId,
    domainPrice,
    domainPriceCents: value.domainPriceCents,
    id: value.id,
    planCreditUsed,
    planCreditUsedCents: value.planCreditUsedCents,
    status: "checkout_preview",
    storeId: value.storeId
  };
}

function parseDomainCheckoutPreviews(storeData: unknown) {
  if (!isRecord(storeData) || !isRecord(storeData.domainCheckoutPreviews)) {
    return [];
  }

  return Object.values(storeData.domainCheckoutPreviews)
    .map(parseDomainCheckoutPreview)
    .filter((preview): preview is DomainCheckoutPreview => Boolean(preview))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

const domainRegistrationWorkflowStatuses: DomainRegistrationWorkflowStatus[] = [
  "ready_for_registration",
  "registration_pending",
  "registration_processing",
  "registration_completed",
  "registration_failed",
  "awaiting_dns",
  "ssl_pending",
  "ssl_active"
];

const domainDnsSetupStatuses: DomainDnsSetupStatus[] = [
  "not_started",
  "pending",
  "verified",
  "failed"
];

const domainSslStatuses: DomainSslStatus[] = [
  "ssl_pending",
  "ssl_provisioning",
  "ssl_active",
  "ssl_failed"
];

function isDomainDnsSetupStatus(value: unknown): value is DomainDnsSetupStatus {
  return (
    typeof value === "string" &&
    domainDnsSetupStatuses.includes(value as DomainDnsSetupStatus)
  );
}

function isDomainSslStatus(value: unknown): value is DomainSslStatus {
  return typeof value === "string" && domainSslStatuses.includes(value as DomainSslStatus);
}

function parseDomainDnsRecordInstruction(value: unknown): DomainDnsRecordInstruction | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    (value.type !== "CNAME" && value.type !== "A" && value.type !== "TXT") ||
    typeof value.host !== "string" ||
    typeof value.value !== "string" ||
    typeof value.note !== "string" ||
    typeof value.required !== "boolean" ||
    !isDomainDnsSetupStatus(value.status)
  ) {
    return null;
  }

  return {
    host: value.host,
    note: value.note,
    required: value.required,
    status: value.status,
    type: value.type,
    value: value.value
  };
}

function parseDomainDnsSetup(value: unknown, domain: string, targetStore: string): DomainDnsSetup {
  const fallback = buildDomainDnsSetup({
    domain,
    targetStore,
    verificationToken: "pending"
  });

  if (!isRecord(value) || !isDomainDnsSetupStatus(value.status)) {
    return fallback;
  }

  const records = Array.isArray(value.records)
    ? value.records
        .map(parseDomainDnsRecordInstruction)
        .filter((record): record is DomainDnsRecordInstruction => Boolean(record))
    : fallback.records;

  return {
    domain: typeof value.domain === "string" ? value.domain : domain,
    records: records.length ? records : fallback.records,
    status: value.status,
    targetStore: typeof value.targetStore === "string" ? value.targetStore : targetStore
  };
}

function parseDomainSslSetup(value: unknown, domain: string): DomainSslSetup {
  if (!isRecord(value) || !isDomainSslStatus(value.status)) {
    return buildDomainSslSetup({
      targetDomain: domain
    });
  }

  return {
    requestedAt: typeof value.requestedAt === "string" ? value.requestedAt : null,
    status: value.status,
    targetDomain: typeof value.targetDomain === "string" ? value.targetDomain : domain
  };
}

function isDomainRegistrationWorkflowStatus(
  value: unknown
): value is DomainRegistrationWorkflowStatus {
  return (
    typeof value === "string" &&
    domainRegistrationWorkflowStatuses.includes(value as DomainRegistrationWorkflowStatus)
  );
}

function parseDomainRegistrationWorkflow(value: unknown): DomainRegistrationWorkflow | null {
  if (!isRecord(value) || !isDomainRegistrationWorkflowStatus(value.status)) {
    return null;
  }

  if (
    typeof value.id !== "string" ||
    typeof value.storeId !== "string" ||
    typeof value.domain !== "string" ||
    typeof value.domainCheckoutPreviewId !== "string" ||
    typeof value.domainOrderDraftId !== "string" ||
    typeof value.createdAt !== "string" ||
    typeof value.updatedAt !== "string" ||
    typeof value.customerDueCents !== "number"
  ) {
    return null;
  }

  const customerDue =
    typeof value.customerDue === "number" ? value.customerDue : value.customerDueCents;
  const paymentConfirmationStatus =
    value.paymentConfirmationStatus === "future_payment_confirmed"
      ? "future_payment_confirmed"
      : "covered_by_credit";
  const statuses = Array.isArray(value.statuses)
    ? value.statuses.filter(isDomainRegistrationWorkflowStatus)
    : domainRegistrationWorkflowStatuses;
  const dnsSetup = parseDomainDnsSetup(value.dnsSetup, value.domain, "Selected store");
  const sslSetup = parseDomainSslSetup(value.sslSetup, value.domain);

  return {
    createdAt: value.createdAt,
    customerDue,
    customerDueCents: value.customerDueCents,
    dnsSetup,
    domain: value.domain,
    domainCheckoutPreviewId: value.domainCheckoutPreviewId,
    domainOrderDraftId: value.domainOrderDraftId,
    id: value.id,
    paymentConfirmationStatus,
    sslSetup,
    status: value.status,
    statuses: statuses.length ? statuses : domainRegistrationWorkflowStatuses,
    storeId: value.storeId,
    updatedAt: value.updatedAt
  };
}

function parseDomainRegistrationWorkflows(storeData: unknown) {
  if (!isRecord(storeData) || !isRecord(storeData.domainRegistrationWorkflows)) {
    return [];
  }

  return Object.values(storeData.domainRegistrationWorkflows)
    .map(parseDomainRegistrationWorkflow)
    .filter((workflow): workflow is DomainRegistrationWorkflow => Boolean(workflow))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function storeSlugForDomains(store: UserStoreRow) {
  return normalizeSubdomain(store.slug ?? store.store_name ?? store.name ?? store.id) || store.id;
}

function draftStoreToDomainStore(store: UserStoreRow): ClaimedStoreForDomains {
  return {
    access_role: "owner",
    id: store.id,
    internal_slug: storeSlugForDomains(store),
    store_name: store.store_name ?? store.name ?? storeSlugForDomains(store)
  };
}

function mergeDomainStores(stores: ClaimedStoreForDomains[]) {
  const merged = new Map<string, ClaimedStoreForDomains>();

  for (const store of stores) {
    merged.set(store.id, store);
  }

  return Array.from(merged.values());
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
      domainCheckoutPreviews: [],
      domainRegistrationWorkflows: [],
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

  const [{ data: storesData, error: storesError }, workspaceSelection] = await Promise.all([
    supabase.rpc("get_claimed_store_instances_for_current_user" as never),
    getActiveWorkspaceForUser({ supabase, userId: user.id })
  ]);
  const draftStoresResult = await fetchStoresForAuthUser(
    supabase,
    user.id,
    workspaceSelection.activeWorkspaceId
  );

  if (storesError && draftStoresResult.error) {
    return {
      activeStore: null,
      availability: emptyAvailability(),
      domainCheckoutPreviews: [],
      domainRegistrationWorkflows: [],
      domains: [],
      domainOrderDrafts: [],
      domainBase: getDomainBase(),
      error: "Unable to load buyer stores for domain management.",
      logs: [],
      hostinshHooks: [],
      provisioning: {},
      reservedSubdomains: getReservedSubdomains(),
      ready: true,
      stores: []
    };
  }

  const claimedStores = Array.isArray(storesData)
    ? ((storesData as ClaimedStoreForDomains[]).filter(
        (store) =>
          !store.access_role || store.access_role === "owner" || store.access_role === "admin"
      ) ?? [])
    : [];
  const draftStores = draftStoresResult.stores.map(draftStoreToDomainStore);
  const stores = mergeDomainStores([...claimedStores, ...draftStores]);
  const activeStore =
    stores.find((store) => store.id === requestedStoreId) ?? stores[0] ?? null;

  if (!activeStore) {
    return {
      activeStore: null,
      availability: emptyAvailability(),
      domainCheckoutPreviews: [],
      domainRegistrationWorkflows: [],
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
    domainCheckoutPreviews: parseDomainCheckoutPreviews(storeData),
    domainRegistrationWorkflows: parseDomainRegistrationWorkflows(storeData),
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
