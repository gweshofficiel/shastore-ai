"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStoreTemplate } from "@/lib/template-studio/library";
import type { StorePurchaseRequestStatus } from "@/lib/store-purchase/types";

export type StorePurchaseFormState = {
  message: string;
  status: "idle" | "success" | "error";
};

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

export async function updateStorePurchaseRequestStatus(formData: FormData) {
  const returnTo = safeOrdersReturnPath(formData.get("returnTo"));
  const requestId = cleanText(formData.get("requestId"), 80);
  const status = cleanText(formData.get("requestStatus"), 40) as StorePurchaseRequestStatus | null;
  const { profile, supabase } = await requireResellerProfile();

  if (!requestId || !status || !allowedStatuses.includes(status)) {
    redirectWithError("Store purchase request status could not be updated.", returnTo);
  }

  const { error } = await supabase
    .from("store_purchase_requests" as never)
    .update({ request_status: status } as never)
    .eq("id", requestId)
    .eq("reseller_id", profile.id);

  if (error) {
    redirectWithError("Store purchase request status could not be saved.", returnTo);
  }

  revalidatePath(returnTo);
  redirect(withStatus(returnTo, "saved", status));
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
  const { profile, supabase } = await requireResellerProfile();

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
  const slugSeed = normalizeSlug(`${request.business_name}-${item.slug}`) || `store-${request.id}`;
  const provisionedSlug = `${slugSeed}-${request.transfer_code.toLowerCase()}`.slice(0, 110);
  const provisionedName = `${request.business_name} - ${item.title}`;
  const provisionedStoreData = buildProvisionedStoreData({ item, request, templateId });

  const { error: provisionError } = await supabase.from("provisioned_stores" as never).upsert(
    {
      buyer_email: request.buyer_email,
      buyer_name: request.buyer_name,
      buyer_user_id: null,
      ownership_status: "buyer_account_placeholder",
      provisioned_store_data: provisionedStoreData,
      provisioned_store_name: provisionedName.slice(0, 180),
      provisioned_store_slug: provisionedSlug,
      provisioning_status: "preparing",
      purchase_request_id: request.id,
      reseller_id: profile.id,
      source_showcase_item_id: item.id,
      source_template_id: templateId
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
      transfer_status: "preparing",
      whatsapp_delivery_placeholder:
        "Future WhatsApp delivery will notify the buyer when the provisioned store is ready."
    } as never,
    { onConflict: "request_id" }
  );

  await supabase
    .from("store_purchase_requests" as never)
    .update({ request_status: "preparing" } as never)
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
  provisionedStore,
  request,
  resellerName
}: {
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
      automatedOnboarding: "future_onboarding_flow_placeholder",
      domainConnection: "future_domain_connection_placeholder",
      emailDelivery: "future_email_delivery_placeholder",
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
  const { profile, supabase } = await requireResellerProfile();

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
  const credentialsPackage = buildCredentialsPackage({
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
            "Future email delivery will send the prepared credentials package.",
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
