"use server";

import { revalidatePath } from "next/cache";
import { getAdminAccess } from "@/lib/admin-access";
import { getBillingPlan } from "@/lib/billing/plans";
import { recordStoreAuditLogSafe, type StoreAuditAction } from "@/lib/audit/store-audit";
import { createAdminClient } from "@/lib/supabase/admin";

type SellerGovernanceStatus = "suspended" | "under_review";
type SellerRiskStatus = "clear" | "high_risk" | "reviewed";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function cleanSellerId(formData: FormData) {
  return String(formData.get("sellerId") ?? "").trim();
}

function storeAuditAction(status: SellerGovernanceStatus | "restored"): StoreAuditAction {
  if (status === "suspended") {
    return "admin.store_suspended";
  }

  if (status === "under_review") {
    return "admin.store_marked_under_review";
  }

  return "admin.store_restored";
}

async function setSellerGovernanceStatus({
  restore,
  sellerId,
  status
}: {
  restore?: boolean;
  sellerId: string;
  status?: SellerGovernanceStatus;
}) {
  const access = await getAdminAccess();

  if (!sellerId) {
    throw new Error("Missing seller ID.");
  }

  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for seller governance.");
  }

  const { data: subscription } = await admin
    .from("user_subscriptions" as never)
    .select("plan_id, status, limits_snapshot")
    .eq("user_id" as never, sellerId as never)
    .maybeSingle();
  const currentSubscription = subscription as {
    limits_snapshot: Record<string, unknown> | null;
    plan_id: string | null;
    status: string | null;
  } | null;
  const plan = getBillingPlan(currentSubscription?.plan_id ?? "free");
  const currentMetadata = isRecord(currentSubscription?.limits_snapshot)
    ? currentSubscription.limits_snapshot
    : {};
  const adminGovernance = restore
    ? {
        restoredAt: new Date().toISOString(),
        source: "super_admin_seller_management",
        status: "active"
      }
    : {
        source: "super_admin_seller_management",
        status,
        updatedAt: new Date().toISOString()
      };
  const nextSubscriptionStatus = restore
    ? "active"
    : status === "suspended"
      ? "incomplete"
      : currentSubscription?.status ?? "active";

  if (!restore && !status) {
    throw new Error("Missing seller governance status.");
  }

  await admin.from("user_subscriptions" as never).upsert(
    {
      limits_snapshot: {
        ...currentMetadata,
        adminGovernance
      },
      plan_id: plan.id,
      status: nextSubscriptionStatus,
      user_id: sellerId
    } as never,
    { onConflict: "user_id" }
  );

  const { data: stores } = await admin
    .from("stores" as never)
    .select("id, status, slug, store_data")
    .or(`owner_user_id.eq.${sellerId},user_id.eq.${sellerId}`);
  const ownedStores = (Array.isArray(stores) ? stores : []) as Array<{
    id?: string;
    slug?: string | null;
    status?: string | null;
    store_data?: unknown;
  }>;

  for (const store of ownedStores) {
    if (!store.id) {
      continue;
    }

    const currentStoreData = isRecord(store.store_data) ? store.store_data : {};
    const currentGovernance = isRecord(currentStoreData.adminGovernance)
      ? currentStoreData.adminGovernance
      : {};
    const previousStatus =
      typeof currentGovernance.previousStatus === "string"
        ? currentGovernance.previousStatus
        : store.status ?? "draft";
    const nextStoreStatus = restore
      ? previousStatus === "published"
        ? "published"
        : "draft"
      : "draft";
    const nextStoreGovernance = restore
      ? {
          ...currentGovernance,
          restoredAt: new Date().toISOString(),
          source: "super_admin_seller_management",
          status: "restored"
        }
      : {
          previousStatus: store.status ?? "draft",
          source: "super_admin_seller_management",
          status,
          updatedAt: new Date().toISOString()
        };

    await admin
      .from("stores" as never)
      .update({
        status: nextStoreStatus,
        store_data: {
          ...currentStoreData,
          adminGovernance: nextStoreGovernance
        }
      } as never)
      .eq("id" as never, store.id as never);

    await recordStoreAuditLogSafe({
      action: storeAuditAction(restore ? "restored" : status ?? "under_review"),
      actorUserId: access.user.id,
      metadata: {
        governanceStatus: restore ? "restored" : status,
        nextStatus: nextStoreStatus,
        previousStatus: store.status ?? "unknown",
        sellerId,
        source: "super_admin_seller_management"
      },
      storeId: store.id,
      supabase: admin
    });

    revalidatePath(`/dashboard/stores/${store.id}`);

    if (store.slug) {
      revalidatePath(`/store/${store.slug}`);
    }
  }

  await admin.from("billing_events" as never).insert({
    event_type: restore ? "admin_seller_restored" : `admin_seller_${status}`,
    provider: "admin",
    user_id: sellerId,
    payload: {
      affectedStores: ownedStores.length,
      governanceStatus: restore ? "active" : status
    } as never,
    processed_at: new Date().toISOString()
  } as never);

  revalidatePath("/admin/sellers");
  revalidatePath("/admin/stores");
  revalidatePath("/admin/users");
}

async function setSellerRiskStatus({
  riskStatus,
  sellerId
}: {
  riskStatus: SellerRiskStatus;
  sellerId: string;
}) {
  const access = await getAdminAccess();

  if (!sellerId) {
    throw new Error("Missing seller ID.");
  }

  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for seller governance.");
  }

  const { data: subscription } = await admin
    .from("user_subscriptions" as never)
    .select("plan_id, status, limits_snapshot")
    .eq("user_id" as never, sellerId as never)
    .maybeSingle();
  const currentSubscription = subscription as {
    limits_snapshot: Record<string, unknown> | null;
    plan_id: string | null;
    status: string | null;
  } | null;
  const plan = getBillingPlan(currentSubscription?.plan_id ?? "free");
  const currentMetadata = isRecord(currentSubscription?.limits_snapshot)
    ? currentSubscription.limits_snapshot
    : {};
  const currentGovernance = isRecord(currentMetadata.adminGovernance)
    ? currentMetadata.adminGovernance
    : {};
  const now = new Date().toISOString();
  const nextGovernance = {
    ...currentGovernance,
    riskStatus,
    reviewedAt: riskStatus === "reviewed" || riskStatus === "clear" ? now : currentGovernance.reviewedAt ?? null,
    riskUpdatedAt: now,
    source: "super_admin_sellers_runtime"
  };

  await admin.from("user_subscriptions" as never).upsert(
    {
      limits_snapshot: {
        ...currentMetadata,
        adminGovernance: nextGovernance
      },
      plan_id: plan.id,
      status: currentSubscription?.status ?? "active",
      user_id: sellerId
    } as never,
    { onConflict: "user_id" }
  );

  const eventType =
    riskStatus === "high_risk"
      ? "admin_seller_marked_high_risk"
      : riskStatus === "reviewed"
        ? "admin_seller_marked_reviewed"
        : "admin_seller_risk_cleared";
  const payload = {
    actor_user_id: access.user.id,
    riskStatus,
    source: "super_admin_sellers_runtime"
  };

  await admin.from("monitoring_events" as never).insert({
    entity_id: sellerId,
    entity_type: "admin_seller",
    event_status: riskStatus === "high_risk" ? "warning" : "info",
    event_type: eventType,
    metadata: payload,
    store_id: null,
    user_id: access.user.id,
    workspace_id: null
  } as never);

  await admin.from("billing_events" as never).insert({
    event_type: eventType,
    provider: "admin",
    user_id: sellerId,
    payload: payload as never,
    processed_at: now
  } as never);

  revalidatePath("/admin/sellers");
  revalidatePath("/admin/users");
}

export async function markSellerUnderReview(formData: FormData) {
  await setSellerGovernanceStatus({
    sellerId: cleanSellerId(formData),
    status: "under_review"
  });
}

export async function suspendSeller(formData: FormData) {
  await setSellerGovernanceStatus({
    sellerId: cleanSellerId(formData),
    status: "suspended"
  });
}

export async function restoreSeller(formData: FormData) {
  await setSellerGovernanceStatus({
    restore: true,
    sellerId: cleanSellerId(formData)
  });
}

export async function markSellerReviewed(formData: FormData) {
  await setSellerRiskStatus({
    riskStatus: "reviewed",
    sellerId: cleanSellerId(formData)
  });
}

export async function markSellerHighRisk(formData: FormData) {
  await setSellerRiskStatus({
    riskStatus: "high_risk",
    sellerId: cleanSellerId(formData)
  });
}

export async function clearSellerRisk(formData: FormData) {
  await setSellerRiskStatus({
    riskStatus: "clear",
    sellerId: cleanSellerId(formData)
  });
}
