import { NextRequest, NextResponse } from "next/server";
import { recordMonitoringEventSafe } from "@/lib/monitoring/events";
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
  await context.supabase.from("store_payment_provider_connections" as never).upsert({
    connected_at: now,
    connection_status: "connected",
    disconnected_at: null,
    paypal_merchant_id: merchantId,
    paypal_status: "connected",
    provider: "paypal",
    store_id: storeId,
    updated_at: now,
    workspace_id: context.workspaceId
  } as never, { onConflict: "store_id,provider" } as never);

  await recordMonitoringEventSafe({
    entityId: storeId,
    entityType: "store_payment_provider",
    eventType: "paypal_connected",
    metadata: { provider: "paypal" },
    storeId,
    supabase: context.supabase,
    userId: context.user.id,
    workspaceId: context.workspaceId
  });

  return NextResponse.redirect(dashboardUrl(request, storeId, "paypal-connected"));
}
