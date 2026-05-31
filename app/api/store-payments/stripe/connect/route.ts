import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
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

function redirectToStripeOnboarding(url: string) {
  return NextResponse.redirect(url, { status: 303 });
}

function stripeErrorMessage(error: unknown) {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }

  return error instanceof Error ? error.message : String(error);
}

function isStripeConnectPlatformNotEnabledError(error: unknown) {
  const message = stripeErrorMessage(error).toLowerCase();

  return message.includes("signed up for connect");
}

async function loadExistingStripeAccountId(supabase: SupabaseClient, storeId: string) {
  const { data } = await supabase
    .from("store_payment_provider_connections" as never)
    .select("stripe_account_id")
    .eq("store_id" as never, storeId as never)
    .eq("provider" as never, "stripe" as never)
    .maybeSingle();

  const row = data as { stripe_account_id?: string | null } | null;
  const accountId = row?.stripe_account_id?.trim() ?? "";

  return accountId || null;
}

async function persistStripeConnectPending(
  supabase: SupabaseClient,
  input: {
    account: Stripe.Account;
    now: string;
    storeId: string;
    workspaceId: string;
  }
) {
  await supabase.from("store_payment_provider_connections" as never).upsert({
    charges_enabled: input.account.charges_enabled ?? false,
    connection_mode: "connect",
    connection_status: "pending",
    disconnected_at: null,
    onboarding_completed_at: input.account.details_submitted ? input.now : null,
    payouts_enabled: input.account.payouts_enabled ?? false,
    provider: "stripe",
    store_id: input.storeId,
    stripe_account_id: input.account.id,
    updated_at: input.now,
    workspace_id: input.workspaceId
  } as never, { onConflict: "store_id,provider" } as never);
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

  let stripeAccountId: string | null = null;

  try {
    const stripe = getStorePaymentsStripe();
    const existingAccountId = await loadExistingStripeAccountId(context.supabase, storeId);
    let account: Stripe.Account;

    if (existingAccountId) {
      stripeAccountId = existingAccountId;
      try {
        account = await stripe.accounts.retrieve(existingAccountId);
      } catch (retrieveError) {
        console.warn("[store-payments][stripe] stored account missing in Stripe, creating new", {
          existingAccountId,
          message: stripeErrorMessage(retrieveError),
          storeId
        });
        account = await stripe.accounts.create({
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
        stripeAccountId = account.id;
      }
    } else {
      account = await stripe.accounts.create({
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
      stripeAccountId = account.id;
    }

    await persistStripeConnectPending(context.supabase, {
      account,
      now,
      storeId,
      workspaceId: context.workspaceId
    });

    const origin = request.nextUrl.origin;
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${origin}/dashboard/payments?storeId=${encodeURIComponent(storeId)}&payments=stripe-refresh-required`,
      return_url: `${origin}/api/store-payments/stripe/return?storeId=${encodeURIComponent(storeId)}&account=${encodeURIComponent(account.id)}`,
      type: "account_onboarding"
    });

    if (!accountLink.url) {
      throw new Error("Stripe account link URL was not returned.");
    }

    return redirectToStripeOnboarding(accountLink.url);
  } catch (error) {
    const errorMessage = stripeErrorMessage(error);
    const status = isStripeConnectPlatformNotEnabledError(error)
      ? "stripe-connect-platform-not-enabled"
      : "stripe-connect-failed";

    console.error("[store-payments][stripe] connect failed", {
      message: errorMessage,
      storeId
    });
    await recordMonitoringEventSafe({
      entityId: storeId,
      entityType: "store_payment_provider",
      eventStatus: "failed",
      eventType: "stripe_connect_failed",
      metadata: {
        error_message: errorMessage,
        stripe_account_id: stripeAccountId
      },
      storeId,
      supabase: context.supabase,
      userId: context.user.id,
      workspaceId: context.workspaceId
    });
    return redirectToDashboard(request, storeId, status);
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
