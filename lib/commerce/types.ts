import type { Json } from "@/types/database";

export type CommerceSourceType = "landing" | "store";
export type CommerceCustomerSourceType = CommerceSourceType | "manual";
export type CommerceOrderStatus =
  | "new"
  | "confirmed"
  | "shipped"
  | "delivered"
  | "canceled";
export type CommercePaymentMethod = "cod" | "whatsapp" | "stripe" | "paypal";
export type CommercePaymentStatus = "pending" | "paid" | "failed" | "refunded";
export type CommerceAnalyticsEventType =
  | "visitor"
  | "page_view"
  | "visitor_session"
  | "whatsapp_click"
  | "checkout_started"
  | "order_created"
  | "conversion"
  | "order"
  | "product_view";
export type CommerceDomainStatus = "pending" | "verified" | "failed";

export type CommerceCustomer = {
  id: string;
  user_id: string;
  source_type: CommerceCustomerSourceType;
  source_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  country: string | null;
  notes: string | null;
  source: string | null;
  order_count: number;
  total_spent: number;
  created_at: string;
  updated_at: string;
};

export type CommerceOrder = {
  id: string;
  user_id: string;
  customer_id: string | null;
  source_type: CommerceSourceType;
  source_id: string | null;
  source_slug: string | null;
  status: CommerceOrderStatus;
  payment_method: CommercePaymentMethod;
  payment_status: CommercePaymentStatus;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  city: string | null;
  address: string | null;
  customer_snapshot: Json;
  products: Json;
  currency: string;
  subtotal: number;
  total: number;
  total_amount: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type CommerceOrderItem = {
  id: string;
  order_id: string;
  user_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  metadata: Json;
  created_at: string;
};

export type CommercePaymentSettings = {
  id: string;
  user_id: string;
  stripe_enabled: boolean;
  paypal_enabled: boolean;
  cod_enabled: boolean;
  whatsapp_orders_enabled: boolean;
  stripe_account_label: string | null;
  paypal_account_label: string | null;
  created_at: string;
  updated_at: string;
};

export type CommerceDomainPublication = {
  id: string;
  user_id: string;
  source_type: CommerceSourceType;
  source_id: string | null;
  source_slug: string | null;
  free_subdomain: string | null;
  custom_domain: string | null;
  hostname: string | null;
  status: CommerceDomainStatus;
  verification_token: string;
  dns_target: string;
  created_at: string;
  updated_at: string;
};

export type CommerceAnalyticsSummary = {
  visitors: number;
  pageViews: number;
  whatsappClicks: number;
  conversions: number;
  orders: number;
  salesEstimate: number;
  conversionRate: number;
  topSources: Array<{
    sourceType: CommerceSourceType;
    sourceSlug: string;
    label: string;
    count: number;
  }>;
  topProducts: Array<{
    name: string;
    count: number;
  }>;
};
