"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStoreTemplate } from "@/lib/template-studio/library";
import type { StoreTemplate, TemplateCustomizationDefaults } from "@/lib/template-studio/types";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

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
      socialLinks: {
        ...template.defaultCustomization.socialLinks,
        ...(parsed.socialLinks ?? {})
      }
    };
  } catch {
    return template.defaultCustomization;
  }
}

function templateFeatures(template: StoreTemplate) {
  return [
    `${template.demoProducts.length} realistic demo products`,
    `${template.demoCategories.length} category sections`,
    "Full storefront preview",
    "Editable branding, CTA, contact, and SEO",
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

async function getTemplateRecord(
  supabase: SupabaseClient,
  template: StoreTemplate,
  returnTo: string
) {
  const { data, error } = await supabase
    .from("store_templates" as never)
    .select("id")
    .eq("template_key", template.id)
    .maybeSingle();

  if (error || !data) {
    redirectWithError(
      "Template storage is not ready. Apply the template studio migration before saving.",
      returnTo
    );
  }

  return data as { id: string };
}

async function upsertCustomization({
  customization,
  status,
  supabase,
  template,
  templateRecordId,
  userId
}: {
  customization: TemplateCustomizationDefaults;
  status: "draft" | "published" | "unpublished";
  supabase: SupabaseClient;
  template: StoreTemplate;
  templateRecordId: string;
  userId: string;
}) {
  return supabase.from("template_customizations" as never).upsert(
    {
      contact_info: { value: customization.contactInfo },
      customization,
      featured_products: template.demoProducts
        .filter((product) => product.featured)
        .map((product) => product.name),
      seo_placeholders: {
        description: customization.seoDescription,
        title: customization.seoTitle
      },
      social_links: customization.socialLinks,
      status,
      template_id: templateRecordId,
      user_id: userId,
      ...(status === "published"
        ? { published_at: new Date().toISOString(), unpublished_at: null }
        : status === "unpublished"
          ? { unpublished_at: new Date().toISOString() }
          : {})
    } as never,
    { onConflict: "user_id,template_id" }
  );
}

async function getOrCreatePublishedProfile(
  supabase: SupabaseClient,
  user: { id: string; email?: string },
  customization: TemplateCustomizationDefaults
) {
  const { data: profileData } = await supabase
    .from("reseller_profiles" as never)
    .select("id, slug, display_name")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileData) {
    const profile = profileData as { id: string; slug: string; display_name: string };
    await supabase
      .from("reseller_profiles" as never)
      .update({ is_published: true } as never)
      .eq("id", profile.id)
      .eq("user_id", user.id);

    return profile;
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

  return data as { id: string; slug: string; display_name: string };
}

function getActionTemplate(formData: FormData, returnTo: string) {
  const templateId = cleanText(formData.get("templateId"), 120);
  const template = templateId ? getStoreTemplate(templateId) : null;

  if (!template) {
    redirectWithError("Template could not be found.", returnTo);
  }

  return template;
}

export async function saveTemplateDraft(formData: FormData) {
  const returnTo = safeReturnPath(formData.get("returnTo"));
  const template = getActionTemplate(formData, returnTo);
  const customization = parseCustomization(formData.get("customization"), template);
  const { supabase, user } = await requireUser();
  const templateRecord = await getTemplateRecord(supabase, template, returnTo);
  const { error } = await upsertCustomization({
    customization,
    status: "draft",
    supabase,
    template,
    templateRecordId: templateRecord.id,
    userId: user.id
  });

  if (error) {
    redirectWithError("Template draft could not be saved.", returnTo);
  }

  revalidatePath(returnTo);
  redirect(withStatus(returnTo, "saved", "draft"));
}

export async function publishTemplate(formData: FormData) {
  const returnTo = safeReturnPath(formData.get("returnTo"));
  const template = getActionTemplate(formData, returnTo);
  const customization = parseCustomization(formData.get("customization"), template);
  const { supabase, user } = await requireUser();
  const templateRecord = await getTemplateRecord(supabase, template, returnTo);
  const { error: customizationError } = await upsertCustomization({
    customization,
    status: "published",
    supabase,
    template,
    templateRecordId: templateRecord.id,
    userId: user.id
  });

  if (customizationError) {
    redirectWithError("Template customization could not be published.", returnTo);
  }

  if (returnTo.startsWith("/reseller/dashboard")) {
    const profile = await getOrCreatePublishedProfile(supabase, user, customization);

    if (!profile) {
      redirectWithError("Reseller profile could not be prepared for publishing.", returnTo);
    }

    const slug = normalizeSlug(`template-${template.id}`);
    const { error: listingError } = await supabase.from("reseller_showcase_items" as never).upsert(
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
    );

    if (listingError) {
      redirectWithError("Reseller showcase listing could not be published.", returnTo);
    }

    revalidatePath("/reseller/dashboard");
    revalidatePath("/reseller/dashboard/stores");
    revalidatePath("/reseller/dashboard/templates");
    revalidatePath(`/reseller/${profile.slug}`);
  }

  revalidatePath(returnTo);
  redirect(withStatus(returnTo, "saved", "published"));
}

export async function unpublishTemplate(formData: FormData) {
  const returnTo = safeReturnPath(formData.get("returnTo"));
  const template = getActionTemplate(formData, returnTo);
  const customization = parseCustomization(formData.get("customization"), template);
  const { supabase, user } = await requireUser();
  const templateRecord = await getTemplateRecord(supabase, template, returnTo);
  const { error } = await upsertCustomization({
    customization,
    status: "unpublished",
    supabase,
    template,
    templateRecordId: templateRecord.id,
    userId: user.id
  });

  if (error) {
    redirectWithError("Template could not be unpublished.", returnTo);
  }

  if (returnTo.startsWith("/reseller/dashboard")) {
    const { data: profileData } = await supabase
      .from("reseller_profiles" as never)
      .select("id, slug")
      .eq("user_id", user.id)
      .maybeSingle();
    const profile = profileData as { id: string; slug: string } | null;

    if (profile) {
      await supabase
        .from("reseller_showcase_items" as never)
        .update({ status: "unpublished" } as never)
        .eq("profile_id", profile.id)
        .eq("slug", normalizeSlug(`template-${template.id}`))
        .eq("user_id", user.id);

      revalidatePath(`/reseller/${profile.slug}`);
    }
  }

  revalidatePath(returnTo);
  redirect(withStatus(returnTo, "saved", "unpublished"));
}

export async function duplicateTemplate(formData: FormData) {
  const returnTo = safeReturnPath(formData.get("returnTo"));
  const template = getActionTemplate(formData, returnTo);
  const customization = parseCustomization(formData.get("customization"), template);
  const { supabase, user } = await requireUser();
  const templateRecord = await getTemplateRecord(supabase, template, returnTo);
  const duplicateKey = `${template.id}-copy-${Date.now()}`;
  const { data: duplicate, error: duplicateError } = await supabase
    .from("store_templates" as never)
    .insert({
      allowed_publish_targets: template.allowedPublishTargets,
      category_key: template.categoryKey,
      category_validation_placeholder: template.protection.validationPlaceholder,
      default_customization: customization,
      demo_offers: template.demoOffers,
      demo_sections: template.demoSections,
      description: `${template.description} Customized copy.`,
      homepage_text: template.homepageText,
      is_system_template: false,
      name: `${template.name} Copy`,
      owner_user_id: user.id,
      preview_gradient: template.previewGradient,
      protected_category_key: template.categoryKey,
      source_template_id: templateRecord.id,
      status: "draft",
      template_key: duplicateKey,
      template_kind: template.kind,
      wrong_category_publish_placeholder: template.protection.wrongCategoryPublishPlaceholder
    } as never)
    .select("id")
    .single();

  if (duplicateError || !duplicate) {
    redirectWithError("Template duplicate could not be created.", returnTo);
  }

  const { error: customizationError } = await supabase
    .from("template_customizations" as never)
    .insert({
      contact_info: { value: customization.contactInfo },
      customization,
      duplicate_of_template_id: templateRecord.id,
      featured_products: template.demoProducts
        .filter((product) => product.featured)
        .map((product) => product.name),
      seo_placeholders: {
        description: customization.seoDescription,
        title: customization.seoTitle
      },
      social_links: customization.socialLinks,
      status: "draft",
      template_id: (duplicate as { id: string }).id,
      user_id: user.id
    } as never);

  if (customizationError) {
    redirectWithError("Template copy was created, but its draft settings could not be saved.", returnTo);
  }

  revalidatePath(returnTo);
  redirect(withStatus(returnTo, "saved", "duplicated"));
}

export async function restoreTemplateDefaults(formData: FormData) {
  const returnTo = safeReturnPath(formData.get("returnTo"));
  const template = getActionTemplate(formData, returnTo);
  const { supabase, user } = await requireUser();
  const templateRecord = await getTemplateRecord(supabase, template, returnTo);
  const { error } = await upsertCustomization({
    customization: template.defaultCustomization,
    status: "draft",
    supabase,
    template,
    templateRecordId: templateRecord.id,
    userId: user.id
  });

  if (error) {
    redirectWithError("Template defaults could not be restored.", returnTo);
  }

  revalidatePath(returnTo);
  redirect(withStatus(returnTo, "saved", "restored"));
}
