"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStoreTemplate } from "@/lib/template-studio/library";
import type { StoreTemplate, TemplateCustomizationDefaults } from "@/lib/template-studio/types";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;
type StudioStatus = "draft" | "published" | "unpublished" | "duplicated" | "restored";
type ResellerProfileRef = { id: string; slug: string; display_name: string };

function cleanText(value: FormDataEntryValue | null, maxLength = 1000) {
  if (!value || typeof value !== "string") {
    return null;
  }

  const text = value.trim().slice(0, maxLength);
  return text || null;
}

function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 80);
}

function safeReturnPath(value: FormDataEntryValue | null) {
  if (
    typeof value === "string" &&
    (value.startsWith("/dashboard/templates") || value.startsWith("/reseller/dashboard/templates"))
  ) {
    return value;
  }

  return "/dashboard/templates";
}

function withStatus(path: string, key: "error" | "saved", value: string) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${key}=${encodeURIComponent(value)}`;
}

function redirectWithError(message: string, returnTo: string): never {
  redirect(withStatus(returnTo, "error", message));
}

function parseCustomization(
  value: FormDataEntryValue | null,
  template: StoreTemplate
): TemplateCustomizationDefaults {
  if (typeof value !== "string") {
    return template.defaultCustomization;
  }

  try {
    const parsed = JSON.parse(value) as Partial<TemplateCustomizationDefaults>;
    return {
      ...template.defaultCustomization,
      ...parsed,
      lockedPoweredBy: "Powered by SHASTORE AI",
      socialLinks: {
        ...template.defaultCustomization.socialLinks,
        ...(parsed.socialLinks ?? {})
      }
    };
  } catch {
    return template.defaultCustomization;
  }
}

function draftPayload({
  customization,
  duplicatedFromDraftId,
  resellerId,
  status,
  template,
  templateKey,
  userId
}: {
  customization: TemplateCustomizationDefaults;
  duplicatedFromDraftId?: string | null;
  resellerId?: string | null;
  status: StudioStatus;
  template: StoreTemplate;
  templateKey?: string;
  userId: string;
}) {
  const key = templateKey ?? template.id;

  return {
    branding: {
      banner: customization.banner,
      logo: customization.logo,
      storeDescription: customization.storeDescription,
      storeName: customization.storeName
    },
    categories: template.demoCategories,
    colors: {
      primaryColor: customization.primaryColor,
      secondaryColor: customization.secondaryColor
    },
    cta: {
      text: customization.ctaText
    },
    customization,
    duplicated_from_draft_id: duplicatedFromDraftId ?? null,
    footer_settings: {
      address: customization.address,
      copyrightText: customization.copyrightText,
      lockedPoweredBy: "Powered by SHASTORE AI",
      paymentIcons: customization.paymentIcons,
      phone: customization.phone,
      privacyPolicyLink: customization.privacyPolicyLink,
      privacyPolicyText: customization.privacyPolicyText,
      refundPolicyLink: customization.refundPolicyLink,
      refundPolicyText: customization.refundPolicyText,
      shippingMethodText: customization.shippingMethodText,
      shippingPolicyLink: customization.shippingPolicyLink,
      shippingPolicyText: customization.shippingPolicyText,
      supportEmail: customization.supportEmail,
      termsLink: customization.termsLink,
      termsText: customization.termsText,
      whatsapp: customization.whatsapp
    },
    homepage_content: {
      heroSubtitle: customization.heroSubtitle,
      heroTitle: customization.heroTitle,
      sections: template.demoSections
    },
    products: template.demoProducts,
    reseller_id: resellerId ?? null,
    seo: {
      description: customization.seoDescription,
      title: customization.seoTitle
    },
    source_template_key: template.id,
    status,
    template_key: key,
    template_snapshot: {
      categoryKey: template.categoryKey,
      categoryName: template.categoryName,
      demoOffers: template.demoOffers,
      kind: template.kind,
      name: template.name,
      previewGradient: template.previewGradient
    },
    title: customization.heroTitle || template.name,
    user_id: userId
  };
}

function templateFeatures(template: StoreTemplate) {
  return [
    `${template.demoProducts.length} realistic demo products`,
    `${template.demoCategories.length} category sections`,
    "Full storefront preview",
    "Editable footer, legal, shipping, payment, CTA, and SEO",
    `Protected ${template.categoryName} category mapping`
  ];
}

function templatePriceLabel(template: StoreTemplate) {
  if (template.kind === "digital") {
    return "Digital store setup from $149";
  }

  if (template.kind === "marketplace") {
    return "Marketplace setup from $499";
  }

  return "Ready-made store setup from $299";
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return { supabase, user };
}

function getActionTemplate(formData: FormData, returnTo: string) {
  const templateId = cleanText(formData.get("templateId"), 120);
  const template = templateId ? getStoreTemplate(templateId) : null;

  if (!template) {
    redirectWithError("Template could not be found.", returnTo);
  }

  return template;
}

async function getResellerProfileForUser(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase
    .from("reseller_profiles" as never)
    .select("id, slug, display_name")
    .eq("user_id", userId)
    .maybeSingle();

  return (data as ResellerProfileRef | null) ?? null;
}

async function getOrCreatePublishedProfile(
  supabase: SupabaseClient,
  user: { id: string; email?: string },
  customization: TemplateCustomizationDefaults
) {
  const existing = await getResellerProfileForUser(supabase, user.id);

  if (existing) {
    await supabase
      .from("reseller_profiles" as never)
      .update({ is_published: true } as never)
      .eq("id", existing.id)
      .eq("user_id", user.id);

    return existing;
  }

  const emailName = user.email?.split("@")[0] ?? "reseller";
  const displayName = `${emailName.replace(/[._-]+/g, " ")} Template Studio`;
  const slug = normalizeSlug(`${emailName}-${user.id.slice(0, 8)}`);
  const { data, error } = await supabase
    .from("reseller_profiles" as never)
    .insert({
      accent_color: customization.secondaryColor,
      bio: "A curated marketplace of ready-made stores and templates built with SHASTORE AI.",
      display_name: displayName,
      is_published: true,
      primary_color: customization.primaryColor,
      slug,
      theme_id: "modern",
      user_id: user.id
    } as never)
    .select("id, slug, display_name")
    .single();

  if (error || !data) {
    return null;
  }

  return data as ResellerProfileRef;
}

async function upsertDraft({
  customization,
  duplicatedFromDraftId,
  resellerId,
  status,
  supabase,
  template,
  templateKey,
  userId
}: {
  customization: TemplateCustomizationDefaults;
  duplicatedFromDraftId?: string | null;
  resellerId?: string | null;
  status: StudioStatus;
  supabase: SupabaseClient;
  template: StoreTemplate;
  templateKey?: string;
  userId: string;
}) {
  return supabase
    .from("template_drafts" as never)
    .upsert(
      draftPayload({
        customization,
        duplicatedFromDraftId,
        resellerId,
        status,
        template,
        templateKey,
        userId
      }) as never,
      { onConflict: "user_id,template_key" }
    )
    .select("id")
    .single();
}

async function upsertPublication({
  draftId,
  profile,
  showcaseItemId,
  status,
  supabase,
  template,
  userId
}: {
  draftId: string | null;
  profile: ResellerProfileRef | null;
  showcaseItemId: string | null;
  status: "published" | "unpublished";
  supabase: SupabaseClient;
  template: StoreTemplate;
  userId: string;
}) {
  return supabase.from("template_publications" as never).upsert(
    {
      draft_id: draftId,
      preview_card: {
        category: template.categoryName,
        demoUrl: `/templates/preview/${template.id}`,
        features: templateFeatures(template),
        previewImage: `template:${template.id}`,
        priceLabel: templatePriceLabel(template),
        templateKey: template.id
      },
      published_at: status === "published" ? new Date().toISOString() : null,
      reseller_id: profile?.id ?? null,
      showcase_item_id: showcaseItemId,
      status,
      template_key: template.id,
      unpublished_at: status === "unpublished" ? new Date().toISOString() : null,
      user_id: userId
    } as never,
    { onConflict: "user_id,template_key" }
  );
}

export async function getSavedTemplateDraft(templateId: string) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from("template_drafts" as never)
    .select("customization, status, updated_at")
    .eq("user_id", user.id)
    .eq("template_key", templateId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const draft = data as {
    customization: Partial<TemplateCustomizationDefaults>;
    status: StudioStatus;
    updated_at: string;
  };
  const template = getStoreTemplate(templateId);

  if (!template) {
    return null;
  }

  return {
    customization: parseCustomization(JSON.stringify(draft.customization), template),
    status: draft.status,
    updatedAt: draft.updated_at
  };
}

export async function saveTemplateDraft(formData: FormData) {
  const returnTo = safeReturnPath(formData.get("returnTo"));
  const template = getActionTemplate(formData, returnTo);
  const customization = parseCustomization(formData.get("customization"), template);
  const { supabase, user } = await requireUser();
  const profile = await getResellerProfileForUser(supabase, user.id);
  const { error } = await upsertDraft({
    customization,
    resellerId: profile?.id ?? null,
    status: "draft",
    supabase,
    template,
    userId: user.id
  });

  if (error) {
    redirectWithError("Template draft could not be saved. Apply the template persistence migration.", returnTo);
  }

  revalidatePath(returnTo);
  redirect(withStatus(returnTo, "saved", "draft"));
}

export async function publishTemplate(formData: FormData) {
  const returnTo = safeReturnPath(formData.get("returnTo"));
  const template = getActionTemplate(formData, returnTo);
  const customization = parseCustomization(formData.get("customization"), template);
  const { supabase, user } = await requireUser();
  const profile = returnTo.startsWith("/reseller/dashboard")
    ? await getOrCreatePublishedProfile(supabase, user, customization)
    : await getResellerProfileForUser(supabase, user.id);

  if (returnTo.startsWith("/reseller/dashboard") && !profile) {
    redirectWithError("Reseller profile could not be prepared for publishing.", returnTo);
  }

  const { data: draft, error: draftError } = await upsertDraft({
    customization,
    resellerId: profile?.id ?? null,
    status: "published",
    supabase,
    template,
    userId: user.id
  });

  if (draftError || !draft) {
    redirectWithError("Template draft could not be saved before publishing.", returnTo);
  }

  let showcaseItemId: string | null = null;

  if (profile && returnTo.startsWith("/reseller/dashboard")) {
    const slug = normalizeSlug(`template-${template.id}`);
    const { data: item, error: listingError } = await supabase
      .from("reseller_showcase_items" as never)
      .upsert(
        {
          category: template.categoryName,
          demo_url: `/templates/preview/${template.id}`,
          description: customization.seoDescription || template.description,
          features: templateFeatures(template),
          preview_images: [`template:${template.id}`],
          price_label: templatePriceLabel(template),
          profile_id: profile.id,
          slug,
          sort_order: 0,
          status: "published",
          thumbnail_url: null,
          title: customization.heroTitle || template.name,
          user_id: user.id
        } as never,
        { onConflict: "profile_id,slug" }
      )
      .select("id")
      .single();

    if (listingError || !item) {
      redirectWithError("Reseller showcase listing could not be published.", returnTo);
    }

    showcaseItemId = (item as { id: string }).id;
  }

  const { error: publicationError } = await upsertPublication({
    draftId: (draft as { id: string }).id,
    profile: profile ?? null,
    showcaseItemId,
    status: "published",
    supabase,
    template,
    userId: user.id
  });

  if (publicationError) {
    redirectWithError("Template publication could not be saved.", returnTo);
  }

  revalidatePath(returnTo);
  revalidatePath("/reseller/dashboard/templates");
  revalidatePath("/reseller/dashboard/stores");

  if (profile) {
    revalidatePath(`/reseller/${profile.slug}`);
  }

  redirect(withStatus(returnTo, "saved", "published"));
}

export async function unpublishTemplate(formData: FormData) {
  const returnTo = safeReturnPath(formData.get("returnTo"));
  const template = getActionTemplate(formData, returnTo);
  const customization = parseCustomization(formData.get("customization"), template);
  const { supabase, user } = await requireUser();
  const profile = await getResellerProfileForUser(supabase, user.id);
  const { data: draft, error: draftError } = await upsertDraft({
    customization,
    resellerId: profile?.id ?? null,
    status: "unpublished",
    supabase,
    template,
    userId: user.id
  });

  if (draftError || !draft) {
    redirectWithError("Template draft could not be preserved while unpublishing.", returnTo);
  }

  let showcaseItemId: string | null = null;

  if (profile) {
    const { data: item } = await supabase
      .from("reseller_showcase_items" as never)
      .update({ status: "unpublished" } as never)
      .eq("profile_id", profile.id)
      .eq("slug", normalizeSlug(`template-${template.id}`))
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle();

    showcaseItemId = item ? (item as { id: string }).id : null;
  }

  const { error: publicationError } = await upsertPublication({
    draftId: (draft as { id: string }).id,
    profile,
    showcaseItemId,
    status: "unpublished",
    supabase,
    template,
    userId: user.id
  });

  if (publicationError) {
    redirectWithError("Template publication status could not be saved.", returnTo);
  }

  revalidatePath(returnTo);
  revalidatePath("/reseller/dashboard/templates");
  revalidatePath("/reseller/dashboard/stores");

  if (profile) {
    revalidatePath(`/reseller/${profile.slug}`);
  }

  redirect(withStatus(returnTo, "saved", "unpublished"));
}

export async function duplicateTemplate(formData: FormData) {
  const returnTo = safeReturnPath(formData.get("returnTo"));
  const template = getActionTemplate(formData, returnTo);
  const customization = parseCustomization(formData.get("customization"), template);
  const { supabase, user } = await requireUser();
  const profile = await getResellerProfileForUser(supabase, user.id);
  const { data: sourceDraft } = await supabase
    .from("template_drafts" as never)
    .select("id")
    .eq("user_id", user.id)
    .eq("template_key", template.id)
    .maybeSingle();
  const duplicateKey = `${template.id}-copy-${Date.now()}`;
  const { error } = await upsertDraft({
    customization,
    duplicatedFromDraftId: sourceDraft ? (sourceDraft as { id: string }).id : null,
    resellerId: profile?.id ?? null,
    status: "duplicated",
    supabase,
    template,
    templateKey: duplicateKey,
    userId: user.id
  });

  if (error) {
    redirectWithError("Template duplicate could not be created.", returnTo);
  }

  revalidatePath(returnTo);
  redirect(withStatus(returnTo, "saved", "duplicated"));
}

export async function restoreTemplateDefaults(formData: FormData) {
  const returnTo = safeReturnPath(formData.get("returnTo"));
  const template = getActionTemplate(formData, returnTo);
  const { supabase, user } = await requireUser();
  const profile = await getResellerProfileForUser(supabase, user.id);
  const { error } = await upsertDraft({
    customization: template.defaultCustomization,
    resellerId: profile?.id ?? null,
    status: "restored",
    supabase,
    template,
    userId: user.id
  });

  if (error) {
    redirectWithError("Template defaults could not be restored.", returnTo);
  }

  revalidatePath(returnTo);
  redirect(withStatus(returnTo, "saved", "restored"));
}
