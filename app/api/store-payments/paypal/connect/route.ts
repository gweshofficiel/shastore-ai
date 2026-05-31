import { NextRequest, NextResponse } from "next/server";
import { recordMonitoringEventSafe } from "@/lib/monitoring/events";
import {
  createPayPalPartnerReferral,
  missingStorePayPalEnvNames,
  paypalPartnerOnboardingUrl
} from "@/lib/store-payment-provider-runtime";
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

  const legacyOnboardingUrl = paypalPartnerOnboardingUrl();
  const missingEnv = missingStorePayPalEnvNames();

  if (missingEnv.length && !legacyOnboardingUrl) {
    await recordMonitoringEventSafe({
      entityId: storeId,
      entityType: "store_payment_provider",
      eventStatus: "failed",
      eventType: "paypal_connect_failed",
      metadata: {
        error_message: "Missing PayPal partner API configuration.",
        missing_env: missingEnv
      },
      storeId,
      supabase: context.supabase,
      userId: context.user.id,
      workspaceId: context.workspaceId
    });
    return redirectToDashboard(request, storeId, "paypal-connect-missing-env");
  }

  const now = new Date().toISOString();
  const trackingId = `${storeId}:${Date.now()}`;
  await context.supabase.from("store_payment_provider_connections" as never).upsert({
    connection_mode: "connect",
    connection_status: "pending",
    disconnected_at: null,
    metadata: {
      tracking_id: trackingId
    },
    paypal_status: "pending",
    provider: "paypal",
    store_id: storeId,
    updated_at: now,
    workspace_id: context.workspaceId
  } as never, { onConflict: "store_id,provider" } as never);

  try {
    const returnUrl = `${request.nextUrl.origin}/api/store-payments/paypal/callback?storeId=${encodeURIComponent(storeId)}`;
    const onboardingUrl = legacyOnboardingUrl
      ? (() => {
          const redirectUrl = new URL(legacyOnboardingUrl);
          redirectUrl.searchParams.set("store_id", storeId);
          redirectUrl.searchParams.set("return_url", returnUrl);
          return redirectUrl.toString();
        })()
      : await createPayPalPartnerReferral({ returnUrl, trackingId });

    if (!onboardingUrl) {
      throw new Error("PayPal onboarding URL was not returned.");
    }

    return NextResponse.redirect(onboardingUrl);
  } catch (error) {
    console.error("[store-payments][paypal] connect failed", {
      message: error instanceof Error ? error.message : String(error),
      storeId
    });
    await recordMonitoringEventSafe({
      entityId: storeId,
      entityType: "store_payment_provider",
      eventStatus: "failed",
      eventType: "paypal_connect_failed",
      metadata: {
        error_message: error instanceof Error ? error.message : String(error)
      },
      storeId,
      supabase: context.supabase,
      userId: context.user.id,
      workspaceId: context.workspaceId
    });
    return redirectToDashboard(request, storeId, "paypal-connect-failed");
  }
}
