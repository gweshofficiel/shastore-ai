import { NextRequest, NextResponse } from "next/server";
import { recordMonitoringEventSafe } from "@/lib/monitoring/events";
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

  const now = new Date().toISOString();
  const { error } = await context.supabase
    .from("store_payment_provider_connections" as never)
    .upsert({
      connected_at: null,
      connection_status: "disconnected",
      disconnected_at: now,
      paypal_merchant_id: null,
      paypal_status: "disconnected",
      provider: "paypal",
      store_id: storeId,
      updated_at: now,
      workspace_id: context.workspaceId
    } as never, { onConflict: "store_id,provider" } as never);

  if (error) {
    console.error("[store-payments][paypal] disconnect failed", {
      code: error.code,
      message: error.message,
      storeId
    });
    return redirectToDashboard(request, storeId, "paypal-disconnect-failed");
  }

  await recordMonitoringEventSafe({
    entityId: storeId,
    entityType: "store_payment_provider",
    eventType: "paypal_disconnected",
    metadata: { provider: "paypal" },
    storeId,
    supabase: context.supabase,
    userId: context.user.id,
    workspaceId: context.workspaceId
  });

  return redirectToDashboard(request, storeId, "paypal-disconnected");
}
