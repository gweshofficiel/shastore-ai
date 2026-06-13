"use client";

import { useMemo, useState, type MouseEvent, type ReactNode } from "react";
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

type DomainDetailsDrawerProps = {
  clearDomainReview: DomainAction;
  domainOrders: DomainOrder[];
  markDomainUnderReview: DomainAction;
  sslStatuses: SslStatus[];
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
  const providerResponse = hasProviderResponse(order.providerResponse)
    ? JSON.stringify(order.providerResponse, null, 2)
    : null;

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
        <AdminBadge tone="red">{operations.length} visible</AdminBadge>
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
  clearDomainReview,
  domainOrders,
  markDomainUnderReview,
  sslStatuses,
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
  const fundingSummary = useMemo(
    () => providerBalanceSummary(domainOrders),
    [domainOrders]
  );
  const activeCount = activeFilterCount(filters);

  return (
    <>
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
                <DetailRow label="Provider customer id" value={selectedDomain.providerCustomerId} />
                <DetailRow label="Registrant contact id" value={selectedDomain.registrantContactId} />
                <DetailRow label="Admin contact id" value={selectedDomain.adminContactId} />
                <DetailRow label="Tech contact id" value={selectedDomain.techContactId} />
                <DetailRow label="Billing contact id" value={selectedDomain.billingContactId} />
              </DetailSection>

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
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
