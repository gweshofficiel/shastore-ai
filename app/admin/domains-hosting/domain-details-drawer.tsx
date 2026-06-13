"use client";

import { useActionState, useMemo, useState, type MouseEvent, type ReactNode } from "react";
import {
  AdminBadge,
  AdminTable,
  formatAdminDate,
  formatAdminMoney
} from "@/components/admin/admin-control";
import type { AdminDomainsHostingControl } from "@/lib/admin/data";

type DomainOrder = AdminDomainsHostingControl["domainOrders"][number];
type SslStatus = AdminDomainsHostingControl["sslStatuses"][number];

type DomainAction = (formData: FormData) => void | Promise<void>;
type DomainStatusSyncState = {
  message: string | null;
  ok: boolean;
  providerStatus: "active" | "failed" | "locked_processing" | "pending" | "suspended" | "unknown" | null;
  syncedAt: string | null;
};
type DomainStatusSyncAction = (
  prevState: DomainStatusSyncState,
  formData: FormData
) => DomainStatusSyncState | Promise<DomainStatusSyncState>;
type DomainRegistrationRetryState = {
  attemptedAt: string | null;
  message: string | null;
  ok: boolean;
  providerOrderId: string | null;
  status: string | null;
};
type DomainRegistrationRetryAction = (
  prevState: DomainRegistrationRetryState,
  formData: FormData
) => DomainRegistrationRetryState | Promise<DomainRegistrationRetryState>;

type FailedOperationType =
  | "availability_failed"
  | "checkout_draft_failed"
  | "contact_create_failed"
  | "dns_failed"
  | "locked_for_processing"
  | "missing_provider_data"
  | "provider_order_failed"
  | "registration_failed"
  | "ssl_failed"
  | "dns_ssl_pending";

type FailedOperation = {
  operationType: FailedOperationType;
  order: DomainOrder;
};

type ProviderFundingStatus = "Critical" | "Error" | "Healthy" | "Low balance" | "Unknown";

type ProviderBalanceSummary = {
  availableBalance: string | null;
  blockedOrders: DomainOrder[];
  lastChecked: string | null;
  lastFundingError: string | null;
  status: ProviderFundingStatus;
};

type ContactRole = "admin" | "billing" | "registrant" | "tech";
type ContactCompletenessStatus = "Complete" | "Missing contact ids" | "Missing registrant" | "Unknown";
type ContactIssueType = "missing_contact_id" | "missing_registrant" | "ownership_risk" | "unknown_contact_data";

type ContactSnapshot = {
  email: string | null;
  id: string | null;
  name: string | null;
};

type DomainContactVisibility = {
  admin: ContactSnapshot;
  billing: ContactSnapshot;
  completeness: ContactCompletenessStatus;
  issueTypes: ContactIssueType[];
  missingFields: string[];
  order: DomainOrder;
  ownershipRisk: boolean;
  registrant: ContactSnapshot;
  tech: ContactSnapshot;
};

type DomainDetailsDrawerProps = {
  canRetryDomainRegistration: boolean;
  clearDomainReview: DomainAction;
  domainOrders: DomainOrder[];
  markDomainUnderReview: DomainAction;
  retryDomainRegistrationAction: DomainRegistrationRetryAction;
  sslStatuses: SslStatus[];
  syncDomainOrderStatusAction: DomainStatusSyncAction;
  viewInternalTimeline: DomainAction;
};

type StatusFilter =
  | "all"
  | "connected"
  | "dns_pending"
  | "draft"
  | "failed"
  | "locked_processing"
  | "pending"
  | "registered"
  | "ssl_pending"
  | "submitted";

type ProviderFilter = "all" | "httpapi" | "unknown";
type TimeFilter = "all" | "today" | "last_7_days" | "last_30_days";

type DomainFilters = {
  owner: string;
  provider: ProviderFilter;
  search: string;
  status: StatusFilter;
  store: string;
  time: TimeFilter;
};

function statusTone(status: string) {
  if (["active", "connected", "ready_for_registration", "ready", "verified", "ssl_active"].includes(status)) {
    return "green" as const;
  }

  if (status.includes("failed")) {
    return "red" as const;
  }

  if (status === "placeholder") {
    return "blue" as const;
  }

  return "amber" as const;
}

function displayValue(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "Not captured";
  }

  return String(value);
}

function normalizedText(value: string | number | null | undefined) {
  return String(value ?? "").toLowerCase();
}

function dateForFilter(value: string | null | undefined) {
  const date = new Date(value ?? "");

  return Number.isNaN(date.getTime()) ? null : date;
}

function matchesTimeFilter(value: string | null | undefined, filter: TimeFilter) {
  if (filter === "all") {
    return true;
  }

  const date = dateForFilter(value);

  if (!date) {
    return false;
  }

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (filter === "today") {
    return date >= startOfToday;
  }

  const days = filter === "last_7_days" ? 7 : 30;
  const cutoff = new Date(now);
  cutoff.setDate(now.getDate() - days);

  return date >= cutoff;
}

function domainSearchText(order: DomainOrder) {
  return [
    order.domain,
    order.storeName,
    order.ownerEmail,
    order.providerOrderId,
    order.providerEntityId,
    order.providerStatusSyncedAt,
    order.providerCustomerId,
    order.registrantContactId,
    order.adminContactId,
    order.techContactId,
    order.billingContactId,
    order.providerErrorMessage,
    order.status
  ]
    .map((value) => normalizedText(value))
    .join(" ");
}

function sslSearchText(domain: SslStatus) {
  return [
    domain.domain,
    domain.storeName,
    domain.ownerEmail,
    domain.dnsStatus,
    domain.sslStatus,
    domain.primaryDomainStatus
  ]
    .map((value) => normalizedText(value))
    .join(" ");
}

function orderProvider(order: DomainOrder) {
  return order.provider?.toLowerCase() || "unknown";
}

function sslProvider(domain: SslStatus) {
  return domain.provider?.toLowerCase() || "unknown";
}

function orderStatusMatches(order: DomainOrder, filter: StatusFilter) {
  const status = order.status.toLowerCase();

  if (filter === "all") return true;
  if (filter === "draft") return status === "draft";
  if (filter === "pending") return status.includes("pending");
  if (filter === "submitted") return status === "submitted" || status === "registration_pending";
  if (filter === "registered") return status === "registration_completed";
  if (filter === "failed") return status.includes("failed") || Boolean(order.providerErrorMessage);
  if (filter === "locked_processing") return ["ready_for_registration", "registration_pending", "registration_processing"].includes(status);
  if (filter === "dns_pending") return status === "awaiting_dns" || order.nextStep.toLowerCase().includes("verify dns");
  if (filter === "ssl_pending") return status === "ssl_pending" || order.nextStep.toLowerCase().includes("request ssl");
  if (filter === "connected") return status === "connected" || status === "active" || status === "ssl_active";

  return true;
}

function sslStatusMatches(domain: SslStatus, filter: StatusFilter) {
  const dnsStatus = domain.dnsStatus.toLowerCase();
  const sslStatus = domain.sslStatus.toLowerCase();
  const primaryStatus = domain.primaryDomainStatus.toLowerCase();

  if (filter === "all") return true;
  if (filter === "failed") return dnsStatus.includes("failed") || sslStatus.includes("failed");
  if (filter === "dns_pending") return dnsStatus !== "verified";
  if (filter === "ssl_pending") return sslStatus !== "ssl_active";
  if (filter === "connected") return sslStatus === "ssl_active" || primaryStatus === "primary";
  if (filter === "pending") return dnsStatus.includes("pending") || sslStatus.includes("pending");

  return false;
}

function domainMatchesFilters(order: DomainOrder, filters: DomainFilters) {
  const query = filters.search.trim().toLowerCase();

  return (
    (!query || domainSearchText(order).includes(query)) &&
    orderStatusMatches(order, filters.status) &&
    (filters.provider === "all" || orderProvider(order) === filters.provider) &&
    (filters.store === "all" || order.storeName === filters.store) &&
    (filters.owner === "all" || order.ownerEmail === filters.owner) &&
    matchesTimeFilter(order.updatedAt || order.createdAt, filters.time)
  );
}

function sslMatchesFilters(domain: SslStatus, filters: DomainFilters) {
  const query = filters.search.trim().toLowerCase();

  return (
    (!query || sslSearchText(domain).includes(query)) &&
    sslStatusMatches(domain, filters.status) &&
    (filters.provider === "all" || sslProvider(domain) === filters.provider) &&
    (filters.store === "all" || domain.storeName === filters.store) &&
    (filters.owner === "all" || domain.ownerEmail === filters.owner) &&
    matchesTimeFilter(domain.createdAt, filters.time)
  );
}

function activeFilterCount(filters: DomainFilters) {
  return [
    filters.search.trim(),
    filters.status !== "all",
    filters.provider !== "all",
    filters.store !== "all",
    filters.owner !== "all",
    filters.time !== "all"
  ].filter(Boolean).length;
}

function timelineTone(status: DomainOrder["timelineEvents"][number]["status"]) {
  const tones = {
    failed: "red",
    info: "blue",
    pending: "amber",
    success: "green"
  } as const;

  return tones[status];
}

function formatTimelineTimestamp(value: string | null) {
  if (!value) {
    return "Timestamp unavailable";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Timestamp unavailable";
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
}

function hasProviderResponse(value: unknown) {
  if (!value) {
    return false;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (typeof value === "object") {
    return Object.keys(value as Record<string, unknown>).length > 0;
  }

  return true;
}

function providerResponseText(value: unknown): string {
  if (!value) {
    return "";
  }

  try {
    return JSON.stringify(value).toLowerCase();
  } catch {
    return String(value).toLowerCase();
  }
}

function isFundingErrorText(value: string | null | undefined) {
  const text = normalizedText(value);

  return (
    text.includes("insufficient funds") ||
    text.includes("debit account") ||
    text.includes("order locked for processing") ||
    text.includes("locked for processing")
  );
}

function isFundingBlockedOrder(order: DomainOrder) {
  const combined = [
    order.providerErrorMessage,
    order.nextStep,
    order.status,
    providerResponseText(order.providerResponse),
    ...order.timelineEvents.flatMap((event) => [
      event.label,
      event.providerError,
      event.providerMessage
    ])
  ]
    .map((value) => normalizedText(value))
    .join(" ");

  return isFundingErrorText(combined);
}

function latestDate(values: Array<string | null | undefined>) {
  return values
    .map((value) => {
      const date = dateForFilter(value);

      return date ? { date, value: value ?? null } : null;
    })
    .filter((item): item is { date: Date; value: string | null } => Boolean(item))
    .sort((left, right) => right.date.getTime() - left.date.getTime())[0]?.value ?? null;
}

function findBalanceValue(value: unknown): string | null {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const balance = findBalanceValue(item);

      if (balance) {
        return balance;
      }
    }

    return null;
  }

  if (typeof value !== "object") {
    return null;
  }

  for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
    const normalizedKey = key.toLowerCase();

    if (
      normalizedKey.includes("balance") ||
      normalizedKey.includes("availablefunds") ||
      normalizedKey.includes("available-funds")
    ) {
      const direct = displayValue(nestedValue as string | number | null | undefined);

      if (direct !== "Not captured") {
        return direct;
      }
    }

    const nestedBalance = findBalanceValue(nestedValue);

    if (nestedBalance) {
      return nestedBalance;
    }
  }

  return null;
}

function numericBalance(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = Number(value.replace(/[^0-9.-]/g, ""));

  return Number.isFinite(parsed) ? parsed : null;
}

function providerBalanceSummary(domainOrders: DomainOrder[]): ProviderBalanceSummary {
  const blockedOrders = domainOrders.filter(isFundingBlockedOrder);
  const availableBalance =
    domainOrders.map((order) => findBalanceValue(order.providerResponse)).find(Boolean) ?? null;
  const balanceAmount = numericBalance(availableBalance);
  const lastFundingError =
    blockedOrders.find((order) => order.providerErrorMessage)?.providerErrorMessage ??
    blockedOrders.flatMap((order) => order.timelineEvents).find((event) => isFundingErrorText(event.providerError ?? event.providerMessage))?.providerError ??
    blockedOrders.flatMap((order) => order.timelineEvents).find((event) => isFundingErrorText(event.providerMessage))?.providerMessage ??
    null;
  const status: ProviderFundingStatus = blockedOrders.length
    ? "Critical"
    : balanceAmount === null
      ? "Unknown"
      : balanceAmount <= 0
        ? "Critical"
        : balanceAmount < 50
          ? "Low balance"
          : "Healthy";

  return {
    availableBalance,
    blockedOrders,
    lastChecked: latestDate(domainOrders.map((order) => order.updatedAt || order.createdAt)),
    lastFundingError,
    status
  };
}

function providerFundingTone(status: ProviderFundingStatus) {
  if (status === "Healthy") return "green" as const;
  if (status === "Low balance") return "amber" as const;
  if (status === "Critical" || status === "Error") return "red" as const;

  return "blue" as const;
}

function isRecordValue(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function textFromUnknown(value: unknown) {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function firstNestedText(value: unknown, keys: string[]): string | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = firstNestedText(item, keys);

      if (nested) {
        return nested;
      }
    }

    return null;
  }

  if (!isRecordValue(value)) {
    return null;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");

    if (keys.includes(normalizedKey)) {
      const direct = textFromUnknown(nestedValue);

      if (direct) {
        return direct;
      }
    }
  }

  for (const nestedValue of Object.values(value)) {
    const nested = firstNestedText(nestedValue, keys);

    if (nested) {
      return nested;
    }
  }

  return null;
}

function latestProviderStatus(order: DomainOrder) {
  return firstNestedText(order.providerResponse, ["latestproviderstatus", "providerstatus"]);
}

function isRetryVisibleForOrder(order: DomainOrder) {
  const status = order.status.toLowerCase();
  const providerStatus = latestProviderStatus(order)?.toLowerCase() ?? "";

  if (status === "active" || providerStatus === "active") {
    return false;
  }

  return status === "failed" || providerStatus === "locked_processing";
}

const contactNameKeys = ["contactname", "customername", "name", "registrantname"];
const contactEmailKeys = ["contactemail", "customeremail", "email", "registrantemail"];

function contactResponseSection(value: unknown, role: ContactRole): unknown {
  if (Array.isArray(value)) {
    for (const item of value) {
      const section = contactResponseSection(item, role);

      if (section) {
        return section;
      }
    }

    return null;
  }

  if (!isRecordValue(value)) {
    return null;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");

    if (normalizedKey.includes(role) && isRecordValue(nestedValue)) {
      return nestedValue;
    }
  }

  for (const nestedValue of Object.values(value)) {
    const section = contactResponseSection(nestedValue, role);

    if (section) {
      return section;
    }
  }

  return null;
}

function roleContactDetails(order: DomainOrder, role: ContactRole, id: string | null): ContactSnapshot {
  const roleSection = contactResponseSection(order.providerResponse, role);
  const fallbackResponse = role === "registrant" ? order.providerResponse : null;

  return {
    email: firstNestedText(roleSection, contactEmailKeys) ?? firstNestedText(fallbackResponse, contactEmailKeys),
    id,
    name: firstNestedText(roleSection, contactNameKeys) ?? firstNestedText(fallbackResponse, contactNameKeys)
  };
}

function contactCompleteness(order: DomainOrder): ContactCompletenessStatus {
  const contactIds = [
    order.registrantContactId,
    order.adminContactId,
    order.techContactId,
    order.billingContactId
  ];

  if (!order.providerCustomerId && contactIds.every((id) => !id)) {
    return "Unknown";
  }

  if (!order.registrantContactId) {
    return "Missing registrant";
  }

  if (contactIds.some((id) => !id)) {
    return "Missing contact ids";
  }

  return "Complete";
}

function ownershipRisk(order: DomainOrder, registrant: ContactSnapshot) {
  const registrantEmail = normalizedText(registrant.email);
  const ownerEmail = normalizedText(order.ownerEmail);
  const registrantText = `${normalizedText(registrant.name)} ${registrantEmail}`;
  const platformSignals = ["httpapi", "resell.biz", "shastore", "provider", "platform"];

  if (registrantEmail && ownerEmail && ownerEmail !== "unknown owner" && registrantEmail !== ownerEmail) {
    return true;
  }

  return platformSignals.some((signal) => registrantText.includes(signal));
}

function contactVisibilityForOrder(order: DomainOrder): DomainContactVisibility {
  const registrant = roleContactDetails(order, "registrant", order.registrantContactId);
  const admin = roleContactDetails(order, "admin", order.adminContactId);
  const tech = roleContactDetails(order, "tech", order.techContactId);
  const billing = roleContactDetails(order, "billing", order.billingContactId);
  const completeness = contactCompleteness(order);
  const missingFields = [
    !order.providerCustomerId ? "customer id" : null,
    !order.registrantContactId ? "registrant contact id" : null,
    !order.adminContactId ? "admin contact id" : null,
    !order.techContactId ? "tech contact id" : null,
    !order.billingContactId ? "billing contact id" : null
  ].filter((field): field is string => Boolean(field));
  const risk = ownershipRisk(order, registrant);
  const issueTypes: ContactIssueType[] = [
    completeness === "Missing contact ids" ? "missing_contact_id" : null,
    completeness === "Missing registrant" ? "missing_registrant" : null,
    completeness === "Unknown" ? "unknown_contact_data" : null,
    risk ? "ownership_risk" : null
  ].filter((issue): issue is ContactIssueType => Boolean(issue));

  return {
    admin,
    billing,
    completeness,
    issueTypes,
    missingFields,
    order,
    ownershipRisk: risk,
    registrant,
    tech
  };
}

function contactCompletenessTone(status: ContactCompletenessStatus) {
  if (status === "Complete") return "green" as const;
  if (status === "Unknown") return "blue" as const;

  return "amber" as const;
}

function contactIssueLabel(issue: ContactIssueType) {
  return issue.replace(/_/g, " ");
}

const sensitiveProviderKeyParts = [
  "apikey",
  "auth",
  "authorization",
  "password",
  "privatekey",
  "secret",
  "token"
];

function normalizedSensitiveKey(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isSensitiveProviderKey(key: string) {
  const normalizedKey = normalizedSensitiveKey(key);

  return sensitiveProviderKeyParts.some((part) => normalizedKey.includes(part));
}

function maskSensitiveString(value: string) {
  return value
    .replace(
      /((?:api[-_]?key|api_key|token|secret|password|auth|authorization|private[-_]?key)=)[^&\s"']+/gi,
      "$1[REDACTED]"
    )
    .replace(
      /((?:api[-_]?key|api_key|token|secret|password|auth|authorization|private[-_]?key)["']?\s*:\s*["']?)[^"',}\s]+/gi,
      "$1[REDACTED]"
    );
}

function sanitizeProviderPayload(value: unknown, key = ""): unknown {
  if (key && isSensitiveProviderKey(key)) {
    return "[REDACTED]";
  }

  if (typeof value === "string") {
    return maskSensitiveString(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeProviderPayload(item));
  }

  if (!isRecordValue(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([entryKey, entryValue]) => [
      entryKey,
      sanitizeProviderPayload(entryValue, entryKey)
    ])
  );
}

function sanitizedProviderJson(value: unknown) {
  if (!hasProviderResponse(value)) {
    return null;
  }

  return JSON.stringify(sanitizeProviderPayload(value), null, 2);
}

function safeDownloadName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9.-]+/g, "-").replace(/^-+|-+$/g, "") || "domain-audit";
}

function downloadTextFile(filename: string, contents: string, type: string) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function auditJsonForOrder(order: DomainOrder) {
  return {
    contact_ids: {
      admin_contact_id: order.adminContactId,
      billing_contact_id: order.billingContactId,
      registrant_contact_id: order.registrantContactId,
      tech_contact_id: order.techContactId
    },
    created_at: order.createdAt,
    domain_overview: {
      domain: order.domain,
      extension: order.extension,
      registration_years: order.registrationYears
    },
    error_message: order.providerErrorMessage,
    owner_info: {
      owner_email: order.ownerEmail
    },
    provider_ids: {
      customer_id: order.providerCustomerId,
      order_id: order.providerOrderId,
      provider: order.provider
    },
    sanitized_provider_response: sanitizeProviderPayload(order.providerResponse),
    status: order.status,
    store_info: {
      store_id: order.storeId,
      store_name: order.storeName
    },
    timeline_events: order.timelineEvents,
    updated_at: order.updatedAt
  };
}

function csvValue(value: string | number | null | undefined) {
  const text = String(value ?? "");

  return `"${text.replace(/"/g, '""')}"`;
}

function failedOperationsCsv(operations: FailedOperation[]) {
  const headers = [
    "domain",
    "store",
    "owner email",
    "provider",
    "provider order id",
    "status",
    "operation type",
    "error message",
    "created at",
    "updated at"
  ];
  const rows = operations.map(({ operationType, order }) => [
    order.domain,
    order.storeName,
    order.ownerEmail,
    order.provider,
    order.providerOrderId,
    order.status,
    operationLabel(operationType),
    order.providerErrorMessage,
    order.createdAt,
    order.updatedAt
  ]);

  return [headers, ...rows].map((row) => row.map(csvValue).join(",")).join("\n");
}

function operationLabel(value: FailedOperationType) {
  return value.replace(/_/g, " ");
}

function operationFromDomain(order: DomainOrder): FailedOperation | null {
  const status = order.status.toLowerCase();
  const error = order.providerErrorMessage?.toLowerCase() ?? "";
  const nextStep = order.nextStep.toLowerCase();
  const timelineLabels = order.timelineEvents.map((event) => event.label.toLowerCase()).join(" ");
  const hasProviderData = Boolean(order.providerOrderId || order.providerResponse || order.providerErrorMessage);
  let operationType: FailedOperationType | null = null;

  if (status.includes("ssl_failed")) {
    operationType = "ssl_failed";
  } else if (status.includes("dns_failed")) {
    operationType = "dns_failed";
  } else if (error.includes("contact") || timelineLabels.includes("provider contact created")) {
    operationType = error ? "contact_create_failed" : null;
  } else if (order.providerErrorMessage) {
    operationType = order.providerOrderId ? "provider_order_failed" : "registration_failed";
  } else if (status.includes("registration_failed")) {
    operationType = "registration_failed";
  } else if (status.includes("failed")) {
    operationType = status.includes("draft") ? "checkout_draft_failed" : "availability_failed";
  } else if (["ready_for_registration", "registration_pending", "registration_processing"].includes(status)) {
    operationType = "locked_for_processing";
  } else if (!hasProviderData && order.provider && status !== "draft") {
    operationType = "missing_provider_data";
  } else if (
    status === "awaiting_dns" ||
    status === "ssl_pending" ||
    nextStep.includes("verify dns") ||
    nextStep.includes("request ssl")
  ) {
    operationType = "dns_ssl_pending";
  }

  if (!operationType) {
    return null;
  }

  return {
    operationType,
    order
  };
}

const defaultDomainFilters: DomainFilters = {
  owner: "all",
  provider: "all",
  search: "",
  status: "all",
  store: "all",
  time: "all"
};

const statusFilterOptions: Array<{ label: string; value: StatusFilter }> = [
  { label: "All", value: "all" },
  { label: "Draft", value: "draft" },
  { label: "Pending", value: "pending" },
  { label: "Submitted", value: "submitted" },
  { label: "Registered", value: "registered" },
  { label: "Failed", value: "failed" },
  { label: "Locked Processing", value: "locked_processing" },
  { label: "DNS Pending", value: "dns_pending" },
  { label: "SSL Pending", value: "ssl_pending" },
  { label: "Connected", value: "connected" }
];

const providerFilterOptions: Array<{ label: string; value: ProviderFilter }> = [
  { label: "All", value: "all" },
  { label: "HTTPAPI", value: "httpapi" },
  { label: "Unknown", value: "unknown" }
];

const timeFilterOptions: Array<{ label: string; value: TimeFilter }> = [
  { label: "All time", value: "all" },
  { label: "Today", value: "today" },
  { label: "Last 7 days", value: "last_7_days" },
  { label: "Last 30 days", value: "last_30_days" }
];

const domainOperationsCertification = [
  { label: "Details Drawer", status: "Ready" },
  { label: "Timeline", status: "Ready" },
  { label: "Failed Operations", status: "Ready" },
  { label: "Search & Filters", status: "Ready" },
  { label: "Provider Funds Monitoring", status: "Ready" },
  { label: "Contact Visibility", status: "Ready" },
  { label: "Raw Response Viewer", status: "Ready" },
  { label: "Audit Export", status: "Ready" }
] as const;

const initialDomainStatusSyncState: DomainStatusSyncState = {
  message: null,
  ok: false,
  providerStatus: null,
  syncedAt: null
};

const initialDomainRegistrationRetryState: DomainRegistrationRetryState = {
  attemptedAt: null,
  message: null,
  ok: false,
  providerOrderId: null,
  status: null
};

function DetailRow({
  label,
  value
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-slate-400">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-bold text-slate-800">
        {displayValue(value)}
      </p>
    </div>
  );
}

function RegistrationTimeline({ order }: { order: DomainOrder }) {
  const providerResponse = sanitizedProviderJson(order.providerResponse);

  return (
    <DetailSection title="Registration Timeline">
      <div className="grid gap-3">
        {order.timelineEvents.length ? (
          order.timelineEvents.map((event, index) => (
            <div
              className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
              key={`${event.label}-${index}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-black text-slate-900">{event.label}</p>
                <AdminBadge tone={timelineTone(event.status)}>{event.status}</AdminBadge>
              </div>
              <p className="mt-1 text-xs font-bold text-slate-500">
                {formatTimelineTimestamp(event.timestamp)}
              </p>
              {event.providerMessage ? (
                <p className="mt-2 text-xs font-semibold leading-5 text-slate-600">
                  Provider message: {event.providerMessage}
                </p>
              ) : null}
              {event.providerOrderId ? (
                <p className="mt-2 text-xs font-semibold leading-5 text-slate-600">
                  Provider order id: {event.providerOrderId}
                </p>
              ) : null}
              {event.providerError ? (
                <p className="mt-2 break-words rounded-xl border border-red-100 bg-red-50 p-2 text-xs font-bold leading-5 text-red-700">
                  Provider error: {event.providerError}
                </p>
              ) : null}
            </div>
          ))
        ) : (
          <p className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-500">
            No registration timeline events are stored for this domain yet.
          </p>
        )}
      </div>

      {providerResponse ? (
        <details className="mt-4 rounded-2xl border border-slate-200 bg-slate-950 p-3 text-slate-100">
          <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.16em] text-slate-300">
            Provider response
          </summary>
          <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words text-xs leading-5 text-slate-100">
            {providerResponse}
          </pre>
        </details>
      ) : null}
    </DetailSection>
  );
}

function RawProviderResponseSection({ order }: { order: DomainOrder }) {
  const [copyStatus, setCopyStatus] = useState<"copied" | "idle" | "unavailable">("idle");
  const providerJson = sanitizedProviderJson(order.providerResponse);
  const auditJson = JSON.stringify(auditJsonForOrder(order), null, 2);

  function copySanitizedJson() {
    if (!providerJson || !navigator.clipboard) {
      setCopyStatus("unavailable");
      return;
    }

    void navigator.clipboard.writeText(providerJson).then(
      () => setCopyStatus("copied"),
      () => setCopyStatus("unavailable")
    );
  }

  return (
    <DetailSection title="Raw Provider Response">
      <div className="flex flex-wrap gap-2">
        <button
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!providerJson}
          onClick={copySanitizedJson}
          type="button"
        >
          Copy sanitized JSON
        </button>
        <button
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-slate-700"
          onClick={() =>
            downloadTextFile(
              `${safeDownloadName(order.domain)}-domain-audit.json`,
              auditJson,
              "application/json;charset=utf-8"
            )
          }
          type="button"
        >
          Download audit JSON
        </button>
        {copyStatus !== "idle" ? (
          <span className="rounded-full bg-slate-100 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
            {copyStatus === "copied" ? "Copied" : "Copy unavailable"}
          </span>
        ) : null}
      </div>

      {providerJson ? (
        <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-2xl bg-slate-950 p-3 text-xs leading-5 text-slate-100">
          {providerJson}
        </pre>
      ) : (
        <p className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-500">
          No provider response stored yet.
        </p>
      )}
    </DetailSection>
  );
}

function DetailSection({
  children,
  title
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_18px_60px_-55px_rgba(15,23,42,0.9)]">
      <h3 className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">
        {title}
      </h3>
      <div className="mt-4 grid gap-3">{children}</div>
    </section>
  );
}

function FilterSelect<T extends string>({
  label,
  onChange,
  options,
  value
}: {
  label: string;
  onChange: (value: T) => void;
  options: Array<{ label: string; value: T }>;
  value: T;
}) {
  return (
    <label className="grid gap-2 text-xs font-black uppercase tracking-[0.16em] text-slate-400">
      {label}
      <select
        className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold normal-case tracking-normal text-slate-700 outline-none transition focus:border-blue-200 focus:ring-4 focus:ring-blue-100"
        onChange={(event) => onChange(event.target.value as T)}
        value={value}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function DomainGlobalFilters({
  activeCount,
  filters,
  ownerOptions,
  resetFilters,
  setFilters,
  storeOptions
}: {
  activeCount: number;
  filters: DomainFilters;
  ownerOptions: string[];
  resetFilters: () => void;
  setFilters: (filters: DomainFilters) => void;
  storeOptions: string[];
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_60px_-55px_rgba(15,23,42,0.9)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
            Domain operations filters
          </p>
          <h2 className="mt-2 text-xl font-black tracking-[-0.03em] text-slate-950">
            Search and filter all domain observability tables
          </h2>
          <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
            Active filters: {activeCount}
          </p>
        </div>
        <button
          className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-slate-600"
          onClick={resetFilters}
          type="button"
        >
          Reset filters
        </button>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-6">
        <label className="grid gap-2 text-xs font-black uppercase tracking-[0.16em] text-slate-400 lg:col-span-2">
          Global search
          <input
            className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold normal-case tracking-normal text-slate-700 outline-none transition focus:border-blue-200 focus:ring-4 focus:ring-blue-100"
            onChange={(event) => setFilters({ ...filters, search: event.target.value })}
            placeholder="Domain, store, owner, provider ids, error, status"
            type="search"
            value={filters.search}
          />
        </label>
        <FilterSelect
          label="Status"
          onChange={(status) => setFilters({ ...filters, status })}
          options={statusFilterOptions}
          value={filters.status}
        />
        <FilterSelect
          label="Provider"
          onChange={(provider) => setFilters({ ...filters, provider })}
          options={providerFilterOptions}
          value={filters.provider}
        />
        <FilterSelect
          label="Store"
          onChange={(store) => setFilters({ ...filters, store })}
          options={[
            { label: "All stores", value: "all" },
            ...storeOptions.map((store) => ({ label: store, value: store }))
          ]}
          value={filters.store}
        />
        <FilterSelect
          label="Owner"
          onChange={(owner) => setFilters({ ...filters, owner })}
          options={[
            { label: "All owners", value: "all" },
            ...ownerOptions.map((owner) => ({ label: owner, value: owner }))
          ]}
          value={filters.owner}
        />
        <FilterSelect
          label="Time"
          onChange={(time) => setFilters({ ...filters, time })}
          options={timeFilterOptions}
          value={filters.time}
        />
      </div>
    </section>
  );
}

function DomainOperationsCertificationCard() {
  return (
    <section className="rounded-3xl border border-emerald-100 bg-emerald-50/50 p-5 shadow-[0_18px_60px_-55px_rgba(15,23,42,0.9)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-500">
            Domain Operations Center v1
          </p>
          <h2 className="mt-2 text-xl font-black tracking-[-0.03em] text-slate-950">
            Read-only observability certification
          </h2>
          <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
            Super Admin monitoring only. No provider calls, retries, DNS/SSL automation, payments, migrations, or policy changes.
          </p>
        </div>
        <AdminBadge tone="green">Certified</AdminBadge>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {domainOperationsCertification.map((item) => (
          <div
            className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-100 bg-white p-3"
            key={item.label}
          >
            <span className="text-sm font-black text-slate-800">{item.label}</span>
            <AdminBadge tone="green">{item.status}</AdminBadge>
          </div>
        ))}
      </div>
    </section>
  );
}

function DomainActions({
  clearDomainReview,
  markDomainUnderReview,
  order,
  viewInternalTimeline
}: {
  clearDomainReview: DomainAction;
  markDomainUnderReview: DomainAction;
  order: DomainOrder;
  viewInternalTimeline: DomainAction;
}) {
  function stopRowClick(event: MouseEvent<HTMLDivElement>) {
    event.stopPropagation();
  }

  return (
    <div className="grid min-w-48 gap-2" onClick={stopRowClick}>
      <form action={markDomainUnderReview}>
        <input name="storeId" type="hidden" value={order.storeId} />
        <input name="targetId" type="hidden" value={order.id} />
        <input name="targetType" type="hidden" value="domain" />
        <button
          className="h-9 w-full rounded-full border border-amber-200 bg-amber-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-amber-700"
          type="submit"
        >
          Mark review
        </button>
      </form>
      <form action={clearDomainReview}>
        <input name="storeId" type="hidden" value={order.storeId} />
        <input name="targetId" type="hidden" value={order.id} />
        <input name="targetType" type="hidden" value="domain" />
        <button
          className="h-9 w-full rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-emerald-700"
          type="submit"
        >
          Clear review
        </button>
      </form>
      <form action={viewInternalTimeline}>
        <input name="storeId" type="hidden" value={order.storeId} />
        <input name="targetId" type="hidden" value={order.id} />
        <input name="targetType" type="hidden" value="domain" />
        <button
          className="h-9 w-full rounded-full border border-slate-200 bg-white px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-700"
          type="submit"
        >
          View timeline
        </button>
      </form>
    </div>
  );
}

function DomainStatusSyncControl({
  order,
  syncDomainOrderStatusAction
}: {
  order: DomainOrder;
  syncDomainOrderStatusAction: DomainStatusSyncAction;
}) {
  const [state, formAction, isPending] = useActionState(
    syncDomainOrderStatusAction,
    initialDomainStatusSyncState
  );
  const canSync = Boolean(order.domainOrderId && (order.providerOrderId || order.providerEntityId));

  return (
    <DetailSection title="Provider Status Sync">
      <p className="text-sm font-semibold leading-6 text-slate-500">
        Syncs the current provider status for this existing domain order only. It does not retry registration, charge, or mutate DNS/SSL.
      </p>

      <form action={formAction} className="grid gap-3">
        <input name="domainOrderId" type="hidden" value={order.domainOrderId ?? ""} />
        <button
          className="h-10 rounded-full border border-blue-200 bg-blue-50 px-4 text-xs font-black uppercase tracking-[0.14em] text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!canSync || isPending}
          type="submit"
        >
          {isPending ? "Syncing provider status..." : "Sync provider status"}
        </button>
      </form>

      {!canSync ? (
        <p className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-500">
          Sync requires an existing runtime domain order with a stored provider order id or provider entity id.
        </p>
      ) : null}

      {state.message ? (
        <p className={`rounded-2xl border p-3 text-sm font-bold leading-6 ${
          state.ok
            ? "border-emerald-100 bg-emerald-50 text-emerald-700"
            : "border-amber-100 bg-amber-50 text-amber-700"
        }`}>
          {state.message}
          {state.providerStatus ? ` Provider status: ${state.providerStatus}.` : ""}
          {state.syncedAt ? ` Synced: ${formatTimelineTimestamp(state.syncedAt)}.` : ""}
        </p>
      ) : null}
    </DetailSection>
  );
}

function DomainRegistrationRetryControl({
  canRetryDomainRegistration,
  order,
  retryDomainRegistrationAction
}: {
  canRetryDomainRegistration: boolean;
  order: DomainOrder;
  retryDomainRegistrationAction: DomainRegistrationRetryAction;
}) {
  const [state, formAction, isPending] = useActionState(
    retryDomainRegistrationAction,
    initialDomainRegistrationRetryState
  );
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const canRetry = canRetryDomainRegistration && Boolean(order.domainOrderId) && isRetryVisibleForOrder(order);

  if (!canRetry) {
    return null;
  }

  return (
    <DetailSection title="Registration Retry">
      <p className="text-sm font-semibold leading-6 text-slate-500">
        Super Admin-only manual retry for failed runtime domain orders. The server verifies provider status before submitting a new provider request.
      </p>

      <button
        className="h-10 rounded-full border border-red-200 bg-red-50 px-4 text-xs font-black uppercase tracking-[0.14em] text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={isPending}
        onClick={() => setIsConfirmOpen(true)}
        type="button"
      >
        {isPending ? "Retrying registration..." : "Retry registration"}
      </button>

      {state.message ? (
        <p className={`rounded-2xl border p-3 text-sm font-bold leading-6 ${
          state.ok
            ? "border-emerald-100 bg-emerald-50 text-emerald-700"
            : "border-amber-100 bg-amber-50 text-amber-700"
        }`}>
          {state.message}
          {state.status ? ` Status: ${state.status}.` : ""}
          {state.providerOrderId ? ` Provider order: ${state.providerOrderId}.` : ""}
          {state.attemptedAt ? ` Attempted: ${formatTimelineTimestamp(state.attemptedAt)}.` : ""}
        </p>
      ) : null}

      {isConfirmOpen ? (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/50 p-4">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-red-400">
              Confirm registration retry
            </p>
            <h3 className="mt-2 text-2xl font-black tracking-[-0.04em] text-slate-950">
              Retry registration?
            </h3>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
              Retrying may submit a new provider registration request. Continue?
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button
                className="h-10 rounded-full border border-slate-200 bg-white px-4 text-xs font-black uppercase tracking-[0.14em] text-slate-700"
                onClick={() => setIsConfirmOpen(false)}
                type="button"
              >
                Cancel
              </button>
              <form action={formAction} onSubmit={() => setIsConfirmOpen(false)}>
                <input name="domainOrderId" type="hidden" value={order.domainOrderId ?? ""} />
                <button
                  className="h-10 rounded-full border border-red-200 bg-red-600 px-4 text-xs font-black uppercase tracking-[0.14em] text-white disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isPending}
                  type="submit"
                >
                  Continue retry
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </DetailSection>
  );
}

function FailedOperationsCenter({
  operations,
  setSelectedDomainId
}: {
  operations: FailedOperation[];
  setSelectedDomainId: (id: string) => void;
}) {
  return (
    <section className="rounded-3xl border border-red-100 bg-red-50/40 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-red-400">
            Failed Operations Center
          </p>
          <h2 className="mt-2 text-xl font-black tracking-[-0.03em] text-slate-950">
            Domain operations needing review
          </h2>
          <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
            Read-only view built from stored domain drafts, workflows, provider responses, and DNS/SSL status.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="rounded-full border border-red-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-red-700"
            onClick={() =>
              downloadTextFile(
                "domain-failed-operations-audit.csv",
                failedOperationsCsv(operations),
                "text/csv;charset=utf-8"
              )
            }
            type="button"
          >
            Download audit CSV
          </button>
          <AdminBadge tone="red">{operations.length} visible</AdminBadge>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-3xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-black uppercase tracking-[0.16em] text-slate-400">
              <tr>
                <th className="px-4 py-3">Domain</th>
                <th className="px-4 py-3">Store</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">Operation</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Provider</th>
                <th className="px-4 py-3">Provider order</th>
                <th className="px-4 py-3">Provider error</th>
                <th className="px-4 py-3">Updated</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {operations.map(({ operationType, order }) => (
                <tr key={`${operationType}-${order.id}`}>
                  <td className="px-4 py-3 font-black text-slate-950">{order.domain}</td>
                  <td className="px-4 py-3 font-semibold text-slate-600">{order.storeName}</td>
                  <td className="px-4 py-3 text-slate-600">{order.ownerEmail}</td>
                  <td className="px-4 py-3"><AdminBadge tone="red">{operationLabel(operationType)}</AdminBadge></td>
                  <td className="px-4 py-3"><AdminBadge tone={statusTone(order.status)}>{order.status}</AdminBadge></td>
                  <td className="px-4 py-3 text-slate-600">{displayValue(order.provider)}</td>
                  <td className="px-4 py-3 text-slate-600">{displayValue(order.providerOrderId)}</td>
                  <td className="max-w-xs px-4 py-3 text-slate-600">
                    <span className="line-clamp-2">{displayValue(order.providerErrorMessage)}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{formatAdminDate(order.updatedAt)}</td>
                  <td className="px-4 py-3">
                    <button
                      className="h-9 rounded-full border border-slate-200 bg-white px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-700"
                      onClick={() => setSelectedDomainId(order.id)}
                      type="button"
                    >
                      View details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!operations.length ? (
          <div className="p-5 text-sm font-semibold leading-6 text-slate-500">
            No failed or blocked domain operations match the current filters.
          </div>
        ) : null}
      </div>
    </section>
  );
}

function ProviderBalanceMonitoringPanel({
  setSelectedDomainId,
  summary
}: {
  setSelectedDomainId: (id: string) => void;
  summary: ProviderBalanceSummary;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_60px_-55px_rgba(15,23,42,0.9)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
            Provider Balance & Funds Monitoring
          </p>
          <h2 className="mt-2 text-xl font-black tracking-[-0.03em] text-slate-950">
            HTTPAPI / Resell.biz funding risk
          </h2>
          <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
            Provider balance check not connected yet. Risk is derived from stored provider responses and errors only.
          </p>
        </div>
        <AdminBadge tone={providerFundingTone(summary.status)}>{summary.status}</AdminBadge>
      </div>

      {summary.blockedOrders.length ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-800">
          Some domain registrations are blocked because the provider account may have insufficient funds.
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <DetailRow label="Provider" value="HTTPAPI / Resell.biz" />
        <DetailRow label="Available balance" value={summary.availableBalance ?? "Provider balance check not connected yet"} />
        <DetailRow label="Last checked" value={summary.lastChecked ? formatTimelineTimestamp(summary.lastChecked) : "Provider balance check not connected yet"} />
        <DetailRow label="Last funding error" value={summary.lastFundingError} />
        <DetailRow label="Blocked orders" value={summary.blockedOrders.length} />
      </div>

      <div className="mt-5 overflow-hidden rounded-3xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
            Blocked Funding Orders
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-black uppercase tracking-[0.16em] text-slate-400">
              <tr>
                <th className="px-4 py-3">Domain</th>
                <th className="px-4 py-3">Provider order</th>
                <th className="px-4 py-3">Store</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">Error message</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Updated</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {summary.blockedOrders.map((order) => (
                <tr key={order.id}>
                  <td className="px-4 py-3 font-black text-slate-950">{order.domain}</td>
                  <td className="px-4 py-3 text-slate-600">{displayValue(order.providerOrderId)}</td>
                  <td className="px-4 py-3 text-slate-600">{order.storeName}</td>
                  <td className="px-4 py-3 text-slate-600">{order.ownerEmail}</td>
                  <td className="max-w-xs px-4 py-3 text-slate-600">
                    <span className="line-clamp-2">{displayValue(order.providerErrorMessage ?? summary.lastFundingError)}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{formatAdminDate(order.createdAt)}</td>
                  <td className="px-4 py-3 text-slate-600">{formatAdminDate(order.updatedAt)}</td>
                  <td className="px-4 py-3">
                    <button
                      className="h-9 rounded-full border border-slate-200 bg-white px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-700"
                      onClick={() => setSelectedDomainId(order.id)}
                      type="button"
                    >
                      View details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!summary.blockedOrders.length ? (
          <div className="p-5 text-sm font-semibold leading-6 text-slate-500">
            No stored domain orders currently indicate insufficient funds or locked provider processing.
          </div>
        ) : null}
      </div>
    </section>
  );
}

function DomainOwnershipContactsPanel({
  contacts,
  setSelectedDomainId
}: {
  contacts: DomainContactVisibility[];
  setSelectedDomainId: (id: string) => void;
}) {
  const issues = contacts.flatMap((contact) =>
    contact.issueTypes.map((issueType) => ({
      contact,
      issueType
    }))
  );

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_60px_-55px_rgba(15,23,42,0.9)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
            Domain Ownership & Contacts
          </p>
          <h2 className="mt-2 text-xl font-black tracking-[-0.03em] text-slate-950">
            Contact IDs used for domain registration
          </h2>
          <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
            Read-only view from stored domain order data and masked provider responses. No contacts are created or updated here.
          </p>
        </div>
        <AdminBadge tone={issues.length ? "amber" : "green"}>{issues.length} issues</AdminBadge>
      </div>

      {contacts.some((contact) => contact.ownershipRisk) ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-800">
          Registrant contact may not match the store owner.
        </div>
      ) : null}

      <div className="mt-5 overflow-hidden rounded-3xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1500px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-black uppercase tracking-[0.16em] text-slate-400">
              <tr>
                <th className="px-4 py-3">Domain</th>
                <th className="px-4 py-3">Store</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">Customer id</th>
                <th className="px-4 py-3">Registrant contact</th>
                <th className="px-4 py-3">Admin contact</th>
                <th className="px-4 py-3">Tech contact</th>
                <th className="px-4 py-3">Billing contact</th>
                <th className="px-4 py-3">Registrant name/email</th>
                <th className="px-4 py-3">Admin name/email</th>
                <th className="px-4 py-3">Tech name/email</th>
                <th className="px-4 py-3">Billing name/email</th>
                <th className="px-4 py-3">Completeness</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {contacts.map((contact) => (
                <tr key={contact.order.id}>
                  <td className="px-4 py-3 font-black text-slate-950">{contact.order.domain}</td>
                  <td className="px-4 py-3 text-slate-600">{contact.order.storeName}</td>
                  <td className="px-4 py-3 text-slate-600">{contact.order.ownerEmail}</td>
                  <td className="px-4 py-3 text-slate-600">{displayValue(contact.order.providerCustomerId)}</td>
                  <td className="px-4 py-3 text-slate-600">{displayValue(contact.registrant.id)}</td>
                  <td className="px-4 py-3 text-slate-600">{displayValue(contact.admin.id)}</td>
                  <td className="px-4 py-3 text-slate-600">{displayValue(contact.tech.id)}</td>
                  <td className="px-4 py-3 text-slate-600">{displayValue(contact.billing.id)}</td>
                  <td className="px-4 py-3 text-slate-600">{displayValue([contact.registrant.name, contact.registrant.email].filter(Boolean).join(" / "))}</td>
                  <td className="px-4 py-3 text-slate-600">{displayValue([contact.admin.name, contact.admin.email].filter(Boolean).join(" / "))}</td>
                  <td className="px-4 py-3 text-slate-600">{displayValue([contact.tech.name, contact.tech.email].filter(Boolean).join(" / "))}</td>
                  <td className="px-4 py-3 text-slate-600">{displayValue([contact.billing.name, contact.billing.email].filter(Boolean).join(" / "))}</td>
                  <td className="px-4 py-3">
                    <AdminBadge tone={contactCompletenessTone(contact.completeness)}>
                      {contact.completeness}
                    </AdminBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!contacts.length ? (
          <div className="p-5 text-sm font-semibold leading-6 text-slate-500">
            No domain orders match the current filters.
          </div>
        ) : null}
      </div>

      <div className="mt-5 overflow-hidden rounded-3xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
            Contact Issues
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-black uppercase tracking-[0.16em] text-slate-400">
              <tr>
                <th className="px-4 py-3">Domain</th>
                <th className="px-4 py-3">Store</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">Issue type</th>
                <th className="px-4 py-3">Missing field</th>
                <th className="px-4 py-3">Provider response</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {issues.map(({ contact, issueType }) => (
                <tr key={`${contact.order.id}-${issueType}`}>
                  <td className="px-4 py-3 font-black text-slate-950">{contact.order.domain}</td>
                  <td className="px-4 py-3 text-slate-600">{contact.order.storeName}</td>
                  <td className="px-4 py-3 text-slate-600">{contact.order.ownerEmail}</td>
                  <td className="px-4 py-3"><AdminBadge tone="amber">{contactIssueLabel(issueType)}</AdminBadge></td>
                  <td className="px-4 py-3 text-slate-600">{contact.missingFields.length ? contact.missingFields.join(", ") : "None"}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {hasProviderResponse(contact.order.providerResponse) ? "Stored masked response available" : "Not captured"}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      className="h-9 rounded-full border border-slate-200 bg-white px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-700"
                      onClick={() => setSelectedDomainId(contact.order.id)}
                      type="button"
                    >
                      View details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!issues.length ? (
          <div className="p-5 text-sm font-semibold leading-6 text-slate-500">
            No contact ownership issues match the current filters.
          </div>
        ) : null}
      </div>
    </section>
  );
}

function ConnectedDomainsTable({ sslStatuses }: { sslStatuses: SslStatus[] }) {
  return (
    <AdminTable
      empty={!sslStatuses.length ? "No DNS or SSL status records match the current filters." : null}
      headers={["Domain", "Store", "Owner", "DNS status", "SSL status", "Primary status"]}
    >
      {sslStatuses.map((domain) => (
        <tr key={domain.id}>
          <td className="px-5 py-4 font-bold text-slate-950">{domain.domain}</td>
          <td className="px-5 py-4 text-slate-600">{domain.storeName}</td>
          <td className="px-5 py-4 text-slate-600">{domain.ownerEmail}</td>
          <td className="px-5 py-4"><AdminBadge tone={statusTone(domain.dnsStatus)}>{domain.dnsStatus}</AdminBadge></td>
          <td className="px-5 py-4"><AdminBadge tone={statusTone(domain.sslStatus)}>{domain.sslStatus}</AdminBadge></td>
          <td className="px-5 py-4"><AdminBadge>{domain.primaryDomainStatus}</AdminBadge></td>
        </tr>
      ))}
    </AdminTable>
  );
}

export function DomainDetailsDrawer({
  canRetryDomainRegistration,
  clearDomainReview,
  domainOrders,
  markDomainUnderReview,
  retryDomainRegistrationAction,
  sslStatuses,
  syncDomainOrderStatusAction,
  viewInternalTimeline
}: DomainDetailsDrawerProps) {
  const [selectedDomainId, setSelectedDomainId] = useState<string | null>(null);
  const [filters, setFilters] = useState<DomainFilters>(defaultDomainFilters);
  const selectedDomain = domainOrders.find((order) => order.id === selectedDomainId) ?? null;
  const storeOptions = useMemo(
    () => Array.from(new Set([...domainOrders.map((order) => order.storeName), ...sslStatuses.map((domain) => domain.storeName)])).sort(),
    [domainOrders, sslStatuses]
  );
  const ownerOptions = useMemo(
    () => Array.from(new Set([...domainOrders.map((order) => order.ownerEmail), ...sslStatuses.map((domain) => domain.ownerEmail)])).sort(),
    [domainOrders, sslStatuses]
  );
  const filteredDomainOrders = useMemo(
    () => domainOrders.filter((order) => domainMatchesFilters(order, filters)),
    [domainOrders, filters]
  );
  const filteredSslStatuses = useMemo(
    () => sslStatuses.filter((domain) => sslMatchesFilters(domain, filters)),
    [filters, sslStatuses]
  );
  const failedOperations = useMemo(
    () =>
      filteredDomainOrders
        .map(operationFromDomain)
        .filter((operation): operation is FailedOperation => Boolean(operation)),
    [filteredDomainOrders]
  );
  const contactVisibility = useMemo(
    () => filteredDomainOrders.map(contactVisibilityForOrder),
    [filteredDomainOrders]
  );
  const fundingSummary = useMemo(
    () => providerBalanceSummary(domainOrders),
    [domainOrders]
  );
  const selectedContactVisibility = selectedDomain ? contactVisibilityForOrder(selectedDomain) : null;
  const activeCount = activeFilterCount(filters);

  return (
    <>
      <DomainOperationsCertificationCard />

      <DomainGlobalFilters
        activeCount={activeCount}
        filters={filters}
        ownerOptions={ownerOptions}
        resetFilters={() => setFilters(defaultDomainFilters)}
        setFilters={setFilters}
        storeOptions={storeOptions}
      />

      <ProviderBalanceMonitoringPanel
        setSelectedDomainId={setSelectedDomainId}
        summary={fundingSummary}
      />

      <DomainOwnershipContactsPanel
        contacts={contactVisibility}
        setSelectedDomainId={setSelectedDomainId}
      />

      <FailedOperationsCenter
        operations={failedOperations}
        setSelectedDomainId={setSelectedDomainId}
      />

      <AdminTable
        empty={!filteredDomainOrders.length ? "No domain drafts or registration workflows match the current filters." : null}
        headers={["Store", "Owner", "Domain", "Extension", "Status", "Plan credit", "Customer due", "Created", "Next step", "Actions"]}
      >
        {filteredDomainOrders.map((order) => (
          <tr
            className="cursor-pointer transition hover:bg-slate-50"
            key={order.id}
            onClick={() => setSelectedDomainId(order.id)}
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setSelectedDomainId(order.id);
              }
            }}
          >
            <td className="px-5 py-4 font-bold text-slate-950">{order.storeName}</td>
            <td className="px-5 py-4 text-slate-600">{order.ownerEmail}</td>
            <td className="px-5 py-4 font-bold text-slate-950">{order.domain}</td>
            <td className="px-5 py-4"><AdminBadge tone="blue">{order.extension}</AdminBadge></td>
            <td className="px-5 py-4"><AdminBadge tone={statusTone(order.status)}>{order.status}</AdminBadge></td>
            <td className="px-5 py-4 text-slate-600">{formatAdminMoney(order.planCreditUsedCents / 100)}</td>
            <td className="px-5 py-4 text-slate-600">{formatAdminMoney(order.customerDueCents / 100)}</td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(order.createdAt)}</td>
            <td className="px-5 py-4 text-slate-600">{order.nextStep}</td>
            <td className="px-5 py-4">
              <DomainActions
                clearDomainReview={clearDomainReview}
                markDomainUnderReview={markDomainUnderReview}
                order={order}
                viewInternalTimeline={viewInternalTimeline}
              />
            </td>
          </tr>
        ))}
      </AdminTable>

      <ConnectedDomainsTable sslStatuses={filteredSslStatuses} />

      {selectedDomain ? (
        <div className="fixed inset-0 z-50">
          <button
            aria-label="Close domain details"
            className="absolute inset-0 bg-slate-950/30"
            onClick={() => setSelectedDomainId(null)}
            type="button"
          />
          <aside className="absolute right-0 top-0 h-full w-full max-w-xl overflow-y-auto border-l border-slate-200 bg-slate-50 p-5 shadow-[-30px_0_90px_-60px_rgba(15,23,42,0.9)]">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                  Domain details
                </p>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-slate-950">
                  {selectedDomain.domain}
                </h2>
              </div>
              <button
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-slate-600"
                onClick={() => setSelectedDomainId(null)}
                type="button"
              >
                Close
              </button>
            </div>

            <div className="grid gap-4">
              <DetailSection title="Domain Overview">
                <DetailRow label="Domain name" value={selectedDomain.domain} />
                <DetailRow label="Store name" value={selectedDomain.storeName} />
                <DetailRow label="Store owner" value={selectedDomain.ownerEmail} />
                <DetailRow label="Created at" value={formatAdminDate(selectedDomain.createdAt)} />
                <DetailRow label="Updated at" value={formatAdminDate(selectedDomain.updatedAt)} />
                <DetailRow label="Current status" value={selectedDomain.status} />
              </DetailSection>

              <DetailSection title="Provider Information">
                <DetailRow label="Provider" value={selectedDomain.provider} />
                <DetailRow label="Provider order id" value={selectedDomain.providerOrderId} />
                <DetailRow label="Provider entity id" value={selectedDomain.providerEntityId} />
                <DetailRow label="Provider customer id" value={selectedDomain.providerCustomerId} />
                <DetailRow label="Runtime domain order id" value={selectedDomain.domainOrderId} />
                <DetailRow label="Provider status synced" value={selectedDomain.providerStatusSyncedAt ? formatTimelineTimestamp(selectedDomain.providerStatusSyncedAt) : null} />
                <DetailRow label="Registrant contact id" value={selectedDomain.registrantContactId} />
                <DetailRow label="Admin contact id" value={selectedDomain.adminContactId} />
                <DetailRow label="Tech contact id" value={selectedDomain.techContactId} />
                <DetailRow label="Billing contact id" value={selectedDomain.billingContactId} />
              </DetailSection>

              <DomainStatusSyncControl
                order={selectedDomain}
                syncDomainOrderStatusAction={syncDomainOrderStatusAction}
              />

              <DomainRegistrationRetryControl
                canRetryDomainRegistration={canRetryDomainRegistration}
                order={selectedDomain}
                retryDomainRegistrationAction={retryDomainRegistrationAction}
              />

              {selectedContactVisibility ? (
                <DetailSection title="Domain Ownership & Contacts">
                  <DetailRow label="Contact completeness" value={selectedContactVisibility.completeness} />
                  <DetailRow
                    label="Ownership risk"
                    value={selectedContactVisibility.ownershipRisk ? "Registrant contact may not match the store owner." : "No visible ownership mismatch detected"}
                  />
                  <DetailRow
                    label="Registrant name/email"
                    value={[selectedContactVisibility.registrant.name, selectedContactVisibility.registrant.email].filter(Boolean).join(" / ")}
                  />
                  <DetailRow
                    label="Admin name/email"
                    value={[selectedContactVisibility.admin.name, selectedContactVisibility.admin.email].filter(Boolean).join(" / ")}
                  />
                  <DetailRow
                    label="Tech name/email"
                    value={[selectedContactVisibility.tech.name, selectedContactVisibility.tech.email].filter(Boolean).join(" / ")}
                  />
                  <DetailRow
                    label="Billing name/email"
                    value={[selectedContactVisibility.billing.name, selectedContactVisibility.billing.email].filter(Boolean).join(" / ")}
                  />
                </DetailSection>
              ) : null}

              <DetailSection title="Registration Information">
                <DetailRow label="Registration years" value={selectedDomain.registrationYears} />
                <DetailRow label="Nameserver count" value={selectedDomain.nameserverCount} />
                <DetailRow
                  label="Nameserver list"
                  value={selectedDomain.nameservers.length ? selectedDomain.nameservers.join(", ") : null}
                />
                <DetailRow label="Auto renew" value={selectedDomain.autoRenew} />
              </DetailSection>

              <DetailSection title="Provider Error">
                <DetailRow label="Provider error message" value={selectedDomain.providerErrorMessage} />
              </DetailSection>

              <RegistrationTimeline order={selectedDomain} />
              <RawProviderResponseSection order={selectedDomain} />
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
