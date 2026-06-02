"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUserPrimaryWorkspaceId, hasPermission, type WorkspaceRole } from "@/lib/permissions/rbac";
import {
  cleanSeoText,
  cleanSeoUrl,
  defaultStoreSeoSettings,
  normalizeStoreSeoSettings,
  type SeoFallbackRule
} from "@/lib/store-seo";
import { createClient } from "@/lib/supabase/server";
import { fetchStoresForAuthUser } from "@/lib/stores/user-stores";

const seoPath = "/dashboard/seo";
const fallbackRules = new Set<SeoFallbackRule>(["existing_data", "store_defaults", "title_with_store"]);

function redirectWith(status: string, storeId?: string): never {
  const params = new URLSearchParams({ seoStatus: status });

  if (storeId) {
    params.set("storeId", storeId);
  }

  redirect(`${seoPath}?${params.toString()}`);
}

function cleanId(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim().slice(0, 80) : "";
}

function normalizeRule(value: FormDataEntryValue | null) {
  return fallbackRules.has(value as SeoFallbackRule)
    ? value as SeoFallbackRule
    : defaultStoreSeoSettings.productFallbackRule;
}

async function requireSeoStoreAccess(storeId: string) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/dashboard/seo");
  }

  const workspaceId = await getUserPrimaryWorkspaceId(supabase, user.id);
  const { data: membership } = await supabase
    .from("workspace_members" as never)
    .select("role, status, permission_overrides")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();
  const member = membership as {
    permission_overrides?: Record<string, boolean> | null;
    role?: string | null;
    status?: string | null;
  } | null;

  if (member?.status && member.status !== "active") {
    redirectWith("not-authorized", storeId);
  }

  if (!hasPermission((member?.role ?? null) as WorkspaceRole | null, "settings.edit", member?.permission_overrides ?? undefined)) {
    redirectWith("not-authorized", storeId);
  }

  const { stores } = await fetchStoresForAuthUser(supabase, user.id, workspaceId);
  const store = stores.find((item) => item.id === storeId);

  if (!store) {
    redirectWith("not-authorized", storeId);
  }

  return { store, supabase, user, workspaceId };
}

export async function saveStoreSeoSettingsAction(formData: FormData) {
  const storeId = cleanId(formData.get("storeId"));

  if (!storeId) {
    redirectWith("invalid");
  }

  const { store, supabase, workspaceId } = await requireSeoStoreAccess(storeId);
  const settings = normalizeStoreSeoSettings({
    blogFallbackRule: normalizeRule(formData.get("blogFallbackRule")),
    defaultMetaDescription: cleanSeoText(formData.get("defaultMetaDescription")),
    defaultMetaTitle: cleanSeoText(formData.get("defaultMetaTitle"), 180),
    defaultOgImageUrl: cleanSeoUrl(formData.get("defaultOgImageUrl")),
    homepageSeoDescription: cleanSeoText(formData.get("homepageSeoDescription")),
    homepageSeoTitle: cleanSeoText(formData.get("homepageSeoTitle"), 180),
    productFallbackRule: normalizeRule(formData.get("productFallbackRule"))
  });
  const { error } = await supabase
    .from("stores" as never)
    .update({
      og_image_url: settings.defaultOgImageUrl || null,
      seo_description: settings.homepageSeoDescription || settings.defaultMetaDescription || null,
      seo_settings: settings,
      seo_title: settings.homepageSeoTitle || settings.defaultMetaTitle || null
    } as never)
    .eq("id" as never, storeId as never)
    .eq("workspace_id" as never, workspaceId as never);

  if (error) {
    redirectWith("settings-failed", storeId);
  }

  revalidatePath(seoPath);
  revalidatePath(`/store/${store.slug}`);
  redirectWith("settings-saved", storeId);
}

export async function saveProductSeoOverrideAction(formData: FormData) {
  const storeId = cleanId(formData.get("storeId"));
  const productId = cleanId(formData.get("productId"));

  if (!storeId || !productId) {
    redirectWith("invalid", storeId);
  }

  const { store, supabase, workspaceId } = await requireSeoStoreAccess(storeId);
  const { data: product } = await supabase
    .from("store_products" as never)
    .select("id, slug")
    .eq("workspace_id" as never, workspaceId as never)
    .eq("store_id" as never, storeId as never)
    .eq("id" as never, productId as never)
    .maybeSingle();
  const productRow = product as { id: string; slug?: string | null } | null;

  if (!productRow) {
    redirectWith("not-authorized", storeId);
  }

  const { error } = await supabase
    .from("store_products" as never)
    .update({
      canonical_url: cleanSeoUrl(formData.get("canonicalUrl")) || null,
      noindex: formData.get("noindex") === "on",
      og_description: cleanSeoText(formData.get("ogDescription")),
      og_image_url: cleanSeoUrl(formData.get("ogImageUrl")) || null,
      og_title: cleanSeoText(formData.get("ogTitle"), 180),
      seo_description: cleanSeoText(formData.get("seoDescription")),
      seo_title: cleanSeoText(formData.get("seoTitle"), 180)
    } as never)
    .eq("id" as never, productId as never);

  if (error) {
    redirectWith("override-failed", storeId);
  }

  revalidatePath(seoPath);
  revalidatePath(`/store/${store.slug}/product/${encodeURIComponent(productRow.slug || productRow.id)}`);
  redirectWith("override-saved", storeId);
}

export async function savePageSeoOverrideAction(formData: FormData) {
  const storeId = cleanId(formData.get("storeId"));
  const pageId = cleanId(formData.get("pageId"));

  if (!storeId || !pageId) {
    redirectWith("invalid", storeId);
  }

  const { store, supabase, workspaceId } = await requireSeoStoreAccess(storeId);
  const { data: page } = await supabase
    .from("store_pages" as never)
    .select("id, slug")
    .eq("workspace_id" as never, workspaceId as never)
    .eq("store_id" as never, storeId as never)
    .eq("id" as never, pageId as never)
    .maybeSingle();
  const pageRow = page as { id: string; slug?: string | null } | null;

  if (!pageRow) {
    redirectWith("not-authorized", storeId);
  }

  const { error } = await supabase
    .from("store_pages" as never)
    .update({
      canonical_url: cleanSeoUrl(formData.get("canonicalUrl")) || null,
      noindex: formData.get("noindex") === "on",
      og_description: cleanSeoText(formData.get("ogDescription")),
      og_image_url: cleanSeoUrl(formData.get("ogImageUrl")) || null,
      og_title: cleanSeoText(formData.get("ogTitle"), 180),
      seo_description: cleanSeoText(formData.get("seoDescription")),
      seo_title: cleanSeoText(formData.get("seoTitle"), 180)
    } as never)
    .eq("id" as never, pageId as never);

  if (error) {
    redirectWith("override-failed", storeId);
  }

  revalidatePath(seoPath);
  revalidatePath(`/store/${store.slug}/pages/${encodeURIComponent(pageRow.slug || pageRow.id)}`);
  redirectWith("override-saved", storeId);
}

export async function saveBlogSeoOverrideAction(formData: FormData) {
  const storeId = cleanId(formData.get("storeId"));
  const articleId = cleanId(formData.get("articleId"));

  if (!storeId || !articleId) {
    redirectWith("invalid", storeId);
  }

  const { store, supabase, workspaceId } = await requireSeoStoreAccess(storeId);
  const { data: article } = await supabase
    .from("store_blog_articles" as never)
    .select("id, slug")
    .eq("workspace_id" as never, workspaceId as never)
    .eq("store_id" as never, storeId as never)
    .eq("id" as never, articleId as never)
    .maybeSingle();
  const articleRow = article as { id: string; slug?: string | null } | null;

  if (!articleRow) {
    redirectWith("not-authorized", storeId);
  }

  const { error } = await supabase
    .from("store_blog_articles" as never)
    .update({
      canonical_url: cleanSeoUrl(formData.get("canonicalUrl")) || null,
      noindex: formData.get("noindex") === "on",
      og_description: cleanSeoText(formData.get("ogDescription")),
      og_image_url: cleanSeoUrl(formData.get("ogImageUrl")) || null,
      og_title: cleanSeoText(formData.get("ogTitle"), 180),
      seo_description: cleanSeoText(formData.get("seoDescription")),
      seo_title: cleanSeoText(formData.get("seoTitle"), 180)
    } as never)
    .eq("id" as never, articleId as never);

  if (error) {
    redirectWith("override-failed", storeId);
  }

  revalidatePath(seoPath);
  revalidatePath(`/store/${store.slug}/blog/${encodeURIComponent(articleRow.slug || articleRow.id)}`);
  redirectWith("override-saved", storeId);
}
