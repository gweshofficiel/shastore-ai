import { getDeliveryAssignedOrdersData, getDeliveryRouteCapacityData, type DeliveryAgentAccessRecord } from "@/lib/delivery/data";
import { calculateDeliveryPerformanceMetrics } from "@/lib/delivery/performance-data";
import { createAdminClient } from "@/lib/supabase/admin";

export type DeliveryAnalyticsTimelineItem = {
  createdAt: string;
  label: string;
  message: string;
  source: string;
};

export type DeliveryAnalyticsData = {
  activity: {
    todayCollections: number;
    todayDeliveries: number;
    todayMessages: number;
    todayReturns: number;
  };
  monthly: {
    monthlyCollections: number;
    monthlyDeliveries: number;
    monthlyPerformance: number;
    monthlyReturns: number;
  };
  operations: {
    assignedOrdersQueue: Array<{
      amount: number;
      city: string | null;
      currency: string;
      id: string;
      orderNumber: string;
      status: string;
    }>;
    availabilityStatus: string;
    currentLoad: number;
    currentZone: string;
    remainingCapacity: number;
  };
  overview: {
    assignedOrders: number;
    averageRating: number;
    codCollected: number;
    codPending: number;
    currentCapacityUsage: number;
    deliveredOrders: number;
    returnedOrders: number;
    successRate: number;
  };
  performance: {
    averageDeliveryTime: number;
    ratingAverage: number;
    rank: string;
    returnRate: number;
    successRate: number;
  };
  timeline: DeliveryAnalyticsTimelineItem[];
  weekly: {
    weeklyCod: number;
    weeklyDeliveries: number;
    weeklyRatingTrend: number;
    weeklySuccessRate: number;
  };
};

type DateRow = {
  amount?: number | string | null;
  collected_at?: string | null;
  created_at?: string | null;
  delivered_at?: string | null;
  message?: string | null;
  rating?: number | string | null;
};

type DeliveryEventRow = {
  created_at: string;
  event_type: string;
  message: string;
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

function sameDay(value: string | null | undefined, date = new Date()) {
  return Boolean(value && value.slice(0, 10) === date.toISOString().slice(0, 10));
}

function withinDays(value: string | null | undefined, days: number) {
  if (!value) {
    return false;
  }

  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  return new Date(value).getTime() >= since;
}

function timelineSort(a: DeliveryAnalyticsTimelineItem, b: DeliveryAnalyticsTimelineItem) {
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

function emptyAnalytics(agent: DeliveryAgentAccessRecord | null): DeliveryAnalyticsData {
  return {
    activity: {
      todayCollections: 0,
      todayDeliveries: 0,
      todayMessages: 0,
      todayReturns: 0
    },
    monthly: {
      monthlyCollections: 0,
      monthlyDeliveries: 0,
      monthlyPerformance: 0,
      monthlyReturns: 0
    },
    operations: {
      assignedOrdersQueue: [],
      availabilityStatus: agent?.availabilityStatus ?? "offline",
      currentLoad: agent?.currentActiveOrders ?? 0,
      currentZone: agent?.cityZone ?? "No zone assigned",
      remainingCapacity: Math.max((agent?.capacityLimit ?? 0) - (agent?.currentActiveOrders ?? 0), 0)
    },
    overview: {
      assignedOrders: 0,
      averageRating: 0,
      codCollected: 0,
      codPending: 0,
      currentCapacityUsage: 0,
      deliveredOrders: 0,
      returnedOrders: 0,
      successRate: 0
    },
    performance: {
      averageDeliveryTime: 0,
      ratingAverage: 0,
      rank: "Bronze",
      returnRate: 0,
      successRate: 0
    },
    timeline: [],
    weekly: {
      weeklyCod: 0,
      weeklyDeliveries: 0,
      weeklyRatingTrend: 0,
      weeklySuccessRate: 0
    }
  };
}

export async function getDeliveryAnalyticsData(agent: DeliveryAgentAccessRecord | null): Promise<DeliveryAnalyticsData> {
  if (!agent) {
    return emptyAnalytics(agent);
  }

  const admin = createAdminClient();
  const [ordersData, routeData, performance] = await Promise.all([
    getDeliveryAssignedOrdersData(agent),
    getDeliveryRouteCapacityData(agent),
    calculateDeliveryPerformanceMetrics({
      agentId: agent.agentId,
      storeId: agent.storeId,
      workspaceId: agent.workspaceId
    })
  ]);

  if (!admin) {
    return {
      ...emptyAnalytics(agent),
      operations: {
        assignedOrdersQueue: ordersData.orders
          .filter((order) => order.status === "assigned" || order.status === "accepted" || order.status === "picked_up")
          .slice(0, 8)
          .map((order) => ({
            amount: order.amount,
            city: order.city,
            currency: order.currency,
            id: order.id,
            orderNumber: order.orderNumber,
            status: order.status
          })),
        availabilityStatus: routeData.availabilityStatus,
        currentLoad: routeData.activeOrders,
        currentZone: routeData.assignedZones[0]?.name ?? agent.cityZone ?? "No zone assigned",
        remainingCapacity: routeData.remainingCapacity
      },
      overview: {
        assignedOrders: ordersData.assignedOrders + ordersData.acceptedOrders + ordersData.pickedUpOrders,
        averageRating: performance.ratingAverage,
        codCollected: ordersData.codCollectedTotal,
        codPending: ordersData.codPendingSettlement,
        currentCapacityUsage: routeData.capacityLimit ? Math.round((routeData.activeOrders / routeData.capacityLimit) * 100) : 0,
        deliveredOrders: ordersData.deliveredOrders,
        returnedOrders: ordersData.returnedOrders,
        successRate: performance.successRate
      },
      performance: {
        averageDeliveryTime: performance.averageDeliveryTime,
        ratingAverage: performance.ratingAverage,
        rank: performance.rank,
        returnRate: performance.returnRate,
        successRate: performance.successRate
      }
    };
  }

  const [proofsResult, returnsResult, codResult, messagesResult, ratingsResult, eventsResult] = await Promise.all([
    admin
      .from("delivery_proofs" as never)
      .select("delivered_at")
      .eq("workspace_id" as never, agent.workspaceId as never)
      .eq("store_id" as never, agent.storeId as never)
      .eq("delivery_agent_id" as never, agent.agentId as never),
    admin
      .from("delivery_returns" as never)
      .select("created_at, status, reason")
      .eq("workspace_id" as never, agent.workspaceId as never)
      .eq("store_id" as never, agent.storeId as never)
      .eq("delivery_agent_id" as never, agent.agentId as never),
    admin
      .from("cod_collections" as never)
      .select("amount, collected_at, status")
      .eq("workspace_id" as never, agent.workspaceId as never)
      .eq("store_id" as never, agent.storeId as never)
      .eq("delivery_agent_id" as never, agent.agentId as never),
    admin
      .from("delivery_messages" as never)
      .select("created_at, message, sender_type")
      .eq("workspace_id" as never, agent.workspaceId as never)
      .eq("store_id" as never, agent.storeId as never)
      .eq("delivery_agent_id" as never, agent.agentId as never),
    admin
      .from("delivery_ratings" as never)
      .select("created_at, rating")
      .eq("workspace_id" as never, agent.workspaceId as never)
      .eq("store_id" as never, agent.storeId as never)
      .eq("delivery_agent_id" as never, agent.agentId as never),
    admin
      .from("store_delivery_events" as never)
      .select("created_at, event_type, message")
      .eq("workspace_id" as never, agent.workspaceId as never)
      .eq("store_id" as never, agent.storeId as never)
      .eq("delivery_agent_id" as never, agent.agentId as never)
      .order("created_at" as never, { ascending: false } as never)
      .limit(30)
  ]);
  const proofs = (proofsResult.data ?? []) as unknown as DateRow[];
  const returns = (returnsResult.data ?? []) as unknown as DateRow[];
  const codRows = (codResult.data ?? []) as unknown as DateRow[];
  const messages = (messagesResult.data ?? []) as unknown as DateRow[];
  const ratings = (ratingsResult.data ?? []) as unknown as DateRow[];
  const events = (eventsResult.data ?? []) as unknown as DeliveryEventRow[];
  const weeklyAssignments = ordersData.orders.filter((order) => withinDays(order.assignedAt, 7));
  const weeklyDelivered = proofs.filter((proof) => withinDays(proof.delivered_at, 7)).length;
  const weeklyRatings = ratings.filter((rating) => withinDays(rating.created_at, 7));
  const monthlyDeliveries = proofs.filter((proof) => withinDays(proof.delivered_at, 30)).length;
  const monthlyReturns = returns.filter((row) => withinDays(row.created_at, 30)).length;
  const monthlyCollections = codRows
    .filter((row) => withinDays(row.collected_at, 30))
    .reduce((sum, row) => sum + numericValue(row.amount), 0);
  const timeline = [
    ...events.map((event) => ({
      createdAt: event.created_at,
      label: event.event_type.replaceAll("_", " "),
      message: event.message,
      source: "Delivery timeline"
    })),
    ...proofs
      .filter((proof) => proof.delivered_at)
      .map((proof) => ({
        createdAt: proof.delivered_at as string,
        label: "Proof submitted",
        message: "Proof of delivery submitted.",
        source: "Proof"
      })),
    ...codRows
      .filter((row) => row.collected_at)
      .map((row) => ({
        createdAt: row.collected_at as string,
        label: "COD collected",
        message: `Collected ${numericValue(row.amount).toLocaleString()}.`,
        source: "COD"
      })),
    ...returns
      .filter((row) => row.created_at)
      .map((row) => ({
        createdAt: row.created_at as string,
        label: "Return activity",
        message: "Return or failed delivery activity recorded.",
        source: "Returns"
      })),
    ...messages
      .filter((message) => message.created_at)
      .map((message) => ({
        createdAt: message.created_at as string,
        label: "Message",
        message: message.message ?? "Delivery communication message.",
        source: "Messages"
      }))
  ]
    .sort(timelineSort)
    .slice(0, 30);

  return {
    activity: {
      todayCollections: codRows.filter((row) => sameDay(row.collected_at)).length,
      todayDeliveries: proofs.filter((proof) => sameDay(proof.delivered_at)).length,
      todayMessages: messages.filter((message) => sameDay(message.created_at)).length,
      todayReturns: returns.filter((row) => sameDay(row.created_at)).length
    },
    monthly: {
      monthlyCollections,
      monthlyDeliveries,
      monthlyPerformance: performance.successRate,
      monthlyReturns
    },
    operations: {
      assignedOrdersQueue: ordersData.orders
        .filter((order) => order.status === "assigned" || order.status === "accepted" || order.status === "picked_up")
        .slice(0, 8)
        .map((order) => ({
          amount: order.amount,
          city: order.city,
          currency: order.currency,
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status
        })),
      availabilityStatus: routeData.availabilityStatus,
      currentLoad: routeData.activeOrders,
      currentZone: routeData.assignedZones[0]?.name ?? agent.cityZone ?? "No zone assigned",
      remainingCapacity: routeData.remainingCapacity
    },
    overview: {
      assignedOrders: ordersData.assignedOrders + ordersData.acceptedOrders + ordersData.pickedUpOrders,
      averageRating: performance.ratingAverage,
      codCollected: ordersData.codCollectedTotal,
      codPending: ordersData.codPendingSettlement,
      currentCapacityUsage: routeData.capacityLimit ? Math.round((routeData.activeOrders / routeData.capacityLimit) * 100) : 0,
      deliveredOrders: ordersData.deliveredOrders,
      returnedOrders: ordersData.returnedOrders,
      successRate: performance.successRate
    },
    performance: {
      averageDeliveryTime: performance.averageDeliveryTime,
      ratingAverage: performance.ratingAverage,
      rank: performance.rank,
      returnRate: performance.returnRate,
      successRate: performance.successRate
    },
    timeline,
    weekly: {
      weeklyCod: codRows.filter((row) => withinDays(row.collected_at, 7)).reduce((sum, row) => sum + numericValue(row.amount), 0),
      weeklyDeliveries: weeklyDelivered,
      weeklyRatingTrend: weeklyRatings.length
        ? Math.round((weeklyRatings.reduce((sum, row) => sum + numericValue(row.rating), 0) / weeklyRatings.length) * 100) / 100
        : 0,
      weeklySuccessRate: weeklyAssignments.length ? Math.round((weeklyDelivered / weeklyAssignments.length) * 10000) / 100 : 0
    }
  };
}
