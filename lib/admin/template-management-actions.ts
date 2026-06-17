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
import {
  archiveTemplateScreenshot,
  listTemplateScreenshots,
  publishTemplateScreenshot,
  reorderTemplateScreenshots,
  uploadTemplateScreenshot
} from "@/src/lib/templates/template-screenshot-storage";
import {
  archiveTemplateAsset,
  deleteDraftTemplateAsset,
  publishTemplateAsset,
  uploadTemplateAsset
} from "@/src/lib/templates/template-asset-storage";
import { installTemplateToStore } from "@/src/lib/templates/template-install-runtime";
import {
  assignTemplateToStore,
  markTemplateAssignmentActive,
  unassignTemplateFromStore
} from "@/src/lib/templates/store-template-assignment";

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
  | "admin_template_screenshot_archived"
  | "admin_template_screenshot_published"
  | "admin_template_screenshot_reordered"
  | "admin_template_screenshot_uploaded"
  | "admin_template_asset_archived"
  | "admin_template_asset_deleted"
  | "admin_template_asset_published"
  | "admin_template_asset_uploaded"
  | "admin_template_install_to_store"
  | "admin_template_assign_to_store"
  | "admin_template_assignment_mark_active"
  | "admin_template_assignment_unassign"
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

export async function uploadTemplateScreenshotAction(formData: FormData) {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can upload template screenshots.");
  }

  const registryId = cleanText(formData.get("registryId"));
  const templateName = cleanText(formData.get("templateName"));
  const screenshotType = cleanText(formData.get("screenshotType")) || "gallery";
  const file = formData.get("screenshotFile");

  if (!registryId) {
    throw new Error("Missing template registry id.");
  }

  if (!(file instanceof File) || !file.size) {
    throw new Error("Select a screenshot file to upload.");
  }

  const screenshot = await uploadTemplateScreenshot(registryId, file, {
    screenshotType: screenshotType as "desktop" | "gallery" | "hero" | "mobile" | "tablet" | "thumbnail"
  });

  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for template controls.");
  }

  await admin.from("monitoring_events" as never).insert({
    entity_id: screenshot.id,
    entity_type: "admin_template_management",
    event_status: "info",
    event_type: "admin_template_screenshot_uploaded",
    metadata: {
      note: "Template screenshot uploaded to admin storage only. No store installation or storefront rendering changes occurred.",
      screenshot_type: screenshot.screenshotType,
      source: "super_admin_template_management_center",
      template_name: templateName,
      template_registry_id: registryId
    },
    store_id: null,
    user_id: access.user.id,
    workspace_id: null
  } as never);

  revalidatePath("/admin/templates");
  revalidatePath(`/admin/templates/preview/${encodeURIComponent(registryId)}`);
}

export async function publishTemplateScreenshotAction(formData: FormData) {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can publish template screenshots.");
  }

  const registryId = cleanText(formData.get("registryId"));
  const templateName = cleanText(formData.get("templateName"));
  const screenshotId = cleanText(formData.get("screenshotId"));

  if (!screenshotId) {
    throw new Error("Missing screenshot id.");
  }

  const screenshot = await publishTemplateScreenshot(screenshotId);
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for template controls.");
  }

  await admin.from("monitoring_events" as never).insert({
    entity_id: screenshot.id,
    entity_type: "admin_template_management",
    event_status: "info",
    event_type: "admin_template_screenshot_published",
    metadata: {
      note: "Template screenshot published for admin preview only.",
      screenshot_type: screenshot.screenshotType,
      source: "super_admin_template_management_center",
      template_name: templateName,
      template_registry_id: registryId || screenshot.templateId
    },
    store_id: null,
    user_id: access.user.id,
    workspace_id: null
  } as never);

  revalidatePath("/admin/templates");
  revalidatePath(`/admin/templates/preview/${encodeURIComponent(registryId || screenshot.templateId)}`);
}

export async function archiveTemplateScreenshotAction(formData: FormData) {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can archive template screenshots.");
  }

  const registryId = cleanText(formData.get("registryId"));
  const templateName = cleanText(formData.get("templateName"));
  const screenshotId = cleanText(formData.get("screenshotId"));

  if (!screenshotId) {
    throw new Error("Missing screenshot id.");
  }

  const screenshot = await archiveTemplateScreenshot(screenshotId);
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for template controls.");
  }

  await admin.from("monitoring_events" as never).insert({
    entity_id: screenshot.id,
    entity_type: "admin_template_management",
    event_status: "info",
    event_type: "admin_template_screenshot_archived",
    metadata: {
      note: "Template screenshot archived in admin storage runtime only.",
      screenshot_type: screenshot.screenshotType,
      source: "super_admin_template_management_center",
      template_name: templateName,
      template_registry_id: registryId || screenshot.templateId
    },
    store_id: null,
    user_id: access.user.id,
    workspace_id: null
  } as never);

  revalidatePath("/admin/templates");
  revalidatePath(`/admin/templates/preview/${encodeURIComponent(registryId || screenshot.templateId)}`);
}

export async function reorderTemplateScreenshotAction(formData: FormData) {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can reorder template screenshots.");
  }

  const registryId = cleanText(formData.get("registryId"));
  const templateName = cleanText(formData.get("templateName"));
  const screenshotId = cleanText(formData.get("screenshotId"));
  const direction = cleanText(formData.get("direction"));

  if (!registryId || !screenshotId) {
    throw new Error("Missing screenshot reorder context.");
  }

  const screenshots = await listTemplateScreenshots(registryId);
  const ids = screenshots.map((screenshot) => screenshot.id);
  const index = ids.indexOf(screenshotId);

  if (index < 0) {
    throw new Error("Screenshot was not found for reorder.");
  }

  if (direction === "up" && index > 0) {
    const previous = ids[index - 1];
    ids[index - 1] = screenshotId;
    ids[index] = previous;
  } else if (direction === "down" && index < ids.length - 1) {
    const next = ids[index + 1];
    ids[index + 1] = screenshotId;
    ids[index] = next;
  }

  await reorderTemplateScreenshots(registryId, ids);

  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for template controls.");
  }

  await admin.from("monitoring_events" as never).insert({
    entity_id: screenshotId,
    entity_type: "admin_template_management",
    event_status: "info",
    event_type: "admin_template_screenshot_reordered",
    metadata: {
      direction: direction || "custom",
      note: "Template screenshot order updated in admin runtime only.",
      source: "super_admin_template_management_center",
      template_name: templateName,
      template_registry_id: registryId
    },
    store_id: null,
    user_id: access.user.id,
    workspace_id: null
  } as never);

  revalidatePath("/admin/templates");
  revalidatePath(`/admin/templates/preview/${encodeURIComponent(registryId)}`);
}

export async function uploadTemplateAssetAction(formData: FormData) {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can upload template assets.");
  }

  const registryId = cleanText(formData.get("registryId"));
  const templateName = cleanText(formData.get("templateName"));
  const assetType = cleanText(formData.get("assetType")) || "custom";
  const file = formData.get("assetFile");

  if (!registryId) {
    throw new Error("Missing template registry id.");
  }

  if (!(file instanceof File) || !file.size) {
    throw new Error("Select an asset file to upload.");
  }

  const asset = await uploadTemplateAsset(registryId, file, {
    assetType: assetType as
      | "custom"
      | "demo_media"
      | "documentation"
      | "icon"
      | "package_file"
      | "preview_image"
  });

  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for template controls.");
  }

  await admin.from("monitoring_events" as never).insert({
    entity_id: asset.id,
    entity_type: "admin_template_management",
    event_status: "info",
    event_type: "admin_template_asset_uploaded",
    metadata: {
      asset_type: asset.assetType,
      note: "Template asset uploaded to admin storage only. No store installation or storefront rendering changes occurred.",
      source: "super_admin_template_management_center",
      template_name: templateName,
      template_registry_id: registryId
    },
    store_id: null,
    user_id: access.user.id,
    workspace_id: null
  } as never);

  revalidatePath("/admin/templates");
}

export async function publishTemplateAssetAction(formData: FormData) {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can publish template assets.");
  }

  const registryId = cleanText(formData.get("registryId"));
  const templateName = cleanText(formData.get("templateName"));
  const assetId = cleanText(formData.get("assetId"));

  if (!assetId) {
    throw new Error("Missing asset id.");
  }

  const asset = await publishTemplateAsset(assetId);
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for template controls.");
  }

  await admin.from("monitoring_events" as never).insert({
    entity_id: asset.id,
    entity_type: "admin_template_management",
    event_status: "info",
    event_type: "admin_template_asset_published",
    metadata: {
      asset_type: asset.assetType,
      note: "Template asset published in admin runtime only.",
      source: "super_admin_template_management_center",
      template_name: templateName,
      template_registry_id: registryId || asset.templateId
    },
    store_id: null,
    user_id: access.user.id,
    workspace_id: null
  } as never);

  revalidatePath("/admin/templates");
}

export async function archiveTemplateAssetAction(formData: FormData) {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can archive template assets.");
  }

  const registryId = cleanText(formData.get("registryId"));
  const templateName = cleanText(formData.get("templateName"));
  const assetId = cleanText(formData.get("assetId"));

  if (!assetId) {
    throw new Error("Missing asset id.");
  }

  const asset = await archiveTemplateAsset(assetId);
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for template controls.");
  }

  await admin.from("monitoring_events" as never).insert({
    entity_id: asset.id,
    entity_type: "admin_template_management",
    event_status: "info",
    event_type: "admin_template_asset_archived",
    metadata: {
      asset_type: asset.assetType,
      note: "Template asset archived in admin runtime only.",
      source: "super_admin_template_management_center",
      template_name: templateName,
      template_registry_id: registryId || asset.templateId
    },
    store_id: null,
    user_id: access.user.id,
    workspace_id: null
  } as never);

  revalidatePath("/admin/templates");
}

export async function deleteDraftTemplateAssetAction(formData: FormData) {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can delete draft template assets.");
  }

  const registryId = cleanText(formData.get("registryId"));
  const templateName = cleanText(formData.get("templateName"));
  const assetId = cleanText(formData.get("assetId"));

  if (!assetId) {
    throw new Error("Missing asset id.");
  }

  const asset = await deleteDraftTemplateAsset(assetId);
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for template controls.");
  }

  await admin.from("monitoring_events" as never).insert({
    entity_id: asset.id,
    entity_type: "admin_template_management",
    event_status: "info",
    event_type: "admin_template_asset_deleted",
    metadata: {
      asset_type: asset.assetType,
      note: "Draft template asset deleted from admin storage runtime only.",
      source: "super_admin_template_management_center",
      template_name: templateName,
      template_registry_id: registryId || asset.templateId
    },
    store_id: null,
    user_id: access.user.id,
    workspace_id: null
  } as never);

  revalidatePath("/admin/templates");
}

export async function installTemplateToStoreAction(formData: FormData) {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can install templates into stores.");
  }

  if (cleanText(formData.get("confirmed")) !== "1") {
    throw new Error("Super Admin install confirmation is required.");
  }

  const registryId = cleanText(formData.get("registryId"));
  const templateName = cleanText(formData.get("templateName"));
  const storeId = cleanText(formData.get("storeId"));

  if (!registryId || !storeId) {
    throw new Error("Template and store are required for install.");
  }

  const result = await installTemplateToStore(registryId, storeId);
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for template controls.");
  }

  await admin.from("monitoring_events" as never).insert({
    entity_id: result.install.id,
    entity_type: "admin_template_management",
    event_status: "info",
    event_type: "admin_template_install_to_store",
    metadata: {
      install_id: result.install.id,
      install_status: result.install.status,
      note: "Super Admin manual template install completed for a single selected store.",
      package_install_status: result.packageResult.status,
      source: "super_admin_template_management_center",
      store_id: storeId,
      template_name: templateName,
      template_registry_id: registryId
    },
    store_id: storeId,
    user_id: access.user.id,
    workspace_id: null
  } as never);

  revalidatePath("/admin/templates");
  revalidatePath(`/admin/stores/${encodeURIComponent(storeId)}`);
}

export async function assignTemplateToStoreAction(formData: FormData) {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can assign templates to stores.");
  }

  if (cleanText(formData.get("confirmed")) !== "1") {
    throw new Error("Super Admin assignment confirmation is required.");
  }

  const registryId = cleanText(formData.get("registryId"));
  const storeId = cleanText(formData.get("storeId"));
  const templateName = cleanText(formData.get("templateName"));
  const replaceConfirmed = cleanText(formData.get("replaceConfirmed")) === "1";

  if (!registryId || !storeId) {
    throw new Error("Template and store are required for assignment.");
  }

  const result = await assignTemplateToStore(storeId, registryId, null, null, {
    replaceConfirmed
  });
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for template controls.");
  }

  await admin.from("monitoring_events" as never).insert({
    entity_id: result.assignment.id,
    entity_type: "admin_template_management",
    event_status: "info",
    event_type: "admin_template_assign_to_store",
    metadata: {
      assignment_id: result.assignment.id,
      assignment_status: result.assignment.assignmentStatus,
      note: "Super Admin manual template assignment metadata recorded for a single store.",
      replaced_assignment_id: result.replacedAssignmentId,
      source: "super_admin_template_management_center",
      store_id: storeId,
      template_name: templateName || result.validation.templateName,
      template_registry_id: registryId
    },
    store_id: storeId,
    user_id: access.user.id,
    workspace_id: null
  } as never);

  revalidatePath("/admin/templates");
  revalidatePath(`/admin/stores/${encodeURIComponent(storeId)}`);
}

export async function markTemplateAssignmentActiveAction(formData: FormData) {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can mark template assignments active.");
  }

  const assignmentId = cleanText(formData.get("assignmentId"));
  const storeName = cleanText(formData.get("storeName"));
  const templateName = cleanText(formData.get("templateName"));

  if (!assignmentId) {
    throw new Error("Assignment id is required.");
  }

  const assignment = await markTemplateAssignmentActive(assignmentId);
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for template controls.");
  }

  await admin.from("monitoring_events" as never).insert({
    entity_id: assignment.id,
    entity_type: "admin_template_management",
    event_status: "info",
    event_type: "admin_template_assignment_mark_active",
    metadata: {
      assignment_id: assignment.id,
      assignment_status: assignment.assignmentStatus,
      note: "Template assignment marked active. Metadata only; no store content changes.",
      source: "super_admin_template_management_center",
      store_id: assignment.storeId,
      store_name: storeName,
      template_name: templateName
    },
    store_id: assignment.storeId,
    user_id: access.user.id,
    workspace_id: null
  } as never);

  revalidatePath("/admin/templates");
  revalidatePath(`/admin/stores/${encodeURIComponent(assignment.storeId)}`);
}

export async function unassignTemplateFromStoreAction(formData: FormData) {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can unassign templates from stores.");
  }

  const assignmentId = cleanText(formData.get("assignmentId"));
  const storeName = cleanText(formData.get("storeName"));
  const templateName = cleanText(formData.get("templateName"));

  if (!assignmentId) {
    throw new Error("Assignment id is required.");
  }

  const assignment = await unassignTemplateFromStore(assignmentId);
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for template controls.");
  }

  await admin.from("monitoring_events" as never).insert({
    entity_id: assignment.id,
    entity_type: "admin_template_management",
    event_status: "warning",
    event_type: "admin_template_assignment_unassign",
    metadata: {
      assignment_id: assignment.id,
      assignment_status: assignment.assignmentStatus,
      note: "Template assignment unassigned. Metadata only; no store content deleted.",
      source: "super_admin_template_management_center",
      store_id: assignment.storeId,
      store_name: storeName,
      template_name: templateName
    },
    store_id: assignment.storeId,
    user_id: access.user.id,
    workspace_id: null
  } as never);

  revalidatePath("/admin/templates");
  revalidatePath(`/admin/stores/${encodeURIComponent(assignment.storeId)}`);
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
