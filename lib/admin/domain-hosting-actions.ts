"use server";

import { revalidatePath } from "next/cache";
import { getAdminAccess } from "@/lib/admin-access";
import {
  fetchHttpApiDomainStatus,
  type HttpApiDomainProviderStatus
} from "@/lib/domains/httpapi-status";
import { createAdminClient } from "@/lib/supabase/admin";

type DomainHostingAction =
  | "admin_domain_clear_review"
  | "admin_domain_mark_review"
  | "admin_domain_timeline_viewed"
  | "admin_email_clear_review"
  | "admin_email_mark_review";

export type DomainStatusSyncState = {
  message: string | null;
  ok: boolean;
  providerStatus: HttpApiDomainProviderStatus | null;
  syncedAt: string | null;
};

const defaultSyncState: DomainStatusSyncState = {
  message: null,
  ok: false,
  providerStatus: null,
  syncedAt: null
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function cleanText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function requireSuperAdminAccess(access: Awaited<ReturnType<typeof getAdminAccess>>) {
  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can sync provider domain status.");
  }
}

function domainOrderStatusForProviderStatus({
  currentStatus,
  providerStatus
}: {
  currentStatus: string;
  providerStatus: HttpApiDomainProviderStatus;
}) {
  if (providerStatus === "active") return "active";
  if (providerStatus === "failed" || providerStatus === "suspended") return "failed";
  if (providerStatus === "locked_processing" || providerStatus === "pending") return "pending";

  return ["draft", "submitted", "pending", "active", "failed"].includes(currentStatus)
    ? currentStatus
    : "pending";
}

async function recordDomainHostingAction(formData: FormData, action: DomainHostingAction) {
  const access = await getAdminAccess();
  const storeId = cleanText(formData.get("storeId"));
  const targetId = cleanText(formData.get("targetId"));
  const targetType = cleanText(formData.get("targetType")) || "domain";

  if (!storeId || !targetId) {
    throw new Error("Missing domain hosting target.");
  }

  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for domain hosting controls.");
  }

  const { data } = await admin
    .from("stores" as never)
    .select("store_data")
    .eq("id" as never, storeId as never)
    .maybeSingle();
  const storeRow: Record<string, unknown> = isRecord(data) ? data : {};
  const storeData = isRecord(storeRow.store_data) ? storeRow.store_data : {};
  const reviews = isRecord(storeData.adminDomainHostingReviews)
    ? storeData.adminDomainHostingReviews
    : {};
  const isClear = action === "admin_domain_clear_review" || action === "admin_email_clear_review";
  const reviewState = {
    action,
    clearedAt: isClear ? new Date().toISOString() : null,
    markedAt: isClear ? null : new Date().toISOString(),
    source: "super_admin_domain_hosting_control_center",
    status: isClear ? "clear" : "under_review",
    targetType
  };

  await admin
    .from("stores" as never)
    .update({
      store_data: {
        ...storeData,
        adminDomainHostingReviews: {
          ...reviews,
          [targetId]: reviewState
        }
      }
    } as never)
    .eq("id" as never, storeId as never);

  await admin.from("monitoring_events" as never).insert({
    entity_id: storeId,
    entity_type: "admin_domain_hosting_control",
    event_status: "info",
    event_type: action,
    metadata: {
      note: "Placeholder admin control only. No provider API was called.",
      source: "super_admin_domain_hosting_control_center",
      target_id: targetId,
      target_type: targetType
    },
    store_id: storeId,
    user_id: access.user.id,
    workspace_id: null
  } as never);

  revalidatePath("/admin/domains-hosting");
  revalidatePath("/admin/domains");
  revalidatePath("/dashboard/domains");
}

export async function markDomainUnderReview(formData: FormData) {
  await recordDomainHostingAction(formData, "admin_domain_mark_review");
}

export async function clearDomainReview(formData: FormData) {
  await recordDomainHostingAction(formData, "admin_domain_clear_review");
}

export async function markEmailUnderReview(formData: FormData) {
  await recordDomainHostingAction(formData, "admin_email_mark_review");
}

export async function clearEmailReview(formData: FormData) {
  await recordDomainHostingAction(formData, "admin_email_clear_review");
}

export async function viewInternalTimeline(formData: FormData) {
  await recordDomainHostingAction(formData, "admin_domain_timeline_viewed");
}

export async function syncDomainOrderStatus(domainOrderId: string): Promise<DomainStatusSyncState> {
  const access = await getAdminAccess();
  requireSuperAdminAccess(access);

  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for domain status sync.");
  }

  const id = domainOrderId.trim();

  if (!id) {
    return {
      ...defaultSyncState,
      message: "Missing domain order id."
    };
  }

  const { data, error } = await admin
    .from("domain_orders" as never)
    .select("id, store_id, domain_name, provider, provider_order_id, provider_entity_id, raw_response, status")
    .eq("id" as never, id as never)
    .maybeSingle();

  if (error) {
    console.error("domain_status_sync_failed", {
      code: "domain_order_load_failed",
      domainOrderId: id,
      message: error.message,
      provider: "httpapi"
    });

    return {
      ...defaultSyncState,
      message: "Domain order could not be loaded."
    };
  }

  const order: Record<string, unknown> | null = isRecord(data)
    ? (data as Record<string, unknown>)
    : null;

  if (!order) {
    return {
      ...defaultSyncState,
      message: "Domain order was not found."
    };
  }

  const domainName = String(order.domain_name ?? "").trim();
  const providerOrderId = String(order.provider_order_id ?? "").trim() || null;
  const providerEntityId = String(order.provider_entity_id ?? "").trim() || null;
  const currentStatus = String(order.status ?? "").trim();

  if (!providerOrderId && !providerEntityId) {
    return {
      ...defaultSyncState,
      message: "Sync requires a stored provider order id or provider entity id."
    };
  }

  console.info("domain_status_sync_started", {
    domainOrderId: id,
    hasProviderEntityId: Boolean(providerEntityId),
    hasProviderOrderId: Boolean(providerOrderId),
    provider: "httpapi"
  });

  const syncedAt = new Date().toISOString();

  try {
    const result = await fetchHttpApiDomainStatus({
      domainName,
      providerEntityId,
      providerOrderId
    });
    const nextStatus = domainOrderStatusForProviderStatus({
      currentStatus,
      providerStatus: result.providerStatus
    });
    const rawResponse = isRecord(order.raw_response) ? order.raw_response : {};
    const nextRawResponse = {
      ...rawResponse,
      latestProviderResponse: result.providerResponse,
      latestProviderStatus: result.providerStatus,
      latestProviderStatusText: result.providerStatusText,
      providerStatusSyncedAt: syncedAt,
      statusSync: {
        endpoint: result.endpoint,
        provider: "httpapi",
        providerStatus: result.providerStatus,
        providerStatusText: result.providerStatusText,
        status: result.success ? "success" : "failed",
        syncedAt
      }
    };

    const { error: updateError } = await admin
      .from("domain_orders" as never)
      .update({
        raw_response: nextRawResponse,
        status: nextStatus
      } as never)
      .eq("id" as never, id as never);

    if (updateError) {
      console.error("domain_status_sync_failed", {
        code: "domain_order_update_failed",
        domainOrderId: id,
        message: updateError.message,
        provider: "httpapi",
        providerStatus: result.providerStatus
      });

      return {
        message: "Provider status was fetched but the domain order could not be updated.",
        ok: false,
        providerStatus: result.providerStatus,
        syncedAt
      };
    }

    if (result.success) {
      console.info("domain_status_sync_success", {
        dbStatus: nextStatus,
        domainOrderId: id,
        endpoint: result.endpoint,
        provider: "httpapi",
        providerStatus: result.providerStatus
      });
    } else {
      console.error("domain_status_sync_failed", {
        code: result.error?.code ?? "httpapi_status_error",
        dbStatus: nextStatus,
        domainOrderId: id,
        endpoint: result.endpoint,
        message: result.error?.message,
        provider: "httpapi",
        providerStatus: result.providerStatus
      });
    }

    revalidatePath("/admin/domains-hosting");
    revalidatePath("/dashboard/domains");

    return {
      message: result.success ? "Provider status synced." : result.error?.message ?? "Provider status sync finished with a provider error.",
      ok: result.success,
      providerStatus: result.providerStatus,
      syncedAt
    };
  } catch (syncError) {
    const message = syncError instanceof Error ? syncError.message : "Provider status sync failed.";

    console.error("domain_status_sync_failed", {
      code: "domain_status_sync_exception",
      domainOrderId: id,
      message,
      provider: "httpapi"
    });

    return {
      ...defaultSyncState,
      message
    };
  }
}

export async function syncDomainOrderStatusAction(
  _prevState: DomainStatusSyncState,
  formData: FormData
): Promise<DomainStatusSyncState> {
  return syncDomainOrderStatus(cleanText(formData.get("domainOrderId")));
}
