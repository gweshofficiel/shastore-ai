"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createAIExecutionLog,
  mapOpenAIResponseToDraft,
  retryOpenAIExecution,
  sanitizeAIOutput,
  validateOpenAIJSON
} from "@/lib/openai-execution";
import { getUserSubscriptionAccess } from "@/lib/billing/access";
import {
  assertFeatureAccess,
  billingEnforcementMessage
} from "@/lib/billing/enforcement";
import { normalizeBuilderPageSchema } from "@/lib/storefront/builder";
import { getTemplateLibrary, mapTemplateToBuilderDraft } from "@/lib/storefront/template-library";
import { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

type ClaimedStoreRow = {
  access_role?: string | null;
  id: string;
};

const templatePagePath = "/dashboard/templates";

function cleanText(value: FormDataEntryValue | null, maxLength = 240) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : "";
}

function executionRedirect(status: string, storeId?: string, templateId?: string, detail?: string): never {
  const params = new URLSearchParams({ templateApply: status });

  if (storeId) {
    params.set("storeId", storeId);
  }

  if (templateId) {
    params.set("templateId", templateId);
  }

  if (detail) {
    params.set("detail", detail);
  }

  redirect(`${templatePagePath}?${params.toString()}`);
}

async function getClaimedStore(supabase: SupabaseClient, storeId: string) {
  const { data, error } = await supabase.rpc(
    "get_claimed_store_instances_for_current_user" as never
  );

  if (error || !Array.isArray(data)) {
    return null;
  }

  return (
    (data as ClaimedStoreRow[]).find(
      (store) =>
        store.id === storeId &&
        (!store.access_role || store.access_role === "owner" || store.access_role === "admin")
    ) ?? null
  );
}

async function requireExecutionContext(formData: FormData) {
  const storeId = cleanText(formData.get("storeId"), 80);
  const templateId = cleanText(formData.get("templateId"), 120);

  if (!storeId || !templateId) {
    executionRedirect("openai-execution-missing", storeId, templateId);
  }

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(templatePagePath)}`);
  }

  const claimedStore = await getClaimedStore(supabase, storeId);

  if (!claimedStore) {
    executionRedirect("not-authorized", storeId, templateId);
  }

  const library = await getTemplateLibrary();
  const template = library.templates.find((candidate) => candidate.id === templateId);

  if (!template) {
    executionRedirect("template-missing", storeId, templateId);
  }

  const access = await getUserSubscriptionAccess(user.id);

  try {
    assertFeatureAccess(access, "premium_templates", { templateId });
  } catch (error) {
    executionRedirect(
      "upgrade-required",
      storeId,
      templateId,
      billingEnforcementMessage(error) ?? undefined
    );
  }

  return { storeId, supabase, template, templateId, userId: user.id };
}

async function getBuilderDraft(supabase: SupabaseClient, storeId: string) {
  const { data: pageData } = await supabase
    .from("builder_pages" as never)
    .select("id")
    .eq("store_instance_id", storeId)
    .eq("page_key", "home")
    .maybeSingle();
  const page = pageData as { id?: string } | null;

  if (!page?.id) {
    return { draft: null, page: null };
  }

  const { data: draftData } = await supabase
    .from("builder_drafts" as never)
    .select("id, draft_schema")
    .eq("builder_page_id", page.id)
    .maybeSingle();

  return {
    draft: draftData as { draft_schema?: unknown; id?: string } | null,
    page
  };
}

async function latestCustomization(supabase: SupabaseClient, storeId: string, templateId: string) {
  const { data } = await supabase
    .from("ai_template_customizations" as never)
    .select("id, prompt_preview, suggested_changes")
    .eq("store_instance_id", storeId)
    .eq("template_id", templateId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data as { id?: string; prompt_preview?: string; suggested_changes?: unknown } | null;
}

async function latestProviderConfig(supabase: SupabaseClient, storeId: string) {
  const { data: providerData } = await supabase
    .from("ai_providers" as never)
    .select("id, provider_status")
    .eq("store_instance_id", storeId)
    .eq("provider_key", "openai")
    .maybeSingle();
  const provider = providerData as { id?: string; provider_status?: string } | null;
  const { data: configData } = provider?.id
    ? await supabase
        .from("ai_provider_configs" as never)
        .select("id, model_key")
        .eq("provider_id", provider.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };
  const config = configData as { id?: string; model_key?: string } | null;

  return {
    configId: config?.id ?? null,
    modelKey: config?.model_key ?? "gpt-4o-mini",
    providerId: provider?.id ?? null
  };
}

export async function executeControlledOpenAIAction(formData: FormData) {
  const { storeId, supabase, template, templateId, userId } =
    await requireExecutionContext(formData);
  const customization = await latestCustomization(supabase, storeId, templateId);

  if (!customization?.id) {
    executionRedirect("openai-execution-needs-customization", storeId, templateId);
  }

  const provider = await latestProviderConfig(supabase, storeId);
  const prompt = [
    customization.prompt_preview || `Customize template ${template.name}.`,
    "Controlled execution scope: branding suggestions, color palette, hero copy, CTA copy, section copy, niche adaptation, layout recommendations only.",
    "Do not include publishing, database mutation, theme overwrite, section deletion, unsafe schema, checkout, payment, credentials, or external actions."
  ].join("\n");
  const logPayload = createAIExecutionLog({ prompt, status: "running" });
  const { data: logData, error: logError } = await supabase
    .from("ai_execution_logs" as never)
    .insert({
      blocked_actions: logPayload.blockedActions,
      customization_id: customization.id,
      execution_scope: "template_customization",
      execution_status: "running",
      metadata: {
        controlledMode: true,
        directDraftMutation: false
      },
      owner_user_id: userId,
      prompt_preview: logPayload.promptPreview,
      provider_id: provider.providerId,
      safe_actions: logPayload.safeActions,
      store_instance_id: storeId
    } as never)
    .select("id")
    .single();

  if (logError || !logData) {
    executionRedirect("openai-execution-log-failed", storeId, templateId);
  }

  const executionLogId = (logData as { id: string }).id;
  const startedAt = new Date().toISOString();
  const result = await retryOpenAIExecution({ model: provider.modelKey, prompt, timeoutMs: 20000 }, 2);
  const sanitized = sanitizeAIOutput(result.rawOutput);
  const validation = validateOpenAIJSON(result.rawOutput);
  const attemptStatus = result.status === "blocked" ? "blocked" : result.status;
  const { data: attemptData } = await supabase
    .from("ai_execution_attempts" as never)
    .insert({
      attempt_number: result.attempts,
      attempt_status: attemptStatus,
      error_message: result.error,
      execution_log_id: executionLogId,
      finished_at: new Date().toISOString(),
      model_key: provider.modelKey,
      owner_user_id: userId,
      provider_config_id: provider.configId,
      provider_id: provider.providerId,
      request_payload: { prompt },
      response_payload: result.rawOutput,
      retry_state: {
        attempts: result.attempts,
        canRetry: result.status === "failed",
        nextDelaySeconds: 30
      },
      sanitized_payload: sanitized,
      started_at: startedAt,
      store_instance_id: storeId,
      token_usage: result.tokenUsage
    } as never)
    .select("id")
    .single();
  const attemptId = (attemptData as { id?: string } | null)?.id ?? null;
  const sourceSchema = mapTemplateToBuilderDraft(template);
  const mappedDraftPreview = mapOpenAIResponseToDraft(sourceSchema, result.rawOutput);

  await supabase.from("ai_response_validations" as never).insert({
    allowed_fields: ["branding", "copy", "layout", "sectionCopy"],
    blocked_fields: validation.blockedFields,
    execution_attempt_id: attemptId,
    execution_log_id: executionLogId,
    mapped_draft_preview: mappedDraftPreview,
    metadata: {
      draftOnly: true,
      directPublishAllowed: false
    },
    owner_user_id: userId,
    sanitized_output: sanitized,
    store_instance_id: storeId,
    validation_errors: validation.errors,
    validation_status: validation.valid ? "valid" : validation.errors.length ? "invalid" : "sanitized"
  } as never);

  await supabase
    .from("ai_execution_logs" as never)
    .update({
      execution_status:
        result.status === "succeeded" && validation.valid
          ? "succeeded"
          : result.status === "blocked"
            ? "blocked"
            : "failed"
    } as never)
    .eq("id", executionLogId)
    .eq("store_instance_id", storeId);

  await supabase
    .from("ai_template_customizations" as never)
    .update({
      customization_status: result.status === "succeeded" && validation.valid ? "previewed" : "prepared",
      suggested_changes: result.status === "succeeded" && validation.valid ? sanitized : customization.suggested_changes
    } as never)
    .eq("id", customization.id)
    .eq("store_instance_id", storeId);

  revalidatePath(templatePagePath);

  if (result.status === "blocked") {
    executionRedirect("openai-execution-missing-key", storeId, templateId);
  }

  if (result.status === "failed" || !validation.valid) {
    executionRedirect("openai-execution-failed", storeId, templateId);
  }

  executionRedirect("openai-execution-complete", storeId, templateId);
}

export async function applyControlledOpenAIToDraftAction(formData: FormData) {
  const { storeId, supabase, template, templateId, userId } =
    await requireExecutionContext(formData);
  const customization = await latestCustomization(supabase, storeId, templateId);

  if (!customization?.id || !customization.suggested_changes) {
    executionRedirect("openai-execution-no-output", storeId, templateId);
  }

  const validation = validateOpenAIJSON(customization.suggested_changes);

  if (!validation.valid) {
    executionRedirect("openai-execution-invalid-output", storeId, templateId);
  }

  const { draft, page } = await getBuilderDraft(supabase, storeId);

  if (!page?.id) {
    executionRedirect("openai-execution-draft-missing", storeId, templateId);
  }

  const sourceSchema = draft?.draft_schema
    ? normalizeBuilderPageSchema(draft.draft_schema)
    : mapTemplateToBuilderDraft(template);
  const mappedDraft = mapOpenAIResponseToDraft(sourceSchema, customization.suggested_changes);
  const { error } = await supabase.from("builder_drafts" as never).upsert(
    {
      builder_page_id: page.id,
      draft_schema: mappedDraft,
      editor_state: {
        appliedControlledOpenAIExecution: true,
        appliedCustomizationId: customization.id,
        mode: "desktop",
        previewSyncPending: true,
        source: "controlled_openai_execution",
        templateId
      },
      has_unsaved_changes: true,
      layout_tree: mappedDraft.layoutTree,
      owner_user_id: userId,
      responsive_config: mappedDraft.responsive,
      store_instance_id: storeId
    } as never,
    { onConflict: "builder_page_id" }
  );

  if (error) {
    executionRedirect("openai-execution-apply-failed", storeId, templateId);
  }

  revalidatePath(templatePagePath);
  revalidatePath(`/dashboard/stores/${storeId}`);
  executionRedirect("openai-execution-applied", storeId, templateId);
}
