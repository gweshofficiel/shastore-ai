import { createClient } from "@/lib/supabase/server";
import type {
  PublicResellerShowcase,
  ResellerDashboardStoreOption,
  ResellerProfile,
  ResellerShowcaseItem,
  ShowcaseThemeSettings
} from "@/lib/reseller-showcase/types";

export type ResellerDashboardData = {
  items: ResellerShowcaseItem[];
  profile: ResellerProfile | null;
  ready: boolean;
  stores: ResellerDashboardStoreOption[];
  themeSettings: ShowcaseThemeSettings | null;
};

function isMissingResellerTable(error: { code?: string; message?: string } | null) {
  const message = (error?.message ?? "").toLowerCase();
  return (
    error?.code === "PGRST205" ||
    error?.code === "PGRST204" ||
    message.includes("reseller_") ||
    message.includes("showcase_theme_settings") ||
    message.includes("could not find the table")
  );
}

async function getDashboardUser() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  return user;
}

export async function getResellerDashboardData(): Promise<ResellerDashboardData> {
  const supabase = await createClient();
  const user = await getDashboardUser();

  if (!user) {
    return { items: [], profile: null, ready: true, stores: [], themeSettings: null };
  }

  const { data: profileData, error: profileError } = await supabase
    .from("reseller_profiles" as never)
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) {
    return {
      items: [],
      profile: null,
      ready: !isMissingResellerTable(profileError),
      stores: [],
      themeSettings: null
    };
  }

  const profile = profileData as ResellerProfile | null;
  const [itemsResult, themeResult, storesResult] = await Promise.all([
    profile
      ? supabase
          .from("reseller_showcase_items" as never)
          .select("*")
          .eq("profile_id", profile.id)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    profile
      ? supabase
          .from("showcase_theme_settings" as never)
          .select("*")
          .eq("profile_id", profile.id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("stores")
      .select("id, name, description")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
  ]);

  return {
    items: (itemsResult.data ?? []) as ResellerShowcaseItem[],
    profile,
    ready:
      !itemsResult.error &&
      !themeResult.error &&
      (!storesResult.error || !isMissingResellerTable(storesResult.error)),
    stores: (storesResult.data ?? []) as ResellerDashboardStoreOption[],
    themeSettings: (themeResult.data as ShowcaseThemeSettings | null) ?? null
  };
}

export async function getPublicResellerShowcase(
  slug: string
): Promise<PublicResellerShowcase | null> {
  const supabase = await createClient();
  const { data: profileData } = await supabase
    .from("reseller_profiles" as never)
    .select("*")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  const profile = profileData as ResellerProfile | null;

  if (!profile) {
    return null;
  }

  const [{ data: items }, { data: themeSettings }] = await Promise.all([
    supabase
      .from("reseller_showcase_items" as never)
      .select("*")
      .eq("profile_id", profile.id)
      .eq("status", "published")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false }),
    supabase
      .from("showcase_theme_settings" as never)
      .select("*")
      .eq("profile_id", profile.id)
      .maybeSingle()
  ]);

  return {
    items: (items ?? []) as ResellerShowcaseItem[],
    profile,
    themeSettings: (themeSettings as ShowcaseThemeSettings | null) ?? null
  };
}

export function resellerMigrationMessage() {
  return "Apply supabase/migrations/reseller-showcase-foundation-safe.sql to enable reseller showcase storage. The dashboard is showing safe empty states until then.";
}
