import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getUserSubscriptionAccessForClient,
  type UserSubscriptionAccess
} from "@/lib/billing/access";
import { getExpiryLockdownState } from "@/lib/billing/expiry-lockdown";
import { fetchStoresForAuthUser, type UserStoreRow } from "@/lib/stores/user-stores";

export type StoreAccessState = "active" | "draft" | "locked_by_plan" | "suspended";

export type StoreAccessResult = {
  reason: string | null;
  state: StoreAccessState;
  storeId: string;
};

type StoreLike = {
  created_at?: string | null;
  id: string;
  status?: string | null;
};

function sortedOldestFirst(stores: UserStoreRow[]) {
  return [...stores].sort(
    (left, right) =>
      new Date(left.created_at).getTime() - new Date(right.created_at).getTime()
  );
}

function activeStoreIds(stores: UserStoreRow[], subscription: UserSubscriptionAccess) {
  if (subscription.usage.storeLimit === null) {
    return new Set(stores.map((store) => store.id));
  }

  return new Set(
    sortedOldestFirst(stores)
      .slice(0, Math.max(subscription.usage.storeLimit, 0))
      .map((store) => store.id)
  );
}

export function isStoreLockedByPlan(
  store: StoreLike,
  subscription: UserSubscriptionAccess,
  stores: UserStoreRow[]
) {
  if (subscription.usage.storeLimit === null) {
    return false;
  }

  if (stores.length <= subscription.usage.storeLimit) {
    return false;
  }

  return !activeStoreIds(stores, subscription).has(store.id);
}

export function canAccessStore(
  store: StoreLike,
  subscription: UserSubscriptionAccess,
  stores: UserStoreRow[]
): StoreAccessResult {
  const expiry = getExpiryLockdownState(subscription);

  if (expiry.storefrontLocked || expiry.label === "restricted") {
    return {
      reason: expiry.reason ?? "This store is suspended until billing is resolved.",
      state: "suspended",
      storeId: store.id
    };
  }

  if (isStoreLockedByPlan(store, subscription, stores)) {
    return {
      reason:
        "Store locked due to current subscription limits. Existing data stays safe, but publishing and premium changes are frozen until you upgrade again.",
      state: "locked_by_plan",
      storeId: store.id
    };
  }

  return {
    reason: null,
    state: store.status === "draft" ? "draft" : "active",
    storeId: store.id
  };
}

export async function getStoreAccessForUser(
  supabase: SupabaseClient,
  userId: string,
  store: StoreLike
) {
  const [subscription, storesResult] = await Promise.all([
    getUserSubscriptionAccessForClient(supabase, userId),
    fetchStoresForAuthUser(supabase, userId)
  ]);
  const state = canAccessStore(store, subscription, storesResult.stores);

  console.info("[billing-access] store access resolved", {
    planId: subscription.plan.id,
    state: state.state,
    storeId: store.id,
    storeLimit: subscription.usage.storeLimit,
    storesUsed: storesResult.stores.length,
    userId
  });

  return {
    ...state,
    subscription
  };
}

export async function getStoreAccessMapForUser(supabase: SupabaseClient, userId: string) {
  const [subscription, storesResult] = await Promise.all([
    getUserSubscriptionAccessForClient(supabase, userId),
    fetchStoresForAuthUser(supabase, userId)
  ]);
  const accessMap = new Map<string, StoreAccessResult>();

  for (const store of storesResult.stores) {
    accessMap.set(store.id, canAccessStore(store, subscription, storesResult.stores));
  }

  console.info("[billing-lock] store lock map resolved", {
    lockedStores: Array.from(accessMap.values()).filter((state) => state.state === "locked_by_plan")
      .length,
    planId: subscription.plan.id,
    storeLimit: subscription.usage.storeLimit,
    storesUsed: storesResult.stores.length,
    userId
  });

  return {
    accessMap,
    subscription
  };
}

export async function assertStoreMutationAllowed(
  supabase: SupabaseClient,
  userId: string,
  store: StoreLike
) {
  const access = await getStoreAccessForUser(supabase, userId, store);

  if (access.state === "locked_by_plan" || access.state === "suspended") {
    console.warn("[billing-lock] store mutation blocked", {
      planId: access.subscription.plan.id,
      state: access.state,
      storeId: store.id,
      userId
    });
    throw new Error(access.reason ?? "Store locked due to current subscription limits.");
  }

  return access;
}
