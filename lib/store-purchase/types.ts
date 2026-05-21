export type StorePurchaseRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "preparing"
  | "delivered";

export type StoreTransferStatus =
  | "not_started"
  | "preparing"
  | "account_pending"
  | "ownership_pending"
  | "domain_pending"
  | "ready"
  | "completed"
  | "blocked";

export type StoreTransferDeliveryStatus =
  | "not_sent"
  | "pdf_pending"
  | "whatsapp_pending"
  | "email_pending"
  | "sent"
  | "failed";

export type StorePurchaseRequest = {
  id: string;
  reseller_id: string;
  template_id: string | null;
  showcase_item_id: string;
  buyer_name: string;
  buyer_email: string;
  buyer_phone: string | null;
  buyer_whatsapp: string | null;
  buyer_has_account: boolean;
  buyer_account_type_target: "user";
  business_name: string;
  requested_domain: string | null;
  notes: string | null;
  request_status: StorePurchaseRequestStatus;
  target_account_id: string | null;
  target_account_lookup_status:
    | "new_account_placeholder"
    | "exists"
    | "not_found"
    | "invalid_format"
    | "invalid_account_type";
  transfer_code: string;
  created_at: string;
};

export type StoreTransferRecord = {
  id: string;
  request_id: string;
  reseller_id: string;
  buyer_user_id: string | null;
  transfer_status: StoreTransferStatus;
  delivery_status: StoreTransferDeliveryStatus;
  pdf_delivery_placeholder: string | null;
  whatsapp_delivery_placeholder: string | null;
  email_delivery_placeholder: string | null;
  created_at: string;
};

export type ProvisionedStoreStatus = "draft" | "preparing" | "ready" | "delivered" | "failed";

export type ProvisionedStore = {
  id: string;
  purchase_request_id: string;
  reseller_id: string;
  buyer_email: string;
  buyer_name: string;
  source_template_id: string | null;
  source_showcase_item_id: string;
  provisioned_store_slug: string;
  provisioned_store_name: string;
  provisioned_store_data: unknown;
  provisioning_status: ProvisionedStoreStatus;
  ownership_status: string;
  buyer_user_id: string | null;
  created_at: string;
  updated_at: string;
};

export type StoreInstanceStatus =
  | "provisioning"
  | "prepared"
  | "delivered"
  | "transferred"
  | "suspended";

export type StoreInstanceVisibility = "private" | "preview" | "public";

export type StoreInstance = {
  id: string;
  internal_slug: string;
  owner_user_id: string | null;
  reseller_user_id: string;
  purchase_request_id: string;
  source_template_key: string | null;
  source_template_id: string | null;
  store_name: string;
  status: StoreInstanceStatus;
  visibility: StoreInstanceVisibility;
  created_at: string;
  updated_at: string;
};

export type StoreDeliveryTransferStatus =
  | "preparing"
  | "ready_for_delivery"
  | "delivered"
  | "failed";

export type StoreDeliveryStatus =
  | "not_sent"
  | "ready_for_delivery"
  | "delivered"
  | "failed";

export type StoreDeliveryTransfer = {
  id: string;
  purchase_request_id: string;
  provisioned_store_id: string;
  reseller_id: string;
  buyer_email: string;
  buyer_whatsapp: string | null;
  transfer_code: string;
  transfer_status: StoreDeliveryTransferStatus;
  delivery_status: StoreDeliveryStatus;
  credentials_package: unknown;
  ownership_assigned: boolean;
  transferred_at: string | null;
  created_at: string;
  updated_at: string;
};

export type StorePurchaseOrder = StorePurchaseRequest & {
  delivery_transfer: StoreDeliveryTransfer | null;
  provisioned_store: ProvisionedStore | null;
  showcase_title: string | null;
  showcase_price_label: string | null;
  store_instance: StoreInstance | null;
  transfer_record: StoreTransferRecord | null;
};
