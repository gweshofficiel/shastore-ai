"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordMonitoringEventSafe } from "@/lib/monitoring/events";
import {
  canEncryptPaymentSecrets,
  encryptServerSecret,
  paymentSecretsEncryptionEnvName
} from "@/lib/server-secret-encryption";
import {
  getStorePaymentMethods,
  storePaymentMethodOptions,
  type StorePaymentMethod
} from "@/lib/store-payment-methods";
import {
  assertStoreAccessInWorkspace,
  getWorkspaceDataContext
} from "@/lib/workspaces/data-access";

const paymentsPath = "/dashboard/payments";

type WorkspaceStoreRow = {
  id: string;
  slug?: string | null;
};

function cleanText(value: FormDataEntryValue | null, maxLength = 1000) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanOptionalText(value: FormDataEntryValue | null, maxLength = 1000) {
  const text = cleanText(value, maxLength);
  return text || null;
}

function paymentsRedirect(storeId: string, status: string): never {
  const params = new URLSearchParams({ payments: status, storeId });
  redirect(`${paymentsPath}?${params.toString()}`);
}

function paymentsRedirectWithMissingEnv(storeId: string, status: string, envName: string): never {
  const params = new URLSearchParams({ missing: envName, payments: status, storeId });
  redirect(`${paymentsPath}?${params.toString()}`);
}

async function requireWorkspaceStore(formData: FormData) {
  const storeId = cleanText(formData.get("storeId"), 80);

  if (!storeId) {
    redirect(`${paymentsPath}?payments=missing-store`);
  }

  const { supabase, user, workspaceId } = await getWorkspaceDataContext({
    permission: "can_manage_payments",
    redirectTo: paymentsPath
  });
  const access = await assertStoreAccessInWorkspace({
    permission: "can_manage_payments",
    storeId,
    supabase,
    userId: user.id,
    workspaceId
  });

  if (!access.allowed) {
    redirect(`${paymentsPath}?payments=not-authorized`);
  }

  return {
    store: access.store as WorkspaceStoreRow,
    storeId,
    supabase,
    userId: user.id,
    workspaceId
  };
}

function safeConfigForMethod(formData: FormData, method: StorePaymentMethod) {
  if (method === "paypal") {
    return {
      client_id: cleanOptionalText(formData.get("paypalClientId"), 300),
      merchant_email: cleanOptionalText(formData.get("paypalMerchantEmail"), 180)
    };
  }

  if (method === "youcan_pay") {
    return {
      public_key: cleanOptionalText(formData.get("youcanPublicKey"), 300),
      store_id: cleanOptionalText(formData.get("youcanStoreId"), 180)
    };
  }

  return {};
}

function revalidatePaymentPaths(store: WorkspaceStoreRow, storeId: string) {
  revalidatePath(paymentsPath);
  revalidatePath(`/dashboard/stores/${storeId}`);

  if (store.slug) {
    revalidatePath(`/store/${store.slug}`);
    revalidatePath(`/checkout/store/${store.slug}`);
    revalidatePath(`/s/${store.slug}`);
  }
}

function encryptedConfigWithSecrets(
  current: Record<string, unknown>,
  secrets: Record<string, string>
) {
  const next = { ...current };

  for (const [key, value] of Object.entries(secrets)) {
    if (value) {
      next[key] = encryptServerSecret(value);
    }
  }

  return next;
}

async function currentProviderEncryptedConfig({
  provider,
  storeId,
  supabase
}: {
  provider: string;
  storeId: string;
  supabase: Awaited<ReturnType<typeof getWorkspaceDataContext>>["supabase"];
}) {
  const { data } = await supabase
    .from("store_payment_provider_connections" as never)
    .select("encrypted_config")
    .eq("store_id", storeId)
    .eq("provider", provider)
    .maybeSingle();
  const row = data as { encrypted_config?: unknown } | null;

  return row?.encrypted_config && typeof row.encrypted_config === "object" && !Array.isArray(row.encrypted_config)
    ? (row.encrypted_config as Record<string, unknown>)
    : {};
}

export async function saveStorePaymentMethods(formData: FormData) {
  const { store, storeId, supabase, userId, workspaceId } = await requireWorkspaceStore(formData);
  const previousMethods = await getStorePaymentMethods(supabase, storeId);
  const previousEnabled = new Map(
    previousMethods.map((method) => [method.method, method.is_enabled])
  );
  const rows = storePaymentMethodOptions.map((option) => ({
    config: safeConfigForMethod(formData, option.method),
    display_name: cleanOptionalText(formData.get(`${option.method}DisplayName`), 120),
    instructions: cleanOptionalText(formData.get(`${option.method}Instructions`), 1000),
    is_enabled: formData.get(`${option.method}Enabled`) === "on",
    method: option.method,
    store_id: storeId,
    updated_at: new Date().toISOString(),
    workspace_id: workspaceId
  }));

  const { error } = await supabase
    .from("store_payment_methods" as never)
    .upsert(rows as never, { onConflict: "store_id,method" } as never);

  if (error) {
    console.error("[store-payments] save failed", {
      code: error.code,
      message: error.message,
      storeId
    });
    paymentsRedirect(storeId, "save-failed");
  }

  await Promise.all(
    rows
      .filter((row) => {
        const previous = previousEnabled.get(row.method);
        return previous === undefined ? row.is_enabled : previous !== row.is_enabled;
      })
      .map((row) =>
        recordMonitoringEventSafe({
          entityId: storeId,
          entityType: "store_payment_method",
          eventType: "payment_method_updated",
          metadata: {
            is_enabled: row.is_enabled,
            method: row.method
          },
          storeId,
          supabase,
          userId,
          workspaceId
        })
      )
  );

  revalidatePaymentPaths(store, storeId);
  paymentsRedirect(storeId, "saved");
}

export async function saveManualPaymentProviderConfigs(formData: FormData) {
  const { store, storeId, supabase, userId, workspaceId } = await requireWorkspaceStore(formData);
  const stripePublishableKey = cleanOptionalText(formData.get("stripeManualPublishableKey"), 300);
  const stripeSecretKey = cleanText(formData.get("stripeManualSecretKey"), 500);
  const stripeWebhookSecret = cleanText(formData.get("stripeManualWebhookSecret"), 500);
  const paypalClientId = cleanOptionalText(formData.get("paypalManualClientId"), 300);
  const paypalClientSecret = cleanText(formData.get("paypalManualClientSecret"), 500);
  const paypalMerchantId = cleanOptionalText(formData.get("paypalManualMerchantId"), 220);
  const paypalEnvironment =
    cleanText(formData.get("paypalEnvironment"), 20) === "live" ? "live" : "sandbox";
  const youcanPublicKey = cleanOptionalText(formData.get("youcanManualPublicKey"), 300);
  const youcanPrivateKey = cleanText(formData.get("youcanManualPrivateKey"), 500);
  const youcanAccountId = cleanOptionalText(formData.get("youcanManualAccountId"), 220);
  const youcanEnvironment =
    cleanText(formData.get("youcanEnvironment"), 20) === "live" ? "live" : "test";
  const hasNewSecrets = Boolean(stripeSecretKey || stripeWebhookSecret || paypalClientSecret || youcanPrivateKey);

  if (hasNewSecrets && !canEncryptPaymentSecrets()) {
    paymentsRedirectWithMissingEnv(
      storeId,
      "manual-config-missing-encryption",
      paymentSecretsEncryptionEnvName()
    );
  }

  const now = new Date().toISOString();
  const rows: Array<Record<string, unknown>> = [];

  if (stripePublishableKey || stripeSecretKey || stripeWebhookSecret) {
    const encrypted_config = encryptedConfigWithSecrets(
      await currentProviderEncryptedConfig({ provider: "stripe", storeId, supabase }),
      {
        secret_key: stripeSecretKey,
        webhook_secret: stripeWebhookSecret
      }
    );

    rows.push({
      charges_enabled: true,
      config_status: stripePublishableKey ? "configured" : "invalid",
      connected_at: stripePublishableKey ? now : null,
      connection_mode: "manual",
      connection_status: stripePublishableKey ? "connected" : "restricted",
      encrypted_config,
      provider: "stripe",
      publishable_key: stripePublishableKey,
      store_id: storeId,
      updated_at: now,
      workspace_id: workspaceId
    });
  }

  if (paypalClientId || paypalClientSecret || paypalMerchantId) {
    const encrypted_config = encryptedConfigWithSecrets(
      await currentProviderEncryptedConfig({ provider: "paypal", storeId, supabase }),
      {
        client_secret: paypalClientSecret
      }
    );

    rows.push({
      config_status: paypalClientId ? "configured" : "invalid",
      connected_at: paypalClientId ? now : null,
      connection_mode: "manual",
      connection_status: paypalClientId ? "connected" : "restricted",
      encrypted_config,
      environment: paypalEnvironment,
      paypal_merchant_id: paypalMerchantId,
      paypal_status: paypalClientId ? "configured" : "invalid",
      provider: "paypal",
      publishable_key: paypalClientId,
      store_id: storeId,
      updated_at: now,
      workspace_id: workspaceId
    });
  }

  if (youcanPublicKey || youcanPrivateKey || youcanAccountId) {
    const encrypted_config = encryptedConfigWithSecrets(
      await currentProviderEncryptedConfig({ provider: "youcan_pay", storeId, supabase }),
      {
        private_key: youcanPrivateKey
      }
    );

    rows.push({
      account_reference: youcanAccountId,
      config_status: youcanPublicKey ? "configured" : "invalid",
      connected_at: youcanPublicKey ? now : null,
      connection_mode: "manual",
      connection_status: youcanPublicKey ? "connected" : "restricted",
      encrypted_config,
      environment: youcanEnvironment,
      provider: "youcan_pay",
      public_key: youcanPublicKey,
      store_id: storeId,
      updated_at: now,
      workspace_id: workspaceId
    });
  }

  if (!rows.length) {
    paymentsRedirect(storeId, "manual-config-empty");
  }

  const { error } = await supabase
    .from("store_payment_provider_connections" as never)
    .upsert(rows as never, { onConflict: "store_id,provider" } as never);

  if (error) {
    console.error("[store-payments] manual provider config failed", {
      code: error.code,
      message: error.message,
      storeId
    });
    paymentsRedirect(storeId, "manual-config-failed");
  }

  await Promise.all(
    rows.map((row) =>
      recordMonitoringEventSafe({
        entityId: storeId,
        entityType: "store_payment_provider",
        eventType:
          row.provider === "stripe"
            ? "stripe_manual_configured"
            : row.provider === "paypal"
              ? "paypal_configured"
              : "youcan_configured",
        metadata: {
          config_status: row.config_status,
          environment: row.environment ?? null,
          provider: row.provider
        },
        storeId,
        supabase,
        userId,
        workspaceId
      })
    )
  );

  revalidatePaymentPaths(store, storeId);
  paymentsRedirect(storeId, "manual-config-saved");
}
