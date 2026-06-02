import type { SupabaseClient } from "@supabase/supabase-js";

export type StoreGiftCardRow = {
  code: string;
  currency: string;
  expires_at?: string | null;
  id: string;
  initial_balance: number | string;
  remaining_balance: number | string;
  status: string;
  store_id: string;
  workspace_id: string;
};

export type GiftCardValidationResult =
  | {
      appliedAmount: number;
      giftCard: StoreGiftCardRow;
      maskedCode: string;
      ok: true;
    }
  | {
      error: string;
      ok: false;
    };

export function normalizeGiftCardCode(value: FormDataEntryValue | string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 80);
}

export function maskGiftCardCode(value: string | null | undefined) {
  const code = normalizeGiftCardCode(value);

  if (code.length <= 4) {
    return code ? "****" : "";
  }

  return `${"*".repeat(Math.max(4, code.length - 4))}${code.slice(-4)}`;
}

function money(value: number | string | null | undefined) {
  const amount = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(amount) ? Math.max(0, Number(amount.toFixed(2))) : 0;
}

export async function validateStoreGiftCard(
  supabase: SupabaseClient,
  input: {
    code: string;
    currency?: string | null;
    orderTotal: number;
    storeId: string;
    workspaceId?: string | null;
  }
): Promise<GiftCardValidationResult> {
  const code = normalizeGiftCardCode(input.code);
  const orderTotal = money(input.orderTotal);
  const currency = (input.currency ?? "").trim().toUpperCase();

  if (!code) {
    return { error: "Enter a gift card code.", ok: false };
  }

  if (!input.storeId || orderTotal <= 0) {
    return { error: "Gift card cannot be applied to this order.", ok: false };
  }

  const { data, error } = await supabase
    .from("store_gift_cards" as never)
    .select("id, workspace_id, store_id, code, initial_balance, remaining_balance, currency, status, expires_at")
    .eq("store_id" as never, input.storeId as never)
    .eq("code" as never, code as never)
    .maybeSingle();

  if (error) {
    console.warn("[store-gift-cards] validation failed", {
      code: error.code,
      message: error.message,
      storeId: input.storeId
    });
    return { error: "Gift card could not be validated.", ok: false };
  }

  const giftCard = data as StoreGiftCardRow | null;

  if (!giftCard || (input.workspaceId && giftCard.workspace_id !== input.workspaceId)) {
    return { error: "Gift card is not valid for this store.", ok: false };
  }

  if (giftCard.status !== "active") {
    return { error: "Gift card is not active.", ok: false };
  }

  if (giftCard.expires_at && new Date(giftCard.expires_at).getTime() < Date.now()) {
    return { error: "Gift card has expired.", ok: false };
  }

  if (currency && giftCard.currency.toUpperCase() !== currency) {
    return { error: "Gift card currency does not match this order.", ok: false };
  }

  const remainingBalance = money(giftCard.remaining_balance);

  if (remainingBalance <= 0) {
    return { error: "Gift card has no remaining balance.", ok: false };
  }

  return {
    appliedAmount: Math.min(orderTotal, remainingBalance),
    giftCard,
    maskedCode: maskGiftCardCode(giftCard.code),
    ok: true
  };
}

export async function redeemStoreGiftCard(
  supabase: SupabaseClient,
  input: {
    amount: number;
    giftCard: StoreGiftCardRow;
    orderId: string;
    orderSource: "orders" | "store_orders";
  }
) {
  const amount = money(input.amount);

  if (amount <= 0) {
    return true;
  }

  const { data, error } = await supabase.rpc("redeem_store_gift_card" as never, {
    amount_input: amount,
    gift_card_id_input: input.giftCard.id,
    order_id_input: input.orderId,
    order_source_input: input.orderSource
  } as never);

  if (error) {
    console.warn("[store-gift-cards] redemption failed", {
      code: error.code,
      giftCardId: input.giftCard.id,
      message: error.message,
      orderId: input.orderId
    });
    return false;
  }

  return data === true;
}
