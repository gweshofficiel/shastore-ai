import type { SupabaseClient } from "@supabase/supabase-js";
import { recordStoreAuditLogSafe } from "@/lib/audit/store-audit";
import { getPublicStorefrontAccess } from "@/lib/billing/publish-access";
import { createAdminClient } from "@/lib/supabase/admin";

export async function assertOwnershipTransferAllowed({
  actorUserId,
  allowAdminOverride = false,
  storeId,
  supabase
}: {
  actorUserId: string | null;
  allowAdminOverride?: boolean;
  storeId: string;
  supabase: SupabaseClient;
}) {
  await recordStoreAuditLogSafe({
    action: "ownership_transfer_requested",
    actorUserId,
    metadata: {
      source: "activation_claim"
    },
    storeId,
    supabase
  });

  if (allowAdminOverride) {
    console.info("[ownership-guard] admin override allowed ownership transfer", {
      storeId
    });
    return;
  }

  const accessClient = createAdminClient() ?? supabase;
  const storefrontAccess = await getPublicStorefrontAccess({
    storeId,
    supabase: accessClient
  });

  if (!storefrontAccess.allowed) {
    await recordStoreAuditLogSafe({
      action: "ownership_transfer_blocked",
      actorUserId,
      metadata: {
        reason: storefrontAccess.state,
        source: "activation_claim"
      },
      storeId,
      supabase
    });
    console.warn("[ownership-guard] ownership transfer blocked", {
      reason: storefrontAccess.state,
      storeId
    });
    throw new Error("Ownership transfer is blocked while this store is restricted by subscription limits.");
  }
}

export async function recordOwnershipTransferCompleted({
  actorUserId,
  storeId,
  supabase
}: {
  actorUserId: string | null;
  storeId: string | null;
  supabase: SupabaseClient;
}) {
  await recordStoreAuditLogSafe({
    action: "ownership_transfer_completed",
    actorUserId,
    metadata: {
      source: "activation_claim"
    },
    storeId,
    supabase
  });
}
