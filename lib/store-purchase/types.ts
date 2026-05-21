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
  business_name: string;
  requested_domain: string | null;
  notes: string | null;
  request_status: StorePurchaseRequestStatus;
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

export type StorePurchaseOrder = StorePurchaseRequest & {
  provisioned_store: ProvisionedStore | null;
  showcase_title: string | null;
  showcase_price_label: string | null;
  transfer_record: StoreTransferRecord | null;
};
