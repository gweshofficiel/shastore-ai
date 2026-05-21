import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { normalizeLandingThemeSettings } from "@/lib/landing-theme";
import { createClient } from "@/lib/supabase/server";
import { createFallbackCopy } from "@/templates/engine";
import { LandingTemplateRenderer } from "@/templates/renderer";
import type {
  AiLandingCopy,
  PaymentMethod,
  PublishedLanding,
  TemplateId
} from "@/types/landing";

function normalizeTemplateId(templateId: string): TemplateId {
  const supported = [
    "minimal",
    "luxury",
    "beauty",
    "gadget",
    "fashion",
    "saas",
    "local-business",
    "minimal-product"
  ];

  if (templateId === "minimal-product") {
    return "minimal";
  }

  return supported.includes(templateId) ? (templateId as TemplateId) : "minimal";
}

function normalizeBuyerPaymentMethods(methods: PaymentMethod[] | undefined): PaymentMethod[] {
  const supported = (methods ?? []).filter(
    (method) => method === "whatsapp" || method === "cod"
  );

  return supported.length ? supported : ["whatsapp"];
}

function normalizeCopy(copy: unknown, productName: string, productPrice: string): AiLandingCopy {
  const parsed = copy as Partial<AiLandingCopy> | null;
  const fallbackCopy = createFallbackCopy(productName);

  return {
    productTitle: parsed?.productTitle ?? fallbackCopy.productTitle,
    headline: parsed?.headline ?? fallbackCopy.headline,
    subheadline: parsed?.subheadline ?? fallbackCopy.subheadline,
    description: parsed?.description ?? fallbackCopy.description,
    productCopy: parsed?.productCopy ?? fallbackCopy.productCopy,
    seoTitle: parsed?.seoTitle ?? fallbackCopy.seoTitle,
    seoDescription: parsed?.seoDescription ?? fallbackCopy.seoDescription,
    benefits: parsed?.benefits?.length ? parsed.benefits : fallbackCopy.benefits,
    features: parsed?.features?.length ? parsed.features : fallbackCopy.features,
    testimonials: parsed?.testimonials?.length
      ? parsed.testimonials
      : fallbackCopy.testimonials,
    pricing: parsed?.pricing ?? {
      ...fallbackCopy.pricing,
      price: productPrice
    },
    sections: parsed?.sections?.length ? parsed.sections : fallbackCopy.sections,
    ctaText: parsed?.ctaText ?? fallbackCopy.ctaText,
    ctaBlock: parsed?.ctaBlock ?? fallbackCopy.ctaBlock,
    faq: parsed?.faq?.length ? parsed.faq : fallbackCopy.faq
  };
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: landing } = await supabase
    .from("landing_pages")
    .select("product_name, product_price, product_description, ai_copy, hero_image_url")
    .eq("slug", slug)
    .maybeSingle();

  if (!landing) {
    return {};
  }

  const copy = normalizeCopy(
    landing.ai_copy,
    landing.product_name,
    landing.product_price
  );

  return {
    title: copy.seoTitle || landing.product_name,
    description: copy.seoDescription || landing.product_description,
    openGraph: {
      title: copy.seoTitle || landing.product_name,
      description: copy.seoDescription || landing.product_description,
      images: landing.hero_image_url ? [landing.hero_image_url] : undefined
    }
  };
}

export default async function PublicLandingPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: landing } = await supabase
    .from("landing_pages")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!landing) {
    notFound();
  }

  if (landing.status !== "published") {
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user || user.id !== landing.user_id) {
      notFound();
    }
  }

  const { data: storedImages } = await supabase
    .from("product_images")
    .select("public_url, image_type, sort_order")
    .eq("landing_page_id", landing.id)
    .order("sort_order", { ascending: true });

  const heroFromStorage =
    storedImages?.find((image) => image.image_type === "hero")?.public_url ?? null;
  const galleryFromStorage =
    storedImages
      ?.filter((image) => image.image_type === "gallery")
      .map((image) => image.public_url) ?? [];

  const aiPayload = landing.ai_copy as AiLandingCopy & {
    paymentMethods?: PaymentMethod[];
    comparePrice?: string;
    galleryImages?: string[];
  };
  const hasThemeSettings = Boolean(aiPayload.themeSettings);
  const themeSettings = normalizeLandingThemeSettings(aiPayload.themeSettings);

  const galleryImages = aiPayload.galleryImages?.length
    ? aiPayload.galleryImages
    : galleryFromStorage;
  const normalizedCopy = normalizeCopy(
    landing.ai_copy,
    landing.product_name,
    landing.product_price
  );

  const publishedLanding: PublishedLanding = {
    id: landing.id,
    templateId: normalizeTemplateId(landing.template_id),
    slug: landing.slug,
    productName: landing.product_name,
    productPrice: landing.product_price,
    comparePrice: aiPayload.comparePrice,
    productDescription: landing.product_description,
    whatsappNumber: landing.whatsapp_number,
    brandColor: landing.brand_color,
    heroImage: landing.hero_image_url ?? heroFromStorage ?? undefined,
    galleryImages,
    paymentMethods: normalizeBuyerPaymentMethods(aiPayload.paymentMethods),
    themeSettings,
    copy: {
      ...normalizedCopy,
      headline: themeSettings.heroTitle || normalizedCopy.headline,
      ctaText: hasThemeSettings ? themeSettings.ctaText : normalizedCopy.ctaText
    }
  };

  return <LandingTemplateRenderer landing={publishedLanding} />;
}
