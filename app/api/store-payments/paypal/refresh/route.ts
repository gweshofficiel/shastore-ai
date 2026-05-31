import { NextRequest, NextResponse } from "next/server";
import { recordMonitoringEventSafe } from "@/lib/monitoring/events";
import { getPayPalMerchantIntegration, missingStorePayPalEnvNames } from "@/lib/store-payment-provider-runtime";
import { assertStoreAccessInWorkspace, requireProtectedApiAccess } from "@/lib/workspaces/data-access";

function redirectToDashboard(request: NextRequest, storeId: string, status: string) {
  return NextResponse.redirect(
    new URL(`/dashboard/payments?storeId=${encodeURIComponent(storeId)}&payments=${encodeURIComponent(status)}`, request.url)
  );
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const storeId = String(formData.get("storeId") ?? "").trim();

  if (!storeId) {
    return redirectToDashboard(request, "", "missing-store");
  }

  const { context, response } = await requireProtectedApiAccess({
    permission: "can_manage_payments"
  });

  if (response || !context) {
    return response;
  }

  const access = await assertStoreAccessInWorkspace({
    permission: "can_manage_payments",
    storeId,
    supabase: context.supabase,
    userId: context.user.id,
    workspaceId: context.workspaceId
  });

  if (!access.allowed) {
    return redirectToDashboard(request, storeId, "not-authorized");
  }

  const { data } = await context.supabase
    .from("store_payment_provider_connections" as never)
    .select("paypal_merchant_id")
    .eq("store_id", storeId)
    .eq("provider", "paypal")
    .maybeSingle();
  const current = data as { paypal_merchant_id?: string | null } | null;
  const merchantId = current?.paypal_merchant_id?.trim() ?? "";

  if (!merchantId) {
    await context.supabase
      .from("store_payment_provider_connections" as never)
      .update({
        connection_status: "pending",
        paypal_status: "pending",
        updated_at: new Date().toISOString()
      } as never)
      .eq("store_id" as never, storeId as never)
      .eq("provider" as never, "paypal" as never);

    return redirectToDashboard(request, storeId, "paypal-pending");
  }

  const missingEnv = missingStorePayPalEnvNames();

  if (missingEnv.length) {
    await recordMonitoringEventSafe({
      entityId: storeId,
      entityType: "store_payment_provider",
      eventStatus: "failed",
      eventType: "payment_provider_status_refreshed",
      metadata: {
        missing_env: missingEnv,
        provider: "paypal",
        status: "refresh_failed"
      },
      storeId,
      supabase: context.supabase,
      userId: context.user.id,
      workspaceId: context.workspaceId
    });
    return redirectToDashboard(request, storeId, "paypal-refresh-missing-env");
  }

  let integration: Awaited<ReturnType<typeof getPayPalMerchantIntegration>>;

  try {
    integration = await getPayPalMerchantIntegration(merchantId);
  } catch (error) {
    console.error("[store-payments][paypal] refresh failed", {
      merchantId,
      message: error instanceof Error ? error.message : String(error),
      storeId
    });
    await recordMonitoringEventSafe({
      entityId: storeId,
      entityType: "store_payment_provider",
      eventStatus: "failed",
      eventType: "payment_provider_status_refreshed",
      metadata: {
        error_message: error instanceof Error ? error.message : String(error),
        provider: "paypal",
        status: "refresh_failed"
      },
      storeId,
      supabase: context.supabase,
      userId: context.user.id,
      workspaceId: context.workspaceId
    });
    return redirectToDashboard(request, storeId, "paypal-refresh-failed");
  }

  const connected = integration.payments_receivable === true && integration.primary_email_confirmed === true;
  const status = connected ? "connected" : "restricted";

  await context.supabase
    .from("store_payment_provider_connections" as never)
    .update({
      connected_at: connected ? new Date().toISOString() : null,
      connection_status: status,
      metadata: {
        integration,
        payments_receivable: integration.payments_receivable ?? null,
        primary_email_confirmed: integration.primary_email_confirmed ?? null
      },
      paypal_status: status,
      updated_at: new Date().toISOString()
    } as never)
    .eq("store_id" as never, storeId as never)
    .eq("provider" as never, "paypal" as never);

  await recordMonitoringEventSafe({
    entityId: storeId,
    entityType: "store_payment_provider",
    eventType: "payment_provider_status_refreshed",
    metadata: {
      merchant_id: merchantId,
      payments_receivable: integration.payments_receivable ?? null,
      primary_email_confirmed: integration.primary_email_confirmed ?? null,
      provider: "paypal",
      status
    },
    storeId,
    supabase: context.supabase,
    userId: context.user.id,
    workspaceId: context.workspaceId
  });

  return redirectToDashboard(request, storeId, connected ? "paypal-connected" : "paypal-restricted");
}
