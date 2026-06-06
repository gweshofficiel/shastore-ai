import { PageHeader } from "@/components/dashboard/page-header";
import { UpgradeRequiredCard } from "@/components/billing/UpgradeRequiredCard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  applyAITemplateSuggestionsToDraftAction,
  createAITemplateCustomizationAction
} from "@/lib/ai-template-customization-actions";
import {
  applyAISuggestionToDraftAction,
  previewAIChangesAction,
  rejectAISuggestionAction,
  rollbackAIApplicationAction
} from "@/lib/ai-draft-application-actions";
import {
  applyControlledOpenAIToDraftAction,
  executeControlledOpenAIAction
} from "@/lib/openai-execution-actions";
import {
  applyTemplateToStore,
  applyWorkspaceStoreTemplate
} from "@/lib/template-application-actions";
import { getTemplateLibrary, validateTemplateSchema, type StoreTemplateRecord } from "@/lib/storefront/template-library";
import {
  templateLibraryBadges,
  templatePreviewSummary
} from "@/lib/storefront/template-preview-summary";
import { getCurrentUserSubscriptionAccess } from "@/lib/billing/access";
import { getRecommendedUpgrade } from "@/lib/billing/upgrade";
import { createClient } from "@/lib/supabase/server";
import { getUserPrimaryWorkspaceId, getUserWorkspaceRole, hasPermission } from "@/lib/permissions/rbac";
import { fetchStoresForAuthUser } from "@/lib/stores/user-stores";
import { getActiveWorkspaceForUser } from "@/lib/workspaces/active-workspace";

export const dynamic = "force-dynamic";

type ClaimedStoreRow = {
  access_role?: string | null;
  id: string;
  internal_slug?: string | null;
  store_name?: string | null;
};

type WorkspaceTemplateStoreRow = {
  id: string;
  name: string;
  store_name?: string | null;
  template_id?: string | null;
  theme_color?: string | null;
  workspace_id?: string | null;
};

const statusMessages: Record<string, string> = {
  "ai-customization-applied": "AI suggestions were applied to the selected store draft only.",
  "ai-customization-apply-failed": "AI suggestions could not be applied to the draft.",
  "ai-customization-created": "AI template customization suggestions were prepared without calling real AI APIs.",
  "ai-customization-draft-missing": "Apply or create a builder draft before applying AI suggestions.",
  "ai-customization-failed": "AI customization request could not be prepared.",
  "ai-customization-invalid": "Add a niche and a useful business description before customizing.",
  "ai-customization-missing": "Choose a store and template before customizing with AI.",
  "ai-customization-missing-suggestions": "Create AI suggestions before applying them to a draft.",
  "ai-application-applied": "AI suggestion was applied safely to the selected draft.",
  "ai-application-draft-missing": "Create a builder draft before applying AI changes.",
  "ai-application-failed": "AI suggestion could not be applied to the draft.",
  "ai-application-invalid": "AI suggestion patch is not safe to apply.",
  "ai-application-missing": "Choose a store and template before reviewing AI suggestions.",
  "ai-application-no-suggestion": "Prepare AI suggestions before reviewing draft changes.",
  "ai-application-preview-created": "AI change preview was prepared.",
  "ai-application-preview-failed": "AI change preview could not be prepared.",
  "ai-application-rejected": "AI suggestion was rejected.",
  "ai-application-rollback-failed": "AI draft application rollback failed.",
  "ai-application-rollback-missing": "Choose an AI draft application to roll back.",
  "ai-application-rolled-back": "AI draft application was rolled back to its snapshot.",
  "openai-execution-applied": "Controlled OpenAI output was applied to the selected store draft only.",
  "openai-execution-apply-failed": "Controlled OpenAI output could not be applied to draft.",
  "openai-execution-complete": "Controlled OpenAI execution completed and output was validated.",
  "openai-execution-draft-missing": "Create or apply a template draft before applying OpenAI output.",
  "openai-execution-failed": "Controlled OpenAI execution failed or returned invalid output.",
  "openai-execution-invalid-output": "Latest OpenAI output is not safe to apply.",
  "openai-execution-log-failed": "Controlled OpenAI execution log could not be created.",
  "openai-execution-missing": "Choose a store and template before executing OpenAI.",
  "openai-execution-missing-key": "OpenAI execution is ready but OPENAI_API_KEY is not configured.",
  "openai-execution-needs-customization": "Prepare AI customization suggestions before executing OpenAI.",
  "openai-execution-no-output": "No validated OpenAI output is ready to apply.",
  applied: "Template applied successfully to the selected store.",
  "apply-failed": "Template application failed and rollback was attempted.",
  "draft-created": "Template draft was created.",
  "draft-failed": "Template draft could not be created.",
  "invalid-template": "Template schema is incomplete and cannot be applied.",
  "missing-selection": "Choose a store and template before applying.",
  "not-authorized": "You can only apply templates to stores you own or manage.",
  "sections-failed": "Template sections could not be applied.",
  "template-missing": "Template was not found.",
  "theme-applied": "Template theme was applied to the draft workspace.",
  "theme-failed": "Template theme could not be applied.",
  "upgrade-required": "This template is unavailable on your current plan. Upgrade at /dashboard/billing."
};

function templateBadges(template: StoreTemplateRecord) {
  return templateLibraryBadges(template);
}

function appliedTemplateId(editorState: unknown) {
  if (!editorState || typeof editorState !== "object" || Array.isArray(editorState)) {
    return "";
  }

  const value = (editorState as Record<string, unknown>).templateId;
  return typeof value === "string" ? value : "";
}

async function getClaimedStores() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return [];
  }

  const { data, error } = await supabase.rpc(
    "get_claimed_store_instances_for_current_user" as never
  );

  if (error || !Array.isArray(data)) {
    return [];
  }

  return (data as ClaimedStoreRow[]).filter(
    (store) => !store.access_role || store.access_role === "owner" || store.access_role === "admin"
  );
}

async function getWorkspaceTemplateStores(): Promise<WorkspaceTemplateStoreRow[]> {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return [];
  }

  const selection = await getActiveWorkspaceForUser({ supabase, userId: user.id });
  const role = await getUserWorkspaceRole(supabase, selection.activeWorkspaceId, user.id);

  if (!hasPermission(role, "can_view_stores")) {
    return [];
  }

  const { stores } = await fetchStoresForAuthUser(supabase, user.id, selection.activeWorkspaceId);

  return stores as WorkspaceTemplateStoreRow[];
}

async function getAppliedTemplateForStore(storeId: string) {
  if (!storeId) {
    return "";
  }

  const supabase = await createClient();
  const { data: pageData } = await supabase
    .from("builder_pages" as never)
    .select("id")
    .eq("store_instance_id", storeId)
    .eq("page_key", "home")
    .maybeSingle();
  const pageId = pageData ? (pageData as { id?: string }).id : "";

  if (!pageId) {
    return "";
  }

  const { data: draftData } = await supabase
    .from("builder_drafts" as never)
    .select("editor_state")
    .eq("builder_page_id", pageId)
    .maybeSingle();

  return appliedTemplateId((draftData as { editor_state?: unknown } | null)?.editor_state);
}

async function getLatestAICustomizationForStore(storeId: string, templateId: string) {
  if (!storeId || !templateId) {
    return null;
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("ai_template_customizations" as never)
    .select("id, customization_status, input_payload, suggested_changes, prompt_preview, created_at")
    .eq("store_instance_id", storeId)
    .eq("template_id", templateId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ? (data as Record<string, unknown>) : null;
}

async function getLatestOpenAIExecutionForStore(storeId: string, customizationId: string) {
  if (!storeId || !customizationId) {
    return { attempts: [], log: null, validation: null };
  }

  const supabase = await createClient();
  const { data: logData } = await supabase
    .from("ai_execution_logs" as never)
    .select("id, execution_status, prompt_preview, safe_actions, blocked_actions, created_at")
    .eq("store_instance_id", storeId)
    .eq("customization_id", customizationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const log = logData ? (logData as Record<string, unknown>) : null;
  const logId = typeof log?.id === "string" ? log.id : "";
  const { data: attemptsData } = logId
    ? await supabase
        .from("ai_execution_attempts" as never)
        .select("id, attempt_status, attempt_number, model_key, error_message, token_usage, created_at")
        .eq("execution_log_id", logId)
        .order("attempt_number", { ascending: false })
        .limit(3)
    : { data: [] };
  const { data: validationData } = logId
    ? await supabase
        .from("ai_response_validations" as never)
        .select("validation_status, validation_errors, blocked_fields, sanitized_output, mapped_draft_preview, created_at")
        .eq("execution_log_id", logId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  return {
    attempts: Array.isArray(attemptsData) ? (attemptsData as Record<string, unknown>[]) : [],
    log,
    validation: validationData ? (validationData as Record<string, unknown>) : null
  };
}

async function getLatestAIApplicationForStore(storeId: string, customizationId: string) {
  if (!storeId || !customizationId) {
    return { application: null, preview: null, review: null };
  }

  const supabase = await createClient();
  const { data: applicationData } = await supabase
    .from("ai_draft_applications" as never)
    .select("id, application_status, application_scope, applied_fields, rejected_fields, before_snapshot, after_snapshot, rollback_snapshot, created_at")
    .eq("store_instance_id", storeId)
    .eq("customization_id", customizationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const application = applicationData ? (applicationData as Record<string, unknown>) : null;
  const applicationId = typeof application?.id === "string" ? application.id : "";
  const { data: previewData } = applicationId
    ? await supabase
        .from("ai_change_previews" as never)
        .select("preview_status, diff_summary, safe_patch, blocked_patch, draft_sync_state, created_at")
        .eq("draft_application_id", applicationId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };
  const { data: reviewData } = applicationId
    ? await supabase
        .from("ai_suggestion_reviews" as never)
        .select("review_status, reviewed_fields, rejected_fields, review_notes, partial_apply_config, created_at")
        .eq("draft_application_id", applicationId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  return {
    application,
    preview: previewData ? (previewData as Record<string, unknown>) : null,
    review: reviewData ? (reviewData as Record<string, unknown>) : null
  };
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function textValue(record: Record<string, unknown>, key: string, fallback = "Not set") {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value : fallback;
}

export default async function TemplatesPage({
  searchParams
}: {
  searchParams: Promise<{ category?: string; detail?: string; storeId?: string; templateApply?: string; templateId?: string; workspaceStoreId?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (user) {
    const workspaceId = await getUserPrimaryWorkspaceId(supabase, user.id);
    const role = await getUserWorkspaceRole(supabase, workspaceId, user.id);

    if (!hasPermission(role, "can_view_templates")) {
      console.warn("[permission-denied] templates page denied", {
        permission: "can_view_templates",
        role,
        userId: user.id,
        workspaceId
      });

      return (
        <div className="grid gap-6 lg:gap-8">
          <PageHeader
            description="Template access is assigned by workspace role."
            title="Templates"
          />
          <Card className="border-amber-200 bg-amber-50 p-5">
            <p className="text-sm font-bold text-amber-800">
              You do not have permission to view templates.
            </p>
          </Card>
        </div>
      );
    }
  }

  const [access, stores, workspaceStores] = await Promise.all([
    getCurrentUserSubscriptionAccess(),
    getClaimedStores(),
    getWorkspaceTemplateStores()
  ]);
  const selectedStoreId =
    stores.find((store) => store.id === params.storeId)?.id ?? stores[0]?.id ?? "";
  const selectedWorkspaceStoreId =
    workspaceStores.find(
      (store) => store.id === params.workspaceStoreId || store.id === params.storeId
    )?.id ??
    workspaceStores[0]?.id ??
    "";
  const selectedCategory = params.category ?? "all";
  const library = await getTemplateLibrary();
  const appliedTemplate = await getAppliedTemplateForStore(selectedStoreId);
  const templates =
    selectedCategory === "all"
      ? library.templates
      : library.templates.filter((template) => template.niche_category === selectedCategory);
  const activeStore = stores.find((store) => store.id === selectedStoreId);
  const selectedTemplateId = params.templateId ?? templates[0]?.id ?? "";
  const latestAICustomization = await getLatestAICustomizationForStore(
    selectedStoreId,
    selectedTemplateId
  );
  const latestCustomizationId =
    typeof latestAICustomization?.id === "string" ? latestAICustomization.id : "";
  const latestOpenAIExecution = await getLatestOpenAIExecutionForStore(
    selectedStoreId,
    latestCustomizationId
  );
  const latestAIApplication = await getLatestAIApplicationForStore(
    selectedStoreId,
    latestCustomizationId
  );
  const aiSuggestedChanges = recordValue(latestAICustomization?.suggested_changes);
  const aiBrandingSuggestion = recordValue(aiSuggestedChanges.branding);
  const aiCopySuggestion = recordValue(aiSuggestedChanges.copy);
  const aiLayoutSuggestion = recordValue(aiSuggestedChanges.layout);
  const openAIValidation = recordValue(latestOpenAIExecution.validation);
  const openAISanitizedOutput = recordValue(openAIValidation.sanitized_output);
  const openAICopyPreview = recordValue(openAISanitizedOutput.copy);
  const aiApplicationRecord = latestAIApplication.application ?? {};
  const aiApplicationPreview = latestAIApplication.preview ?? {};
  const aiApplicationReview = latestAIApplication.review ?? {};
  const aiDiffSummary = recordValue(aiApplicationPreview.diff_summary);
  const aiDraftSyncState = recordValue(aiApplicationPreview.draft_sync_state);
  const message = params.detail ?? (params.templateApply ? statusMessages[params.templateApply] : "");
  const templateApplyStatus = params.templateApply ?? "";
  const isTemplateApplySuccess =
    templateApplyStatus === "applied" ||
    templateApplyStatus === "theme-applied" ||
    templateApplyStatus === "draft-created" ||
    templateApplyStatus === "sections-replaced";
  const isTemplateApplyError =
    Boolean(templateApplyStatus) &&
    !isTemplateApplySuccess &&
    templateApplyStatus !== "upgrade-required";
  const templateUpgrade = access
    ? getRecommendedUpgrade({
        blockedFeature: "premium_templates",
        currentPlanId: access.plan.id
      })
    : null;

  return (
    <div className="grid gap-8">
      <PageHeader
        description="Choose a ready-made store template, preview the draft schema, and apply it safely to a buyer-owned store draft without publishing."
        title="Template Library"
      />

      {params.templateApply === "upgrade-required" && access ? (
        <UpgradeRequiredCard
          blockedAction="Premium templates access"
          currentPlan={access.plan.name}
          reason={templateUpgrade?.reason ?? params.detail ?? "Premium templates are unavailable on your current plan."}
          recommendedPlan={templateUpgrade?.planName ?? "Starter"}
          recommendedPlanId={templateUpgrade?.planId}
        />
      ) : message ? (
        <div
          className={`rounded-[2rem] border p-4 text-sm font-semibold shadow-[0_18px_60px_-48px_rgba(15,23,42,0.8)] ${
            isTemplateApplySuccess
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : isTemplateApplyError
                ? "border-red-200 bg-red-50 text-red-800"
                : "border-slate-200 bg-white text-muted"
          }`}
          role="status"
        >
          <p className="text-xs font-black uppercase tracking-[0.18em] opacity-80">
            {isTemplateApplySuccess ? "Success" : isTemplateApplyError ? "Action required" : "Notice"}
          </p>
          <p className="mt-2 leading-6">{message}</p>
        </div>
      ) : null}

      <Card className="grid gap-5 p-5">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
            Apply target
          </p>
          <h2 className="mt-2 text-xl font-black tracking-[-0.03em] text-ink">
            Select store targets
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Workspace templates save isolated theme settings on the selected store.
            Claimed-store draft templates remain draft-only until explicitly published.
          </p>
        </div>
        {workspaceStores.length ? (
          <form className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <select
              className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-ink shadow-sm"
              defaultValue={selectedWorkspaceStoreId}
              name="workspaceStoreId"
            >
              {workspaceStores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.store_name ?? store.name ?? store.id}
                  {store.template_id ? ` · ${store.template_id}` : ""}
                </option>
              ))}
            </select>
            {selectedCategory !== "all" ? (
              <input name="category" type="hidden" value={selectedCategory} />
            ) : null}
            {selectedStoreId ? <input name="storeId" type="hidden" value={selectedStoreId} /> : null}
            <Button type="submit" variant="secondary">
              Select workspace store
            </Button>
          </form>
        ) : (
          <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm font-semibold text-muted">
            Create a workspace store before applying isolated templates.
          </p>
        )}
        {stores.length ? (
          <form className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <select
              className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-ink shadow-sm"
              defaultValue={selectedStoreId}
              name="storeId"
            >
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.store_name ?? store.internal_slug ?? store.id}
                </option>
              ))}
            </select>
            {selectedCategory !== "all" ? (
              <input name="category" type="hidden" value={selectedCategory} />
            ) : null}
            {selectedWorkspaceStoreId ? (
              <input name="workspaceStoreId" type="hidden" value={selectedWorkspaceStoreId} />
            ) : null}
            <Button type="submit" variant="secondary">
              Select claimed store
            </Button>
          </form>
        ) : (
          <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm font-semibold text-muted">
            Claim a buyer store before applying templates.
          </p>
        )}
        {activeStore ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
              Applied template state
            </p>
            <p className="mt-2 text-sm font-black text-ink">
              {appliedTemplate
                ? `Draft currently references ${appliedTemplate}.`
                : "No template application recorded in this store draft yet."}
            </p>
          </div>
        ) : null}
        {selectedWorkspaceStoreId ? (
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-500">
              Workspace theme target
            </p>
            <p className="mt-2 text-sm font-black text-ink">
              Template changes will save only to store {selectedWorkspaceStoreId.slice(0, 8)} in the active workspace.
            </p>
          </div>
        ) : null}
      </Card>

      <Card className="grid gap-5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
              AI template customization
            </p>
            <h2 className="mt-2 text-xl font-black tracking-[-0.03em] text-ink">
              Adapt a template to a niche
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              This prepares simulated AI suggestions for branding, copy, layout,
              hero content, and CTA text. It does not call real AI APIs or publish
              the storefront.
            </p>
          </div>
          <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-muted">
            Draft only
          </span>
        </div>
        <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
          <form action={createAITemplateCustomizationAction} className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <input name="storeId" type="hidden" value={selectedStoreId} />
            <div className="grid gap-3 sm:grid-cols-2">
              <select
                className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-ink shadow-sm"
                defaultValue={selectedTemplateId}
                name="templateId"
              >
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
              <Input
                defaultValue={selectedCategory === "all" ? "" : selectedCategory}
                id="aiNiche"
                label="Niche"
                name="niche"
                placeholder="Luxury perfumes, fitness gear..."
              />
            </div>
            <Textarea
              defaultValue=""
              id="aiBusinessDescription"
              label="Business description"
              name="businessDescription"
              placeholder="Describe the brand, offer, location, products, or customer promise."
              rows={4}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <select
                className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-ink shadow-sm"
                defaultValue="general_buyers"
                name="targetAudience"
              >
                <option value="general_buyers">General buyers</option>
                <option value="young_adults">Young adults</option>
                <option value="premium_buyers">Premium buyers</option>
                <option value="local_customers">Local customers</option>
                <option value="families">Families</option>
                <option value="professionals">Professionals</option>
              </select>
              <select
                className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-ink shadow-sm"
                defaultValue="modern"
                name="brandTone"
              >
                <option value="modern">Modern</option>
                <option value="luxury">Luxury</option>
                <option value="playful">Playful</option>
                <option value="minimal">Minimal</option>
                <option value="bold">Bold</option>
                <option value="natural">Natural</option>
              </select>
            </div>
            <Button disabled={!selectedStoreId || !templates.length} type="submit">
              Customize template with AI
            </Button>
          </form>
          <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
              AI suggestions preview
            </p>
            {latestAICustomization ? (
              <>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm font-black text-ink">
                    {textValue(latestAICustomization, "customization_status", "prepared").replace(/_/g, " ")}
                  </p>
                  <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-muted">
                    {textValue(latestAICustomization, "created_at", "Not created")}
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {[
                    ["Primary", textValue(aiBrandingSuggestion, "primaryColor", "#0f172a")],
                    ["Secondary", textValue(aiBrandingSuggestion, "secondaryColor", "#2563eb")],
                    ["Accent", textValue(aiBrandingSuggestion, "accentColor", "#f59e0b")]
                  ].map(([label, color]) => (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3" key={label}>
                      <p className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-slate-400">
                        {label}
                      </p>
                      <div
                        className="mt-2 h-8 rounded-xl border border-slate-200"
                        style={{ backgroundColor: color }}
                      />
                    </div>
                  ))}
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                    Hero and CTA copy
                  </p>
                  <p className="mt-2 text-sm font-black text-ink">
                    {textValue(aiCopySuggestion, "heroTitle", "Hero suggestion pending")}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-muted">
                    {textValue(aiCopySuggestion, "heroSubtitle", "Subtitle suggestion pending")}
                  </p>
                  <p className="mt-2 text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                    CTA: {textValue(aiCopySuggestion, "ctaText", "Start Shopping")}
                  </p>
                </div>
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-3 text-sm font-semibold text-muted">
                  Layout focus: {textValue(aiLayoutSuggestion, "suggestedSectionFocus", "hero")}
                </div>
                <form action={applyAITemplateSuggestionsToDraftAction}>
                  <input name="storeId" type="hidden" value={selectedStoreId} />
                  <input name="templateId" type="hidden" value={selectedTemplateId} />
                  <Button className="w-full" disabled={!selectedStoreId} type="submit" variant="secondary">
                    Apply AI suggestions to draft
                  </Button>
                </form>
                <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-3">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                    Controlled OpenAI execution
                  </p>
                  <p className="text-sm leading-6 text-muted">
                    Executes only safe customization prompts when `OPENAI_API_KEY`
                    exists. Output is validated and sanitized before any draft-only
                    apply action is available.
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <form action={executeControlledOpenAIAction}>
                      <input name="storeId" type="hidden" value={selectedStoreId} />
                      <input name="templateId" type="hidden" value={selectedTemplateId} />
                      <Button className="w-full" disabled={!selectedStoreId} type="submit">
                        Execute controlled AI
                      </Button>
                    </form>
                    <form action={applyControlledOpenAIToDraftAction}>
                      <input name="storeId" type="hidden" value={selectedStoreId} />
                      <input name="templateId" type="hidden" value={selectedTemplateId} />
                      <Button className="w-full" disabled={!openAIValidation.validation_status} type="submit" variant="secondary">
                        Apply OpenAI output to draft
                      </Button>
                    </form>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {[
                      ["Execution", textValue(latestOpenAIExecution.log ?? {}, "execution_status", "Not executed")],
                      ["Validation", textValue(openAIValidation, "validation_status", "Pending")],
                      ["Attempts", String(latestOpenAIExecution.attempts.length)],
                      ["Retry", "Prepared"]
                    ].map(([label, value]) => (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3" key={label}>
                        <p className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-slate-400">
                          {label}
                        </p>
                        <p className="mt-1 truncate text-xs font-black capitalize text-ink">{value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-3">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                      AI response preview
                    </p>
                    <p className="mt-2 text-sm font-black text-ink">
                      {textValue(openAICopyPreview, "heroTitle", "Validated OpenAI hero copy will appear here.")}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-muted">
                      {textValue(openAICopyPreview, "heroSubtitle", "Sanitized subtitle preview pending.")}
                    </p>
                  </div>
                  <div className="grid gap-2">
                    {latestOpenAIExecution.attempts.length ? (
                      latestOpenAIExecution.attempts.map((attempt) => (
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3" key={String(attempt.id)}>
                          <p className="text-sm font-black capitalize text-ink">
                            Attempt {textValue(attempt, "attempt_number", "1")} · {textValue(attempt, "attempt_status", "prepared")}
                          </p>
                          <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-muted">
                            {textValue(attempt, "model_key", "gpt-4o-mini")}
                          </p>
                          {textValue(attempt, "error_message", "") ? (
                            <p className="mt-2 text-sm font-semibold text-red-700">
                              {textValue(attempt, "error_message", "")}
                            </p>
                          ) : null}
                        </div>
                      ))
                    ) : (
                      <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-3 text-sm font-semibold text-muted">
                        Execution logs and retry attempts will appear here after controlled execution.
                      </p>
                    )}
                  </div>
                </div>
                <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-3">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                    AI draft application review
                  </p>
                  <p className="text-sm leading-6 text-muted">
                    Preview AI patches, apply safe changes to draft, reject a suggestion,
                    or roll back the latest AI draft application snapshot. Published
                    storefronts stay untouched.
                  </p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <form action={previewAIChangesAction}>
                      <input name="storeId" type="hidden" value={selectedStoreId} />
                      <input name="templateId" type="hidden" value={selectedTemplateId} />
                      <Button className="w-full" disabled={!selectedStoreId} type="submit" variant="secondary">
                        Preview AI diff
                      </Button>
                    </form>
                    <form action={applyAISuggestionToDraftAction}>
                      <input name="storeId" type="hidden" value={selectedStoreId} />
                      <input name="templateId" type="hidden" value={selectedTemplateId} />
                      <Button className="w-full" disabled={!selectedStoreId} type="submit">
                        Apply safe patch
                      </Button>
                    </form>
                    <form action={rejectAISuggestionAction}>
                      <input name="storeId" type="hidden" value={selectedStoreId} />
                      <input name="templateId" type="hidden" value={selectedTemplateId} />
                      <input name="reason" type="hidden" value="Rejected from template AI review panel." />
                      <Button className="w-full" disabled={!selectedStoreId} type="submit" variant="secondary">
                        Reject suggestion
                      </Button>
                    </form>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {[
                      ["Application", textValue(aiApplicationRecord, "application_status", "No preview")],
                      ["Review", textValue(aiApplicationReview, "review_status", "Pending")],
                      ["Draft sync", textValue(aiDraftSyncState, "syncedAt", "Not synced")],
                      ["Copy diff", String(aiDiffSummary.copyChanged === true ? "Changed" : "Pending")]
                    ].map(([label, value]) => (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3" key={label}>
                        <p className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-slate-400">
                          {label}
                        </p>
                        <p className="mt-1 truncate text-xs font-black capitalize text-ink">{value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-3">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                      AI diff preview placeholder
                    </p>
                    <p className="mt-2 text-sm font-semibold text-muted">
                      Sections: {String(aiDiffSummary.beforeSections ?? 0)} · Delta:{" "}
                      {String(aiDiffSummary.sectionCountChanged ?? 0)} · Layout recommendations:{" "}
                      {String(aiDiffSummary.layoutRecommendationsReady === true ? "Ready" : "Pending")}
                    </p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {[
                      "Partial apply placeholder",
                      "AI draft sync placeholder",
                      "AI visual editing prep",
                      "Conversational editing prep"
                    ].map((label) => (
                      <div
                        className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-3 text-center text-xs font-black uppercase tracking-[0.16em] text-muted"
                        key={label}
                      >
                        {label}
                      </div>
                    ))}
                  </div>
                  {textValue(aiApplicationRecord, "id", "") ? (
                    <form action={rollbackAIApplicationAction}>
                      <input name="storeId" type="hidden" value={selectedStoreId} />
                      <input name="templateId" type="hidden" value={selectedTemplateId} />
                      <input name="applicationId" type="hidden" value={textValue(aiApplicationRecord, "id", "")} />
                      <Button className="w-full" type="submit" variant="secondary">
                        Roll back AI draft application
                      </Button>
                    </form>
                  ) : null}
                </div>
              </>
            ) : (
              <div className="grid gap-2">
                <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-3 text-sm font-semibold text-muted">
                  AI suggestions will appear here after you prepare a customization request.
                </p>
                {[
                  "AI copywriting prep",
                  "AI branding generation prep",
                  "AI layout optimization prep",
                  "Conversion optimization prep",
                  "Multilingual storefront prep"
                ].map((label) => (
                  <div
                    className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-3 text-center text-xs font-black uppercase tracking-[0.16em] text-muted"
                    key={label}
                  >
                    {label}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>

      <div className="grid gap-3 rounded-[2rem] border border-slate-200/80 bg-white/75 p-5 shadow-[0_18px_60px_-48px_rgba(15,23,42,0.8)] backdrop-blur">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
          Category filters
        </p>
        <div className="flex flex-wrap gap-2">
          <a
            className={`rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${
              selectedCategory === "all"
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-600"
            }`}
            href={`/dashboard/templates?${new URLSearchParams({
              ...(selectedStoreId ? { storeId: selectedStoreId } : {}),
              ...(selectedWorkspaceStoreId ? { workspaceStoreId: selectedWorkspaceStoreId } : {})
            }).toString()}`}
          >
            All
          </a>
          {library.categories.map((category) => (
            <a
              className={`rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${
                selectedCategory === category.category_key
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-600"
              }`}
              href={`/dashboard/templates?${new URLSearchParams({
                category: category.category_key,
                ...(selectedStoreId ? { storeId: selectedStoreId } : {}),
                ...(selectedWorkspaceStoreId ? { workspaceStoreId: selectedWorkspaceStoreId } : {})
              }).toString()}`}
              key={category.category_key}
            >
              {category.name}
            </a>
          ))}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {templates.map((template) => {
          const draft = validateTemplateSchema(template.layout_schema).schema;
          const isApplied = appliedTemplate === template.id;
          const summary = templatePreviewSummary(template);

          return (
            <Card className="overflow-hidden p-0" key={template.id}>
              <div className="p-4">
                <div
                  className="min-h-48 rounded-[1.75rem] p-4 text-white shadow-inner"
                  style={{
                    background:
                      template.preview_image
                        ? `linear-gradient(135deg,rgba(15,23,42,.55),rgba(15,23,42,.1)),url(${template.preview_image}) center/cover` :
                      template.preview_gradient ??
                      "linear-gradient(135deg,#f8fafc,#2563eb 52%,#020617)"
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] backdrop-blur">
                      {template.category}
                    </span>
                    <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-slate-900">
                      {template.template_type}
                    </span>
                  </div>
                  <div className="mt-12 max-w-sm">
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-white/70">
                      Preview before apply
                    </p>
                    <h3 className="mt-2 text-2xl font-black tracking-[-0.04em]">
                      {template.name}
                    </h3>
                  </div>
                </div>
              </div>
              <div className="grid gap-5 p-5 pt-1">
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-xl font-black tracking-[-0.03em] text-ink">
                      {template.name}
                    </h2>
                    {isApplied ? (
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
                        Applied draft
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    {template.preview_summary ?? template.description}
                  </p>
                  {templateBadges(template).length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {templateBadges(template).map((badge) => (
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-[0.65rem] font-black uppercase tracking-[0.14em] text-slate-700" key={badge}>
                          {badge}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                      Demo products
                    </p>
                    <p className="mt-1 text-lg font-black text-ink">
                      {summary.productCount || "Pending"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                      Demo categories
                    </p>
                    <p className="mt-1 text-lg font-black text-ink">
                      {summary.categoryCount || "Pending"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                      Package
                    </p>
                    <p className="mt-1 text-lg font-black text-ink">
                      {summary.hasPackage ? `v${summary.packageVersion}` : "Template only"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                      AI visuals
                    </p>
                    <p className="mt-1 text-lg font-black text-ink">
                      {summary.hasAIVisualSupport ? `${summary.aiVisualSlotCount} slots` : "Pending"}
                    </p>
                  </div>
                </div>
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
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                    Store theme preview
                  </p>
                  <p className="mt-2 text-sm font-semibold text-muted">
                    Applies {draft.sections.length} editable section
                    {draft.sections.length === 1 ? "" : "s"}, isolated theme settings, color presets,
                    and future-ready AI/multilingual template metadata.
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <a
                    className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 bg-white px-5 text-sm font-bold text-ink transition hover:border-slate-300 hover:bg-slate-50"
                    href={`/dashboard/templates/preview/${encodeURIComponent(template.id)}`}
                  >
                    Preview template
                  </a>
                  <a
                    className="inline-flex h-11 items-center justify-center rounded-full bg-ink px-5 text-sm font-bold text-white transition hover:bg-slate-800"
                    href={`/dashboard/stores/new?templateId=${encodeURIComponent(template.id)}#apply-template-create-store`}
                  >
                    Select template
                  </a>
                </div>
                <form action={applyWorkspaceStoreTemplate} className="grid gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-3">
                  <input name="storeId" type="hidden" value={selectedWorkspaceStoreId} />
                  <input name="templateId" type="hidden" value={template.id} />
                  <Button disabled={!selectedWorkspaceStoreId} type="submit">
                    Apply template to workspace store
                  </Button>
                  <p className="text-xs font-semibold leading-5 text-blue-800">
                    Saves template, theme color, font style, layout style, and JSON settings only for the selected store.
                  </p>
                </form>
                <details className="rounded-2xl border border-slate-200 bg-white p-3">
                  <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.16em] text-ink">
                    Confirm apply template
                  </summary>
                  <div className="mt-3 grid gap-3">
                    <p className="text-sm leading-6 text-muted">
                      This replaces the selected store draft sections and draft theme
                      settings. It does not publish the storefront or overwrite the
                      active published layout.
                    </p>
                    <form action={applyTemplateToStore}>
                      <input name="storeId" type="hidden" value={selectedStoreId} />
                      <input name="templateId" type="hidden" value={template.id} />
                      <Button disabled={!selectedStoreId} type="submit">
                        Apply template to draft
                      </Button>
                    </form>
                  </div>
                </details>
                <div className="grid gap-2 sm:grid-cols-2">
                  {["AI customize template", "Ready preview"].map((label) => (
                    <div
                      className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-3 text-center text-xs font-black uppercase tracking-[0.16em] text-muted"
                      key={label}
                    >
                      {label}
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
