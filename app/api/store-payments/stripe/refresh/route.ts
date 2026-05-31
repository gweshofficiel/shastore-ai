import { NextRequest, NextResponse } from "next/server";
import { recordMonitoringEventSafe } from "@/lib/monitoring/events";
import { getStorePaymentsStripe } from "@/lib/store-payment-provider-runtime";
import { assertStoreAccessInWorkspace, requireProtectedApiAccess } from "@/lib/workspaces/data-access";

function redirectToDashboard(request: NextRequest, storeId: string, status: string) {
  return NextResponse.redirect(
    new URL(`/dashboard/payments?storeId=${encodeURIComponent(storeId)}&payments=${encodeURIComponent(status)}`, request.url)
  );
}

function stripeConnectionStatus(account: {
  charges_enabled?: boolean;
  payouts_enabled?: boolean;
  requirements?: {
    currently_due?: string[] | null;
  } | null;
}) {
  if (account.charges_enabled && account.payouts_enabled) {
    return "connected";
  }

  if ((account.requirements?.currently_due ?? []).length > 0) {
    return "restricted";
  }

  return "pending";
}

function stripeAccountMetadata(account: {
  capabilities?: unknown;
  details_submitted?: boolean;
  requirements?: {
    disabled_reason?: string | null;
  } | null;
}) {
  return {
    capabilities: account.capabilities ?? null,
    details_submitted: account.details_submitted ?? false,
    disabled_reason: account.requirements?.disabled_reason ?? null,
    requirements: account.requirements ?? null
  };
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
    .select("stripe_account_id, connection_status")
    .eq("store_id", storeId)
    .eq("provider", "stripe")
    .maybeSingle();
  const current = data as { connection_status?: string | null; stripe_account_id?: string | null } | null;

  if (!current?.stripe_account_id) {
    return redirectToDashboard(request, storeId, "stripe-not-connected");
  }

  try {
    const stripe = getStorePaymentsStripe();
    const account = await stripe.accounts.retrieve(current.stripe_account_id);
    const status = stripeConnectionStatus(account);
    const now = new Date().toISOString();

    await context.supabase
      .from("store_payment_provider_connections" as never)
      .update({
        charges_enabled: account.charges_enabled,
        connected_at: status === "connected" ? now : null,
        connection_status: status,
        metadata: stripeAccountMetadata(account),
        onboarding_completed_at: account.details_submitted ? now : null,
        payouts_enabled: account.payouts_enabled,
        updated_at: now
      } as never)
      .eq("store_id" as never, storeId as never)
      .eq("provider" as never, "stripe" as never);

    if (status === "connected" && current.connection_status !== "connected") {
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

    await recordMonitoringEventSafe({
      entityId: storeId,
      entityType: "store_payment_provider",
      eventType: "payment_provider_status_refreshed",
      metadata: {
        provider: "stripe",
          requirements_currently_due: account.requirements?.currently_due ?? [],
        status
      },
      storeId,
      supabase: context.supabase,
      userId: context.user.id,
      workspaceId: context.workspaceId
    });

    return redirectToDashboard(request, storeId, `stripe-${status}`);
  } catch (error) {
    console.error("[store-payments][stripe] refresh failed", {
      message: error instanceof Error ? error.message : String(error),
      storeId
    });
    return redirectToDashboard(request, storeId, "stripe-refresh-failed");
  }
}
