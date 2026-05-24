"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createAITemplateCustomization,
  mapAIChangesToBuilderDraft,
  prepareTemplateCustomizationPrompt,
  previewAIThemeChanges,
  validateCustomizationInput
} from "@/lib/ai-template-customization";
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

function customizationRedirect(status: string, storeId?: string, templateId?: string, detail?: string): never {
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

async function requireCustomizationContext(formData: FormData) {
  const storeId = cleanText(formData.get("storeId"), 80);
  const templateId = cleanText(formData.get("templateId"), 120);

  if (!storeId || !templateId) {
    customizationRedirect("ai-customization-missing", storeId, templateId);
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
    customizationRedirect("not-authorized", storeId, templateId);
  }

  const library = await getTemplateLibrary();
  const template = library.templates.find((candidate) => candidate.id === templateId);

  if (!template) {
    customizationRedirect("template-missing", storeId, templateId);
  }

  const access = await getUserSubscriptionAccess(user.id);

  try {
    assertFeatureAccess(access, "premium_templates", { templateId });
  } catch (error) {
    customizationRedirect(
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
    .select("id, draft_schema, editor_state")
    .eq("builder_page_id", page.id)
    .maybeSingle();

  return {
    draft: draftData as { draft_schema?: unknown; editor_state?: unknown; id?: string } | null,
    page
  };
}

export async function createAITemplateCustomizationAction(formData: FormData) {
  const { storeId, supabase, template, templateId, userId } =
    await requireCustomizationContext(formData);
  const rawInput = {
    brandTone: cleanText(formData.get("brandTone"), 80),
    businessDescription: cleanText(formData.get("businessDescription"), 500),
    niche: cleanText(formData.get("niche"), 120),
    targetAudience: cleanText(formData.get("targetAudience"), 80)
  };
  const validation = validateCustomizationInput(rawInput);

  if (validation.errors.length) {
    customizationRedirect("ai-customization-invalid", storeId, templateId);
  }

  const request = createAITemplateCustomization(templateId, validation.input);
  const suggestion = previewAIThemeChanges(request, template);
  const prompt = prepareTemplateCustomizationPrompt(request, template);
  const { data: profileData, error: profileError } = await supabase
    .from("ai_branding_profiles" as never)
    .insert({
      brand_tone: request.brandTone,
      branding_tokens: suggestion.branding,
      business_description: request.businessDescription,
      metadata: {
        future: ["ai_branding_generation", "ai_color_palette_generation", "multilingual_ai_storefronts"],
        source: "template_customization_foundation"
      },
      niche: request.niche,
      owner_user_id: userId,
      profile_status: "ready",
      store_instance_id: storeId,
      target_audience: request.targetAudience,
      template_id: templateId
    } as never)
    .select("id")
    .single();

  if (profileError || !profileData) {
    customizationRedirect("ai-customization-failed", storeId, templateId);
  }

  const { draft, page } = await getBuilderDraft(supabase, storeId);
  const { data: customizationData, error: customizationError } = await supabase
    .from("ai_template_customizations" as never)
    .insert({
      branding_profile_id: (profileData as { id: string }).id,
      builder_draft_id: draft?.id ?? null,
      builder_page_id: page?.id ?? null,
      customization_status: "prepared",
      input_payload: request,
      metadata: {
        realAiCallsEnabled: false,
        source: "simulated_template_customization"
      },
      owner_user_id: userId,
      prompt_preview: prompt,
      store_instance_id: storeId,
      suggested_changes: suggestion,
      template_id: templateId
    } as never)
    .select("id")
    .single();

  if (customizationError || !customizationData) {
    customizationRedirect("ai-customization-failed", storeId, templateId);
  }

  const customizationId = (customizationData as { id: string }).id;

  await Promise.all([
    supabase.from("ai_layout_suggestions" as never).insert({
      conversion_notes: suggestion.layout,
      customization_id: customizationId,
      layout_suggestion: {
        focus: suggestion.layout.suggestedSectionFocus,
        notes: suggestion.layout.improvementNotes
      },
      metadata: {
        source: "simulated_layout_suggestion"
      },
      owner_user_id: userId,
      section_suggestions: template.layout_schema.sections.map((section) => ({
        id: section.id,
        type: section.type,
        update: section.type === "hero" ? "customize hero copy and CTA" : "preserve section"
      })),
      store_instance_id: storeId,
      template_id: templateId
    } as never),
    supabase.from("ai_copy_suggestions" as never).insert({
      cta_copy: {
        primary: suggestion.copy.ctaText
      },
      customization_id: customizationId,
      hero_copy: {
        subtitle: suggestion.copy.heroSubtitle,
        title: suggestion.copy.heroTitle
      },
      metadata: {
        source: "simulated_copy_suggestion"
      },
      multilingual_notes: {
        futureReady: true
      },
      owner_user_id: userId,
      section_copy: [],
      store_instance_id: storeId,
      template_id: templateId
    } as never)
  ]);

  revalidatePath(templatePagePath);
  customizationRedirect("ai-customization-created", storeId, templateId);
}

export async function applyAITemplateSuggestionsToDraftAction(formData: FormData) {
  const { storeId, supabase, template, templateId, userId } =
    await requireCustomizationContext(formData);
  const { data: customizationData } = await supabase
    .from("ai_template_customizations" as never)
    .select("id, suggested_changes")
    .eq("store_instance_id", storeId)
    .eq("template_id", templateId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const customization = customizationData as { id?: string; suggested_changes?: unknown } | null;

  if (!customization?.id || !customization.suggested_changes) {
    customizationRedirect("ai-customization-missing-suggestions", storeId, templateId);
  }

  const { page, draft } = await getBuilderDraft(supabase, storeId);
  const sourceSchema = draft?.draft_schema
    ? normalizeBuilderPageSchema(draft.draft_schema)
    : mapTemplateToBuilderDraft(template);
  const mappedDraft = mapAIChangesToBuilderDraft(sourceSchema, customization.suggested_changes as never);

  if (!page?.id) {
    customizationRedirect("ai-customization-draft-missing", storeId, templateId);
  }

  const { error } = await supabase
    .from("builder_drafts" as never)
    .upsert(
      {
        builder_page_id: page.id,
        draft_schema: mappedDraft,
        editor_state: {
          appliedAICustomizationId: customization.id,
          mode: "desktop",
          previewSyncPending: true,
          selectedSectionId: null,
          source: "ai_template_customization",
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
    customizationRedirect("ai-customization-apply-failed", storeId, templateId);
  }

  await supabase
    .from("ai_template_customizations" as never)
    .update({
      applied_at: new Date().toISOString(),
      customization_status: "applied"
    } as never)
    .eq("id", customization.id)
    .eq("store_instance_id", storeId);

  revalidatePath(templatePagePath);
  revalidatePath(`/dashboard/stores/${storeId}`);
  customizationRedirect("ai-customization-applied", storeId, templateId);
}
