import { createAdminClient } from "@/lib/supabase/admin";

export type DeliveryIncidentCategory =
  | "late_delivery"
  | "customer_complaint"
  | "owner_complaint"
  | "cod_dispute"
  | "wrong_delivery"
  | "missing_item"
  | "proof_failure"
  | "vehicle_problem"
  | "policy_violation"
  | "other";

export type DeliveryIncidentStatus = "open" | "under_review" | "resolved" | "rejected" | "escalated" | "closed";
export type DeliveryIncidentPriority = "minor" | "medium" | "major" | "critical";
export type DeliveryRiskLevel = "Low" | "Medium" | "High" | "Critical";

export type DeliveryIncidentItem = {
  category: DeliveryIncidentCategory;
  createdAt: string;
  deliveryAgentId: string;
  description: string;
  id: string;
  orderId: string | null;
  orderSource: "orders" | "store_orders" | null;
  priority: DeliveryIncidentPriority;
  status: DeliveryIncidentStatus;
  updatedAt: string;
};

export type DeliveryIncidentEventItem = {
  createdAt: string;
  eventType: "incident_created" | "incident_updated" | "incident_resolved" | "incident_escalated";
  id: string;
  incidentId: string;
  message: string;
  newStatus: string | null;
  previousStatus: string | null;
};

export type DeliveryIncidentSummary = {
  active: number;
  closed: number;
  critical: number;
  escalated: number;
  riskLevel: DeliveryRiskLevel;
  total: number;
};

type IncidentRow = {
  category: DeliveryIncidentCategory;
  created_at: string;
  delivery_agent_id: string;
  description: string;
  id: string;
  order_id?: string | null;
  order_source?: "orders" | "store_orders" | null;
  priority: DeliveryIncidentPriority;
  status: DeliveryIncidentStatus;
  updated_at: string;
};

type IncidentEventRow = {
  created_at: string;
  event_type: "incident_created" | "incident_updated" | "incident_resolved" | "incident_escalated";
  id: string;
  incident_id: string;
  message: string;
  new_status?: string | null;
  previous_status?: string | null;
};

const activeStatuses = new Set<DeliveryIncidentStatus>(["open", "under_review", "escalated"]);

export function incidentCategoryLabel(value: string) {
  return value.replaceAll("_", " ");
}

export function incidentStatusLabel(value: string) {
  return value.replaceAll("_", " ");
}

export function deliveryRiskLevel(summary: Pick<DeliveryIncidentSummary, "active" | "critical" | "escalated">): DeliveryRiskLevel {
  if (summary.critical > 0) {
    return "Critical";
  }

  if (summary.escalated > 0 || summary.active >= 3) {
    return "High";
  }

  if (summary.active > 0) {
    return "Medium";
  }

  return "Low";
}

function toIncident(row: IncidentRow): DeliveryIncidentItem {
  return {
    category: row.category,
    createdAt: row.created_at,
    deliveryAgentId: row.delivery_agent_id,
    description: row.description,
    id: row.id,
    orderId: row.order_id ?? null,
    orderSource: row.order_source ?? null,
    priority: row.priority,
    status: row.status,
    updatedAt: row.updated_at
  };
}

function toIncidentEvent(row: IncidentEventRow): DeliveryIncidentEventItem {
  return {
    createdAt: row.created_at,
    eventType: row.event_type,
    id: row.id,
    incidentId: row.incident_id,
    message: row.message,
    newStatus: row.new_status ?? null,
    previousStatus: row.previous_status ?? null
  };
}

export function summarizeDeliveryIncidents(incidents: DeliveryIncidentItem[]): DeliveryIncidentSummary {
  const active = incidents.filter((incident) => activeStatuses.has(incident.status)).length;
  const critical = incidents.filter((incident) => incident.priority === "critical" && activeStatuses.has(incident.status)).length;
  const escalated = incidents.filter((incident) => incident.status === "escalated").length;

  return {
    active,
    closed: incidents.filter((incident) => incident.status === "closed" || incident.status === "resolved").length,
    critical,
    escalated,
    riskLevel: deliveryRiskLevel({ active, critical, escalated }),
    total: incidents.length
  };
}

export async function getDeliveryIncidentsForAgent({
  agentId,
  storeId,
  workspaceId
}: {
  agentId: string;
  storeId: string;
  workspaceId: string;
}) {
  const admin = createAdminClient();

  if (!admin) {
    return {
      events: [] as DeliveryIncidentEventItem[],
      incidents: [] as DeliveryIncidentItem[],
      summary: summarizeDeliveryIncidents([])
    };
  }

  const { data: incidentsData } = await admin
    .from("delivery_incidents" as never)
    .select("id, delivery_agent_id, order_source, order_id, category, description, status, priority, created_at, updated_at")
    .eq("workspace_id" as never, workspaceId as never)
    .eq("store_id" as never, storeId as never)
    .eq("delivery_agent_id" as never, agentId as never)
    .order("created_at" as never, { ascending: false } as never);
  const incidents = ((incidentsData ?? []) as unknown as IncidentRow[]).map(toIncident);
  const { data: eventsData } = await admin
    .from("delivery_incident_events" as never)
    .select("id, incident_id, event_type, previous_status, new_status, message, created_at")
    .eq("workspace_id" as never, workspaceId as never)
    .eq("store_id" as never, storeId as never)
    .eq("delivery_agent_id" as never, agentId as never)
    .order("created_at" as never, { ascending: false } as never)
    .limit(30);

  return {
    events: ((eventsData ?? []) as unknown as IncidentEventRow[]).map(toIncidentEvent),
    incidents,
    summary: summarizeDeliveryIncidents(incidents)
  };
}

export async function getStoreDeliveryIncidents({
  storeId,
  workspaceId
}: {
  storeId: string;
  workspaceId: string;
}) {
  const admin = createAdminClient();

  if (!admin) {
    return {
      incidents: [] as DeliveryIncidentItem[],
      summary: summarizeDeliveryIncidents([])
    };
  }

  const { data } = await admin
    .from("delivery_incidents" as never)
    .select("id, delivery_agent_id, order_source, order_id, category, description, status, priority, created_at, updated_at")
    .eq("workspace_id" as never, workspaceId as never)
    .eq("store_id" as never, storeId as never)
    .order("created_at" as never, { ascending: false } as never)
    .limit(100);
  const incidents = ((data ?? []) as unknown as IncidentRow[]).map(toIncident);

  return {
    incidents,
    summary: summarizeDeliveryIncidents(incidents)
  };
}
