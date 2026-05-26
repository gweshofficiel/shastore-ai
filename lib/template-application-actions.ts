"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PostgrestError } from "@supabase/supabase-js";
import { getUserSubscriptionAccess } from "@/lib/billing/access";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  assertFeatureAccess,
  billingEnforcementMessage
} from "@/lib/billing/enforcement";
import { createClient } from "@/lib/supabase/server";
import {
  getTemplateLibrary,
  getProductionStoreTemplate,
  mapTemplateToBuilderDraft,
  validateTemplateSchema,
  type StoreTemplateRecord
} from "@/lib/storefront/template-library";
import type { BuilderPageSchema } from "@/lib/storefront/builder";
import {
  assertStoreAccessInWorkspace,
  getWorkspaceDataContext
} from "@/lib/workspaces/data-access";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

type ClaimedStoreRow = {
  access_role?: string | null;
  id: string;
  internal_slug?: string | null;
  store_name?: string | null;
};

type TemplateApplicationSnapshot = {
  branding: Record<string, unknown> | null;
  draft: Record<string, unknown> | null;
  page: Record<string, unknown> | null;
  sections: Record<string, unknown>[];
  theme: Record<string, unknown> | null;
};

const templatePagePath = "/dashboard/templates";
const allowedBorderRadius = new Set(["0.75rem", "1rem", "1.5rem", "2rem", "2.5rem"]);
const allowedSpacing = new Set(["compact", "comfortable", "spacious"]);

function cleanText(value: FormDataEntryValue | null, maxLength = 200) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : "";
}

function applicationRedirect(
  status: string,
  storeId?: string,
  templateId?: string,
  options?: { detail?: string; workspaceStoreId?: string }
): never {
  const params = new URLSearchParams({ templateApply: status });

  if (storeId) {
    params.set("storeId", storeId);
  }

  if (templateId) {
    params.set("templateId", templateId);
  }

  if (options?.workspaceStoreId) {
    params.set("workspaceStoreId", options.workspaceStoreId);
  }

  if (options?.detail) {
    params.set("detail", options.detail);
  }

  redirect(`${templatePagePath}?${params.toString()}`);
}

function isMissingSchemaColumn(error: PostgrestError | null) {
  const message = (error?.message ?? "").toLowerCase();
  return (
    error?.code === "PGRST204" ||
    message.includes("could not find") ||
    message.includes("schema cache") ||
    message.includes("column")
  );
}

async function resolvePersistedTemplateId(
  supabase: SupabaseClient,
  requestedTemplateId: string
) {
  const template = await getProductionStoreTemplate(requestedTemplateId || "general-starter");
  const candidates = Array.from(
    new Set([requestedTemplateId, template.id, template.slug, template.template_slug].filter(Boolean))
  );

  for (const candidate of candidates) {
    const { data } = await supabase
      .from("store_templates" as never)
      .select("id")
      .eq("id", candidate)
      .maybeSingle();

    if (data && typeof (data as { id?: unknown }).id === "string") {
      return {
        persistedTemplateId: (data as { id: string }).id,
        template: await getProductionStoreTemplate((data as { id: string }).id)
      };
    }
  }

  const { data: fallbackRow } = await supabase
    .from("store_templates" as never)
    .select("id")
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (fallbackRow && typeof (fallbackRow as { id?: unknown }).id === "string") {
    const persistedTemplateId = (fallbackRow as { id: string }).id;
    return {
      persistedTemplateId,
      template: await getProductionStoreTemplate(persistedTemplateId)
    };
  }

  return null;
}

async function upsertWorkspaceStoreThemeSettings({
  payload,
  storeId,
  supabase,
  templateId,
  userId,
  workspaceId
}: {
  payload: Record<string, unknown>;
  storeId: string;
  supabase: SupabaseClient;
  templateId: string;
  userId: string;
  workspaceId: string;
}) {
  const fullPayload = {
    ...payload,
    workspace_id: workspaceId
  };
  let result = await supabase
    .from("store_theme_settings" as never)
    .upsert(fullPayload as never, { onConflict: "store_id" });

  if (!result.error) {
    return { error: null, usedFallback: false };
  }

  console.warn("[template-application] theme upsert via user client failed", {
    code: result.error.code,
    message: result.error.message,
    storeId,
    templateId,
    userId,
    workspaceId
  });

  const admin = createAdminClient();

  if (!admin) {
    return { error: result.error, usedFallback: false };
  }

  result = await admin
    .from("store_theme_settings" as never)
    .upsert(fullPayload as never, { onConflict: "store_id" });

  if (!result.error) {
    return { error: null, usedFallback: true };
  }

  if (!isMissingSchemaColumn(result.error)) {
    console.warn("[template-application] theme upsert via admin failed", {
      code: result.error.code,
      message: result.error.message,
      storeId,
      templateId
    });
    return { error: result.error, usedFallback: true };
  }

  const minimalPayload = {
    brand_color: payload.brand_color,
    settings: payload.settings,
    store_id: storeId,
    template_id: payload.template_id,
    updated_at: payload.updated_at,
    user_id: userId,
    workspace_id: workspaceId
  };
  result = await admin
    .from("store_theme_settings" as never)
    .upsert(minimalPayload as never, { onConflict: "store_id" });

  return {
    error: result.error,
    usedFallback: true
  };
}

function colorValue(value: unknown, fallback: string) {
  return typeof value === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)
    ? value
    : fallback;
}

function textValue(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function workspaceTemplateSettings(template: StoreTemplateRecord) {
  return {
    ...template.default_theme_settings,
    ...template.theme_config,
    source: "workspace_template_application",
    templateCategory: template.category,
    templateId: template.id,
    templateType: template.template_type
  };
}

function workspaceThemeValues(template: StoreTemplateRecord) {
  const settings = workspaceTemplateSettings(template) as Record<string, unknown>;

  return {
    fontStyle: textValue(settings.fontStyle, textValue(settings.font_style, "modern")),
    layoutStyle: textValue(settings.layoutStyle, textValue(settings.layout_style, "classic")),
    themeColor: colorValue(
      settings.themeColor,
      colorValue(settings.theme_color, colorValue(template.branding_config.primaryColor, "#0f172a"))
    )
  };
}

function normalizeThemePayload(template: StoreTemplateRecord, userId: string, storeId: string) {
  const theme = template.theme_config;
  const branding = template.branding_config;
  const borderRadius = textValue(theme.border_radius, "2rem");
  const spacing = textValue(theme.spacing, "comfortable");

  return {
    border_radius: allowedBorderRadius.has(borderRadius) ? borderRadius : "2rem",
    color_palette: {
      accent: colorValue(branding.accentColor, "#f59e0b"),
      background: "#f8fafc",
      muted: "#64748b",
      primary: colorValue(branding.primaryColor, "#0f172a"),
      secondary: colorValue(branding.secondaryColor, "#2563eb"),
      surface: "#ffffff",
      text: "#0f172a"
    },
    is_active: true,
    layout_key: textValue(theme.layout_key, "classic"),
    logo_config: {
      alt: `${template.name} logo placeholder`,
      mode: "text",
      url: null
    },
    owner_user_id: userId,
    spacing: allowedSpacing.has(spacing) ? spacing : "comfortable",
    store_instance_id: storeId,
    style_config: {
      ...theme,
      source: "template_application",
      templateId: template.id
    },
    theme_id: `template-${template.template_slug}`,
    theme_key: textValue(theme.theme_key, "modern"),
    typography: {
      body: "inter",
      heading: "inter",
      scale: "comfortable"
    }
  };
}

function brandingPayload(template: StoreTemplateRecord) {
  return {
    primary_color: colorValue(template.branding_config.primaryColor, "#0f172a"),
    secondary_color: colorValue(template.branding_config.accentColor, "#2563eb"),
    theme_mode: "light",
    typography: {
      body: "inter",
      heading: "inter"
    }
  };
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

async function getTemplate(templateId: string) {
  const library = await getTemplateLibrary();
  return library.templates.find((template) => template.id === templateId) ?? null;
}

export async function applyWorkspaceStoreTemplate(formData: FormData) {
  const storeId = cleanText(formData.get("storeId"), 80);
  const requestedTemplateId = cleanText(formData.get("templateId"), 120);
  const redirectOptions = { workspaceStoreId: storeId };

  if (!storeId || !requestedTemplateId) {
    applicationRedirect("missing-selection", storeId, requestedTemplateId, redirectOptions);
  }

  const { supabase, user, workspaceId } = await getWorkspaceDataContext({
    permission: "can_edit_templates",
    redirectTo: templatePagePath
  });
  const access = await assertStoreAccessInWorkspace({
    permission: "can_edit_stores",
    storeId,
    supabase,
    userId: user.id,
    workspaceId
  });

  if (!access.allowed) {
    applicationRedirect("not-authorized", storeId, requestedTemplateId, redirectOptions);
  }

  const resolvedTemplate = await resolvePersistedTemplateId(supabase, requestedTemplateId);

  if (!resolvedTemplate) {
    applicationRedirect("template-missing", storeId, requestedTemplateId, redirectOptions);
  }

  const { persistedTemplateId, template } = resolvedTemplate;
  const settings = workspaceTemplateSettings(template);
  const theme = workspaceThemeValues(template);
  const now = new Date().toISOString();
  const storeUpdate = await supabase
    .from("stores")
    .update({
      font_style: theme.fontStyle,
      layout_style: theme.layoutStyle,
      template_id: persistedTemplateId,
      theme_color: theme.themeColor,
      theme_settings: settings,
      updated_at: now
    } as never)
    .eq("id", storeId)
    .eq("workspace_id" as never, workspaceId as never);

  if (storeUpdate.error) {
    console.warn("[template-application] workspace store template update failed", {
      message: storeUpdate.error.message,
      storeId,
      templateId: persistedTemplateId,
      userId: user.id,
      workspaceId
    });
    applicationRedirect("apply-failed", storeId, persistedTemplateId, redirectOptions);
  }

  const themeSettingsPayload = {
    brand_color: theme.themeColor,
    font_style: theme.fontStyle,
    layout_style: theme.layoutStyle,
    settings,
    store_id: storeId,
    template_id: persistedTemplateId,
    theme_color: theme.themeColor,
    theme_settings: settings,
    updated_at: now,
    user_id: user.id,
    workspace_id: workspaceId
  };
  const themeSettingsResult = await upsertWorkspaceStoreThemeSettings({
    payload: themeSettingsPayload,
    storeId,
    supabase,
    templateId: persistedTemplateId,
    userId: user.id,
    workspaceId
  });

  if (themeSettingsResult.error) {
    console.warn("[template-application] isolated store theme upsert failed after fallbacks", {
      message: themeSettingsResult.error.message,
      storeId,
      templateId: persistedTemplateId,
      userId: user.id,
      workspaceId
    });
    applicationRedirect("applied", storeId, persistedTemplateId, {
      ...redirectOptions,
      detail:
        "Template saved on the store record. Legacy theme row sync was skipped, but storefront theme settings remain available from the store."
    });
  }

  console.info("[template-application] workspace store template applied", {
    storeId,
    templateId: persistedTemplateId,
    themeSyncFallback: themeSettingsResult.usedFallback,
    userId: user.id,
    workspaceId
  });
  revalidatePath(templatePagePath);
  revalidatePath("/dashboard/stores");
  revalidatePath(`/dashboard/stores/${storeId}`);
  applicationRedirect("applied", storeId, persistedTemplateId, {
    ...redirectOptions,
    detail: themeSettingsResult.usedFallback
      ? "Template applied successfully. Theme row was synchronized using a safe fallback path."
      : "Template applied successfully to the selected workspace store."
  });
}

async function requireTemplateApplication(formData: FormData) {
  const storeId = cleanText(formData.get("storeId"), 80);
  const templateId = cleanText(formData.get("templateId"), 120);

  if (!storeId || !templateId) {
    applicationRedirect("missing-selection", storeId, templateId);
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
    applicationRedirect("not-authorized", storeId, templateId);
  }

  const template = await getTemplate(templateId);

  if (!template) {
    applicationRedirect("template-missing", storeId, templateId);
  }

  const validation = validateTemplateSchema(template.layout_schema);

  if (validation.errors.length) {
    applicationRedirect("invalid-template", storeId, templateId);
  }

  const access = await getUserSubscriptionAccess(user.id);

  try {
    assertFeatureAccess(access, "premium_templates", { templateId });
  } catch (error) {
    const params = new URLSearchParams({
      templateApply: "upgrade-required",
      templateId
    });

    if (storeId) {
      params.set("storeId", storeId);
    }

    const message = billingEnforcementMessage(error);

    if (message) {
      params.set("detail", message);
    }

    redirect(`${templatePagePath}?${params.toString()}`);
  }

  return {
    claimedStore,
    storeId,
    supabase,
    template,
    templateId,
    userId: user.id
  };
}

async function snapshotTemplateApplicationState(supabase: SupabaseClient, storeId: string) {
  const { data: pageData } = await supabase
    .from("builder_pages" as never)
    .select("*")
    .eq("store_instance_id", storeId)
    .eq("page_key", "home")
    .maybeSingle();
  const page = pageData ? (pageData as Record<string, unknown>) : null;
  const pageId = typeof page?.id === "string" ? page.id : "";
  const { data: draftData } = pageId
    ? await supabase
        .from("builder_drafts" as never)
        .select("*")
        .eq("builder_page_id", pageId)
        .maybeSingle()
    : { data: null };
  const { data: sectionsData } = await supabase
    .from("store_sections" as never)
    .select("*")
    .eq("store_instance_id", storeId)
    .order("section_order", { ascending: true });
  const { data: themeData } = await supabase
    .from("store_themes" as never)
    .select("*")
    .eq("store_instance_id", storeId)
    .eq("is_active", true)
    .maybeSingle();
  const { data: brandingData } = await supabase
    .from("store_branding" as never)
    .select("*")
    .eq("store_instance_id", storeId)
    .maybeSingle();

  return {
    branding: brandingData ? (brandingData as Record<string, unknown>) : null,
    draft: draftData ? (draftData as Record<string, unknown>) : null,
    page,
    sections: Array.isArray(sectionsData) ? (sectionsData as Record<string, unknown>[]) : [],
    theme: themeData ? (themeData as Record<string, unknown>) : null
  };
}

async function getOrCreateBuilderPage(
  supabase: SupabaseClient,
  storeId: string,
  userId: string,
  draftSchema: BuilderPageSchema
) {
  const { data, error } = await supabase
    .from("builder_pages" as never)
    .upsert(
      {
        owner_user_id: userId,
        page_key: "home",
        page_title: "Home",
        schema_version: draftSchema.version,
        status: "draft",
        store_instance_id: storeId
      } as never,
      { onConflict: "store_instance_id,page_key" }
    )
    .select("id")
    .single();

  return {
    error: error?.message ?? null,
    pageId: data ? (data as { id: string }).id : null
  };
}

async function restoreTableRow(
  supabase: SupabaseClient,
  table: string,
  row: Record<string, unknown> | null,
  fallbackEq: { key: string; value: string }
) {
  if (!row) {
    await supabase.from(table as never).delete().eq(fallbackEq.key, fallbackEq.value);
    return;
  }

  await supabase.from(table as never).upsert(row as never);
}

async function restoreStoreScopedSingleRow(
  supabase: SupabaseClient,
  table: string,
  storeId: string,
  row: Record<string, unknown> | null
) {
  await supabase.from(table as never).delete().eq("store_instance_id", storeId);

  if (row) {
    await supabase.from(table as never).insert(row as never);
  }
}

export async function rollbackTemplateApplicationOnFailure({
  pageId,
  snapshot,
  storeId,
  supabase
}: {
  pageId: string | null;
  snapshot: TemplateApplicationSnapshot;
  storeId: string;
  supabase: SupabaseClient;
}) {
  await supabase.from("store_sections" as never).delete().eq("store_instance_id", storeId);

  if (snapshot.sections.length) {
    await supabase.from("store_sections" as never).insert(snapshot.sections as never);
  }

  if (pageId) {
    await restoreTableRow(supabase, "builder_drafts", snapshot.draft, {
      key: "builder_page_id",
      value: pageId
    });
  }

  if (!snapshot.page && pageId) {
    await supabase.from("builder_pages" as never).delete().eq("id", pageId);
  }

  await restoreStoreScopedSingleRow(supabase, "store_themes", storeId, snapshot.theme);
  await restoreStoreScopedSingleRow(supabase, "store_branding", storeId, snapshot.branding);
}

export async function createDraftFromTemplate(formData: FormData) {
  const { storeId, supabase, template, templateId, userId } =
    await requireTemplateApplication(formData);
  const draftSchema = mapTemplateToBuilderDraft(template);
  const page = await getOrCreateBuilderPage(supabase, storeId, userId, draftSchema);

  if (page.error || !page.pageId) {
    applicationRedirect("draft-failed", storeId, templateId);
  }

  const { error } = await supabase
    .from("builder_drafts" as never)
    .upsert(
      {
        builder_page_id: page.pageId,
        draft_schema: draftSchema,
        editor_state: {
          mode: "desktop",
          previewSyncPending: true,
          selectedSectionId: null,
          source: "template_application",
          templateId
        },
        has_unsaved_changes: true,
        layout_tree: draftSchema.layoutTree,
        owner_user_id: userId,
        responsive_config: draftSchema.responsive,
        store_instance_id: storeId
      } as never,
      { onConflict: "builder_page_id" }
    );

  if (error) {
    applicationRedirect("draft-failed", storeId, templateId);
  }

  revalidatePath(templatePagePath);
  revalidatePath(`/dashboard/stores/${storeId}`);
  applicationRedirect("draft-created", storeId, templateId);
}

export async function replaceDraftSectionsFromTemplate(formData: FormData) {
  const { storeId, supabase, template, templateId, userId } =
    await requireTemplateApplication(formData);
  const draftSchema = mapTemplateToBuilderDraft(template);
  const sectionRows = draftSchema.sections.map((section) => ({
    config: section.props,
    owner_user_id: userId,
    section_enabled: section.enabled,
    section_order: section.order,
    section_type: section.type,
    store_instance_id: storeId
  }));

  await supabase.from("store_sections" as never).delete().eq("store_instance_id", storeId);

  if (sectionRows.length) {
    const { error } = await supabase.from("store_sections" as never).insert(sectionRows as never);

    if (error) {
      applicationRedirect("sections-failed", storeId, templateId);
    }
  }

  revalidatePath(templatePagePath);
  revalidatePath(`/dashboard/stores/${storeId}`);
  applicationRedirect("sections-replaced", storeId, templateId);
}

export async function applyTemplateThemeToStore(formData: FormData) {
  const { storeId, supabase, template, templateId, userId } =
    await requireTemplateApplication(formData);

  await supabase
    .from("store_themes" as never)
    .update({ is_active: false } as never)
    .eq("store_instance_id", storeId)
    .eq("is_active", true);

  const { error } = await supabase
    .from("store_themes" as never)
    .insert(normalizeThemePayload(template, userId, storeId) as never);

  if (error) {
    applicationRedirect("theme-failed", storeId, templateId);
  }

  revalidatePath(templatePagePath);
  revalidatePath(`/dashboard/stores/${storeId}`);
  applicationRedirect("theme-applied", storeId, templateId);
}

async function applyTemplateBrandingToStore({
  storeId,
  supabase,
  template
}: {
  storeId: string;
  supabase: SupabaseClient;
  template: StoreTemplateRecord;
}) {
  const { data: existingBranding } = await supabase
    .from("store_branding" as never)
    .select("id")
    .eq("store_instance_id", storeId)
    .maybeSingle();

  const payload = brandingPayload(template);

  return existingBranding
    ? await supabase
        .from("store_branding" as never)
        .update(payload as never)
        .eq("store_instance_id", storeId)
    : await supabase.from("store_branding" as never).insert({
        ...payload,
        store_instance_id: storeId
      } as never);
}

export async function applyTemplateToStore(formData: FormData) {
  const { storeId, supabase, template, templateId, userId } =
    await requireTemplateApplication(formData);
  const snapshot = await snapshotTemplateApplicationState(supabase, storeId);
  const draftSchema = mapTemplateToBuilderDraft(template);
  let pageId: string | null = null;

  try {
    const page = await getOrCreateBuilderPage(supabase, storeId, userId, draftSchema);

    if (page.error || !page.pageId) {
      throw new Error(page.error ?? "Unable to create template draft page.");
    }

    pageId = page.pageId;

    const { error: draftError } = await supabase
      .from("builder_drafts" as never)
      .upsert(
        {
          builder_page_id: pageId,
          draft_schema: draftSchema,
          editor_state: {
            mode: "desktop",
            previewSyncPending: true,
            selectedSectionId: null,
            source: "template_application",
            templateId
          },
          has_unsaved_changes: true,
          layout_tree: draftSchema.layoutTree,
          owner_user_id: userId,
          responsive_config: draftSchema.responsive,
          store_instance_id: storeId
        } as never,
        { onConflict: "builder_page_id" }
      );

    if (draftError) {
      throw new Error(draftError.message);
    }

    await supabase.from("store_sections" as never).delete().eq("store_instance_id", storeId);

    const sectionRows = draftSchema.sections.map((section) => ({
      config: section.props,
      owner_user_id: userId,
      section_enabled: section.enabled,
      section_order: section.order,
      section_type: section.type,
      store_instance_id: storeId
    }));

    if (sectionRows.length) {
      const { error: sectionsError } = await supabase
        .from("store_sections" as never)
        .insert(sectionRows as never);

      if (sectionsError) {
        throw new Error(sectionsError.message);
      }
    }

    await supabase
      .from("store_themes" as never)
      .update({ is_active: false } as never)
      .eq("store_instance_id", storeId)
      .eq("is_active", true);

    const { error: themeError } = await supabase
      .from("store_themes" as never)
      .insert(normalizeThemePayload(template, userId, storeId) as never);

    if (themeError) {
      throw new Error(themeError.message);
    }

    const brandingResult = await applyTemplateBrandingToStore({ storeId, supabase, template });

    if (brandingResult.error) {
      throw new Error(brandingResult.error.message);
    }
  } catch (error) {
    await rollbackTemplateApplicationOnFailure({ pageId, snapshot, storeId, supabase });
    console.error("[template-application] apply failed", {
      error,
      storeId,
      templateId
    });
    applicationRedirect("apply-failed", storeId, templateId);
  }

  revalidatePath(templatePagePath);
  revalidatePath(`/dashboard/stores/${storeId}`);
  applicationRedirect("applied", storeId, templateId);
}
