"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordMonitoringEventSafe } from "@/lib/monitoring/events";
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
