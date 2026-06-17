"use server";

import { revalidatePath } from "next/cache";
import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { setTemplateVisibility as updateTemplateRegistryVisibility } from "@/src/lib/templates/template-visibility";
import {
  activateTemplate as activateRegistryTemplate,
  markTemplateDraft as markRegistryTemplateDraft
} from "@/src/lib/templates/template-activation";
import {
  archiveTemplateSafely,
  restoreArchivedTemplateToDraft as restoreArchivedRegistryTemplate
} from "@/src/lib/templates/template-archive";
import {
  markTemplateOfficial as markRegistryTemplateOfficial,
  unmarkTemplateOfficial as unmarkRegistryTemplateOfficial
} from "@/src/lib/templates/template-official";
import {
  recommendTemplate as recommendRegistryTemplate,
  unrecommendTemplate as unrecommendRegistryTemplate,
  updateRecommendationOrder as updateRegistryRecommendationOrder
} from "@/src/lib/templates/template-recommendation";
import { updateTemplatePackageMetadata } from "@/src/lib/templates/template-package-runtime";

type TemplateAdminAction =
  | "admin_template_activate"
  | "admin_template_archive"
  | "admin_template_install_version"
  | "admin_template_mark_draft"
  | "admin_template_mark_official"
  | "admin_template_mark_recommended"
  | "admin_template_package_summary_updated"
  | "admin_template_package_summary_viewed"
  | "admin_template_preview"
  | "admin_template_publish_update"
  | "admin_template_restore_archived"
  | "admin_template_set_visibility"
  | "admin_template_unmark_official"
  | "admin_template_unrecommend"
  | "admin_template_update_recommendation_order"
  | "admin_template_update_stores";

function cleanText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

async function recordTemplateAdminAction(formData: FormData, action: TemplateAdminAction) {
  const access = await getAdminAccess();
  const templateId = cleanText(formData.get("templateId"));
  const templateName = cleanText(formData.get("templateName"));
  const visibility = cleanText(formData.get("visibility"));
  const versionId = cleanText(formData.get("versionId"));
  const versionNumber = cleanText(formData.get("versionNumber"));

  if (!templateId) {
    throw new Error("Missing template id.");
  }

  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for template controls.");
  }

  await admin.from("monitoring_events" as never).insert({
    entity_id: null,
    entity_type: "admin_template_management",
    event_status: "info",
    event_type: action,
    metadata: {
      note: "Placeholder template governance action only. No template package was installed, no store was overwritten, and no template registry was duplicated.",
      source: "super_admin_template_management_center",
      template_id: templateId,
      template_name: templateName,
      version_id: versionId || null,
      version_number: versionNumber || null,
      visibility: visibility || null
    },
    store_id: null,
    user_id: access.user.id,
    workspace_id: null
  } as never);

  revalidatePath("/admin/templates");
}

async function recordTemplateActivationEvent(
  formData: FormData,
  action: "admin_template_activate" | "admin_template_archive" | "admin_template_mark_draft",
  result: { previousStatus: string | null; status: string }
) {
  const access = await getAdminAccess();
  const registryId = cleanText(formData.get("registryId"));
  const templateName = cleanText(formData.get("templateName"));

  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for template controls.");
  }

  await admin.from("monitoring_events" as never).insert({
    entity_id: registryId || null,
    entity_type: "admin_template_management",
    event_status: "info",
    event_type: action,
    metadata: {
      note: "Template registry status updated. No store installations, storefront rendering, or template package installer were changed.",
      previous_status: result.previousStatus,
      source: "super_admin_template_management_center",
      status: result.status,
      template_name: templateName
    },
    store_id: null,
    user_id: access.user.id,
    workspace_id: null
  } as never);
}

export async function activateTemplate(formData: FormData) {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can activate templates.");
  }

  const registryId = cleanText(formData.get("registryId"));

  if (!registryId) {
    throw new Error("Missing template registry id.");
  }

  const result = await activateRegistryTemplate(registryId);
  await recordTemplateActivationEvent(formData, "admin_template_activate", result);
  revalidatePath("/admin/templates");
}

export async function archiveTemplate(formData: FormData) {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can archive templates.");
  }

  const registryId = cleanText(formData.get("registryId"));
  const templateName = cleanText(formData.get("templateName"));

  if (!registryId) {
    throw new Error("Missing template registry id.");
  }

  const result = await archiveTemplateSafely(registryId);

  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for template controls.");
  }

  await admin.from("monitoring_events" as never).insert({
    entity_id: registryId,
    entity_type: "admin_template_management",
    event_status: "info",
    event_type: "admin_template_archive",
    metadata: {
      archived_at: result.archivedAt,
      note: "Template archived safely in registry. History, versions, badges, and package summary were preserved. No store installations or storefront rendering were changed.",
      previous_status: result.previousStatus,
      previous_visibility: result.previousVisibility,
      source: "super_admin_template_management_center",
      status: result.status,
      template_name: templateName
    },
    store_id: null,
    user_id: access.user.id,
    workspace_id: null
  } as never);

  revalidatePath("/admin/templates");
}

export async function restoreArchivedTemplateToDraft(formData: FormData) {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can restore archived templates.");
  }

  const registryId = cleanText(formData.get("registryId"));
  const templateName = cleanText(formData.get("templateName"));

  if (!registryId) {
    throw new Error("Missing template registry id.");
  }

  const result = await restoreArchivedRegistryTemplate(registryId);

  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for template controls.");
  }

  await admin.from("monitoring_events" as never).insert({
    entity_id: registryId,
    entity_type: "admin_template_management",
    event_status: "info",
    event_type: "admin_template_restore_archived",
    metadata: {
      note: "Archived template restored to draft in registry only. It will not become active until activated manually.",
      previous_status: result.previousStatus,
      restored_at: result.restoredAt,
      source: "super_admin_template_management_center",
      status: result.status,
      template_name: templateName
    },
    store_id: null,
    user_id: access.user.id,
    workspace_id: null
  } as never);

  revalidatePath("/admin/templates");
}

export async function markTemplateDraft(formData: FormData) {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can mark templates as draft.");
  }

  const registryId = cleanText(formData.get("registryId"));

  if (!registryId) {
    throw new Error("Missing template registry id.");
  }

  const result = await markRegistryTemplateDraft(registryId);
  await recordTemplateActivationEvent(formData, "admin_template_mark_draft", result);
  revalidatePath("/admin/templates");
}

export async function markTemplateOfficial(formData: FormData) {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can mark templates official.");
  }

  const registryId = cleanText(formData.get("registryId"));
  const templateName = cleanText(formData.get("templateName"));

  if (!registryId) {
    throw new Error("Missing template registry id.");
  }

  const result = await markRegistryTemplateOfficial(registryId);

  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for template controls.");
  }

  await admin.from("monitoring_events" as never).insert({
    entity_id: registryId,
    entity_type: "admin_template_management",
    event_status: "info",
    event_type: "admin_template_mark_official",
    metadata: {
      badges: result.badges,
      is_official: result.isOfficial,
      note: "Template official flag updated in registry catalog only. No store installations or storefront rendering were changed.",
      previous_official: result.previousOfficial,
      source: "super_admin_template_management_center",
      template_name: templateName
    },
    store_id: null,
    user_id: access.user.id,
    workspace_id: null
  } as never);

  revalidatePath("/admin/templates");
}

export async function unmarkTemplateOfficial(formData: FormData) {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can remove official template status.");
  }

  const registryId = cleanText(formData.get("registryId"));
  const templateName = cleanText(formData.get("templateName"));

  if (!registryId) {
    throw new Error("Missing template registry id.");
  }

  const result = await unmarkRegistryTemplateOfficial(registryId);

  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for template controls.");
  }

  await admin.from("monitoring_events" as never).insert({
    entity_id: registryId,
    entity_type: "admin_template_management",
    event_status: "info",
    event_type: "admin_template_unmark_official",
    metadata: {
      badges: result.badges,
      is_official: result.isOfficial,
      note: "Template official flag removed in registry catalog only. No store installations or storefront rendering were changed.",
      previous_official: result.previousOfficial,
      source: "super_admin_template_management_center",
      template_name: templateName
    },
    store_id: null,
    user_id: access.user.id,
    workspace_id: null
  } as never);

  revalidatePath("/admin/templates");
}

export async function recommendTemplate(formData: FormData) {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can recommend templates.");
  }

  const registryId = cleanText(formData.get("registryId"));
  const templateName = cleanText(formData.get("templateName"));
  const allowInternalVisibility = cleanText(formData.get("confirmInternalRecommendation")) === "1";

  if (!registryId) {
    throw new Error("Missing template registry id.");
  }

  const result = await recommendRegistryTemplate(registryId, { allowInternalVisibility });

  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for template controls.");
  }

  await admin.from("monitoring_events" as never).insert({
    entity_id: registryId,
    entity_type: "admin_template_management",
    event_status: "info",
    event_type: "admin_template_mark_recommended",
    metadata: {
      badges: result.badges,
      is_recommended: result.isRecommended,
      note: "Template recommendation updated in registry catalog only. No store installations or storefront rendering were changed.",
      previous_recommended: result.previousRecommended,
      recommendation_order: result.recommendationOrder,
      source: "super_admin_template_management_center",
      template_name: templateName
    },
    store_id: null,
    user_id: access.user.id,
    workspace_id: null
  } as never);

  revalidatePath("/admin/templates");
}

export async function unrecommendTemplate(formData: FormData) {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can remove template recommendations.");
  }

  const registryId = cleanText(formData.get("registryId"));
  const templateName = cleanText(formData.get("templateName"));

  if (!registryId) {
    throw new Error("Missing template registry id.");
  }

  const result = await unrecommendRegistryTemplate(registryId);

  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for template controls.");
  }

  await admin.from("monitoring_events" as never).insert({
    entity_id: registryId,
    entity_type: "admin_template_management",
    event_status: "info",
    event_type: "admin_template_unrecommend",
    metadata: {
      badges: result.badges,
      is_recommended: result.isRecommended,
      note: "Template recommendation removed in registry catalog only. No store installations or storefront rendering were changed.",
      previous_recommended: result.previousRecommended,
      source: "super_admin_template_management_center",
      template_name: templateName
    },
    store_id: null,
    user_id: access.user.id,
    workspace_id: null
  } as never);

  revalidatePath("/admin/templates");
}

export async function updateTemplateRecommendationOrder(formData: FormData) {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can update recommendation order.");
  }

  const registryId = cleanText(formData.get("registryId"));
  const templateName = cleanText(formData.get("templateName"));
  const recommendationOrder = cleanText(formData.get("recommendationOrder"));

  if (!registryId) {
    throw new Error("Missing template registry id.");
  }

  const result = await updateRegistryRecommendationOrder(registryId, Number.parseInt(recommendationOrder, 10));

  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for template controls.");
  }

  await admin.from("monitoring_events" as never).insert({
    entity_id: registryId,
    entity_type: "admin_template_management",
    event_status: "info",
    event_type: "admin_template_update_recommendation_order",
    metadata: {
      note: "Template recommendation order updated in registry catalog only.",
      previous_order: result.previousOrder,
      recommendation_order: result.recommendationOrder,
      source: "super_admin_template_management_center",
      template_name: templateName
    },
    store_id: null,
    user_id: access.user.id,
    workspace_id: null
  } as never);

  revalidatePath("/admin/templates");
}

export async function setTemplateVisibility(formData: FormData) {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can change template visibility.");
  }

  const registryId = cleanText(formData.get("registryId"));
  const templateName = cleanText(formData.get("templateName"));
  const visibility = cleanText(formData.get("visibility"));

  if (!registryId) {
    throw new Error("Missing template registry id.");
  }

  const result = await updateTemplateRegistryVisibility(registryId, visibility);

  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for template controls.");
  }

  await admin.from("monitoring_events" as never).insert({
    entity_id: registryId,
    entity_type: "admin_template_management",
    event_status: "info",
    event_type: "admin_template_set_visibility",
    metadata: {
      note: "Template registry visibility updated. No store installations, storefront rendering, or template package installer were changed.",
      previous_visibility: result.previousVisibility,
      source: "super_admin_template_management_center",
      template_name: templateName,
      visibility: result.visibility
    },
    store_id: null,
    user_id: access.user.id,
    workspace_id: null
  } as never);

  revalidatePath("/admin/templates");
}

export async function previewTemplatePlaceholder(formData: FormData) {
  await recordTemplateAdminAction(formData, "admin_template_preview");
}

export async function saveTemplatePackageMetadata(formData: FormData) {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can update template package metadata.");
  }

  const registryId = cleanText(formData.get("registryId"));
  const templateName = cleanText(formData.get("templateName"));
  const packageName = cleanText(formData.get("packageName"));

  if (!registryId) {
    throw new Error("Missing template registry id.");
  }

  function parseTriState(value: FormDataEntryValue | null) {
    const cleaned = cleanText(value);

    if (cleaned === "true") return true;
    if (cleaned === "false") return false;
    return "unknown" as const;
  }

  function parseCount(value: FormDataEntryValue | null) {
    const parsed = Number.parseInt(cleanText(value), 10);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  }

  const result = await updateTemplatePackageMetadata(registryId, {
    contents: {
      ai_support_enabled: formData.get("aiSupportEnabled") === "1",
      blog_posts_count: parseCount(formData.get("blogPostsCount")),
      categories_count: parseCount(formData.get("categoriesCount")),
      checkout_ready: parseTriState(formData.get("checkoutReady")),
      domain_ready: formData.get("domainReady") === "1",
      faq_count: parseCount(formData.get("faqCount")),
      navigation_ready: parseTriState(formData.get("navigationReady")),
      pages_count: parseCount(formData.get("pagesCount")),
      products_count: parseCount(formData.get("productsCount")),
      theme_ready: parseTriState(formData.get("themeReady"))
    },
    packageName: packageName || undefined
  });

  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for template controls.");
  }

  await admin.from("monitoring_events" as never).insert({
    entity_id: registryId,
    entity_type: "admin_template_management",
    event_status: "info",
    event_type: "admin_template_package_summary_updated",
    metadata: {
      note: "Template package metadata updated in registry runtime only. No package installation, store mutation, or storefront rendering changes occurred.",
      package_name: result.package.packageName,
      readiness_status: result.package.readinessStatus,
      source: "super_admin_template_management_center",
      template_name: templateName,
      validation_issues: result.validation.issues
    },
    store_id: null,
    user_id: access.user.id,
    workspace_id: null
  } as never);

  revalidatePath("/admin/templates");
}

export async function publishTemplateUpdatePlaceholder(formData: FormData) {
  await recordTemplateAdminAction(formData, "admin_template_publish_update");
}

export async function installTemplateVersionPlaceholder(formData: FormData) {
  await recordTemplateAdminAction(formData, "admin_template_install_version");
}

export async function updateStoresTemplatePlaceholder(formData: FormData) {
  await recordTemplateAdminAction(formData, "admin_template_update_stores");
}
