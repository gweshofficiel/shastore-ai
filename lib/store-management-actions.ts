"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;
type ClaimedStoreRow = {
  access_role?: string | null;
  id: string;
  internal_slug?: string | null;
  store_name?: string | null;
};
type BrandingAssetResult = {
  faviconUrl?: string;
  logoUrl?: string;
  status: "ok" | "bucket-missing" | "upload-failed";
};

const brandingBucket = "store-branding";
const maxBrandingAssetSize = 2 * 1024 * 1024;
const allowedBrandingMimeTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
  "image/x-icon"
]);

function cleanText(value: FormDataEntryValue | null, maxLength = 1000) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function cleanOptionalText(value: FormDataEntryValue | null, maxLength = 1000) {
  const text = cleanText(value, maxLength);
  return text || null;
}

function cleanHex(value: FormDataEntryValue | null, fallback: string) {
  const text = cleanText(value, 20);
  return /^#[0-9a-fA-F]{6}$/.test(text) ? text : fallback;
}

function safeRedirect(storeId: string, status = "read-only") {
  redirect(`/dashboard/stores/${storeId}?management=${encodeURIComponent(status)}`);
}

function settingsFailureRedirect(storeId: string) {
  redirect(`/dashboard/stores/${storeId}?management=settings-save-failed#settings`);
}

function brandingFailureRedirect(storeId: string) {
  redirect(`/dashboard/stores/${storeId}?management=branding-save-failed#branding`);
}

function brandingBucketMissingRedirect(storeId: string) {
  redirect(`/dashboard/stores/${storeId}?management-branding-save-failed=bucket-missing#branding`);
}

function isBucketMissingError(error: unknown) {
  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message ?? "").toLowerCase()
      : "";
  const statusCode =
    error && typeof error === "object" && "statusCode" in error
      ? String((error as { statusCode?: unknown }).statusCode ?? "")
      : "";

  return statusCode === "404" || (message.includes("bucket") && message.includes("not found"));
}

function safeAssetFileName(file: File) {
  const extension = file.name.includes(".")
    ? (file.name.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "")
    : "bin";
  return `${randomUUID()}.${extension || "bin"}`;
}

async function uploadBrandingAsset(file: File, storeId: string) {
  if (!allowedBrandingMimeTypes.has(file.type) || file.size > maxBrandingAssetSize) {
    return { status: "upload-failed" as const };
  }

  const admin = createAdminClient();

  if (!admin) {
    return { status: "upload-failed" as const };
  }

  const filename = safeAssetFileName(file);
  const storagePath = `stores/${storeId}/branding/${filename}`;
  const { error } = await admin.storage.from(brandingBucket).upload(storagePath, file, {
    contentType: file.type,
    upsert: true
  });

  if (error) {
    console.error("[buyer-store-dashboard] branding asset upload failed", {
      bucket: brandingBucket,
      message: error.message,
      storeId
    });

    return {
      status: isBucketMissingError(error) ? ("bucket-missing" as const) : ("upload-failed" as const)
    };
  }

  const { data } = admin.storage.from(brandingBucket).getPublicUrl(storagePath);
  return { publicUrl: data.publicUrl, status: "ok" as const };
}

async function saveStoreBrandingAssets(formData: FormData, storeId: string): Promise<BrandingAssetResult> {
  const logo = formData.get("logo");
  const favicon = formData.get("favicon");
  const result: BrandingAssetResult = { status: "ok" };

  if (logo instanceof File && logo.size > 0) {
    const upload = await uploadBrandingAsset(logo, storeId);

    if (upload.status !== "ok") {
      return { status: upload.status };
    }

    result.logoUrl = upload.publicUrl;
  }

  if (favicon instanceof File && favicon.size > 0) {
    const upload = await uploadBrandingAsset(favicon, storeId);

    if (upload.status !== "ok") {
      return { status: upload.status };
    }

    result.faviconUrl = upload.publicUrl;
  }

  return result;
}

async function getClaimedManagedStore(supabase: SupabaseClient, storeId: string) {
  const { data: claimedStores, error: claimedError } = await supabase.rpc(
    "get_claimed_store_instances_for_current_user" as never
  );

  if (claimedError || !Array.isArray(claimedStores)) {
    return null;
  }

  return (
    (claimedStores as ClaimedStoreRow[]).find(
      (row) =>
        row.id === storeId &&
        (!row.access_role || row.access_role === "owner" || row.access_role === "admin")
    ) ?? null
  );
}

async function requireManagedStoreReadOnly(formData: FormData) {
  const storeId = cleanText(formData.get("storeId"), 80);

  if (!storeId) {
    throw new Error("Missing store id.");
  }

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/dashboard/stores/${storeId}`)}`);
  }

  const claimedStore = await getClaimedManagedStore(supabase, storeId);

  if (!claimedStore) {
    throw new Error("You do not have permission to manage this store.");
  }

  return { claimedStore, storeId, supabase };
}

async function readOnlyManagementAction(formData: FormData) {
  const { storeId } = await requireManagedStoreReadOnly(formData);
  safeRedirect(storeId);
}

export async function saveManagedStoreSettings(formData: FormData) {
  const { claimedStore, storeId, supabase } = await requireManagedStoreReadOnly(formData);
  const storeName = cleanText(formData.get("storeName"), 180);

  if (!storeName) {
    settingsFailureRedirect(storeId);
  }

  const settingsPayload = {
    currency: cleanText(formData.get("currency"), 12) || "USD",
    language: cleanText(formData.get("language"), 20) || "en",
    store_description: cleanOptionalText(formData.get("storeDescription"), 2000),
    store_name: storeName,
    store_phone: cleanOptionalText(formData.get("supportPhone"), 60),
    support_email: cleanOptionalText(formData.get("supportEmail"), 180),
    timezone: cleanText(formData.get("timezone"), 80) || "UTC"
  };

  const { data: existingSettings, error: readError } = await supabase
    .from("store_settings" as never)
    .select("store_slug, store_status")
    .eq("store_instance_id", storeId)
    .maybeSingle();

  if (readError) {
    console.error("[buyer-store-dashboard] store settings read failed", {
      code: readError.code,
      message: readError.message,
      storeId
    });
    settingsFailureRedirect(storeId);
  }

  if (existingSettings) {
    const { error: updateError } = await supabase
      .from("store_settings" as never)
      .update(settingsPayload as never)
      .eq("store_instance_id", storeId);

    if (updateError) {
      console.error("[buyer-store-dashboard] store settings update failed", {
        code: updateError.code,
        message: updateError.message,
        storeId
      });
      settingsFailureRedirect(storeId);
    }
  } else {
    const { error: insertError } = await supabase.from("store_settings" as never).insert({
      ...settingsPayload,
      store_instance_id: storeId,
      store_slug: claimedStore.internal_slug || `store-${storeId.slice(0, 8)}`,
      store_status: "draft"
    } as never);

    if (insertError) {
      console.error("[buyer-store-dashboard] store settings insert failed", {
        code: insertError.code,
        message: insertError.message,
        storeId
      });
      settingsFailureRedirect(storeId);
    }
  }

  redirect(`/dashboard/stores/${storeId}#settings`);
}

export async function saveManagedStoreBranding(formData: FormData) {
  const { storeId, supabase } = await requireManagedStoreReadOnly(formData);
  const themeMode = cleanText(formData.get("themeMode"), 20);
  const brandingAssets = await saveStoreBrandingAssets(formData, storeId);

  if (brandingAssets.status === "bucket-missing") {
    brandingBucketMissingRedirect(storeId);
  }

  if (brandingAssets.status === "upload-failed") {
    brandingFailureRedirect(storeId);
  }

  const brandingPayload = {
    custom_css: cleanOptionalText(formData.get("customCss"), 12000),
    ...(brandingAssets.faviconUrl ? { favicon_url: brandingAssets.faviconUrl } : {}),
    ...(brandingAssets.logoUrl ? { logo_url: brandingAssets.logoUrl } : {}),
    primary_color: cleanHex(formData.get("primaryColor"), "#0f172a"),
    secondary_color: cleanHex(formData.get("secondaryColor"), "#2563eb"),
    theme_mode: ["light", "dark", "system"].includes(themeMode) ? themeMode : "light",
    typography: {
      body: cleanText(formData.get("bodyFont"), 40) || "inter",
      heading: cleanText(formData.get("headingFont"), 40) || "inter"
    }
  };

  const { data: existingBranding, error: readError } = await supabase
    .from("store_branding" as never)
    .select("id")
    .eq("store_instance_id", storeId)
    .maybeSingle();

  if (readError) {
    const brandingError = readError;
    console.error("BRANDING_SAVE_DEBUG", brandingError);
    console.error("[buyer-store-dashboard] store branding read failed", {
      code: readError.code,
      message: readError.message,
      storeId
    });
    brandingFailureRedirect(storeId);
  }

  if (existingBranding) {
    const { error: updateError } = await supabase
      .from("store_branding" as never)
      .update(brandingPayload as never)
      .eq("store_instance_id", storeId);

    if (updateError) {
      const brandingError = updateError;
      console.error("BRANDING_SAVE_DEBUG", brandingError);
      console.error("[buyer-store-dashboard] store branding update failed", {
        code: updateError.code,
        message: updateError.message,
        storeId
      });
      brandingFailureRedirect(storeId);
    }
  } else {
    const { error: insertError } = await supabase.from("store_branding" as never).insert({
      ...brandingPayload,
      store_instance_id: storeId
    } as never);

    if (insertError) {
      const brandingError = insertError;
      console.error("BRANDING_SAVE_DEBUG", brandingError);
      console.error("[buyer-store-dashboard] store branding insert failed", {
        code: insertError.code,
        message: insertError.message,
        storeId
      });
      brandingFailureRedirect(storeId);
    }
  }

  redirect(`/dashboard/stores/${storeId}#branding`);
}

export async function addManagedStoreDomain(formData: FormData) {
  await readOnlyManagementAction(formData);
}

export async function verifyManagedStoreDomain(formData: FormData) {
  await readOnlyManagementAction(formData);
}

export async function updateManagedStoreSubscription(formData: FormData) {
  await readOnlyManagementAction(formData);
}

export async function inviteManagedStoreStaff(formData: FormData) {
  await readOnlyManagementAction(formData);
}

export async function removeManagedStoreStaff(formData: FormData) {
  await readOnlyManagementAction(formData);
}

export async function createManagedMediaFolder(formData: FormData) {
  await readOnlyManagementAction(formData);
}

export async function uploadManagedStoreMedia(formData: FormData) {
  await readOnlyManagementAction(formData);
}

export async function refreshManagedStoreUsage(formData: FormData) {
  await readOnlyManagementAction(formData);
}
