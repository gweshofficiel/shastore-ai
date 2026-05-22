import { notFound } from "next/navigation";
import {
  createDraftSection,
  deleteDraftSection,
  duplicateDraftSection,
  reorderDraftSections,
  rollbackBuilderDraft,
  saveBuilderSession,
  toggleDraftSectionVisibility,
  updateDraftSection
} from "@/lib/builder-editing-actions";
import { moveDraftSection } from "@/lib/builder-dnd-actions";
import {
  publishBuilderDraft,
  restorePublishedLayout,
  rollbackPublishedVersionAction,
  syncLivePreviewState
} from "@/lib/builder-publish-actions";
import {
  applyResponsiveLayoutOverrideAction,
  switchResponsiveBuilderMode,
  syncResponsivePreviewStateAction
} from "@/lib/builder-responsive-actions";
import {
  getResponsiveBuilderMode,
  responsiveBreakpoints,
  responsiveBuilderModes,
  resolveResponsiveSectionConfig
} from "@/lib/builder-responsive-utils";
import {
  applySectionStyleOverrideAction,
  syncVisualStylePreviewAction,
  updateThemeTokensAction
} from "@/lib/builder-visual-style-actions";
import {
  createPreviewSessionAction,
  refreshPreviewStateAction,
  syncDraftPreviewAction
} from "@/lib/builder-preview-runtime-actions";
import {
  publishStorefrontDraftAction,
  refreshStoreLaunchReadinessAction,
  rollbackLaunchPublishAction
} from "@/lib/store-launch-actions";
import { getStoreLaunchReadiness, getLaunchStatus } from "@/lib/store-launch";
import { resolveVisualThemeStyles } from "@/lib/theme-token-resolver";
import {
  compareDraftVsPublished,
  validateDraftBeforePublish
} from "@/lib/builder-publish-utils";
import {
  compareBuilderVersionsAction,
  createBuilderSnapshot,
  getBuilderVersionHistory,
  restoreBuilderVersion
} from "@/lib/builder-version-actions";
import { CopyStoreUrlButton } from "@/components/dashboard/copy-store-url-button";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { normalizeStoreThemeSettings } from "@/lib/store-theme";
import {
  addManagedStoreDomain,
  createManagedMediaFolder,
  inviteManagedStoreStaff,
  refreshManagedStoreUsage,
  removeManagedStoreStaff,
  saveManagedStoreBranding,
  saveManagedStoreSettings,
  updateManagedStoreSubscription,
  uploadManagedStoreMedia,
  verifyManagedStoreDomain
} from "@/lib/store-management-actions";
import {
  publishStoreDraft,
  saveStorePublicationSettings,
  saveStoreThemeSettings,
  unpublishStore
} from "@/lib/store-actions";
import {
  publishOwnedStorefront,
  unpublishOwnedStorefront
} from "@/lib/store-publishing-actions";
import { loadBuyerStoreManagementSnapshot } from "@/lib/buyer-store-dashboard";
import {
  aiGenerationStatusLabel,
  createAIStoreGenerationRequest,
  prepareStoreGenerationPrompt
} from "@/lib/storefront/ai-generation";
import {
  executeAIProviderRequest,
  getAIProvider,
  mapAIResponseToBuilderSchema,
  normalizeAIProviderResponse,
  resolvePromptTemplate
} from "@/lib/ai-provider";
import {
  createSimulatedGeneratedStoreSchema,
  getAIWorkerRetryPlan
} from "@/lib/storefront/ai-worker";
import { getTemplateLibrary, mapTemplateToBuilderDraft } from "@/lib/storefront/template-library";
import { aiWorkflowSteps, workflowStatusLabel } from "@/lib/storefront/ai-workflow";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PublicationRow = {
  slug: string;
  url?: string | null;
  status?: string | null;
  visibility?: string | null;
  published_at?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  og_title?: string | null;
  og_description?: string | null;
  favicon_url?: string | null;
  social_image_url?: string | null;
  custom_domain?: string | null;
  subdomain?: string | null;
  hostname?: string | null;
};

type OwnedStoreManagementRow = {
  access_role: string | null;
  access_status: string | null;
  activation_status: string;
  auth_attachment_status: string | null;
  connected_domain: string | null;
  created_at: string;
  id: string;
  internal_slug: string;
  ownership_status: string;
  requested_domain: string | null;
  source_reseller_name: string | null;
  status: string;
  store_name: string;
  transfer_code: string | null;
  visibility: string;
};

const builderStatusMessages: Record<string, string> = {
  "compare-version-missing": "Choose two builder snapshots before comparing versions.",
  "compare-version-ready": "Version comparison placeholder was prepared.",
  "create-failed": "Draft section could not be created.",
  "delete-failed": "Draft section could not be deleted.",
  "drag-draft-missing": "Initialize a builder draft before moving sections.",
  "drag-move-failed": "Section move failed and rollback was attempted.",
  "drag-move-invalid": "Section move is not valid for the current draft order.",
  "drag-move-saved": "Draft section order saved.",
  "drag-move-skipped": "Section is already in that drop position.",
  "duplicate-failed": "Draft section could not be duplicated.",
  "preview-draft-missing": "Create a builder draft before refreshing preview.",
  "preview-refreshed": "Draft preview synchronized safely.",
  "preview-refresh-failed": "Draft preview refresh failed.",
  "preview-runtime-draft-missing": "Create a builder draft before using the live preview runtime.",
  "preview-runtime-refreshed": "Live preview runtime refreshed safely.",
  "preview-runtime-refresh-failed": "Live preview runtime refresh failed.",
  "preview-runtime-session-created": "Live preview runtime session created.",
  "preview-runtime-session-failed": "Live preview runtime session could not be created.",
  "preview-runtime-sync-failed": "Live preview runtime sync failed.",
  "preview-runtime-synced": "Live preview runtime synchronized.",
  "publish-complete": "Builder draft published as a new layout version.",
  "publish-draft-missing": "Create a builder draft before publishing.",
  "publish-invalid-draft": "Draft must contain at least one visible section before publishing.",
  "publish-rollback-complete": "Publish failed and the previous active version was restored.",
  "publish-version-failed": "Published layout version could not be created.",
  "responsive-draft-missing": "Create a builder draft before using responsive preview.",
  "responsive-mode-failed": "Responsive builder mode could not be saved.",
  "responsive-mode-synced": "Responsive builder mode synchronized.",
  "responsive-override-applied": "Responsive layout override placeholder applied.",
  "responsive-override-failed": "Responsive layout override could not be applied.",
  "responsive-preview-synced": "Responsive preview state synchronized.",
  "responsive-schema-invalid": "Responsive builder schema is not breakpoint safe.",
  "restore-complete": "Active published layout was copied back into the draft.",
  "restore-draft-missing": "Create a builder draft before restoring published layout.",
  "restore-failed": "Published layout could not be restored into draft.",
  "restore-no-published": "No published layout is available to restore.",
  "restore-version-complete": "Builder snapshot restored into draft.",
  "restore-version-draft-missing": "Create a builder draft before restoring a snapshot.",
  "restore-version-failed": "Builder snapshot could not be restored.",
  "restore-version-missing": "Choose a builder snapshot before restoring.",
  "restore-version-page-missing": "Builder page is missing for this store.",
  "restore-version-unsafe": "Selected snapshot is not safe to restore for this store.",
  "rollback-no-active-version": "No active published version is available to roll back.",
  "rollback-no-previous-version": "No previous published version is available.",
  "rollback-published-complete": "Active published layout rolled back to the previous version.",
  "rollback-published-failed": "Published layout rollback failed.",
  "rollback-published-missing": "Create a builder draft before rolling back published layout.",
  "last-section-protected": "At least one draft section must remain.",
  "launch-complete": "Store launch completed and storefront visibility is public.",
  "launch-draft-missing": "Create a builder draft before launching.",
  "launch-not-authorized": "You are not authorized to launch this store.",
  "launch-publish-failed": "Store launch publish failed and rollback safety was preserved.",
  "launch-readiness-blocked": "Launch readiness has blocking items.",
  "launch-ready": "Launch readiness checklist is ready.",
  "launch-rollback-prepared": "Launch rollback placeholder was recorded and storefront visibility was set private.",
  "launch-validation-blocked": "Store launch validation found blocking items.",
  "missing-section": "Choose a draft section before editing.",
  "rollback-complete": "Builder draft rolled back to the latest saved history snapshot.",
  "rollback-empty": "No builder history snapshot is available yet.",
  "rollback-failed": "Builder draft rollback failed.",
  "rollback-invalid": "Latest builder history snapshot is not valid.",
  "section-created": "Draft section created.",
  "section-deleted": "Draft section deleted.",
  "section-duplicated": "Draft section duplicated.",
  "section-updated": "Draft section settings updated.",
  "sections-reordered": "Draft sections reordered.",
  "session-failed": "Builder edit session could not be saved.",
  "session-saved": "Builder edit session saved.",
  "snapshot-created": "Builder snapshot created.",
  "snapshot-failed": "Builder snapshot could not be created.",
  "snapshot-invalid": "Builder snapshot has no valid sections.",
  "snapshot-page-missing": "Create a builder page before saving snapshots.",
  "update-failed": "Draft section settings could not be updated.",
  "visibility-failed": "Draft section visibility could not be updated.",
  "visibility-updated": "Draft section visibility updated.",
  "visual-style-draft-missing": "Create a builder draft before customizing visual styles.",
  "visual-style-invalid": "Visual theme customization is not valid.",
  "visual-style-preview-synced": "Live styling preview synchronized.",
  "visual-style-save-failed": "Visual theme tokens could not be saved.",
  "visual-style-section-applied": "Section style override placeholder applied.",
  "visual-style-section-failed": "Section style override could not be applied.",
  "visual-style-section-missing": "Choose a draft section before applying style overrides.",
  "visual-style-updated": "Visual theme tokens updated for draft preview."
};

function formatOwnedStatus(value: string | null | undefined, fallback = "not connected") {
  return value ? value.replace(/_/g, " ") : fallback;
}

function ownedBadgeClass(status: string | null | undefined) {
  if (status === "active" || status === "activated" || status === "claimed") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (status === "failed" || status === "revoked" || status === "suspended") {
    return "bg-red-100 text-red-700";
  }

  if (status === "delivered" || status === "transferred") {
    return "bg-blue-100 text-blue-700";
  }

  return "bg-amber-100 text-amber-700";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function textValue(record: Record<string, unknown> | undefined, key: string, fallback = "Not set") {
  const value = record?.[key];
  return typeof value === "string" && value.trim() ? value : fallback;
}

function numberValue(record: Record<string, unknown> | undefined, key: string, fallback = "Unlimited") {
  const value = record?.[key];
  return typeof value === "number" ? value.toLocaleString() : fallback;
}

function assetValue(record: Record<string, unknown> | undefined, key: string) {
  const assets = record?.branding_assets;

  if (!assets || typeof assets !== "object" || Array.isArray(assets)) {
    return "";
  }

  const value = (assets as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

function typographyValue(record: Record<string, unknown> | undefined, key: string, fallback = "inter") {
  const typography = record?.typography;

  if (!typography || typeof typography !== "object" || Array.isArray(typography)) {
    return fallback;
  }

  const value = (typography as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value : fallback;
}

function nestedTextValue(record: Record<string, unknown> | undefined, key: string, fallback = "") {
  const settings = record?.settings;

  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    return fallback;
  }

  const value = (settings as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value : fallback;
}

export default async function StoreDraftPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    saved?: string;
    published?: string;
    unpublished?: string;
    error?: string;
    management?: string;
    builder?: string;
    "management-branding-save-failed"?: string;
    storefront?: string;
    theme?: string;
    publication?: string;
  }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    notFound();
  }

  const { data: store } = await supabase
    .from("stores")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!store) {
    const { data: ownedStoreRows, error: ownedStoreError } = await supabase.rpc(
      "get_claimed_store_instances_for_current_user" as never
    );
    const ownedStore = ((ownedStoreRows ?? []) as OwnedStoreManagementRow[]).find(
      (row) => row.id === id
    );

    if (ownedStoreError || !ownedStore) {
      notFound();
    }

    const { defaults, snapshot: management } = await loadBuyerStoreManagementSnapshot(
      supabase,
      ownedStore.id,
      {
        id: ownedStore.id,
        internal_slug: ownedStore.internal_slug,
        store_name: ownedStore.store_name
      }
    );
    const settings = management.settings;
    const branding = management.branding;
    const subscription = management.subscription;
    const planLimits = management.planLimits;
    const domains = management.domains;
    const staff = management.staff;
    const roles = management.roles;
    const media = management.media;
    const usage = management.usage;
    const tabs = [
      "Overview",
      "Settings",
      "Branding",
      "Domains",
      "Subscription",
      "Staff",
      "Media",
      "Templates",
      "Analytics"
    ];
    const { data: activeThemeData } = await supabase
      .from("store_themes" as never)
      .select("theme_id, theme_key, layout_key, typography, border_radius, spacing, color_palette, logo_config")
      .eq("store_instance_id", ownedStore.id)
      .eq("is_active", true)
      .maybeSingle();
    const activeTheme = (activeThemeData ?? {}) as Record<string, unknown>;
    const { data: sectionData } = await supabase
      .from("store_sections" as never)
      .select("id, section_type, section_order, section_enabled, config")
      .eq("store_instance_id", ownedStore.id)
      .order("section_order", { ascending: true })
      .order("created_at", { ascending: true });
    const sections = Array.isArray(sectionData)
      ? (sectionData as Record<string, unknown>[])
      : [];
    const { data: builderStateData } = await supabase
      .from("store_builder_states" as never)
      .select("status, page_schema, draft_schema, published_schema, layout_tree, responsive_config, editor_state, updated_at")
      .eq("store_instance_id", ownedStore.id)
      .maybeSingle();
    const { data: builderPageData } = await supabase
      .from("builder_pages" as never)
      .select("id, status, active_version_id, schema_version, updated_at")
      .eq("store_instance_id", ownedStore.id)
      .eq("page_key", "home")
      .maybeSingle();
    const builderPage = (builderPageData ?? {}) as Record<string, unknown>;
    const builderPageId = textValue(builderPage, "id", "");
    const { data: builderDraftData } = builderPageId
      ? await supabase
          .from("builder_drafts" as never)
          .select("id, has_unsaved_changes, updated_at, editor_state, draft_schema")
          .eq("builder_page_id", builderPageId)
          .maybeSingle()
      : { data: null };
    const { data: builderVersionsData } = builderPageId
      ? await supabase
          .from("builder_layout_versions" as never)
          .select("id, version_number, status, published_at, layout_schema")
          .eq("builder_page_id", builderPageId)
          .order("version_number", { ascending: false })
          .limit(5)
      : { data: [] };
    const builderState = (builderStateData ?? {}) as Record<string, unknown>;
    const builderDraft = (builderDraftData ?? {}) as Record<string, unknown>;
    const builderVersions = Array.isArray(builderVersionsData)
      ? (builderVersionsData as Record<string, unknown>[])
      : [];
    const builderDraftId = textValue(builderDraft, "id", "");
    const { data: builderSectionDraftData } = builderDraftId
      ? await supabase
          .from("store_builder_section_drafts" as never)
          .select("id, section_key, section_type, section_order, section_enabled, settings, editor_metadata")
          .eq("store_instance_id", ownedStore.id)
          .order("section_order", { ascending: true })
          .order("created_at", { ascending: true })
      : { data: [] };
    const builderSectionDrafts = Array.isArray(builderSectionDraftData)
      ? (builderSectionDraftData as Record<string, unknown>[])
      : [];
    const { data: responsiveConfigData } = builderDraftId
      ? await supabase
          .from("builder_responsive_configs" as never)
          .select("id, breakpoint_key, config, section_overrides, layout_overrides, typography_overrides, spacing_overrides, visibility_overrides, updated_at")
          .eq("store_instance_id", ownedStore.id)
          .eq("builder_draft_id", builderDraftId)
          .order("breakpoint_key", { ascending: true })
      : { data: [] };
    const responsiveConfigs = Array.isArray(responsiveConfigData)
      ? (responsiveConfigData as Record<string, unknown>[])
      : [];
    const { data: responsiveLayoutStateData } = builderDraftId
      ? await supabase
          .from("responsive_layout_states" as never)
          .select("active_breakpoint, preview_state, device_frame, hydration_state, layout_state, updated_at")
          .eq("store_instance_id", ownedStore.id)
          .eq("builder_draft_id", builderDraftId)
          .maybeSingle()
      : { data: null };
    const responsiveLayoutState = (responsiveLayoutStateData ?? {}) as Record<string, unknown>;
    const { data: visualStyleOverrideData } = builderDraftId
      ? await supabase
          .from("store_theme_style_overrides" as never)
          .select("id, override_scope, section_id, color_tokens, typography_tokens, spacing_tokens, radius_tokens, button_tokens, section_style_overrides, global_theme_tokens, updated_at")
          .eq("store_instance_id", ownedStore.id)
          .eq("builder_draft_id", builderDraftId)
          .order("updated_at", { ascending: false })
          .limit(3)
      : { data: [] };
    const visualStyleOverrides = Array.isArray(visualStyleOverrideData)
      ? (visualStyleOverrideData as Record<string, unknown>[])
      : [];
    const { data: visualStyleStateData } = builderDraftId
      ? await supabase
          .from("builder_visual_style_states" as never)
          .select("preview_tokens, preview_state, sidebar_state, selected_style_target, hydration_state, updated_at")
          .eq("store_instance_id", ownedStore.id)
          .eq("builder_draft_id", builderDraftId)
          .maybeSingle()
      : { data: null };
    const visualStyleState = (visualStyleStateData ?? {}) as Record<string, unknown>;
    const { data: previewSessionData } = builderDraftId
      ? await supabase
          .from("builder_preview_sessions" as never)
          .select("id, session_status, preview_mode, hydration_state, isolation_state, sync_state, updated_at")
          .eq("store_instance_id", ownedStore.id)
          .eq("builder_draft_id", builderDraftId)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : { data: null };
    const previewSession = (previewSessionData ?? {}) as Record<string, unknown>;
    const { data: previewRuntimeStateData } = builderDraftId
      ? await supabase
          .from("preview_runtime_states" as never)
          .select("runtime_status, sync_source, responsive_state, hydration_state, isolation_state, error_state, updated_at")
          .eq("store_instance_id", ownedStore.id)
          .eq("builder_draft_id", builderDraftId)
          .maybeSingle()
      : { data: null };
    const previewRuntimeState = (previewRuntimeStateData ?? {}) as Record<string, unknown>;
    const { data: previewRenderCacheData } = builderDraftId
      ? await supabase
          .from("preview_render_cache" as never)
          .select("cache_status, cache_key, expires_at, updated_at")
          .eq("store_instance_id", ownedStore.id)
          .eq("builder_draft_id", builderDraftId)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : { data: null };
    const previewRenderCache = (previewRenderCacheData ?? {}) as Record<string, unknown>;
    const { data: launchChecklistData } = await supabase
      .from("store_launch_checklists" as never)
      .select("id, checklist_status, checklist_items, readiness_score, blocking_reasons, launch_metadata, completed_at, updated_at")
      .eq("store_instance_id", ownedStore.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const launchChecklist = (launchChecklistData ?? {}) as Record<string, unknown>;
    const { data: launchValidationData } = await supabase
      .from("store_publish_validations" as never)
      .select("validation_status, validation_results, warnings, blocking_errors, created_at")
      .eq("store_instance_id", ownedStore.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const launchValidationRecord = (launchValidationData ?? {}) as Record<string, unknown>;
    const { data: launchEventsData } = await supabase
      .from("store_launch_events" as never)
      .select("id, event_type, event_status, event_payload, created_at")
      .eq("store_instance_id", ownedStore.id)
      .order("created_at", { ascending: false })
      .limit(3);
    const launchEvents = Array.isArray(launchEventsData)
      ? (launchEventsData as Record<string, unknown>[])
      : [];
    const { data: builderSessionData } = builderPageId
      ? await supabase
          .from("store_builder_edit_sessions" as never)
          .select("id, session_status, responsive_mode, selected_section_id, updated_at")
          .eq("store_instance_id", ownedStore.id)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : { data: null };
    const builderSession = (builderSessionData ?? {}) as Record<string, unknown>;
    const { data: builderHistoryData } = builderPageId
      ? await supabase
          .from("store_builder_history" as never)
          .select("id, action_key, created_at")
          .eq("store_instance_id", ownedStore.id)
          .order("created_at", { ascending: false })
          .limit(5)
      : { data: [] };
    const builderHistory = Array.isArray(builderHistoryData)
      ? (builderHistoryData as Record<string, unknown>[])
      : [];
    const builderVersionHistory = await getBuilderVersionHistory(ownedStore.id);
    const builderSnapshots = builderVersionHistory.snapshots;
    const builderPublishHistory = builderVersionHistory.publishHistory;
    const builderPageSchema =
      builderState.page_schema && typeof builderState.page_schema === "object"
        ? (builderState.page_schema as Record<string, unknown>)
        : {};
    const builderSections = Array.isArray(builderPageSchema.sections)
      ? builderPageSchema.sections
      : [];
    const builderDraftSchema =
      builderDraft.draft_schema && typeof builderDraft.draft_schema === "object"
        ? (builderDraft.draft_schema as Record<string, unknown>)
        : {};
    const builderDraftSections = Array.isArray(builderDraftSchema.sections)
      ? builderDraftSchema.sections
      : [];
    const activePublishedVersion =
      builderVersions.find(
        (version) => textValue(version, "id", "") === textValue(builderPage, "active_version_id", "")
      ) ?? builderVersions[0] ?? {};
    const activePublishedSchema =
      activePublishedVersion.layout_schema &&
      typeof activePublishedVersion.layout_schema === "object" &&
      !Array.isArray(activePublishedVersion.layout_schema)
        ? (activePublishedVersion.layout_schema as never)
        : null;
    const draftPublishValidation = validateDraftBeforePublish({
      layoutTree:
        builderDraftSchema.layoutTree && typeof builderDraftSchema.layoutTree === "object"
          ? (builderDraftSchema.layoutTree as Record<string, unknown>)
          : builderDraftSchema.layout_tree && typeof builderDraftSchema.layout_tree === "object"
            ? (builderDraftSchema.layout_tree as Record<string, unknown>)
            : { root: { children: [] } },
      responsive:
        builderDraftSchema.responsive && typeof builderDraftSchema.responsive === "object"
          ? (builderDraftSchema.responsive as never)
          : { desktop: {}, mobile: {}, tablet: {} },
      sections: builderDraftSections as never,
      version: typeof builderDraftSchema.version === "number" ? builderDraftSchema.version : 1
    });
    const launchReadiness = getStoreLaunchReadiness({
      activeTheme,
      activeVersionId: textValue(activePublishedVersion, "id", ""),
      builderDraftSchema: draftPublishValidation.schema,
      connectedDomain: ownedStore.connected_domain ?? ownedStore.requested_domain,
      domains,
      storeStatus: ownedStore.status,
      storeVisibility: ownedStore.visibility
    });
    const launchStatus = getLaunchStatus({
      activeTheme,
      activeVersionId: textValue(activePublishedVersion, "id", ""),
      builderDraftSchema: draftPublishValidation.schema,
      connectedDomain: ownedStore.connected_domain ?? ownedStore.requested_domain,
      domains,
      storeStatus: ownedStore.status,
      storeVisibility: ownedStore.visibility
    });
    const persistedChecklistItems = Array.isArray(launchChecklist.checklist_items)
      ? (launchChecklist.checklist_items as Array<Record<string, unknown>>)
      : [];
    const launchChecklistItems = persistedChecklistItems.length
      ? persistedChecklistItems
      : (launchReadiness.items as unknown as Array<Record<string, unknown>>);
    const launchWarnings = Array.isArray(launchValidationRecord.warnings)
      ? (launchValidationRecord.warnings as Array<Record<string, unknown>>)
      : (launchReadiness.warnings as unknown as Array<Record<string, unknown>>);
    const launchBlockingReasons = Array.isArray(launchValidationRecord.blocking_errors)
      ? (launchValidationRecord.blocking_errors as Array<Record<string, unknown>>)
      : (launchReadiness.blockingReasons as unknown as Array<Record<string, unknown>>);
    const draftPublishedComparison = compareDraftVsPublished(
      draftPublishValidation.schema,
      activePublishedSchema
    );
    const visualEditorSections = builderSectionDrafts.length
      ? builderSectionDrafts
      : builderDraftSections.length
        ? builderDraftSections
        : builderSections;
    const editorState =
      builderState.editor_state && typeof builderState.editor_state === "object"
        ? (builderState.editor_state as Record<string, unknown>)
        : {};
    const draftEditorState =
      builderDraft.editor_state && typeof builderDraft.editor_state === "object"
        ? (builderDraft.editor_state as Record<string, unknown>)
        : {};
    const builderMode = getResponsiveBuilderMode(
      draftEditorState.mode ?? editorState.mode ?? responsiveLayoutState.active_breakpoint
    );
    const selectedSectionId = textValue(editorState, "selectedSectionId", "None selected");
    const draggingSectionId = textValue(editorState, "draggingSectionId", "Idle");
    const activeResponsiveBreakpoint = responsiveBreakpoints[builderMode];
    const previewRuntimeHydration =
      previewRuntimeState.hydration_state && typeof previewRuntimeState.hydration_state === "object"
        ? (previewRuntimeState.hydration_state as Record<string, unknown>)
        : {};
    const previewRuntimeIsolation =
      previewRuntimeState.isolation_state && typeof previewRuntimeState.isolation_state === "object"
        ? (previewRuntimeState.isolation_state as Record<string, unknown>)
        : {};
    const previewRuntimeErrors =
      previewRuntimeState.error_state && typeof previewRuntimeState.error_state === "object"
        ? (previewRuntimeState.error_state as Record<string, unknown>)
        : {};
    const previewSessionSyncState =
      previewSession.sync_state && typeof previewSession.sync_state === "object"
        ? (previewSession.sync_state as Record<string, unknown>)
        : {};
    const activeResponsiveConfig =
      responsiveConfigs.find(
        (config) => textValue(config, "breakpoint_key", "desktop") === builderMode
      ) ?? {};
    const activeResponsivePreview =
      responsiveLayoutState.preview_state && typeof responsiveLayoutState.preview_state === "object"
        ? (responsiveLayoutState.preview_state as Record<string, unknown>)
        : {};
    const firstResponsiveSection = draftPublishValidation.schema.sections[0] ?? null;
    const firstResponsiveSectionConfig = firstResponsiveSection
      ? resolveResponsiveSectionConfig(firstResponsiveSection, builderMode)
      : {};
    const latestVisualStyleOverride = visualStyleOverrides[0] ?? {};
    const resolvedVisualThemeStyles = resolveVisualThemeStyles(activeTheme, {
      button: isRecord(latestVisualStyleOverride.button_tokens)
        ? latestVisualStyleOverride.button_tokens
        : {},
      colors: isRecord(latestVisualStyleOverride.color_tokens)
        ? latestVisualStyleOverride.color_tokens
        : {},
      radius: isRecord(latestVisualStyleOverride.radius_tokens)
        ? latestVisualStyleOverride.radius_tokens
        : {},
      spacing: isRecord(latestVisualStyleOverride.spacing_tokens)
        ? latestVisualStyleOverride.spacing_tokens
        : {},
      typography: isRecord(latestVisualStyleOverride.typography_tokens)
        ? latestVisualStyleOverride.typography_tokens
        : {}
    });
    const visualStylePreview =
      visualStyleState.preview_state && typeof visualStyleState.preview_state === "object"
        ? (visualStyleState.preview_state as Record<string, unknown>)
        : {};
    const firstStyleSection = builderSectionDrafts[0] ?? visualEditorSections[0] ?? null;
    const firstStyleSectionId = firstStyleSection
      ? String(firstStyleSection.id ?? firstStyleSection.section_key ?? "")
      : "";
    const previewSyncPending =
      typeof draftEditorState.previewSyncPending === "boolean"
        ? draftEditorState.previewSyncPending
        : typeof editorState.previewSyncPending === "boolean"
          ? editorState.previewSyncPending
        : false;
    const hasUnsavedChanges =
      builderDraft.has_unsaved_changes === true ||
      previewSyncPending;
    const { data: aiGenerationsData } = await supabase
      .from("ai_store_generations" as never)
      .select("id, status, niche, store_type, language, brand_style, layout_intent, generated_store_schema, created_at")
      .eq("store_instance_id", ownedStore.id)
      .order("created_at", { ascending: false })
      .limit(5);
    const aiGenerations = Array.isArray(aiGenerationsData)
      ? (aiGenerationsData as Record<string, unknown>[])
      : [];
    const { data: aiJobsData } = await supabase
      .from("ai_generation_jobs" as never)
      .select("id, status, job_type, provider, created_at")
      .eq("store_instance_id", ownedStore.id)
      .order("created_at", { ascending: false })
      .limit(5);
    const aiJobs = Array.isArray(aiJobsData)
      ? (aiJobsData as Record<string, unknown>[])
      : [];
    const { data: aiQueueData } = await supabase
      .from("ai_generation_queue" as never)
      .select("id, generation_id, workflow_state, queue_status, attempts, max_attempts, error_message, created_at")
      .eq("store_instance_id", ownedStore.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const aiQueue = (aiQueueData ?? {}) as Record<string, unknown>;
    const aiQueueId = textValue(aiQueue, "id", "");
    const { data: aiStepsData } = aiQueueId
      ? await supabase
          .from("ai_generation_steps" as never)
          .select("id, step_order, step_key, step_status, started_at, completed_at, error_message")
          .eq("queue_id", aiQueueId)
          .order("step_order", { ascending: true })
      : { data: [] };
    const aiWorkflowStepRows = Array.isArray(aiStepsData)
      ? (aiStepsData as Record<string, unknown>[])
      : [];
    const aiStepRowsByKey = new Map(
      aiWorkflowStepRows.map((step) => [textValue(step, "step_key", ""), step])
    );
    const aiWorkflowProgressSteps = aiWorkflowSteps.map((step) => {
      const row = aiStepRowsByKey.get(step.key);

      return {
        key: step.key,
        label: step.key.replace(/_/g, " "),
        order: step.order,
        status: row ? textValue(row, "step_status", "pending") : "pending"
      };
    });
    const { data: aiLogsData } = aiQueueId
      ? await supabase
          .from("ai_generation_logs" as never)
          .select("id, log_level, message, created_at")
          .eq("queue_id", aiQueueId)
          .order("created_at", { ascending: false })
          .limit(5)
      : { data: [] };
    const aiLogs = Array.isArray(aiLogsData)
      ? (aiLogsData as Record<string, unknown>[])
      : [];
    const aiQueueAttempts =
      typeof aiQueue.attempts === "number" ? aiQueue.attempts : 0;
    const aiQueueMaxAttempts =
      typeof aiQueue.max_attempts === "number" ? aiQueue.max_attempts : 3;
    const aiRetryPlan = getAIWorkerRetryPlan({
      attempts: aiQueueAttempts,
      max_attempts: aiQueueMaxAttempts
    });
    const aiRequestPreview = createAIStoreGenerationRequest({
      brandStyle: "modern",
      language: textValue(settings, "language", "en"),
      layoutIntent: "conversion",
      niche: textValue(settings, "store_name", ownedStore.store_name),
      storeType: "general",
      targetAudience: "Online shoppers"
    });
    const aiPromptPreview = prepareStoreGenerationPrompt(aiRequestPreview);
    const simulatedResultPreview = createSimulatedGeneratedStoreSchema(aiRequestPreview);
    const aiProvider = await getAIProvider(ownedStore.id);
    const aiPromptTemplate = await resolvePromptTemplate({
      request: aiRequestPreview,
      storeInstanceId: ownedStore.id
    });
    const aiProviderResponsePreview = await executeAIProviderRequest(aiProvider, {
      prompt: aiPromptTemplate.body,
      requestPayload: {
        layoutIntent: aiRequestPreview.layoutIntent,
        niche: aiRequestPreview.niche,
        storeType: aiRequestPreview.storeType
      },
      responseFormat: "json_schema",
      storeInstanceId: ownedStore.id
    });
    const normalizedAIProviderPreview = normalizeAIProviderResponse(aiProviderResponsePreview);
    const mappedAIProviderSchemaPreview = mapAIResponseToBuilderSchema(aiProviderResponsePreview.raw);
    const { data: aiProviderResultsData } = await supabase
      .from("ai_generation_results" as never)
      .select("id, result_status, token_usage, metadata, created_at")
      .eq("store_instance_id", ownedStore.id)
      .order("created_at", { ascending: false })
      .limit(3);
    const aiProviderResults = Array.isArray(aiProviderResultsData)
      ? (aiProviderResultsData as Record<string, unknown>[])
      : [];
    const latestGeneratedStoreSchema = aiGenerations[0]?.generated_store_schema;
    const generatedResultPreview =
      latestGeneratedStoreSchema &&
      typeof latestGeneratedStoreSchema === "object" &&
      !Array.isArray(latestGeneratedStoreSchema)
        ? latestGeneratedStoreSchema
        : simulatedResultPreview;
    const templateLibrary = await getTemplateLibrary();
    const templateCategories = templateLibrary.categories.filter((category) =>
      [
        "fashion",
        "beauty",
        "perfumes",
        "electronics",
        "watches",
        "furniture",
        "gym",
        "pets",
        "restaurants",
        "cafes",
        "gadgets"
      ].includes(category.category_key)
    );
    const featuredTemplates = templateLibrary.templates.slice(0, 6);

    return (
      <div className="store-owner-management grid gap-6 lg:gap-8">
        <style>
          {`
            .store-owner-management #domains form,
            .store-owner-management #subscription form,
            .store-owner-management #staff form,
            .store-owner-management #media form,
            .store-owner-management #analytics form {
              pointer-events: none;
              opacity: 0.7;
            }

            .store-owner-management #domains input,
            .store-owner-management #domains textarea,
            .store-owner-management #domains select,
            .store-owner-management #subscription input,
            .store-owner-management #subscription textarea,
            .store-owner-management #subscription select,
            .store-owner-management #staff input,
            .store-owner-management #staff textarea,
            .store-owner-management #staff select,
            .store-owner-management #media input,
            .store-owner-management #media textarea,
            .store-owner-management #media select,
            .store-owner-management #analytics input,
            .store-owner-management #analytics textarea,
            .store-owner-management #analytics select {
              background: #f8fafc;
            }
          `}
        </style>
        <PageHeader
          action={<ButtonLink href="/dashboard/stores">Back to stores</ButtonLink>}
          description="Buyer-owned store management foundation backed by ownership links and access permissions."
          title={ownedStore.store_name}
        />
        {query["management-branding-save-failed"] === "bucket-missing" ? (
          <Card className="border-red-200 bg-red-50 p-5">
            <p className="text-sm font-bold text-red-700">
              Branding upload failed because the `store-branding` bucket is missing.
            </p>
          </Card>
        ) : query.management === "settings-save-failed" ? (
          <Card className="border-red-200 bg-red-50 p-5">
            <p className="text-sm font-bold text-red-700">
              Store settings could not be saved. Your changes were not applied.
            </p>
          </Card>
        ) : query.management === "branding-save-failed" ? (
          <Card className="border-red-200 bg-red-50 p-5">
            <p className="text-sm font-bold text-red-700">
              Branding text and colors could not be saved. Your changes were not applied.
            </p>
          </Card>
        ) : query.management === "read-only" ? (
          <Card className="border-blue-200 bg-blue-50 p-5">
            <p className="text-sm font-bold text-blue-900">
              This section is read-only temporarily. No changes were saved.
            </p>
          </Card>
        ) : query.management ? (
          <Card className="border-emerald-200 bg-emerald-50 p-5">
            <p className="text-sm font-bold text-emerald-700">
              Store management updated: {query.management.replace(/-/g, " ")}.
            </p>
          </Card>
        ) : null}
        <Card className="border-blue-200 bg-blue-50 p-5">
          <p className="text-sm font-bold text-blue-900">
            Store management is partially read-only.
          </p>
          <p className="mt-2 text-sm font-semibold leading-6 text-blue-800">
            Store settings, branding text/colors, logo upload, and favicon upload can now be
            saved. Media, domains, staff, subscriptions, and analytics writes remain disabled.
          </p>
        </Card>
        {query.storefront === "published" ? (
          <Card className="border-emerald-200 bg-emerald-50 p-5">
            <p className="text-sm font-bold text-emerald-700">
              Storefront published. Public visitors can now view /store/{ownedStore.internal_slug}.
            </p>
          </Card>
        ) : query.storefront === "unpublished" ? (
          <Card className="border-amber-200 bg-amber-50 p-5">
            <p className="text-sm font-bold text-amber-900">
              Storefront unpublished. The public storefront is hidden, but owner preview remains available.
            </p>
          </Card>
        ) : query.storefront === "publish-failed" || query.storefront === "unpublish-failed" ? (
          <Card className="border-red-200 bg-red-50 p-5">
            <p className="text-sm font-bold text-red-700">
              Storefront visibility could not be updated. Please try again.
            </p>
          </Card>
        ) : null}
        {!defaults.ok ? (
          <Card className="border-amber-200 bg-amber-50 p-5">
            <p className="text-sm font-bold text-amber-900">
              Store management records are using safe read-only fallback values.
            </p>
            <p className="mt-2 text-sm font-semibold leading-6 text-amber-800">
              {defaults.schemaMissing
                ? "The buyer dashboard tables or snapshot RPC are not available on this Supabase project. The page will still render from claimed ownership data."
                : "Store management records could not be read automatically. You can still view this workspace with safe empty values."}
            </p>
            {defaults.error?.message ? (
              <p className="mt-2 font-mono text-xs text-amber-900">{defaults.error.message}</p>
            ) : null}
          </Card>
        ) : null}
        <Card className="p-5 lg:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                Owned Store
              </p>
              <h2 className="mt-3 text-2xl font-black tracking-[-0.03em] text-ink">
                {ownedStore.store_name}
              </h2>
              <p className="mt-2 font-mono text-xs font-bold text-muted">
                {ownedStore.internal_slug}
              </p>
            </div>
            <span
              className={`w-fit rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${ownedBadgeClass(
                ownedStore.ownership_status
              )}`}
            >
              {formatOwnedStatus(ownedStore.ownership_status)}
            </span>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                Store Status
              </p>
              <p className="mt-2 text-sm font-black capitalize text-ink">
                {formatOwnedStatus(ownedStore.status)}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                Activation
              </p>
              <p className="mt-2 text-sm font-black capitalize text-ink">
                {formatOwnedStatus(ownedStore.activation_status)}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                Access
              </p>
              <p className="mt-2 text-sm font-black capitalize text-ink">
                {ownedStore.access_role ?? "owner"} {ownedStore.access_status ?? "pending"}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                Domain
              </p>
              <p className="mt-2 text-sm font-black text-ink">
                {ownedStore.connected_domain ??
                  ownedStore.requested_domain ??
                  "Not connected"}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                Public Storefront
              </p>
              <p className="mt-2 text-sm font-black capitalize text-ink">
                {ownedStore.visibility === "public" ? "Published / public" : "Draft / private"}
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-3xl border border-dashed border-slate-300 bg-white p-5">
            <p className="text-sm font-black text-ink">Management tools coming next</p>
            <p className="mt-2 text-sm font-semibold leading-6 text-muted">
              Products, theme, domains, store payments, orders, analytics, staff accounts, and role
              permissions will attach to this owned store record without touching reseller flows.
            </p>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <ButtonLink
              href={`/dashboard/stores/preview/${ownedStore.internal_slug}`}
              target="_blank"
            >
              View store preview
            </ButtonLink>
            {ownedStore.visibility === "public" ? (
              <>
                <ButtonLink href={`/store/${ownedStore.internal_slug}`} target="_blank">
                  Open public store
                </ButtonLink>
                <CopyStoreUrlButton url={`/store/${ownedStore.internal_slug}`} />
                <form action={unpublishOwnedStorefront}>
                  <input name="storeId" type="hidden" value={ownedStore.id} />
                  <Button type="submit" variant="secondary">
                    Unpublish store
                  </Button>
                </form>
              </>
            ) : (
              <form action={publishOwnedStorefront}>
                <input name="storeId" type="hidden" value={ownedStore.id} />
                <Button type="submit">Publish store</Button>
              </form>
            )}
            <ButtonLink href="/dashboard/stores" variant="secondary">
              Back to stores
            </ButtonLink>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <a
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-muted transition hover:border-slate-400 hover:text-ink"
                href={`#${tab.toLowerCase()}`}
                key={tab}
              >
                {tab}
              </a>
            ))}
          </div>
        </Card>
        {query.builder ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-4 text-sm font-semibold text-muted">
            {builderStatusMessages[query.builder] ?? "Builder draft action completed."}
          </div>
        ) : null}
        <section className="grid gap-6" id="overview">
          <Card className="p-5 lg:p-6">
            <div className="flex flex-col gap-2">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                Overview
              </p>
              <h2 className="text-xl font-black tracking-[-0.02em] text-ink">
                Store management workspace
              </h2>
              <p className="text-sm leading-6 text-muted">
                This workspace is scoped to one claimed store instance. Store settings, roles,
                domains, subscriptions, usage, and media records are isolated by store ownership.
              </p>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                  Management Status
                </p>
                <p className="mt-2 text-sm font-black capitalize text-ink">
                  {textValue(settings, "store_status", "Draft")}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                  Plan
                </p>
                <p className="mt-2 text-sm font-black capitalize text-ink">
                  {textValue(subscription, "plan_id", "Starter")}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                  Domains
                </p>
                <p className="mt-2 text-sm font-black text-ink">{domains.length}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                  Media Assets
                </p>
                <p className="mt-2 text-sm font-black text-ink">{media.length}</p>
              </div>
            </div>
          </Card>
          <Card className="p-5 lg:p-6">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
              Theme engine
            </p>
            <h2 className="mt-2 text-xl font-black tracking-[-0.02em] text-ink">
              Active layout foundation
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Tenant-safe theme tokens are prepared for marketplace themes,
              AI-generated styles, drag-and-drop sections, and template exports.
            </p>
            <div className="mt-5 grid gap-3">
              {[
                ["Theme", textValue(activeTheme, "theme_key", "modern")],
                ["Layout", textValue(activeTheme, "layout_key", "classic")],
                ["Spacing", textValue(activeTheme, "spacing", "comfortable")],
                ["Radius", textValue(activeTheme, "border_radius", "2rem")]
              ].map(([label, value]) => (
                <div
                  className="rounded-3xl border border-slate-200 bg-slate-50 p-4"
                  key={label}
                >
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                    {label}
                  </p>
                  <p className="mt-2 text-sm font-black text-ink">{value}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 grid gap-3 rounded-3xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                Layout preview placeholders
              </p>
              <div className="grid gap-2 sm:grid-cols-3">
                {["Hero", "Catalog", "Footer"].map((section) => (
                  <div
                    className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-3 text-center text-xs font-black uppercase tracking-[0.16em] text-muted"
                    key={section}
                  >
                    {section}
                  </div>
                ))}
              </div>
            </div>
          </Card>
          <Card className="p-5 lg:p-6">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
              Page builder
            </p>
            <h2 className="mt-2 text-xl font-black tracking-[-0.02em] text-ink">
              Store sections foundation
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Dynamic storefront sections are tenant-scoped and ready for future
              drag-drop ordering, AI layouts, reusable sections, and theme presets.
            </p>
            <div className="mt-5 grid gap-3">
              {sections.length ? (
                sections.slice(0, 8).map((section, index) => (
                  <div
                    className="rounded-3xl border border-slate-200 bg-slate-50 p-4"
                    key={String(section.id ?? `${textValue(section, "section_type", "section")}-${index}`)}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-black capitalize text-ink">
                          {textValue(section, "section_type", "section").replace(/_/g, " ")}
                        </p>
                        <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-muted">
                          Order {textValue(section, "section_order", String(index + 1))}
                        </p>
                      </div>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-muted">
                        {section.section_enabled === false ? "Disabled" : "Enabled"}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-5">
                  <p className="text-sm font-black text-ink">No custom sections yet.</p>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    The storefront is using the stable fallback layout. Add-section,
                    reorder, and visual editor controls can build on this table.
                  </p>
                </div>
              )}
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-3">
              {["Add section", "Reorder", "Preview"].map((label) => (
                <div
                  className="rounded-2xl border border-dashed border-slate-300 bg-white p-3 text-center text-xs font-black uppercase tracking-[0.16em] text-muted"
                  key={label}
                >
                  {label}
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-5 lg:p-6">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
              Visual editor
            </p>
            <h2 className="mt-2 text-xl font-black tracking-[-0.02em] text-ink">
              Builder schema foundation
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Page schema, section props, layout trees, responsive settings, and
              draft/publish state are prepared for a future drag-drop editor.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {[
                ["State", textValue(builderState, "status", "draft")],
                ["Schema sections", String(builderSections.length)],
                ["Mode", builderMode]
              ].map(([label, value]) => (
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4" key={label}>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                    {label}
                  </p>
                  <p className="mt-2 text-sm font-black capitalize text-ink">{value}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 grid gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                Interaction state
              </p>
              <div className="grid gap-2 sm:grid-cols-3">
                {[
                  ["Selected", selectedSectionId],
                  ["Dragging", draggingSectionId],
                  ["Preview sync", previewSyncPending ? "Pending" : "Ready"]
                ].map(([label, value]) => (
                  <div className="rounded-2xl bg-white p-3" key={label}>
                    <p className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-slate-400">
                      {label}
                    </p>
                    <p className="mt-1 truncate text-xs font-black text-ink">{value}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-5 grid gap-3 rounded-3xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                Persistence engine
              </p>
              <div className="grid gap-2 sm:grid-cols-3">
                {[
                  ["Unsaved", hasUnsavedChanges ? "Changes pending" : "Clean"],
                  ["Draft", textValue(builderDraft, "updated_at", "Not saved")],
                  ["Versions", String(builderVersions.length)]
                ].map(([label, value]) => (
                  <div className="rounded-2xl bg-slate-50 p-3" key={label}>
                    <p className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-slate-400">
                      {label}
                    </p>
                    <p className="mt-1 truncate text-xs font-black text-ink">{value}</p>
                  </div>
                ))}
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                {["Save draft", "Publish layout", "Restore published"].map((label) => (
                  <div
                    className="rounded-2xl border border-dashed border-slate-300 bg-white p-3 text-center text-xs font-black uppercase tracking-[0.16em] text-muted"
                    key={label}
                  >
                    {label}
                  </div>
                ))}
              </div>
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-3">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                  Version history preparation
                </p>
                <p className="mt-2 text-sm leading-6 text-muted">
                  {builderVersions.length
                    ? `${builderVersions.length} layout version records are ready for restore/export flows.`
                    : "Published layout versions will appear here after publish actions are wired."}
                </p>
              </div>
            </div>
            <div className="mt-5 grid gap-4 rounded-3xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                    Live preview and publish
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    Preview refresh and publishing are isolated to builder drafts and
                    versioned layouts. Storefront visibility and public routes are
                    not changed by publishing a builder version.
                  </p>
                </div>
                <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-muted">
                  {previewSyncPending ? "Preview pending" : "Preview synced"}
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-4">
                {[
                  ["Draft sections", String(draftPublishedComparison.draftSectionCount)],
                  ["Published sections", String(draftPublishedComparison.publishedSectionCount)],
                  ["Schema changed", draftPublishedComparison.schemaChanged ? "Yes" : "No"],
                  ["Order changed", draftPublishedComparison.orderChanged ? "Yes" : "No"]
                ].map(([label, value]) => (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3" key={label}>
                    <p className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-slate-400">
                      {label}
                    </p>
                    <p className="mt-1 text-sm font-black text-ink">{value}</p>
                  </div>
                ))}
              </div>
              <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                    Isolated draft preview
                  </p>
                  <div className="mt-4 rounded-[2rem] border border-dashed border-slate-300 bg-white p-4">
                    <div className="rounded-2xl bg-slate-900 p-4 text-white">
                      <p className="text-[0.65rem] font-black uppercase tracking-[0.18em] text-white/60">
                        Draft preview panel
                      </p>
                      <h3 className="mt-2 text-xl font-black tracking-[-0.03em]">
                        {textValue(settings, "store_name", ownedStore.store_name)}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-white/70">
                        {draftPublishValidation.schema.sections.length
                          ? `${draftPublishValidation.schema.sections.length} draft section${
                              draftPublishValidation.schema.sections.length === 1 ? "" : "s"
                            } prepared for preview rendering.`
                          : "No draft sections are ready for preview yet."}
                      </p>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      {["Hydration safe", "Preview isolated", "Refresh state"].map((label) => (
                        <div
                          className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-3 text-center text-xs font-black uppercase tracking-[0.16em] text-muted"
                          key={label}
                        >
                          {label}
                        </div>
                      ))}
                    </div>
                  </div>
                  <form action={syncLivePreviewState} className="mt-4">
                    <input name="storeId" type="hidden" value={ownedStore.id} />
                    <Button type="submit" variant="secondary">
                      Refresh draft preview
                    </Button>
                  </form>
                </div>
                <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                    Publish flow
                  </p>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-sm font-black text-ink">
                      Draft / published indicator
                    </p>
                    <p className="mt-2 text-sm leading-6 text-muted">
                      Active version{" "}
                      {numberValue(activePublishedVersion, "version_number", "not published")} ·{" "}
                      {hasUnsavedChanges ? "unsaved draft changes" : "draft clean"}
                    </p>
                  </div>
                  {draftPublishValidation.errors.length ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
                      {draftPublishValidation.errors[0]}
                    </div>
                  ) : null}
                  <details className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.16em] text-ink">
                      Publish confirmation
                    </summary>
                    <p className="mt-3 text-sm leading-6 text-muted">
                      Publishing creates a new builder layout version and points the
                      active builder page to it. It does not publish a private store
                      or change public storefront visibility.
                    </p>
                    <form action={publishBuilderDraft} className="mt-3">
                      <input name="storeId" type="hidden" value={ownedStore.id} />
                      <Button disabled={Boolean(draftPublishValidation.errors.length)} type="submit">
                        Publish builder draft
                      </Button>
                    </form>
                  </details>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <form action={restorePublishedLayout}>
                      <input name="storeId" type="hidden" value={ownedStore.id} />
                      <Button className="w-full" type="submit" variant="secondary">
                        Restore published
                      </Button>
                    </form>
                    <form action={rollbackPublishedVersionAction}>
                      <input name="storeId" type="hidden" value={ownedStore.id} />
                      <Button className="w-full" type="submit" variant="secondary">
                        Roll back published
                      </Button>
                    </form>
                  </div>
                  <div className="grid gap-2">
                    {["Realtime preview prep", "Scheduled publishing prep", "Preview sharing prep"].map((label) => (
                      <div
                        className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-3 text-center text-xs font-black uppercase tracking-[0.16em] text-muted"
                        key={label}
                      >
                        {label}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-5 grid gap-4 rounded-3xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                    Store launch flow
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    Launch validates ownership, domain readiness, publishable draft,
                    theme configuration, visible sections, and system status before
                    making the buyer-owned storefront public.
                  </p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.16em] ${
                  launchStatus === "launched"
                    ? "bg-emerald-100 text-emerald-700"
                    : launchStatus === "ready"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-amber-100 text-amber-700"
                }`}>
                  {launchStatus}
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-4">
                {[
                  ["Readiness", `${numberValue(launchChecklist, "readiness_score", String(launchReadiness.readinessScore))}%`],
                  ["Checklist", textValue(launchChecklist, "checklist_status", launchReadiness.checklistStatus)],
                  ["Validation", textValue(launchValidationRecord, "validation_status", launchReadiness.blockingReasons.length ? "blocked" : "pending")],
                  ["Visibility", ownedStore.visibility === "public" ? "Public" : "Private"]
                ].map(([label, value]) => (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3" key={label}>
                    <p className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-slate-400">
                      {label}
                    </p>
                    <p className="mt-1 truncate text-sm font-black capitalize text-ink">{value}</p>
                  </div>
                ))}
              </div>
              <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
                <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                    Launch checklist
                  </p>
                  <div className="grid gap-2">
                    {launchChecklistItems.map((item) => (
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-3" key={textValue(item, "key", textValue(item, "label", "item"))}>
                        <div>
                          <p className="text-sm font-black text-ink">
                            {textValue(item, "label", "Launch checklist item")}
                          </p>
                          <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-muted">
                            {textValue(item, "severity", "blocking")}
                          </p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-[0.65rem] font-black uppercase tracking-[0.16em] ${
                          item.passed === true ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                        }`}>
                          {item.passed === true ? "Ready" : "Needs review"}
                        </span>
                      </div>
                    ))}
                  </div>
                  <form action={refreshStoreLaunchReadinessAction}>
                    <input name="storeId" type="hidden" value={ownedStore.id} />
                    <Button className="w-full" type="submit" variant="secondary">
                      Refresh launch readiness
                    </Button>
                  </form>
                </div>
                <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                    Production publish confirmation
                  </p>
                  {launchBlockingReasons.length ? (
                    <div className="grid gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3">
                      <p className="text-sm font-black text-amber-800">Validation warnings</p>
                      {launchBlockingReasons.slice(0, 3).map((reason) => (
                        <p className="text-sm font-semibold text-amber-800" key={textValue(reason, "key", textValue(reason, "label", "reason"))}>
                          {textValue(reason, "label", "Launch requirement needs review.")}
                        </p>
                      ))}
                    </div>
                  ) : launchWarnings.length ? (
                    <div className="grid gap-2 rounded-2xl border border-blue-200 bg-blue-50 p-3">
                      <p className="text-sm font-black text-blue-800">Non-blocking launch warnings</p>
                      {launchWarnings.slice(0, 2).map((warning) => (
                        <p className="text-sm font-semibold text-blue-800" key={textValue(warning, "key", textValue(warning, "label", "warning"))}>
                          {textValue(warning, "label", "Optional launch item can be improved later.")}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                      <p className="text-sm font-black text-emerald-700">
                        Launch success state ready
                      </p>
                      <p className="mt-1 text-sm leading-6 text-emerald-700">
                        Publishing will create a versioned layout, keep preview isolated,
                        and set storefront visibility public through the existing safe RPC.
                      </p>
                    </div>
                  )}
                  <details className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.16em] text-ink">
                      Confirm store launch
                    </summary>
                    <p className="mt-3 text-sm leading-6 text-muted">
                      This action publishes the current builder draft as a versioned
                      live layout and makes the store public. Draft preview remains
                      isolated and rollback records are prepared.
                    </p>
                    <form action={publishStorefrontDraftAction} className="mt-3">
                      <input name="storeId" type="hidden" value={ownedStore.id} />
                      <Button disabled={Boolean(launchBlockingReasons.length)} type="submit">
                        Launch storefront
                      </Button>
                    </form>
                  </details>
                  <form action={rollbackLaunchPublishAction}>
                    <input name="storeId" type="hidden" value={ownedStore.id} />
                    <Button className="w-full" type="submit" variant="secondary">
                      Rollback launch placeholder
                    </Button>
                  </form>
                  <div className="grid gap-2">
                    {launchEvents.length ? (
                      launchEvents.map((event) => (
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3" key={String(event.id)}>
                          <p className="text-sm font-black capitalize text-ink">
                            {textValue(event, "event_type", "launch event").replace(/_/g, " ")}
                          </p>
                          <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-muted">
                            {textValue(event, "event_status", "recorded")} · {textValue(event, "created_at", "Pending")}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-3 text-sm font-semibold text-muted">
                        Launch audit trail events will appear after readiness checks or publishing.
                      </p>
                    )}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {["Scheduled publishing prep", "Launch email prep", "Launch analytics prep", "QA automation prep"].map((label) => (
                      <div
                        className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-3 text-center text-xs font-black uppercase tracking-[0.16em] text-muted"
                        key={label}
                      >
                        {label}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-5 grid gap-4 rounded-3xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                    Responsive builder modes
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    Device preview state is isolated to builder drafts. Breakpoint
                    switching updates editor metadata and responsive preview records,
                    not the published storefront.
                  </p>
                </div>
                <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-muted">
                  {responsiveBreakpoints[builderMode].label}
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                {responsiveBuilderModes.map((mode) => (
                  <form action={switchResponsiveBuilderMode} key={mode}>
                    <input name="storeId" type="hidden" value={ownedStore.id} />
                    <input name="mode" type="hidden" value={mode} />
                    <Button
                      className="w-full"
                      type="submit"
                      variant={builderMode === mode ? "primary" : "secondary"}
                    >
                      {responsiveBreakpoints[mode].label}
                    </Button>
                  </form>
                ))}
              </div>
              <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                        Responsive preview panel
                      </p>
                      <p className="mt-1 text-sm font-semibold text-muted">
                        {activeResponsiveBreakpoint.maxWidth}px frame · {activeResponsiveBreakpoint.height}px target height
                      </p>
                    </div>
                    <form action={syncResponsivePreviewStateAction}>
                      <input name="storeId" type="hidden" value={ownedStore.id} />
                      <input name="mode" type="hidden" value={builderMode} />
                      <Button type="submit" variant="secondary">
                        Sync responsive preview
                      </Button>
                    </form>
                  </div>
                  <div className="mt-4 overflow-hidden rounded-[2rem] border border-dashed border-slate-300 bg-white p-4">
                    <div
                      className="mx-auto rounded-[1.5rem] border border-slate-200 bg-slate-950 p-3 text-white shadow-sm"
                      style={{ maxWidth: activeResponsiveBreakpoint.maxWidth }}
                    >
                      <div className="rounded-[1.2rem] bg-white p-4 text-ink">
                        <p className="text-[0.65rem] font-black uppercase tracking-[0.18em] text-slate-400">
                          {responsiveBreakpoints[builderMode].label} draft frame
                        </p>
                        <h3 className="mt-2 text-lg font-black tracking-[-0.03em]">
                          {textValue(settings, "store_name", ownedStore.store_name)}
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-muted">
                          {draftPublishValidation.schema.sections.length
                            ? `${draftPublishValidation.schema.sections.length} draft section${
                                draftPublishValidation.schema.sections.length === 1 ? "" : "s"
                              } prepared for breakpoint-safe preview.`
                            : "No draft sections are ready for responsive preview yet."}
                        </p>
                        <div className="mt-4 grid gap-2">
                          {[
                            ["Hydration", activeResponsivePreview.hydratedSafely === false ? "Needs check" : "Safe"],
                            ["Isolation", activeResponsivePreview.previewIsolated === false ? "Pending" : "Draft only"],
                            ["Breakpoint", builderMode]
                          ].map(([label, value]) => (
                            <div className="rounded-2xl bg-slate-50 p-3" key={label}>
                              <p className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-slate-400">
                                {label}
                              </p>
                              <p className="mt-1 text-xs font-black capitalize text-ink">{String(value)}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                    Responsive controls
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {[
                      ["Config rows", String(responsiveConfigs.length)],
                      ["Last sync", textValue(activeResponsiveConfig, "updated_at", "Not synced")],
                      ["Section config", Object.keys(firstResponsiveSectionConfig).length ? "Ready" : "Empty"],
                      ["Mode source", textValue(responsiveLayoutState, "active_breakpoint", builderMode)]
                    ].map(([label, value]) => (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3" key={label}>
                        <p className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-slate-400">
                          {label}
                        </p>
                        <p className="mt-1 truncate text-xs font-black text-ink">{value}</p>
                      </div>
                    ))}
                  </div>
                  <form action={applyResponsiveLayoutOverrideAction}>
                    <input name="storeId" type="hidden" value={ownedStore.id} />
                    <input name="mode" type="hidden" value={builderMode} />
                    <Button className="w-full" type="submit" variant="secondary">
                      Apply responsive override placeholder
                    </Button>
                  </form>
                  <div className="grid gap-2">
                    {[
                      "Responsive spacing placeholders",
                      "Responsive typography placeholders",
                      "Responsive visibility placeholders",
                      "Breakpoint-specific sections prep",
                      "AI responsive optimization prep",
                      "Adaptive layouts prep"
                    ].map((label) => (
                      <div
                        className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-3 text-center text-xs font-black uppercase tracking-[0.16em] text-muted"
                        key={label}
                      >
                        {label}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-5 grid gap-4 rounded-3xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                    Live preview runtime
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    Draft rendering is resolved into an isolated preview runtime with
                    hydration-safe state, responsive mode context, and prepared render
                    cache. Published storefront runtime stays untouched.
                  </p>
                </div>
                <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-muted">
                  {textValue(previewRuntimeState, "runtime_status", "Not synced")}
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <form action={createPreviewSessionAction}>
                  <input name="storeId" type="hidden" value={ownedStore.id} />
                  <input name="mode" type="hidden" value={builderMode} />
                  <Button className="w-full" disabled={!builderDraftId} type="submit" variant="secondary">
                    Create preview session
                  </Button>
                </form>
                <form action={refreshPreviewStateAction}>
                  <input name="storeId" type="hidden" value={ownedStore.id} />
                  <input name="mode" type="hidden" value={builderMode} />
                  <Button className="w-full" disabled={!builderDraftId} type="submit">
                    Refresh preview
                  </Button>
                </form>
                <form action={syncDraftPreviewAction}>
                  <input name="storeId" type="hidden" value={ownedStore.id} />
                  <input name="mode" type="hidden" value={builderMode} />
                  <input name="source" type="hidden" value="draft_change" />
                  <Button className="w-full" disabled={!builderDraftId} type="submit" variant="secondary">
                    Sync draft runtime
                  </Button>
                </form>
              </div>
              <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                        Isolated draft frame
                      </p>
                      <p className="mt-1 text-sm font-semibold text-muted">
                        {responsiveBreakpoints[builderMode].label} runtime · {draftPublishValidation.schema.sections.length} draft section
                        {draftPublishValidation.schema.sections.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-[0.65rem] font-black uppercase tracking-[0.16em] text-muted">
                      Draft only
                    </span>
                  </div>
                  <div className="mt-4 overflow-hidden rounded-[2rem] border border-dashed border-slate-300 bg-white p-4">
                    <div
                      className="mx-auto rounded-[1.5rem] border border-slate-200 bg-slate-950 p-3 text-white shadow-sm"
                      style={{ maxWidth: activeResponsiveBreakpoint.maxWidth }}
                    >
                      <div className="rounded-[1.2rem] bg-white p-4 text-ink">
                        <p className="text-[0.65rem] font-black uppercase tracking-[0.18em] text-slate-400">
                          Preview-safe hydration
                        </p>
                        <h3 className="mt-2 text-lg font-black tracking-[-0.03em]">
                          {textValue(settings, "store_name", ownedStore.store_name)}
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-muted">
                          {previewRuntimeErrors.fallbackReady === true
                            ? "Preview fallback is ready because the current draft schema needs review."
                            : "Draft runtime is isolated from published storefront rendering."}
                        </p>
                        <div className="mt-4 grid gap-2 sm:grid-cols-3">
                          {[
                            ["Hydration", previewRuntimeHydration.hydrationSafe === false ? "Needs check" : "Safe"],
                            ["Isolation", previewRuntimeIsolation.isolatedRendering === false ? "Pending" : "Isolated"],
                            ["Cache", textValue(previewRenderCache, "cache_status", "Prepared")]
                          ].map(([label, value]) => (
                            <div className="rounded-2xl bg-slate-50 p-3" key={label}>
                              <p className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-slate-400">
                                {label}
                              </p>
                              <p className="mt-1 truncate text-xs font-black capitalize text-ink">{String(value)}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                    Runtime sync state
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {[
                      ["Session", textValue(previewSession, "session_status", "Not created")],
                      ["Mode", textValue(previewSession, "preview_mode", builderMode)],
                      ["Source", textValue(previewRuntimeState, "sync_source", "manual_refresh")],
                      ["Updated", textValue(previewRuntimeState, "updated_at", "Not synced")],
                      ["Pending", previewSyncPending ? "Yes" : "No"],
                      ["Cache key", textValue(previewRenderCache, "cache_key", "Prepared")]
                    ].map(([label, value]) => (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3" key={label}>
                        <p className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-slate-400">
                          {label}
                        </p>
                        <p className="mt-1 truncate text-xs font-black text-ink">{String(value)}</p>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-3">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                      Preview error placeholder
                    </p>
                    <p className="mt-2 text-sm font-semibold text-muted">
                      {previewRuntimeErrors.fallbackReady === true
                        ? "Fallback preview is prepared until the draft schema validates."
                        : "No runtime preview errors recorded."}
                    </p>
                  </div>
                  <div className="grid gap-2">
                    {[
                      "Realtime collaborative preview prep",
                      "Preview sharing prep",
                      "AI visual editing prep",
                      "Mobile mirroring prep",
                      "Animation preview prep",
                      "Performance cache prep"
                    ].map((label) => (
                      <div
                        className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-3 text-center text-xs font-black uppercase tracking-[0.16em] text-muted"
                        key={label}
                      >
                        {label}
                      </div>
                    ))}
                  </div>
                  {textValue(previewSessionSyncState, "lastSyncAt", "") ? (
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">
                      Last runtime sync: {textValue(previewSessionSyncState, "lastSyncAt", "Not synced")}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="mt-5 grid gap-4 rounded-3xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                    Visual styling engine
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    Theme token overrides are isolated to builder drafts and visual
                    preview state. Published storefront rendering and store visibility
                    stay unchanged.
                  </p>
                </div>
                <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-muted">
                  {visualStyleOverrides.length} override{visualStyleOverrides.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
                <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                    Theme customization sidebar
                  </p>
                  <form action={updateThemeTokensAction} className="grid gap-3">
                    <input name="storeId" type="hidden" value={ownedStore.id} />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Input
                        defaultValue={resolvedVisualThemeStyles.colors.primary}
                        id="primaryColor"
                        label="Primary color"
                        name="primaryColor"
                        type="color"
                      />
                      <Input
                        defaultValue={resolvedVisualThemeStyles.colors.secondary}
                        id="secondaryColor"
                        label="Secondary color"
                        name="secondaryColor"
                        type="color"
                      />
                      <Input
                        defaultValue={resolvedVisualThemeStyles.colors.accent}
                        id="accentColor"
                        label="Accent color"
                        name="accentColor"
                        type="color"
                      />
                      <Input
                        defaultValue={resolvedVisualThemeStyles.colors.background}
                        id="backgroundColor"
                        label="Background color"
                        name="backgroundColor"
                        type="color"
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <select
                        className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold text-ink"
                        defaultValue={resolvedVisualThemeStyles.typography.heading}
                        name="headingFont"
                      >
                        <option value="inter">Inter heading</option>
                        <option value="serif">Serif heading</option>
                        <option value="display">Display heading</option>
                        <option value="mono">Mono heading</option>
                      </select>
                      <select
                        className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold text-ink"
                        defaultValue={resolvedVisualThemeStyles.typography.body}
                        name="bodyFont"
                      >
                        <option value="inter">Inter body</option>
                        <option value="serif">Serif body</option>
                        <option value="display">Display body</option>
                        <option value="mono">Mono body</option>
                      </select>
                      <select
                        className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold text-ink"
                        defaultValue={resolvedVisualThemeStyles.typography.scale}
                        name="fontScale"
                      >
                        <option value="compact">Compact scale</option>
                        <option value="comfortable">Comfortable scale</option>
                        <option value="large">Large scale</option>
                      </select>
                      <select
                        className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold text-ink"
                        defaultValue={resolvedVisualThemeStyles.spacing.density}
                        name="spacingDensity"
                      >
                        <option value="compact">Compact spacing</option>
                        <option value="comfortable">Comfortable spacing</option>
                        <option value="spacious">Spacious spacing</option>
                      </select>
                      <select
                        className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold text-ink"
                        defaultValue={resolvedVisualThemeStyles.radius.section}
                        name="sectionRadius"
                      >
                        <option value="0.75rem">Small radius</option>
                        <option value="1rem">Medium radius</option>
                        <option value="1.5rem">Large radius</option>
                        <option value="2rem">XL radius</option>
                        <option value="2.5rem">2XL radius</option>
                      </select>
                      <select
                        className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold text-ink"
                        defaultValue={resolvedVisualThemeStyles.button.radius}
                        name="buttonRadius"
                      >
                        <option value="pill">Pill buttons</option>
                        <option value="rounded">Rounded buttons</option>
                        <option value="sharp">Sharp buttons</option>
                      </select>
                    </div>
                    <input name="buttonStyle" type="hidden" value={resolvedVisualThemeStyles.button.style} />
                    <input name="sectionSpacing" type="hidden" value={resolvedVisualThemeStyles.spacing.section} />
                    <input name="cardRadius" type="hidden" value={resolvedVisualThemeStyles.radius.card} />
                    <Button type="submit">Update theme tokens</Button>
                  </form>
                  <form action={applySectionStyleOverrideAction} className="grid gap-3 rounded-2xl border border-dashed border-slate-300 bg-white p-3">
                    <input name="storeId" type="hidden" value={ownedStore.id} />
                    <select
                      className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-ink"
                      defaultValue={firstStyleSectionId}
                      name="sectionId"
                    >
                      <option value="" disabled>Select section</option>
                      {builderSectionDrafts.map((section) => (
                        <option key={String(section.id)} value={String(section.id)}>
                          {textValue(section, "section_type", "section").replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Input
                        defaultValue={resolvedVisualThemeStyles.colors.accent}
                        id="sectionAccentColor"
                        label="Section accent"
                        name="sectionAccentColor"
                        type="color"
                      />
                      <Input
                        defaultValue={resolvedVisualThemeStyles.colors.background}
                        id="sectionBackgroundColor"
                        label="Section background"
                        name="sectionBackgroundColor"
                        type="color"
                      />
                    </div>
                    <input
                      name="sectionSpacing"
                      type="hidden"
                      value={resolvedVisualThemeStyles.spacing.section}
                    />
                    <Button disabled={!firstStyleSectionId} type="submit" variant="secondary">
                      Apply section style override
                    </Button>
                  </form>
                  <div className="grid gap-2">
                    {[
                      "Animation styling prep",
                      "Visual CSS editor prep",
                      "Marketplace themes prep"
                    ].map((label) => (
                      <div
                        className="rounded-2xl border border-dashed border-slate-300 bg-white p-3 text-center text-xs font-black uppercase tracking-[0.16em] text-muted"
                        key={label}
                      >
                        {label}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                        Live styling preview
                      </p>
                      <p className="mt-1 text-sm font-semibold text-muted">
                        Draft-only preview · {textValue(visualStyleState, "updated_at", "Not synced")}
                      </p>
                    </div>
                    <form action={syncVisualStylePreviewAction}>
                      <input name="storeId" type="hidden" value={ownedStore.id} />
                      <input
                        name="styleTarget"
                        type="hidden"
                        value={textValue(visualStyleState, "selected_style_target", "global")}
                      />
                      <Button type="submit" variant="secondary">
                        Sync styling preview
                      </Button>
                    </form>
                  </div>
                  <div
                    className="rounded-[2rem] border border-dashed border-slate-300 p-4"
                    style={{
                      backgroundColor: resolvedVisualThemeStyles.colors.background,
                      borderRadius: resolvedVisualThemeStyles.radius.section
                    }}
                  >
                    <div
                      className="rounded-[1.5rem] p-4 text-white shadow-sm"
                      style={{
                        backgroundColor: resolvedVisualThemeStyles.colors.primary,
                        borderRadius: resolvedVisualThemeStyles.radius.card
                      }}
                    >
                      <p className="text-[0.65rem] font-black uppercase tracking-[0.18em] text-white/60">
                        Theme token preview
                      </p>
                      <h3
                        className="mt-2 text-xl font-black tracking-[-0.03em]"
                        style={{ fontFamily: resolvedVisualThemeStyles.typography.heading }}
                      >
                        {textValue(settings, "store_name", ownedStore.store_name)}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-white/75">
                        Visual styling updates stay in draft preview until a builder
                        layout is published.
                      </p>
                      <div
                        className="mt-4 inline-flex px-4 py-2 text-sm font-bold text-ink"
                        style={{
                          backgroundColor: resolvedVisualThemeStyles.colors.accent,
                          borderRadius:
                            resolvedVisualThemeStyles.button.radius === "sharp"
                              ? "0.5rem"
                              : resolvedVisualThemeStyles.button.radius === "rounded"
                                ? "1rem"
                                : "999px"
                        }}
                      >
                        Button style placeholder
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {[
                      ["Hydration", visualStylePreview.hydratedSafely === false ? "Needs check" : "Safe"],
                      ["Isolation", visualStylePreview.previewIsolated === false ? "Pending" : "Draft only"],
                      ["Typography", resolvedVisualThemeStyles.typography.heading],
                      ["Spacing", resolvedVisualThemeStyles.spacing.density]
                    ].map(([label, value]) => (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3" key={label}>
                        <p className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-slate-400">
                          {label}
                        </p>
                        <p className="mt-1 truncate text-xs font-black capitalize text-ink">{String(value)}</p>
                      </div>
                    ))}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {resolvedVisualThemeStyles.colors.primary &&
                      ["Primary", "Secondary", "Accent"].map((label, index) => {
                        const swatch = [
                          resolvedVisualThemeStyles.colors.primary,
                          resolvedVisualThemeStyles.colors.secondary,
                          resolvedVisualThemeStyles.colors.accent
                        ][index];

                        return (
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3" key={label}>
                            <p className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-slate-400">
                              {label}
                            </p>
                            <div
                              className="mt-2 h-8 rounded-xl border border-slate-200"
                              style={{ backgroundColor: swatch }}
                            />
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-5 grid gap-4 rounded-3xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                    Version history
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    Snapshots and publish history are scoped to this store. Restoring
                    a snapshot updates the draft only and keeps public storefront
                    rendering isolated.
                  </p>
                </div>
                <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-muted">
                  {builderSnapshots.length} snapshot{builderSnapshots.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <form action={createBuilderSnapshot} className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <input name="storeId" type="hidden" value={ownedStore.id} />
                  <input name="snapshotType" type="hidden" value="draft" />
                  <Input
                    defaultValue="Manual draft snapshot"
                    id="draftSnapshotLabel"
                    label="Draft snapshot label"
                    name="snapshotLabel"
                  />
                  <Button type="submit">Snapshot draft</Button>
                </form>
                <form action={createBuilderSnapshot} className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <input name="storeId" type="hidden" value={ownedStore.id} />
                  <input name="snapshotType" type="hidden" value="published" />
                  <Input
                    defaultValue="Published layout snapshot"
                    id="publishedSnapshotLabel"
                    label="Published snapshot label"
                    name="snapshotLabel"
                  />
                  <Button type="submit" variant="secondary">Snapshot published</Button>
                </form>
              </div>
              <div className="grid gap-3 lg:grid-cols-[1fr_0.9fr]">
                <div className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                    Snapshot history
                  </p>
                  {builderSnapshots.length ? (
                    builderSnapshots.map((snapshot) => {
                      const diff = snapshot.layout_diff ?? {};
                      const addedSections = Array.isArray(diff.addedSections)
                        ? diff.addedSections.length
                        : 0;
                      const removedSections = Array.isArray(diff.removedSections)
                        ? diff.removedSections.length
                        : 0;

                      return (
                        <details
                          className="rounded-2xl border border-slate-200 bg-white p-3"
                          key={snapshot.id}
                        >
                          <summary className="cursor-pointer text-sm font-black text-ink">
                            {snapshot.snapshot_label ?? "Builder snapshot"}
                          </summary>
                          <div className="mt-3 grid gap-3">
                            <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">
                              {snapshot.snapshot_type} · {snapshot.created_at}
                            </p>
                            <div className="grid gap-2 sm:grid-cols-3">
                              {[
                                ["Added", String(addedSections)],
                                ["Removed", String(removedSections)],
                                ["Order", diff.orderChanged ? "Changed" : "Stable"]
                              ].map(([label, value]) => (
                                <div className="rounded-2xl bg-slate-50 p-3" key={label}>
                                  <p className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-slate-400">
                                    {label}
                                  </p>
                                  <p className="mt-1 text-xs font-black text-ink">{value}</p>
                                </div>
                              ))}
                            </div>
                            <form action={restoreBuilderVersion}>
                              <input name="storeId" type="hidden" value={ownedStore.id} />
                              <input name="snapshotId" type="hidden" value={snapshot.id} />
                              <Button type="submit" variant="secondary">
                                Restore snapshot to draft
                              </Button>
                            </form>
                          </div>
                        </details>
                      );
                    })
                  ) : (
                    <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-3 text-sm font-semibold text-muted">
                      No version snapshots yet. Save a draft or published snapshot to start history.
                    </p>
                  )}
                </div>
                <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-3">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                    Compare and publish history
                  </p>
                  <form action={compareBuilderVersionsAction} className="grid gap-3">
                    <input name="storeId" type="hidden" value={ownedStore.id} />
                    <select
                      className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-ink"
                      name="leftSnapshotId"
                      defaultValue=""
                    >
                      <option value="" disabled>Base snapshot</option>
                      {builderSnapshots.map((snapshot) => (
                        <option key={snapshot.id} value={snapshot.id}>
                          {snapshot.snapshot_label ?? snapshot.snapshot_type}
                        </option>
                      ))}
                    </select>
                    <select
                      className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-ink"
                      name="rightSnapshotId"
                      defaultValue=""
                    >
                      <option value="" disabled>Compare snapshot</option>
                      {builderSnapshots.map((snapshot) => (
                        <option key={snapshot.id} value={snapshot.id}>
                          {snapshot.snapshot_label ?? snapshot.snapshot_type}
                        </option>
                      ))}
                    </select>
                    <Button disabled={builderSnapshots.length < 2} type="submit" variant="secondary">
                      Prepare comparison
                    </Button>
                  </form>
                  <div className="grid gap-2">
                    {builderPublishHistory.length ? (
                      builderPublishHistory.map((entry) => (
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3" key={entry.id}>
                          <p className="text-sm font-black capitalize text-ink">
                            {entry.publish_status.replace(/_/g, " ")}
                          </p>
                          <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-muted">
                            Version {entry.version_number ?? "draft"} · {entry.published_at}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-3 text-sm font-semibold text-muted">
                        Publish history will appear here after builder versions are published or restored.
                      </p>
                    )}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {["Visual diff prep", "Branching layouts prep", "Editor activity logs"].map((label) => (
                      <div
                        className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-3 text-center text-xs font-black uppercase tracking-[0.16em] text-muted"
                        key={label}
                      >
                        {label}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-5 grid gap-4 rounded-3xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                    Draft section editor
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    Edit controls write only to builder draft records and section
                    draft metadata. Published storefront layouts stay unchanged.
                  </p>
                </div>
                <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-muted">
                  {visualEditorSections.length} draft section{visualEditorSections.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                  Edit session
                </p>
                <div className="grid gap-2 sm:grid-cols-3">
                  {[
                    ["Session", textValue(builderSession, "session_status", "Not saved")],
                    ["Responsive", textValue(builderSession, "responsive_mode", builderMode)],
                    ["History", String(builderHistory.length)]
                  ].map(([label, value]) => (
                    <div className="rounded-2xl bg-white p-3" key={label}>
                      <p className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-slate-400">
                        {label}
                      </p>
                      <p className="mt-1 truncate text-xs font-black text-ink">{value}</p>
                    </div>
                  ))}
                </div>
                <form action={saveBuilderSession} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                  <input name="storeId" type="hidden" value={ownedStore.id} />
                  <select
                    className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold text-ink"
                    name="responsiveMode"
                    defaultValue={builderMode}
                  >
                    <option value="desktop">Desktop</option>
                    <option value="tablet">Tablet</option>
                    <option value="mobile">Mobile</option>
                  </select>
                  <select
                    className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold text-ink"
                    name="selectedSectionId"
                    defaultValue=""
                  >
                    <option value="">No selected section</option>
                    {builderSectionDrafts.map((section) => (
                      <option key={String(section.id)} value={String(section.id)}>
                        {textValue(section, "section_type", "section").replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                  <Button type="submit" variant="secondary">
                    Save session
                  </Button>
                </form>
              </div>
              <form action={createDraftSection} className="grid gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-3 sm:grid-cols-[1fr_1fr_auto]">
                <input name="storeId" type="hidden" value={ownedStore.id} />
                <select
                  className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold text-ink"
                  name="sectionType"
                  defaultValue="rich_text"
                >
                  <option value="hero">Hero</option>
                  <option value="banner">Banner</option>
                  <option value="product_grid">Product grid</option>
                  <option value="featured_products">Featured products</option>
                  <option value="rich_text">Rich text</option>
                  <option value="CTA">CTA</option>
                  <option value="testimonials">Testimonials</option>
                  <option value="newsletter">Newsletter</option>
                  <option value="spacer">Spacer</option>
                </select>
                <Input
                  defaultValue="New draft section"
                  id="newSectionHeading"
                  label="Add section placeholder"
                  name="heading"
                />
                <Button type="submit">Create draft section</Button>
              </form>
              <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                      Drag/drop interaction layer
                    </p>
                    <p className="mt-2 text-sm leading-6 text-muted">
                      Drop zones persist draft ordering through `moveDraftSection()`.
                      Use the selector as a mobile-safe fallback until pointer drag
                      events are wired.
                    </p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-muted">
                    Optimistic order ready
                  </span>
                </div>
                <div className="grid gap-2">
                  {builderSectionDrafts.length > 1 ? (
                    builderSectionDrafts.map((targetSection, targetIndex) => (
                      <div
                        className="grid gap-2 rounded-2xl border border-dashed border-slate-300 bg-white p-3"
                        data-builder-drop-zone="true"
                        data-drop-index={targetIndex}
                        key={`drop-zone-${String(targetSection.id)}`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="h-px flex-1 bg-slate-200" />
                          <span className="rounded-full bg-slate-50 px-3 py-1 text-[0.65rem] font-black uppercase tracking-[0.16em] text-muted">
                            Insert before {textValue(targetSection, "section_type", "section").replace(/_/g, " ")}
                          </span>
                          <span className="h-px flex-1 bg-slate-200" />
                        </div>
                        <form action={moveDraftSection} className="grid gap-2 sm:grid-cols-[1fr_auto]">
                          <input name="storeId" type="hidden" value={ownedStore.id} />
                          <input name="targetIndex" type="hidden" value={String(targetIndex)} />
                          <input name="position" type="hidden" value="before" />
                          <select
                            className="h-10 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-ink"
                            name="sectionId"
                            defaultValue=""
                          >
                            <option value="" disabled>
                              Choose section to move
                            </option>
                            {builderSectionDrafts.map((section) => (
                              <option key={String(section.id)} value={String(section.id)}>
                                {textValue(section, "section_type", "section").replace(/_/g, " ")}
                              </option>
                            ))}
                          </select>
                          <Button type="submit" variant="secondary">
                            Drop here
                          </Button>
                        </form>
                      </div>
                    ))
                  ) : (
                    <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-3 text-sm font-semibold text-muted">
                      Add at least two draft sections to enable drag reorder persistence.
                    </p>
                  )}
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {["Insertion indicators", "Hover states", "Movement animation prep"].map((label) => (
                    <div
                      className="rounded-2xl border border-dashed border-slate-300 bg-white p-3 text-center text-xs font-black uppercase tracking-[0.16em] text-muted"
                      key={label}
                    >
                      {label}
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid gap-3 lg:grid-cols-[18rem_1fr]">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                    Section editor sidebar
                  </p>
                  <div className="mt-3 grid gap-2">
                    {visualEditorSections.length ? (
                      visualEditorSections.slice(0, 8).map((section, index) => {
                        const sectionId = textValue(section, "id", "");
                        const sectionType = textValue(section, "section_type", textValue(section, "type", "section"));
                        const sectionEnabled =
                          section.section_enabled === false || section.enabled === false ? false : true;
                        const hasDraftRecord = Boolean(
                          builderSectionDrafts.find((draft) => draft.id === section.id)
                        );

                        return (
                          <div
                            className="rounded-2xl border border-slate-200 bg-white p-3 transition hover:-translate-y-0.5 hover:border-slate-300"
                            data-builder-draggable-card={hasDraftRecord ? "true" : "false"}
                            data-builder-hover-state="ready"
                            data-builder-section-id={sectionId}
                            draggable={hasDraftRecord}
                            key={sectionId || `${sectionType}-${index}`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <p className="text-xs font-black uppercase tracking-[0.16em] text-ink">
                                  {sectionType.replace(/_/g, " ")}
                                </p>
                                <p className="mt-1 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-slate-400">
                                  {sectionEnabled ? "Visible" : "Hidden"} · Order{" "}
                                  {textValue(section, "section_order", textValue(section, "order", String(index + 1)))}
                                </p>
                              </div>
                              {!hasDraftRecord ? (
                                <span className="rounded-full bg-amber-50 px-2 py-1 text-[0.65rem] font-black uppercase tracking-[0.14em] text-amber-700">
                                  Init needed
                                </span>
                              ) : null}
                            </div>
                            {hasDraftRecord ? (
                              <div className="mt-3 grid gap-2">
                                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-2 text-center text-[0.65rem] font-black uppercase tracking-[0.16em] text-muted">
                                  Drag handle · Stable key {sectionId.slice(0, 8)}
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  {[
                                    ["up", "Move up"],
                                    ["down", "Move down"]
                                  ].map(([direction, label]) => (
                                    <form action={reorderDraftSections} key={direction}>
                                      <input name="storeId" type="hidden" value={ownedStore.id} />
                                      <input name="sectionId" type="hidden" value={sectionId} />
                                      <input name="direction" type="hidden" value={direction} />
                                      <Button className="w-full" type="submit" variant="secondary">
                                        {label}
                                      </Button>
                                    </form>
                                  ))}
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                  <form action={toggleDraftSectionVisibility}>
                                    <input name="storeId" type="hidden" value={ownedStore.id} />
                                    <input name="sectionId" type="hidden" value={sectionId} />
                                    <input name="enabled" type="hidden" value={String(sectionEnabled)} />
                                    <Button className="w-full" type="submit" variant="secondary">
                                      {sectionEnabled ? "Hide" : "Show"}
                                    </Button>
                                  </form>
                                  <form action={duplicateDraftSection}>
                                    <input name="storeId" type="hidden" value={ownedStore.id} />
                                    <input name="sectionId" type="hidden" value={sectionId} />
                                    <Button className="w-full" type="submit" variant="secondary">
                                      Duplicate
                                    </Button>
                                  </form>
                                  <form action={deleteDraftSection}>
                                    <input name="storeId" type="hidden" value={ownedStore.id} />
                                    <input name="sectionId" type="hidden" value={sectionId} />
                                    <Button className="w-full" type="submit" variant="secondary">
                                      Delete
                                    </Button>
                                  </form>
                                </div>
                              </div>
                            ) : (
                              <p className="mt-3 text-xs font-semibold leading-5 text-muted">
                                Save an edit session first to initialize editable draft section records.
                              </p>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-3 text-sm font-semibold text-muted">
                        No draft sections yet. Create a section to start editing.
                      </p>
                    )}
                  </div>
                </div>
                <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-3">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                    Section settings state
                  </p>
                  {builderSectionDrafts.length ? (
                    builderSectionDrafts.slice(0, 3).map((section, index) => (
                      <form action={updateDraftSection} className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3" key={String(section.id)}>
                        <input name="storeId" type="hidden" value={ownedStore.id} />
                        <input name="sectionId" type="hidden" value={String(section.id)} />
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="text-sm font-black capitalize text-ink">
                            {textValue(section, "section_type", `Section ${index + 1}`).replace(/_/g, " ")}
                          </p>
                          <span className="rounded-full bg-white px-3 py-1 text-[0.65rem] font-black uppercase tracking-[0.16em] text-muted">
                            Editable later
                          </span>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Input
                            defaultValue={nestedTextValue(section, "heading", "Draft section heading")}
                            id={`heading-${section.id}`}
                            label="Heading"
                            name="heading"
                          />
                          <Input
                            defaultValue={nestedTextValue(section, "cta", "Shop now")}
                            id={`cta-${section.id}`}
                            label="CTA"
                            name="cta"
                          />
                        </div>
                        <Textarea
                          defaultValue={nestedTextValue(section, "subheading", "Section subheading placeholder")}
                          id={`subheading-${section.id}`}
                          label="Subheading"
                          name="subheading"
                        />
                        <Textarea
                          defaultValue={nestedTextValue(section, "body", "Section settings placeholder for future rich controls.")}
                          id={`body-${section.id}`}
                          label="Body"
                          name="body"
                        />
                        <Button className="w-fit" type="submit">
                          Update draft section
                        </Button>
                      </form>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
                      <p className="text-sm font-black text-ink">Section settings placeholder</p>
                      <p className="mt-2 text-sm leading-6 text-muted">
                        Editable settings appear after the first edit session initializes draft sections.
                      </p>
                    </div>
                  )}
                  <div className="grid gap-2 sm:grid-cols-3">
                    {["Draft preview state", "Hydration safe preview", "Isolated rendering", "No flicker ordering", "Mobile fallback", "Stable keys"].map((label) => (
                      <div
                        className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-3 text-center text-xs font-black uppercase tracking-[0.16em] text-muted"
                        key={label}
                      >
                        {label}
                      </div>
                    ))}
                  </div>
                  <form action={rollbackBuilderDraft} className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-3">
                    <input name="storeId" type="hidden" value={ownedStore.id} />
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                      Rollback foundation
                    </p>
                    <p className="mt-2 text-sm leading-6 text-muted">
                      Rollback restores the latest builder editing history snapshot to draft only.
                    </p>
                    <Button className="mt-3" type="submit" variant="secondary">
                      Roll back draft
                    </Button>
                  </form>
                </div>
              </div>
            </div>
            <div className="mt-5 grid gap-3 rounded-3xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                Section editor placeholders
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  "Builder sidebar",
                  "Section inspector",
                  "Section props",
                  "Layout tree",
                  "Live preview sync",
                  "Add section modal"
                ].map((label) => (
                  <div
                    className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-3 text-center text-xs font-black uppercase tracking-[0.16em] text-muted"
                    key={label}
                  >
                    {label}
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-5 grid gap-2">
              {(builderSections.length ? builderSections : ["hero", "product_grid", "CTA"]).slice(0, 5).map(
                (section, index) => {
                  const record =
                    section && typeof section === "object" && !Array.isArray(section)
                      ? (section as Record<string, unknown>)
                      : undefined;
                  const sectionId = textValue(record, "id", `placeholder-${index + 1}`);
                  const sectionType = textValue(record, "type", String(section));

                  return (
                    <div
                      className={`rounded-2xl border p-3 transition ${
                        selectedSectionId === sectionId
                          ? "border-slate-900 bg-white"
                          : "border-dashed border-slate-300 bg-slate-50"
                      }`}
                      data-builder-draggable="placeholder"
                      data-builder-section-id={sectionId}
                      key={sectionId}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-xs font-black uppercase tracking-[0.16em] text-ink">
                          {sectionType.replace(/_/g, " ")}
                        </p>
                        <span className="rounded-full bg-white px-3 py-1 text-[0.65rem] font-black uppercase tracking-[0.16em] text-muted">
                          Drag handle
                        </span>
                      </div>
                    </div>
                  );
                }
              )}
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-3">
              {["Desktop", "Tablet", "Mobile"].map((mode) => (
                <div
                  className={`rounded-2xl border p-3 text-center text-xs font-black uppercase tracking-[0.16em] ${
                    builderMode.toLowerCase() === mode.toLowerCase()
                      ? "border-slate-900 bg-white text-ink"
                      : "border-slate-200 bg-slate-50 text-muted"
                  }`}
                  key={mode}
                >
                  {mode}
                </div>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {["Save draft", "Publish schema", "Reorder prep", "Export layout"].map((label) => (
                <span
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-muted"
                  key={label}
                >
                  {label}
                </span>
              ))}
            </div>
          </Card>
          <Card className="p-5 lg:p-6" id="templates">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
              Template library
            </p>
            <h2 className="mt-2 text-xl font-black tracking-[-0.02em] text-ink">
              Niche store templates foundation
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Ready-made storefront template schemas are prepared for safe cloning
              into builder drafts, future AI customization, niche recommendations,
              branding adaptation, and layout improvements.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {templateCategories.map((category) => (
                <span
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-muted"
                  key={category.category_key}
                >
                  {category.name}
                </span>
              ))}
            </div>
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {featuredTemplates.map((template) => {
                const draft = mapTemplateToBuilderDraft(template);

                return (
                  <div
                    className="overflow-hidden rounded-3xl border border-slate-200 bg-white"
                    key={template.id}
                  >
                    <div
                      className="min-h-36 p-4 text-white"
                      style={{
                        background:
                          template.preview_gradient ??
                          "linear-gradient(135deg,#f8fafc,#2563eb 52%,#020617)"
                      }}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <span className="rounded-full bg-white/15 px-3 py-1 text-[0.65rem] font-black uppercase tracking-[0.16em] backdrop-blur">
                          {template.niche_category}
                        </span>
                        <span className="rounded-full bg-white/90 px-3 py-1 text-[0.65rem] font-black uppercase tracking-[0.16em] text-slate-900">
                          {draft.sections.length} sections
                        </span>
                      </div>
                      <h3 className="mt-10 text-xl font-black tracking-[-0.03em]">
                        {template.name}
                      </h3>
                    </div>
                    <div className="grid gap-4 p-4">
                      <p className="text-sm leading-6 text-muted">
                        {template.preview_summary ?? template.description ?? "Template preview placeholder"}
                      </p>
                      <div className="grid gap-2 sm:grid-cols-3">
                        {["Desktop", "Tablet", "Mobile"].map((mode) => (
                          <div
                            className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-3 text-center text-[0.65rem] font-black uppercase tracking-[0.16em] text-muted"
                            key={mode}
                          >
                            {mode}
                          </div>
                        ))}
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {["Apply template", "AI customize"].map((label) => (
                          <div
                            className="rounded-2xl border border-dashed border-slate-300 bg-white p-3 text-center text-xs font-black uppercase tracking-[0.16em] text-muted"
                            key={label}
                          >
                            {label}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                Template cloning preparation
              </p>
              <p className="mt-2 text-sm leading-6 text-muted">
                `cloneTemplateToStore()` and `mapTemplateToBuilderDraft()` are ready
                for future apply flows. Existing builder drafts remain untouched until
                an explicit apply action is wired.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {["AI niche recommendations", "AI branding adaptation", "AI layout improvements"].map((label) => (
                  <span
                    className="rounded-full bg-white px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-muted"
                    key={label}
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
            {!templateLibrary.ready ? (
              <p className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-3 text-sm font-semibold text-muted">
                Showing safe template placeholders until the Phase 14 migration is applied.
              </p>
            ) : null}
          </Card>
          <Card className="p-5 lg:p-6">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
              AI generation
            </p>
            <h2 className="mt-2 text-xl font-black tracking-[-0.02em] text-ink">
              AI store foundation
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Request schemas are prepared for future OpenAI/Gemini store, layout,
              section, theme, copywriting, and branding generation. No AI provider
              is called yet.
            </p>
            <div className="mt-5 grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  defaultValue={textValue(settings, "store_name", ownedStore.store_name)}
                  id="ai-niche-placeholder"
                  label="Niche input"
                  name="aiNichePlaceholder"
                  readOnly
                />
                <Input
                  defaultValue="Online shoppers"
                  id="ai-audience-placeholder"
                  label="Target audience"
                  name="aiAudiencePlaceholder"
                  readOnly
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="grid gap-2 text-sm font-semibold text-ink">
                  <span>Store type</span>
                  <select
                    className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink shadow-sm"
                    defaultValue="general"
                    disabled
                  >
                    <option value="general">General</option>
                    <option value="fashion">Fashion</option>
                    <option value="beauty">Beauty</option>
                    <option value="food">Food</option>
                    <option value="digital">Digital</option>
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-semibold text-ink">
                  <span>Language</span>
                  <select
                    className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink shadow-sm"
                    defaultValue={textValue(settings, "language", "en")}
                    disabled
                  >
                    <option value="en">English</option>
                    <option value="ar">Arabic</option>
                    <option value="fr">French</option>
                    <option value="es">Spanish</option>
                    <option value="pt">Portuguese</option>
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-semibold text-ink">
                  <span>Brand style</span>
                  <select
                    className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink shadow-sm"
                    defaultValue="modern"
                    disabled
                  >
                    <option value="modern">Modern</option>
                    <option value="luxury">Luxury</option>
                    <option value="playful">Playful</option>
                    <option value="minimal">Minimal</option>
                    <option value="bold">Bold</option>
                  </select>
                </label>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                {["Generate store", "Generate theme", "Generate sections"].map((label) => (
                  <div
                    className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-3 text-center text-xs font-black uppercase tracking-[0.16em] text-muted"
                    key={label}
                  >
                    {label}
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-5 grid gap-4 rounded-3xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                    AI provider foundation
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    Provider metadata, model configuration, prompt templates, and
                    structured JSON output mapping are prepared without API keys or
                    real provider calls.
                  </p>
                </div>
                <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-muted">
                  {aiProvider.status}
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-4">
                {[
                  ["Provider", aiProvider.providerName],
                  ["Model", aiProvider.modelKey],
                  ["Prompt", aiPromptTemplate.id ? "Custom" : "Fallback"],
                  ["Network", aiProviderResponsePreview.metadata.networkCall ? "Enabled" : "Disabled"]
                ].map(([label, value]) => (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3" key={label}>
                    <p className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-slate-400">
                      {label}
                    </p>
                    <p className="mt-1 truncate text-xs font-black capitalize text-ink">
                      {String(value)}
                    </p>
                  </div>
                ))}
              </div>
              <div className="grid gap-3 lg:grid-cols-[1fr_0.9fr]">
                <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                    Prompt orchestration
                  </p>
                  <select
                    className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-ink shadow-sm"
                    defaultValue={aiProvider.modelKey}
                    disabled
                  >
                    <option value="gpt-4o-mini">GPT-4o mini placeholder</option>
                    <option value="gpt-4.1-mini">GPT-4.1 mini placeholder</option>
                    <option value="gpt-4.1">GPT-4.1 placeholder</option>
                  </select>
                  <pre className="max-h-44 overflow-hidden rounded-2xl bg-white p-3 text-xs text-muted">
                    {aiPromptTemplate.body}
                  </pre>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {[
                      "Provider fallback prep",
                      "Token tracking prep",
                      "AI cost tracking prep",
                      "Moderation prep"
                    ].map((label) => (
                      <div
                        className="rounded-2xl border border-dashed border-slate-300 bg-white p-3 text-center text-xs font-black uppercase tracking-[0.16em] text-muted"
                        key={label}
                      >
                        {label}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-3">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                    AI output preview
                  </p>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-sm font-black text-ink">
                      {normalizedAIProviderPreview.store.title}
                    </p>
                    <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-muted">
                      {mappedAIProviderSchemaPreview.sections.length} mapped section
                      {mappedAIProviderSchemaPreview.sections.length === 1 ? "" : "s"} · structured JSON
                    </p>
                  </div>
                  <pre className="max-h-48 overflow-hidden rounded-2xl bg-slate-50 p-3 text-xs text-muted">
                    {JSON.stringify(aiProviderResponsePreview.raw, null, 2)}
                  </pre>
                  <div className="grid gap-2">
                    {aiProviderResults.length ? (
                      aiProviderResults.map((result) => (
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3" key={String(result.id)}>
                          <p className="text-sm font-black capitalize text-ink">
                            {textValue(result, "result_status", "prepared")}
                          </p>
                          <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-muted">
                            {textValue(result, "created_at", "Provider result placeholder")}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-3 text-sm font-semibold text-muted">
                        Provider generation results will appear here after real provider execution is enabled.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-5 grid gap-3 rounded-3xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                Generation status
              </p>
              {aiGenerations.length ? (
                aiGenerations.map((generation) => (
                  <div
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
                    key={String(generation.id)}
                  >
                    <p className="text-sm font-black text-ink">
                      {textValue(generation, "niche", "AI store concept")}
                    </p>
                    <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-muted">
                      {aiGenerationStatusLabel(generation.status)} ·{" "}
                      {textValue(generation, "brand_style", "modern")} ·{" "}
                      {textValue(generation, "layout_intent", "conversion")}
                    </p>
                  </div>
                ))
              ) : (
                <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-3 text-sm font-semibold text-muted">
                  No AI store generations queued yet.
                </p>
              )}
              {aiJobs.length ? (
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">
                  {aiJobs.length} job placeholder{aiJobs.length === 1 ? "" : "s"} ready for future provider execution.
                </p>
              ) : null}
            </div>
            <div className="mt-5 grid gap-3 rounded-3xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                    Queue workflow
                  </p>
                  <p className="mt-2 text-sm font-black capitalize text-ink">
                    {aiQueueId
                      ? `${workflowStatusLabel(aiQueue.workflow_state)} · ${workflowStatusLabel(aiQueue.queue_status)}`
                      : "No queued workflow"}
                  </p>
                </div>
                <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-muted">
                  Attempts {numberValue(aiQueue, "attempts", "0")} / {numberValue(aiQueue, "max_attempts", "3")}
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {["Run simulation", "Refresh progress"].map((label) => (
                  <div
                    className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-3 text-center text-xs font-black uppercase tracking-[0.16em] text-muted"
                    key={label}
                  >
                    {label}
                  </div>
                ))}
              </div>
              <div className="grid gap-2">
                {aiWorkflowProgressSteps.map((step) => (
                  <div
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3"
                    key={step.key}
                  >
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-ink">
                        {step.label}
                      </p>
                      <p className="mt-1 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-slate-400">
                        Step {step.order}
                      </p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-[0.65rem] font-black uppercase tracking-[0.16em] text-muted">
                      {step.status}
                    </span>
                  </div>
                ))}
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                  Retry preparation
                </p>
                <p className="mt-2 text-sm font-semibold text-muted">
                  {aiRetryPlan.canRetry
                    ? `${aiRetryPlan.remainingAttempts} simulated retry attempt${
                        aiRetryPlan.remainingAttempts === 1 ? "" : "s"
                      } remaining. Next delay: ${aiRetryPlan.nextDelaySeconds}s.`
                    : "No simulated retry attempts remaining."}
                </p>
              </div>
              {textValue(aiQueue, "error_message", "") ? (
                <div className="rounded-2xl border border-red-100 bg-red-50 p-3">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-red-500">
                    Failure state
                  </p>
                  <p className="mt-2 text-sm font-semibold text-red-700">
                    {textValue(aiQueue, "error_message", "Simulated workflow failed.")}
                  </p>
                </div>
              ) : null}
              <div className="grid gap-2 sm:grid-cols-2">
                {["Cancel generation", "Retry generation"].map((label) => (
                  <div
                    className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-3 text-center text-xs font-black uppercase tracking-[0.16em] text-muted"
                    key={label}
                  >
                    {label}
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                Workflow logs
              </p>
              <div className="mt-3 grid gap-2">
                {aiLogs.length ? (
                  aiLogs.map((log) => (
                    <div
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
                      key={String(log.id)}
                    >
                      <p className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-slate-400">
                        {textValue(log, "log_level", "info")}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-muted">
                        {textValue(log, "message", "Workflow log placeholder")}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-3 text-sm font-semibold text-muted">
                    Workflow logs will appear here when queue processing is wired.
                  </p>
                )}
              </div>
            </div>
            <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                Generated preview placeholder
              </p>
              <p className="mt-2 text-sm leading-6 text-muted">
                Future generated layouts can map into builder drafts through
                `mapAISchemaToBuilderDraft()` without rewriting the storefront.
              </p>
              <pre className="mt-3 max-h-40 overflow-hidden rounded-2xl bg-white p-3 text-xs text-muted">
                {aiPromptPreview}
              </pre>
            </div>
            <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                Simulated result preview
              </p>
              <p className="mt-2 text-sm leading-6 text-muted">
                This placeholder schema is generated locally for worker simulation
                prep only. It does not call OpenAI, Gemini, image APIs, credits, or
                payment systems.
              </p>
              <pre className="mt-3 max-h-56 overflow-hidden rounded-2xl bg-slate-50 p-3 text-xs text-muted">
                {JSON.stringify(generatedResultPreview, null, 2)}
              </pre>
            </div>
          </Card>
        </section>
        <section className="grid gap-6 xl:grid-cols-2" id="settings">
          <Card className="p-5 lg:p-6">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
              Settings
            </p>
            <h2 className="mt-2 text-xl font-black tracking-[-0.02em] text-ink">
              Store identity
            </h2>
            <form action={saveManagedStoreSettings} className="mt-5 grid gap-4">
              <input name="storeId" type="hidden" value={ownedStore.id} />
              <Input
                defaultValue={textValue(settings, "store_name", ownedStore.store_name)}
                id="managed-store-name"
                label="Store name"
                name="storeName"
                required
              />
              <Textarea
                defaultValue={textValue(settings, "store_description", "")}
                id="managed-store-description"
                label="Store description"
                name="storeDescription"
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  defaultValue={textValue(settings, "support_email", "")}
                  id="managed-support-email"
                  label="Support email"
                  name="supportEmail"
                  type="email"
                />
                <Input
                  defaultValue={textValue(settings, "store_phone", "")}
                  id="managed-support-phone"
                  label="Support phone"
                  name="supportPhone"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <Input
                  defaultValue={textValue(settings, "language", "en")}
                  id="managed-language"
                  label="Language"
                  name="language"
                />
                <Input
                  defaultValue={textValue(settings, "currency", "USD")}
                  id="managed-currency"
                  label="Currency"
                  name="currency"
                />
                <Input
                  defaultValue={textValue(settings, "timezone", "UTC")}
                  id="managed-timezone"
                  label="Timezone"
                  name="timezone"
                />
              </div>
              <Button className="w-fit" type="submit">
                Save settings
              </Button>
            </form>
          </Card>
          <Card className="p-5 lg:p-6" id="branding">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
              Branding
            </p>
            <h2 className="mt-2 text-xl font-black tracking-[-0.02em] text-ink">
              Theme foundation
            </h2>
            <form action={saveManagedStoreBranding} className="mt-5 grid gap-4">
              <input name="storeId" type="hidden" value={ownedStore.id} />
              <div className="flex items-center gap-3">
                <span
                  className="h-10 w-10 rounded-full border border-slate-200"
                  style={{ backgroundColor: textValue(branding, "primary_color", "#0f172a") }}
                />
                <span
                  className="h-10 w-10 rounded-full border border-slate-200"
                  style={{ backgroundColor: textValue(branding, "secondary_color", "#2563eb") }}
                />
                <p className="text-sm font-bold text-muted">
                  {textValue(branding, "theme_mode", "light")} theme
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  accept="image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon"
                  id="managed-logo"
                  label="Logo upload"
                  name="logo"
                  type="file"
                />
                <Input
                  accept="image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon"
                  id="managed-favicon"
                  label="Favicon upload"
                  name="favicon"
                  type="file"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  defaultValue={textValue(branding, "primary_color", "#0f172a")}
                  id="managed-primary-color"
                  label="Primary color"
                  name="primaryColor"
                  type="color"
                />
                <Input
                  defaultValue={textValue(branding, "secondary_color", "#2563eb")}
                  id="managed-secondary-color"
                  label="Secondary color"
                  name="secondaryColor"
                  type="color"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <Input
                  defaultValue={typographyValue(branding, "heading")}
                  id="managed-heading-font"
                  label="Heading font"
                  name="headingFont"
                />
                <Input
                  defaultValue={typographyValue(branding, "body")}
                  id="managed-body-font"
                  label="Body font"
                  name="bodyFont"
                />
                <label className="grid gap-2 text-sm font-semibold text-ink">
                  <span>Theme mode</span>
                  <select
                    className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink shadow-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                    defaultValue={textValue(branding, "theme_mode", "light")}
                    name="themeMode"
                  >
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                    <option value="system">System</option>
                  </select>
                </label>
              </div>
              <Textarea
                defaultValue={textValue(branding, "custom_css", "")}
                id="managed-custom-css"
                label="Custom CSS"
                name="customCss"
                placeholder=".store-hero { border-radius: 2rem; }"
              />
              <div className="grid gap-2 text-xs font-bold text-muted">
                {textValue(branding, "logo_url", "") || assetValue(branding, "logoUrl") ? (
                  <p>Current logo: {textValue(branding, "logo_url", assetValue(branding, "logoUrl"))}</p>
                ) : null}
                {textValue(branding, "favicon_url", "") || assetValue(branding, "faviconUrl") ? (
                  <p>Current favicon: {textValue(branding, "favicon_url", assetValue(branding, "faviconUrl"))}</p>
                ) : null}
              </div>
              <Button className="w-fit" type="submit">
                Save branding
              </Button>
            </form>
          </Card>
        </section>
        <section className="grid gap-6 xl:grid-cols-2" id="domains">
          <Card className="p-5 lg:p-6">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
              Domains
            </p>
            <h2 className="mt-2 text-xl font-black tracking-[-0.02em] text-ink">
              Subdomains and custom domains
            </h2>
            <form action={addManagedStoreDomain} className="mt-5 grid gap-4">
              <input name="storeId" type="hidden" value={ownedStore.id} />
              <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
                <Input
                  id="managed-domain-hostname"
                  label="Hostname"
                  name="hostname"
                  placeholder="store.shastore.ai or shop.example.com"
                  required
                />
                <label className="grid gap-2 text-sm font-semibold text-ink">
                  <span>Type</span>
                  <select
                    className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink shadow-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                    name="domainType"
                  >
                    <option value="subdomain">Subdomain</option>
                    <option value="custom">Custom</option>
                  </select>
                </label>
              </div>
              <Button className="w-fit" type="submit">
                Attach domain
              </Button>
            </form>
            <div className="mt-5 grid gap-3">
              {domains.length ? (
                domains.map((domain) => (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4" key={String(domain.id)}>
                    <p className="font-bold text-ink">{textValue(domain, "hostname")}</p>
                    <p className="mt-1 text-xs font-black uppercase tracking-[0.14em] text-muted">
                      {textValue(domain, "domain_type")} · DNS {textValue(domain, "dns_status")} · SSL{" "}
                      {textValue(domain, "ssl_status")}
                    </p>
                    <form action={verifyManagedStoreDomain} className="mt-3">
                      <input name="storeId" type="hidden" value={ownedStore.id} />
                      <input name="domainId" type="hidden" value={String(domain.id)} />
                      <Button type="submit" variant="secondary">
                        Recheck verification
                      </Button>
                    </form>
                  </div>
                ))
              ) : (
                <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm font-semibold text-muted">
                  No store domains configured yet.
                </p>
              )}
            </div>
          </Card>
          <Card className="p-5 lg:p-6" id="subscription">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
              Subscription
            </p>
            <h2 className="mt-2 text-xl font-black tracking-[-0.02em] text-ink">
              Per-store plan limits
            </h2>
            <form action={updateManagedStoreSubscription} className="mt-5 flex flex-wrap gap-3">
              <input name="storeId" type="hidden" value={ownedStore.id} />
              <label className="grid gap-2 text-sm font-semibold text-ink">
                <span>Plan</span>
                <select
                  className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink shadow-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                  defaultValue={textValue(subscription, "plan_id", "starter")}
                  name="planId"
                >
                  <option value="starter">Starter</option>
                  <option value="pro">Pro</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </label>
              <Button className="self-end" type="submit">
                Save plan
              </Button>
            </form>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                  Products
                </p>
                <p className="mt-2 text-sm font-black text-ink">
                  {numberValue(planLimits, "products_limit")}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                  Storage MB
                </p>
                <p className="mt-2 text-sm font-black text-ink">
                  {numberValue(planLimits, "storage_mb_limit")}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                  Domains
                </p>
                <p className="mt-2 text-sm font-black text-ink">
                  {numberValue(planLimits, "domains_limit")}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                  AI Usage
                </p>
                <p className="mt-2 text-sm font-black text-ink">
                  {numberValue(planLimits, "ai_usage_limit")}
                </p>
              </div>
            </div>
          </Card>
        </section>
        <section className="grid gap-6 xl:grid-cols-3" id="staff">
          <Card className="p-5 lg:p-6">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
              Staff
            </p>
            <h2 className="mt-2 text-xl font-black tracking-[-0.02em] text-ink">
              Team access
            </h2>
            <form action={inviteManagedStoreStaff} className="mt-5 grid gap-4">
              <input name="storeId" type="hidden" value={ownedStore.id} />
              <Input id="managed-staff-email" label="Staff email" name="staffEmail" required type="email" />
              <Input id="managed-staff-name" label="Staff name" name="staffName" />
              <label className="grid gap-2 text-sm font-semibold text-ink">
                <span>Role</span>
                <select
                  className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink shadow-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                  name="roleKey"
                >
                  <option value="admin">Admin</option>
                  <option value="editor">Editor</option>
                  <option value="support">Support</option>
                </select>
              </label>
              <Button type="submit">Invite staff</Button>
            </form>
            <p className="mt-4 text-4xl font-black text-ink">{staff.length}</p>
            <p className="mt-2 text-sm font-semibold text-muted">Staff records invited or active.</p>
            <div className="mt-4 grid gap-2">
              {staff.map((member) => (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3" key={String(member.id)}>
                  <p className="text-sm font-bold text-ink">{textValue(member, "staff_email")}</p>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-muted">
                    {textValue(member, "role_key")} · {textValue(member, "staff_status")}
                  </p>
                  <form action={removeManagedStoreStaff} className="mt-2">
                    <input name="storeId" type="hidden" value={ownedStore.id} />
                    <input name="staffId" type="hidden" value={String(member.id)} />
                    <Button type="submit" variant="secondary">
                      Remove
                    </Button>
                  </form>
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-5 lg:p-6">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
              Roles
            </p>
            <div className="mt-5 grid gap-2">
              {roles.length ? (
                roles.map((role) => (
                  <p className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm font-bold text-ink" key={String(role.id)}>
                    {textValue(role, "role_name")}
                  </p>
                ))
              ) : (
                <p className="text-sm font-semibold text-muted">Default roles are not initialized yet.</p>
              )}
            </div>
          </Card>
          <Card className="p-5 lg:p-6" id="media">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
              Media
            </p>
            <h2 className="mt-2 text-xl font-black tracking-[-0.02em] text-ink">
              Isolated assets
            </h2>
            <form action={createManagedMediaFolder} className="mt-5 grid gap-3">
              <input name="storeId" type="hidden" value={ownedStore.id} />
              <Input id="managed-folder-name" label="Folder name" name="folderName" placeholder="Brand assets" />
              <Input id="managed-folder-path" label="Folder path" name="folderPath" placeholder="brand-assets" />
              <Button type="submit" variant="secondary">
                Create folder
              </Button>
            </form>
            <form action={uploadManagedStoreMedia} className="mt-5 grid gap-3">
              <input name="storeId" type="hidden" value={ownedStore.id} />
              <Input id="managed-media-file" label="Upload image/video" name="mediaFile" required type="file" />
              <Input id="managed-media-folder" label="Folder path" name="folderPath" placeholder="library" />
              <Input id="managed-media-alt" label="Alt text" name="altText" />
              <Button type="submit">Upload media</Button>
            </form>
            <p className="mt-4 text-4xl font-black text-ink">{media.length}</p>
            <p className="mt-2 text-sm font-semibold text-muted">
              Latest media records scoped to this store.
            </p>
            <div className="mt-4 grid gap-2">
              {media.slice(0, 5).map((asset) => (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3" key={String(asset.id)}>
                  <p className="text-sm font-bold text-ink">{textValue(asset, "file_name")}</p>
                  <p className="text-xs font-semibold text-muted">
                    {textValue(asset, "file_type")} · {numberValue(asset, "file_size_bytes", "0")} bytes
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </section>
        <section id="analytics">
          <Card className="p-5 lg:p-6">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
              Analytics
            </p>
            <h2 className="mt-2 text-xl font-black tracking-[-0.02em] text-ink">
              Store usage tracking
            </h2>
            <form action={refreshManagedStoreUsage} className="mt-5">
              <input name="storeId" type="hidden" value={ownedStore.id} />
              <Button type="submit" variant="secondary">
                Refresh usage
              </Button>
            </form>
            <div className="mt-5 grid gap-3 md:grid-cols-5">
              {[
                ["Products", "products_count"],
                ["Storage MB", "storage_mb_used"],
                ["Domains", "domains_count"],
                ["Traffic", "monthly_traffic_count"],
                ["AI Usage", "ai_usage_count"]
              ].map(([label, key]) => (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4" key={key}>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                    {label}
                  </p>
                  <p className="mt-2 text-sm font-black text-ink">
                    {numberValue(usage[0], key, "0")}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </section>
      </div>
    );
  }

  const [{ data: categories }, { data: products }, { data: themeRow }] = await Promise.all([
    supabase
      .from("store_categories")
      .select("id, name, description, image_url, sort_order")
      .eq("store_id", store.id)
      .eq("user_id", user.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("store_products")
      .select("id, name, description, price, image_url, category_id, sort_order")
      .eq("store_id", store.id)
      .eq("user_id", user.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("store_theme_settings")
      .select("settings")
      .eq("store_id", store.id)
      .eq("user_id", user.id)
      .maybeSingle()
  ]);
  const themeSettings = normalizeStoreThemeSettings(themeRow?.settings);
  const { data: rawPublication } = await supabase
    .from("published_stores")
    .select("*")
    .eq("store_id", store.id)
    .eq("user_id", user.id)
    .maybeSingle();
  const publication = rawPublication as PublicationRow | null;

  return (
    <div className="grid gap-6 lg:gap-8">
      <PageHeader
        action={<ButtonLink href="/dashboard/stores/new">Create another store</ButtonLink>}
        description="Review the saved Store Mode draft. Public store publishing is not enabled yet."
        title={store.name}
      />
      {query.saved ? (
        <Card className="border-emerald-200 bg-emerald-50 p-5">
          <p className="text-sm font-bold text-emerald-700">
            Store draft saved successfully.
          </p>
        </Card>
      ) : null}
      {query.published ? (
        <Card className="border-emerald-200 bg-emerald-50 p-5">
          <p className="text-sm font-bold text-emerald-700">
            Store published successfully.
          </p>
        </Card>
      ) : null}
      {query.unpublished ? (
        <Card className="border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-bold text-amber-700">
            Store unpublished. Public access is now disabled.
          </p>
        </Card>
      ) : null}
      {query.error ? (
        <Card className="border-red-200 bg-red-50 p-5">
          <p className="text-sm font-bold text-red-700">{query.error}</p>
        </Card>
      ) : null}
      {query.theme === "saved" ? (
        <Card className="border-emerald-200 bg-emerald-50 p-5">
          <p className="text-sm font-bold text-emerald-700">
            Store theme settings saved.
          </p>
        </Card>
      ) : null}
      {query.publication === "saved" ? (
        <Card className="border-emerald-200 bg-emerald-50 p-5">
          <p className="text-sm font-bold text-emerald-700">
            Publication and SEO settings saved.
          </p>
        </Card>
      ) : null}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)]">
        <Card className="p-5 lg:p-6">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
            Store draft
          </p>
          <h2 className="mt-3 text-2xl font-black tracking-[-0.03em] text-ink">
            {store.name}
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted">
            {store.description || "No store description yet."}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-muted">
              {publication?.status ?? store.status}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-muted">
              {publication?.visibility ?? "private"}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-muted">
              {store.template_id}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-muted">
              {store.currency}
            </span>
            {store.whatsapp_number ? (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-muted">
                WhatsApp connected
              </span>
            ) : null}
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-muted">
              Published{" "}
              {publication?.published_at
                ? new Intl.DateTimeFormat("en", {
                    month: "short",
                    day: "numeric",
                    year: "numeric"
                  }).format(new Date(publication.published_at))
                : "not yet"}
            </span>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <ButtonLink href="/dashboard/stores" variant="secondary">
              Back to stores
            </ButtonLink>
            {publication?.status === "published" ? (
              <>
                {publication.visibility !== "private" ? (
                  <>
                    <ButtonLink href={`/store/${publication.slug}`} target="_blank">
                      Open public store
                    </ButtonLink>
                    <CopyStoreUrlButton url={`/store/${publication.slug}`} />
                  </>
                ) : null}
                <form action={unpublishStore}>
                  <input name="storeId" type="hidden" value={store.id} />
                  <Button type="submit" variant="secondary">
                    Unpublish
                  </Button>
                </form>
              </>
            ) : (
              <form action={publishStoreDraft}>
                <input name="storeId" type="hidden" value={store.id} />
                <Button type="submit">
                  {publication?.status === "unpublished" ? "Republish store" : "Publish store"}
                </Button>
              </form>
            )}
            <ButtonLink href="/dashboard/stores/new" variant="secondary">
              New draft
            </ButtonLink>
          </div>
        </Card>
        <Card className="p-5 lg:p-6">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
            Live preview snapshot
          </p>
          <div className="mt-5 rounded-[2rem] border border-slate-200 bg-slate-50 p-5">
            <div
              className="mb-4 h-3 w-3 rounded-full"
              style={{ backgroundColor: store.brand_color }}
            />
            <h3 className="text-2xl font-black tracking-[-0.03em] text-ink">
              {store.name}
            </h3>
            <p className="mt-2 text-sm leading-6 text-muted">
              {store.description || "A premium store homepage draft."}
            </p>
            <div className="mt-5 grid gap-2">
              {(products ?? []).slice(0, 3).map((product) => (
                <div
                  className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-3"
                  key={product.id}
                >
                  <p className="text-sm font-bold text-ink">{product.name}</p>
                  <p className="text-xs font-black text-slate-400">
                    {product.price || store.currency}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
      <Card className="p-5 lg:p-6">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
            Publishing and domains
          </p>
          <h2 className="text-xl font-black tracking-[-0.02em] text-ink">
            Store publication foundation
          </h2>
          <p className="text-sm leading-6 text-muted">
            Manage SEO, visibility, and future custom domain fields without changing
            the public store route.
          </p>
        </div>
        <form action={saveStorePublicationSettings} className="mt-5 grid gap-5">
          <input name="storeId" type="hidden" value={store.id} />
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="grid gap-2 text-sm font-semibold text-ink">
              <span>Visibility</span>
              <select
                className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink shadow-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                defaultValue={publication?.visibility ?? "public"}
                name="visibility"
              >
                <option value="public">Public</option>
                <option value="private">Private</option>
              </select>
            </label>
            <Input
              defaultValue={publication?.subdomain ?? ""}
              id="publication-subdomain"
              label="Future subdomain"
              name="subdomain"
              placeholder="my-store"
            />
            <Input
              defaultValue={publication?.custom_domain ?? ""}
              id="publication-custom-domain"
              label="Future custom domain"
              name="customDomain"
              placeholder="shop.example.com"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              defaultValue={publication?.seo_title ?? ""}
              id="publication-seo-title"
              label="SEO title"
              name="seoTitle"
              placeholder={store.name}
            />
            <Input
              defaultValue={publication?.og_title ?? ""}
              id="publication-og-title"
              label="OpenGraph title"
              name="ogTitle"
              placeholder={store.name}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Textarea
              defaultValue={publication?.seo_description ?? ""}
              id="publication-seo-description"
              label="SEO description"
              name="seoDescription"
              placeholder={store.description || "Search result description"}
            />
            <Textarea
              defaultValue={publication?.og_description ?? ""}
              id="publication-og-description"
              label="OpenGraph description"
              name="ogDescription"
              placeholder={store.description || "Social preview description"}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              defaultValue={publication?.favicon_url ?? ""}
              id="publication-favicon"
              label="Favicon URL"
              name="faviconUrl"
              placeholder="https://example.com/favicon.png"
            />
            <Input
              defaultValue={publication?.social_image_url ?? ""}
              id="publication-social-image"
              label="Social preview image"
              name="socialImageUrl"
              placeholder="https://example.com/og.jpg"
            />
          </div>
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-muted">
            <p className="font-bold text-ink">Publication hostname</p>
            <p className="mt-1">
              {publication?.hostname ||
                "Add a subdomain or custom domain to reserve a future hostname."}
            </p>
            <p className="mt-2">
              DNS provisioning is intentionally not enabled yet. Localhost and
              /store/{publication?.slug ?? "slug"} continue to work normally.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 border-t border-slate-200 pt-5">
            <Button type="submit">Save publication settings</Button>
            {publication?.slug ? (
              <CopyStoreUrlButton url={`/store/${publication.slug}`} />
            ) : null}
          </div>
        </form>
      </Card>

      <Card className="p-5 lg:p-6">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
            Theme customization
          </p>
          <h2 className="text-xl font-black tracking-[-0.02em] text-ink">
            Edit saved theme settings
          </h2>
          <p className="text-sm leading-6 text-muted">
            These settings use the existing store theme table and update the public
            storefront after save.
          </p>
        </div>
        <form action={saveStoreThemeSettings} className="mt-5 grid gap-5">
          <input name="storeId" type="hidden" value={store.id} />
          <div className="grid gap-4 sm:grid-cols-3">
            <Input
              defaultValue={themeSettings.primaryColor}
              id="saved-theme-primary"
              label="Primary color"
              name="themePrimaryColor"
              type="color"
            />
            <Input
              defaultValue={themeSettings.secondaryColor}
              id="saved-theme-secondary"
              label="Secondary color"
              name="themeSecondaryColor"
              type="color"
            />
            <Input
              defaultValue={themeSettings.accentColor}
              id="saved-theme-accent"
              label="Accent color"
              name="themeAccentColor"
              type="color"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Input
              defaultValue={themeSettings.gradientFrom}
              id="saved-theme-gradient-from"
              label="Gradient from"
              name="themeGradientFrom"
              type="color"
            />
            <Input
              defaultValue={themeSettings.gradientTo}
              id="saved-theme-gradient-to"
              label="Gradient to"
              name="themeGradientTo"
              type="color"
            />
            <Input
              accept="image/*"
              id="saved-theme-logo-upload"
              label="Logo upload"
              name="logoImage"
              type="file"
            />
          </div>
          <Input
            defaultValue={themeSettings.logoUrl}
            id="saved-theme-logo-url"
            label="Logo URL"
            name="themeLogoUrl"
            placeholder="https://example.com/logo.png"
          />
          <Input
            defaultValue={themeSettings.announcementText}
            id="saved-theme-announcement"
            label="Announcement bar"
            name="themeAnnouncementText"
            placeholder="Free delivery this week"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              defaultValue={themeSettings.heroTitle}
              id="saved-theme-hero-title"
              label="Hero title"
              name="themeHeroTitle"
              placeholder={store.name}
            />
            <Input
              defaultValue={themeSettings.ctaText}
              id="saved-theme-cta"
              label="CTA text"
              name="themeCtaText"
            />
          </div>
          <Textarea
            defaultValue={themeSettings.heroSubtitle}
            id="saved-theme-hero-subtitle"
            label="Hero subtitle"
            name="themeHeroSubtitle"
            placeholder={store.description || "Premium storefront subtitle"}
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="grid gap-2 text-sm font-semibold text-ink">
              <span>Button style</span>
              <select
                className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink shadow-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                defaultValue={themeSettings.buttonStyle}
                name="themeButtonStyle"
              >
                <option value="pill">Pill</option>
                <option value="rounded">Rounded</option>
                <option value="sharp">Sharp</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-semibold text-ink">
              <span>Heading font</span>
              <select
                className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink shadow-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                defaultValue={themeSettings.headingFont}
                name="themeHeadingFont"
              >
                <option value="inter">Modern sans</option>
                <option value="serif">Editorial serif</option>
                <option value="display">Premium display</option>
                <option value="mono">Tech mono</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-semibold text-ink">
              <span>Font scale</span>
              <select
                className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink shadow-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                defaultValue={themeSettings.fontScale}
                name="themeFontScale"
              >
                <option value="compact">Compact</option>
                <option value="comfortable">Comfortable</option>
                <option value="large">Large</option>
              </select>
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Input
              defaultValue={themeSettings.footerBackgroundColor}
              id="saved-theme-footer-background"
              label="Footer background"
              name="themeFooterBackgroundColor"
              type="color"
            />
            <Input
              defaultValue={themeSettings.footerTextColor}
              id="saved-theme-footer-text"
              label="Footer text"
              name="themeFooterTextColor"
              type="color"
            />
            <Input
              defaultValue={themeSettings.copyrightText}
              id="saved-theme-copyright"
              label="Copyright text"
              name="themeCopyrightText"
              placeholder="© 2026 Your Store"
            />
          </div>
          <div className="flex flex-wrap gap-3 border-t border-slate-200 pt-5">
            <Button type="submit">Save theme settings</Button>
            {publication?.status === "published" ? (
              <ButtonLink href={`/store/${publication.slug}`} target="_blank" variant="secondary">
                Preview public store
              </ButtonLink>
            ) : null}
          </div>
        </form>
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5 lg:p-6">
          <h2 className="text-xl font-black tracking-[-0.02em] text-ink">
            Categories
          </h2>
          <div className="mt-5 grid gap-3">
            {(categories ?? []).length ? (
              (categories ?? []).map((category) => (
                <div
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  key={category.id}
                >
                  {category.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      alt={category.name}
                      className="mb-4 aspect-[16/9] w-full rounded-2xl object-cover"
                      src={category.image_url}
                    />
                  ) : (
                    <div className="mb-4 flex aspect-[16/9] w-full items-center justify-center rounded-2xl border border-slate-200 bg-white text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                      Category image
                    </div>
                  )}
                  <p className="font-bold text-ink">{category.name}</p>
                  <p className="mt-1 text-sm leading-6 text-muted">
                    {category.description || "No category description."}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm leading-6 text-muted">
                No categories saved yet.
              </p>
            )}
          </div>
        </Card>
        <Card className="p-5 lg:p-6">
          <h2 className="text-xl font-black tracking-[-0.02em] text-ink">
            Products
          </h2>
          <div className="mt-5 grid gap-3">
            {(products ?? []).length ? (
              (products ?? []).map((product) => (
                <div
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  key={product.id}
                >
                  {product.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      alt={product.name}
                      className="mb-4 aspect-[16/9] w-full rounded-2xl object-cover"
                      src={product.image_url}
                    />
                  ) : (
                    <div className="mb-4 flex aspect-[16/9] w-full items-center justify-center rounded-2xl border border-slate-200 bg-white text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                      Product image
                    </div>
                  )}
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-bold text-ink">{product.name}</p>
                    <p className="shrink-0 text-sm font-black text-ink">
                      {product.price || store.currency}
                    </p>
                  </div>
                  <p className="mt-1 text-sm leading-6 text-muted">
                    {product.description || "No product description."}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm leading-6 text-muted">No products saved yet.</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
