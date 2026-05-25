"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  buildActivationEmailPayload,
  buildClaimAccountPath,
  createActivationTokenRecord
} from "@/lib/activation-tokens";
import { getUserSubscriptionAccessForClient } from "@/lib/billing/access";
import {
  assertFeatureAccess,
  assertUsageWithinLimits,
  billingEnforcementMessage
} from "@/lib/billing/enforcement";
import { createClient } from "@/lib/supabase/server";
import { getStoreTemplate } from "@/lib/template-studio/library";
import type { TemplateDemoProduct } from "@/lib/template-studio/types";
import type { StorePurchaseRequestStatus } from "@/lib/store-purchase/types";

export type StorePurchaseFormState = {
  message: string;
  status: "idle" | "success" | "error";
};

export type StoreOrderStatusFormState = {
  message: string;
  status: "idle" | "success" | "error";
};

function isNextRedirect(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: string }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

function orderStatusMessage(status: StorePurchaseRequestStatus) {
  if (status === "approved") {
    return "Purchase request approved.";
  }

  if (status === "rejected") {
    return "Purchase request rejected.";
  }

  return "Purchase request status updated.";
}

const allowedStatuses: StorePurchaseRequestStatus[] = [
  "pending",
  "approved",
  "rejected",
  "preparing",
  "delivered"
];

function cleanText(value: FormDataEntryValue | null, maxLength = 1000) {
  if (!value || typeof value !== "string") {
    return null;
  }

  const text = value.trim().slice(0, maxLength);
  return text || null;
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeAccountId(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim().toUpperCase().slice(0, 16) : null;
}

function isBuyerAccountId(value: string) {
  return /^SHA[0-9]{9}U$/.test(value);
}

function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 90);
}

function categorySlug(value: string) {
  return normalizeSlug(value).slice(0, 80) || "category";
}

function safeOrdersReturnPath(value: FormDataEntryValue | null) {
  if (typeof value === "string" && value.startsWith("/reseller/dashboard/orders")) {
    return value;
  }

  return "/reseller/dashboard/orders";
}

function withStatus(path: string, key: "error" | "saved", value: string) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${key}=${encodeURIComponent(value)}`;
}

function redirectWithError(message: string, returnTo: string): never {
  redirect(withStatus(returnTo, "error", message));
}

async function requireResellerProfile() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("reseller_profiles" as never)
    .select("id, slug, display_name")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) {
    redirectWithError("Create your reseller profile before managing store orders.", "/reseller/dashboard/orders");
  }

  return {
    profile: profile as { id: string; slug: string; display_name: string },
    supabase,
    user
  };
}

export async function submitStorePurchaseRequest(
  _previousState: StorePurchaseFormState,
  formData: FormData
): Promise<StorePurchaseFormState> {
  const supabase = await createClient();
  const buyerName = cleanText(formData.get("buyerName"), 120);
  const buyerEmail = cleanText(formData.get("buyerEmail"), 160);
  const businessName = cleanText(formData.get("businessName"), 160);
  const resellerId = cleanText(formData.get("resellerId"), 80);
  const showcaseItemId = cleanText(formData.get("showcaseItemId"), 80);
  const buyerHasAccount = formData.get("buyerHasAccount") === "yes";
  const targetAccountId = buyerHasAccount ? normalizeAccountId(formData.get("targetAccountId")) : null;

  if (!buyerName || !buyerEmail || !businessName || !resellerId || !showcaseItemId) {
    return {
      message: "Please complete your name, email, business name, and selected store.",
      status: "error"
    };
  }

  if (!isEmail(buyerEmail)) {
    return { message: "Please enter a valid buyer email.", status: "error" };
  }

  if (buyerHasAccount && (!targetAccountId || !isBuyerAccountId(targetAccountId))) {
    return {
      message: "Enter a valid SHASTORE buyer account ID like SHA216290173U.",
      status: "error"
    };
  }

  let lookupStatus:
    | "new_account_placeholder"
    | "exists"
    | "not_found"
    | "invalid_format"
    | "invalid_account_type" = "new_account_placeholder";

  if (targetAccountId) {
    const { data: lookupData } = await supabase.rpc("lookup_shastore_account_id" as never, {
      candidate_account_id: targetAccountId
    } as never);
    const lookup = Array.isArray(lookupData)
      ? (lookupData[0] as { lookup_status?: typeof lookupStatus } | undefined)
      : null;

    lookupStatus = lookup?.lookup_status ?? "not_found";
  }

  const { error } = await supabase.from("store_purchase_requests" as never).insert({
    business_name: businessName,
    buyer_account_type_target: "user",
    buyer_email: buyerEmail,
    buyer_has_account: buyerHasAccount,
    buyer_name: buyerName,
    buyer_phone: cleanText(formData.get("buyerPhone"), 80),
    buyer_whatsapp: cleanText(formData.get("buyerWhatsapp"), 80),
    notes: cleanText(formData.get("notes"), 1200),
    requested_domain: cleanText(formData.get("requestedDomain"), 160),
    request_status: "pending",
    reseller_id: resellerId,
    showcase_item_id: showcaseItemId,
    target_account_id: targetAccountId,
    target_account_lookup_status: lookupStatus,
    template_id: cleanText(formData.get("templateId"), 120)
  } as never);

  if (error) {
    return {
      message: "Your request could not be sent. Please check the store is still available.",
      status: "error"
    };
  }

  return {
    message: "Request sent. The reseller can now review your store purchase and prepare transfer.",
    status: "success"
  };
}

export async function updateStorePurchaseRequestStatus(
  _previousState: StoreOrderStatusFormState,
  formData: FormData
): Promise<StoreOrderStatusFormState> {
  const returnTo = safeOrdersReturnPath(formData.get("returnTo"));
  const requestId = cleanText(formData.get("requestId"), 80);
  const status = cleanText(formData.get("requestStatus"), 40) as StorePurchaseRequestStatus | null;

  try {
    if (!requestId || !status || !allowedStatuses.includes(status)) {
      return {
        message: "Store purchase request status could not be updated.",
        status: "error"
      };
    }

    const supabase = await createClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      return {
        message: "Sign in to manage store purchase orders.",
        status: "error"
      };
    }

    const { data: profileData } = await supabase
      .from("reseller_profiles" as never)
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    const profile = profileData as { id: string } | null;

    if (!profile) {
      return {
        message: "Create your reseller profile before managing store orders.",
        status: "error"
      };
    }

    const { data: updatedRequest, error } = await supabase
      .from("store_purchase_requests" as never)
      .update({ request_status: status } as never)
      .eq("id", requestId)
      .eq("reseller_id", profile.id)
      .select("id")
      .maybeSingle();

    if (error) {
      return {
        message: "Store purchase request status could not be saved.",
        status: "error"
      };
    }

    if (!updatedRequest) {
      return {
        message: "Order not found or you do not have permission to update it.",
        status: "error"
      };
    }

    revalidatePath(returnTo);

    return {
      message: orderStatusMessage(status),
      status: "success"
    };
  } catch (error) {
    if (isNextRedirect(error)) {
      throw error;
    }

    console.error("updateStorePurchaseRequestStatus failed", error);

    return {
      message: "Something went wrong while updating the order. Please try again.",
      status: "error"
    };
  }
}

export async function prepareStoreTransferRecord(formData: FormData) {
  const returnTo = safeOrdersReturnPath(formData.get("returnTo"));
  const requestId = cleanText(formData.get("requestId"), 80);
  const { profile, supabase } = await requireResellerProfile();

  if (!requestId) {
    redirectWithError("Store purchase request could not be found.", returnTo);
  }

  const { error: transferError } = await supabase.from("store_transfer_records" as never).upsert(
    {
      delivery_status: "pdf_pending",
      email_delivery_placeholder:
        "Future email delivery will send buyer credentials and transfer checklist.",
      pdf_delivery_placeholder:
        "Future PDF delivery will include store access, transfer code, and onboarding steps.",
      request_id: requestId,
      reseller_id: profile.id,
      transfer_status: "ownership_pending",
      whatsapp_delivery_placeholder:
        "Future WhatsApp delivery will notify the buyer when ownership transfer is ready."
    } as never,
    { onConflict: "request_id" }
  );

  if (transferError) {
    redirectWithError("Ownership transfer preparation could not be created.", returnTo);
  }

  await supabase
    .from("store_purchase_requests" as never)
    .update({ request_status: "preparing" } as never)
    .eq("id", requestId)
    .eq("reseller_id", profile.id);

  revalidatePath(returnTo);
  redirect(withStatus(returnTo, "saved", "preparing"));
}

type PurchaseRequestRecord = {
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
  target_account_id: string | null;
  target_account_lookup_status: string;
  transfer_code: string;
  created_at: string;
};

type ShowcaseItemRecord = {
  id: string;
  source_store_id: string | null;
  slug: string;
  title: string;
  thumbnail_url: string | null;
  preview_images: unknown;
  category: string | null;
  price_label: string | null;
  description: string | null;
  features: unknown;
  demo_url: string | null;
  sort_order: number;
};

function stringList(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
}

function productImagePlaceholder(product: TemplateDemoProduct) {
  return "imagePlaceholder" in product ? (product.imagePlaceholder ?? null) : null;
}

function productStockPlaceholder(product: TemplateDemoProduct) {
  return "stockPlaceholder" in product ? (product.stockPlaceholder ?? null) : null;
}

function templateIdFromShowcaseItem(request: PurchaseRequestRecord, item: ShowcaseItemRecord) {
  if (request.template_id) {
    return request.template_id;
  }

  return (
    stringList(item.preview_images)
      .find((image) => image.startsWith("template:"))
      ?.replace("template:", "") ?? null
  );
}

function buildProvisionedStoreData({
  item,
  request,
  templateId
}: {
  item: ShowcaseItemRecord;
  request: PurchaseRequestRecord;
  templateId: string | null;
}) {
  const template = templateId ? getStoreTemplate(templateId) : null;
  const defaultCustomization = template?.defaultCustomization;

  return {
    buyer: {
      accountMode: request.buyer_has_account ? "existing_shastore_account" : "new_account_placeholder",
      accountTypeTarget: request.buyer_account_type_target,
      businessName: request.business_name,
      email: request.buyer_email,
      name: request.buyer_name,
      phone: request.buyer_phone,
      requestedDomain: request.requested_domain,
      targetAccountId: request.target_account_id,
      targetAccountLookupStatus: request.target_account_lookup_status,
      whatsapp: request.buyer_whatsapp
    },
    cloneSource: {
      purchaseRequestId: request.id,
      sourceShowcaseItemId: item.id,
      sourceStoreId: item.source_store_id,
      sourceTemplateId: templateId,
      transferCode: request.transfer_code
    },
    footerSettings: defaultCustomization
      ? {
          address: defaultCustomization.address,
          copyrightText: defaultCustomization.copyrightText,
          lockedPoweredBy: defaultCustomization.lockedPoweredBy,
          paymentIcons: defaultCustomization.paymentIcons,
          phone: defaultCustomization.phone,
          privacyPolicyLink: defaultCustomization.privacyPolicyLink,
          privacyPolicyText: defaultCustomization.privacyPolicyText,
          refundPolicyLink: defaultCustomization.refundPolicyLink,
          refundPolicyText: defaultCustomization.refundPolicyText,
          shippingMethodText: defaultCustomization.shippingMethodText,
          shippingPolicyLink: defaultCustomization.shippingPolicyLink,
          shippingPolicyText: defaultCustomization.shippingPolicyText,
          storeDescription: defaultCustomization.storeDescription,
          storeName: defaultCustomization.storeName,
          supportEmail: defaultCustomization.supportEmail,
          termsLink: defaultCustomization.termsLink,
          termsText: defaultCustomization.termsText,
          whatsapp: defaultCustomization.whatsapp
        }
      : {},
    futurePlaceholders: {
      buyerAccountCreation: "pending_future_automation",
      credentialsGeneration: "pending_future_automation",
      domainConnection: "pending_future_automation",
      emailDelivery: "pending_future_automation",
      ownershipTransfer: "buyer_user_id_placeholder",
      pdfDelivery: "pending_future_automation",
      quotaDeduction: "pending_future_automation",
      whatsappDelivery: "pending_future_automation"
    },
    homepageContent: template
      ? {
          demoOffers: template.demoOffers,
          demoSections: template.demoSections,
          homepageText: template.homepageText,
          heroSubtitle: defaultCustomization?.heroSubtitle,
          heroTitle: defaultCustomization?.heroTitle
        }
      : {},
    previewCard: {
      category: item.category,
      demoUrl: item.demo_url,
      description: item.description,
      features: item.features,
      previewImages: item.preview_images,
      priceLabel: item.price_label,
      thumbnailUrl: item.thumbnail_url,
      title: item.title
    },
    products: template?.demoProducts ?? [],
    storeDesign: defaultCustomization
      ? {
          banner: defaultCustomization.banner,
          colors: {
            primaryColor: defaultCustomization.primaryColor,
            secondaryColor: defaultCustomization.secondaryColor
          },
          contactInfo: defaultCustomization.contactInfo,
          ctaText: defaultCustomization.ctaText,
          logo: defaultCustomization.logo,
          seo: {
            description: defaultCustomization.seoDescription,
            title: defaultCustomization.seoTitle
          },
          socialLinks: defaultCustomization.socialLinks
        }
      : {},
    templateSnapshot: template
      ? {
          categoryKey: template.categoryKey,
          categoryName: template.categoryName,
          kind: template.kind,
          name: template.name,
          previewGradient: template.previewGradient
        }
      : null
  };
}

export async function prepareProvisionedStoreDraft(formData: FormData) {
  const returnTo = safeOrdersReturnPath(formData.get("returnTo"));
  const requestId = cleanText(formData.get("requestId"), 80);
  const { profile, supabase, user } = await requireResellerProfile();

  if (!requestId) {
    redirectWithError("Store purchase request could not be found.", returnTo);
  }

  const { data: requestData, error: requestError } = await supabase
    .from("store_purchase_requests" as never)
    .select("*")
    .eq("id", requestId)
    .eq("reseller_id", profile.id)
    .maybeSingle();

  if (requestError || !requestData) {
    redirectWithError("Store purchase request could not be loaded for provisioning.", returnTo);
  }

  const request = requestData as PurchaseRequestRecord;
  const { data: itemData, error: itemError } = await supabase
    .from("reseller_showcase_items" as never)
    .select(
      "id, source_store_id, slug, title, thumbnail_url, preview_images, category, price_label, description, features, demo_url, sort_order"
    )
    .eq("id", request.showcase_item_id)
    .eq("profile_id", profile.id)
    .maybeSingle();

  if (itemError || !itemData) {
    redirectWithError("Purchased showcase item could not be cloned.", returnTo);
  }

  const item = itemData as ShowcaseItemRecord;
  const templateId = templateIdFromShowcaseItem(request, item);
  const template = templateId ? getStoreTemplate(templateId) : null;

  if (!template) {
    redirectWithError("Purchased template data could not be found for store cloning.", returnTo);
  }

  const slugSeed = normalizeSlug(`${request.business_name}-${item.slug}`) || `store-${request.id}`;
  const provisionedSlug = `${slugSeed}-${request.transfer_code.toLowerCase()}`.slice(0, 110);
  const provisionedName = `${request.business_name} - ${item.title}`;
  const provisionedStoreData = buildProvisionedStoreData({ item, request, templateId });
  let ownerUserId: string | null = null;
  let resolvedLookupStatus = request.target_account_lookup_status;

  if (request.target_account_id) {
    const { data: resolvedAccountData } = await supabase.rpc(
      "resolve_shastore_user_account_id" as never,
      { candidate_account_id: request.target_account_id } as never
    );
    const resolvedAccount = Array.isArray(resolvedAccountData)
      ? (resolvedAccountData[0] as { lookup_status?: string; owner_user_id?: string | null } | undefined)
      : null;

    ownerUserId = resolvedAccount?.owner_user_id ?? null;
    resolvedLookupStatus = resolvedAccount?.lookup_status ?? resolvedLookupStatus;
  }

  const { data: storeInstance, error: instanceError } = await supabase
    .from("store_instances" as never)
    .upsert(
      {
        internal_slug: provisionedSlug,
        owner_user_id: ownerUserId,
        purchase_request_id: request.id,
        reseller_user_id: user.id,
        source_template_id: template.id,
        source_template_key: template.id,
        status: "prepared",
        store_name: provisionedName.slice(0, 180),
        visibility: "preview"
      } as never,
      { onConflict: "purchase_request_id" }
    )
    .select("id, internal_slug")
    .single();

  if (instanceError || !storeInstance) {
    redirectWithError("Real cloned store instance could not be created.", returnTo);
  }

  const instance = storeInstance as { id: string; internal_slug: string };

  await Promise.all([
    supabase.from("store_instance_products" as never).delete().eq("store_instance_id", instance.id),
    supabase.from("store_instance_categories" as never).delete().eq("store_instance_id", instance.id)
  ]);

  const customization = template.defaultCustomization;
  const productRows = template.demoProducts.map((product, index) => ({
    category: product.category,
    featured: product.featured,
    image_placeholder: productImagePlaceholder(product),
    name: product.name,
    price_label: product.price,
    product_data: product,
    product_type: product.type,
    short_description: product.shortDescription,
    sort_order: index,
    stock_placeholder: productStockPlaceholder(product),
    store_instance_id: instance.id
  }));
  const categoryRows = template.demoCategories.map((category, index) => ({
    category_data: {
      sourceTemplateKey: template.id,
      templateCategoryKey: template.categoryKey
    },
    name: category,
    slug: categorySlug(category),
    sort_order: index,
    store_instance_id: instance.id
  }));

  await Promise.all([
    productRows.length
      ? supabase.from("store_instance_products" as never).insert(productRows as never)
      : Promise.resolve({ error: null }),
    categoryRows.length
      ? supabase.from("store_instance_categories" as never).insert(categoryRows as never)
      : Promise.resolve({ error: null }),
    supabase.from("store_instance_branding" as never).upsert(
      {
        banner: customization.banner,
        contact_settings: {
          contactInfo: customization.contactInfo,
          phone: customization.phone,
          supportEmail: customization.supportEmail,
          whatsapp: customization.whatsapp
        },
        cta: {
          text: customization.ctaText
        },
        footer_settings: {
          address: customization.address,
          copyrightText: customization.copyrightText,
          lockedPoweredBy: customization.lockedPoweredBy,
          paymentIcons: customization.paymentIcons,
          privacyPolicyLink: customization.privacyPolicyLink,
          privacyPolicyText: customization.privacyPolicyText,
          refundPolicyLink: customization.refundPolicyLink,
          refundPolicyText: customization.refundPolicyText,
          shippingMethodText: customization.shippingMethodText,
          shippingPolicyLink: customization.shippingPolicyLink,
          shippingPolicyText: customization.shippingPolicyText,
          storeDescription: customization.storeDescription,
          storeName: customization.storeName,
          termsLink: customization.termsLink,
          termsText: customization.termsText
        },
        homepage_content: {
          demoOffers: template.demoOffers,
          demoSections: template.demoSections,
          homepageText: template.homepageText,
          heroSubtitle: customization.heroSubtitle,
          heroTitle: customization.heroTitle
        },
        logo: customization.logo,
        primary_color: customization.primaryColor,
        secondary_color: customization.secondaryColor,
        seo: {
          description: customization.seoDescription,
          title: customization.seoTitle
        },
        social_links: customization.socialLinks,
        store_instance_id: instance.id
      } as never,
      { onConflict: "store_instance_id" }
    ),
    supabase.from("store_instance_domains" as never).upsert(
      {
        connected_domain: null,
        dns_status: "not_configured",
        requested_domain: request.requested_domain,
        ssl_status: "not_configured",
        store_instance_id: instance.id
      } as never,
      { onConflict: "store_instance_id" }
    )
  ]);

  const { error: provisionError } = await supabase.from("provisioned_stores" as never).upsert(
    {
      buyer_email: request.buyer_email,
      buyer_name: request.buyer_name,
      buyer_user_id: ownerUserId,
      ownership_status: ownerUserId ? "target_account_attached" : "pending_transfer",
      provisioned_store_data: {
        ...provisionedStoreData,
        realStoreInstance: {
          id: instance.id,
          previewUrl: `/reseller/dashboard/orders/store-preview/${instance.internal_slug}`,
          slug: instance.internal_slug
        },
        targetAccountLookupStatus: resolvedLookupStatus
      },
      provisioned_store_name: provisionedName.slice(0, 180),
      provisioned_store_slug: instance.internal_slug,
      provisioning_status: "ready",
      purchase_request_id: request.id,
      reseller_id: profile.id,
      source_showcase_item_id: item.id,
      source_template_id: template.id
    } as never,
    { onConflict: "purchase_request_id" }
  );

  if (provisionError) {
    redirectWithError("Provisioned store draft could not be created.", returnTo);
  }

  await supabase.from("store_transfer_records" as never).upsert(
    {
      delivery_status: "not_sent",
      email_delivery_placeholder:
        "Future email delivery will send buyer credentials after provisioning is ready.",
      pdf_delivery_placeholder:
        "Future PDF delivery will include generated credentials, transfer code, and handoff checklist.",
      request_id: request.id,
      reseller_id: profile.id,
      transfer_status: "ready",
      whatsapp_delivery_placeholder:
        "Future WhatsApp delivery will notify the buyer when the provisioned store is ready."
    } as never,
    { onConflict: "request_id" }
  );

  await supabase
    .from("store_purchase_requests" as never)
    .update({
      request_status: "preparing",
      target_account_lookup_status: resolvedLookupStatus
    } as never)
    .eq("id", request.id)
    .eq("reseller_id", profile.id);

  revalidatePath(returnTo);
  redirect(withStatus(returnTo, "saved", "provisioned"));
}

type ProvisionedStoreRecord = {
  id: string;
  purchase_request_id: string;
  reseller_id: string;
  buyer_email: string;
  buyer_name: string;
  provisioned_store_slug: string;
  provisioned_store_name: string;
};

function buildCredentialsPackage({
  activationPath,
  provisionedStore,
  request,
  resellerName
}: {
  activationPath?: string;
  provisionedStore: ProvisionedStoreRecord;
  request: PurchaseRequestRecord;
  resellerName: string;
}) {
  return {
    buyer: {
      email: request.buyer_email,
      name: request.buyer_name,
      targetAccountId: request.target_account_id,
      targetAccountLookupStatus: request.target_account_lookup_status,
      transferDestination: request.target_account_id
        ? "existing_shastore_account_placeholder"
        : "new_buyer_account_creation_placeholder",
      whatsapp: request.buyer_whatsapp
    },
    deliveryPlaceholders: {
      activationLink: activationPath ?? "future_activation_link_placeholder",
      automatedOnboarding: "future_onboarding_flow_placeholder",
      domainConnection: "future_domain_connection_placeholder",
      emailDelivery: "activation_email_payload_prepared",
      passwordSetupLink: "future_secure_password_setup_link_placeholder",
      pdfCredentialGeneration: "future_pdf_generation_placeholder",
      quotaDeduction: "future_reseller_quota_deduction_placeholder",
      realDeployment: "future_deployment_pipeline_placeholder",
      whatsappDelivery: "future_whatsapp_delivery_placeholder"
    },
    loginPlaceholders: {
      buyerDashboardUrl: "future_buyer_dashboard_url_placeholder",
      temporaryLogin: "not_generated",
      temporaryPassword: "not_generated"
    },
    onboardingMessage:
      "Your SHASTORE AI store draft is ready for reseller review. Final login, password setup, domain connection, and delivery automation will be enabled in a future handoff step.",
    ownershipPlaceholders: {
      buyerAuthCreation: "pending_future_auth_creation",
      buyerDashboardAssignment: "pending_future_dashboard_assignment",
      targetAccountId: request.target_account_id,
      targetAccountLookupStatus: request.target_account_lookup_status,
      storeManagementAccess: "pending_future_role_permissions",
      storeRolePermissions: "pending_future_role_permissions",
      storeOwnershipTransfer: "pending_future_store_owner_assignment"
    },
    resellerName,
    storeName: provisionedStore.provisioned_store_name,
    storeSlug: provisionedStore.provisioned_store_slug,
    transferCode: request.transfer_code
  };
}

export async function prepareStoreDeliveryTransfer(formData: FormData) {
  const returnTo = safeOrdersReturnPath(formData.get("returnTo"));
  const requestId = cleanText(formData.get("requestId"), 80);
  const { profile, supabase, user } = await requireResellerProfile();

  if (!requestId) {
    redirectWithError("Store purchase request could not be found.", returnTo);
  }

  const { data: requestData, error: requestError } = await supabase
    .from("store_purchase_requests" as never)
    .select("*")
    .eq("id", requestId)
    .eq("reseller_id", profile.id)
    .maybeSingle();

  if (requestError || !requestData) {
    redirectWithError("Store purchase request could not be loaded for transfer.", returnTo);
  }

  const request = requestData as PurchaseRequestRecord;
  const { data: provisionedStoreData, error: provisionedStoreError } = await supabase
    .from("provisioned_stores" as never)
    .select("id, purchase_request_id, reseller_id, buyer_email, buyer_name, provisioned_store_slug, provisioned_store_name")
    .eq("purchase_request_id", request.id)
    .eq("reseller_id", profile.id)
    .maybeSingle();

  if (provisionedStoreError || !provisionedStoreData) {
    redirectWithError("Prepare Store before preparing delivery transfer.", returnTo);
  }

  const provisionedStore = provisionedStoreData as ProvisionedStoreRecord;
  const { data: storeInstanceData, error: storeInstanceError } = await supabase
    .from("store_instances" as never)
    .select("id, internal_slug")
    .eq("purchase_request_id", request.id)
    .eq("reseller_user_id", user.id)
    .maybeSingle();

  if (storeInstanceError || !storeInstanceData) {
    redirectWithError("Prepare Store before generating an activation link.", returnTo);
  }

  const storeInstance = storeInstanceData as { id: string; internal_slug: string };
  const activationToken = createActivationTokenRecord();
  const activationPath = buildClaimAccountPath(activationToken.token);
  const activationEmailPayload = buildActivationEmailPayload({
    buyerEmail: request.buyer_email,
    buyerName: request.buyer_name,
    claimPath: activationPath,
    expiresAt: activationToken.expiresAt,
    resellerName: profile.display_name,
    storeName: provisionedStore.provisioned_store_name,
    transferCode: request.transfer_code
  });
  const credentialsPackage = buildCredentialsPackage({
    activationPath,
    provisionedStore,
    request,
    resellerName: profile.display_name
  });

  const { error: transferError } = await supabase.from("store_transfers" as never).upsert(
    {
      buyer_email: request.buyer_email,
      buyer_whatsapp: request.buyer_whatsapp,
      credentials_package: credentialsPackage,
      delivery_status: "ready_for_delivery",
      ownership_assigned: false,
      provisioned_store_id: provisionedStore.id,
      purchase_request_id: request.id,
      reseller_id: profile.id,
      transfer_code: request.transfer_code,
      transfer_status: "ready_for_delivery",
      transferred_at: null
    } as never,
    { onConflict: "purchase_request_id" }
  );

  if (transferError) {
    redirectWithError("Store delivery transfer could not be prepared.", returnTo);
  }

  await Promise.all([
    supabase
      .from("store_transfer_records" as never)
      .upsert(
        {
          delivery_status: "email_pending",
          email_delivery_placeholder:
            JSON.stringify(activationEmailPayload),
          pdf_delivery_placeholder:
            "Future PDF delivery will render the credentials package into a handoff document.",
          request_id: request.id,
          reseller_id: profile.id,
          transfer_status: "ready",
          whatsapp_delivery_placeholder:
            "Future WhatsApp delivery will notify the buyer that the store is ready."
        } as never,
        { onConflict: "request_id" }
      ),
    supabase
      .from("provisioned_stores" as never)
      .update({
        ownership_status: "ready_for_buyer_assignment",
        provisioning_status: "ready"
      } as never)
      .eq("id", provisionedStore.id)
      .eq("reseller_id", profile.id),
    supabase.from("store_activation_tokens" as never).upsert(
      {
        activation_status: "pending",
        activation_token: activationToken.tokenStorageValue,
        activation_token_hash: activationToken.hash,
        activation_token_hash_algorithm: "sha256",
        buyer_email: request.buyer_email,
        buyer_name: request.buyer_name,
        expires_at: activationToken.expiresAt,
        purchase_request_id: request.id,
        reseller_id: profile.id,
        store_instance_id: storeInstance.id,
        transfer_code: request.transfer_code
      } as never,
      { onConflict: "purchase_request_id" }
    ),
    supabase
      .from("store_purchase_requests" as never)
      .update({ request_status: "preparing" } as never)
      .eq("id", request.id)
      .eq("reseller_id", profile.id)
  ]);

  revalidatePath(returnTo);
  redirect(withStatus(returnTo, "saved", "transfer-ready"));
}

export async function markStoreDeliveryTransferDelivered(formData: FormData) {
  const returnTo = safeOrdersReturnPath(formData.get("returnTo"));
  const requestId = cleanText(formData.get("requestId"), 80);
  const { profile, supabase } = await requireResellerProfile();

  if (!requestId) {
    redirectWithError("Store transfer could not be found.", returnTo);
  }

  const deliveredAt = new Date().toISOString();
  const { data: transferData, error: transferError } = await supabase
    .from("store_transfers" as never)
    .update({
      delivery_status: "delivered",
      ownership_assigned: false,
      transfer_status: "delivered",
      transferred_at: deliveredAt
    } as never)
    .eq("purchase_request_id", requestId)
    .eq("reseller_id", profile.id)
    .select("provisioned_store_id")
    .maybeSingle();

  if (transferError || !transferData) {
    redirectWithError("Prepare Transfer before marking this store delivered.", returnTo);
  }

  const provisionedStoreId = (transferData as { provisioned_store_id: string }).provisioned_store_id;

  await Promise.all([
    supabase
      .from("store_transfer_records" as never)
      .upsert(
        {
          delivery_status: "sent",
          email_delivery_placeholder:
            "Future email delivery marked as sent placeholder.",
          pdf_delivery_placeholder:
            "Future PDF credentials package marked as delivered placeholder.",
          request_id: requestId,
          reseller_id: profile.id,
          transfer_status: "completed",
          whatsapp_delivery_placeholder:
            "Future WhatsApp delivery marked as sent placeholder."
        } as never,
        { onConflict: "request_id" }
      ),
    supabase
      .from("provisioned_stores" as never)
      .update({
        ownership_status: "delivery_completed_buyer_assignment_pending",
        provisioning_status: "delivered"
      } as never)
      .eq("id", provisionedStoreId)
      .eq("reseller_id", profile.id),
    supabase
      .from("store_purchase_requests" as never)
      .update({ request_status: "delivered" } as never)
      .eq("id", requestId)
      .eq("reseller_id", profile.id)
  ]);

  revalidatePath(returnTo);
  redirect(withStatus(returnTo, "saved", "delivered"));
}

export async function generateManualDeliveryPdf(formData: FormData) {
  const returnTo = safeOrdersReturnPath(formData.get("returnTo"));
  const requestId = cleanText(formData.get("requestId"), 80);
  const { profile, supabase, user } = await requireResellerProfile();

  if (!requestId) {
    redirectWithError("Store purchase request could not be found.", returnTo);
  }

  const access = await getUserSubscriptionAccessForClient(supabase, user.id);

  try {
    assertFeatureAccess(access, "exports");
    assertUsageWithinLimits(access, "exports");
  } catch (error) {
    redirectWithError(
      billingEnforcementMessage(error) ??
        "Your current plan has reached its export limit. Upgrade at /dashboard/billing.",
      returnTo
    );
  }

  const { data: requestData, error: requestError } = await supabase
    .from("store_purchase_requests" as never)
    .select("*")
    .eq("id", requestId)
    .eq("reseller_id", profile.id)
    .maybeSingle();

  if (requestError || !requestData) {
    redirectWithError("Store purchase request could not be loaded for delivery PDF.", returnTo);
  }

  const request = requestData as PurchaseRequestRecord;
  const [
    { data: instanceData },
    { data: provisionedData },
    { data: activationData },
    { data: transferData }
  ] =
    await Promise.all([
      supabase
        .from("store_instances" as never)
        .select("id, internal_slug, store_name")
        .eq("purchase_request_id", request.id)
        .maybeSingle(),
      supabase
        .from("provisioned_stores" as never)
        .select("id, provisioned_store_name, provisioned_store_slug")
        .eq("purchase_request_id", request.id)
        .eq("reseller_id", profile.id)
        .maybeSingle(),
      supabase
        .from("store_activation_tokens" as never)
        .select("activation_token")
        .eq("purchase_request_id", request.id)
        .eq("reseller_id", profile.id)
        .maybeSingle(),
      supabase
        .from("store_transfers" as never)
        .select("credentials_package")
        .eq("purchase_request_id", request.id)
        .eq("reseller_id", profile.id)
        .maybeSingle()
    ]);

  if (!instanceData || !activationData) {
    redirectWithError("Prepare Store and Prepare Transfer before generating the PDF.", returnTo);
  }

  const instance = instanceData as { id: string; internal_slug: string; store_name: string };
  const provisioned = provisionedData as { id: string; provisioned_store_name: string; provisioned_store_slug: string } | null;
  const activation = activationData as { activation_token: string };
  const transfer = transferData as { credentials_package?: { deliveryPlaceholders?: { activationLink?: string } } } | null;
  const activationLink =
    transfer?.credentials_package?.deliveryPlaceholders?.activationLink ??
    buildClaimAccountPath(activation.activation_token);
  const storePreviewLink = `/reseller/dashboard/orders/store-preview/${instance.internal_slug}`;
  const accountMode = request.target_account_id
    ? `Existing SHASTORE account ID: ${request.target_account_id}`
    : "New buyer account placeholder";
  const pdfPayload = {
    accountMode,
    activationLink,
    buyerEmail: request.buyer_email,
    buyerName: request.buyer_name,
    buyerWhatsapp: request.buyer_whatsapp ?? "Not provided",
    generatedAt: new Date().toISOString(),
    onboardingInstructions: [
      "Open the claim-account link in the buyer browser or account session.",
      "Review the store name and transfer code.",
      "Set the buyer password to create or link the Supabase Auth account.",
      "After activation, check /dashboard/stores in the buyer account."
    ],
    resellerSupportContact: profile.display_name,
    storeName: provisioned?.provisioned_store_name ?? instance.store_name,
    storePreviewLink,
    transferCode: request.transfer_code
  };

  const { error: documentError } = await supabase.from("store_delivery_documents" as never).upsert(
    {
      document_status: "manual_delivery_ready",
      generated_at: new Date().toISOString(),
      pdf_payload: pdfPayload,
      provisioned_store_id: provisioned?.id ?? null,
      purchase_request_id: request.id,
      reseller_id: profile.id,
      store_instance_id: instance.id
    } as never,
    { onConflict: "purchase_request_id" }
  );

  if (documentError) {
    redirectWithError("Manual delivery PDF could not be generated.", returnTo);
  }

  await supabase
    .from("store_transfers" as never)
    .update({ delivery_status: "manual_delivery_ready" } as never)
    .eq("purchase_request_id", request.id)
    .eq("reseller_id", profile.id);

  revalidatePath(returnTo);
  redirect(withStatus(returnTo, "saved", "delivery-pdf"));
}
