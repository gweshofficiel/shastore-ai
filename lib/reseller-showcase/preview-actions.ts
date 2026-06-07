"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  buildResellerPreviewUrl,
  type ResellerPreviewStatus
} from "@/lib/reseller-showcase/data";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type PreviewPlaceholderAction =
  | "reseller_preview_copy_link_placeholder"
  | "reseller_preview_disable"
  | "reseller_preview_enable"
  | "reseller_preview_expire_placeholder"
  | "reseller_preview_open_placeholder"
  | "reseller_preview_regenerate_placeholder";

type PreviewItemRecord = {
  demo_url: string | null;
  id: string;
  slug: string;
  title: string;
};

function cleanText(value: FormDataEntryValue | null, maxLength = 220) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function safeReturnPath(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.startsWith("/reseller/dashboard")) {
    return "/reseller/dashboard/previews";
  }

  return value;
}

function withStatus(path: string, key: "error" | "saved", value: string) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${key}=${encodeURIComponent(value)}`;
}

function redirectWithError(message: string, returnTo: string): never {
  redirect(withStatus(returnTo, "error", message));
}

function statusForAction(action: PreviewPlaceholderAction): ResellerPreviewStatus {
  if (action === "reseller_preview_disable") {
    return "disabled";
  }

  if (action === "reseller_preview_expire_placeholder") {
    return "expired";
  }

  return "enabled";
}

async function recordPreviewAction({
  action,
  item,
  previewUrl,
  userId
}: {
  action: PreviewPlaceholderAction;
  item: PreviewItemRecord;
  previewUrl: string;
  userId: string;
}) {
  const admin = createAdminClient();

  if (!admin) {
    return;
  }

  await admin.from("monitoring_events" as never).insert({
    entity_id: item.id,
    entity_type: "reseller_previews",
    event_status: "info",
    event_type: action,
    metadata: {
      item_name: item.title,
      preview_reference: item.id,
      preview_status: statusForAction(action),
      preview_url: previewUrl,
      privacy: "Safe reseller preview placeholder only. Private drafts remain hidden unless preview-enabled internally, no buyer/private owner data is exposed, no checkout/purchase/order/ownership transfer/wallet/payout/withdrawal/commission/fake sale was created.",
      source: "reseller_dashboard_previews"
    },
    store_id: null,
    user_id: userId,
    workspace_id: null
  } as never);
}

async function updatePreview(formData: FormData, action: PreviewPlaceholderAction) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const returnTo = safeReturnPath(formData.get("returnTo"));

  if (!user) {
    redirect("/login");
  }

  const itemId = cleanText(formData.get("itemId"));

  if (!itemId) {
    redirectWithError("Preview item could not be found.", returnTo);
  }

  const { data: profileData } = await supabase
    .from("reseller_profiles" as never)
    .select("id, slug")
    .eq("user_id", user.id)
    .maybeSingle();
  const profile = profileData as { id: string; slug: string } | null;

  if (!profile) {
    redirectWithError("Create your reseller profile before managing preview links.", returnTo);
  }

  const { data: itemData, error: itemError } = await supabase
    .from("reseller_showcase_items" as never)
    .select("id, slug, title, demo_url")
    .eq("id", itemId)
    .eq("profile_id", profile.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (itemError || !itemData) {
    redirectWithError("Preview item could not be found.", returnTo);
  }

  const item = itemData as PreviewItemRecord;
  const previewUrl = buildResellerPreviewUrl(profile.slug, item.slug);

  if (action === "reseller_preview_enable" || action === "reseller_preview_regenerate_placeholder") {
    const { error } = await supabase
      .from("reseller_showcase_items" as never)
      .update({ demo_url: previewUrl } as never)
      .eq("id", item.id)
      .eq("profile_id", profile.id)
      .eq("user_id", user.id);

    if (error) {
      redirectWithError("Preview link could not be enabled.", returnTo);
    }
  }

  if (action === "reseller_preview_disable" || action === "reseller_preview_expire_placeholder") {
    const { error } = await supabase
      .from("reseller_showcase_items" as never)
      .update({ demo_url: null } as never)
      .eq("id", item.id)
      .eq("profile_id", profile.id)
      .eq("user_id", user.id);

    if (error) {
      redirectWithError("Preview link could not be disabled.", returnTo);
    }
  }

  await recordPreviewAction({ action, item, previewUrl, userId: user.id });
  revalidatePath("/reseller/dashboard/previews");
  revalidatePath("/reseller/dashboard/listings");
  revalidatePath("/reseller/dashboard/templates");
  revalidatePath("/reseller/dashboard/showcase");
  revalidatePath(`/resellers/${profile.slug}`);
  redirect(withStatus(returnTo, "saved", action));
}

export async function enablePreviewPlaceholder(formData: FormData) {
  await updatePreview(formData, "reseller_preview_enable");
}

export async function disablePreviewPlaceholder(formData: FormData) {
  await updatePreview(formData, "reseller_preview_disable");
}

export async function copyPreviewLinkPlaceholder(formData: FormData) {
  await updatePreview(formData, "reseller_preview_copy_link_placeholder");
}

export async function openPreviewPlaceholder(formData: FormData) {
  await updatePreview(formData, "reseller_preview_open_placeholder");
}

export async function regeneratePreviewLinkPlaceholder(formData: FormData) {
  await updatePreview(formData, "reseller_preview_regenerate_placeholder");
}

export async function expirePreviewPlaceholder(formData: FormData) {
  await updatePreview(formData, "reseller_preview_expire_placeholder");
}
