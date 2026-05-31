import { NextRequest, NextResponse } from "next/server";
import { paypalPartnerOnboardingUrl } from "@/lib/store-payment-provider-runtime";
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

  const onboardingUrl = paypalPartnerOnboardingUrl();

  if (!onboardingUrl) {
    return redirectToDashboard(request, storeId, "paypal-connect-config-missing");
  }

  const now = new Date().toISOString();
  await context.supabase.from("store_payment_provider_connections" as never).upsert({
    connection_status: "pending",
    disconnected_at: null,
    paypal_status: "pending",
    provider: "paypal",
    store_id: storeId,
    updated_at: now,
    workspace_id: context.workspaceId
  } as never, { onConflict: "store_id,provider" } as never);

  const redirectUrl = new URL(onboardingUrl);
  redirectUrl.searchParams.set("store_id", storeId);
  redirectUrl.searchParams.set(
    "return_url",
    `${request.nextUrl.origin}/api/store-payments/paypal/callback?storeId=${encodeURIComponent(storeId)}`
  );

  return NextResponse.redirect(redirectUrl);
}
