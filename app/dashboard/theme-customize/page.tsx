import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { saveStoreThemeCustomizeSettings } from "@/lib/store-theme-customize-actions";
import { createClient } from "@/lib/supabase/server";
import { fetchStoresForAuthUser, type UserStoreRow } from "@/lib/stores/user-stores";
import { themeVisualStyleOptions } from "@/lib/tenant/theme";
import { getActiveWorkspaceForUser } from "@/lib/workspaces/active-workspace";

export const dynamic = "force-dynamic";

type ThemeDashboardData = {
  activeStore: UserStoreRow | null;
  error: string | null;
  stores: UserStoreRow[];
  theme: {
    backgroundColor: string;
    bodyFont: string;
    buttonRadius: string;
    cardRadius: string;
    footerStyle: string;
    headerStyle: string;
    headingFont: string;
    primaryColor: string;
    productCardStyle: string;
    secondaryColor: string;
    textColor: string;
  };
};

const defaultTheme = {
  backgroundColor: "#f8fafc",
  bodyFont: "inter",
  buttonRadius: "pill",
  cardRadius: "soft",
  footerStyle: "minimal",
  headerStyle: "classic",
  headingFont: "inter",
  primaryColor: "#0f172a",
  productCardStyle: "classic",
  secondaryColor: "#2563eb",
  textColor: "#0f172a"
};

function statusMessage(status: string | undefined) {
  const messages: Record<string, string> = {
    "missing-store": "Choose a store before customizing theme.",
    "not-authorized": "You do not have permission to customize that store theme.",
    saved: "Theme customization saved.",
    "save-failed": "Theme customization could not be saved."
  };

  return status ? messages[status] : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function stringValue(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function themeFromRow(row: unknown): ThemeDashboardData["theme"] {
  if (!isRecord(row)) {
    return defaultTheme;
  }

  const palette = isRecord(row.color_palette) ? row.color_palette : {};
  const typography = isRecord(row.typography) ? row.typography : {};
  const style = isRecord(row.style_config) ? row.style_config : {};

  return {
    backgroundColor: stringValue(palette.background, defaultTheme.backgroundColor),
    bodyFont: stringValue(typography.body, defaultTheme.bodyFont),
    buttonRadius: stringValue(style.buttonRadius, defaultTheme.buttonRadius),
    cardRadius: stringValue(style.cardRadius, defaultTheme.cardRadius),
    footerStyle: stringValue(style.footerStyle, defaultTheme.footerStyle),
    headerStyle: stringValue(style.headerStyle, defaultTheme.headerStyle),
    headingFont: stringValue(typography.heading, defaultTheme.headingFont),
    primaryColor: stringValue(palette.primary, defaultTheme.primaryColor),
    productCardStyle: stringValue(style.productCardStyle, defaultTheme.productCardStyle),
    secondaryColor: stringValue(palette.secondary, defaultTheme.secondaryColor),
    textColor: stringValue(palette.text, defaultTheme.textColor)
  };
}

async function getThemeDashboardData(selectedStoreId?: string): Promise<ThemeDashboardData> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { activeStore: null, error: "Sign in to customize theme.", stores: [], theme: defaultTheme };
  }

  const selection = await getActiveWorkspaceForUser({ supabase, userId: user.id });
  const workspaceId = selection.activeWorkspaceId;
  const { stores, error: storesError } = await fetchStoresForAuthUser(supabase, user.id, workspaceId);

  if (storesError) {
    return { activeStore: null, error: "Stores could not be loaded.", stores: [], theme: defaultTheme };
  }

  const activeStore = stores.find((store) => store.id === selectedStoreId) ?? stores[0] ?? null;

  if (!activeStore) {
    return { activeStore: null, error: null, stores, theme: defaultTheme };
  }

  const { data, error } = await supabase
    .from("store_themes" as never)
    .select("color_palette, typography, style_config")
    .eq("workspace_id" as never, workspaceId as never)
    .eq("store_id" as never, activeStore.id as never)
    .eq("is_active" as never, true as never)
    .maybeSingle();

  return {
    activeStore,
    error: error ? "Theme settings could not be loaded. Confirm theme runtime migrations are applied." : null,
    stores,
    theme: themeFromRow(data)
  };
}

function SelectField({
  label,
  name,
  options,
  value
}: {
  label: string;
  name: string;
  options: readonly string[];
  value: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-ink">
      <span>{label}</span>
      <select
        className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink shadow-sm"
        defaultValue={value}
        name={name}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option.replace("-", " ")}
          </option>
        ))}
      </select>
    </label>
  );
}

export default async function ThemeCustomizeDashboard({
  searchParams
}: {
  searchParams: Promise<{ storeId?: string; theme?: string }>;
}) {
  const query = await searchParams;
  const { activeStore, error, stores, theme } = await getThemeDashboardData(query.storeId);
  const message = statusMessage(query.theme);

  return (
    <div className="grid gap-6 lg:gap-8">
      <PageHeader
        description="Customize public storefront colors, typography, radius, and visual style for one store."
        title="Theme Customize"
      />

      {message ? (
        <Card className="border-blue-100 bg-blue-50 p-4 text-sm font-bold text-blue-800">
          {message}
        </Card>
      ) : null}

      {error ? (
        <Card className="border-red-200 bg-red-50 p-5 text-sm font-bold text-red-700">
          {error}
        </Card>
      ) : null}

      {stores.length ? (
        <Card className="p-4">
          <form className="flex flex-wrap items-end gap-3">
            <label className="grid gap-2 text-sm font-bold text-ink">
              <span>Store</span>
              <select
                className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-ink outline-none"
                defaultValue={activeStore?.id}
                name="storeId"
              >
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.store_name || store.name || store.slug || store.id}
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit" variant="secondary">
              View store
            </Button>
          </form>
        </Card>
      ) : null}

      {activeStore ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.45fr)]">
          <Card className="p-5">
            <form action={saveStoreThemeCustomizeSettings} className="grid gap-5">
              <input name="storeId" type="hidden" value={activeStore.id} />
              <div className="grid gap-4 md:grid-cols-2">
                <Input defaultValue={theme.primaryColor} label="Primary color" name="primaryColor" type="color" />
                <Input defaultValue={theme.secondaryColor} label="Secondary color" name="secondaryColor" type="color" />
                <Input defaultValue={theme.backgroundColor} label="Background color" name="backgroundColor" type="color" />
                <Input defaultValue={theme.textColor} label="Text color" name="textColor" type="color" />
                <SelectField label="Heading font" name="headingFont" options={["inter", "serif", "display", "mono"]} value={theme.headingFont} />
                <SelectField label="Body font" name="bodyFont" options={["inter", "serif", "display", "mono"]} value={theme.bodyFont} />
                <SelectField label="Button radius" name="buttonRadius" options={themeVisualStyleOptions.buttonRadius} value={theme.buttonRadius} />
                <SelectField label="Card radius" name="cardRadius" options={themeVisualStyleOptions.cardRadius} value={theme.cardRadius} />
                <SelectField label="Product card style" name="productCardStyle" options={themeVisualStyleOptions.productCardStyle} value={theme.productCardStyle} />
                <SelectField label="Header style" name="headerStyle" options={themeVisualStyleOptions.headerStyle} value={theme.headerStyle} />
                <SelectField label="Footer style" name="footerStyle" options={themeVisualStyleOptions.footerStyle} value={theme.footerStyle} />
              </div>
              <Button type="submit">Save theme customization</Button>
            </form>
          </Card>

          <Card className="p-5">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
              Preview
            </p>
            <div
              className="mt-5 rounded-[2rem] border border-slate-200 p-5"
              style={{ backgroundColor: theme.backgroundColor, color: theme.textColor }}
            >
              <div
                className="rounded-[1.5rem] p-5 text-white"
                style={{ backgroundColor: theme.primaryColor }}
              >
                <h2 className="text-2xl font-black">Storefront theme</h2>
                <p className="mt-2 text-sm font-semibold opacity-80">
                  Product cards, header, footer, colors, and fonts update for this store only.
                </p>
                <span
                  className="mt-4 inline-flex px-4 py-2 text-sm font-black text-ink"
                  style={{
                    backgroundColor: theme.secondaryColor,
                    borderRadius:
                      theme.buttonRadius === "sharp"
                        ? "0.5rem"
                        : theme.buttonRadius === "rounded"
                          ? "1rem"
                          : "999px"
                  }}
                >
                  Button sample
                </span>
              </div>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
