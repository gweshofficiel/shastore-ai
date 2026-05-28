"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  assertStoreAccessInWorkspace,
  getWorkspaceDataContext
} from "@/lib/workspaces/data-access";

const taxPath = "/dashboard/tax";

type WorkspaceStoreRow = {
  id: string;
  slug?: string | null;
  workspace_id?: string | null;
};

function cleanText(value: FormDataEntryValue | null, maxLength = 1000) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function cleanOptionalText(value: FormDataEntryValue | null, maxLength = 1000) {
  const text = cleanText(value, maxLength);
  return text || null;
}

function formBoolean(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function cleanNumber(value: FormDataEntryValue | null) {
  const text = cleanText(value, 40);
  if (!text) {
    return 0;
  }

  const parsed = Number(text);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function cleanInteger(value: FormDataEntryValue | null) {
  return Math.round(cleanNumber(value));
}

function ruleStatus(value: FormDataEntryValue | null) {
  return cleanText(value, 20) === "inactive" ? "inactive" : "active";
}

function taxRedirect(storeId: string, status: string): never {
  const params = new URLSearchParams({ storeId, tax: status });
  redirect(`${taxPath}?${params.toString()}`);
}

async function requireWorkspaceStore(formData: FormData) {
  const storeId = cleanText(formData.get("storeId"), 80);

  if (!storeId) {
    redirect(`${taxPath}?tax=missing-store`);
  }

  const { supabase, user, workspaceId } = await getWorkspaceDataContext({
    permission: "can_manage_payments",
    redirectTo: taxPath
  });
  const access = await assertStoreAccessInWorkspace({
    permission: "can_manage_payments",
    storeId,
    supabase,
    userId: user.id,
    workspaceId
  });

  if (!access.allowed) {
    redirect(`${taxPath}?tax=not-authorized`);
  }

  return {
    store: access.store as WorkspaceStoreRow,
    storeId,
    supabase,
    workspaceId
  };
}

function revalidateTaxPaths(store: WorkspaceStoreRow, storeId: string) {
  revalidatePath(taxPath);
  revalidatePath("/dashboard/orders");
  revalidatePath(`/dashboard/stores/${storeId}`);
  if (store.slug) {
    revalidatePath(`/store/${store.slug}`);
    revalidatePath(`/store/${store.slug}/cart`);
  }
}

export async function saveStoreTaxSettings(formData: FormData) {
  const { store, storeId, supabase, workspaceId } = await requireWorkspaceStore(formData);
  const taxName = cleanText(formData.get("taxName"), 80) || "Tax";

  const { error } = await supabase.from("store_tax_settings" as never).upsert(
    {
      apply_tax_to_shipping: formBoolean(formData, "applyTaxToShipping"),
      default_tax_rate: cleanNumber(formData.get("defaultTaxRate")),
      prices_include_tax: formBoolean(formData, "pricesIncludeTax"),
      store_id: storeId,
      tax_enabled: formBoolean(formData, "taxEnabled"),
      tax_name: taxName,
      updated_at: new Date().toISOString(),
      workspace_id: workspaceId
    } as never,
    { onConflict: "store_id" }
  );

  if (error) {
    console.error("[store-tax] settings save failed", {
      code: error.code,
      message: error.message,
      storeId
    });
    taxRedirect(storeId, "settings-failed");
  }

  revalidateTaxPaths(store, storeId);
  taxRedirect(storeId, "settings-saved");
}

export async function createStoreTaxRule(formData: FormData) {
  const { store, storeId, supabase, workspaceId } = await requireWorkspaceStore(formData);
  const country = cleanText(formData.get("country"), 120);

  if (!country) {
    taxRedirect(storeId, "missing-country");
  }

  const { error } = await supabase.from("store_tax_rules" as never).insert({
    city: cleanOptionalText(formData.get("city"), 120),
    country,
    region: cleanOptionalText(formData.get("region"), 120),
    sort_order: cleanInteger(formData.get("sortOrder")),
    status: ruleStatus(formData.get("status")),
    store_id: storeId,
    tax_rate: cleanNumber(formData.get("taxRate")),
    workspace_id: workspaceId
  } as never);

  if (error) {
    console.error("[store-tax] rule create failed", {
      code: error.code,
      message: error.message,
      storeId
    });
    taxRedirect(storeId, "rule-create-failed");
  }

  revalidateTaxPaths(store, storeId);
  taxRedirect(storeId, "rule-created");
}

export async function updateStoreTaxRule(formData: FormData) {
  const { store, storeId, supabase, workspaceId } = await requireWorkspaceStore(formData);
  const ruleId = cleanText(formData.get("ruleId"), 80);
  const country = cleanText(formData.get("country"), 120);

  if (!ruleId || !country) {
    taxRedirect(storeId, "rule-update-failed");
  }

  const { error } = await supabase
    .from("store_tax_rules" as never)
    .update({
      city: cleanOptionalText(formData.get("city"), 120),
      country,
      region: cleanOptionalText(formData.get("region"), 120),
      sort_order: cleanInteger(formData.get("sortOrder")),
      status: ruleStatus(formData.get("status")),
      tax_rate: cleanNumber(formData.get("taxRate")),
      updated_at: new Date().toISOString()
    } as never)
    .eq("id", ruleId)
    .eq("store_id", storeId)
    .eq("workspace_id" as never, workspaceId as never);

  if (error) {
    console.error("[store-tax] rule update failed", {
      code: error.code,
      message: error.message,
      ruleId,
      storeId
    });
    taxRedirect(storeId, "rule-update-failed");
  }

  revalidateTaxPaths(store, storeId);
  taxRedirect(storeId, "rule-updated");
}
