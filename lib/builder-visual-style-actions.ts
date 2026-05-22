"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  applySectionStyleOverride,
  resolveVisualThemeStyles,
  syncVisualStylePreview,
  updateThemeTokens,
  validateThemeCustomization
} from "@/lib/theme-token-resolver";
import { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

type ClaimedStoreRow = {
  access_role?: string | null;
  id: string;
};

const builderPath = (storeId: string) => `/dashboard/stores/${storeId}`;

function cleanText(value: FormDataEntryValue | null, maxLength = 200) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : "";
}

function builderRedirect(storeId: string, status: string): never {
  redirect(`${builderPath(storeId)}?builder=${encodeURIComponent(status)}#overview`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
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

async function requireBuilderStore(formData: FormData) {
  const storeId = cleanText(formData.get("storeId"), 80);

  if (!storeId) {
    redirect("/dashboard/stores?builder=missing-store");
  }

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(builderPath(storeId))}`);
  }

  const claimedStore = await getClaimedStore(supabase, storeId);

  if (!claimedStore) {
    builderRedirect(storeId, "not-authorized");
  }

  return { storeId, supabase, userId: user.id };
}

async function getBuilderContext(supabase: SupabaseClient, storeId: string) {
  const [{ data: themeData }, { data: pageData }] = await Promise.all([
    supabase
      .from("store_themes" as never)
      .select("id, color_palette, typography, border_radius, spacing")
      .eq("store_instance_id", storeId)
      .eq("is_active", true)
      .maybeSingle(),
    supabase
      .from("builder_pages" as never)
      .select("id")
      .eq("store_instance_id", storeId)
      .eq("page_key", "home")
      .maybeSingle()
  ]);
  const page = pageData as { id?: string } | null;

  if (!page?.id) {
    return { draft: null, page: null, theme: themeData as Record<string, unknown> | null };
  }

  const { data: draftData } = await supabase
    .from("builder_drafts" as never)
    .select("id, editor_state")
    .eq("builder_page_id", page.id)
    .maybeSingle();

  return {
    draft: draftData as { editor_state?: unknown; id?: string } | null,
    page,
    theme: themeData as Record<string, unknown> | null
  };
}

export async function updateThemeTokensAction(formData: FormData) {
  const { storeId, supabase, userId } = await requireBuilderStore(formData);
  const { draft, page, theme } = await getBuilderContext(supabase, storeId);

  if (!page?.id || !draft?.id) {
    builderRedirect(storeId, "visual-style-draft-missing");
  }

  const tokens = updateThemeTokens(theme, {
    button: {
      radius: cleanText(formData.get("buttonRadius"), 40) || "pill",
      style: cleanText(formData.get("buttonStyle"), 40) || "filled"
    },
    colors: {
      accent: cleanText(formData.get("accentColor"), 24) || undefined,
      background: cleanText(formData.get("backgroundColor"), 24) || undefined,
      primary: cleanText(formData.get("primaryColor"), 24) || undefined,
      secondary: cleanText(formData.get("secondaryColor"), 24) || undefined
    },
    radius: {
      card: cleanText(formData.get("cardRadius"), 40) || undefined,
      section: cleanText(formData.get("sectionRadius"), 40) || undefined
    },
    spacing: {
      density: cleanText(formData.get("spacingDensity"), 40) || undefined,
      section: cleanText(formData.get("sectionSpacing"), 40) || undefined
    },
    typography: {
      body: cleanText(formData.get("bodyFont"), 40) || undefined,
      heading: cleanText(formData.get("headingFont"), 40) || undefined,
      scale: cleanText(formData.get("fontScale"), 40) || undefined
    }
  });
  const validation = validateThemeCustomization(tokens);

  if (validation.errors.length) {
    builderRedirect(storeId, "visual-style-invalid");
  }

  const { data: overrideData, error } = await supabase
    .from("store_theme_style_overrides" as never)
    .insert({
      builder_draft_id: draft.id,
      builder_page_id: page.id,
      button_tokens: tokens.button,
      color_tokens: tokens.colors,
      global_theme_tokens: tokens,
      metadata: {
        future: ["ai_branding", "ai_color_palette_generation", "reusable_style_presets"],
        source: "visual_theme_token_update"
      },
      owner_user_id: userId,
      override_scope: "draft",
      radius_tokens: tokens.radius,
      spacing_tokens: tokens.spacing,
      store_instance_id: storeId,
      store_theme_id: typeof theme?.id === "string" ? theme.id : null,
      typography_tokens: tokens.typography
    } as never)
    .select("id")
    .single();

  if (error || !overrideData) {
    builderRedirect(storeId, "visual-style-save-failed");
  }

  const previewState = syncVisualStylePreview(tokens);
  const editorState = isRecord(draft.editor_state) ? draft.editor_state : {};

  await supabase
    .from("builder_drafts" as never)
    .update({
      editor_state: {
        ...editorState,
        previewSyncPending: false,
        visualStylePreview: previewState,
        visualStylePreviewIsolated: true
      }
    } as never)
    .eq("id", draft.id)
    .eq("store_instance_id", storeId);

  await supabase.from("builder_visual_style_states" as never).upsert({
    active_style_override_id: (overrideData as { id: string }).id,
    builder_draft_id: draft.id,
    builder_page_id: page.id,
    hydration_state: {
      hydrationSafe: previewState.hydratedSafely,
      themeRenderingSafe: true
    },
    metadata: {
      source: "visual_theme_token_update"
    },
    owner_user_id: userId,
    preview_state: previewState,
    preview_tokens: tokens,
    selected_style_target: "global",
    sidebar_state: {
      colorPickerReady: true,
      typographyControlsReady: true
    },
    store_instance_id: storeId,
    store_theme_id: typeof theme?.id === "string" ? theme.id : null,
    updated_at: new Date().toISOString()
  } as never);

  revalidatePath(builderPath(storeId));
  builderRedirect(storeId, "visual-style-updated");
}

export async function applySectionStyleOverrideAction(formData: FormData) {
  const { storeId, supabase, userId } = await requireBuilderStore(formData);
  const sectionId = cleanText(formData.get("sectionId"), 80);
  const { draft, page, theme } = await getBuilderContext(supabase, storeId);

  if (!page?.id || !draft?.id) {
    builderRedirect(storeId, "visual-style-draft-missing");
  }

  if (!sectionId) {
    builderRedirect(storeId, "visual-style-section-missing");
  }

  const latestOverride = await supabase
    .from("store_theme_style_overrides" as never)
    .select("section_style_overrides, global_theme_tokens")
    .eq("store_instance_id", storeId)
    .eq("builder_draft_id", draft.id)
    .eq("override_scope", "draft")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const latest = latestOverride.data as {
    global_theme_tokens?: unknown;
    section_style_overrides?: unknown;
  } | null;
  const baseTokens = resolveVisualThemeStyles(
    theme,
    isRecord(latest?.global_theme_tokens) ? (latest.global_theme_tokens as never) : {}
  );
  const sectionOverrides = applySectionStyleOverride({
    currentOverrides: isRecord(latest?.section_style_overrides)
      ? latest.section_style_overrides
      : {},
    sectionId,
    styleTokens: {
      accentColor: cleanText(formData.get("sectionAccentColor"), 24) || baseTokens.colors.accent,
      backgroundColor:
        cleanText(formData.get("sectionBackgroundColor"), 24) || baseTokens.colors.background,
      spacing: cleanText(formData.get("sectionSpacing"), 40) || baseTokens.spacing.section
    }
  });

  const { error } = await supabase.from("store_theme_style_overrides" as never).insert({
    builder_draft_id: draft.id,
    builder_page_id: page.id,
    global_theme_tokens: baseTokens,
    metadata: {
      source: "section_style_override"
    },
    owner_user_id: userId,
    override_scope: "section",
    section_id: sectionId,
    section_style_overrides: sectionOverrides,
    store_instance_id: storeId,
    store_theme_id: typeof theme?.id === "string" ? theme.id : null
  } as never);

  if (error) {
    builderRedirect(storeId, "visual-style-section-failed");
  }

  revalidatePath(builderPath(storeId));
  builderRedirect(storeId, "visual-style-section-applied");
}

export async function syncVisualStylePreviewAction(formData: FormData) {
  const { storeId, supabase, userId } = await requireBuilderStore(formData);
  const { draft, page, theme } = await getBuilderContext(supabase, storeId);

  if (!page?.id || !draft?.id) {
    builderRedirect(storeId, "visual-style-draft-missing");
  }

  const { data: overrideData } = await supabase
    .from("store_theme_style_overrides" as never)
    .select("id, global_theme_tokens, color_tokens, typography_tokens, spacing_tokens, radius_tokens, button_tokens")
    .eq("store_instance_id", storeId)
    .eq("builder_draft_id", draft.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const override = overrideData as Record<string, unknown> | null;
  const tokens = resolveVisualThemeStyles(theme, {
    button: isRecord(override?.button_tokens) ? override.button_tokens : {},
    colors: isRecord(override?.color_tokens) ? override.color_tokens : {},
    radius: isRecord(override?.radius_tokens) ? override.radius_tokens : {},
    spacing: isRecord(override?.spacing_tokens) ? override.spacing_tokens : {},
    typography: isRecord(override?.typography_tokens) ? override.typography_tokens : {}
  });
  const validation = validateThemeCustomization(tokens);

  if (validation.errors.length) {
    builderRedirect(storeId, "visual-style-invalid");
  }

  const previewState = syncVisualStylePreview(tokens);
  const editorState = isRecord(draft.editor_state) ? draft.editor_state : {};

  await supabase
    .from("builder_drafts" as never)
    .update({
      editor_state: {
        ...editorState,
        previewSyncPending: false,
        visualStylePreview: previewState
      }
    } as never)
    .eq("id", draft.id)
    .eq("store_instance_id", storeId);

  await supabase.from("builder_visual_style_states" as never).upsert({
    active_style_override_id: typeof override?.id === "string" ? override.id : null,
    builder_draft_id: draft.id,
    builder_page_id: page.id,
    hydration_state: {
      hydrationSafe: true,
      themeRenderingSafe: true
    },
    metadata: {
      source: "visual_style_preview_sync"
    },
    owner_user_id: userId,
    preview_state: previewState,
    preview_tokens: tokens,
    selected_style_target: cleanText(formData.get("styleTarget"), 40) || "global",
    sidebar_state: {
      liveStylingPreviewReady: true
    },
    store_instance_id: storeId,
    store_theme_id: typeof theme?.id === "string" ? theme.id : null,
    updated_at: new Date().toISOString()
  } as never);

  revalidatePath(builderPath(storeId));
  builderRedirect(storeId, "visual-style-preview-synced");
}
