import { createClient } from "@/lib/supabase/server";
import type {
  ProvisionedStore,
  StoreDeliveryTransfer,
  StorePurchaseOrder,
  StorePurchaseRequest,
  StoreTransferRecord
} from "@/lib/store-purchase/types";

export type ResellerStorePurchaseData = {
  orders: StorePurchaseOrder[];
  profile: { id: string; slug: string } | null;
  ready: boolean;
};

function isMissingStorePurchaseTable(error: { code?: string; message?: string } | null) {
  const message = (error?.message ?? "").toLowerCase();
  return (
    error?.code === "PGRST205" ||
    error?.code === "PGRST204" ||
    message.includes("store_purchase_requests") ||
    message.includes("store_transfer_records") ||
    message.includes("store_transfers") ||
    message.includes("provisioned_stores") ||
    message.includes("could not find the table")
  );
}

export async function getResellerStorePurchaseData(): Promise<ResellerStorePurchaseData> {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { orders: [], profile: null, ready: true };
  }

  const { data: profileData } = await supabase
    .from("reseller_profiles" as never)
    .select("id, slug")
    .eq("user_id", user.id)
    .maybeSingle();

  const profile = profileData as { id: string; slug: string } | null;

  if (!profile) {
    return { orders: [], profile: null, ready: true };
  }

  const { data: requestsData, error: requestsError } = await supabase
    .from("store_purchase_requests" as never)
    .select("*")
    .eq("reseller_id", profile.id)
    .order("created_at", { ascending: false });

  if (requestsError) {
    return {
      orders: [],
      profile,
      ready: !isMissingStorePurchaseTable(requestsError)
    };
  }

  const requests = (requestsData ?? []) as StorePurchaseRequest[];
  const requestIds = requests.map((request) => request.id);
  const itemIds = Array.from(new Set(requests.map((request) => request.showcase_item_id)));

  const [transfersResult, deliveryTransfersResult, itemsResult, provisionedStoresResult] =
    await Promise.all([
    requestIds.length
      ? supabase
          .from("store_transfer_records" as never)
          .select("*")
          .in("request_id", requestIds)
      : Promise.resolve({ data: [], error: null }),
    requestIds.length
      ? supabase
          .from("store_transfers" as never)
          .select("*")
          .in("purchase_request_id", requestIds)
      : Promise.resolve({ data: [], error: null }),
    itemIds.length
      ? supabase
          .from("reseller_showcase_items" as never)
          .select("id, title, price_label")
          .in("id", itemIds)
      : Promise.resolve({ data: [], error: null }),
    requestIds.length
      ? supabase
          .from("provisioned_stores" as never)
          .select("*")
          .in("purchase_request_id", requestIds)
      : Promise.resolve({ data: [], error: null })
  ]);

  const transferByRequest = new Map(
    ((transfersResult.data ?? []) as StoreTransferRecord[]).map((transfer) => [
      transfer.request_id,
      transfer
    ])
  );
  const provisionedStoreByRequest = new Map(
    ((provisionedStoresResult.data ?? []) as ProvisionedStore[]).map((store) => [
      store.purchase_request_id,
      store
    ])
  );
  const deliveryTransferByRequest = new Map(
    ((deliveryTransfersResult.data ?? []) as StoreDeliveryTransfer[]).map((transfer) => [
      transfer.purchase_request_id,
      transfer
    ])
  );
  const itemById = new Map(
    ((itemsResult.data ?? []) as Array<{ id: string; title: string | null; price_label: string | null }>).map(
      (item) => [item.id, item]
    )
  );

  return {
    orders: requests.map((request) => {
      const item = itemById.get(request.showcase_item_id);

      return {
        ...request,
        delivery_transfer: deliveryTransferByRequest.get(request.id) ?? null,
        provisioned_store: provisionedStoreByRequest.get(request.id) ?? null,
        showcase_price_label: item?.price_label ?? null,
        showcase_title: item?.title ?? null,
        transfer_record: transferByRequest.get(request.id) ?? null
      };
    }),
    profile,
    ready:
      (!transfersResult.error || !isMissingStorePurchaseTable(transfersResult.error)) &&
      (!deliveryTransfersResult.error ||
        !isMissingStorePurchaseTable(deliveryTransfersResult.error)) &&
      (!provisionedStoresResult.error || !isMissingStorePurchaseTable(provisionedStoresResult.error))
  };
}

export function storePurchaseMigrationMessage() {
  return "Apply the store purchase, automated provisioning, and store delivery transfer migrations to enable reseller purchase requests, transfer records, provisioned drafts, and delivery packages.";
}
