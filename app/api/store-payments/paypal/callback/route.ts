import { NextRequest, NextResponse } from "next/server";
import { recordMonitoringEventSafe } from "@/lib/monitoring/events";
import { getPayPalMerchantIntegration } from "@/lib/store-payment-provider-runtime";
import { assertStoreAccessInWorkspace, requireProtectedApiAccess } from "@/lib/workspaces/data-access";

function dashboardUrl(request: NextRequest, storeId: string, status: string) {
  return new URL(`/dashboard/payments?storeId=${encodeURIComponent(storeId)}&payments=${encodeURIComponent(status)}`, request.url);
}

export async function GET(request: NextRequest) {
  const storeId = request.nextUrl.searchParams.get("storeId")?.trim() ?? "";
  const merchantId =
    request.nextUrl.searchParams.get("merchantId")?.trim() ||
    request.nextUrl.searchParams.get("merchant_id")?.trim() ||
    request.nextUrl.searchParams.get("merchantIdInPayPal")?.trim() ||
    "";
  const permissionsGranted = request.nextUrl.searchParams.get("permissionsGranted")?.trim() ?? null;
  const consentStatus = request.nextUrl.searchParams.get("consentStatus")?.trim() ?? null;
  const accountStatus = request.nextUrl.searchParams.get("accountStatus")?.trim() ?? null;
  const riskStatus = request.nextUrl.searchParams.get("riskStatus")?.trim() ?? null;
  const productIntentId =
    request.nextUrl.searchParams.get("productIntentID")?.trim() ||
    request.nextUrl.searchParams.get("productIntentId")?.trim() ||
    null;

  if (!storeId) {
    return NextResponse.redirect(dashboardUrl(request, "", "missing-store"));
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
    return NextResponse.redirect(dashboardUrl(request, storeId, "not-authorized"));
  }

  if (!merchantId) {
    return NextResponse.redirect(dashboardUrl(request, storeId, "paypal-pending"));
  }

  const now = new Date().toISOString();
  let integration: Awaited<ReturnType<typeof getPayPalMerchantIntegration>> | null = null;

  try {
    integration = await getPayPalMerchantIntegration(merchantId);
  } catch (error) {
    console.warn("[store-payments][paypal] merchant integration lookup failed", {
      merchantId,
      message: error instanceof Error ? error.message : String(error),
      storeId
    });
  }

  const paymentsReceivable = integration?.payments_receivable ?? true;
  const emailConfirmed = integration?.primary_email_confirmed ?? true;
  const connected = paymentsReceivable && emailConfirmed;
  const status = connected ? "connected" : "restricted";
  await context.supabase.from("store_payment_provider_connections" as never).upsert({
    connected_at: connected ? now : null,
    connection_mode: "connect",
    connection_status: status,
    disconnected_at: null,
    metadata: {
      account_status: accountStatus,
      consent_status: consentStatus,
      integration,
      payments_receivable: paymentsReceivable,
      permissions_granted: permissionsGranted,
      primary_email_confirmed: emailConfirmed,
      product_intent_id: productIntentId,
      risk_status: riskStatus
    },
    paypal_merchant_id: merchantId,
    paypal_status: status,
    provider: "paypal",
    store_id: storeId,
    updated_at: now,
    workspace_id: context.workspaceId
  } as never, { onConflict: "store_id,provider" } as never);

  await recordMonitoringEventSafe({
    entityId: storeId,
    entityType: "store_payment_provider",
    eventStatus: connected ? "success" : "failed",
    eventType: connected ? "paypal_connected" : "paypal_restricted",
    metadata: {
      merchant_id: merchantId,
      payments_receivable: paymentsReceivable,
      primary_email_confirmed: emailConfirmed,
      provider: "paypal"
    },
    storeId,
    supabase: context.supabase,
    userId: context.user.id,
    workspaceId: context.workspaceId
  });

  return NextResponse.redirect(dashboardUrl(request, storeId, connected ? "paypal-connected" : "paypal-restricted"));
}
