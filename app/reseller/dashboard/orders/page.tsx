import { PageHeader } from "@/components/dashboard/page-header";
import { CopyStoreUrlButton } from "@/components/dashboard/copy-store-url-button";
import { OrderStatusAction } from "@/components/reseller-orders/order-status-action";
import { Card } from "@/components/ui/card";
import {
  generateManualDeliveryPdf,
  markStoreDeliveryTransferDelivered,
  prepareProvisionedStoreDraft,
  prepareStoreDeliveryTransfer
} from "@/lib/store-purchase/actions";
import {
  getResellerStorePurchaseData,
  storePurchaseMigrationMessage
} from "@/lib/store-purchase/data";
import type {
  ProvisionedStoreStatus,
  StoreDeliveryStatus,
  StoreDeliveryTransferStatus,
  StorePurchaseOrder,
  StorePurchaseRequestStatus
} from "@/lib/store-purchase/types";

export const dynamic = "force-dynamic";

const statusLabels: Record<StorePurchaseRequestStatus, string> = {
  approved: "Approved",
  delivered: "Delivered",
  pending: "Pending",
  preparing: "Preparing",
  rejected: "Rejected"
};

function statusClass(status: StorePurchaseRequestStatus) {
  if (status === "approved" || status === "delivered") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (status === "rejected") {
    return "bg-red-100 text-red-700";
  }

  if (status === "preparing") {
    return "bg-blue-100 text-blue-700";
  }

  return "bg-amber-100 text-amber-700";
}

function provisioningStatusClass(status: ProvisionedStoreStatus | null | undefined) {
  if (status === "ready" || status === "delivered") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (status === "failed") {
    return "bg-red-100 text-red-700";
  }

  if (status === "preparing") {
    return "bg-blue-100 text-blue-700";
  }

  return "bg-slate-100 text-slate-600";
}

function deliveryStatusClass(
  status: StoreDeliveryStatus | StoreDeliveryTransferStatus | null | undefined
) {
  if (status === "delivered") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (status === "ready_for_delivery") {
    return "bg-blue-100 text-blue-700";
  }

  if (status === "failed") {
    return "bg-red-100 text-red-700";
  }

  return "bg-amber-100 text-amber-700";
}

function activationStatusClass(status: string | null | undefined) {
  if (status === "activated") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (status === "expired" || status === "cancelled") {
    return "bg-red-100 text-red-700";
  }

  return "bg-blue-100 text-blue-700";
}

function TransferPreparationAction({ requestId }: { requestId: string }) {
  return (
    <form action={prepareStoreDeliveryTransfer}>
      <input name="returnTo" type="hidden" value="/reseller/dashboard/orders" />
      <input name="requestId" type="hidden" value={requestId} />
      <button
        className="inline-flex h-9 items-center rounded-full bg-ink px-4 text-xs font-black text-white transition hover:bg-slate-800"
        type="submit"
      >
        Prepare Transfer
      </button>
    </form>
  );
}

function MarkDeliveredAction({ requestId }: { requestId: string }) {
  return (
    <form action={markStoreDeliveryTransferDelivered}>
      <input name="returnTo" type="hidden" value="/reseller/dashboard/orders" />
      <input name="requestId" type="hidden" value={requestId} />
      <button
        className="inline-flex h-9 items-center rounded-full bg-emerald-600 px-4 text-xs font-black text-white transition hover:bg-emerald-700"
        type="submit"
      >
        Mark Delivered
      </button>
    </form>
  );
}

function StoreProvisioningAction({ requestId }: { requestId: string }) {
  return (
    <form action={prepareProvisionedStoreDraft}>
      <input name="returnTo" type="hidden" value="/reseller/dashboard/orders" />
      <input name="requestId" type="hidden" value={requestId} />
      <button
        className="inline-flex h-9 items-center rounded-full bg-blue-600 px-4 text-xs font-black text-white transition hover:bg-blue-700"
        type="submit"
      >
        Prepare Store
      </button>
    </form>
  );
}

function DeliveryPdfAction({ requestId }: { requestId: string }) {
  return (
    <form action={generateManualDeliveryPdf}>
      <input name="returnTo" type="hidden" value="/reseller/dashboard/orders" />
      <input name="requestId" type="hidden" value={requestId} />
      <button
        className="inline-flex h-9 items-center rounded-full bg-purple-600 px-4 text-xs font-black text-white transition hover:bg-purple-700"
        type="submit"
      >
        Generate Delivery PDF
      </button>
    </form>
  );
}

function payloadText(payload: unknown, key: string, fallback = "Not generated") {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return fallback;
  }

  const value = (payload as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value : fallback;
}

function OrderCard({ order }: { order: StorePurchaseOrder }) {
  return (
    <Card className="grid gap-5 p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
            {order.showcase_title ?? "Ready-made store"}
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-ink">
            {order.business_name}
          </h2>
          <p className="mt-1 text-sm font-semibold text-muted">
            {order.showcase_price_label ?? "Pricing on request"} | Transfer code{" "}
            {order.transfer_code}
          </p>
        </div>
        <span
          className={`w-fit rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${statusClass(
            order.request_status
          )}`}
        >
          {statusLabels[order.request_status]}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Buyer</p>
          <p className="mt-2 font-black text-ink">{order.buyer_name}</p>
          <p className="mt-1 text-sm font-semibold text-muted">{order.buyer_email}</p>
          <p className="mt-1 text-sm font-semibold text-muted">
            {order.buyer_phone ?? "No phone"} | {order.buyer_whatsapp ?? "No WhatsApp"}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Domain</p>
          <p className="mt-2 font-black text-ink">{order.requested_domain ?? "Not requested"}</p>
          <p className="mt-1 text-sm font-semibold text-muted">
            Requested {new Date(order.created_at).toLocaleString()}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
            Transfer Status
          </p>
          <span
            className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${deliveryStatusClass(
              order.delivery_transfer?.transfer_status
            )}`}
          >
            {order.delivery_transfer?.transfer_status.replace(/_/g, " ") ?? "Not prepared"}
          </span>
          <p className="mt-2 text-sm font-semibold capitalize text-muted">
            Legacy prep: {order.transfer_record?.transfer_status.replace(/_/g, " ") ?? "Not started"}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
            Provisioning
          </p>
          <span
            className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${provisioningStatusClass(
              order.provisioned_store?.provisioning_status ??
                (order.store_instance ? "ready" : undefined)
            )}`}
          >
            {order.store_instance ? "Store Prepared" : (order.provisioned_store?.provisioning_status ?? "Not prepared")}
          </span>
          <p className="mt-2 text-sm font-semibold leading-6 text-muted">
            {order.store_instance
              ? order.store_instance.internal_slug
              : order.provisioned_store
                ? order.provisioned_store.provisioned_store_slug
              : "Buyer-ready draft has not been cloned yet."}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
            Future Automation
          </p>
          <span
            className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${deliveryStatusClass(
              order.delivery_transfer?.delivery_status
            )}`}
          >
            Delivery {order.delivery_transfer?.delivery_status.replace(/_/g, " ") ?? "not sent"}
          </span>
          <p className="mt-2 text-sm font-semibold leading-6 text-muted">
            Ownership{" "}
            {order.delivery_transfer?.ownership_assigned
              ? "assigned"
              : "pending buyer account placeholder"}
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-500">
            Buyer Account Mode
          </p>
          <p className="mt-2 font-black text-blue-950">
            {order.buyer_has_account
              ? "Existing SHASTORE account"
              : "New buyer account placeholder"}
          </p>
          <p className="mt-1 text-sm font-semibold text-blue-800">
            Target type: {order.buyer_account_type_target}
          </p>
        </div>
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-500">
            Target SHASTORE Account ID
          </p>
          <p className="mt-2 font-mono font-black text-blue-950">
            {order.target_account_id ?? "Not provided"}
          </p>
          <p className="mt-1 text-sm font-semibold capitalize text-blue-800">
            Lookup: {(order.target_account_lookup_status ?? "new_account_placeholder").replace(
              /_/g,
              " "
            )}
          </p>
        </div>
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-500">
            Transfer Destination
          </p>
          <p className="mt-2 text-sm font-semibold leading-6 text-blue-800">
            {order.target_account_id
              ? "Prepare transfer to existing account placeholder."
              : "Prepare future buyer account creation placeholder."}
          </p>
        </div>
      </div>

      {order.notes ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Notes</p>
          <p className="mt-2 text-sm font-semibold leading-6 text-muted">{order.notes}</p>
        </div>
      ) : null}

      {order.provisioned_store ? (
        <div
          className="rounded-2xl border border-blue-200 bg-blue-50 p-4"
          id={`provisioning-${order.id}`}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-500">
                Provisioned Store Draft
              </p>
              <p className="mt-2 text-lg font-black text-blue-950">
                {order.provisioned_store.provisioned_store_name}
              </p>
              <p className="mt-1 text-sm font-semibold text-blue-800">
                Internal slug: {order.provisioned_store.provisioned_store_slug}
              </p>
            </div>
            <span
              className={`w-fit rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${provisioningStatusClass(
                order.provisioned_store.provisioning_status
              )}`}
            >
              {order.provisioned_store.provisioning_status}
            </span>
          </div>
          <p className="mt-3 text-sm font-semibold leading-6 text-blue-800">
            Store data has been cloned into a provisioning JSON draft. Buyer account creation,
            ownership transfer, credentials, domain connection, delivery, and quota deduction remain
            future placeholders.
          </p>
        </div>
      ) : null}

      {order.store_instance ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-600">
                Real Store Instance Created
              </p>
              <p className="mt-2 text-lg font-black text-emerald-950">
                {order.store_instance.store_name}
              </p>
              <p className="mt-1 text-sm font-semibold text-emerald-800">
                Instance slug: {order.store_instance.internal_slug}
              </p>
            </div>
            <span className="w-fit rounded-full bg-emerald-100 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
              Provisioning ready
            </span>
          </div>
          <p className="mt-3 text-sm font-semibold leading-6 text-emerald-800">
            Products, categories, branding, SEO, footer, contact, CTA, homepage sections, social
            links, and domain preparation records are cloned into real store instance tables.
          </p>
        </div>
      ) : null}

      {order.delivery_transfer ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-600">
                Store Delivery Package
              </p>
              <p className="mt-2 text-lg font-black text-emerald-950">
                Transfer code {order.delivery_transfer.transfer_code}
              </p>
              <p className="mt-1 text-sm font-semibold text-emerald-800">
                Buyer: {order.delivery_transfer.buyer_email}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span
                className={`w-fit rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${deliveryStatusClass(
                  order.delivery_transfer.transfer_status
                )}`}
              >
                {order.delivery_transfer.transfer_status.replace(/_/g, " ")}
              </span>
              <span className="w-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-amber-700">
                Ownership pending
              </span>
            </div>
          </div>
          <p className="mt-3 text-sm font-semibold leading-6 text-emerald-800">
            Credentials package placeholder is saved. Future PDF generation, WhatsApp delivery,
            email delivery, automated onboarding, password setup links, domain connection, quota
            deduction, and real deployment remain disabled.
          </p>
          {order.delivery_transfer.transferred_at ? (
            <p className="mt-2 text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
              Delivered {new Date(order.delivery_transfer.transferred_at).toLocaleString()}
            </p>
          ) : null}
        </div>
      ) : null}

      {order.activation_token ? (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-500">
                Buyer Activation Link
              </p>
              <p className="mt-2 font-mono text-sm font-black text-blue-950">
                /activate-store/{order.activation_token.activation_token}
              </p>
              <p className="mt-1 text-sm font-semibold text-blue-800">
                Expires {new Date(order.activation_token.expires_at).toLocaleString()}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span
                className={`w-fit rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${activationStatusClass(
                  order.activation_token.activation_status
                )}`}
              >
                {order.activation_token.activation_status}
              </span>
              <span
                className={`w-fit rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${
                  order.activation_token.activation_status === "activated"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                {order.activation_token.activation_status === "activated" ? "Claimed" : "Unclaimed"}
              </span>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <a
              className="inline-flex h-11 items-center justify-center rounded-full bg-ink px-5 text-sm font-bold text-white transition hover:bg-slate-800"
              href={`/activate-store/${order.activation_token.activation_token}`}
              target="_blank"
            >
              Open activation
            </a>
            <CopyStoreUrlButton url={`/activate-store/${order.activation_token.activation_token}`} />
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-black text-ink">Activation link not generated yet</p>
          <p className="mt-1 text-sm font-semibold text-muted">
            Click Prepare Transfer after Prepare Store to create the buyer activation token.
          </p>
        </div>
      )}

      {order.delivery_document ? (
        <div className="rounded-2xl border border-purple-200 bg-purple-50 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-purple-600">
                Manual Delivery PDF Preview
              </p>
              <p className="mt-2 text-lg font-black text-purple-950">
                {payloadText(order.delivery_document.pdf_payload, "storeName")}
              </p>
              <p className="mt-1 text-sm font-semibold text-purple-800">
                Buyer: {payloadText(order.delivery_document.pdf_payload, "buyerEmail")}
              </p>
            </div>
            <span className="w-fit rounded-full bg-purple-100 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-purple-700">
              {order.delivery_document.document_status}
            </span>
          </div>
          <div className="mt-4 grid gap-3 rounded-2xl border border-purple-100 bg-white/80 p-4 text-sm font-semibold text-purple-900 md:grid-cols-2">
            <p>Transfer code: {payloadText(order.delivery_document.pdf_payload, "transferCode")}</p>
            <p>WhatsApp: {payloadText(order.delivery_document.pdf_payload, "buyerWhatsapp")}</p>
            <p>Activation: {payloadText(order.delivery_document.pdf_payload, "activationLink")}</p>
            <p>Preview: {payloadText(order.delivery_document.pdf_payload, "storePreviewLink")}</p>
            <p className="md:col-span-2">
              Account mode: {payloadText(order.delivery_document.pdf_payload, "accountMode")}
            </p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <a
              className="inline-flex h-11 items-center justify-center rounded-full bg-purple-600 px-5 text-sm font-bold text-white transition hover:bg-purple-700"
              href={`/reseller/dashboard/orders/delivery-pdf/${order.delivery_document.id}`}
              target="_blank"
            >
              Download Delivery PDF
            </a>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <OrderStatusAction
          label="Approve"
          pendingLabel="Approving..."
          requestId={order.id}
          status="approved"
        />
        <OrderStatusAction
          label="Reject"
          pendingLabel="Rejecting..."
          requestId={order.id}
          status="rejected"
        />
        <TransferPreparationAction requestId={order.id} />
        <MarkDeliveredAction requestId={order.id} />
        <StoreProvisioningAction requestId={order.id} />
        <DeliveryPdfAction requestId={order.id} />
        {order.store_instance ? (
          <a
            className="inline-flex h-9 items-center rounded-full border border-blue-200 bg-blue-50 px-4 text-xs font-black text-blue-700 transition hover:bg-blue-100"
            href={`/reseller/dashboard/orders/store-preview/${order.store_instance.internal_slug}`}
            target="_blank"
          >
            View Provisioning Status
          </a>
        ) : order.provisioned_store ? (
          <a
            className="inline-flex h-9 items-center rounded-full border border-blue-200 bg-blue-50 px-4 text-xs font-black text-blue-700 transition hover:bg-blue-100"
            href={`#provisioning-${order.id}`}
          >
            View Provisioning Status
          </a>
        ) : null}
      </div>
    </Card>
  );
}

export default async function PrivateResellerOrdersPage({
  searchParams
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const [query, data] = await Promise.all([searchParams, getResellerStorePurchaseData()]);
  const pendingOrders = data.orders.filter((order) => order.request_status === "pending");
  const preparingOrders = data.orders.filter((order) => order.request_status === "preparing");

  return (
    <>
      <PageHeader
        description="Review buyer requests for ready-made stores and prepare ownership transfer placeholders without touching checkout or payments."
        title="Reseller Orders"
      />
      {!data.ready ? (
        <Card className="border-blue-200 bg-blue-50 p-5">
          <p className="text-sm font-bold text-blue-800">{storePurchaseMigrationMessage()}</p>
        </Card>
      ) : null}
      {query.saved ? (
        <Card className="border-emerald-200 bg-emerald-50 p-5">
          <p className="text-sm font-bold text-emerald-700">Store purchase order updated.</p>
        </Card>
      ) : null}
      {query.error ? (
        <Card className="border-red-200 bg-red-50 p-5">
          <p className="text-sm font-bold text-red-700">{query.error}</p>
        </Card>
      ) : null}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
            Purchase Requests
          </p>
          <p className="mt-3 text-3xl font-black text-ink">{data.orders.length}</p>
          <p className="mt-1 text-sm text-muted">Ready-made store inquiries</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Pending</p>
          <p className="mt-3 text-3xl font-black text-ink">{pendingOrders.length}</p>
          <p className="mt-1 text-sm text-muted">Awaiting approval or rejection</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
            Transfer Prep
          </p>
          <p className="mt-3 text-3xl font-black text-ink">{preparingOrders.length}</p>
          <p className="mt-1 text-sm text-muted">Ownership handoff placeholders</p>
        </Card>
      </div>
      {data.orders.length ? (
        <div className="grid gap-5">
          {data.orders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      ) : (
        <Card className="p-8 text-center">
          <h2 className="text-2xl font-black tracking-[-0.04em] text-ink">
            No reseller purchase requests yet
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm font-semibold leading-6 text-muted">
            Buyers will appear here after they click Buy this store on your public reseller
            showcase and submit the request form.
          </p>
        </Card>
      )}
    </>
  );
}
