import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

export type StoreHomepageSectionType =
  | "hero"
  | "featured_products"
  | "featured_categories"
  | "featured_collection"
  | "about_preview"
  | "testimonials"
  | "newsletter"
  | "faq_preview"
  | "blog_preview";

export type StoreHomepageSection = {
  enabled: boolean;
  id: string;
  sectionType: StoreHomepageSectionType;
  settings: Record<string, unknown>;
  sortOrder: number;
  subtitle: string | null;
  title: string | null;
};

type StoreHomepageSectionRow = {
  enabled: boolean | null;
  id: string;
  section_type: string | null;
  settings: unknown;
  sort_order: number | null;
  subtitle: string | null;
  title: string | null;
};

export const storeHomepageSectionOptions: Array<{
  defaultSubtitle: string;
  defaultTitle: string;
  label: string;
  sectionType: StoreHomepageSectionType;
}> = [
  {
    defaultSubtitle: "Welcome customers with your storefront headline and latest offer.",
    defaultTitle: "Welcome to our store",
    label: "Hero",
    sectionType: "hero"
  },
  {
    defaultSubtitle: "Show live products from this store.",
    defaultTitle: "Featured products",
    label: "Featured Products",
    sectionType: "featured_products"
  },
  {
    defaultSubtitle: "Help customers browse your main product categories.",
    defaultTitle: "Featured categories",
    label: "Featured Categories",
    sectionType: "featured_categories"
  },
  {
    defaultSubtitle: "Highlight one collection from this store.",
    defaultTitle: "Featured collection",
    label: "Featured Collection",
    sectionType: "featured_collection"
  },
  {
    defaultSubtitle: "Share a short introduction and link to the full About page.",
    defaultTitle: "About our store",
    label: "About Preview",
    sectionType: "about_preview"
  },
  {
    defaultSubtitle: "Build trust with a few customer quotes.",
    defaultTitle: "What customers say",
    label: "Testimonials",
    sectionType: "testimonials"
  },
  {
    defaultSubtitle: "Invite customers to stay connected.",
    defaultTitle: "Join our newsletter",
    label: "Newsletter",
    sectionType: "newsletter"
  },
  {
    defaultSubtitle: "Answer common customer questions.",
    defaultTitle: "Frequently asked questions",
    label: "FAQ Preview",
    sectionType: "faq_preview"
  },
  {
    defaultSubtitle: "Show your latest published articles.",
    defaultTitle: "Latest articles",
    label: "Blog Preview",
    sectionType: "blog_preview"
  }
];

export const defaultStoreHomepageSections = storeHomepageSectionOptions.map(
  (option, index) => ({
    enabled: true,
    sectionType: option.sectionType,
    settings: {},
    sortOrder: (index + 1) * 10,
    subtitle: option.defaultSubtitle,
    title: option.defaultTitle
  })
);

function isHomepageSectionType(value: string | null): value is StoreHomepageSectionType {
  return storeHomepageSectionOptions.some((option) => option.sectionType === value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeSection(row: StoreHomepageSectionRow): StoreHomepageSection | null {
  if (!isHomepageSectionType(row.section_type)) {
    return null;
  }

  const fallback = storeHomepageSectionOptions.find(
    (option) => option.sectionType === row.section_type
  );

  return {
    enabled: row.enabled ?? true,
    id: row.id,
    sectionType: row.section_type,
    settings: isRecord(row.settings) ? row.settings : {},
    sortOrder: typeof row.sort_order === "number" ? row.sort_order : 0,
    subtitle: row.subtitle || fallback?.defaultSubtitle || null,
    title: row.title || fallback?.defaultTitle || null
  };
}

function sortSections(sections: StoreHomepageSection[]) {
  return [...sections].sort((left, right) => left.sortOrder - right.sortOrder);
}

export function normalizeStoreHomepageSections(rows: unknown[]): StoreHomepageSection[] {
  return sortSections(
    rows
      .map((row) => normalizeSection(row as StoreHomepageSectionRow))
      .filter((section): section is StoreHomepageSection => Boolean(section))
  );
}

async function resolveStoreWorkspaceId(supabase: SupabaseClient, storeId: string) {
  const { data } = await supabase
    .from("stores" as never)
    .select("workspace_id")
    .eq("id" as never, storeId as never)
    .maybeSingle();
  const store = data as { workspace_id?: string | null } | null;

  return store?.workspace_id ?? null;
}

async function insertDefaultSections({
  storeId,
  supabase,
  workspaceId
}: {
  storeId: string;
  supabase: SupabaseClient;
  workspaceId: string;
}) {
  const rows = defaultStoreHomepageSections.map((section) => ({
    enabled: section.enabled,
    section_type: section.sectionType,
    settings: section.settings,
    sort_order: section.sortOrder,
    store_id: storeId,
    subtitle: section.subtitle,
    title: section.title,
    workspace_id: workspaceId
  }));

  const { data, error } = await supabase
    .from("store_homepage_sections" as never)
    .upsert(rows as never, { onConflict: "store_id,section_type" })
    .select("id, section_type, title, subtitle, enabled, sort_order, settings")
    .eq("store_id" as never, storeId as never)
    .order("sort_order" as never, { ascending: true } as never);

  if (error || !Array.isArray(data)) {
    return [];
  }

  return normalizeStoreHomepageSections(data as unknown[]);
}

export async function loadOrCreateStoreHomepageSections({
  storeId,
  supabase,
  workspaceId
}: {
  storeId: string;
  supabase?: SupabaseClient;
  workspaceId?: string | null;
}) {
  const readClient = supabase ?? createAdminClient();

  if (!readClient) {
    return [];
  }

  const { data, error } = await readClient
    .from("store_homepage_sections" as never)
    .select("id, section_type, title, subtitle, enabled, sort_order, settings")
    .eq("store_id" as never, storeId as never)
    .order("sort_order" as never, { ascending: true } as never)
    .order("created_at" as never, { ascending: true } as never);

  if (error) {
    return [];
  }

  const sections = normalizeStoreHomepageSections((data ?? []) as unknown[]);

  if (sections.length) {
    return sections;
  }

  const resolvedWorkspaceId = workspaceId ?? (await resolveStoreWorkspaceId(readClient, storeId));

  if (!resolvedWorkspaceId) {
    return [];
  }

  return insertDefaultSections({
    storeId,
    supabase: readClient,
    workspaceId: resolvedWorkspaceId
  });
}
