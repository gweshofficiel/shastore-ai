"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUserPrimaryWorkspaceId, hasPermission, type WorkspaceRole } from "@/lib/permissions/rbac";
import {
  isStoreCurrencyCode,
  normalizeStoreCurrencyCode,
  normalizeStoreCurrencySettings,
  supportedStoreCurrencies,
  type StoreCurrencyCode
} from "@/lib/store-currencies";
import { createClient } from "@/lib/supabase/server";

const currenciesPath = "/dashboard/currencies";

function currenciesWith(status: string, storeId?: string): never {
  const params = new URLSearchParams({ currencies: status });

  if (storeId) {
    params.set("storeId", storeId);
  }

  redirect(`${currenciesPath}?${params.toString()}`);
}

function cleanId(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

async function requireCurrencyStoreAccess(storeId: string) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    currenciesWith("not-authorized", storeId);
  }

  const workspaceId = await getUserPrimaryWorkspaceId(supabase, user.id);
  const { data: membership } = await supabase
    .from("workspace_members" as never)
    .select("role, status, permission_overrides")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();
  const member = membership as {
    permission_overrides?: Record<string, boolean> | null;
    role?: string | null;
    status?: string | null;
  } | null;

  if (member?.status && member.status !== "active") {
    currenciesWith("not-authorized", storeId);
  }

  if (!hasPermission((member?.role ?? null) as WorkspaceRole | null, "settings.edit", member?.permission_overrides ?? undefined)) {
    currenciesWith("not-authorized", storeId);
  }

  const { data: store } = await supabase
    .from("stores" as never)
    .select("id, slug, currency, currency_settings, workspace_id")
    .eq("id" as never, storeId as never)
    .eq("workspace_id" as never, workspaceId as never)
    .maybeSingle();
  const storeRow = store as {
    currency?: string | null;
    currency_settings?: unknown;
    id: string;
    slug?: string | null;
    workspace_id: string;
  } | null;

  if (!storeRow) {
    currenciesWith("not-authorized", storeId);
  }

  return { store: storeRow, supabase, workspaceId };
}

export async function saveStoreCurrencySettingsAction(formData: FormData) {
  const storeId = cleanId(formData.get("storeId"));

  if (!storeId) {
    currenciesWith("missing-store");
  }

  const { store, supabase, workspaceId } = await requireCurrencyStoreAccess(storeId);
  const defaultCurrency = normalizeStoreCurrencyCode(formData.get("defaultCurrency"), normalizeStoreCurrencyCode(store.currency));
  const enabledInputs = formData.getAll("enabledCurrencies")
    .map((value) => String(value).toUpperCase())
    .filter(isStoreCurrencyCode);
  const enabledCurrencies = Array.from(new Set([defaultCurrency, ...enabledInputs])) as StoreCurrencyCode[];
  const manualRates = supportedStoreCurrencies.reduce((rates, currency) => {
    const rawRate = Number(formData.get(`rate_${currency.code}`));
    rates[currency.code] = currency.code === defaultCurrency
      ? 1
      : Number.isFinite(rawRate) && rawRate > 0
        ? Number(rawRate.toFixed(8))
        : 1;
    return rates;
  }, {} as Record<StoreCurrencyCode, number>);
  const currencySettings = normalizeStoreCurrencySettings({
    defaultCurrency,
    enabledCurrencies,
    manualRates
  }, store.currency);
  const { error } = await supabase
    .from("stores" as never)
    .update({
      currency: currencySettings.defaultCurrency,
      currency_settings: currencySettings
    } as never)
    .eq("id" as never, store.id as never)
    .eq("workspace_id" as never, workspaceId as never);

  if (error) {
    currenciesWith("save-failed", storeId);
  }

  revalidatePath(currenciesPath);
  revalidatePath("/dashboard");
  if (store.slug) {
    revalidatePath(`/store/${store.slug}`);
  }
  currenciesWith("saved", storeId);
}
