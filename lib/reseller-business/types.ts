export type ResellerStoreDeliveryMethod =
  | "manual"
  | "email_placeholder"
  | "whatsapp_placeholder"
  | "pdf_access_placeholder"
  | "ownership_transfer_placeholder";

export type ResellerBusinessSettings = {
  id: string;
  user_id: string;
  business_name: string | null;
  support_email: string | null;
  support_whatsapp: string | null;
  business_website: string | null;
  invoice_notes: string | null;
  store_delivery_method: ResellerStoreDeliveryMethod;
  send_store_access_email: boolean;
  send_store_access_whatsapp: boolean;
  generate_pdf_access_file: boolean;
  generate_invoice_pdf: boolean;
  buyer_thank_you_message: string | null;
  client_onboarding_instructions: string | null;
  created_at: string;
  updated_at: string;
};

export type ResellerBusinessData = {
  ready: boolean;
  settings: ResellerBusinessSettings | null;
};
