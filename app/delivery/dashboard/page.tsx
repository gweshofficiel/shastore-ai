import { getOrCreateAccountProfile, accountProfileUnavailableMessage } from "@/lib/account-profiles";
import { requireDeliveryAccess } from "@/lib/delivery/access";
import { getDeliveryCommunicationSummary } from "@/lib/delivery/communication-data";
import { getDeliveryAssignedOrdersData, getDeliveryRouteCapacityData } from "@/lib/delivery/data";
import { updateDeliveryAvailabilityAction } from "@/lib/delivery/route-actions";

export const dynamic = "force-dynamic";

const futureHooks = [
  "Delivery profile",
  "Assigned orders",
  "Proof of delivery",
  "COD collection",
  "Returns",
  "Performance",
  "Delivery disputes"
];

const quickActions = [
  "Update availability placeholder",
  "Review assigned orders placeholder",
  "Prepare proof of delivery placeholder",
  "Contact support placeholder"
];

function statusLabel(role: string, agentStatus?: string | null) {
  if (role === "pending_delivery") {
    return "Pending delivery review";
  }

  if (agentStatus === "inactive") {
    return "Inactive delivery agent";
  }

  return "Active delivery agent";
}

function formatMoney(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en", {
    currency,
    style: "currency"
  }).format(amount);
}

function availabilityLabel(status: string) {
  const labels: Record<string, string> = {
    busy: "Busy",
    offline: "Offline",
    online: "Online"
  };

  return labels[status] ?? status;
}

function dashboardMessage(value: string | string[] | undefined) {
  const status = Array.isArray(value) ? value[0] : value;
  const messages: Record<string, string> = {
    "access-denied": "Delivery access could not be verified.",
    "availability-failed": "Availability could not be updated.",
    "availability-invalid": "Choose a valid availability status.",
    "availability-updated": "Availability updated.",
    unavailable: "Delivery route service is not configured."
  };

  return status ? messages[status] ?? null : null;
}

export default async function DeliveryDashboardPage({
  searchParams
}: {
  searchParams?: Promise<{ delivery?: string | string[] }>;
}) {
  const query = await searchParams;
  const { agent, role, user } = await requireDeliveryAccess();
  const [account, assignmentData, routeData, communicationData] = await Promise.all([
    getOrCreateAccountProfile("delivery"),
    getDeliveryAssignedOrdersData(agent),
    getDeliveryRouteCapacityData(agent),
    agent
      ? getDeliveryCommunicationSummary({
          agentId: agent.agentId,
          storeId: agent.storeId,
          workspaceId: agent.workspaceId
        })
      : Promise.resolve({ recentMessages: [], recentNotifications: [], unreadMessages: 0, unreadNotifications: 0 })
  ]);
  const message = dashboardMessage(query?.delivery);

  return (
    <>
      <section className="rounded-[2rem] border border-emerald-100 bg-white/85 p-5 shadow-[0_24px_80px_-54px_rgba(6,78,59,0.65)] backdrop-blur lg:p-6">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-500">
          Delivery
        </p>
        <div className="mt-3 grid gap-4 lg:grid-cols-[1.4fr_0.8fr] lg:items-end">
          <div>
            <h1 className="text-3xl font-black tracking-[-0.04em] text-slate-950 sm:text-4xl">
              Delivery dashboard
            </h1>
            <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
              Linked to your store owner delivery agent profile. Assigned orders, proof of delivery,
              COD, failed deliveries, reschedules, and returns remain store-scoped to this delivery account.
            </p>
          </div>
          <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-500">
              Notification bell
            </p>
            <p className="mt-2 text-xl font-black text-emerald-950">
              {communicationData.unreadNotifications + communicationData.unreadMessages} unread
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-600">
              {communicationData.unreadNotifications} notifications · {communicationData.unreadMessages} messages
            </p>
          </div>
        </div>
      </section>

      {message ? (
        <section className="rounded-3xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-800">
          {message}
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Agent name",
            value: agent?.agentName ?? "Delivery agent",
            detail: user.email ?? "No email on session"
          },
          {
            label: "Store",
            value: agent?.storeName ?? "Store linked",
            detail: agent?.storeId ? `Store ID ${agent.storeId.slice(0, 8)}` : "Store scope pending"
          },
          {
            label: "City / Zone",
            value: routeData.assignedZones[0]?.name ?? agent?.cityZone ?? "Not set",
            detail: routeData.assignedZones.length
              ? `${routeData.assignedZones.length} assigned delivery zone(s).`
              : "Service area from the owner delivery agent profile."
          },
          {
            label: "Assigned orders",
            value: assignmentData.assignedOrders.toLocaleString(),
            detail: "Store orders assigned to this delivery agent."
          },
          {
            label: "Failed deliveries",
            value: assignmentData.failedDeliveries.toLocaleString(),
            detail: `${assignmentData.failedDeliveryRate}% failed delivery rate.`
          },
          {
            label: "Collected today",
            value: formatMoney(assignmentData.codCollectedToday),
            detail: "COD cash marked collected today."
          },
          {
            label: "Account status",
            value: statusLabel(role, agent?.status),
            detail: account?.account_id ?? accountProfileUnavailableMessage()
          }
        ].map((card) => (
          <article
            className="rounded-[1.5rem] border border-slate-200/80 bg-white/85 p-5 shadow-[0_18px_55px_-44px_rgba(15,23,42,0.7)]"
            key={card.label}
          >
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
              {card.label}
            </p>
            <p className="mt-3 text-2xl font-black text-slate-950">{card.value}</p>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{card.detail}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Availability",
            value: availabilityLabel(routeData.availabilityStatus),
            detail: "Online, offline, or busy route status."
          },
          {
            label: "Current load",
            value: routeData.activeOrders.toLocaleString(),
            detail: "Active assigned, accepted, or picked-up orders."
          },
          {
            label: "Capacity limit",
            value: routeData.capacityLimit.toLocaleString(),
            detail: "Owner-defined maximum active workload."
          },
          {
            label: "Remaining capacity",
            value: routeData.remainingCapacity.toLocaleString(),
            detail: "Available slots before capacity is reached."
          },
          {
            label: "Proof of delivery",
            value: "Future hook",
            detail: "Reserved for photo, signature, OTP, and handoff evidence."
          },
          {
            label: "Support",
            value: "Ready",
            detail: "A safe placeholder area for delivery help and account review."
          },
          {
            label: "Agent status",
            value: agent?.status ?? role,
            detail: "Approved by the store owner delivery agent record."
          },
          {
            label: "Delivered orders",
            value: assignmentData.deliveredOrders.toLocaleString(),
            detail: "Orders marked delivered in the assignment foundation."
          },
          {
            label: "Accepted orders",
            value: assignmentData.acceptedOrders.toLocaleString(),
            detail: "Orders accepted by this delivery agent."
          },
          {
            label: "Picked up orders",
            value: assignmentData.pickedUpOrders.toLocaleString(),
            detail: "Orders picked up and moving through delivery."
          },
          {
            label: "Returns",
            value: assignmentData.returnsInProgress.toLocaleString(),
            detail: `${assignmentData.returnRate}% return rate across assigned orders.`
          },
          {
            label: "Completed returns",
            value: assignmentData.completedReturns.toLocaleString(),
            detail: "Failed deliveries completed back to store."
          },
          {
            label: "Reschedules",
            value: assignmentData.reschedules.toLocaleString(),
            detail: `${assignmentData.rescheduleRate}% reschedule rate.`
          },
          {
            label: "Refusals",
            value: `${assignmentData.refusalRate}%`,
            detail: "Customer refused rate across assigned orders."
          },
          {
            label: "Pending settlement",
            value: formatMoney(assignmentData.codPendingSettlement),
            detail: "Collected COD cash awaiting owner settlement."
          },
          {
            label: "Settled COD",
            value: formatMoney(assignmentData.codSettled),
            detail: "COD cash settled to the store."
          }
        ].map((card) => (
          <article
            className="rounded-[1.5rem] border border-slate-200/80 bg-white/85 p-5 shadow-[0_18px_55px_-44px_rgba(15,23,42,0.7)]"
            key={card.label}
          >
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
              {card.label}
            </p>
            <p className="mt-3 text-2xl font-black text-slate-950">{card.value}</p>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{card.detail}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-[2rem] border border-slate-200/80 bg-white/85 p-5 shadow-[0_18px_60px_-48px_rgba(15,23,42,0.8)] lg:p-6">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
            Availability controls
          </p>
          <form action={updateDeliveryAvailabilityAction} className="mt-4 grid gap-3">
            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              <span>Availability status</span>
              <select
                className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none"
                defaultValue={routeData.availabilityStatus}
                name="availabilityStatus"
              >
                <option value="online">Online</option>
                <option value="offline">Offline</option>
                <option value="busy">Busy</option>
              </select>
            </label>
            <button
              className="h-11 rounded-2xl bg-emerald-950 px-4 text-xs font-black uppercase tracking-[0.12em] text-white"
              type="submit"
            >
              Update availability
            </button>
          </form>
          <div className="mt-4 grid gap-3">
            {quickActions.map((action) => (
              <div
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-600"
                key={action}
              >
                {action}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-200/80 bg-white/85 p-5 shadow-[0_18px_60px_-48px_rgba(15,23,42,0.8)] lg:p-6">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
            Assigned zones and future hooks
          </p>
          <div className="mt-4 grid gap-3">
            {routeData.assignedZones.length ? routeData.assignedZones.map((zone) => (
              <div
                className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3"
                key={zone.id}
              >
                <p className="text-sm font-black text-emerald-950">{zone.name}</p>
                <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-emerald-600">
                  {[zone.city, zone.region].filter(Boolean).join(" / ") || "Coverage zone"}
                </p>
              </div>
            )) : (
              <div className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-950">
                No assigned delivery zones yet.
              </div>
            )}
            {futureHooks.map((hook) => (
              <div
                className="flex items-center justify-between rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3"
                key={hook}
              >
                <span className="text-sm font-bold text-emerald-950">{hook}</span>
                <span className="text-xs font-black uppercase tracking-[0.16em] text-emerald-500">
                  Reserved
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-[2rem] border border-slate-200/80 bg-white/85 p-5 shadow-[0_18px_60px_-48px_rgba(15,23,42,0.8)] lg:p-6">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
            Recent notifications
          </p>
          <div className="mt-4 grid gap-3">
            {communicationData.recentNotifications.length ? communicationData.recentNotifications.map((notification) => (
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3" key={notification.id}>
                <p className="text-sm font-black text-emerald-950">{notification.title}</p>
                <p className="mt-1 text-sm font-semibold leading-6 text-emerald-800">{notification.message}</p>
              </div>
            )) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-500">
                No notifications yet.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-200/80 bg-white/85 p-5 shadow-[0_18px_60px_-48px_rgba(15,23,42,0.8)] lg:p-6">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
            Recent messages
          </p>
          <div className="mt-4 grid gap-3">
            {communicationData.recentMessages.length ? communicationData.recentMessages.map((messageItem) => (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3" key={messageItem.id}>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                  {messageItem.senderType}
                </p>
                <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">{messageItem.message}</p>
              </div>
            )) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-500">
                No messages yet.
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-dashed border-emerald-200 bg-emerald-50/70 p-5 lg:p-6">
        <p className="text-sm font-bold leading-6 text-emerald-950">
          Signed in as {user.email ?? "delivery user"}. Delivery access is linked to the store owner
          delivery agent record for {agent?.storeName ?? "your assigned store"}. Admin, owner,
          reseller, and customer areas remain isolated.
        </p>
      </section>
    </>
  );
}
