import { createClient } from "@/lib/supabase/server";
import { getEnabledPublicStorePaymentMethods, type PublicStorePaymentMethod } from "@/lib/store-payment-methods";
import {
  buildWhatsAppOrderUrl,
  calculateCheckoutTotal,
  type CheckoutItem,
  type CheckoutSource
} from "@/lib/commerce/checkout";
import type { CommercePaymentMethod, CommerceSourceType } from "@/lib/commerce/types";

export type BuyerCheckoutPaymentSettings = {
  codEnabled: boolean;
  whatsappOrdersEnabled: boolean;
  defaultWhatsappNumber: string | null;
  stripeSellerEnabled: boolean;
  paypalSellerEnabled: boolean;
  cryptoEnabled: boolean;
  paymentInstructions: string | null;
};

export type BuyerCheckoutSource = CheckoutSource & {
  paymentMethodDetails: PublicStorePaymentMethod[];
  sellerId: string;
  paymentSettings: BuyerCheckoutPaymentSettings;
};

type CheckoutSettingsRow = {
  cod_enabled?: boolean | null;
  whatsapp_orders_enabled?: boolean | null;
  default_whatsapp_number?: string | null;
  stripe_seller_enabled?: boolean | null;
  paypal_seller_enabled?: boolean | null;
  crypto_enabled?: boolean | null;
  payment_instructions?: string | null;
};

type PublishedStoreCheckoutRow = {
  store_id?: string | null;
  visibility?: string | null;
};

const defaultPaymentSettings: BuyerCheckoutPaymentSettings = {
  codEnabled: true,
  whatsappOrdersEnabled: true,
  defaultWhatsappNumber: null,
  stripeSellerEnabled: false,
  paypalSellerEnabled: false,
  cryptoEnabled: false,
  paymentInstructions: null
};

function normalizeSourceType(value: string): CommerceSourceType | null {
  return value === "store" || value === "landing" ? value : null;
}

function normalizeSettings(row: CheckoutSettingsRow | null): BuyerCheckoutPaymentSettings {
  return {
    codEnabled: row?.cod_enabled ?? defaultPaymentSettings.codEnabled,
    whatsappOrdersEnabled:
      row?.whatsapp_orders_enabled ?? defaultPaymentSettings.whatsappOrdersEnabled,
    defaultWhatsappNumber: row?.default_whatsapp_number ?? null,
    stripeSellerEnabled: row?.stripe_seller_enabled ?? false,
    paypalSellerEnabled: row?.paypal_seller_enabled ?? false,
    cryptoEnabled: row?.crypto_enabled ?? false,
    paymentInstructions: row?.payment_instructions ?? null
  };
}

async function getPublicCheckoutSettings(
  sourceType: CommerceSourceType,
  sourceSlug: string
) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_public_checkout_settings" as never, {
    p_source_type: sourceType,
    p_source_slug: sourceSlug
  } as never);
  const rows = (data ?? []) as CheckoutSettingsRow[];

  return normalizeSettings(rows[0] ?? null);
}

function enabledPaymentMethods(settings: BuyerCheckoutPaymentSettings, whatsappNumber: string | null) {
  const methods: CommercePaymentMethod[] = [];

  if (settings.codEnabled) {
    methods.push("cod");
  }

  if (settings.whatsappOrdersEnabled && whatsappNumber) {
    methods.push("whatsapp");
  }

  return methods;
}

function fallbackStorePaymentMethods(settings: BuyerCheckoutPaymentSettings, whatsappNumber: string | null): PublicStorePaymentMethod[] {
  return enabledPaymentMethods(settings, whatsappNumber).map((method) => ({
    displayName: getPaymentMethodLabel(method),
    instructions: null,
    method: method === "whatsapp" ? "whatsapp" : "cod"
  }));
}

export function getPaymentMethodLabel(method: CommercePaymentMethod) {
  const labels: Record<CommercePaymentMethod, string> = {
    cod: "Cash on Delivery",
    paypal: "PayPal",
    stripe: "Stripe",
    whatsapp: "Order via WhatsApp",
    youcan_pay: "YouCan Pay"
  };

  return labels[method];
}

export async function getBuyerCheckoutSource({
  sourceSlug,
  sourceType
}: {
  sourceSlug: string;
  sourceType: string;
}): Promise<BuyerCheckoutSource | null> {
  const normalizedSourceType = normalizeSourceType(sourceType);

  if (!normalizedSourceType || !sourceSlug) {
    return null;
  }

  const supabase = await createClient();

  if (normalizedSourceType === "store") {
    const { data: rawPublication } = await supabase
      .from("published_stores")
      .select("*")
      .eq("slug", sourceSlug)
      .eq("status", "published")
      .maybeSingle();
    const publication = rawPublication as PublishedStoreCheckoutRow | null;

    if (!publication || publication.visibility === "private") {
      return null;
    }

    const [{ data: store }, { data: products }, settings] = await Promise.all([
      supabase
        .from("stores")
        .select("id, user_id, name, currency, whatsapp_number")
        .eq("id", publication.store_id ?? "")
        .maybeSingle(),
      supabase
        .from("store_products")
        .select("id, name, price, image_url")
        .eq("store_id", publication.store_id ?? "")
        .order("sort_order", { ascending: true }),
      getPublicCheckoutSettings(normalizedSourceType, sourceSlug)
    ]);

    if (!store) {
      return null;
    }

    const whatsappNumber = settings.defaultWhatsappNumber ?? store.whatsapp_number;
    const configuredPaymentMethods = await getEnabledPublicStorePaymentMethods(supabase, store.id);
    const paymentMethodDetails = configuredPaymentMethods.length
      ? configuredPaymentMethods
      : fallbackStorePaymentMethods(settings, whatsappNumber);
    const items: CheckoutItem[] = (products ?? []).map((product) => ({
      id: product.id,
      imageUrl: product.image_url,
      name: product.name,
      price: product.price ?? "0"
    }));

    return {
      currency: store.currency || "USD",
      items,
      paymentMethodDetails,
      paymentMethods: paymentMethodDetails.map((method) => method.method),
      paymentSettings: settings,
      sellerId: store.user_id,
      sourceId: store.id,
      sourceSlug,
      sourceType: "store",
      title: store.name,
      whatsappNumber
    };
  }

  const [{ data: landing }, settings] = await Promise.all([
    supabase
      .from("landing_pages")
      .select("id, user_id, slug, product_name, product_price, hero_image_url, whatsapp_number")
      .eq("slug", sourceSlug)
      .eq("status", "published")
      .maybeSingle(),
    getPublicCheckoutSettings(normalizedSourceType, sourceSlug)
  ]);

  if (!landing) {
    return null;
  }

  const whatsappNumber = settings.defaultWhatsappNumber ?? landing.whatsapp_number;
  const items: CheckoutItem[] = [
    {
      id: landing.id,
      imageUrl: landing.hero_image_url,
      name: landing.product_name,
      price: landing.product_price
    }
  ];

  return {
    currency: "USD",
    items,
    paymentMethodDetails: fallbackStorePaymentMethods(settings, whatsappNumber),
    paymentMethods: enabledPaymentMethods(settings, whatsappNumber),
    paymentSettings: settings,
    sellerId: landing.user_id,
    sourceId: landing.id,
    sourceSlug,
    sourceType: "landing",
    title: landing.product_name,
    whatsappNumber
  };
}

export function buildBuyerWhatsAppOrderUrl({
  address,
  city,
  customerName,
  customerPhone,
  item,
  notes,
  quantity,
  source
}: {
  address?: string;
  city?: string;
  customerName: string;
  customerPhone: string;
  item: CheckoutItem;
  notes?: string;
  quantity: number;
  source: BuyerCheckoutSource;
}) {
  const checkoutItems = [{ ...item, quantity }];
  const total = calculateCheckoutTotal(checkoutItems);

  return buildWhatsAppOrderUrl({
    address,
    city,
    customerName,
    items: checkoutItems,
    notes,
    paymentMethod: "whatsapp",
    phone: customerPhone,
    source,
    total
  });
}
