"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  themeVisualStyleOptions,
  type StoreThemeRecord
} from "@/lib/tenant/theme";
import {
  assertStoreAccessInWorkspace,
  getWorkspaceDataContext
} from "@/lib/workspaces/data-access";

const themeCustomizePath = "/dashboard/theme-customize";

type WorkspaceStoreRow = {
  id: string;
  slug?: string | null;
};

function cleanText(value: FormDataEntryValue | null, maxLength = 1000) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanColor(value: FormDataEntryValue | null, fallback: string) {
  const text = cleanText(value, 20);
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(text) ? text : fallback;
}

function pick<T extends readonly string[]>(
  value: FormDataEntryValue | null,
  options: T,
  fallback: string
) {
  const text = cleanText(value, 80);
  return options.includes(text) ? text : fallback;
}

function themeRedirect(storeId: string, status: string): never {
  const params = new URLSearchParams({ storeId, theme: status });
  redirect(`${themeCustomizePath}?${params.toString()}`);
}

async function requireWorkspaceStore(formData: FormData) {
  const storeId = cleanText(formData.get("storeId"), 80);

  if (!storeId) {
    redirect(`${themeCustomizePath}?theme=missing-store`);
  }

  const { supabase, user, workspaceId } = await getWorkspaceDataContext({
    permission: "can_edit_stores",
    redirectTo: themeCustomizePath
  });
  const access = await assertStoreAccessInWorkspace({
    permission: "can_edit_stores",
    storeId,
    supabase,
    userId: user.id,
    workspaceId
  });

  if (!access.allowed) {
    themeRedirect(storeId, "not-authorized");
  }

  return {
    store: access.store as WorkspaceStoreRow,
    storeId,
    supabase,
    user,
    workspaceId
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export async function saveStoreThemeCustomizeSettings(formData: FormData) {
  const { store, storeId, supabase, user, workspaceId } = await requireWorkspaceStore(formData);
  const client = createAdminClient() ?? supabase;
  const now = new Date().toISOString();
  const { data: existingTheme } = await client
    .from("store_themes" as never)
    .select("*")
    .eq("store_id" as never, storeId as never)
    .eq("is_active" as never, true as never)
    .maybeSingle();
  const theme = (existingTheme ?? {}) as Partial<StoreThemeRecord> & {
    color_palette?: Record<string, unknown>;
    style_config?: Record<string, unknown>;
    typography?: Record<string, unknown>;
  };
  const colorPalette: Record<string, unknown> = isRecord(theme.color_palette)
    ? theme.color_palette
    : {};
  const typography: Record<string, unknown> = isRecord(theme.typography)
    ? theme.typography
    : {};
  const styleConfig: Record<string, unknown> = isRecord(theme.style_config)
    ? theme.style_config
    : {};
  const nextColorPalette = {
    accent: cleanColor(formData.get("secondaryColor"), String(colorPalette.accent || "#f59e0b")),
    background: cleanColor(formData.get("backgroundColor"), String(colorPalette.background || "#f8fafc")),
    muted: String(colorPalette.muted || "#64748b"),
    primary: cleanColor(formData.get("primaryColor"), String(colorPalette.primary || "#0f172a")),
    secondary: cleanColor(formData.get("secondaryColor"), String(colorPalette.secondary || "#2563eb")),
    surface: String(colorPalette.surface || "#ffffff"),
    text: cleanColor(formData.get("textColor"), String(colorPalette.text || "#0f172a"))
  };
  const nextTypography = {
    body: pick(formData.get("bodyFont"), ["inter", "serif", "display", "mono"], String(typography.body || "inter")),
    heading: pick(formData.get("headingFont"), ["inter", "serif", "display", "mono"], String(typography.heading || "inter")),
    scale: String(typography.scale || "comfortable")
  };
  const nextStyleConfig = {
    ...styleConfig,
    buttonRadius: pick(
      formData.get("buttonRadius"),
      themeVisualStyleOptions.buttonRadius,
      String(styleConfig.buttonRadius || "pill")
    ),
    cardRadius: pick(
      formData.get("cardRadius"),
      themeVisualStyleOptions.cardRadius,
      String(styleConfig.cardRadius || "soft")
    ),
    footerStyle: pick(
      formData.get("footerStyle"),
      themeVisualStyleOptions.footerStyle,
      String(styleConfig.footerStyle || "minimal")
    ),
    headerStyle: pick(
      formData.get("headerStyle"),
      themeVisualStyleOptions.headerStyle,
      String(styleConfig.headerStyle || "classic")
    ),
    productCardStyle: pick(
      formData.get("productCardStyle"),
      themeVisualStyleOptions.productCardStyle,
      String(styleConfig.productCardStyle || "classic")
    )
  };

  const { error: deactivateError } = await client
    .from("store_themes" as never)
    .update({ is_active: false, updated_at: now } as never)
    .eq("store_id" as never, storeId as never);

  if (deactivateError) {
    themeRedirect(storeId, "save-failed");
  }

  const { error } = await client.from("store_themes" as never).upsert(
    {
      border_radius:
        nextStyleConfig.cardRadius === "sharp"
          ? "0.75rem"
          : nextStyleConfig.cardRadius === "rounded"
            ? "1.5rem"
            : "2rem",
      color_palette: nextColorPalette,
      is_active: true,
      layout_key: String(theme.layout_key || "classic"),
      owner_user_id: user.id,
      published_at: now,
      settings: {
        bodyFont: nextTypography.body,
        buttonStyle: nextStyleConfig.buttonRadius,
        footerStyle: nextStyleConfig.footerStyle,
        headingFont: nextTypography.heading,
        primaryColor: nextColorPalette.primary,
        secondaryColor: nextColorPalette.secondary
      },
      status: "published",
      store_id: storeId,
      style_config: nextStyleConfig,
      theme_id: "shastore-custom",
      theme_key: "custom",
      typography: nextTypography,
      updated_at: now,
      workspace_id: workspaceId
    } as never,
    { onConflict: "store_id,theme_key" }
  );

  if (error) {
    themeRedirect(storeId, "save-failed");
  }

  revalidatePath(themeCustomizePath);

  if (store.slug) {
    revalidatePath(`/store/${store.slug}`);
  }

  themeRedirect(storeId, "saved");
}
