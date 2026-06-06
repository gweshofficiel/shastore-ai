import type { SupabaseClient } from "@supabase/supabase-js";
import { getStorePaymentMethods } from "@/lib/store-payment-methods";
import {
  getStorePaymentProviderConnections,
  isPayPalReady,
  isStripeReady,
  isYouCanPayReady,
  providerConnectionByName
} from "@/lib/store-payment-provider-connections";
import { generatedVisualAssetsFromStoreData, isApprovedGeneratedVisualAsset } from "@/lib/storefront/visual-assets";

export type PublishReadinessStatus = "blocked" | "ready" | "warning";

export type PublishReadinessItem = {
  description: string;
  fixHref: string;
  key: string;
  label: string;
  status: PublishReadinessStatus;
};

export type PublishReadinessResult = {
  blockingIssues: PublishReadinessItem[];
  readyItems: PublishReadinessItem[];
  warnings: PublishReadinessItem[];
};

type PublishReadinessInput = {
  storeId: string;
  supabase: SupabaseClient;
  workspaceId: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function hasText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function item({
  description,
  fixHref,
  key,
  label,
  status
}: PublishReadinessItem): PublishReadinessItem {
  return { description, fixHref, key, label, status };
}

function approvedVisualCount(storeData: unknown) {
  const generated = generatedVisualAssetsFromStoreData(storeData);
  let approved = 0;

  for (const targetGroup of Object.values(generated)) {
    for (const slots of Object.values(targetGroup ?? {})) {
      for (const asset of Object.values(slots ?? {})) {
        if (isApprovedGeneratedVisualAsset(asset)) {
          approved += 1;
        }
      }
    }
  }

  return approved;
}

function pushByStatus(result: PublishReadinessResult, readinessItem: PublishReadinessItem) {
  if (readinessItem.status === "blocked") {
    result.blockingIssues.push(readinessItem);
    return;
  }

  if (readinessItem.status === "warning") {
    result.warnings.push(readinessItem);
    return;
  }

  result.readyItems.push(readinessItem);
}

export async function validateStorePublishReadiness({
  storeId,
  supabase,
  workspaceId
}: PublishReadinessInput): Promise<PublishReadinessResult> {
  const detailPath = `/dashboard/stores/${encodeURIComponent(storeId)}`;
  const result: PublishReadinessResult = {
    blockingIssues: [],
    readyItems: [],
    warnings: []
  };

  const [
    storeResult,
    productsResult,
    legalPagesResult,
    publicationResult,
    paymentMethods,
    providerConnections
  ] = await Promise.all([
    supabase
      .from("stores" as never)
      .select("id, slug, store_data, store_email, support_email, support_phone, whatsapp_number, delivery_enabled, pickup_enabled, delivery_notes")
      .eq("id" as never, storeId as never)
      .eq("workspace_id" as never, workspaceId as never)
      .maybeSingle(),
    supabase
      .from("store_products" as never)
      .select("id")
      .eq("store_id" as never, storeId as never)
      .eq("workspace_id" as never, workspaceId as never)
      .eq("status" as never, "active" as never),
    supabase
      .from("store_pages" as never)
      .select("id, page_type, status")
      .eq("store_id" as never, storeId as never)
      .eq("workspace_id" as never, workspaceId as never)
      .in("page_type" as never, ["privacy", "returns", "shipping", "terms"] as never),
    supabase
      .from("published_stores" as never)
      .select("custom_domain, slug, status")
      .eq("store_id" as never, storeId as never)
      .eq("workspace_id" as never, workspaceId as never)
      .maybeSingle(),
    getStorePaymentMethods(supabase, storeId),
    getStorePaymentProviderConnections(supabase, storeId)
  ]);

  const store: Record<string, unknown> = isRecord(storeResult.data) ? storeResult.data : {};
  const activeProducts = Array.isArray(productsResult.data) ? productsResult.data : [];
  const legalPages = Array.isArray(legalPagesResult.data)
    ? (legalPagesResult.data as Array<Record<string, unknown>>)
    : [];
  const publication: Record<string, unknown> = isRecord(publicationResult.data) ? publicationResult.data : {};
  const storeData = store.store_data;
  const enabledPaymentMethod = paymentMethods.some((method) => method.is_enabled);
  const stripeReady = isStripeReady(providerConnectionByName(providerConnections, "stripe"));
  const paypalReady = isPayPalReady(providerConnectionByName(providerConnections, "paypal"));
  const youCanReady = isYouCanPayReady(providerConnectionByName(providerConnections, "youcan_pay"));
  const requiredLegalTypes = ["privacy", "returns", "shipping", "terms"];
  const existingLegalTypes = new Set(
    legalPages
      .filter((page) => hasText(page.id))
      .map((page) => String(page.page_type ?? ""))
  );
  const missingLegalTypes = requiredLegalTypes.filter((type) => !existingLegalTypes.has(type));
  const hasContact = [
    store.store_email,
    store.support_email,
    store.support_phone,
    store.whatsapp_number
  ].some(hasText);
  const shippingConfigured =
    store.delivery_enabled === true ||
    store.pickup_enabled === true ||
    hasText(store.delivery_notes);
  const hasTemplatePackageInstall = isRecord(storeData) && isRecord(storeData.templatePackageInstallations);
  const approvedVisuals = approvedVisualCount(storeData);
  const defaultDomainReady = hasText(publication.slug) || hasText(store.slug);
  const customDomain = hasText(publication.custom_domain);

  pushByStatus(result, item({
    description: activeProducts.length
      ? `${activeProducts.length} active product${activeProducts.length === 1 ? "" : "s"} ready for customers.`
      : "Publish requires at least one active product.",
    fixHref: `/dashboard/products?storeId=${encodeURIComponent(storeId)}`,
    key: "active-products",
    label: activeProducts.length ? "Active products ready" : "No active products",
    status: activeProducts.length ? "ready" : "blocked"
  }));

  pushByStatus(result, item({
    description: hasContact
      ? "Customers have a contact email, phone, support number, or WhatsApp route."
      : "Add at least one customer contact email, phone, support number, or WhatsApp number.",
    fixHref: `${detailPath}#store-settings`,
    key: "contact",
    label: hasContact ? "Contact information configured" : "No contact email or phone",
    status: hasContact ? "ready" : "blocked"
  }));

  pushByStatus(result, item({
    description: shippingConfigured
      ? "Shipping, pickup, or delivery notes are configured."
      : "Configure shipping, pickup, or delivery instructions before publishing.",
    fixHref: "/dashboard/shipping",
    key: "shipping",
    label: shippingConfigured ? "Shipping configured" : "No shipping configuration",
    status: shippingConfigured ? "ready" : "blocked"
  }));

  pushByStatus(result, item({
    description: enabledPaymentMethod || stripeReady || paypalReady || youCanReady
      ? "At least one payment method or provider is enabled."
      : "Enable a payment method or connect a payment provider before publishing.",
    fixHref: `/dashboard/payments?storeId=${encodeURIComponent(storeId)}`,
    key: "payments",
    label: enabledPaymentMethod || stripeReady || paypalReady || youCanReady
      ? "Payment method configured"
      : "No payment method configured",
    status: enabledPaymentMethod || stripeReady || paypalReady || youCanReady ? "ready" : "blocked"
  }));

  pushByStatus(result, item({
    description: missingLegalTypes.length
      ? `Missing required legal pages: ${missingLegalTypes.join(", ")}.`
      : "Privacy, terms, refund/returns, and shipping policy pages exist.",
    fixHref: `/dashboard/legal-pages?storeId=${encodeURIComponent(storeId)}`,
    key: "legal-pages",
    label: missingLegalTypes.length ? "Missing required legal pages" : "Legal pages reviewed",
    status: missingLegalTypes.length ? "blocked" : "ready"
  }));

  pushByStatus(result, item({
    description: customDomain
      ? "A custom domain is saved for this store."
      : "No custom domain is connected yet. The default store route can still be used.",
    fixHref: `${detailPath}#domains`,
    key: "custom-domain",
    label: customDomain ? "Custom domain connected" : "No custom domain",
    status: customDomain ? "ready" : "warning"
  }));

  pushByStatus(result, item({
    description: hasTemplatePackageInstall
      ? "This store was created from a template package. Review demo content before launch."
      : "No template demo package marker was found.",
    fixHref: `/dashboard/products?storeId=${encodeURIComponent(storeId)}`,
    key: "demo-content",
    label: hasTemplatePackageInstall ? "Demo content may still be present" : "Demo content reviewed",
    status: hasTemplatePackageInstall ? "warning" : "ready"
  }));

  pushByStatus(result, item({
    description: approvedVisuals
      ? `${approvedVisuals} approved AI visual${approvedVisuals === 1 ? "" : "s"} ready.`
      : "No approved AI visuals were found. This is optional but recommended for template stores.",
    fixHref: `/dashboard/ai-visual-assets?storeId=${encodeURIComponent(storeId)}`,
    key: "ai-visuals",
    label: approvedVisuals ? "AI visuals approved" : "No AI visuals approved",
    status: approvedVisuals ? "ready" : "warning"
  }));

  pushByStatus(result, item({
    description: defaultDomainReady
      ? "The default storefront route is available for preview and publishing."
      : "Save publication settings to reserve the default storefront route.",
    fixHref: `${detailPath}#publication`,
    key: "default-domain",
    label: defaultDomainReady ? "Default domain ready" : "Default domain needs review",
    status: defaultDomainReady ? "ready" : "warning"
  }));

  return result;
}
