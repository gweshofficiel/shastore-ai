import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recordMonitoringEventSafe } from "@/lib/monitoring/events";
import {
  createStripeOAuthState,
  getStripeConnectClientId,
  getStorePaymentsStripeKeyMode,
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

function redirectToStripeOnboarding(url: string) {
  return NextResponse.redirect(url, { status: 303 });
}

function logStripeConnectDebug(message: string, metadata: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  console.info("[store-payments][stripe][debug]", {
    message,
    stripe_key_mode: getStorePaymentsStripeKeyMode(),
    ...metadata
  });
}

function stripeOAuthRedirectUri(request: NextRequest) {
  return process.env.STRIPE_CONNECT_REDIRECT_URI?.trim() ||
    `${request.nextUrl.origin}/api/store-payments/stripe/oauth/callback`;
}

async function loadExistingStripeConnection(
  supabase: SupabaseClient,
  storeId: string
) {
  const { data } = await supabase
    .from("store_payment_provider_connections" as never)
    .select("connection_status, stripe_account_id")
    .eq("store_id" as never, storeId as never)
    .eq("provider" as never, "stripe" as never)
    .maybeSingle();

  const row = data as { connection_status?: string | null; stripe_account_id?: string | null } | null;

  return row;
}

async function connectStripeAccount(request: NextRequest, storeId: string) {
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

  const now = new Date().toISOString();

  try {
    const existingConnection = await loadExistingStripeConnection(context.supabase, storeId);

    if (
      existingConnection?.connection_status === "connected" &&
      existingConnection.stripe_account_id?.trim()
    ) {
      return redirectToDashboard(request, storeId, "stripe-connected");
    }

    await context.supabase.from("store_payment_provider_connections" as never).upsert({
      connection_mode: "connect",
      connection_status: "pending",
      last_sync_at: now,
      provider: "stripe",
      store_id: storeId,
      updated_at: now,
      workspace_id: context.workspaceId
    } as never, { onConflict: "store_id,provider" } as never);

    const clientId = getStripeConnectClientId();

    if (!clientId) {
      return redirectToDashboardWithMissingEnv(request, storeId, "stripe-connect-missing-env", ["STRIPE_CONNECT_CLIENT_ID"]);
    }

    const authorizationUrl = new URL("https://connect.stripe.com/oauth/authorize");
    authorizationUrl.searchParams.set("response_type", "code");
    authorizationUrl.searchParams.set("client_id", clientId);
    authorizationUrl.searchParams.set("scope", "read_write");
    authorizationUrl.searchParams.set("state", createStripeOAuthState({
      storeId,
      userId: context.user.id,
      workspaceId: context.workspaceId
    }));
    authorizationUrl.searchParams.set("redirect_uri", stripeOAuthRedirectUri(request));

    logStripeConnectDebug("redirecting to Stripe OAuth authorization", {
      redirect_uri: stripeOAuthRedirectUri(request),
      storeId
    });

    return redirectToStripeOnboarding(authorizationUrl.toString());
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
        error_message: error instanceof Error ? error.message : String(error),
        flow: "oauth_authorize"
      },
      storeId,
      supabase: context.supabase,
      userId: context.user.id,
      workspaceId: context.workspaceId
    });
    return redirectToDashboard(request, storeId, "stripe-connect-failed");
  }
}

export async function GET(request: NextRequest) {
  const storeId = request.nextUrl.searchParams.get("storeId")?.trim() ?? "";

  return connectStripeAccount(request, storeId);
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const storeId = String(formData.get("storeId") ?? "").trim();

  return connectStripeAccount(request, storeId);
}
