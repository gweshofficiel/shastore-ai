import type { DeliveryAgentAccessRecord } from "@/lib/delivery/data";
import { getDeliveryAssignedOrdersData } from "@/lib/delivery/data";
import { getDeliveryIncidentsForAgent } from "@/lib/delivery/incident-data";
import { calculateDeliveryPerformanceMetrics } from "@/lib/delivery/performance-data";
import { createAdminClient } from "@/lib/supabase/admin";

export type DeliveryScoreLevel = "Low" | "Medium" | "Good" | "Excellent";
export type DeliveryReputationLevel = "Bronze" | "Silver" | "Gold" | "Platinum" | "Elite";
export type DeliveryReputationBadge =
  | "Fast Delivery"
  | "Trusted Courier"
  | "COD Reliable"
  | "Top Rated"
  | "Low Returns"
  | "High Completion"
  | "No Incidents";

export type DeliveryReputationData = {
  badges: DeliveryReputationBadge[];
  level: DeliveryReputationLevel;
  metrics: {
    averageRating: number;
    codReliability: number;
    completedDeliveries: number;
    incidentCount: number;
    onTimeRatePlaceholder: number;
    returnRate: number;
    successRate: number;
  };
  nextLevelProgress: number;
  rewards: {
    monthlyBonusPlaceholder: number;
    recognitionBadgePlaceholder: string;
    rewardPointsPlaceholder: number;
  };
  riskIndicator: "Low" | "Medium" | "High" | "Critical";
  score: number;
  scoreLevel: DeliveryScoreLevel;
};

type CodReliabilityRow = {
  status?: string | null;
};

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function scoreLevel(score: number): DeliveryScoreLevel {
  if (score >= 85) {
    return "Excellent";
  }

  if (score >= 70) {
    return "Good";
  }

  if (score >= 45) {
    return "Medium";
  }

  return "Low";
}

function deliveryLevel(score: number, completedDeliveries: number): DeliveryReputationLevel {
  if (score >= 95 && completedDeliveries >= 100) {
    return "Elite";
  }

  if (score >= 88 && completedDeliveries >= 50) {
    return "Platinum";
  }

  if (score >= 78 && completedDeliveries >= 25) {
    return "Gold";
  }

  if (score >= 60 && completedDeliveries >= 10) {
    return "Silver";
  }

  return "Bronze";
}

function nextLevelProgress(score: number, completedDeliveries: number) {
  const scoreTarget = score < 60 ? 60 : score < 78 ? 78 : score < 88 ? 88 : score < 95 ? 95 : 100;
  const deliveryTarget = completedDeliveries < 10 ? 10 : completedDeliveries < 25 ? 25 : completedDeliveries < 50 ? 50 : completedDeliveries < 100 ? 100 : 100;
  const scoreProgress = Math.min(score / scoreTarget, 1);
  const deliveryProgress = Math.min(completedDeliveries / deliveryTarget, 1);

  return Math.round(((scoreProgress + deliveryProgress) / 2) * 100);
}

function badgesForMetrics({
  averageDeliveryTime,
  averageRating,
  codReliability,
  completedDeliveries,
  incidentCount,
  returnRate,
  successRate
}: {
  averageDeliveryTime: number;
  averageRating: number;
  codReliability: number;
  completedDeliveries: number;
  incidentCount: number;
  returnRate: number;
  successRate: number;
}): DeliveryReputationBadge[] {
  const badges: DeliveryReputationBadge[] = [];

  if (averageDeliveryTime > 0 && averageDeliveryTime <= 120) {
    badges.push("Fast Delivery");
  }

  if (successRate >= 90 && completedDeliveries >= 10) {
    badges.push("Trusted Courier");
  }

  if (codReliability >= 95) {
    badges.push("COD Reliable");
  }

  if (averageRating >= 4.7) {
    badges.push("Top Rated");
  }

  if (returnRate <= 5 && completedDeliveries >= 10) {
    badges.push("Low Returns");
  }

  if (successRate >= 85 && completedDeliveries >= 20) {
    badges.push("High Completion");
  }

  if (incidentCount === 0) {
    badges.push("No Incidents");
  }

  return badges;
}

async function codReliabilityForAgent({
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
    return 0;
  }

  const { data } = await admin
    .from("cod_collections" as never)
    .select("status")
    .eq("workspace_id" as never, workspaceId as never)
    .eq("store_id" as never, storeId as never)
    .eq("delivery_agent_id" as never, agentId as never);
  const rows = (data ?? []) as unknown as CodReliabilityRow[];

  if (!rows.length) {
    return 0;
  }

  const reliable = rows.filter((row) => row.status === "collected" || row.status === "settled_to_store").length;
  return Math.round((reliable / rows.length) * 10000) / 100;
}

export async function getDeliveryReputationData(agent: DeliveryAgentAccessRecord | null): Promise<DeliveryReputationData> {
  if (!agent) {
    return emptyReputation();
  }

  const [performance, assignments, incidents, codReliability] = await Promise.all([
    calculateDeliveryPerformanceMetrics({
      agentId: agent.agentId,
      storeId: agent.storeId,
      workspaceId: agent.workspaceId
    }),
    getDeliveryAssignedOrdersData(agent),
    getDeliveryIncidentsForAgent({
      agentId: agent.agentId,
      storeId: agent.storeId,
      workspaceId: agent.workspaceId
    }),
    codReliabilityForAgent({
      agentId: agent.agentId,
      storeId: agent.storeId,
      workspaceId: agent.workspaceId
    })
  ]);
  const completedDeliveries = performance.totalDeliveredOrders;
  const incidentCount = incidents.summary.active;
  const ratingScore = performance.ratingAverage ? (performance.ratingAverage / 5) * 100 : 0;
  const score = clampScore(
    performance.successRate * 0.3 +
      ratingScore * 0.25 +
      codReliability * 0.15 +
      Math.max(0, 100 - performance.returnRate) * 0.15 +
      Math.max(0, 100 - incidentCount * 12) * 0.1 +
      Math.min(completedDeliveries, 100) * 0.05
  );
  const level = deliveryLevel(score, completedDeliveries);
  const badges = badgesForMetrics({
    averageDeliveryTime: performance.averageDeliveryTime,
    averageRating: performance.ratingAverage,
    codReliability,
    completedDeliveries,
    incidentCount,
    returnRate: performance.returnRate,
    successRate: performance.successRate
  });

  return {
    badges,
    level,
    metrics: {
      averageRating: performance.ratingAverage,
      codReliability,
      completedDeliveries,
      incidentCount,
      onTimeRatePlaceholder: 0,
      returnRate: performance.returnRate || assignments.returnRate,
      successRate: performance.successRate
    },
    nextLevelProgress: nextLevelProgress(score, completedDeliveries),
    rewards: {
      monthlyBonusPlaceholder: 0,
      recognitionBadgePlaceholder: badges[0] ?? "Recognition pending",
      rewardPointsPlaceholder: score * 10 + completedDeliveries * 2
    },
    riskIndicator: incidents.summary.riskLevel,
    score,
    scoreLevel: scoreLevel(score)
  };
}

export async function getDeliveryReputationMap({
  agentIds,
  storeId,
  workspaceId
}: {
  agentIds: string[];
  storeId: string;
  workspaceId: string;
}) {
  const admin = createAdminClient();
  const reputations = new Map<string, DeliveryReputationData>();

  if (!admin || !agentIds.length) {
    return reputations;
  }

  const { data } = await admin
    .from("store_delivery_agents" as never)
    .select("id, name, email, status, store_id, workspace_id, city_zone, availability_status, capacity_limit, current_active_orders, assigned_zone_ids")
    .eq("workspace_id" as never, workspaceId as never)
    .eq("store_id" as never, storeId as never)
    .in("id" as never, agentIds as never);

  for (const row of (data ?? []) as unknown as Array<{
    assigned_zone_ids?: string[] | null;
    availability_status?: "online" | "offline" | "busy" | null;
    capacity_limit?: number | null;
    city_zone?: string | null;
    current_active_orders?: number | null;
    email?: string | null;
    id: string;
    name: string;
    status?: "active" | "inactive" | null;
    store_id: string;
    workspace_id: string;
  }>) {
    reputations.set(
      row.id,
      await getDeliveryReputationData({
        agentId: row.id,
        agentName: row.name,
        assignedZoneIds: row.assigned_zone_ids ?? [],
        availabilityStatus: row.availability_status ?? "offline",
        capacityLimit: row.capacity_limit ?? 0,
        cityZone: row.city_zone ?? null,
        currentActiveOrders: row.current_active_orders ?? 0,
        email: row.email ?? null,
        role: row.status === "inactive" ? "suspended_delivery" : "delivery",
        status: row.status === "inactive" ? "inactive" : "active",
        storeId: row.store_id,
        storeName: null,
        workspaceId: row.workspace_id
      })
    );
  }

  return reputations;
}

function emptyReputation(): DeliveryReputationData {
  return {
    badges: [],
    level: "Bronze",
    metrics: {
      averageRating: 0,
      codReliability: 0,
      completedDeliveries: 0,
      incidentCount: 0,
      onTimeRatePlaceholder: 0,
      returnRate: 0,
      successRate: 0
    },
    nextLevelProgress: 0,
    rewards: {
      monthlyBonusPlaceholder: 0,
      recognitionBadgePlaceholder: "Recognition pending",
      rewardPointsPlaceholder: 0
    },
    riskIndicator: "Low",
    score: 0,
    scoreLevel: "Low"
  };
}
