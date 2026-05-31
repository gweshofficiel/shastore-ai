import { NextRequest, NextResponse } from "next/server";
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
  const connected = Boolean(current?.paypal_merchant_id);

  await context.supabase
    .from("store_payment_provider_connections" as never)
    .update({
      connection_status: connected ? "connected" : "pending",
      paypal_status: connected ? "connected" : "pending",
      updated_at: new Date().toISOString()
    } as never)
    .eq("store_id" as never, storeId as never)
    .eq("provider" as never, "paypal" as never);

  return redirectToDashboard(request, storeId, connected ? "paypal-connected" : "paypal-pending");
}
