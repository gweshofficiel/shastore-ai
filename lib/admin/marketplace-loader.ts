"use server";

import {
  createEmptyAdminMarketplaceControl,
  getAdminMarketplaceControl,
  type AdminMarketplaceControl
} from "@/lib/admin/data";

const MARKETPLACE_LOAD_TIMEOUT_MS = 15_000;

export type MarketplaceControlLoadResult = {
  control: AdminMarketplaceControl;
  ok: boolean;
  warning?: string;
};

function withMarketplaceLoadTimeout<T>(promise: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Marketplace data load timed out after 15 seconds."));
    }, MARKETPLACE_LOAD_TIMEOUT_MS);

    void promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

export async function loadMarketplaceControlSafe(): Promise<MarketplaceControlLoadResult> {
  try {
    const control = await withMarketplaceLoadTimeout(getAdminMarketplaceControl());
    return { control, ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[loadMarketplaceControlSafe] marketplace control load failed", error);
    return {
      control: createEmptyAdminMarketplaceControl(),
      ok: false,
      warning: message
    };
  }
}
