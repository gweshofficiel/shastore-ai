import { createAdminClient } from "@/lib/supabase/admin";
import { createDeliveryNotification } from "@/lib/delivery/communication-data";

export type DeliveryRank = "Bronze" | "Silver" | "Gold" | "Platinum";

export type DeliveryPerformanceMetrics = {
  averageDeliveryTime: number;
  deliveryAgentId: string;
  failedOrders: number;
  ratingAverage: number;
  ratingCount: number;
  rank: DeliveryRank;
  returnRate: number;
  returnedOrders: number;
  successRate: number;
  totalAssignedOrders: number;
  totalDeliveredOrders: number;
};

export type DeliveryRatingSummary = {
  comment: string | null;
  createdAt: string;
  id: string;
  orderId: string;
  rating: number;
};

type AssignmentMetricRow = {
  assigned_at: string | null;
  delivery_agent_id: string;
  status: string | null;
};

type ProofMetricRow = {
  assignment_id?: string | null;
  delivered_at?: string | null;
};

type RatingMetricRow = {
  comment?: string | null;
  created_at?: string | null;
  id: string;
  order_id: string;
  rating: number | string;
};

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

export function deliveryRankForMetrics({
  ratingAverage,
  successRate,
  totalDeliveredOrders
}: {
  ratingAverage: number;
  successRate: number;
  totalDeliveredOrders: number;
}): DeliveryRank {
  if (successRate >= 95 && ratingAverage >= 4.8 && totalDeliveredOrders >= 50) {
    return "Platinum";
  }

  if (successRate >= 90 && ratingAverage >= 4.5 && totalDeliveredOrders >= 25) {
    return "Gold";
  }

  if (successRate >= 75 && ratingAverage >= 4 && totalDeliveredOrders >= 10) {
    return "Silver";
  }

  return "Bronze";
}

function emptyMetrics(agentId: string): DeliveryPerformanceMetrics {
  return {
    averageDeliveryTime: 0,
    deliveryAgentId: agentId,
    failedOrders: 0,
    ratingAverage: 0,
    ratingCount: 0,
    rank: "Bronze",
    returnRate: 0,
    returnedOrders: 0,
    successRate: 0,
    totalAssignedOrders: 0,
    totalDeliveredOrders: 0
  };
}

export async function calculateDeliveryPerformanceMetrics({
  agentId,
  storeId,
  workspaceId
}: {
  agentId: string;
  storeId: string;
  workspaceId: string;
}): Promise<DeliveryPerformanceMetrics> {
  const admin = createAdminClient();

  if (!admin) {
    return emptyMetrics(agentId);
  }

  const [assignmentsResult, proofsResult, returnsResult, ratingsResult] = await Promise.all([
    admin
      .from("delivery_assignments" as never)
      .select("id, delivery_agent_id, status, assigned_at")
      .eq("workspace_id" as never, workspaceId as never)
      .eq("store_id" as never, storeId as never)
      .eq("delivery_agent_id" as never, agentId as never),
    admin
      .from("delivery_proofs" as never)
      .select("assignment_id, delivered_at")
      .eq("workspace_id" as never, workspaceId as never)
      .eq("store_id" as never, storeId as never)
      .eq("delivery_agent_id" as never, agentId as never),
    admin
      .from("delivery_returns" as never)
      .select("id")
      .eq("workspace_id" as never, workspaceId as never)
      .eq("store_id" as never, storeId as never)
      .eq("delivery_agent_id" as never, agentId as never),
    admin
      .from("delivery_ratings" as never)
      .select("id, rating")
      .eq("workspace_id" as never, workspaceId as never)
      .eq("store_id" as never, storeId as never)
      .eq("delivery_agent_id" as never, agentId as never)
  ]);
  const assignments = (assignmentsResult.data ?? []) as unknown as Array<AssignmentMetricRow & { id: string }>;
  const proofByAssignmentId = new Map<string, ProofMetricRow>();

  for (const proof of (proofsResult.data ?? []) as unknown as ProofMetricRow[]) {
    if (proof.assignment_id) {
      proofByAssignmentId.set(proof.assignment_id, proof);
    }
  }

  const totalAssignedOrders = assignments.length;
  const totalDeliveredOrders = assignments.filter((assignment) => assignment.status === "delivered").length;
  const totalReturnedOrders = assignments.filter((assignment) => assignment.status === "returned").length;
  const totalFailedOrders = ((returnsResult.data ?? []) as unknown[]).length;
  const deliveredDurations = assignments
    .map((assignment) => {
      const deliveredAt = proofByAssignmentId.get(assignment.id)?.delivered_at;

      if (!assignment.assigned_at || !deliveredAt) {
        return null;
      }

      const minutes = (new Date(deliveredAt).getTime() - new Date(assignment.assigned_at).getTime()) / 60000;
      return Number.isFinite(minutes) && minutes >= 0 ? minutes : null;
    })
    .filter((value): value is number => value !== null);
  const ratings = (ratingsResult.data ?? []) as unknown as RatingMetricRow[];
  const ratingCount = ratings.length;
  const ratingAverage = ratingCount
    ? Math.round((ratings.reduce((sum, rating) => sum + numericValue(rating.rating), 0) / ratingCount) * 100) / 100
    : 0;
  const successRate = totalAssignedOrders
    ? Math.round((totalDeliveredOrders / totalAssignedOrders) * 10000) / 100
    : 0;
  const returnRate = totalAssignedOrders
    ? Math.round((totalReturnedOrders / totalAssignedOrders) * 10000) / 100
    : 0;
  const averageDeliveryTime = deliveredDurations.length
    ? Math.round((deliveredDurations.reduce((sum, value) => sum + value, 0) / deliveredDurations.length) * 100) / 100
    : 0;

  return {
    averageDeliveryTime,
    deliveryAgentId: agentId,
    failedOrders: totalFailedOrders,
    ratingAverage,
    ratingCount,
    rank: deliveryRankForMetrics({ ratingAverage, successRate, totalDeliveredOrders }),
    returnRate,
    returnedOrders: totalReturnedOrders,
    successRate,
    totalAssignedOrders,
    totalDeliveredOrders
  };
}

export async function upsertDeliveryPerformanceSnapshot({
  actorUserId,
  agentId,
  storeId,
  workspaceId
}: {
  actorUserId?: string | null;
  agentId: string;
  storeId: string;
  workspaceId: string;
}) {
  const admin = createAdminClient();

  if (!admin) {
    return null;
  }

  const metrics = await calculateDeliveryPerformanceMetrics({ agentId, storeId, workspaceId });
  const recalculatedAt = new Date().toISOString();
  await admin.from("delivery_agent_performance" as never).upsert(
    {
      average_delivery_time: metrics.averageDeliveryTime,
      delivery_agent_id: agentId,
      metadata: {
        rank: metrics.rank,
        source: "delivery_performance_recalculation"
      },
      rating_average: metrics.ratingAverage,
      rating_count: metrics.ratingCount,
      recalculated_at: recalculatedAt,
      return_rate: metrics.returnRate,
      store_id: storeId,
      success_rate: metrics.successRate,
      total_assigned_orders: metrics.totalAssignedOrders,
      total_delivered_orders: metrics.totalDeliveredOrders,
      total_failed_orders: metrics.failedOrders,
      total_returned_orders: metrics.returnedOrders,
      updated_at: recalculatedAt,
      workspace_id: workspaceId
    } as never,
    { onConflict: "delivery_agent_id" } as never
  );

  await admin.from("monitoring_events" as never).insert({
    entity_id: agentId,
    entity_type: "delivery_agent_performance",
    event_status: "info",
    event_type: "delivery_performance_recalculated",
    metadata: {
      metrics,
      source: "delivery_performance"
    },
    store_id: storeId,
    user_id: actorUserId ?? null,
    workspace_id: workspaceId
  } as never);

  await createDeliveryNotification({
    agentId,
    category: "performance_update",
    message: `Performance updated: ${metrics.successRate}% success rate, ${metrics.ratingAverage}/5 rating.`,
    storeId,
    title: `${metrics.rank} performance update`,
    workspaceId,
    metadata: {
      metrics,
      source: "delivery_performance"
    }
  });

  return metrics;
}

export async function getDeliveryRatingsForAgent({
  agentId,
  storeId,
  workspaceId,
  limit = 10
}: {
  agentId: string;
  storeId: string;
  workspaceId: string;
  limit?: number;
}): Promise<DeliveryRatingSummary[]> {
  const admin = createAdminClient();

  if (!admin) {
    return [];
  }

  const { data } = await admin
    .from("delivery_ratings" as never)
    .select("id, order_id, rating, comment, created_at")
    .eq("workspace_id" as never, workspaceId as never)
    .eq("store_id" as never, storeId as never)
    .eq("delivery_agent_id" as never, agentId as never)
    .order("created_at" as never, { ascending: false } as never)
    .limit(limit);

  return ((data ?? []) as unknown as RatingMetricRow[]).map((rating) => ({
    comment: rating.comment ?? null,
    createdAt: rating.created_at ?? new Date().toISOString(),
    id: rating.id,
    orderId: rating.order_id,
    rating: numericValue(rating.rating)
  }));
}
