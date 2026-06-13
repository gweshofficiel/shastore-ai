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
import { extractHttpApiErrorMessage } from "@/lib/domains/httpapi-registration";
import type {
  ConnectedDomainStatus,
  ConnectedDomainSummary,
  DomainRoutingPreparation
} from "@/lib/domains/domain-routing";
import {
  professionalEmailFutureHooks,
  buildProfessionalEmailDnsSetup,
  getProfessionalEmailMailboxPlan,
  professionalEmailActivationStatuses,
  professionalEmailMailboxTypes,
  type ProfessionalEmailActivationStatus,
  type ProfessionalEmailDnsRecord,
  type ProfessionalEmailDnsRecordStatus,
  type ProfessionalEmailDnsRecordType,
  type ProfessionalEmailDnsSetup,
  type ProfessionalEmailMailboxDraft,
  type ProfessionalEmailMailboxStatus,
  type ProfessionalEmailMailboxType,
  type ProfessionalEmailOrderDraft
} from "@/lib/domains/professional-email";

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
  providerErrorMessage: string | null;
  providerRawResponse: unknown;
  registrationError: {
    code?: string;
    message?: string;
    status?: number;
  } | null;
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
  connectedDomains: ConnectedDomainSummary[];
  domainCheckoutPreviews: DomainCheckoutPreview[];
  domainRegistrationWorkflows: DomainRegistrationWorkflow[];
  domainRoutingPreparations: DomainRoutingPreparation[];
  domains: StoreDomainRecord[];
  domainOrderDrafts: DomainOrderDraft[];
  domainBase: string;
  error: string | null;
  logs: StoreDomainVerificationLog[];
  hostinshHooks: HostinshHookResult[];
  professionalEmailMailboxDrafts: ProfessionalEmailMailboxDraft[];
  professionalEmailOrderDrafts: ProfessionalEmailOrderDraft[];
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
  const providerRawResponse = value.providerRawResponse ?? null;
  const registrationError = isRecord(value.registrationError)
    ? {
        code: typeof value.registrationError.code === "string" ? value.registrationError.code : undefined,
        message:
          typeof value.registrationError.message === "string"
            ? value.registrationError.message
            : undefined,
        status:
          typeof value.registrationError.status === "number"
            ? value.registrationError.status
            : undefined
      }
    : null;
  const providerErrorMessage =
    registrationError?.message ?? extractHttpApiErrorMessage(providerRawResponse);

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
    providerErrorMessage,
    providerRawResponse,
    registrationError,
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

function parseDomainRoutingPreparation(value: unknown): DomainRoutingPreparation | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.id !== "string" ||
    typeof value.selectedStoreId !== "string" ||
    typeof value.primaryDomain !== "string" ||
    typeof value.fallbackShastoreSubdomain !== "string" ||
    typeof value.createdAt !== "string" ||
    value.routingStatus !== "preparation_only"
  ) {
    return null;
  }

  return {
    createdAt: value.createdAt,
    fallbackShastoreSubdomain: value.fallbackShastoreSubdomain,
    futureHookPoints: {
      addDomainToDeploymentPlatform: "reserved",
      attachDomainToStoreRuntime: "reserved",
      keepFallbackUrlActive: "reserved",
      redirectDefaultSubdomainToPrimaryDomain: "reserved",
      verifyDomainOwnership: "reserved"
    },
    id: value.id,
    primaryDomain: value.primaryDomain,
    routingStatus: "preparation_only",
    selectedStoreId: value.selectedStoreId
  };
}

function parseDomainRoutingPreparations(storeData: unknown) {
  if (!isRecord(storeData) || !isRecord(storeData.domainPrimaryRoutingPreparations)) {
    return [];
  }

  return Object.values(storeData.domainPrimaryRoutingPreparations)
    .map(parseDomainRoutingPreparation)
    .filter((preparation): preparation is DomainRoutingPreparation => Boolean(preparation))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

const professionalEmailMailboxStatuses: ProfessionalEmailMailboxStatus[] = [
  "draft",
  "pending",
  "active",
  "failed"
];

function isProfessionalEmailMailboxType(value: unknown): value is ProfessionalEmailMailboxType {
  return (
    typeof value === "string" &&
    professionalEmailMailboxTypes.includes(value as ProfessionalEmailMailboxType)
  );
}

function isProfessionalEmailMailboxStatus(value: unknown): value is ProfessionalEmailMailboxStatus {
  return (
    typeof value === "string" &&
    professionalEmailMailboxStatuses.includes(value as ProfessionalEmailMailboxStatus)
  );
}

function parseProfessionalEmailMailboxDraft(value: unknown): ProfessionalEmailMailboxDraft | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.id !== "string" ||
    typeof value.storeId !== "string" ||
    typeof value.domain !== "string" ||
    typeof value.emailAddress !== "string" ||
    typeof value.createdAt !== "string" ||
    !isProfessionalEmailMailboxType(value.mailboxType) ||
    !isProfessionalEmailMailboxStatus(value.status)
  ) {
    return null;
  }

  return {
    createdAt: value.createdAt,
    domain: value.domain,
    emailAddress: value.emailAddress,
    futureHookPoints: professionalEmailFutureHooks(),
    id: value.id,
    mailboxType: value.mailboxType,
    status: value.status,
    storagePlaceholder:
      typeof value.storagePlaceholder === "string"
        ? value.storagePlaceholder
        : "Mailbox storage will be configured when email activation is connected.",
    storeId: value.storeId
  };
}

function parseProfessionalEmailMailboxDrafts(storeData: unknown) {
  if (!isRecord(storeData) || !isRecord(storeData.professionalEmailMailboxDrafts)) {
    return [];
  }

  return Object.values(storeData.professionalEmailMailboxDrafts)
    .map(parseProfessionalEmailMailboxDraft)
    .filter((draft): draft is ProfessionalEmailMailboxDraft => Boolean(draft))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

const professionalEmailDnsRecordStatuses: ProfessionalEmailDnsRecordStatus[] = [
  "pending",
  "verified",
  "failed"
];

const professionalEmailDnsRecordTypes: ProfessionalEmailDnsRecordType[] = [
  "MX",
  "SPF",
  "DKIM",
  "DMARC"
];

function isProfessionalEmailActivationStatus(value: unknown): value is ProfessionalEmailActivationStatus {
  return (
    typeof value === "string" &&
    professionalEmailActivationStatuses.includes(value as ProfessionalEmailActivationStatus)
  );
}

function isProfessionalEmailDnsRecordStatus(value: unknown): value is ProfessionalEmailDnsRecordStatus {
  return (
    typeof value === "string" &&
    professionalEmailDnsRecordStatuses.includes(value as ProfessionalEmailDnsRecordStatus)
  );
}

function isProfessionalEmailDnsRecordType(value: unknown): value is ProfessionalEmailDnsRecordType {
  return (
    typeof value === "string" &&
    professionalEmailDnsRecordTypes.includes(value as ProfessionalEmailDnsRecordType)
  );
}

function parseProfessionalEmailDnsRecord(value: unknown): ProfessionalEmailDnsRecord | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.host !== "string" ||
    typeof value.value !== "string" ||
    typeof value.note !== "string" ||
    !isProfessionalEmailDnsRecordStatus(value.status) ||
    !isProfessionalEmailDnsRecordType(value.type)
  ) {
    return null;
  }

  return {
    host: value.host,
    note: value.note,
    status: value.status,
    type: value.type,
    value: value.value
  };
}

function parseProfessionalEmailDnsSetup(value: unknown, domain: string): ProfessionalEmailDnsSetup {
  const fallback = buildProfessionalEmailDnsSetup(domain);

  if (!isRecord(value)) {
    return fallback;
  }

  const records = Array.isArray(value.records)
    ? value.records
        .map(parseProfessionalEmailDnsRecord)
        .filter((record): record is ProfessionalEmailDnsRecord => Boolean(record))
    : fallback.records;
  const status =
    value.status === "dns_verified" || value.status === "failed" || value.status === "dns_pending"
      ? value.status
      : fallback.status;

  return {
    domain: typeof value.domain === "string" ? value.domain : domain,
    records: records.length ? records : fallback.records,
    status
  };
}

function parseProfessionalEmailOrderDraft(value: unknown): ProfessionalEmailOrderDraft | null {
  if (!isRecord(value) || value.status !== "draft") {
    return null;
  }

  const mailboxPlanRecord = isRecord(value.mailboxPlan) ? value.mailboxPlan : {};
  const mailboxPlan =
    typeof mailboxPlanRecord.id === "string"
      ? getProfessionalEmailMailboxPlan(mailboxPlanRecord.id)
      : null;
  const price = isRecord(value.price) ? value.price : {};

  if (
    typeof value.id !== "string" ||
    typeof value.storeId !== "string" ||
    typeof value.domain !== "string" ||
    typeof value.mailboxAddress !== "string" ||
    typeof value.createdAt !== "string" ||
    typeof value.allowanceUsed !== "number" ||
    typeof value.customerDueCents !== "number" ||
    !mailboxPlan
  ) {
    return null;
  }

  const customerDue =
    typeof value.customerDue === "number" ? value.customerDue : value.customerDueCents;
  const activationStatus = isProfessionalEmailActivationStatus(value.activationStatus)
    ? value.activationStatus
    : customerDue > 0
      ? "awaiting_payment"
      : "ready_for_activation";
  const activationStatuses = Array.isArray(value.activationStatuses)
    ? value.activationStatuses.filter(isProfessionalEmailActivationStatus)
    : professionalEmailActivationStatuses;
  const emailDnsSetup = parseProfessionalEmailDnsSetup(value.emailDnsSetup, value.domain);

  return {
    activationStatus,
    activationStatuses: activationStatuses.length ? activationStatuses : professionalEmailActivationStatuses,
    allowanceUsed: value.allowanceUsed,
    createdAt: value.createdAt,
    customerDue,
    customerDueCents: value.customerDueCents,
    domain: value.domain,
    emailDnsSetup,
    futureHookPoints: professionalEmailFutureHooks(),
    id: value.id,
    mailboxAddress: value.mailboxAddress,
    mailboxPlan,
    price: {
      monthlyCents:
        typeof price.monthlyCents === "number"
          ? price.monthlyCents
          : mailboxPlan.monthlyPriceCents,
      yearlyCents:
        typeof price.yearlyCents === "number"
          ? price.yearlyCents
          : mailboxPlan.yearlyPriceCents
    },
    status: "draft",
    storeId: value.storeId
  };
}

function parseProfessionalEmailOrderDrafts(storeData: unknown) {
  if (!isRecord(storeData) || !isRecord(storeData.professionalEmailOrderDrafts)) {
    return [];
  }

  return Object.values(storeData.professionalEmailOrderDrafts)
    .map(parseProfessionalEmailOrderDraft)
    .filter((draft): draft is ProfessionalEmailOrderDraft => Boolean(draft))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function connectedDomainStatusForWorkflow({
  isPrimary,
  workflow
}: {
  isPrimary: boolean;
  workflow: DomainRegistrationWorkflow;
}): ConnectedDomainStatus {
  if (isPrimary) {
    return "primary";
  }

  if (workflow.dnsSetup.status === "verified" && workflow.sslSetup.status === "ssl_active") {
    return "connected";
  }

  if (workflow.sslSetup.status === "ssl_active") {
    return "ssl_active";
  }

  if (workflow.sslSetup.status === "ssl_pending" || workflow.sslSetup.status === "ssl_provisioning") {
    return "ssl_pending";
  }

  if (workflow.dnsSetup.status === "verified") {
    return "dns_verified";
  }

  if (workflow.dnsSetup.status === "pending" || workflow.dnsSetup.status === "not_started") {
    return "dns_pending";
  }

  return "ready_for_registration";
}

function buildConnectedDomainSummaries({
  checkoutPreviews,
  drafts,
  routingPreparations,
  storeId,
  workflows
}: {
  checkoutPreviews: DomainCheckoutPreview[];
  drafts: DomainOrderDraft[];
  routingPreparations: DomainRoutingPreparation[];
  storeId: string;
  workflows: DomainRegistrationWorkflow[];
}): ConnectedDomainSummary[] {
  const primaryDomains = new Set(routingPreparations.map((preparation) => preparation.primaryDomain));
  const connectedDomains = new Map<string, ConnectedDomainSummary>();

  for (const draft of drafts) {
    connectedDomains.set(draft.selectedDomain, {
      canPreparePrimary: false,
      dnsStatus: "not_started",
      domain: draft.selectedDomain,
      isPrimary: false,
      sourceId: draft.id,
      sslStatus: "ssl_pending",
      status: "draft",
      storeId
    });
  }

  for (const preview of checkoutPreviews) {
    connectedDomains.set(preview.domain, {
      canPreparePrimary: false,
      dnsStatus: "not_started",
      domain: preview.domain,
      isPrimary: false,
      sourceId: preview.id,
      sslStatus: "ssl_pending",
      status: preview.customerDueCents > 0 ? "awaiting_payment" : "ready_for_registration",
      storeId
    });
  }

  for (const workflow of workflows) {
    const isPrimary = primaryDomains.has(workflow.domain);
    const canPreparePrimary =
      workflow.dnsSetup.status === "verified" &&
      workflow.sslSetup.status === "ssl_active" &&
      !isPrimary;

    connectedDomains.set(workflow.domain, {
      canPreparePrimary,
      dnsStatus: workflow.dnsSetup.status,
      domain: workflow.domain,
      isPrimary,
      sourceId: workflow.id,
      sslStatus: workflow.sslSetup.status,
      status: connectedDomainStatusForWorkflow({ isPrimary, workflow }),
      storeId
    });
  }

  return Array.from(connectedDomains.values()).sort((a, b) => {
    if (a.isPrimary !== b.isPrimary) {
      return a.isPrimary ? -1 : 1;
    }

    return a.domain.localeCompare(b.domain);
  });
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
      connectedDomains: [],
      domainCheckoutPreviews: [],
      domainRegistrationWorkflows: [],
      domainRoutingPreparations: [],
      domains: [],
      domainOrderDrafts: [],
      domainBase: getDomainBase(),
      error: null,
      logs: [],
      hostinshHooks: [],
      professionalEmailMailboxDrafts: [],
      professionalEmailOrderDrafts: [],
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
      connectedDomains: [],
      domainCheckoutPreviews: [],
      domainRegistrationWorkflows: [],
      domainRoutingPreparations: [],
      domains: [],
      domainOrderDrafts: [],
      domainBase: getDomainBase(),
      error: "Unable to load buyer stores for domain management.",
      logs: [],
      hostinshHooks: [],
      professionalEmailMailboxDrafts: [],
      professionalEmailOrderDrafts: [],
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
      connectedDomains: [],
      domainCheckoutPreviews: [],
      domainRegistrationWorkflows: [],
      domainRoutingPreparations: [],
      domains: [],
      domainOrderDrafts: [],
      domainBase: getDomainBase(),
      error: null,
      logs: [],
      hostinshHooks: [],
      professionalEmailMailboxDrafts: [],
      professionalEmailOrderDrafts: [],
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

  const domainCheckoutPreviews = parseDomainCheckoutPreviews(storeData);
  const domainOrderDrafts = parseDomainOrderDrafts(storeData);
  const domainRegistrationWorkflows = parseDomainRegistrationWorkflows(storeData);
  const domainRoutingPreparations = parseDomainRoutingPreparations(storeData);
  const professionalEmailMailboxDrafts = parseProfessionalEmailMailboxDrafts(storeData);
  const professionalEmailOrderDrafts = parseProfessionalEmailOrderDrafts(storeData);

  return {
    activeStore,
    availability: await checkSubdomainAvailability(supabase, availabilitySubdomain),
    connectedDomains: buildConnectedDomainSummaries({
      checkoutPreviews: domainCheckoutPreviews,
      drafts: domainOrderDrafts,
      routingPreparations: domainRoutingPreparations,
      storeId: activeStore.id,
      workflows: domainRegistrationWorkflows
    }),
    domainCheckoutPreviews,
    domainRegistrationWorkflows,
    domainRoutingPreparations,
    domains,
    domainOrderDrafts,
    domainBase: getDomainBase(),
    error:
      domainsResult.error && !isMissingStoreDomainsTable(domainsResult.error)
        ? "Unable to load domains for this store."
        : null,
    logs: logsResult.error ? [] : ((logsResult.data ?? []) as StoreDomainVerificationLog[]),
    hostinshHooks,
    professionalEmailMailboxDrafts,
    professionalEmailOrderDrafts,
    provisioning: Object.fromEntries(
      domains.map((domain) => [domain.id, buildProvisioning(domain)])
    ),
    reservedSubdomains: getReservedSubdomains(),
    ready: !isMissingStoreDomainsTable(domainsResult.error),
    stores
  };
}
