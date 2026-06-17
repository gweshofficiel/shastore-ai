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
import {
  applyTemplateUpdate,
  checkTemplateUpdateAvailability,
  prepareTemplateUpdate
} from "@/src/lib/templates/template-update-runtime";
import {
  applyTemplateRollback,
  prepareTemplateRollback
} from "@/src/lib/templates/template-rollback-runtime";
import {
  archiveMarketplaceListing,
  createMarketplaceListing,
  publishMarketplaceListing,
  setMarketplaceListingFeatured,
  updateMarketplaceListing
} from "@/src/lib/templates/template-marketplace-runtime";
import {
  approveMarketplaceListing,
  rejectMarketplaceListing,
  requestMarketplaceChanges
} from "@/src/lib/templates/marketplace-approval-runtime";
import {
  publishTemplateUpdate,
  unpublishTemplateVersion
} from "@/src/lib/templates/template-publish-runtime";

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
  | "admin_template_update_check"
  | "admin_template_update_prepare"
  | "admin_template_update_apply"
  | "admin_template_rollback_prepare"
  | "admin_template_rollback_apply"
  | "admin_template_marketplace_create"
  | "admin_template_marketplace_update"
  | "admin_template_marketplace_publish"
  | "admin_template_marketplace_archive"
  | "admin_template_marketplace_featured"
  | "admin_template_marketplace_approve"
  | "admin_template_marketplace_reject"
  | "admin_template_marketplace_request_changes"
  | "admin_template_publish_update"
  | "admin_template_unpublish_version"
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

export async function checkTemplateUpdateAction(formData: FormData) {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can check template updates.");
  }

  const registryId = cleanText(formData.get("registryId"));
  const storeId = cleanText(formData.get("storeId"));
  const toVersionId = cleanText(formData.get("toVersionId"));
  const templateName = cleanText(formData.get("templateName"));

  if (!registryId || !storeId || !toVersionId) {
    throw new Error("Store, template, and target version are required to check updates.");
  }

  const validation = await checkTemplateUpdateAvailability(storeId, registryId, toVersionId);

  if (!validation.canUpdate) {
    throw new Error(validation.issues.join(" ") || "Template update is not available.");
  }

  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for template controls.");
  }

  await admin.from("monitoring_events" as never).insert({
    entity_id: registryId,
    entity_type: "admin_template_management",
    event_status: "info",
    event_type: "admin_template_update_check",
    metadata: {
      assignment_id: validation.assignmentId,
      from_version_id: validation.fromVersionId,
      from_version_number: validation.fromVersionNumber,
      note: "Super Admin template update availability check passed.",
      source: "super_admin_template_management_center",
      store_id: storeId,
      template_name: templateName || validation.templateName,
      template_registry_id: registryId,
      to_version_id: validation.toVersionId,
      to_version_number: validation.toVersionNumber
    },
    store_id: storeId,
    user_id: access.user.id,
    workspace_id: null
  } as never);

  revalidatePath("/admin/templates");
}

export async function prepareTemplateUpdateAction(formData: FormData) {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can prepare template updates.");
  }

  if (cleanText(formData.get("confirmed")) !== "1") {
    throw new Error("Super Admin update confirmation is required.");
  }

  const registryId = cleanText(formData.get("registryId"));
  const storeId = cleanText(formData.get("storeId"));
  const toVersionId = cleanText(formData.get("toVersionId"));
  const templateName = cleanText(formData.get("templateName"));

  if (!registryId || !storeId || !toVersionId) {
    throw new Error("Store, template, and target version are required to prepare an update.");
  }

  const result = await prepareTemplateUpdate(storeId, registryId, toVersionId);
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for template controls.");
  }

  await admin.from("monitoring_events" as never).insert({
    entity_id: result.job.id,
    entity_type: "admin_template_management",
    event_status: "info",
    event_type: "admin_template_update_prepare",
    metadata: {
      from_version_id: result.job.fromVersionId,
      note: "Super Admin manual template update job prepared for a single store.",
      source: "super_admin_template_management_center",
      store_id: storeId,
      template_name: templateName || result.validation.templateName,
      template_registry_id: registryId,
      to_version_id: result.job.toVersionId,
      update_job_id: result.job.id,
      update_status: result.job.status
    },
    store_id: storeId,
    user_id: access.user.id,
    workspace_id: null
  } as never);

  revalidatePath("/admin/templates");
  revalidatePath(`/admin/stores/${encodeURIComponent(storeId)}`);
}

export async function applyTemplateUpdateAction(formData: FormData) {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can apply template updates.");
  }

  if (cleanText(formData.get("confirmed")) !== "1") {
    throw new Error("Super Admin apply confirmation is required.");
  }

  const updateJobId = cleanText(formData.get("updateJobId"));
  const storeName = cleanText(formData.get("storeName"));
  const templateName = cleanText(formData.get("templateName"));

  if (!updateJobId) {
    throw new Error("Prepared update job id is required.");
  }

  const result = await applyTemplateUpdate(updateJobId);
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for template controls.");
  }

  await admin.from("monitoring_events" as never).insert({
    entity_id: result.job.id,
    entity_type: "admin_template_management",
    event_status: "info",
    event_type: "admin_template_update_apply",
    metadata: {
      conflict_count: result.job.conflicts.length,
      note: "Super Admin manual template update applied for a single store.",
      package_install_status: result.packageResult.status,
      source: "super_admin_template_management_center",
      store_id: result.job.storeId,
      store_name: storeName,
      template_name: templateName || result.validation.templateName,
      to_version_id: result.job.toVersionId,
      update_job_id: result.job.id,
      update_status: result.job.status
    },
    store_id: result.job.storeId,
    user_id: access.user.id,
    workspace_id: null
  } as never);

  revalidatePath("/admin/templates");
  revalidatePath(`/admin/stores/${encodeURIComponent(result.job.storeId)}`);
}

export async function prepareTemplateRollbackAction(formData: FormData) {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can prepare template rollbacks.");
  }

  if (cleanText(formData.get("confirmed")) !== "1") {
    throw new Error("Super Admin rollback confirmation is required.");
  }

  const registryId = cleanText(formData.get("registryId"));
  const storeId = cleanText(formData.get("storeId"));
  const toVersionId = cleanText(formData.get("toVersionId"));
  const templateName = cleanText(formData.get("templateName"));

  if (!registryId || !storeId || !toVersionId) {
    throw new Error("Store, template, and rollback version are required.");
  }

  const result = await prepareTemplateRollback(storeId, registryId, toVersionId);
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for template controls.");
  }

  await admin.from("monitoring_events" as never).insert({
    entity_id: result.job.id,
    entity_type: "admin_template_management",
    event_status: "info",
    event_type: "admin_template_rollback_prepare",
    metadata: {
      from_version_id: result.job.fromVersionId,
      note: "Super Admin manual template rollback job prepared for a single store.",
      rollback_job_id: result.job.id,
      rollback_status: result.job.status,
      source: "super_admin_template_management_center",
      store_id: storeId,
      template_name: templateName || result.validation.templateName,
      template_registry_id: registryId,
      to_version_id: result.job.toVersionId,
      update_job_id: result.job.updateJobId
    },
    store_id: storeId,
    user_id: access.user.id,
    workspace_id: null
  } as never);

  revalidatePath("/admin/templates");
  revalidatePath(`/admin/stores/${encodeURIComponent(storeId)}`);
}

export async function applyTemplateRollbackAction(formData: FormData) {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can apply template rollbacks.");
  }

  if (cleanText(formData.get("confirmed")) !== "1") {
    throw new Error("Super Admin apply confirmation is required.");
  }

  const rollbackJobId = cleanText(formData.get("rollbackJobId"));
  const storeName = cleanText(formData.get("storeName"));
  const templateName = cleanText(formData.get("templateName"));

  if (!rollbackJobId) {
    throw new Error("Prepared rollback job id is required.");
  }

  const result = await applyTemplateRollback(rollbackJobId);
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for template controls.");
  }

  await admin.from("monitoring_events" as never).insert({
    entity_id: result.job.id,
    entity_type: "admin_template_management",
    event_status: "info",
    event_type: "admin_template_rollback_apply",
    metadata: {
      conflict_count: result.job.conflicts.length,
      note: "Super Admin manual template rollback applied for a single store.",
      package_install_status: result.packageResult.status,
      rollback_job_id: result.job.id,
      rollback_status: result.job.status,
      source: "super_admin_template_management_center",
      store_id: result.job.storeId,
      store_name: storeName,
      template_name: templateName || result.validation.templateName,
      to_version_id: result.job.toVersionId,
      update_job_id: result.job.updateJobId
    },
    store_id: result.job.storeId,
    user_id: access.user.id,
    workspace_id: null
  } as never);

  revalidatePath("/admin/templates");
  revalidatePath(`/admin/stores/${encodeURIComponent(result.job.storeId)}`);
}

export async function createMarketplaceListingAction(formData: FormData) {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can create template marketplace listings.");
  }

  if (cleanText(formData.get("confirmed")) !== "1") {
    throw new Error("Super Admin marketplace listing confirmation is required.");
  }

  const templateId = cleanText(formData.get("templateId"));
  const listingTitle = cleanText(formData.get("listingTitle"));
  const listingDescription = cleanText(formData.get("listingDescription"));
  const pricingType = cleanText(formData.get("pricingType")) as "free" | "included" | "paid" | "";
  const priceRaw = cleanText(formData.get("priceAmount"));
  const currency = cleanText(formData.get("currency"));

  if (!templateId) {
    throw new Error("Template is required to create a marketplace listing.");
  }

  const result = await createMarketplaceListing(templateId, {
    currency: currency || null,
    listingDescription: listingDescription || null,
    listingTitle: listingTitle || undefined,
    priceAmount: priceRaw ? Number(priceRaw) : null,
    pricingType: pricingType || "free"
  });

  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for template controls.");
  }

  await admin.from("monitoring_events" as never).insert({
    entity_id: result.listing.id,
    entity_type: "admin_template_management",
    event_status: "info",
    event_type: "admin_template_marketplace_create",
    metadata: {
      approval_status: result.listing.approvalStatus,
      listing_id: result.listing.id,
      listing_status: result.listing.listingStatus,
      listing_title: result.listing.listingTitle,
      note: "Super Admin draft marketplace listing created. No install, payment, or store mutation.",
      pricing_type: result.listing.pricingType,
      source: "super_admin_template_management_center",
      template_id: templateId,
      template_name: result.eligibility.templateName
    },
    store_id: null,
    user_id: access.user.id,
    workspace_id: null
  } as never);

  revalidatePath("/admin/templates");
}

export async function updateMarketplaceListingAction(formData: FormData) {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can update template marketplace listings.");
  }

  const listingId = cleanText(formData.get("listingId"));
  const listingTitle = cleanText(formData.get("listingTitle"));
  const listingDescription = cleanText(formData.get("listingDescription"));
  const approvalStatus = cleanText(formData.get("approvalStatus")) as
    | "approved"
    | "changes_requested"
    | "pending_review"
    | "rejected"
    | "";
  const pricingType = cleanText(formData.get("pricingType")) as "free" | "included" | "paid" | "";
  const priceRaw = cleanText(formData.get("priceAmount"));
  const currency = cleanText(formData.get("currency"));
  const featuredRaw = cleanText(formData.get("featured"));

  if (!listingId) {
    throw new Error("Listing id is required.");
  }

  const result = await updateMarketplaceListing(listingId, {
    approvalStatus: approvalStatus || undefined,
    currency: currency || undefined,
    featured: featuredRaw === "" ? undefined : featuredRaw === "1",
    listingDescription: listingDescription || undefined,
    listingTitle: listingTitle || undefined,
    priceAmount: priceRaw ? Number(priceRaw) : undefined,
    pricingType: pricingType || undefined
  });

  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for template controls.");
  }

  await admin.from("monitoring_events" as never).insert({
    entity_id: result.listing.id,
    entity_type: "admin_template_management",
    event_status: "info",
    event_type: "admin_template_marketplace_update",
    metadata: {
      approval_status: result.listing.approvalStatus,
      featured: result.listing.featured,
      listing_id: result.listing.id,
      listing_status: result.listing.listingStatus,
      listing_title: result.listing.listingTitle,
      note: "Super Admin marketplace listing updated.",
      pricing_type: result.listing.pricingType,
      source: "super_admin_template_management_center",
      template_id: result.listing.templateId
    },
    store_id: null,
    user_id: access.user.id,
    workspace_id: null
  } as never);

  revalidatePath("/admin/templates");
}

export async function publishMarketplaceListingAction(formData: FormData) {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can publish template marketplace listings.");
  }

  if (cleanText(formData.get("confirmed")) !== "1") {
    throw new Error("Super Admin publish confirmation is required.");
  }

  const listingId = cleanText(formData.get("listingId"));
  const listingTitle = cleanText(formData.get("listingTitle"));
  const templateName = cleanText(formData.get("templateName"));

  if (!listingId) {
    throw new Error("Listing id is required.");
  }

  const result = await publishMarketplaceListing(listingId);
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for template controls.");
  }

  await admin.from("monitoring_events" as never).insert({
    entity_id: result.listing.id,
    entity_type: "admin_template_management",
    event_status: "info",
    event_type: "admin_template_marketplace_publish",
    metadata: {
      listing_id: result.listing.id,
      listing_status: result.listing.listingStatus,
      listing_title: listingTitle || result.listing.listingTitle,
      note: "Super Admin marketplace listing published for admin catalog preview only. No install or payment.",
      published_at: result.listing.publishedAt,
      source: "super_admin_template_management_center",
      template_id: result.listing.templateId,
      template_name: templateName
    },
    store_id: null,
    user_id: access.user.id,
    workspace_id: null
  } as never);

  revalidatePath("/admin/templates");
}

export async function archiveMarketplaceListingAction(formData: FormData) {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can archive template marketplace listings.");
  }

  if (cleanText(formData.get("confirmed")) !== "1") {
    throw new Error("Super Admin archive confirmation is required.");
  }

  const listingId = cleanText(formData.get("listingId"));

  if (!listingId) {
    throw new Error("Listing id is required.");
  }

  const result = await archiveMarketplaceListing(listingId);
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for template controls.");
  }

  await admin.from("monitoring_events" as never).insert({
    entity_id: result.listing.id,
    entity_type: "admin_template_management",
    event_status: "info",
    event_type: "admin_template_marketplace_archive",
    metadata: {
      listing_id: result.listing.id,
      listing_status: result.listing.listingStatus,
      note: "Super Admin marketplace listing archived.",
      source: "super_admin_template_management_center",
      template_id: result.listing.templateId
    },
    store_id: null,
    user_id: access.user.id,
    workspace_id: null
  } as never);

  revalidatePath("/admin/templates");
}

export async function markMarketplaceListingFeaturedAction(formData: FormData) {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can feature template marketplace listings.");
  }

  const listingId = cleanText(formData.get("listingId"));
  const featured = cleanText(formData.get("featured")) === "1";

  if (!listingId) {
    throw new Error("Listing id is required.");
  }

  const result = await setMarketplaceListingFeatured(listingId, featured);
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for template controls.");
  }

  await admin.from("monitoring_events" as never).insert({
    entity_id: result.listing.id,
    entity_type: "admin_template_management",
    event_status: "info",
    event_type: "admin_template_marketplace_featured",
    metadata: {
      featured: result.listing.featured,
      listing_id: result.listing.id,
      note: "Super Admin marketplace listing featured flag updated.",
      source: "super_admin_template_management_center",
      template_id: result.listing.templateId
    },
    store_id: null,
    user_id: access.user.id,
    workspace_id: null
  } as never);

  revalidatePath("/admin/templates");
}

export async function approveMarketplaceListingAction(formData: FormData) {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can approve marketplace listings.");
  }

  if (cleanText(formData.get("confirmed")) !== "1") {
    throw new Error("Super Admin approval confirmation is required.");
  }

  const listingId = cleanText(formData.get("listingId"));
  const listingTitle = cleanText(formData.get("listingTitle"));
  const templateName = cleanText(formData.get("templateName"));

  if (!listingId) {
    throw new Error("Listing id is required.");
  }

  const result = await approveMarketplaceListing(listingId);
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for template controls.");
  }

  await admin.from("monitoring_events" as never).insert({
    entity_id: result.listing.id,
    entity_type: "admin_template_management",
    event_status: "info",
    event_type: "admin_template_marketplace_approve",
    metadata: {
      approval_status: result.listing.approvalStatus,
      listing_id: result.listing.id,
      listing_status: result.listing.listingStatus,
      listing_title: listingTitle || result.listing.listingTitle,
      note: "Super Admin marketplace approval. No auto-publish, install, or payment.",
      source: "super_admin_template_management_center",
      template_id: result.listing.templateId,
      template_name: templateName
    },
    store_id: null,
    user_id: access.user.id,
    workspace_id: null
  } as never);

  revalidatePath("/admin/templates");
}

export async function rejectMarketplaceListingAction(formData: FormData) {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can reject marketplace listings.");
  }

  if (cleanText(formData.get("confirmed")) !== "1") {
    throw new Error("Super Admin rejection confirmation is required.");
  }

  const listingId = cleanText(formData.get("listingId"));
  const reason = cleanText(formData.get("reason"));

  if (!listingId || !reason) {
    throw new Error("Listing id and rejection reason are required.");
  }

  const result = await rejectMarketplaceListing(listingId, reason);
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for template controls.");
  }

  await admin.from("monitoring_events" as never).insert({
    entity_id: result.listing.id,
    entity_type: "admin_template_management",
    event_status: "info",
    event_type: "admin_template_marketplace_reject",
    metadata: {
      approval_status: result.listing.approvalStatus,
      listing_id: result.listing.id,
      note: "Super Admin marketplace rejection stored as safe metadata only.",
      rejection_reason: result.rejectionReason,
      source: "super_admin_template_management_center",
      template_id: result.listing.templateId
    },
    store_id: null,
    user_id: access.user.id,
    workspace_id: null
  } as never);

  revalidatePath("/admin/templates");
}

export async function requestMarketplaceChangesAction(formData: FormData) {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can request marketplace listing changes.");
  }

  if (cleanText(formData.get("confirmed")) !== "1") {
    throw new Error("Super Admin review confirmation is required.");
  }

  const listingId = cleanText(formData.get("listingId"));
  const reason = cleanText(formData.get("reason"));

  if (!listingId || !reason) {
    throw new Error("Listing id and review note are required.");
  }

  const result = await requestMarketplaceChanges(listingId, reason);
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for template controls.");
  }

  await admin.from("monitoring_events" as never).insert({
    entity_id: result.listing.id,
    entity_type: "admin_template_management",
    event_status: "info",
    event_type: "admin_template_marketplace_request_changes",
    metadata: {
      approval_status: result.listing.approvalStatus,
      listing_id: result.listing.id,
      note: "Super Admin marketplace changes requested. Safe review note stored in metadata.",
      review_note: result.reviewNote,
      source: "super_admin_template_management_center",
      template_id: result.listing.templateId
    },
    store_id: null,
    user_id: access.user.id,
    workspace_id: null
  } as never);

  revalidatePath("/admin/templates");
}

export async function publishTemplateUpdateAction(formData: FormData) {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can publish template updates.");
  }

  if (cleanText(formData.get("confirmed")) !== "1") {
    throw new Error("Super Admin publish confirmation is required.");
  }

  const templateId = cleanText(formData.get("templateId"));
  const templateName = cleanText(formData.get("templateName"));
  const versionId = cleanText(formData.get("versionId"));
  const versionNumber = cleanText(formData.get("versionNumber"));

  if (!templateId || !versionId) {
    throw new Error("Template and version are required to publish.");
  }

  const result = await publishTemplateUpdate(templateId, versionId);
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for template controls.");
  }

  await admin.from("monitoring_events" as never).insert({
    entity_id: result.publishedVersion.id,
    entity_type: "admin_template_management",
    event_status: "info",
    event_type: "admin_template_publish_update",
    metadata: {
      note: "Super Admin template publish update applied. Catalog metadata only. No store mutation.",
      published_at: result.publishedVersion.publishedAt,
      published_version_id: result.publishedVersion.id,
      published_version_number: versionNumber || result.publishedVersion.versionNumber,
      source: "super_admin_template_management_center",
      template_id: templateId,
      template_name: templateName || result.template.name
    },
    store_id: null,
    user_id: access.user.id,
    workspace_id: null
  } as never);

  revalidatePath("/admin/templates");
}

export async function unpublishTemplateVersionAction(formData: FormData) {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can unpublish template versions.");
  }

  if (cleanText(formData.get("confirmed")) !== "1") {
    throw new Error("Super Admin unpublish confirmation is required.");
  }

  const versionId = cleanText(formData.get("versionId"));
  const templateId = cleanText(formData.get("templateId"));

  if (!versionId) {
    throw new Error("Version id is required.");
  }

  const result = await unpublishTemplateVersion(versionId);
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for template controls.");
  }

  await admin.from("monitoring_events" as never).insert({
    entity_id: result.version.id,
    entity_type: "admin_template_management",
    event_status: "info",
    event_type: "admin_template_unpublish_version",
    metadata: {
      moved_template_to_draft: result.movedTemplateToDraft,
      note: "Super Admin template version unpublished. Existing stores were not mutated.",
      source: "super_admin_template_management_center",
      template_id: templateId || result.template.id,
      version_id: result.version.id
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
