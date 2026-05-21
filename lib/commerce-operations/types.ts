import type { Json } from "@/types/database";

export type CommerceOperationsScope = "seller" | "reseller";

export type SellerCommerceSettings = {
  id: string;
  user_id: string;
  dashboard_scope: CommerceOperationsScope;
  business_name: string | null;
  business_email: string | null;
  support_phone: string | null;
  support_whatsapp: string | null;
  business_address: string | null;
  supported_countries: Json;
  currency: string;
  timezone: string;
  order_confirmation_mode: string;
  return_policy: string | null;
  shipping_policy: string | null;
  privacy_policy: string | null;
  taxes_enabled: boolean;
  tax_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ShippingMethod = {
  id: string;
  user_id: string;
  dashboard_scope: CommerceOperationsScope;
  method_name: string;
  enabled: boolean;
  flat_fee: number;
  free_shipping_enabled: boolean;
  shipping_regions: Json;
  estimated_delivery_time: string | null;
  local_delivery_enabled: boolean;
  pickup_enabled: boolean;
  cod_supported: boolean;
  delivery_notes: string | null;
  preparation_delay_days: number;
  estimated_delivery_days: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type DeliveryAgent = {
  id: string;
  user_id: string;
  dashboard_scope: CommerceOperationsScope;
  agent_name: string;
  phone: string | null;
  city: string | null;
  vehicle_type: string | null;
  status: "active" | "inactive";
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type CommerceOperationsData = {
  agents: DeliveryAgent[];
  ready: boolean;
  settings: SellerCommerceSettings | null;
  shippingMethods: ShippingMethod[];
};
