"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  assertStoreAccessInWorkspace,
  getWorkspaceDataContext
} from "@/lib/workspaces/data-access";
import { recordWorkspaceActivitySafe } from "@/lib/audit/workspace-activity";

const aboutPath = "/dashboard/about";

type AboutStatus = "draft" | "published";

type WorkspaceStoreRow = {
  id: string;
  slug?: string | null;
};

function cleanText(value: FormDataEntryValue | null, maxLength = 4000) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanOptionalText(value: FormDataEntryValue | null, maxLength = 4000) {
  const text = cleanText(value, maxLength);
  return text || null;
}

function aboutStatus(value: FormDataEntryValue | null): AboutStatus {
  return cleanText(value, 20) === "published" ? "published" : "draft";
}

function cleanGalleryImages(value: FormDataEntryValue | null) {
  const text = cleanText(value, 8000);

  if (!text) {
    return [];
  }

  return Array.from(
    new Set(
      text
        .split(/\r?\n|,/)
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 12)
    )
  );
}

function aboutRedirect(storeId: string, status: string): never {
  const params = new URLSearchParams({ about: status, storeId });
  redirect(`${aboutPath}?${params.toString()}`);
}

async function requireWorkspaceStore(formData: FormData) {
  const storeId = cleanText(formData.get("storeId"), 80);

  if (!storeId) {
    redirect(`${aboutPath}?about=missing-store`);
  }

  const { supabase, user, workspaceId } = await getWorkspaceDataContext({
    permission: "can_edit_stores",
    redirectTo: aboutPath
  });
  const access = await assertStoreAccessInWorkspace({
    permission: "can_edit_stores",
    storeId,
    supabase,
    userId: user.id,
    workspaceId
  });

  if (!access.allowed) {
    aboutRedirect(storeId, "not-authorized");
  }

  return {
    store: access.store as WorkspaceStoreRow,
    storeId,
    supabase,
    user,
    workspaceId
  };
}

function aboutPayload(formData: FormData) {
  const title = cleanText(formData.get("title"), 180);

  if (!title) {
    return null;
  }

  return {
    company_story: cleanOptionalText(formData.get("companyStory"), 12000),
    cover_image_url: cleanOptionalText(formData.get("coverImageUrl"), 1000),
    founder_message: cleanOptionalText(formData.get("founderMessage"), 8000),
    gallery_images: cleanGalleryImages(formData.get("galleryImages")),
    mission: cleanOptionalText(formData.get("mission"), 4000),
    status: aboutStatus(formData.get("status")),
    subtitle: cleanOptionalText(formData.get("subtitle"), 500),
    team_intro: cleanOptionalText(formData.get("teamIntro"), 8000),
    title,
    vision: cleanOptionalText(formData.get("vision"), 4000)
  };
}

function revalidateAboutPaths(store: WorkspaceStoreRow) {
  revalidatePath(aboutPath);

  if (store.slug) {
    revalidatePath(`/store/${store.slug}`);
    revalidatePath(`/store/${store.slug}/about`);
  }
}

export async function saveStoreAboutPage(formData: FormData) {
  const { store, storeId, supabase, user, workspaceId } = await requireWorkspaceStore(formData);
  const aboutId = cleanText(formData.get("aboutId"), 80);
  const payload = aboutPayload(formData);

  if (!payload) {
    aboutRedirect(storeId, "missing-title");
  }

  if (aboutId) {
    const { error } = await supabase
      .from("store_about_pages" as never)
      .update({
        ...payload,
        updated_at: new Date().toISOString()
      } as never)
      .eq("id" as never, aboutId as never)
      .eq("store_id" as never, storeId as never)
      .eq("workspace_id" as never, workspaceId as never);

    if (error) {
      aboutRedirect(storeId, "save-failed");
    }
  } else {
    const { error } = await supabase
      .from("store_about_pages" as never)
      .insert({
        ...payload,
        created_by: user.id,
        store_id: storeId,
        workspace_id: workspaceId
      } as never);

    if (error) {
      aboutRedirect(storeId, error.code === "23505" ? "already-exists" : "save-failed");
    }
  }

  revalidateAboutPaths(store);
  await recordWorkspaceActivitySafe({
    action: "page_updated",
    actorEmail: user.email,
    actorUserId: user.id,
    entityId: aboutId || storeId,
    entityType: "about_page",
    metadata: { status: payload.status, title: payload.title },
    storeId,
    supabase,
    workspaceId
  });
  aboutRedirect(storeId, payload.status === "published" ? "published" : "draft-saved");
}
