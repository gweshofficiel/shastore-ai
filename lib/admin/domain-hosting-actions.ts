"use server";

import { revalidatePath } from "next/cache";
import { getAdminAccess } from "@/lib/admin-access";
import {
  fetchHttpApiDomainStatus,
  safeHttpApiStatusResponse,
  type HttpApiDomainProviderStatus
} from "@/lib/domains/httpapi-status";
import {
  extractHttpApiErrorMessage,
  registerDomainOrder,
  type HttpApiRegistrationResult
} from "@/lib/domains/httpapi-registration";
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

export type DomainRegistrationRetryState = {
  attemptedAt: string | null;
  message: string | null;
  ok: boolean;
  providerOrderId: string | null;
  status: string | null;
};

const defaultSyncState: DomainStatusSyncState = {
  message: null,
  ok: false,
  providerStatus: null,
  syncedAt: null
};

const defaultRetryState: DomainRegistrationRetryState = {
  attemptedAt: null,
  message: null,
  ok: false,
  providerOrderId: null,
  status: null
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function cleanText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function readServerEnv(keys: string[]) {
  for (const key of keys) {
    const value = process.env[key]?.trim();

    if (value) {
      return value;
    }
  }

  return "";
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

function domainOrderStatusFromRegistrationResult(result: HttpApiRegistrationResult) {
  if (!result.success) {
    return "failed";
  }

  const raw = isRecord(result.rawResponse) ? result.rawResponse : {};
  const providerStatus = String(raw.actionstatus ?? raw.actionStatus ?? raw.actionstatusdesc ?? "").toLowerCase();

  return providerStatus.includes("success") || providerStatus.includes("complete") ? "active" : "pending";
}

function latestProviderStatusFromRawResponse(rawResponse: unknown): HttpApiDomainProviderStatus | null {
  if (!isRecord(rawResponse)) {
    return null;
  }

  const latest = String(rawResponse.latestProviderStatus ?? "").trim();

  if (["active", "failed", "locked_processing", "pending", "suspended", "unknown"].includes(latest)) {
    return latest as HttpApiDomainProviderStatus;
  }

  const statusSync = isRecord(rawResponse.statusSync) ? rawResponse.statusSync : {};
  const synced = String(statusSync.providerStatus ?? "").trim();

  return ["active", "failed", "locked_processing", "pending", "suspended", "unknown"].includes(synced)
    ? (synced as HttpApiDomainProviderStatus)
    : null;
}

function retryableStoredStatus(status: string, rawResponse: unknown) {
  return status === "failed" || latestProviderStatusFromRawResponse(rawResponse) === "locked_processing";
}

function providerStatusBlocksRetry(providerStatus: HttpApiDomainProviderStatus) {
  return providerStatus === "active" || providerStatus === "pending" || providerStatus === "locked_processing";
}

function registrationInputFromDomainOrder(order: Record<string, unknown>) {
  return {
    adminContactId: readServerEnv(["HTTPAPI_REGISTRATION_ADMIN_CONTACT_ID"]).slice(0, 80),
    billingContactId: readServerEnv(["HTTPAPI_REGISTRATION_BILLING_CONTACT_ID"]).slice(0, 80),
    customerId: readServerEnv([
      "HTTPAPI_REGISTRATION_CUSTOMER_ID",
      "HTTPAPI_REGISTRATION_CUSTOMER_CONTACT_ID"
    ]).slice(0, 80),
    domainName: String(order.domain_name ?? "").trim(),
    nameserver1: readServerEnv(["HTTPAPI_REGISTRATION_NAMESERVER_1", "HTTPAPI_NAMESERVER_1"]).slice(0, 253),
    nameserver2: readServerEnv(["HTTPAPI_REGISTRATION_NAMESERVER_2", "HTTPAPI_NAMESERVER_2"]).slice(0, 253),
    nameserver3: readServerEnv(["HTTPAPI_REGISTRATION_NAMESERVER_3", "HTTPAPI_NAMESERVER_3"]).slice(0, 253),
    nameserver4: readServerEnv(["HTTPAPI_REGISTRATION_NAMESERVER_4", "HTTPAPI_NAMESERVER_4"]).slice(0, 253),
    nameserver5: readServerEnv(["HTTPAPI_REGISTRATION_NAMESERVER_5", "HTTPAPI_NAMESERVER_5"]).slice(0, 253),
    registrantContactId: readServerEnv(["HTTPAPI_REGISTRATION_REGISTRANT_CONTACT_ID"]).slice(0, 80),
    techContactId: readServerEnv(["HTTPAPI_REGISTRATION_TECH_CONTACT_ID"]).slice(0, 80),
    years: Number.isInteger(Number(order.registration_years)) ? Number(order.registration_years) : 1
  };
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

export async function retryDomainRegistration(domainOrderId: string): Promise<DomainRegistrationRetryState> {
  const access = await getAdminAccess();
  requireSuperAdminAccess(access);

  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for domain registration retry.");
  }

  const id = domainOrderId.trim();

  if (!id) {
    return {
      ...defaultRetryState,
      message: "Missing domain order id."
    };
  }

  const { data, error } = await admin
    .from("domain_orders" as never)
    .select("id, store_id, domain_name, tld, provider, provider_order_id, provider_entity_id, registration_years, raw_response, status")
    .eq("id" as never, id as never)
    .maybeSingle();

  if (error) {
    console.error("domain_registration_retry_failed", {
      code: "domain_order_load_failed",
      domainOrderId: id,
      message: error.message,
      provider: "httpapi"
    });

    return {
      ...defaultRetryState,
      message: "Domain order could not be loaded."
    };
  }

  const order: Record<string, unknown> | null = isRecord(data)
    ? (data as Record<string, unknown>)
    : null;

  if (!order) {
    return {
      ...defaultRetryState,
      message: "Domain order was not found."
    };
  }

  const currentStatus = String(order.status ?? "").trim();
  const rawResponse = isRecord(order.raw_response) ? order.raw_response : {};
  const providerOrderId = String(order.provider_order_id ?? "").trim() || null;
  const providerEntityId = String(order.provider_entity_id ?? "").trim() || null;
  const storeId = String(order.store_id ?? "").trim();

  console.info("domain_registration_retry_started", {
    currentStatus,
    domainOrderId: id,
    hasProviderEntityId: Boolean(providerEntityId),
    hasProviderOrderId: Boolean(providerOrderId),
    provider: "httpapi"
  });

  if (currentStatus === "active") {
    console.warn("domain_registration_retry_blocked", {
      code: "domain_order_active",
      domainOrderId: id,
      provider: "httpapi"
    });

    return {
      ...defaultRetryState,
      message: "Active domains cannot be retried.",
      status: currentStatus
    };
  }

  if (!retryableStoredStatus(currentStatus, rawResponse)) {
    console.warn("domain_registration_retry_blocked", {
      code: "domain_order_not_retryable",
      currentStatus,
      domainOrderId: id,
      provider: "httpapi"
    });

    return {
      ...defaultRetryState,
      message: "Only failed or locked processing domain orders can be retried.",
      status: currentStatus
    };
  }

  if (providerOrderId) {
    const syncResult = await fetchHttpApiDomainStatus({
      domainName: String(order.domain_name ?? "").trim(),
      providerEntityId,
      providerOrderId
    });
    const syncedAt = new Date().toISOString();
    const syncedRawResponse = {
      ...rawResponse,
      latestProviderResponse: syncResult.providerResponse,
      latestProviderStatus: syncResult.providerStatus,
      latestProviderStatusText: syncResult.providerStatusText,
      providerStatusSyncedAt: syncedAt,
      statusSync: {
        endpoint: syncResult.endpoint,
        provider: "httpapi",
        providerStatus: syncResult.providerStatus,
        providerStatusText: syncResult.providerStatusText,
        status: syncResult.success ? "success" : "failed",
        syncedAt
      }
    };

    await admin
      .from("domain_orders" as never)
      .update({
        raw_response: syncedRawResponse,
        status: domainOrderStatusForProviderStatus({
          currentStatus,
          providerStatus: syncResult.providerStatus
        })
      } as never)
      .eq("id" as never, id as never);

    if (!syncResult.success || providerStatusBlocksRetry(syncResult.providerStatus)) {
      console.warn("domain_registration_retry_blocked", {
        code: !syncResult.success ? "provider_status_sync_failed" : "provider_status_blocks_retry",
        domainOrderId: id,
        provider: "httpapi",
        providerStatus: syncResult.providerStatus
      });

      return {
        attemptedAt: syncedAt,
        message: !syncResult.success
          ? "Provider status could not be verified, so retry was blocked."
          : "Provider status is active, pending, or processing. Retry was blocked.",
        ok: false,
        providerOrderId,
        status: syncResult.providerStatus
      };
    }
  }

  const attemptedAt = new Date().toISOString();
  const registrationResult = await registerDomainOrder(registrationInputFromDomainOrder(order));
  const nextStatus = domainOrderStatusFromRegistrationResult(registrationResult);
  const previousRetryHistory = Array.isArray(rawResponse.retryHistory)
    ? rawResponse.retryHistory
    : [];
  const nextRawResponse = {
    ...rawResponse,
    lastRegistrationRetry: {
      attemptedAt,
      previousProviderEntityId: providerEntityId,
      previousProviderOrderId: providerOrderId,
      provider: "httpapi",
      retrySource: "super_admin_domain_operations_center",
      status: registrationResult.success ? "success" : "failed"
    },
    providerStatusSyncedAt: rawResponse.providerStatusSyncedAt ?? null,
    registrationRetryResponse: safeHttpApiStatusResponse(registrationResult.rawResponse),
    retryHistory: [
      ...previousRetryHistory.slice(-9),
      {
        attemptedAt,
        previousProviderEntityId: providerEntityId,
        previousProviderOrderId: providerOrderId,
        providerOrderId: registrationResult.orderId,
        status: registrationResult.success ? "success" : "failed"
      }
    ]
  };

  const { error: updateError } = await admin
    .from("domain_orders" as never)
    .update({
      provider_entity_id: registrationResult.entityId ?? providerEntityId,
      provider_order_id: registrationResult.orderId ?? providerOrderId,
      raw_response: nextRawResponse,
      status: nextStatus
    } as never)
    .eq("id" as never, id as never);

  if (updateError) {
    console.error("domain_registration_retry_failed", {
      code: "domain_order_update_failed",
      domainOrderId: id,
      message: updateError.message,
      provider: "httpapi"
    });

    return {
      attemptedAt,
      message: "Retry completed but the domain order could not be updated.",
      ok: false,
      providerOrderId: registrationResult.orderId ?? providerOrderId,
      status: nextStatus
    };
  }

  await admin.from("monitoring_events" as never).insert({
    entity_id: id,
    entity_type: "domain_order",
    event_status: registrationResult.success ? "success" : "failed",
    event_type: "domain_registration_retry",
    metadata: {
      provider: "httpapi",
      provider_order_id: registrationResult.orderId,
      retry_source: "super_admin_domain_operations_center",
      status: nextStatus
    },
    store_id: storeId || null,
    user_id: access.user.id,
    workspace_id: null
  } as never);

  if (registrationResult.success) {
    console.info("domain_registration_retry_success", {
      dbStatus: nextStatus,
      domainOrderId: id,
      provider: "httpapi",
      providerOrderId: registrationResult.orderId
    });
  } else {
    console.error("domain_registration_retry_failed", {
      code: registrationResult.error?.code,
      domainOrderId: id,
      message:
        registrationResult.error?.message ??
        extractHttpApiErrorMessage(registrationResult.rawResponse),
      provider: "httpapi"
    });
  }

  revalidatePath("/admin/domains-hosting");
  revalidatePath("/dashboard/domains");

  return {
    attemptedAt,
    message: registrationResult.success
      ? "Registration retry submitted."
      : registrationResult.error?.message ?? "Registration retry failed.",
    ok: registrationResult.success,
    providerOrderId: registrationResult.orderId ?? providerOrderId,
    status: nextStatus
  };
}

export async function retryDomainRegistrationAction(
  _prevState: DomainRegistrationRetryState,
  formData: FormData
): Promise<DomainRegistrationRetryState> {
  return retryDomainRegistration(cleanText(formData.get("domainOrderId")));
}
