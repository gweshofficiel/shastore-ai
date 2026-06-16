"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminAccess } from "@/lib/admin-access";
import { getBillingPlan } from "@/lib/billing/plans";
import { recordStoreAuditLogSafe, type StoreAuditAction } from "@/lib/audit/store-audit";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  publishResellerBranding,
  switchInheritanceMode,
  updateResellerBrandingDraft
} from "@/src/lib/platform-theme/reseller-branding";

type ResellerGovernanceStatus = "active" | "pending_review" | "suspended";
type ResellerVerificationStatus = "pending_verification" | "verified";
type ResellerRiskStatus = "clear" | "high_risk" | "reviewed";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function cleanResellerId(formData: FormData) {
  return String(formData.get("resellerId") ?? "").trim();
}

function storeAuditAction(status: ResellerGovernanceStatus): StoreAuditAction {
  if (status === "suspended") {
    return "admin.store_suspended";
  }

  if (status === "pending_review") {
    return "admin.store_marked_under_review";
  }

  return "admin.store_restored";
}

async function updateOwnedStoreGovernance({
  admin,
  actorUserId,
  governanceStatus,
  resellerId
}: {
  admin: NonNullable<ReturnType<typeof createAdminClient>>;
  actorUserId: string;
  governanceStatus: ResellerGovernanceStatus;
  resellerId: string;
}) {
  const { data: stores } = await admin
    .from("stores" as never)
    .select("id, status, slug, store_data")
    .or(`owner_user_id.eq.${resellerId},user_id.eq.${resellerId}`);
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
    const nextStoreStatus =
      governanceStatus === "active" ? (previousStatus === "published" ? "published" : "draft") : "draft";
    const nextGovernance =
      governanceStatus === "active"
        ? {
            ...currentGovernance,
            restoredAt: new Date().toISOString(),
            source: "super_admin_reseller_management",
            status: "restored"
          }
        : {
            previousStatus: store.status ?? "draft",
            source: "super_admin_reseller_management",
            status: governanceStatus === "pending_review" ? "under_review" : "suspended",
            updatedAt: new Date().toISOString()
          };

    await admin
      .from("stores" as never)
      .update({
        status: nextStoreStatus,
        store_data: {
          ...currentStoreData,
          adminGovernance: nextGovernance
        }
      } as never)
      .eq("id" as never, store.id as never);

    await recordStoreAuditLogSafe({
      action: storeAuditAction(governanceStatus),
      actorUserId,
      metadata: {
        governanceStatus,
        nextStatus: nextStoreStatus,
        previousStatus: store.status ?? "unknown",
        resellerId,
        source: "super_admin_reseller_management"
      },
      storeId: store.id,
      supabase: admin
    });

    revalidatePath(`/dashboard/stores/${store.id}`);

    if (store.slug) {
      revalidatePath(`/store/${store.slug}`);
    }
  }
}

async function setResellerGovernance({
  governanceStatus,
  resellerId,
  verificationStatus
}: {
  governanceStatus: ResellerGovernanceStatus;
  resellerId: string;
  verificationStatus: ResellerVerificationStatus;
}) {
  const access = await getAdminAccess();

  if (!resellerId) {
    throw new Error("Missing reseller ID.");
  }

  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for reseller governance.");
  }

  const { data } = await admin
    .from("user_subscriptions" as never)
    .select("plan_id, status, limits_snapshot")
    .eq("user_id" as never, resellerId as never)
    .maybeSingle();
  const existing = data as { limits_snapshot: Record<string, unknown> | null; plan_id: string | null; status: string | null } | null;
  const plan = getBillingPlan(existing?.plan_id ?? "free");
  const currentMetadata = isRecord(existing?.limits_snapshot) ? existing.limits_snapshot : {};
  const adminGovernance = {
    source: "super_admin_reseller_management",
    status: governanceStatus,
    updatedAt: new Date().toISOString(),
    verificationStatus
  };
  const nextSubscriptionStatus = governanceStatus === "suspended" ? "incomplete" : "active";

  await admin.from("user_subscriptions" as never).upsert(
    {
      limits_snapshot: {
        ...currentMetadata,
        adminGovernance
      },
      plan_id: plan.id,
      status: nextSubscriptionStatus,
      user_id: resellerId
    } as never,
    { onConflict: "user_id" }
  );

  if (governanceStatus !== "active" || existing?.status === "incomplete") {
    await updateOwnedStoreGovernance({
      admin,
      actorUserId: access.user.id,
      governanceStatus,
      resellerId
    });
  }

  await admin.from("billing_events" as never).insert({
    event_type: `admin_reseller_${governanceStatus}`,
    provider: "admin",
    user_id: resellerId,
    payload: {
      governanceStatus,
      verificationStatus
    } as never,
    processed_at: new Date().toISOString()
  } as never);

  revalidatePath("/admin/resellers");
  revalidatePath("/admin/sellers");
  revalidatePath("/admin/stores");
}

async function setResellerRiskStatus({
  resellerId,
  riskStatus
}: {
  resellerId: string;
  riskStatus: ResellerRiskStatus;
}) {
  const access = await getAdminAccess();

  if (!resellerId) {
    throw new Error("Missing reseller ID.");
  }

  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for reseller governance.");
  }

  const { data } = await admin
    .from("user_subscriptions" as never)
    .select("plan_id, status, limits_snapshot")
    .eq("user_id" as never, resellerId as never)
    .maybeSingle();
  const existing = data as { limits_snapshot: Record<string, unknown> | null; plan_id: string | null; status: string | null } | null;
  const plan = getBillingPlan(existing?.plan_id ?? "free");
  const currentMetadata = isRecord(existing?.limits_snapshot) ? existing.limits_snapshot : {};
  const currentGovernance = isRecord(currentMetadata.adminGovernance)
    ? currentMetadata.adminGovernance
    : {};
  const now = new Date().toISOString();
  const nextGovernance = {
    ...currentGovernance,
    riskStatus,
    reviewedAt: riskStatus === "reviewed" || riskStatus === "clear" ? now : currentGovernance.reviewedAt ?? null,
    riskUpdatedAt: now,
    source: "super_admin_resellers_runtime"
  };

  await admin.from("user_subscriptions" as never).upsert(
    {
      limits_snapshot: {
        ...currentMetadata,
        adminGovernance: nextGovernance
      },
      plan_id: plan.id,
      status: existing?.status ?? "active",
      user_id: resellerId
    } as never,
    { onConflict: "user_id" }
  );

  const eventType =
    riskStatus === "high_risk"
      ? "admin_reseller_marked_high_risk"
      : riskStatus === "reviewed"
        ? "admin_reseller_marked_reviewed"
        : "admin_reseller_risk_cleared";
  const payload = {
    actor_user_id: access.user.id,
    reseller_id: resellerId,
    riskStatus,
    source: "super_admin_resellers_runtime"
  };

  await admin.from("monitoring_events" as never).insert({
    entity_id: resellerId,
    entity_type: "admin_reseller",
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
    user_id: resellerId,
    payload: payload as never,
    processed_at: now
  } as never);

  revalidatePath("/admin/resellers");
  revalidatePath("/admin/users");
}

export async function markResellerVerified(formData: FormData) {
  await setResellerGovernance({
    governanceStatus: "active",
    resellerId: cleanResellerId(formData),
    verificationStatus: "verified"
  });
}

export async function markResellerPendingReview(formData: FormData) {
  await setResellerGovernance({
    governanceStatus: "pending_review",
    resellerId: cleanResellerId(formData),
    verificationStatus: "pending_verification"
  });
}

export async function suspendReseller(formData: FormData) {
  await setResellerGovernance({
    governanceStatus: "suspended",
    resellerId: cleanResellerId(formData),
    verificationStatus: "pending_verification"
  });
}

export async function restoreReseller(formData: FormData) {
  await setResellerGovernance({
    governanceStatus: "active",
    resellerId: cleanResellerId(formData),
    verificationStatus: "pending_verification"
  });
}

export async function markResellerReviewed(formData: FormData) {
  await setResellerRiskStatus({
    resellerId: cleanResellerId(formData),
    riskStatus: "reviewed"
  });
}

export async function markResellerHighRisk(formData: FormData) {
  await setResellerRiskStatus({
    resellerId: cleanResellerId(formData),
    riskStatus: "high_risk"
  });
}

export async function clearResellerRisk(formData: FormData) {
  await setResellerRiskStatus({
    resellerId: cleanResellerId(formData),
    riskStatus: "clear"
  });
}

function resellerBrandingRedirect(status: "error" | "success", message: string, resellerId: string): never {
  redirect(
    `/admin/resellers?brandingMessage=${encodeURIComponent(message)}&brandingResellerId=${encodeURIComponent(resellerId)}&brandingStatus=${status}#branding-${encodeURIComponent(resellerId)}`
  );
}

function readResellerBrandingDraftInput(formData: FormData) {
  return {
    brandName: formData.get("brandName"),
    documentationUrl: formData.get("documentationUrl"),
    legalName: formData.get("legalName"),
    poweredByLabel: formData.get("poweredByLabel"),
    showPoweredBy: formData.get("showPoweredBy") === "true",
    supportEmail: formData.get("supportEmail"),
    supportUrl: formData.get("supportUrl")
  };
}

async function recordResellerBrandingAction(
  action: string,
  resellerId: string,
  metadata: Record<string, unknown> = {}
) {
  const access = await getAdminAccess();
  const admin = createAdminClient();

  if (!admin) {
    return;
  }

  await admin.from("monitoring_events" as never).insert({
    entity_id: resellerId,
    entity_type: "admin_reseller_branding",
    event_status: "info",
    event_type: action,
    metadata: {
      ...metadata,
      note: "Reseller branding changes affect reseller context only. Platform branding and customer storefronts were not changed.",
      reseller_id: resellerId,
      source: "super_admin_reseller_branding"
    },
    store_id: null,
    user_id: access.user.id,
    workspace_id: null
  } as never);

  revalidatePath("/admin/resellers");
}

export async function switchResellerInheritancePlatformAction(formData: FormData) {
  const resellerId = cleanResellerId(formData);

  try {
    const record = await switchInheritanceMode(resellerId, "inherit_platform");
    await recordResellerBrandingAction("admin_reseller_branding_inherit_platform", resellerId, {
      inheritance_mode: record.inheritanceMode
    });
    resellerBrandingRedirect("success", "Reseller set to inherit platform branding.", resellerId);
  } catch (error) {
    await recordResellerBrandingAction("admin_reseller_branding_inherit_platform", resellerId, {
      error_message: error instanceof Error ? error.message : "Inheritance switch failed."
    });
    resellerBrandingRedirect("error", error instanceof Error ? error.message : "Inheritance switch failed.", resellerId);
  }
}

export async function switchResellerInheritanceCustomAction(formData: FormData) {
  const resellerId = cleanResellerId(formData);

  try {
    const record = await switchInheritanceMode(resellerId, "custom_branding");
    await recordResellerBrandingAction("admin_reseller_branding_custom_mode", resellerId, {
      inheritance_mode: record.inheritanceMode
    });
    resellerBrandingRedirect("success", "Reseller switched to custom branding mode. Save and publish draft to apply.", resellerId);
  } catch (error) {
    await recordResellerBrandingAction("admin_reseller_branding_custom_mode", resellerId, {
      error_message: error instanceof Error ? error.message : "Inheritance switch failed."
    });
    resellerBrandingRedirect("error", error instanceof Error ? error.message : "Inheritance switch failed.", resellerId);
  }
}

export async function saveResellerBrandingDraftAction(formData: FormData) {
  const resellerId = cleanResellerId(formData);

  try {
    const record = await updateResellerBrandingDraft(resellerId, readResellerBrandingDraftInput(formData));
    await recordResellerBrandingAction("admin_reseller_branding_save_draft", resellerId, {
      brand_name: record.customDraft.brandName,
      draft_only: true,
      inheritance_mode: record.inheritanceMode
    });
    resellerBrandingRedirect("success", "Reseller branding draft saved.", resellerId);
  } catch (error) {
    await recordResellerBrandingAction("admin_reseller_branding_save_draft", resellerId, {
      draft_only: true,
      error_message: error instanceof Error ? error.message : "Draft save failed."
    });
    resellerBrandingRedirect("error", error instanceof Error ? error.message : "Draft save failed.", resellerId);
  }
}

export async function publishResellerBrandingAction(formData: FormData) {
  const resellerId = cleanResellerId(formData);

  try {
    const record = await publishResellerBranding(resellerId);
    await recordResellerBrandingAction("admin_reseller_branding_publish", resellerId, {
      brand_name: record.customPublished.brandName,
      inheritance_mode: record.inheritanceMode
    });
    resellerBrandingRedirect("success", "Reseller custom branding published.", resellerId);
  } catch (error) {
    await recordResellerBrandingAction("admin_reseller_branding_publish", resellerId, {
      error_message: error instanceof Error ? error.message : "Publish failed."
    });
    resellerBrandingRedirect("error", error instanceof Error ? error.message : "Publish failed.", resellerId);
  }
}
