import { NextRequest, NextResponse } from "next/server";
import { recordMonitoringEventSafe } from "@/lib/monitoring/events";
import {
  getStorePaymentsStripe,
  verifyStripeOAuthState
} from "@/lib/store-payment-provider-runtime";
import { assertStoreAccessInWorkspace, requireProtectedApiAccess } from "@/lib/workspaces/data-access";

function dashboardUrl(request: NextRequest, storeId: string, status: string) {
  return new URL(`/dashboard/payments?storeId=${encodeURIComponent(storeId)}&payments=${encodeURIComponent(status)}`, request.url);
}

function safeStripeAccountPrefix(accountId: string | null | undefined) {
  return accountId ? accountId.slice(0, Math.min(accountId.length, 12)) : null;
}

function stripeErrorMessage(error: unknown) {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }

  return error instanceof Error ? error.message : String(error);
}

function stripeConnectionStatus(account: {
  charges_enabled?: boolean;
  details_submitted?: boolean;
  payouts_enabled?: boolean;
  requirements?: {
    currently_due?: string[] | null;
  } | null;
}) {
  if (account.charges_enabled && account.payouts_enabled) {
    return "connected";
  }

  if (account.details_submitted || (account.requirements?.currently_due ?? []).length > 0) {
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

export async function GET(request: NextRequest) {
  const error = request.nextUrl.searchParams.get("error");
  const errorDescription = request.nextUrl.searchParams.get("error_description");
  const code = request.nextUrl.searchParams.get("code")?.trim() ?? "";
  const state = verifyStripeOAuthState(request.nextUrl.searchParams.get("state"));
  const storeId = state?.storeId ?? "";

  if (!state) {
    console.error("[store-payments][stripe] oauth callback invalid state");
    return NextResponse.redirect(dashboardUrl(request, "", "stripe-oauth-invalid-state"));
  }

  if (error) {
    console.warn("[store-payments][stripe] oauth denied", {
      error,
      errorDescription,
      storeId
    });
    return NextResponse.redirect(dashboardUrl(request, storeId, "stripe-oauth-denied"));
  }

  if (!code) {
    console.error("[store-payments][stripe] oauth callback missing code", {
      storeId
    });
    return NextResponse.redirect(dashboardUrl(request, storeId, "stripe-oauth-missing-code"));
  }

  const { context, response } = await requireProtectedApiAccess({
    permission: "can_manage_payments"
  });

  if (response || !context) {
    return response;
  }

  if (context.user.id !== state.userId || context.workspaceId !== state.workspaceId) {
    console.error("[store-payments][stripe] oauth callback state context mismatch", {
      storeId
    });
    return NextResponse.redirect(dashboardUrl(request, storeId, "stripe-oauth-invalid-state"));
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

  let stripeAccountId: string | null = null;

  try {
    const stripe = getStorePaymentsStripe();
    const token = await stripe.oauth.token({
      code,
      grant_type: "authorization_code"
    });
    stripeAccountId = token.stripe_user_id ?? null;

    if (!stripeAccountId) {
      throw new Error("Stripe OAuth token response did not include stripe_user_id.");
    }

    const account = await stripe.accounts.retrieve(stripeAccountId);
    const status = stripeConnectionStatus(account);
    const now = new Date().toISOString();

    await context.supabase.from("store_payment_provider_connections" as never).upsert({
      charges_enabled: account.charges_enabled ?? false,
      connected_at: now,
      connection_mode: "connect",
      connection_status: status,
      disconnected_at: null,
      last_sync_at: now,
      metadata: stripeAccountMetadata(account),
      onboarding_completed_at: account.details_submitted ? now : null,
      payouts_enabled: account.payouts_enabled ?? false,
      provider: "stripe",
      store_id: storeId,
      stripe_account_id: stripeAccountId,
      updated_at: now,
      workspace_id: context.workspaceId
    } as never, { onConflict: "store_id,provider" } as never);

    await recordMonitoringEventSafe({
      entityId: storeId,
      entityType: "store_payment_provider",
      eventType: status === "connected" ? "stripe_connected" : "stripe_oauth_connected",
      metadata: {
        charges_enabled: account.charges_enabled ?? false,
        flow: "oauth",
        payouts_enabled: account.payouts_enabled ?? false,
        status,
        stripe_account_prefix: safeStripeAccountPrefix(stripeAccountId)
      },
      storeId,
      supabase: context.supabase,
      userId: context.user.id,
      workspaceId: context.workspaceId
    });

    return NextResponse.redirect(dashboardUrl(request, storeId, `stripe-${status}`));
  } catch (callbackError) {
    const message = stripeErrorMessage(callbackError);

    console.error("[store-payments][stripe] oauth callback failed", {
      message,
      storeId,
      stripeAccountPrefix: safeStripeAccountPrefix(stripeAccountId)
    });
    await recordMonitoringEventSafe({
      entityId: storeId,
      entityType: "store_payment_provider",
      eventStatus: "failed",
      eventType: "stripe_oauth_callback_failed",
      metadata: {
        error_message: message,
        flow: "oauth_callback",
        stripe_account_prefix: safeStripeAccountPrefix(stripeAccountId)
      },
      storeId,
      supabase: context.supabase,
      userId: context.user.id,
      workspaceId: context.workspaceId
    });

    return NextResponse.redirect(dashboardUrl(request, storeId, "stripe-oauth-callback-failed"));
  }
}
