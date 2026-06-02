"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  defaultStoreHomepageSections,
  storeHomepageSectionOptions,
  type StoreHomepageSectionType
} from "@/lib/store-homepage-sections";
import {
  assertStoreAccessInWorkspace,
  getWorkspaceDataContext
} from "@/lib/workspaces/data-access";
import { recordWorkspaceActivitySafe } from "@/lib/audit/workspace-activity";

const homepagePath = "/dashboard/homepage";

type WorkspaceStoreRow = {
  id: string;
  owner_user_id?: string | null;
  slug?: string | null;
};

function cleanText(value: FormDataEntryValue | null, maxLength = 4000) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanOptionalText(value: FormDataEntryValue | null, maxLength = 4000) {
  const text = cleanText(value, maxLength);
  return text || null;
}

function cleanSortOrder(value: FormDataEntryValue | null, fallback: number) {
  const parsed = Number(cleanText(value, 20));
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function homepageRedirect(storeId: string, status: string): never {
  const params = new URLSearchParams({ homepage: status, storeId });
  redirect(`${homepagePath}?${params.toString()}`);
}

function isStoreManager({
  role,
  store,
  userId
}: {
  role: string | null;
  store: WorkspaceStoreRow;
  userId: string;
}) {
  return store.owner_user_id === userId || role === "owner" || role === "admin";
}

async function requireWorkspaceStore(formData: FormData) {
  const storeId = cleanText(formData.get("storeId"), 80);

  if (!storeId) {
    redirect(`${homepagePath}?homepage=missing-store`);
  }

  const { role, supabase, user, workspaceId } = await getWorkspaceDataContext({
    permission: "can_edit_stores",
    redirectTo: homepagePath
  });
  const access = await assertStoreAccessInWorkspace({
    permission: "can_edit_stores",
    storeId,
    supabase,
    userId: user.id,
    workspaceId
  });

  if (!access.allowed) {
    homepageRedirect(storeId, "not-authorized");
  }

  const store = access.store as WorkspaceStoreRow;

  if (!isStoreManager({ role, store, userId: user.id })) {
    homepageRedirect(storeId, "not-authorized");
  }

  return {
    store,
    storeId,
    supabase,
    user,
    workspaceId
  };
}

function fallbackFor(sectionType: StoreHomepageSectionType) {
  return defaultStoreHomepageSections.find((section) => section.sectionType === sectionType);
}

function sectionPayload(formData: FormData, sectionType: StoreHomepageSectionType) {
  const fallback = fallbackFor(sectionType);
  const title =
    cleanOptionalText(formData.get(`${sectionType}.title`), 180) ?? fallback?.title ?? null;
  const subtitle =
    cleanOptionalText(formData.get(`${sectionType}.subtitle`), 500) ??
    fallback?.subtitle ??
    null;

  return {
    enabled: formData.get(`${sectionType}.enabled`) === "on",
    section_type: sectionType,
    settings: fallback?.settings ?? {},
    sort_order: cleanSortOrder(
      formData.get(`${sectionType}.sortOrder`),
      fallback?.sortOrder ?? 0
    ),
    subtitle,
    title,
    updated_at: new Date().toISOString()
  };
}

function revalidateHomepagePaths(store: WorkspaceStoreRow) {
  revalidatePath(homepagePath);

  if (store.slug) {
    revalidatePath(`/store/${store.slug}`);
  }
}

export async function saveStoreHomepageSections(formData: FormData) {
  const { store, storeId, supabase, user, workspaceId } = await requireWorkspaceStore(formData);
  const rows = storeHomepageSectionOptions.map((option) => ({
    ...sectionPayload(formData, option.sectionType),
    store_id: storeId,
    workspace_id: workspaceId
  }));

  const { error } = await supabase
    .from("store_homepage_sections" as never)
    .upsert(rows as never, { onConflict: "store_id,section_type" });

  if (error) {
    homepageRedirect(storeId, "save-failed");
  }

  revalidateHomepagePaths(store);
  await recordWorkspaceActivitySafe({
    action: "homepage_updated",
    actorEmail: user.email,
    actorUserId: user.id,
    entityId: storeId,
    entityType: "homepage",
    metadata: {
      enabledSections: rows.filter((row) => row.enabled).length,
      sectionCount: rows.length
    },
    storeId,
    supabase,
    workspaceId
  });
  homepageRedirect(storeId, "saved");
}
