export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type LandingPageStatus = "draft" | "published" | "archived";
export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "incomplete";
export type DomainStatus = "pending" | "verified" | "failed";
export type PublicationStatus = "draft" | "published" | "unpublished";
export type ProjectType = "landing" | "store";
export type CommerceCustomerSourceType = "landing" | "store" | "manual";
export type CommerceSourceType = "landing" | "store";
export type CommerceOrderStatus =
  | "pending"
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

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          created_at?: string;
        };
        Update: {
          email?: string;
          full_name?: string | null;
        };
        Relationships: [];
      };
      landing_pages: {
        Row: {
          id: string;
          user_id: string;
          template_id: string;
          slug: string;
          status: LandingPageStatus;
          product_name: string;
          product_price: string;
          product_description: string;
          whatsapp_number: string;
          brand_color: string;
          hero_image_url: string | null;
          ai_copy: Json;
          created_at: string;
          updated_at: string;
          published_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          template_id: string;
          slug: string;
          status?: LandingPageStatus;
          product_name: string;
          product_price: string;
          product_description: string;
          whatsapp_number: string;
          brand_color: string;
          hero_image_url?: string | null;
          ai_copy?: Json;
          created_at?: string;
          updated_at?: string;
          published_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["landing_pages"]["Insert"]>;
        Relationships: [];
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          status: SubscriptionStatus;
          price_id: string | null;
          current_period_end: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          status?: SubscriptionStatus;
          price_id?: string | null;
          current_period_end?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["subscriptions"]["Insert"]>;
        Relationships: [];
      };
      product_images: {
        Row: {
          id: string;
          landing_page_id: string;
          user_id: string;
          storage_path: string;
          public_url: string;
          image_type: string;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          landing_page_id: string;
          user_id: string;
          storage_path: string;
          public_url: string;
          image_type?: string;
          sort_order?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["product_images"]["Insert"]>;
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          short_description: string;
          long_description: string | null;
          price: string;
          compare_price: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          short_description: string;
          long_description?: string | null;
          price: string;
          compare_price?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["products"]["Insert"]>;
        Relationships: [];
      };
      landing_settings: {
        Row: {
          id: string;
          landing_page_id: string;
          user_id: string;
          cta_text: string;
          brand_color: string;
          whatsapp_number: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          landing_page_id: string;
          user_id: string;
          cta_text: string;
          brand_color: string;
          whatsapp_number: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["landing_settings"]["Insert"]>;
        Relationships: [];
      };
      landing_payment_methods: {
        Row: {
          id: string;
          landing_page_id: string;
          user_id: string;
          method: string;
          enabled: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          landing_page_id: string;
          user_id: string;
          method: string;
          enabled?: boolean;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["landing_payment_methods"]["Insert"]
        >;
        Relationships: [];
      };
      projects: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          project_type: ProjectType;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          project_type?: ProjectType;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["projects"]["Insert"]>;
        Relationships: [];
      };
      stores: {
        Row: {
          id: string;
          project_id: string | null;
          user_id: string;
          name: string;
          description: string | null;
          logo_image_url: string | null;
          brand_color: string;
          currency: string;
          whatsapp_number: string | null;
          template_id: string;
          status: PublicationStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id?: string | null;
          user_id: string;
          name: string;
          description?: string | null;
          logo_image_url?: string | null;
          brand_color?: string;
          currency?: string;
          whatsapp_number?: string | null;
          template_id?: string;
          status?: PublicationStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["stores"]["Insert"]>;
        Relationships: [];
      };
      store_categories: {
        Row: {
          id: string;
          store_id: string;
          user_id: string;
          name: string;
          description: string | null;
          image_url: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          user_id: string;
          name: string;
          description?: string | null;
          image_url?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["store_categories"]["Insert"]
        >;
        Relationships: [];
      };
      store_products: {
        Row: {
          id: string;
          store_id: string;
          category_id: string | null;
          user_id: string;
          name: string;
          description: string | null;
          price: string | null;
          image_url: string | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          category_id?: string | null;
          user_id: string;
          name: string;
          description?: string | null;
          price?: string | null;
          image_url?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["store_products"]["Insert"]>;
        Relationships: [];
      };
      store_templates: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          name: string;
          description?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["store_templates"]["Insert"]>;
        Relationships: [];
      };
      store_theme_settings: {
        Row: {
          id: string;
          store_id: string;
          user_id: string;
          template_id: string;
          brand_color: string;
          logo_image_url: string | null;
          settings: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          user_id: string;
          template_id: string;
          brand_color?: string;
          logo_image_url?: string | null;
          settings?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["store_theme_settings"]["Insert"]
        >;
        Relationships: [];
      };
      published_stores: {
        Row: {
          id: string;
          store_id: string;
          user_id: string;
          slug: string;
          url: string;
          status: PublicationStatus;
          published_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          user_id: string;
          slug: string;
          url: string;
          status?: PublicationStatus;
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["published_stores"]["Insert"]>;
        Relationships: [];
      };
      landings: {
        Row: {
          id: string;
          project_id: string | null;
          user_id: string;
          landing_page_id: string | null;
          title: string;
          status: PublicationStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id?: string | null;
          user_id: string;
          landing_page_id?: string | null;
          title: string;
          status?: PublicationStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["landings"]["Insert"]>;
        Relationships: [];
      };
      templates: {
        Row: {
          id: string;
          name: string;
          category: string;
          is_active: boolean;
          schema: Json;
          created_at: string;
        };
        Insert: {
          id: string;
          name: string;
          category: string;
          is_active?: boolean;
          schema?: Json;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["templates"]["Insert"]>;
        Relationships: [];
      };
      generations: {
        Row: {
          id: string;
          user_id: string;
          landing_page_id: string | null;
          kind: string;
          prompt: Json;
          output: Json;
          credits_used: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          landing_page_id?: string | null;
          kind: string;
          prompt: Json;
          output: Json;
          credits_used?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["generations"]["Insert"]>;
        Relationships: [];
      };
      domains: {
        Row: {
          id: string;
          user_id: string;
          project_id: string | null;
          hostname: string;
          subdomain: string | null;
          status: DomainStatus;
          verification_token: string;
          dns_target: string;
          created_at: string;
          verified_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          project_id?: string | null;
          hostname: string;
          subdomain?: string | null;
          status?: DomainStatus;
          verification_token?: string;
          dns_target: string;
          created_at?: string;
          verified_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["domains"]["Insert"]>;
        Relationships: [];
      };
      publications: {
        Row: {
          id: string;
          user_id: string;
          landing_page_id: string;
          domain_id: string | null;
          url: string;
          status: PublicationStatus;
          published_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          landing_page_id: string;
          domain_id?: string | null;
          url: string;
          status?: PublicationStatus;
          published_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["publications"]["Insert"]>;
        Relationships: [];
      };
      plans: {
        Row: {
          id: string;
          name: string;
          stripe_price_id: string | null;
          monthly_credits: number;
          price_cents: number;
          is_active: boolean;
        };
        Insert: {
          id: string;
          name: string;
          stripe_price_id?: string | null;
          monthly_credits: number;
          price_cents: number;
          is_active?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["plans"]["Insert"]>;
        Relationships: [];
      };
      credits: {
        Row: {
          id: string;
          user_id: string;
          balance: number;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          balance?: number;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["credits"]["Insert"]>;
        Relationships: [];
      };
      usage_events: {
        Row: {
          id: string;
          user_id: string;
          event_type: string;
          quantity: number;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          event_type: string;
          quantity?: number;
          metadata?: Json;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["usage_events"]["Insert"]>;
        Relationships: [];
      };
      commerce_customers: {
        Row: {
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
        Insert: {
          id?: string;
          user_id: string;
          source_type?: CommerceCustomerSourceType;
          source_id?: string | null;
          name: string;
          email?: string | null;
          phone?: string | null;
          city?: string | null;
          country?: string | null;
          notes?: string | null;
          source?: string | null;
          order_count?: number;
          total_spent?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["commerce_customers"]["Insert"]>;
        Relationships: [];
      };
      commerce_orders: {
        Row: {
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
          checkout_source: string | null;
          buyer_notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          customer_id?: string | null;
          source_type: CommerceSourceType;
          source_id?: string | null;
          source_slug?: string | null;
          status?: CommerceOrderStatus;
          payment_method?: CommercePaymentMethod;
          payment_status?: CommercePaymentStatus;
          customer_name?: string | null;
          customer_phone?: string | null;
          customer_email?: string | null;
          city?: string | null;
          address?: string | null;
          customer_snapshot?: Json;
          products?: Json;
          currency?: string;
          subtotal?: number;
          total?: number;
          total_amount?: number;
          notes?: string | null;
          checkout_source?: string | null;
          buyer_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["commerce_orders"]["Insert"]>;
        Relationships: [];
      };
      commerce_order_items: {
        Row: {
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
        Insert: {
          id?: string;
          order_id: string;
          user_id: string;
          product_id?: string | null;
          product_name: string;
          quantity?: number;
          unit_price?: number;
          total_price?: number;
          metadata?: Json;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["commerce_order_items"]["Insert"]>;
        Relationships: [];
      };
      commerce_analytics_events: {
        Row: {
          id: string;
          user_id: string | null;
          source_type: CommerceSourceType;
          source_id: string | null;
          source_slug: string | null;
          event_type: CommerceAnalyticsEventType;
          visitor_id: string | null;
          session_id: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          source_type: CommerceSourceType;
          source_id?: string | null;
          source_slug?: string | null;
          event_type: CommerceAnalyticsEventType;
          visitor_id?: string | null;
          session_id?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["commerce_analytics_events"]["Insert"]
        >;
        Relationships: [];
      };
      commerce_payment_settings: {
        Row: {
          id: string;
          user_id: string;
          stripe_enabled: boolean;
          paypal_enabled: boolean;
          cod_enabled: boolean;
          whatsapp_orders_enabled: boolean;
          default_whatsapp_number: string | null;
          stripe_seller_enabled: boolean;
          paypal_seller_enabled: boolean;
          crypto_enabled: boolean;
          payment_instructions: string | null;
          stripe_account_label: string | null;
          paypal_account_label: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          stripe_enabled?: boolean;
          paypal_enabled?: boolean;
          cod_enabled?: boolean;
          whatsapp_orders_enabled?: boolean;
          default_whatsapp_number?: string | null;
          stripe_seller_enabled?: boolean;
          paypal_seller_enabled?: boolean;
          crypto_enabled?: boolean;
          payment_instructions?: string | null;
          stripe_account_label?: string | null;
          paypal_account_label?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["commerce_payment_settings"]["Insert"]
        >;
        Relationships: [];
      };
      commerce_domain_publications: {
        Row: {
          id: string;
          user_id: string;
          source_type: CommerceSourceType;
          source_id: string | null;
          source_slug: string | null;
          free_subdomain: string | null;
          custom_domain: string | null;
          hostname: string | null;
          status: DomainStatus;
          verification_token: string;
          dns_target: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          source_type: CommerceSourceType;
          source_id?: string | null;
          source_slug?: string | null;
          free_subdomain?: string | null;
          custom_domain?: string | null;
          hostname?: string | null;
          status?: DomainStatus;
          verification_token?: string;
          dns_target?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["commerce_domain_publications"]["Insert"]
        >;
        Relationships: [];
      };
      analytics_sessions: {
        Row: {
          id: string;
          user_id: string | null;
          visitor_id: string;
          session_id: string;
          source_type: CommerceSourceType;
          source_id: string | null;
          source_slug: string | null;
          referrer: string | null;
          landing_path: string | null;
          user_agent: string | null;
          first_seen_at: string;
          last_seen_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          visitor_id: string;
          session_id: string;
          source_type: CommerceSourceType;
          source_id?: string | null;
          source_slug?: string | null;
          referrer?: string | null;
          landing_path?: string | null;
          user_agent?: string | null;
          first_seen_at?: string;
          last_seen_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["analytics_sessions"]["Insert"]>;
        Relationships: [];
      };
      analytics_events: {
        Row: {
          id: string;
          user_id: string | null;
          source_type: CommerceSourceType;
          source_id: string | null;
          source_slug: string | null;
          event_type: CommerceAnalyticsEventType;
          visitor_id: string | null;
          session_id: string | null;
          product_id: string | null;
          product_name: string | null;
          referrer: string | null;
          path: string | null;
          user_agent: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          source_type: CommerceSourceType;
          source_id?: string | null;
          source_slug?: string | null;
          event_type: CommerceAnalyticsEventType;
          visitor_id?: string | null;
          session_id?: string | null;
          product_id?: string | null;
          product_name?: string | null;
          referrer?: string | null;
          path?: string | null;
          user_agent?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["analytics_events"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      landing_page_status: LandingPageStatus;
      subscription_status: SubscriptionStatus;
      domain_status: DomainStatus;
      publication_status: PublicationStatus;
      project_type: ProjectType;
      commerce_customer_source_type: CommerceCustomerSourceType;
      commerce_source_type: CommerceSourceType;
      commerce_order_status: CommerceOrderStatus;
      commerce_payment_method: CommercePaymentMethod;
      commerce_payment_status: CommercePaymentStatus;
      commerce_analytics_event_type: CommerceAnalyticsEventType;
    };
    CompositeTypes: Record<string, never>;
  };
};
