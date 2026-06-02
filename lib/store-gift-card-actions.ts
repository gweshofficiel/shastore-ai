"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertStoreInWorkspace, getWorkspaceDataContext } from "@/lib/workspaces/data-access";
import { normalizeGiftCardCode } from "@/lib/store-gift-cards";

const giftCardsPath = "/dashboard/gift-cards";

function cleanText(value: FormDataEntryValue | null, maxLength = 240) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanMoney(value: FormDataEntryValue | null) {
  const text = cleanText(value, 40);
  const amount = Number(text || 0);
  return Number.isFinite(amount) ? Math.max(0, Number(amount.toFixed(2))) : 0;
}

function cleanDateTime(value: FormDataEntryValue | null) {
  const text = cleanText(value, 80);

  if (!text) {
    return null;
  }

  const date = new Date(text);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function cleanCurrency(value: FormDataEntryValue | null) {
  return (cleanText(value, 8) || "USD").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3) || "USD";
}

function normalizeStatus(value: FormDataEntryValue | null) {
  const status = cleanText(value, 40);
  return status === "used" || status === "expired" || status === "disabled" ? status : "active";
}

function giftCardsRedirect(status: string, storeId?: string | null): never {
  const params = new URLSearchParams({ giftCards: status });

  if (storeId) {
    params.set("storeId", storeId);
  }

  redirect(`${giftCardsPath}?${params.toString()}`);
}

export async function createStoreGiftCardAction(formData: FormData) {
  const { supabase, user, workspaceId } = await getWorkspaceDataContext({
    permission: "can_edit_stores",
    redirectTo: giftCardsPath
  });
  const storeId = cleanText(formData.get("storeId"), 120);
  const code = normalizeGiftCardCode(formData.get("code"));
  const initialBalance = cleanMoney(formData.get("initialBalance"));
  const remainingBalance = Math.min(initialBalance, cleanMoney(formData.get("remainingBalance")) || initialBalance);
  const currency = cleanCurrency(formData.get("currency"));
  const status = normalizeStatus(formData.get("status"));
  const expiresAt = cleanDateTime(formData.get("expiresAt"));

  if (!storeId || !(await assertStoreInWorkspace(supabase, storeId, workspaceId, user.id))) {
    giftCardsRedirect("access-denied", storeId);
  }

  if (!code || initialBalance <= 0) {
    giftCardsRedirect("invalid", storeId);
  }

  const { error } = await supabase.from("store_gift_cards" as never).insert({
    code,
    created_by: user.id,
    currency,
    expires_at: expiresAt,
    initial_balance: initialBalance,
    remaining_balance: remainingBalance,
    status,
    store_id: storeId,
    workspace_id: workspaceId
  } as never);

  if (error) {
    giftCardsRedirect(error.code === "23505" ? "duplicate" : "create-failed", storeId);
  }

  revalidatePath(giftCardsPath);
  giftCardsRedirect("created", storeId);
}

export async function updateStoreGiftCardStatusAction(formData: FormData) {
  const { supabase, user, workspaceId } = await getWorkspaceDataContext({
    permission: "can_edit_stores",
    redirectTo: giftCardsPath
  });
  const giftCardId = cleanText(formData.get("giftCardId"), 120);
  const storeId = cleanText(formData.get("storeId"), 120);
  const status = normalizeStatus(formData.get("status"));

  if (!giftCardId || !storeId || !(await assertStoreInWorkspace(supabase, storeId, workspaceId, user.id))) {
    giftCardsRedirect("access-denied", storeId);
  }

  const { error } = await supabase
    .from("store_gift_cards" as never)
    .update({ status } as never)
    .eq("id" as never, giftCardId as never)
    .eq("store_id" as never, storeId as never)
    .eq("workspace_id" as never, workspaceId as never);

  if (error) {
    giftCardsRedirect("update-failed", storeId);
  }

  revalidatePath(giftCardsPath);
  giftCardsRedirect("updated", storeId);
}
