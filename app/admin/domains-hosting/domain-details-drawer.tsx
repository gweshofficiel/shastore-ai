"use client";

import { useState, type MouseEvent, type ReactNode } from "react";
import {
  AdminBadge,
  AdminTable,
  formatAdminDate,
  formatAdminMoney
} from "@/components/admin/admin-control";
import type { AdminDomainsHostingControl } from "@/lib/admin/data";

type DomainOrder = AdminDomainsHostingControl["domainOrders"][number];

type DomainAction = (formData: FormData) => void | Promise<void>;

type DomainDetailsDrawerProps = {
  clearDomainReview: DomainAction;
  domainOrders: DomainOrder[];
  markDomainUnderReview: DomainAction;
  viewInternalTimeline: DomainAction;
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

export function DomainDetailsDrawer({
  clearDomainReview,
  domainOrders,
  markDomainUnderReview,
  viewInternalTimeline
}: DomainDetailsDrawerProps) {
  const [selectedDomainId, setSelectedDomainId] = useState<string | null>(null);
  const selectedDomain = domainOrders.find((order) => order.id === selectedDomainId) ?? null;

  return (
    <>
      <AdminTable
        empty={!domainOrders.length ? "No domain drafts or registration workflows found." : null}
        headers={["Store", "Owner", "Domain", "Extension", "Status", "Plan credit", "Customer due", "Created", "Next step", "Actions"]}
      >
        {domainOrders.map((order) => (
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
