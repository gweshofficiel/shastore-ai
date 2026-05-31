import { NextRequest, NextResponse } from "next/server";
import { recordMonitoringEventSafe } from "@/lib/monitoring/events";
import {
  getStorePaymentsStripe,
  missingStorePaymentsStripeEnvNames
} from "@/lib/store-payment-provider-runtime";
import { assertStoreAccessInWorkspace, requireProtectedApiAccess } from "@/lib/workspaces/data-access";

function redirectToDashboard(request: NextRequest, storeId: string, status: string) {
  return NextResponse.redirect(
    new URL(`/dashboard/payments?storeId=${encodeURIComponent(storeId)}&payments=${encodeURIComponent(status)}`, request.url)
  );
}

function redirectToDashboardWithMissingEnv(
  request: NextRequest,
  storeId: string,
  status: string,
  missingEnv: string[]
) {
  const url = new URL(`/dashboard/payments?storeId=${encodeURIComponent(storeId)}&payments=${encodeURIComponent(status)}`, request.url);
  url.searchParams.set("missing", missingEnv.join(","));
  return NextResponse.redirect(url);
}

function stripeConnectionStatus(account: { charges_enabled?: boolean; payouts_enabled?: boolean; details_submitted?: boolean }) {
  if (account.charges_enabled) {
    return "connected";
  }

  if (account.details_submitted && !account.charges_enabled) {
    return "restricted";
  }

  return "pending";
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

  const missingEnv = missingStorePaymentsStripeEnvNames();
  const now = new Date().toISOString();

  await context.supabase.from("store_payment_provider_connections" as never).upsert({
    connection_mode: "connect",
    connection_status: "pending",
    provider: "stripe",
    store_id: storeId,
    updated_at: now,
    workspace_id: context.workspaceId
  } as never, { onConflict: "store_id,provider" } as never);

  if (missingEnv.length) {
    console.warn("[store-payments][stripe] connect missing env", {
      missingEnv,
      storeId
    });
    await recordMonitoringEventSafe({
      entityId: storeId,
      entityType: "store_payment_provider",
      eventStatus: "failed",
      eventType: "stripe_connect_failed",
      metadata: {
        error_message: "Missing Stripe Connect configuration.",
        missing_env: missingEnv
      },
      storeId,
      supabase: context.supabase,
      userId: context.user.id,
      workspaceId: context.workspaceId
    });
    return redirectToDashboardWithMissingEnv(request, storeId, "stripe-connect-missing-env", missingEnv);
  }

  try {
    const stripe = getStorePaymentsStripe();
    const account = await stripe.accounts.create({
      business_type: "individual",
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true }
      },
      metadata: {
        purpose: "store_customer_payments",
        store_id: storeId,
        workspace_id: context.workspaceId
      },
      type: "express"
    });
    await context.supabase.from("store_payment_provider_connections" as never).upsert({
      charges_enabled: account.charges_enabled,
      connection_status: stripeConnectionStatus(account),
      disconnected_at: null,
      onboarding_completed_at: account.details_submitted ? new Date().toISOString() : null,
      payouts_enabled: account.payouts_enabled,
      provider: "stripe",
      store_id: storeId,
      stripe_account_id: account.id,
      updated_at: now,
      workspace_id: context.workspaceId
    } as never, { onConflict: "store_id,provider" } as never);

    const origin = request.nextUrl.origin;
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${origin}/dashboard/payments?storeId=${encodeURIComponent(storeId)}&payments=stripe-refresh-required`,
      return_url: `${origin}/api/store-payments/stripe/return?storeId=${encodeURIComponent(storeId)}&account=${encodeURIComponent(account.id)}`,
      type: "account_onboarding"
    });

    return NextResponse.redirect(accountLink.url);
  } catch (error) {
    console.error("[store-payments][stripe] connect failed", {
      message: error instanceof Error ? error.message : String(error),
      storeId
    });
    await recordMonitoringEventSafe({
      entityId: storeId,
      entityType: "store_payment_provider",
      eventStatus: "failed",
      eventType: "stripe_connect_failed",
      metadata: {
        error_message: error instanceof Error ? error.message : String(error)
      },
      storeId,
      supabase: context.supabase,
      userId: context.user.id,
      workspaceId: context.workspaceId
    });
    return redirectToDashboard(request, storeId, "stripe-connect-failed");
  }
}
