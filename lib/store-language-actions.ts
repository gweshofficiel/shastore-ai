"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUserPrimaryWorkspaceId, hasPermission, type WorkspaceRole } from "@/lib/permissions/rbac";
import {
  isStoreLanguageCode,
  normalizeEnabledLanguageOrder,
  normalizeStoreLanguageSettings,
  storefrontLanguageDefinitions,
  tifinaghAmazighLanguageCode,
  type StoreLanguageCode
} from "@/lib/store-languages";
import { createClient } from "@/lib/supabase/server";

const languagesPath = "/dashboard/languages";

function languagesWith(status: string, storeId?: string): never {
  const params = new URLSearchParams({ languages: status });

  if (storeId) {
    params.set("storeId", storeId);
  }

  redirect(`${languagesPath}?${params.toString()}`);
}

function cleanId(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

async function requireLanguageStoreAccess(storeId: string) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    languagesWith("not-authorized", storeId);
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
    languagesWith("not-authorized", storeId);
  }

  if (!hasPermission((member?.role ?? null) as WorkspaceRole | null, "settings.edit", member?.permission_overrides ?? undefined)) {
    languagesWith("not-authorized", storeId);
  }

  const { data: store } = await supabase
    .from("stores" as never)
    .select("id, slug, language_settings, workspace_id")
    .eq("id" as never, storeId as never)
    .eq("workspace_id" as never, workspaceId as never)
    .maybeSingle();
  const storeRow = store as {
    id: string;
    language_settings?: unknown;
    slug?: string | null;
    workspace_id: string;
  } | null;

  if (!storeRow) {
    languagesWith("not-authorized", storeId);
  }

  return {
    store: storeRow,
    supabase,
    workspaceId
  };
}

export async function saveStoreLanguageSettingsAction(formData: FormData) {
  const storeId = cleanId(formData.get("storeId"));

  if (!storeId) {
    languagesWith("missing-store");
  }

  const { store, supabase, workspaceId } = await requireLanguageStoreAccess(storeId);
  const enabledInputs = formData.getAll("enabledLanguages")
    .map((value) => String(value))
    .filter(isStoreLanguageCode);
  const defaultLanguageInput = String(formData.get("defaultLanguage") ?? "");
  const orderByCode = new Map<StoreLanguageCode, number>();

  for (const language of storefrontLanguageDefinitions) {
    const fallbackOrder = language.code === tifinaghAmazighLanguageCode ? 0 : 999;
    const orderValue = Number(formData.get(`order_${language.code}`) ?? fallbackOrder);
    orderByCode.set(language.code, Number.isFinite(orderValue) ? orderValue : 999);
  }

  const orderedEnabled = normalizeEnabledLanguageOrder(enabledInputs)
    .sort((left, right) => {
      if (left === tifinaghAmazighLanguageCode) {
        return -1;
      }
      if (right === tifinaghAmazighLanguageCode) {
        return 1;
      }

      return (orderByCode.get(left) ?? 999) - (orderByCode.get(right) ?? 999);
    });
  const defaultLanguage = isStoreLanguageCode(defaultLanguageInput) && orderedEnabled.includes(defaultLanguageInput)
    ? defaultLanguageInput
    : tifinaghAmazighLanguageCode;
  const languageSettings = normalizeStoreLanguageSettings({
    defaultLanguage,
    enabledLanguages: orderedEnabled
  });
  const { error } = await supabase
    .from("stores" as never)
    .update({ language_settings: languageSettings } as never)
    .eq("id" as never, store.id as never)
    .eq("workspace_id" as never, workspaceId as never);

  if (error) {
    languagesWith("save-failed", storeId);
  }

  revalidatePath(languagesPath);
  revalidatePath("/dashboard");
  if (store.slug) {
    revalidatePath(`/store/${store.slug}`);
  }
  languagesWith("saved", storeId);
}
