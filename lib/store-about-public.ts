import { getPublicStorefrontAccess } from "@/lib/billing/publish-access";
import { getPublicStorefrontPreview } from "@/lib/public-storefront-preview";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type PublicStoreAboutPage = {
  companyStory: string | null;
  coverImageUrl: string | null;
  founderMessage: string | null;
  galleryImages: string[];
  id: string;
  mission: string | null;
  status: "draft" | "published";
  subtitle: string | null;
  teamIntro: string | null;
  title: string;
  vision: string | null;
};

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function galleryImages(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function normalizeAboutPage(value: unknown): PublicStoreAboutPage | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = stringValue(record.id);
  const title = stringValue(record.title);
  const status = record.status === "published" ? "published" : "draft";

  if (!id || !title) {
    return null;
  }

  return {
    companyStory: stringValue(record.company_story),
    coverImageUrl: stringValue(record.cover_image_url),
    founderMessage: stringValue(record.founder_message),
    galleryImages: galleryImages(record.gallery_images),
    id,
    mission: stringValue(record.mission),
    status,
    subtitle: stringValue(record.subtitle),
    teamIntro: stringValue(record.team_intro),
    title,
    vision: stringValue(record.vision)
  };
}

export async function loadPublishedStoreAboutForStore(storeId: string) {
  const admin = createAdminClient();
  const readClient = admin ?? (await createClient());
  const { data } = await readClient
    .from("store_about_pages" as never)
    .select("id, title, subtitle, company_story, mission, vision, founder_message, team_intro, cover_image_url, gallery_images, status")
    .eq("store_id" as never, storeId as never)
    .eq("status" as never, "published" as never)
    .maybeSingle();

  return normalizeAboutPage(data);
}

export async function loadPublicStoreAbout(slug: string) {
  const preview = await getPublicStorefrontPreview(slug);

  if (!preview) {
    return { about: null, preview: null };
  }

  const admin = createAdminClient();
  const storefrontAccess = admin
    ? await getPublicStorefrontAccess({
        storeId: preview.store.id,
        supabase: admin
      })
    : { allowed: true };

  if (!storefrontAccess.allowed) {
    return { about: null, preview };
  }

  return {
    about: await loadPublishedStoreAboutForStore(preview.store.id),
    preview
  };
}
