import { createAdminClient } from "@/lib/supabase/admin";

export type DeliveryRole = "delivery" | "pending_delivery" | "suspended_delivery";

export type DeliveryAgentAccessRecord = {
  agentId: string;
  agentName: string;
  assignedZoneIds: string[];
  availabilityStatus: "online" | "offline" | "busy";
  capacityLimit: number;
  cityZone: string | null;
  currentActiveOrders: number;
  email: string | null;
  role: DeliveryRole;
  status: "active" | "inactive";
  storeId: string;
  storeName: string | null;
  workspaceId: string;
};

export type DeliveryAccessLookup =
  | { access: DeliveryAgentAccessRecord; status: "approved" }
  | { access: DeliveryAgentAccessRecord; status: "inactive" }
  | { status: "missing_email" }
  | { status: "not_found" };

export type DeliveryAssignmentStatus = "assigned" | "accepted" | "picked_up" | "delivered" | "returned";

export type DeliveryAssignedOrder = {
  amount: number;
  assignedAt: string;
  city: string | null;
  codAmount: number;
  codCollectedAt: string | null;
  codCurrency: string;
  codNotes: string | null;
  codSettledAt: string | null;
  codStatus: CodCollectionStatus;
  currency: string;
  customer: string | null;
  deliveredAt: string | null;
  deliveryCodeRequired: boolean;
  id: string;
  orderId: string;
  orderNumber: string;
  phone: string | null;
  proofNotes: string | null;
  proofSubmitted: boolean;
  returnNotes: string | null;
  returnReason: string | null;
  returnRequestedDate: string | null;
  returnStatus: string | null;
  source: "orders" | "store_orders";
  status: DeliveryAssignmentStatus;
  storeId: string;
  updatedAt: string;
};

export type DeliveryAssignedOrdersData = {
  acceptedOrders: number;
  assignedOrders: number;
  codCollectedToday: number;
  codCollectedTotal: number;
  codPendingSettlement: number;
  codSettled: number;
  deliveredOrders: number;
  failedDeliveries: number;
  pickedUpOrders: number;
  reschedules: number;
  returnRate: number;
  returnsInProgress: number;
  returnedOrders: number;
  completedReturns: number;
  failedDeliveryRate: number;
  refusalRate: number;
  rescheduleRate: number;
  orders: DeliveryAssignedOrder[];
};

type DeliveryAgentRow = {
  assigned_zone_ids?: string[] | null;
  availability_status?: string | null;
  capacity_limit?: number | string | null;
  city_zone?: string | null;
  current_active_orders?: number | string | null;
  email?: string | null;
  id: string;
  metadata?: Record<string, unknown> | null;
  name: string;
  normalized_email?: string | null;
  status?: string | null;
  store_id: string;
  stores?: { name?: string | null } | { name?: string | null }[] | null;
  workspace_id: string;
};

type DeliveryAssignmentRow = {
  assigned_at: string;
  currency?: string | null;
  customer_city?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  delivery_code_placeholder?: string | null;
  delivery_agent_id: string;
  id: string;
  order_amount?: number | string | null;
  order_id: string;
  order_number?: string | null;
  order_source?: "orders" | "store_orders" | null;
  status?: string | null;
  store_id: string;
  updated_at?: string | null;
};

type DeliveryProofRow = {
  assignment_id: string;
  delivered_at?: string | null;
  notes?: string | null;
};

export type CodCollectionStatus = "pending_collection" | "collected" | "settled_to_store" | "disputed" | "not_started";

type CodCollectionRow = {
  amount?: number | string | null;
  assignment_id: string;
  collected_at?: string | null;
  currency?: string | null;
  notes?: string | null;
  settled_at?: string | null;
  status?: CodCollectionStatus | null;
};

type DeliveryReturnRow = {
  assignment_id: string;
  notes?: string | null;
  reason?: string | null;
  requested_delivery_date_placeholder?: string | null;
  status?: string | null;
};

export type DeliveryZoneSummary = {
  city: string | null;
  id: string;
  isActive: boolean;
  name: string;
  region: string | null;
};

export type DeliveryRouteCapacityData = {
  activeOrders: number;
  assignedZones: DeliveryZoneSummary[];
  availabilityStatus: "online" | "offline" | "busy";
  capacityLimit: number;
  remainingCapacity: number;
};

function normalizeDeliveryEmail(value: string | null | undefined) {
  const email = value?.trim().toLowerCase() ?? "";
  return email.includes("@") ? email : "";
}

function agentRoleForStatus(status: string | null | undefined): DeliveryRole {
  return status === "inactive" ? "suspended_delivery" : "delivery";
}

function normalizeAvailabilityStatus(value: string | null | undefined): "online" | "offline" | "busy" {
  if (value === "online" || value === "busy") {
    return value;
  }

  return "offline";
}

function storeNameFromRow(row: DeliveryAgentRow) {
  const store = row.stores;

  if (Array.isArray(store)) {
    return store[0]?.name ?? null;
  }

  return store?.name ?? null;
}

function toAccessRecord(row: DeliveryAgentRow): DeliveryAgentAccessRecord {
  const status = row.status === "inactive" ? "inactive" : "active";

  return {
    agentId: row.id,
    agentName: row.name,
    assignedZoneIds: Array.isArray(row.assigned_zone_ids) ? row.assigned_zone_ids : [],
    availabilityStatus: normalizeAvailabilityStatus(row.availability_status),
    capacityLimit: Math.max(0, Math.trunc(numericValue(row.capacity_limit ?? 5))),
    cityZone: row.city_zone ?? null,
    currentActiveOrders: Math.max(0, Math.trunc(numericValue(row.current_active_orders))),
    email: row.email ?? row.normalized_email ?? null,
    role: agentRoleForStatus(row.status),
    status,
    storeId: row.store_id,
    storeName: storeNameFromRow(row),
    workspaceId: row.workspace_id
  };
}

function numericValue(value: number | string | null | undefined) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function normalizeAssignmentStatus(value: string | null | undefined): DeliveryAssignmentStatus {
  if (
    value === "accepted" ||
    value === "picked_up" ||
    value === "delivered" ||
    value === "returned"
  ) {
    return value;
  }

  return "assigned";
}

function toAssignedOrder(
  row: DeliveryAssignmentRow,
  proofByAssignmentId: Map<string, DeliveryProofRow> = new Map(),
  codByAssignmentId: Map<string, CodCollectionRow> = new Map(),
  returnByAssignmentId: Map<string, DeliveryReturnRow> = new Map()
): DeliveryAssignedOrder {
  const proof = proofByAssignmentId.get(row.id) ?? null;
  const cod = codByAssignmentId.get(row.id) ?? null;
  const deliveryReturn = returnByAssignmentId.get(row.id) ?? null;

  return {
    amount: numericValue(row.order_amount),
    assignedAt: row.assigned_at,
    city: row.customer_city ?? null,
    codAmount: numericValue(cod?.amount ?? row.order_amount),
    codCollectedAt: cod?.collected_at ?? null,
    codCurrency: cod?.currency ?? row.currency ?? "USD",
    codNotes: cod?.notes ?? null,
    codSettledAt: cod?.settled_at ?? null,
    codStatus: cod?.status ?? "not_started",
    currency: row.currency ?? "USD",
    customer: row.customer_name ?? null,
    deliveredAt: proof?.delivered_at ?? null,
    deliveryCodeRequired: Boolean(row.delivery_code_placeholder),
    id: row.id,
    orderId: row.order_id,
    orderNumber: row.order_number ?? row.order_id.slice(0, 8).toUpperCase(),
    phone: row.customer_phone ?? null,
    proofNotes: proof?.notes ?? null,
    proofSubmitted: Boolean(proof),
    returnNotes: deliveryReturn?.notes ?? null,
    returnReason: deliveryReturn?.reason ?? null,
    returnRequestedDate: deliveryReturn?.requested_delivery_date_placeholder ?? null,
    returnStatus: deliveryReturn?.status ?? null,
    source: row.order_source ?? "store_orders",
    status: normalizeAssignmentStatus(row.status),
    storeId: row.store_id,
    updatedAt: row.updated_at ?? row.assigned_at
  };
}

async function loadDeliveryAgentRows({
  email,
  userId
}: {
  email?: string | null;
  userId?: string | null;
}) {
  const admin = createAdminClient();

  if (!admin) {
    return [];
  }

  const select =
    "id, name, email, normalized_email, city_zone, status, availability_status, capacity_limit, current_active_orders, assigned_zone_ids, store_id, workspace_id, metadata, stores:store_id ( name )";

  if (userId) {
    const { data: linkedRows } = await admin
      .from("store_delivery_agents" as never)
      .select(select)
      .contains("metadata" as never, { auth_user_id: userId } as never)
      .order("created_at" as never, { ascending: false } as never);

    if (linkedRows?.length) {
      return linkedRows as unknown as DeliveryAgentRow[];
    }
  }

  const normalizedEmail = normalizeDeliveryEmail(email);

  if (!normalizedEmail) {
    return [];
  }

  const { data, error } = await admin
    .from("store_delivery_agents" as never)
    .select(select)
    .eq("normalized_email" as never, normalizedEmail as never)
    .order("created_at" as never, { ascending: false } as never);

  if (error) {
    console.warn("[delivery-access] agent lookup failed", {
      message: error.message,
      normalizedEmail,
      userId
    });
    return [];
  }

  return (data ?? []) as unknown as DeliveryAgentRow[];
}

export async function getDeliveryAccessForUser({
  email,
  userId
}: {
  email?: string | null;
  userId?: string | null;
}): Promise<DeliveryAccessLookup> {
  const normalizedEmail = normalizeDeliveryEmail(email);

  if (!normalizedEmail && !userId) {
    return { status: "missing_email" };
  }

  const rows = await loadDeliveryAgentRows({ email: normalizedEmail, userId });

  if (!rows.length) {
    return normalizedEmail ? { status: "not_found" } : { status: "missing_email" };
  }

  const access = toAccessRecord(rows[0]);

  if (access.status === "inactive") {
    return { access, status: "inactive" };
  }

  return { access, status: "approved" };
}

export async function findAuthUserIdByEmail(email: string) {
  const normalizedEmail = normalizeDeliveryEmail(email);

  if (!normalizedEmail) {
    return null;
  }

  const admin = createAdminClient();

  if (!admin) {
    return null;
  }

  const { data: profile } = await admin
    .from("profiles" as never)
    .select("id, email")
    .ilike("email", normalizedEmail)
    .maybeSingle();

  const profileUserId = (profile as { id?: string | null } | null)?.id ?? null;

  if (profileUserId) {
    return profileUserId;
  }

  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });

  if (error) {
    console.warn("[delivery-access] auth email lookup failed", {
      message: error.message,
      normalizedEmail
    });
    return null;
  }

  return data.users.find((user) => user.email?.toLowerCase() === normalizedEmail)?.id ?? null;
}

export async function linkDeliveryAgentToAuthUser({
  agentId,
  userId
}: {
  agentId: string;
  userId: string;
}) {
  const admin = createAdminClient();

  if (!admin) {
    return;
  }

  const { data: existing } = await admin
    .from("store_delivery_agents" as never)
    .select("metadata")
    .eq("id" as never, agentId as never)
    .maybeSingle();

  const metadata = ((existing as { metadata?: Record<string, unknown> } | null)?.metadata ??
    {}) as Record<string, unknown>;

  if (metadata.auth_user_id === userId) {
    return;
  }

  const { error } = await admin
    .from("store_delivery_agents" as never)
    .update({
      metadata: {
        ...metadata,
        auth_user_id: userId,
        linked_at: new Date().toISOString()
      },
      updated_at: new Date().toISOString()
    } as never)
    .eq("id" as never, agentId as never);

  if (error) {
    console.warn("[delivery-access] agent auth link skipped", {
      agentId,
      message: error.message,
      userId
    });
  }
}

export async function getDeliveryDashboardData({ user }: { user: { email?: string | null; id: string } }) {
  const lookup = await getDeliveryAccessForUser({
    email: user.email,
    userId: user.id
  });

  return lookup.status === "approved" || lookup.status === "inactive" ? lookup.access : null;
}

export async function getDeliveryAssignedOrdersData(
  agent: DeliveryAgentAccessRecord | null
): Promise<DeliveryAssignedOrdersData> {
  if (!agent) {
    return {
      acceptedOrders: 0,
      assignedOrders: 0,
      codCollectedToday: 0,
      codCollectedTotal: 0,
      codPendingSettlement: 0,
      codSettled: 0,
      completedReturns: 0,
      deliveredOrders: 0,
      failedDeliveries: 0,
      failedDeliveryRate: 0,
      orders: [],
      pickedUpOrders: 0,
      refusalRate: 0,
      rescheduleRate: 0,
      reschedules: 0,
      returnRate: 0,
      returnsInProgress: 0,
      returnedOrders: 0
    };
  }

  const admin = createAdminClient();

  if (!admin) {
    return {
      acceptedOrders: 0,
      assignedOrders: 0,
      codCollectedToday: 0,
      codCollectedTotal: 0,
      codPendingSettlement: 0,
      codSettled: 0,
      completedReturns: 0,
      deliveredOrders: 0,
      failedDeliveries: 0,
      failedDeliveryRate: 0,
      orders: [],
      pickedUpOrders: 0,
      refusalRate: 0,
      rescheduleRate: 0,
      reschedules: 0,
      returnRate: 0,
      returnsInProgress: 0,
      returnedOrders: 0
    };
  }

  const { data, error } = await admin
    .from("delivery_assignments" as never)
    .select(
      "id, store_id, order_id, order_source, delivery_agent_id, assigned_at, updated_at, status, order_number, customer_name, customer_phone, customer_city, order_amount, currency, delivery_code_placeholder"
    )
    .eq("delivery_agent_id" as never, agent.agentId as never)
    .eq("store_id" as never, agent.storeId as never)
    .order("assigned_at" as never, { ascending: false } as never);

  if (error) {
    console.warn("[delivery-assignments] assigned orders lookup failed", {
      agentId: agent.agentId,
      message: error.message,
      storeId: agent.storeId
    });

    return {
      acceptedOrders: 0,
      assignedOrders: 0,
      codCollectedToday: 0,
      codCollectedTotal: 0,
      codPendingSettlement: 0,
      codSettled: 0,
      completedReturns: 0,
      deliveredOrders: 0,
      failedDeliveries: 0,
      failedDeliveryRate: 0,
      orders: [],
      pickedUpOrders: 0,
      refusalRate: 0,
      rescheduleRate: 0,
      reschedules: 0,
      returnRate: 0,
      returnsInProgress: 0,
      returnedOrders: 0
    };
  }

  const assignmentRows = (data ?? []) as unknown as DeliveryAssignmentRow[];
  const assignmentIds = assignmentRows.map((row) => row.id);
  const proofByAssignmentId = new Map<string, DeliveryProofRow>();
  const codByAssignmentId = new Map<string, CodCollectionRow>();
  const returnByAssignmentId = new Map<string, DeliveryReturnRow>();

  if (assignmentIds.length) {
    const [proofResult, codResult, returnResult] = await Promise.all([
      admin
        .from("delivery_proofs" as never)
        .select("assignment_id, delivered_at, notes")
        .in("assignment_id" as never, assignmentIds as never),
      admin
        .from("cod_collections" as never)
        .select("assignment_id, amount, currency, status, collected_at, settled_at, notes")
        .in("assignment_id" as never, assignmentIds as never),
      admin
        .from("delivery_returns" as never)
        .select("assignment_id, reason, status, notes, requested_delivery_date_placeholder")
        .in("assignment_id" as never, assignmentIds as never)
    ]);
    const { data: proofRows, error: proofError } = proofResult;
    const { data: codRows, error: codError } = codResult;
    const { data: returnRows, error: returnError } = returnResult;

    if (proofError) {
      console.warn("[delivery-assignments] proof lookup failed", {
        agentId: agent.agentId,
        message: proofError.message
      });
    }

    if (codError) {
      console.warn("[delivery-assignments] cod lookup failed", {
        agentId: agent.agentId,
        message: codError.message
      });
    }

    if (returnError) {
      console.warn("[delivery-assignments] return lookup failed", {
        agentId: agent.agentId,
        message: returnError.message
      });
    }

    for (const proof of (proofRows ?? []) as unknown as DeliveryProofRow[]) {
      proofByAssignmentId.set(proof.assignment_id, proof);
    }

    for (const cod of (codRows ?? []) as unknown as CodCollectionRow[]) {
      codByAssignmentId.set(cod.assignment_id, cod);
    }

    for (const deliveryReturn of (returnRows ?? []) as unknown as DeliveryReturnRow[]) {
      returnByAssignmentId.set(deliveryReturn.assignment_id, deliveryReturn);
    }
  }

  const orders = assignmentRows.map((row) =>
    toAssignedOrder(row, proofByAssignmentId, codByAssignmentId, returnByAssignmentId)
  );
  const todayKey = new Date().toISOString().slice(0, 10);
  const totalOrders = Math.max(orders.length, 1);
  const failedDeliveries = orders.filter((order) => Boolean(order.returnStatus)).length;
  const returnsInProgress = orders.filter(
    (order) =>
      order.returnStatus === "customer_refused" ||
      order.returnStatus === "customer_unreachable" ||
      order.returnStatus === "wrong_address" ||
      order.returnStatus === "return_in_progress" ||
      order.returnStatus === "returned_to_store"
  ).length;
  const completedReturns = orders.filter((order) => order.returnStatus === "return_completed").length;
  const reschedules = orders.filter((order) => order.returnStatus === "reschedule_requested").length;
  const refusals = orders.filter((order) => order.returnReason === "customer_refused").length;

  return {
    acceptedOrders: orders.filter((order) => order.status === "accepted").length,
    assignedOrders: orders.filter((order) => order.status === "assigned").length,
    codCollectedToday: orders
      .filter((order) => order.codStatus === "collected" && order.codCollectedAt?.slice(0, 10) === todayKey)
      .reduce((sum, order) => sum + order.codAmount, 0),
    codCollectedTotal: orders
      .filter((order) => order.codStatus === "collected" || order.codStatus === "settled_to_store")
      .reduce((sum, order) => sum + order.codAmount, 0),
    codPendingSettlement: orders
      .filter((order) => order.codStatus === "collected")
      .reduce((sum, order) => sum + order.codAmount, 0),
    codSettled: orders
      .filter((order) => order.codStatus === "settled_to_store")
      .reduce((sum, order) => sum + order.codAmount, 0),
    completedReturns,
    deliveredOrders: orders.filter((order) => order.status === "delivered").length,
    failedDeliveries,
    failedDeliveryRate: Math.round((failedDeliveries / totalOrders) * 100),
    orders,
    pickedUpOrders: orders.filter((order) => order.status === "picked_up").length,
    refusalRate: Math.round((refusals / totalOrders) * 100),
    rescheduleRate: Math.round((reschedules / totalOrders) * 100),
    reschedules,
    returnRate: Math.round(((returnsInProgress + completedReturns) / totalOrders) * 100),
    returnsInProgress,
    returnedOrders: orders.filter((order) => order.status === "returned").length
  };
}

export async function getDeliveryRouteCapacityData(
  agent: DeliveryAgentAccessRecord | null
): Promise<DeliveryRouteCapacityData> {
  if (!agent) {
    return {
      activeOrders: 0,
      assignedZones: [],
      availabilityStatus: "offline",
      capacityLimit: 0,
      remainingCapacity: 0
    };
  }

  const admin = createAdminClient();

  if (!admin) {
    return {
      activeOrders: agent.currentActiveOrders,
      assignedZones: [],
      availabilityStatus: agent.availabilityStatus,
      capacityLimit: agent.capacityLimit,
      remainingCapacity: Math.max(agent.capacityLimit - agent.currentActiveOrders, 0)
    };
  }

  const [{ count }, zonesResult] = await Promise.all([
    admin
      .from("delivery_assignments" as never)
      .select("id", { count: "exact", head: true } as never)
      .eq("workspace_id" as never, agent.workspaceId as never)
      .eq("store_id" as never, agent.storeId as never)
      .eq("delivery_agent_id" as never, agent.agentId as never)
      .in("status" as never, ["assigned", "accepted", "picked_up"] as never),
    agent.assignedZoneIds.length
      ? admin
          .from("delivery_zones" as never)
          .select("id, name, city, region, is_active")
          .eq("workspace_id" as never, agent.workspaceId as never)
          .eq("store_id" as never, agent.storeId as never)
          .in("id" as never, agent.assignedZoneIds as never)
      : Promise.resolve({ data: [], error: null })
  ]);
  const activeOrders = count ?? agent.currentActiveOrders;
  const assignedZones = ((zonesResult.data ?? []) as unknown as Array<{
    city?: string | null;
    id: string;
    is_active?: boolean | null;
    name: string;
    region?: string | null;
  }>).map((zone) => ({
    city: zone.city ?? null,
    id: zone.id,
    isActive: zone.is_active !== false,
    name: zone.name,
    region: zone.region ?? null
  }));

  return {
    activeOrders,
    assignedZones,
    availabilityStatus: agent.availabilityStatus,
    capacityLimit: agent.capacityLimit,
    remainingCapacity: Math.max(agent.capacityLimit - activeOrders, 0)
  };
}
