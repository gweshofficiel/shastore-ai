"use server";

import { getAdminMarketplaceControl, type AdminMarketplaceControl } from "@/lib/admin/data";

export type MarketplaceControlLoadResult =
  | {
      control: AdminMarketplaceControl;
      ok: true;
    }
  | {
      error: string;
      ok: false;
    };

export async function loadMarketplaceControlSafe(): Promise<MarketplaceControlLoadResult> {
  try {
    const control = await getAdminMarketplaceControl();
    return { control, ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[loadMarketplaceControlSafe] marketplace control load failed", error);
    return { error: message, ok: false };
  }
}
