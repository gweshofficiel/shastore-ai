import { getOrCreateAccountProfile, accountProfileUnavailableMessage } from "@/lib/account-profiles";
import { requireDeliveryAccess } from "@/lib/delivery/access";
import { getDeliveryAssignedOrdersData } from "@/lib/delivery/data";

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

export default async function DeliveryDashboardPage() {
  const { agent, role, user } = await requireDeliveryAccess();
  const [account, assignmentData] = await Promise.all([
    getOrCreateAccountProfile("delivery"),
    getDeliveryAssignedOrdersData(agent)
  ]);

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
              COD, and returns remain placeholders in this phase.
            </p>
          </div>
          <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-500">
              Account status
            </p>
            <p className="mt-2 text-xl font-black text-emerald-950">
              {statusLabel(role, agent?.status)}
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-600">
              {account?.account_id ?? accountProfileUnavailableMessage()}
            </p>
          </div>
        </div>
      </section>

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
            value: agent?.cityZone ?? "Not set",
            detail: "Service area from the owner delivery agent profile."
          },
          {
            label: "Assigned orders",
            value: assignmentData.assignedOrders.toLocaleString(),
            detail: "Store orders assigned to this delivery agent."
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
            value: "Placeholder",
            detail: "Future online, offline, pause, and route capacity controls."
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
            value: assignmentData.returnedOrders.toLocaleString(),
            detail: "Returned assignments tracked without proof-of-delivery yet."
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
            Quick actions placeholder
          </p>
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
            Future hooks prepared
          </p>
          <div className="mt-4 grid gap-3">
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
