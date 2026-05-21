import type { Json } from "@/types/database";
import type { ResellerShowcaseThemeId } from "@/lib/reseller-showcase/themes";

export type ResellerProfile = {
  id: string;
  user_id: string;
  slug: string;
  display_name: string;
  logo_url: string | null;
  banner_url: string | null;
  bio: string | null;
  website_url: string | null;
  instagram_url: string | null;
  tiktok_url: string | null;
  theme_id: ResellerShowcaseThemeId;
  primary_color: string;
  accent_color: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

export type ShowcaseThemeSettings = {
  id: string;
  user_id: string;
  profile_id: string;
  theme_id: ResellerShowcaseThemeId;
  settings: Json;
  created_at: string;
  updated_at: string;
};

export type ResellerShowcaseItemStatus = "draft" | "published" | "unpublished";

export type ResellerShowcaseItem = {
  id: string;
  user_id: string;
  profile_id: string;
  source_store_id: string | null;
  slug: string;
  title: string;
  status: ResellerShowcaseItemStatus;
  thumbnail_url: string | null;
  preview_images: Json;
  category: string | null;
  price_label: string | null;
  description: string | null;
  features: Json;
  demo_url: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type ResellerDashboardStoreOption = {
  id: string;
  name: string;
  description: string | null;
};

export type PublicResellerShowcase = {
  items: ResellerShowcaseItem[];
  profile: ResellerProfile;
  themeSettings: ShowcaseThemeSettings | null;
};
