import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getUserPrimaryWorkspaceId, hasPermission, type WorkspaceRole } from "@/lib/permissions/rbac";
import { saveStoreLanguageSettingsAction } from "@/lib/store-language-actions";
import {
  normalizeStoreLanguageSettings,
  storefrontLanguageDefinitions,
  tifinaghAmazighLanguageCode
} from "@/lib/store-languages";
import { createClient } from "@/lib/supabase/server";
import { fetchStoresForAuthUser, type UserStoreRow } from "@/lib/stores/user-stores";

export const dynamic = "force-dynamic";

type LanguagesPageProps = {
  searchParams: Promise<{
    languages?: string;
    storeId?: string;
  }>;
};

type LanguageStoreRow = {
  id: string;
  language_settings?: unknown;
  name: string;
  slug: string | null;
};

type LanguagesData = {
  activeStore: UserStoreRow | null;
  error: string | null;
  storeLanguages: LanguageStoreRow | null;
  stores: UserStoreRow[];
};

function statusMessage(status: string | undefined) {
  const messages: Record<string, string> = {
    "missing-store": "Choose a store before saving language settings.",
    "not-authorized": "You do not have permission to manage languages for that store.",
    saved: "Language settings saved.",
    "save-failed": "Language settings could not be saved."
  };

  return status ? messages[status] ?? null : null;
}

async function getLanguagesData(selectedStoreId?: string): Promise<LanguagesData> {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { activeStore: null, error: "Sign in to manage storefront languages.", storeLanguages: null, stores: [] };
  }

  const workspaceId = await getUserPrimaryWorkspaceId(supabase, user.id);
  const { data: membership } = await supabase
    .from("workspace_members" as never)
    .select("role, status, permission_overrides")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();
  const member = membership as {
    permission_overrides?: Record<string, boolean> | null;
    role?: string | null;
    status?: string | null;
  } | null;

  if (member?.status && member.status !== "active") {
    return { activeStore: null, error: "You do not have permission to manage languages.", storeLanguages: null, stores: [] };
  }

  if (!hasPermission((member?.role ?? null) as WorkspaceRole | null, "settings.edit", member?.permission_overrides ?? undefined)) {
    return { activeStore: null, error: "You do not have permission to manage languages.", storeLanguages: null, stores: [] };
  }

  const { stores, error: storesError } = await fetchStoresForAuthUser(supabase, user.id, workspaceId);
  const activeStore = stores.find((store) => store.id === selectedStoreId) ?? stores[0] ?? null;

  if (storesError || !activeStore) {
    return {
      activeStore,
      error: storesError ? "Stores could not be loaded." : null,
      storeLanguages: null,
      stores
    };
  }

  const { data, error } = await supabase
    .from("stores" as never)
    .select("id, name, slug, language_settings")
    .eq("workspace_id" as never, workspaceId as never)
    .eq("id" as never, activeStore.id as never)
    .maybeSingle();

  if (error) {
    return {
      activeStore,
      error: "Language settings could not be loaded. Apply the multi-language storefront migration.",
      storeLanguages: null,
      stores
    };
  }

  return {
    activeStore,
    error: null,
    storeLanguages: data as unknown as LanguageStoreRow | null,
    stores
  };
}

export default async function LanguagesPage({ searchParams }: LanguagesPageProps) {
  const query = await searchParams;
  const { activeStore, error, storeLanguages, stores } = await getLanguagesData(query.storeId);
  const settings = normalizeStoreLanguageSettings(storeLanguages?.language_settings);
  const message = statusMessage(query.languages);

  return (
    <div className="grid gap-6 lg:gap-8">
      <PageHeader
        description="Enable storefront languages and prepare translation fallback behavior without changing existing content."
        title="Languages"
      />

      {message ? (
        <Card className="border-blue-200 bg-blue-50 p-5">
          <p className="text-sm font-bold text-blue-800">{message}</p>
        </Card>
      ) : null}

      {error ? (
        <Card className="border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-bold text-amber-800">{error}</p>
        </Card>
      ) : null}

      {stores.length > 1 ? (
        <Card className="p-5">
          <form className="flex flex-wrap items-end gap-3">
            <label className="grid gap-2 text-sm font-semibold text-ink">
              <span>Store</span>
              <select className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink outline-none" defaultValue={activeStore?.id ?? ""} name="storeId">
                {stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}
              </select>
            </label>
            <Button type="submit">Switch store</Button>
          </form>
        </Card>
      ) : null}

      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Storefront languages</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">{activeStore?.name ?? "No store selected"}</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-muted">
              Tifinagh Amazigh remains available and first in priority. Translation fields are prepared, but content is not auto-translated.
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-slate-600">
            {settings.enabledLanguages.length} enabled
          </span>
        </div>

        <form action={saveStoreLanguageSettingsAction} className="mt-6 grid gap-5">
          <input name="storeId" type="hidden" value={activeStore?.id ?? ""} />

          <label className="grid gap-2 text-sm font-bold text-ink">
            <span>Default language</span>
            <select className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-ink outline-none" defaultValue={settings.defaultLanguage} name="defaultLanguage">
              {settings.enabledLanguages.map((code) => {
                const language = storefrontLanguageDefinitions.find((item) => item.code === code);
                return language ? (
                  <option key={language.code} value={language.code}>
                    {language.nativeLabel} - {language.label}
                  </option>
                ) : null;
              })}
            </select>
          </label>

          <div className="overflow-hidden rounded-3xl border border-slate-200">
            <div className="grid grid-cols-[1fr_7rem_6rem] gap-3 bg-slate-50 px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-slate-400">
              <span>Language</span>
              <span>Enabled</span>
              <span>Order</span>
            </div>
            {storefrontLanguageDefinitions.map((language, index) => {
              const isTifinagh = language.code === tifinaghAmazighLanguageCode;
              const enabled = settings.enabledLanguages.includes(language.code);
              const orderValue = settings.enabledLanguages.indexOf(language.code);

              return (
                <div className="grid grid-cols-[1fr_7rem_6rem] items-center gap-3 border-t border-slate-100 px-4 py-3" key={language.code}>
                  <div>
                    <p className="text-sm font-black text-ink">{language.nativeLabel}</p>
                    <p className="text-xs font-semibold text-muted">{language.label} · {language.code} · {language.direction.toUpperCase()}</p>
                  </div>
                  <label className="flex items-center gap-2 text-sm font-bold text-ink">
                    <input
                      defaultChecked={enabled || isTifinagh}
                      disabled={isTifinagh}
                      name="enabledLanguages"
                      type="checkbox"
                      value={language.code}
                    />
                    {isTifinagh ? "Required" : "Enable"}
                  </label>
                  <input
                    className="h-10 rounded-2xl border border-slate-200 px-3 text-sm font-bold text-ink outline-none"
                    defaultValue={isTifinagh ? 0 : orderValue >= 0 ? orderValue : index}
                    min={isTifinagh ? 0 : 1}
                    name={`order_${language.code}`}
                    readOnly={isTifinagh}
                    type="number"
                  />
                  {isTifinagh ? <input name="enabledLanguages" type="hidden" value={language.code} /> : null}
                </div>
              );
            })}
          </div>

          <div className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold leading-6 text-muted">
            <p className="font-black text-ink">Translation-ready fields</p>
            <p className="mt-2">Store profile, products, categories, pages, blog articles, FAQ, legal pages, and homepage sections now have JSON translation storage. Missing translations fall back to the default language and then the existing content.</p>
          </div>

          <Button type="submit">Save language settings</Button>
        </form>
      </Card>
    </div>
  );
}
