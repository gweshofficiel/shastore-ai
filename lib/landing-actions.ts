"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { parseLandingThemeSettings } from "@/lib/landing-theme";
import { getUserSubscriptionAccess } from "@/lib/billing/access";
import {
  assertUsageWithinLimits,
  billingEnforcementMessage
} from "@/lib/billing/enforcement";
import { createClient } from "@/lib/supabase/server";
import { createFallbackCopy } from "@/templates/engine";
import { landingTemplates } from "@/templates/registry";
import type { AiLandingCopy, PaymentMethod, TemplateId } from "@/types/landing";

function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

  return slug || "product";
}

function redirectLandingCreateError(message: string): never {
  const params = new URLSearchParams({
    error: "limit-reached",
    detail: message
  });

  redirect(`/dashboard/landings/new?${params.toString()}`);
}

function parseCopy(
  value: FormDataEntryValue | null,
  productName: string,
  overrides?: {
    seoTitle?: string;
    seoDescription?: string;
    ctaText?: string;
    longDescription?: string;
  }
): AiLandingCopy {
  const fallback = createFallbackCopy(productName);
  let copy = fallback;

  if (value && typeof value === "string") {
    copy = { ...fallback, ...JSON.parse(value) } as AiLandingCopy;
  }

  if (overrides?.seoTitle) {
    copy.seoTitle = overrides.seoTitle;
  }
  if (overrides?.seoDescription) {
    copy.seoDescription = overrides.seoDescription;
  }
  if (overrides?.ctaText) {
    copy.ctaText = overrides.ctaText;
  }
  if (overrides?.longDescription) {
    copy.description = overrides.longDescription;
    copy.productCopy = overrides.longDescription;
  }

  return copy;
}

function parsePaymentMethods(value: FormDataEntryValue | null): PaymentMethod[] {
  if (!value || typeof value !== "string") {
    return ["whatsapp"];
  }

  try {
    return JSON.parse(value) as PaymentMethod[];
  } catch {
    return ["whatsapp"];
  }
}

function getGalleryFiles(formData: FormData) {
  return formData
    .getAll("galleryImages")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);
}

async function uploadImages(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  landingId: string,
  heroImage: FormDataEntryValue | null,
  galleryFiles: File[]
) {
  const uploaded: Array<{
    storage_path: string;
    public_url: string;
    image_type: string;
    sort_order: number;
  }> = [];

  if (heroImage instanceof File && heroImage.size > 0) {
    const extension = heroImage.name.split(".").pop() ?? "jpg";
    const storagePath = `${userId}/${landingId}/hero.${extension}`;
    const { error } = await supabase.storage
      .from("product-images")
      .upload(storagePath, heroImage, { cacheControl: "31536000", upsert: true });

    if (error) {
      throw error;
    }

    const { data: publicUrlData } = supabase.storage
      .from("product-images")
      .getPublicUrl(storagePath);
    const publicUrl = publicUrlData.publicUrl?.trim();
    if (!publicUrl) {
      throw new Error("Unable to resolve hero image URL");
    }

    uploaded.push({
      storage_path: storagePath,
      public_url: publicUrl,
      image_type: "hero",
      sort_order: 0
    });
  }

  for (let index = 0; index < galleryFiles.length; index += 1) {
    const file = galleryFiles[index];
    const extension = file.name.split(".").pop() ?? "jpg";
    const storagePath = `${userId}/${landingId}/gallery-${index + 1}.${extension}`;
    const { error } = await supabase.storage
      .from("product-images")
      .upload(storagePath, file, { cacheControl: "31536000", upsert: true });

    if (error) {
      throw error;
    }

    const { data: publicUrlData } = supabase.storage
      .from("product-images")
      .getPublicUrl(storagePath);
    const publicUrl = publicUrlData.publicUrl?.trim();
    if (!publicUrl) {
      throw new Error("Unable to resolve gallery image URL");
    }

    uploaded.push({
      storage_path: storagePath,
      public_url: publicUrl,
      image_type: "gallery",
      sort_order: index + 1
    });
  }

  return uploaded;
}

export async function publishLandingPage(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const access = await getUserSubscriptionAccess(user.id);
  try {
    assertUsageWithinLimits(access, "landings");
  } catch (error) {
    redirectLandingCreateError(
      billingEnforcementMessage(error) ??
        "Your current plan has reached its landing page limit. Upgrade at /dashboard/billing."
    );
  }

  const productName = String(formData.get("productName") ?? "");
  const productPrice = String(formData.get("productPrice") ?? "");
  const comparePrice = String(formData.get("comparePrice") ?? "");
  const productDescription = String(formData.get("productDescription") ?? "");
  const longDescription = String(formData.get("longDescription") ?? "");
  const whatsappNumber = String(formData.get("whatsappNumber") ?? "");
  const brandColor = String(formData.get("brandColor") ?? "#0f172a");
  const ctaText = String(formData.get("ctaText") ?? "Order on WhatsApp");
  const seoTitle = String(formData.get("seoTitle") ?? "");
  const seoDescription = String(formData.get("seoDescription") ?? "");
  const templateId = String(formData.get("templateId") ?? "minimal");
  const publishMode = String(formData.get("publishMode") ?? "publish");
  const paymentMethods = parsePaymentMethods(formData.get("paymentMethods"));
  const themeSettings = parseLandingThemeSettings(formData.get("themeSettings"));

  const selectedTemplate = landingTemplates.find((template) => template.id === templateId);

  if (!selectedTemplate) {
    throw new Error("Invalid template selected");
  }

  const landingId = crypto.randomUUID();
  const slug = `${slugify(productName)}-${landingId.slice(0, 8)}`;
  const status = publishMode === "draft" ? "draft" : "published";
  const aiCopy = parseCopy(formData.get("aiCopy"), productName, {
    seoTitle,
    seoDescription,
    ctaText,
    longDescription
  });

  if (comparePrice) {
    aiCopy.pricing = {
      ...aiCopy.pricing,
      price: productPrice,
      note: `Compare at ${comparePrice}`
    };
  }

  const uploads = await uploadImages(
    supabase,
    user.id,
    landingId,
    formData.get("heroImage"),
    getGalleryFiles(formData)
  );

  const heroImageUrl =
    uploads.find((image) => image.image_type === "hero")?.public_url ?? null;
  const galleryUrls = uploads
    .filter((image) => image.image_type === "gallery")
    .map((image) => image.public_url);

  await supabase.from("products").insert({
    id: landingId,
    user_id: user.id,
    name: productName,
    short_description: productDescription,
    long_description: longDescription || null,
    price: productPrice,
    compare_price: comparePrice || null
  });

  const { error } = await supabase.from("landing_pages").insert({
    id: landingId,
    user_id: user.id,
    template_id: selectedTemplate.id as TemplateId,
    slug,
    status,
    product_name: productName,
    product_price: productPrice,
    product_description: productDescription,
    whatsapp_number: whatsappNumber,
    brand_color: brandColor,
    hero_image_url: heroImageUrl,
    ai_copy: {
      ...aiCopy,
      paymentMethods,
      comparePrice,
      galleryImages: galleryUrls,
      themeSettings
    },
    published_at: status === "published" ? new Date().toISOString() : null
  });

  if (error) {
    throw error;
  }

  await supabase.from("landing_settings").insert({
    landing_page_id: landingId,
    user_id: user.id,
    cta_text: ctaText,
    brand_color: brandColor,
    whatsapp_number: whatsappNumber
  });

  for (const method of paymentMethods) {
    await supabase.from("landing_payment_methods").insert({
      landing_page_id: landingId,
      user_id: user.id,
      method,
      enabled: true
    });
  }

  await supabase.from("landings").insert({
    user_id: user.id,
    landing_page_id: landingId,
    title: productName,
    status: status === "published" ? "published" : "draft"
  });

  await supabase.from("publications").insert({
    user_id: user.id,
    landing_page_id: landingId,
    url: `/l/${slug}`,
    status: status === "published" ? "published" : "draft",
    published_at: status === "published" ? new Date().toISOString() : null
  });

  await supabase.from("usage_events").insert({
    user_id: user.id,
    event_type: status === "published" ? "landing_published" : "landing_drafted",
    quantity: 1,
    metadata: {
      landing_page_id: landingId,
      template_id: selectedTemplate.id
    }
  });

  for (const upload of uploads) {
    await supabase.from("product_images").insert({
      landing_page_id: landingId,
      user_id: user.id,
      storage_path: upload.storage_path,
      public_url: upload.public_url,
      image_type: upload.image_type,
      sort_order: upload.sort_order
    });
  }

  if (status === "published") {
    revalidatePath("/dashboard/landings");
    redirect(`/dashboard/landings?published=${slug}`);
  }

  revalidatePath("/dashboard/landings");
  redirect(`/dashboard/landings?draft=${slug}`);
}

export async function updateLandingPage(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const landingId = String(formData.get("landingId") ?? "");
  const productName = String(formData.get("productName") ?? "");
  const productPrice = String(formData.get("productPrice") ?? "");
  const comparePrice = String(formData.get("comparePrice") ?? "");
  const productDescription = String(formData.get("productDescription") ?? "");
  const longDescription = String(formData.get("longDescription") ?? "");
  const whatsappNumber = String(formData.get("whatsappNumber") ?? "");
  const brandColor = String(formData.get("brandColor") ?? "#0f172a");
  const ctaText = String(formData.get("ctaText") ?? "Order on WhatsApp");
  const seoTitle = String(formData.get("seoTitle") ?? "");
  const seoDescription = String(formData.get("seoDescription") ?? "");
  const templateId = String(formData.get("templateId") ?? "minimal");
  const publishMode = String(formData.get("publishMode") ?? "publish");
  const paymentMethods = parsePaymentMethods(formData.get("paymentMethods"));
  const themeSettings = parseLandingThemeSettings(formData.get("themeSettings"));
  const selectedTemplate = landingTemplates.find((template) => template.id === templateId);

  if (!landingId || !selectedTemplate) {
    throw new Error("Landing page not found");
  }

  const { data: existingLanding, error: existingError } = await supabase
    .from("landing_pages")
    .select("id, slug, ai_copy")
    .eq("id", landingId)
    .eq("user_id", user.id)
    .single();

  if (existingError || !existingLanding) {
    throw existingError ?? new Error("Landing page not found");
  }

  const status = publishMode === "draft" ? "draft" : "published";
  const publishedAt = status === "published" ? new Date().toISOString() : null;
  const currentCopy = existingLanding.ai_copy as AiLandingCopy & {
    galleryImages?: string[];
  };
  const aiCopy = parseCopy(formData.get("aiCopy"), productName, {
    seoTitle,
    seoDescription,
    ctaText,
    longDescription
  });
  const uploads = await uploadImages(
    supabase,
    user.id,
    landingId,
    formData.get("heroImage"),
    getGalleryFiles(formData)
  );
  const heroImageUrl =
    uploads.find((image) => image.image_type === "hero")?.public_url ?? undefined;
  const uploadedGalleryUrls = uploads
    .filter((image) => image.image_type === "gallery")
    .map((image) => image.public_url);
  const galleryImages = uploadedGalleryUrls.length
    ? [...(currentCopy.galleryImages ?? []), ...uploadedGalleryUrls]
    : currentCopy.galleryImages ?? [];

  if (comparePrice) {
    aiCopy.pricing = {
      ...aiCopy.pricing,
      price: productPrice,
      note: `Compare at ${comparePrice}`
    };
  }

  const { error } = await supabase
    .from("landing_pages")
    .update({
      template_id: selectedTemplate.id as TemplateId,
      status,
      product_name: productName,
      product_price: productPrice,
      product_description: productDescription,
      whatsapp_number: whatsappNumber,
      brand_color: brandColor,
      ...(heroImageUrl ? { hero_image_url: heroImageUrl } : {}),
      ai_copy: {
        ...aiCopy,
        paymentMethods,
        comparePrice,
        galleryImages,
        themeSettings
      },
      published_at: publishedAt
    })
    .eq("id", landingId)
    .eq("user_id", user.id);

  if (error) {
    throw error;
  }

  await supabase
    .from("products")
    .update({
      name: productName,
      short_description: productDescription,
      long_description: longDescription || null,
      price: productPrice,
      compare_price: comparePrice || null
    })
    .eq("id", landingId)
    .eq("user_id", user.id);

  await supabase
    .from("landing_settings")
    .update({
      cta_text: ctaText,
      brand_color: brandColor,
      whatsapp_number: whatsappNumber
    })
    .eq("landing_page_id", landingId)
    .eq("user_id", user.id);

  await supabase
    .from("landing_payment_methods")
    .delete()
    .eq("landing_page_id", landingId)
    .eq("user_id", user.id);

  for (const method of paymentMethods) {
    await supabase.from("landing_payment_methods").insert({
      landing_page_id: landingId,
      user_id: user.id,
      method,
      enabled: true
    });
  }

  await supabase
    .from("landings")
    .update({ title: productName, status })
    .eq("landing_page_id", landingId)
    .eq("user_id", user.id);

  const { data: publication } = await supabase
    .from("publications")
    .select("id")
    .eq("landing_page_id", landingId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (publication) {
    await supabase
      .from("publications")
      .update({
        url: `/l/${existingLanding.slug}`,
        status,
        published_at: publishedAt
      })
      .eq("id", publication.id)
      .eq("user_id", user.id);
  } else {
    await supabase.from("publications").insert({
      user_id: user.id,
      landing_page_id: landingId,
      url: `/l/${existingLanding.slug}`,
      status,
      published_at: publishedAt
    });
  }

  for (const upload of uploads) {
    await supabase.from("product_images").insert({
      landing_page_id: landingId,
      user_id: user.id,
      storage_path: upload.storage_path,
      public_url: upload.public_url,
      image_type: upload.image_type,
      sort_order: upload.sort_order
    });
  }

  revalidatePath("/dashboard/landings");
  revalidatePath(`/l/${existingLanding.slug}`);

  if (status === "published") {
    redirect(`/dashboard/landings?published=${existingLanding.slug}`);
  }

  redirect(`/dashboard/landings?draft=${existingLanding.slug}`);
}

export async function publishLandingPageById(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const landingId = String(formData.get("landingId") ?? "");
  const publishedAt = new Date().toISOString();

  const { data: landing, error: landingError } = await supabase
    .from("landing_pages")
    .update({
      status: "published",
      published_at: publishedAt
    })
    .eq("id", landingId)
    .eq("user_id", user.id)
    .select("id, slug")
    .single();

  if (landingError || !landing) {
    throw landingError ?? new Error("Landing page not found");
  }

  await supabase
    .from("landings")
    .update({
      status: "published"
    })
    .eq("landing_page_id", landing.id)
    .eq("user_id", user.id);

  const { data: publication } = await supabase
    .from("publications")
    .select("id")
    .eq("landing_page_id", landing.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (publication) {
    await supabase
      .from("publications")
      .update({
        url: `/l/${landing.slug}`,
        status: "published",
        published_at: publishedAt
      })
      .eq("id", publication.id)
      .eq("user_id", user.id);
  } else {
    await supabase.from("publications").insert({
      user_id: user.id,
      landing_page_id: landing.id,
      url: `/l/${landing.slug}`,
      status: "published",
      published_at: publishedAt
    });
  }

  await supabase.from("usage_events").insert({
    user_id: user.id,
    event_type: "landing_published",
    quantity: 1,
    metadata: {
      landing_page_id: landing.id
    }
  });

  revalidatePath("/dashboard/landings");
  revalidatePath(`/l/${landing.slug}`);
  redirect(`/dashboard/landings?published=${landing.slug}`);
}
