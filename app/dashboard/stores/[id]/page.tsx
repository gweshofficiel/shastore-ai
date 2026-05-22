import { notFound } from "next/navigation";
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
          .select("id, has_unsaved_changes, updated_at, editor_state")
          .eq("builder_page_id", builderPageId)
          .maybeSingle()
      : { data: null };
    const { data: builderVersionsData } = builderPageId
      ? await supabase
          .from("builder_layout_versions" as never)
          .select("id, version_number, status, published_at")
          .eq("builder_page_id", builderPageId)
          .order("version_number", { ascending: false })
          .limit(5)
      : { data: [] };
    const builderState = (builderStateData ?? {}) as Record<string, unknown>;
    const builderDraft = (builderDraftData ?? {}) as Record<string, unknown>;
    const builderVersions = Array.isArray(builderVersionsData)
      ? (builderVersionsData as Record<string, unknown>[])
      : [];
    const builderPageSchema =
      builderState.page_schema && typeof builderState.page_schema === "object"
        ? (builderState.page_schema as Record<string, unknown>)
        : {};
    const builderSections = Array.isArray(builderPageSchema.sections)
      ? builderPageSchema.sections
      : [];
    const editorState =
      builderState.editor_state && typeof builderState.editor_state === "object"
        ? (builderState.editor_state as Record<string, unknown>)
        : {};
    const builderMode = textValue(editorState, "mode", "desktop");
    const selectedSectionId = textValue(editorState, "selectedSectionId", "None selected");
    const draggingSectionId = textValue(editorState, "draggingSectionId", "Idle");
    const previewSyncPending =
      typeof editorState.previewSyncPending === "boolean"
        ? editorState.previewSyncPending
        : false;
    const hasUnsavedChanges =
      builderDraft.has_unsaved_changes === true ||
      previewSyncPending;
    const { data: aiGenerationsData } = await supabase
      .from("ai_store_generations" as never)
      .select("id, status, niche, store_type, language, brand_style, layout_intent, created_at")
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
    const aiRequestPreview = createAIStoreGenerationRequest({
      brandStyle: "modern",
      language: textValue(settings, "language", "en"),
      layoutIntent: "conversion",
      niche: textValue(settings, "store_name", ownedStore.store_name),
      storeType: "general",
      targetAudience: "Online shoppers"
    });
    const aiPromptPreview = prepareStoreGenerationPrompt(aiRequestPreview);

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
                  Attempts {textValue(aiQueue, "attempts", "0")} / {textValue(aiQueue, "max_attempts", "3")}
                </span>
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
