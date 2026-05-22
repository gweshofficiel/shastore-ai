import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";
import type { StoreInstance } from "@/lib/store-purchase/types";

export type StoreInstanceProduct = {
  id: string;
  store_instance_id: string;
  product_type: string;
  name: string;
  category: string | null;
  price_label: string | null;
  short_description: string | null;
  image_placeholder: string | null;
  stock_placeholder: string | null;
  featured: boolean;
  product_data: Json;
  sort_order: number;
  created_at: string;
};

export type StoreInstanceCategory = {
  id: string;
  store_instance_id: string;
  name: string;
  slug: string;
  category_data: Json;
  sort_order: number;
  created_at: string;
};

export type StoreInstanceBranding = {
  id: string;
  store_instance_id: string;
  logo: string | null;
  banner: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  seo: Json;
  footer_settings: Json;
  contact_settings: Json;
  cta: Json;
  homepage_content: Json;
  social_links: Json;
  created_at: string;
  updated_at: string;
};

export type StoreInstanceDomain = {
  id: string;
  store_instance_id: string;
  requested_domain: string | null;
  connected_domain: string | null;
  ssl_status: string;
  dns_status: string;
  created_at: string;
  updated_at: string;
};

export type ManagedStoreSettings = {
  store_name?: string | null;
  store_description?: string | null;
  store_logo_url?: string | null;
  store_favicon_url?: string | null;
  support_email?: string | null;
  store_phone?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  store_status?: string | null;
};

export type ManagedStoreBranding = {
  primary_color?: string | null;
  secondary_color?: string | null;
  theme_mode?: string | null;
  custom_css?: string | null;
  branding_assets?: Json;
  typography?: Json;
};

export type StoreInstancePreview = {
  branding: StoreInstanceBranding | null;
  categories: StoreInstanceCategory[];
  domains: StoreInstanceDomain | null;
  instance: StoreInstance;
  managedBranding: ManagedStoreBranding | null;
  settings: ManagedStoreSettings | null;
  products: StoreInstanceProduct[];
};

function isMissingStoreInstancesTable(error: { code?: string; message?: string } | null) {
  const message = (error?.message ?? "").toLowerCase();
  return (
    error?.code === "PGRST205" ||
    error?.code === "PGRST204" ||
    message.includes("store_instance") ||
    message.includes("could not find the table")
  );
}

export async function getStoreInstancePreview(slug: string): Promise<StoreInstancePreview | null> {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    notFound();
  }

  const { data: instanceData, error: instanceError } = await supabase
    .from("store_instances" as never)
    .select("*")
    .eq("internal_slug", slug)
    .maybeSingle();

  if (instanceError) {
    if (isMissingStoreInstancesTable(instanceError)) {
      return null;
    }

    notFound();
  }

  if (!instanceData) {
    notFound();
  }

  const instance = instanceData as StoreInstance;

  if (instance.owner_user_id !== user.id && instance.reseller_user_id !== user.id) {
    notFound();
  }

  const [
    productsResult,
    categoriesResult,
    brandingResult,
    domainsResult,
    settingsResult,
    managedBrandingResult
  ] = await Promise.all([
    supabase
      .from("store_instance_products" as never)
      .select("*")
      .eq("store_instance_id", instance.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("store_instance_categories" as never)
      .select("*")
      .eq("store_instance_id", instance.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("store_instance_branding" as never)
      .select("*")
      .eq("store_instance_id", instance.id)
      .maybeSingle(),
    supabase
      .from("store_instance_domains" as never)
      .select("*")
      .eq("store_instance_id", instance.id)
      .maybeSingle(),
    supabase
      .from("store_settings" as never)
      .select("*")
      .eq("store_instance_id", instance.id)
      .maybeSingle(),
    supabase
      .from("store_branding" as never)
      .select("*")
      .eq("store_instance_id", instance.id)
      .maybeSingle()
  ]);

  return {
    branding: (brandingResult.data as StoreInstanceBranding | null) ?? null,
    categories: (categoriesResult.data ?? []) as StoreInstanceCategory[],
    domains: (domainsResult.data as StoreInstanceDomain | null) ?? null,
    instance,
    managedBranding: managedBrandingResult.error
      ? null
      : ((managedBrandingResult.data as ManagedStoreBranding | null) ?? null),
    settings: settingsResult.error ? null : ((settingsResult.data as ManagedStoreSettings | null) ?? null),
    products: (productsResult.data ?? []) as StoreInstanceProduct[]
  };
}

export function storeInstanceMigrationMessage() {
  return "Apply supabase/migrations/store-instance-cloning-foundation-safe.sql to enable real cloned store instance previews.";
}
