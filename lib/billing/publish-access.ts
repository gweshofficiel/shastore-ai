import type { SupabaseClient } from "@supabase/supabase-js";
import { recordStoreAuditLogSafe } from "@/lib/audit/store-audit";
import {
  canPublishStore,
  getUserSubscriptionAccessForClient
} from "@/lib/billing/access";
import { assertCanUseExistingCustomDomain } from "@/lib/billing/domain-access";
import {
  getStoreAccessForUser,
  type StoreAccessResult
} from "@/lib/billing/store-access";

type StoreLike = {
  created_at?: string | null;
  id: string;
  owner_user_id?: string | null;
  status?: string | null;
  user_id?: string | null;
};

type PublicationLike = {
  custom_domain?: string | null;
};

export type PublishAccessResult = {
  allowed: boolean;
  reason: string | null;
  state:
    | "allowed"
    | "domain_blocked"
    | "locked_by_plan"
    | "restricted"
    | "suspended"
    | "unauthorized";
  storeAccess?: StoreAccessResult;
};

function storeOwnerId(store: StoreLike) {
  return store.owner_user_id ?? store.user_id ?? null;
}

function logPublishAccess(result: PublishAccessResult, details: Record<string, unknown>) {
  console.info("[billing-publish] publish access checked", {
    allowed: result.allowed,
    reason: result.reason,
    state: result.state,
    ...details
  });
}

export async function canPublishStorefront(input: {
  publication?: PublicationLike | null;
  store: StoreLike;
  supabase: SupabaseClient;
  userId: string;
}): Promise<PublishAccessResult> {
  if (storeOwnerId(input.store) && storeOwnerId(input.store) !== input.userId) {
    const result: PublishAccessResult = {
      allowed: false,
      reason: "You can only publish stores you own.",
      state: "unauthorized"
    };
    logPublishAccess(result, { storeId: input.store.id, userId: input.userId });
    return result;
  }

  const [subscription, storeAccess] = await Promise.all([
    getUserSubscriptionAccessForClient(input.supabase, input.userId),
    getStoreAccessForUser(input.supabase, input.userId, input.store)
  ]);

  if (storeAccess.state === "locked_by_plan" || storeAccess.state === "suspended") {
    const result: PublishAccessResult = {
      allowed: false,
      reason:
        storeAccess.reason ?? "Store locked due to current subscription limits.",
      state: storeAccess.state,
      storeAccess
    };
    logPublishAccess(result, {
      planId: subscription.plan.id,
      storeId: input.store.id,
      userId: input.userId
    });
    if (storeAccess.state === "locked_by_plan") {
      await recordStoreAuditLogSafe({
        action: "store_locked_by_plan",
        actorUserId: input.userId,
        metadata: {
          source: "publish_guard",
          planId: subscription.plan.id
        },
        storeId: input.store.id,
        supabase: input.supabase
      });
    }
    return result;
  }

  if (!canPublishStore(subscription)) {
    const result: PublishAccessResult = {
      allowed: false,
      reason: "Publishing is restricted on your current subscription.",
      state: "restricted",
      storeAccess
    };
    logPublishAccess(result, {
      planId: subscription.plan.id,
      status: subscription.status,
      storeId: input.store.id,
      userId: input.userId
    });
    return result;
  }

  if (input.publication?.custom_domain) {
    try {
      await assertCanUseExistingCustomDomain(input.supabase, input.userId, input.store.id);
    } catch (error) {
      const result: PublishAccessResult = {
        allowed: false,
        reason:
          error instanceof Error
            ? error.message
            : "Connected custom domains are blocked by your current subscription.",
        state: "domain_blocked",
        storeAccess
      };
      logPublishAccess(result, {
        planId: subscription.plan.id,
        storeId: input.store.id,
        userId: input.userId
      });
      return result;
    }
  }

  const result: PublishAccessResult = {
    allowed: true,
    reason: null,
    state: "allowed",
    storeAccess
  };
  logPublishAccess(result, {
    planId: subscription.plan.id,
    storeId: input.store.id,
    userId: input.userId
  });
  return result;
}

export async function getPublicStorefrontAccess(input: {
  storeId: string;
  supabase: SupabaseClient;
}) {
  const { data: store } = await input.supabase
    .from("stores" as never)
    .select("id, created_at, owner_user_id, status, user_id")
    .eq("id", input.storeId)
    .maybeSingle();
  let storeRow = store as StoreLike | null;
  let ownerId = storeOwnerId(storeRow ?? { id: input.storeId });

  if (!storeRow || !ownerId) {
    const { data: storeInstance } = await input.supabase
      .from("store_instances" as never)
      .select("id, created_at, owner_user_id, status")
      .eq("id", input.storeId)
      .maybeSingle();
    storeRow = storeInstance as StoreLike | null;
    ownerId = storeOwnerId(storeRow ?? { id: input.storeId });
  }

  if (!storeRow || !ownerId) {
    console.warn("[storefront-access] storefront owner lookup failed", {
      storeId: input.storeId
    });
    return {
      allowed: false,
      reason: "This storefront is unavailable.",
      state: "restricted" as const
    };
  }

  const access = await getStoreAccessForUser(input.supabase, ownerId, storeRow);
  const allowed = access.state !== "locked_by_plan" && access.state !== "suspended";

  console.info("[storefront-access] storefront access checked", {
    allowed,
    planId: access.subscription.plan.id,
    state: access.state,
    storeId: input.storeId,
    userId: ownerId
  });

  if (!allowed) {
    console.warn("[storefront-lock] storefront locked by billing state", {
      planId: access.subscription.plan.id,
      state: access.state,
      storeId: input.storeId,
      userId: ownerId
    });
  }

  if (access.state === "locked_by_plan") {
    await recordStoreAuditLogSafe({
      action: "store_locked_by_plan",
      actorUserId: ownerId,
      metadata: {
        source: "public_storefront",
        planId: access.subscription.plan.id
      },
      storeId: input.storeId,
      supabase: input.supabase
    });
  }

  return {
    allowed,
    reason: allowed
      ? null
      : "This storefront is temporarily unavailable due to subscription limits.",
    state: access.state
  };
}
