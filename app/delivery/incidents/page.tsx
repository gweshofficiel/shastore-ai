import { DeliverySidebar } from "@/components/delivery/delivery-sidebar";
import { requireDeliveryAccess } from "@/lib/delivery/access";
import { createDeliveryIncidentAction } from "@/lib/delivery/incident-actions";
import {
  getDeliveryIncidentsForAgent,
  incidentCategoryLabel,
  incidentStatusLabel,
  type DeliveryIncidentCategory,
  type DeliveryIncidentPriority
} from "@/lib/delivery/incident-data";

export const dynamic = "force-dynamic";

const categories: Array<{ label: string; value: DeliveryIncidentCategory }> = [
  { label: "Late Delivery", value: "late_delivery" },
  { label: "Customer Complaint", value: "customer_complaint" },
  { label: "Owner Complaint", value: "owner_complaint" },
  { label: "COD Dispute", value: "cod_dispute" },
  { label: "Wrong Delivery", value: "wrong_delivery" },
  { label: "Missing Item", value: "missing_item" },
  { label: "Proof Failure", value: "proof_failure" },
  { label: "Vehicle Problem", value: "vehicle_problem" },
  { label: "Policy Violation", value: "policy_violation" },
  { label: "Other", value: "other" }
];
const priorities: Array<{ label: string; value: DeliveryIncidentPriority }> = [
  { label: "Minor", value: "minor" },
  { label: "Medium", value: "medium" },
  { label: "Major", value: "major" },
  { label: "Critical", value: "critical" }
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

function statusClass(value: string) {
  if (value === "resolved" || value === "closed") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (value === "escalated" || value === "critical") {
    return "bg-red-100 text-red-700";
  }

  if (value === "under_review" || value === "major") {
    return "bg-amber-100 text-amber-700";
  }

  return "bg-slate-100 text-slate-700";
}

function statusMessage(value: string | string[] | undefined) {
  const status = Array.isArray(value) ? value[0] : value;
  const messages: Record<string, string> = {
    "access-denied": "Delivery incident access could not be verified.",
    "incident-created": "Incident created and added to the incident timeline.",
    "incident-failed": "Incident could not be created.",
    "incident-invalid": "Choose a category, priority, and description.",
    unavailable: "Incident service is not configured."
  };

  return status ? messages[status] ?? null : null;
}

export default async function DeliveryIncidentsPage({
  searchParams
}: {
  searchParams?: Promise<{ delivery?: string | string[] }>;
}) {
  const query = await searchParams;
  const { agent } = await requireDeliveryAccess();
  const data = agent
    ? await getDeliveryIncidentsForAgent({
        agentId: agent.agentId,
        storeId: agent.storeId,
        workspaceId: agent.workspaceId
      })
    : { events: [], incidents: [], summary: { active: 0, closed: 0, critical: 0, escalated: 0, riskLevel: "Low" as const, total: 0 } };
  const pageMessage = statusMessage(query?.delivery);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#ffffff_0%,#ecfdf5_38%,#f1f5f9_100%)]">
      <DeliverySidebar />
      <main className="min-w-0 px-4 py-6 sm:px-6 lg:ml-72 lg:px-8 lg:py-8 xl:px-10">
        <div className="mx-auto grid w-full max-w-7xl gap-8">
          <section className="rounded-[2rem] border border-emerald-100 bg-white/85 p-5 shadow-[0_24px_80px_-54px_rgba(6,78,59,0.65)] backdrop-blur lg:p-6">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-500">
              Delivery incidents
            </p>
            <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="text-3xl font-black tracking-[-0.04em] text-slate-950 sm:text-4xl">
                  Incident Management Center
                </h1>
                <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
                  Create incidents, track operational issue status, and review timeline updates for your delivery account.
                </p>
              </div>
              <span className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.16em] ${statusClass(data.summary.riskLevel.toLowerCase())}`}>
                {data.summary.riskLevel} risk
              </span>
            </div>
          </section>

          {pageMessage ? (
            <section className="rounded-3xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-800">
              {pageMessage}
            </section>
          ) : null}

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <MetricCard label="Total Incidents" value={data.summary.total.toLocaleString()} />
            <MetricCard label="Active" value={data.summary.active.toLocaleString()} />
            <MetricCard label="Escalated" value={data.summary.escalated.toLocaleString()} />
            <MetricCard label="Critical" value={data.summary.critical.toLocaleString()} />
            <MetricCard label="Closed / Resolved" value={data.summary.closed.toLocaleString()} />
          </section>

          <section className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
            <form action={createDeliveryIncidentAction} className="h-fit rounded-[2rem] border border-emerald-100 bg-emerald-50 p-5">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
                Create incident
              </p>
              <label className="mt-4 grid gap-2 text-sm font-semibold text-emerald-950">
                <span>Category</span>
                <select className="h-11 rounded-2xl border border-emerald-100 bg-white px-4 text-sm text-slate-700 outline-none" name="category" required>
                  {categories.map((category) => (
                    <option key={category.value} value={category.value}>{category.label}</option>
                  ))}
                </select>
              </label>
              <label className="mt-4 grid gap-2 text-sm font-semibold text-emerald-950">
                <span>Priority</span>
                <select className="h-11 rounded-2xl border border-emerald-100 bg-white px-4 text-sm text-slate-700 outline-none" name="priority" required>
                  {priorities.map((priority) => (
                    <option key={priority.value} value={priority.value}>{priority.label}</option>
                  ))}
                </select>
              </label>
              <label className="mt-4 grid gap-2 text-sm font-semibold text-emerald-950">
                <span>Order ID optional</span>
                <input className="h-11 rounded-2xl border border-emerald-100 bg-white px-4 text-sm text-slate-700 outline-none" name="orderId" placeholder="Order UUID if related" />
              </label>
              <label className="mt-4 grid gap-2 text-sm font-semibold text-emerald-950">
                <span>Order source optional</span>
                <select className="h-11 rounded-2xl border border-emerald-100 bg-white px-4 text-sm text-slate-700 outline-none" name="orderSource">
                  <option value="">No order source</option>
                  <option value="orders">Orders</option>
                  <option value="store_orders">Store orders</option>
                </select>
              </label>
              <label className="mt-4 grid gap-2 text-sm font-semibold text-emerald-950">
                <span>Description</span>
                <textarea className="min-h-36 rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-sm text-slate-700 outline-none" name="description" placeholder="Describe the incident, complaint, dispute, or operational issue." required />
              </label>
              <button className="mt-4 h-11 rounded-2xl bg-emerald-950 px-4 text-xs font-black uppercase tracking-[0.12em] text-white" type="submit">
                Create incident
              </button>
            </form>

            <div className="rounded-[2rem] border border-slate-200 bg-white p-5">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                View incidents
              </p>
              <div className="mt-5 grid gap-3">
                {data.incidents.length ? data.incidents.map((incident) => (
                  <article className="rounded-2xl border border-slate-100 bg-slate-50 p-4" key={incident.id}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-black capitalize text-slate-950">{incidentCategoryLabel(incident.category)}</p>
                        <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                          {formatDate(incident.createdAt)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${statusClass(incident.status)}`}>
                          {incidentStatusLabel(incident.status)}
                        </span>
                        <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${statusClass(incident.priority)}`}>
                          {incident.priority}
                        </span>
                      </div>
                    </div>
                    <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">{incident.description}</p>
                    {incident.orderId ? (
                      <p className="mt-2 text-xs font-bold uppercase tracking-[0.14em] text-emerald-600">
                        {incident.orderSource ?? "order"} · {incident.orderId.slice(0, 8)}
                      </p>
                    ) : null}
                  </article>
                )) : (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm font-bold text-slate-500">
                    No incidents created yet.
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-[2rem] border border-slate-200 bg-white p-5">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
              Incident timeline
            </p>
            <div className="mt-5 grid gap-3">
              {data.events.length ? data.events.map((event) => (
                <article className="rounded-2xl border border-slate-100 bg-slate-50 p-4" key={event.id}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-black capitalize text-slate-950">{event.eventType.replaceAll("_", " ")}</p>
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                      {formatDate(event.createdAt)}
                    </p>
                  </div>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{event.message}</p>
                </article>
              )) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm font-bold text-slate-500">
                  No incident timeline events yet.
                </div>
              )}
            </div>
          </section>

          <section className="rounded-[2rem] border border-dashed border-emerald-200 bg-emerald-50 p-5 lg:p-6">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-600">
              Future hooks prepared
            </p>
            <p className="mt-2 text-sm font-semibold leading-6 text-emerald-950">
              Admin investigations, evidence uploads, temporary suspension, penalty engine, appeals workflow, and risk scoring.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-[1.5rem] border border-slate-200/80 bg-white/85 p-5 shadow-[0_18px_55px_-44px_rgba(15,23,42,0.7)]">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-3 text-2xl font-black text-slate-950">{value}</p>
    </article>
  );
}
