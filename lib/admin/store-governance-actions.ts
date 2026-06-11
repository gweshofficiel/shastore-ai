"use server";

import { revalidatePath } from "next/cache";
import { getAdminAccess } from "@/lib/admin-access";
import { recordStoreAuditLogSafe, type StoreAuditAction } from "@/lib/audit/store-audit";
import { createAdminClient } from "@/lib/supabase/admin";

type GovernanceStatus = "suspended" | "under_review";
type StoreRiskStatus = "clear" | "high_risk" | "reviewed";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function cleanStoreId(formData: FormData) {
  return String(formData.get("storeId") ?? "").trim();
}

async function setStoreGovernanceStatus({
  action,
  nextGovernanceStatus,
  restoreFromPublication,
  storeId
}: {
  action: StoreAuditAction;
  nextGovernanceStatus?: GovernanceStatus;
  restoreFromPublication?: boolean;
  storeId: string;
}) {
  const access = await getAdminAccess();

  if (!storeId) {
    throw new Error("Missing store ID.");
  }

  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for store governance.");
  }

  const { data: store } = await admin
    .from("stores" as never)
    .select("id, status, slug, store_data")
    .eq("id" as never, storeId as never)
    .maybeSingle();
  const currentStore = store as {
    id?: string;
    slug?: string | null;
    status?: string | null;
    store_data?: unknown;
  } | null;

  if (!currentStore?.id) {
    throw new Error("Store not found.");
  }

  const { data: publication } = await admin
    .from("published_stores" as never)
    .select("slug, status")
    .eq("store_id" as never, storeId as never)
    .maybeSingle();
  const publicationRow = publication as { slug?: string | null; status?: string | null } | null;
  const currentStoreData = isRecord(currentStore.store_data) ? currentStore.store_data : {};
  const currentGovernance = isRecord(currentStoreData.adminGovernance)
    ? currentStoreData.adminGovernance
    : {};
  const previousStatus =
    typeof currentGovernance.previousStatus === "string"
      ? currentGovernance.previousStatus
      : currentStore.status ?? "draft";
  const resolvedNextStoreStatus =
    restoreFromPublication
      ? previousStatus === "published" || publicationRow?.status === "published"
        ? "published"
        : "draft"
      : "draft";
  const nextGovernance = restoreFromPublication
    ? {
        ...currentGovernance,
        restoredAt: new Date().toISOString(),
        status: "restored"
      }
    : {
        previousStatus: currentStore.status ?? "draft",
        status: nextGovernanceStatus,
        updatedAt: new Date().toISOString()
      };

  if (!restoreFromPublication && !nextGovernanceStatus) {
    throw new Error("Missing governance status.");
  }

  await admin
    .from("stores" as never)
    .update({
      status: resolvedNextStoreStatus,
      store_data: {
        ...currentStoreData,
        adminGovernance: nextGovernance
      }
    } as never)
    .eq("id" as never, storeId as never);

  await recordStoreAuditLogSafe({
    action,
    actorUserId: access.user.id,
    metadata: {
      governanceStatus: restoreFromPublication ? "restored" : nextGovernanceStatus,
      nextStatus: resolvedNextStoreStatus,
      previousStatus: currentStore.status ?? "unknown",
      source: "super_admin_store_governance"
    },
    storeId,
    supabase: admin
  });

  revalidatePath("/admin/stores");
  revalidatePath(`/dashboard/stores/${storeId}`);

  const publicSlug = publicationRow?.slug ?? currentStore.slug;
  if (publicSlug) {
    revalidatePath(`/store/${publicSlug}`);
  }
}

async function setStoreRiskStatus({
  action,
  riskStatus,
  storeId
}: {
  action: StoreAuditAction;
  riskStatus: StoreRiskStatus;
  storeId: string;
}) {
  const access = await getAdminAccess();

  if (!storeId) {
    throw new Error("Missing store ID.");
  }

  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for store governance.");
  }

  const { data: store } = await admin
    .from("stores" as never)
    .select("id, store_data")
    .eq("id" as never, storeId as never)
    .maybeSingle();
  const currentStore = store as {
    id?: string;
    store_data?: unknown;
  } | null;

  if (!currentStore?.id) {
    throw new Error("Store not found.");
  }

  const now = new Date().toISOString();
  const currentStoreData = isRecord(currentStore.store_data) ? currentStore.store_data : {};
  const currentGovernance = isRecord(currentStoreData.adminGovernance)
    ? currentStoreData.adminGovernance
    : {};
  const nextGovernance = {
    ...currentGovernance,
    riskStatus,
    reviewedAt: riskStatus === "reviewed" || riskStatus === "clear" ? now : currentGovernance.reviewedAt ?? null,
    riskUpdatedAt: now
  };

  await admin
    .from("stores" as never)
    .update({
      store_data: {
        ...currentStoreData,
        adminGovernance: nextGovernance
      }
    } as never)
    .eq("id" as never, storeId as never);

  const metadata = {
    riskStatus,
    source: "super_admin_stores_runtime"
  };

  await recordStoreAuditLogSafe({
    action,
    actorUserId: access.user.id,
    metadata,
    storeId,
    supabase: admin
  });

  await admin.from("monitoring_events" as never).insert({
    entity_id: storeId,
    entity_type: "admin_store",
    event_status: riskStatus === "high_risk" ? "warning" : "info",
    event_type: action,
    metadata: {
      ...metadata,
      actor_user_id: access.user.id
    },
    store_id: storeId,
    user_id: access.user.id,
    workspace_id: null
  } as never);

  revalidatePath("/admin/stores");
}

export async function suspendAdminStore(formData: FormData) {
  await setStoreGovernanceStatus({
    action: "admin.store_suspended",
    nextGovernanceStatus: "suspended",
    storeId: cleanStoreId(formData)
  });
}

export async function restoreAdminStore(formData: FormData) {
  await setStoreGovernanceStatus({
    action: "admin.store_restored",
    restoreFromPublication: true,
    storeId: cleanStoreId(formData)
  });
}

export async function markAdminStoreUnderReview(formData: FormData) {
  await setStoreGovernanceStatus({
    action: "admin.store_marked_under_review",
    nextGovernanceStatus: "under_review",
    storeId: cleanStoreId(formData)
  });
}

export async function markAdminStoreReviewed(formData: FormData) {
  await setStoreRiskStatus({
    action: "admin.store_marked_reviewed",
    riskStatus: "reviewed",
    storeId: cleanStoreId(formData)
  });
}

export async function markAdminStoreHighRisk(formData: FormData) {
  await setStoreRiskStatus({
    action: "admin.store_marked_high_risk",
    riskStatus: "high_risk",
    storeId: cleanStoreId(formData)
  });
}

export async function clearAdminStoreRisk(formData: FormData) {
  await setStoreRiskStatus({
    action: "admin.store_high_risk_cleared",
    riskStatus: "clear",
    storeId: cleanStoreId(formData)
  });
}
