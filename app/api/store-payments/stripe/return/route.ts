import { NextRequest, NextResponse } from "next/server";
import { recordMonitoringEventSafe } from "@/lib/monitoring/events";
import { getStorePaymentsStripe } from "@/lib/store-payment-provider-runtime";
import { assertStoreAccessInWorkspace, requireProtectedApiAccess } from "@/lib/workspaces/data-access";

function dashboardUrl(request: NextRequest, storeId: string, status: string) {
  return new URL(`/dashboard/payments?storeId=${encodeURIComponent(storeId)}&payments=${encodeURIComponent(status)}`, request.url);
}

function stripeConnectionStatus(account: { charges_enabled?: boolean; details_submitted?: boolean }) {
  if (account.charges_enabled) {
    return "connected";
  }

  if (account.details_submitted) {
    return "restricted";
  }

  return "pending";
}

export async function GET(request: NextRequest) {
  const storeId = request.nextUrl.searchParams.get("storeId")?.trim() ?? "";
  const accountId = request.nextUrl.searchParams.get("account")?.trim() ?? "";

  if (!storeId || !accountId) {
    return NextResponse.redirect(dashboardUrl(request, storeId, "stripe-return-invalid"));
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

  try {
    const stripe = getStorePaymentsStripe();
    const account = await stripe.accounts.retrieve(accountId);
    const status = stripeConnectionStatus(account);
    const now = new Date().toISOString();

    await context.supabase.from("store_payment_provider_connections" as never).upsert({
      charges_enabled: account.charges_enabled,
      connected_at: status === "connected" ? now : null,
      connection_status: status,
      disconnected_at: null,
      last_sync_at: now,
      onboarding_completed_at: account.details_submitted ? now : null,
      payouts_enabled: account.payouts_enabled,
      provider: "stripe",
      store_id: storeId,
      stripe_account_id: account.id,
      updated_at: now,
      workspace_id: context.workspaceId
    } as never, { onConflict: "store_id,provider" } as never);

    if (status === "connected") {
      await recordMonitoringEventSafe({
        entityId: storeId,
        entityType: "store_payment_provider",
        eventType: "stripe_connected",
        metadata: {
          charges_enabled: account.charges_enabled,
          payouts_enabled: account.payouts_enabled
        },
        storeId,
        supabase: context.supabase,
        userId: context.user.id,
        workspaceId: context.workspaceId
      });
    }

    return NextResponse.redirect(dashboardUrl(request, storeId, `stripe-${status}`));
  } catch (error) {
    console.error("[store-payments][stripe] return failed", {
      accountId,
      message: error instanceof Error ? error.message : String(error),
      storeId
    });
    return NextResponse.redirect(dashboardUrl(request, storeId, "stripe-refresh-failed"));
  }
}
