"use server";

import { revalidatePath } from "next/cache";
import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";

type PlatformMarketingAction =
  | "admin_platform_marketing_activate_campaign"
  | "admin_platform_marketing_archive_campaign"
  | "admin_platform_marketing_create_draft"
  | "admin_platform_marketing_pause_campaign"
  | "admin_platform_marketing_view_usage";

function cleanText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

async function recordPlatformMarketingAction(formData: FormData, action: PlatformMarketingAction) {
  const access = await getAdminAccess();
  const campaignId = cleanText(formData.get("campaignId"));
  const campaignName = cleanText(formData.get("campaignName"));
  const campaignType = cleanText(formData.get("campaignType"));

  if (!campaignId) {
    throw new Error("Missing platform marketing campaign id.");
  }

  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for platform marketing controls.");
  }

  await admin.from("monitoring_events" as never).insert({
    entity_id: null,
    entity_type: "admin_platform_marketing",
    event_status: "info",
    event_type: action,
    metadata: {
      campaign_id: campaignId,
      campaign_name: campaignName,
      campaign_type: campaignType,
      note: "Placeholder platform marketing action only. No store coupon, store discount campaign, store email campaign, mass send, redemption, or payout was modified.",
      source: "super_admin_platform_marketing_center"
    },
    store_id: null,
    user_id: access.user.id,
    workspace_id: null
  } as never);

  revalidatePath("/admin/marketing");
}

export async function createMarketingDraftPlaceholder(formData: FormData) {
  await recordPlatformMarketingAction(formData, "admin_platform_marketing_create_draft");
}

export async function pauseMarketingCampaign(formData: FormData) {
  await recordPlatformMarketingAction(formData, "admin_platform_marketing_pause_campaign");
}

export async function activateMarketingCampaignPlaceholder(formData: FormData) {
  await recordPlatformMarketingAction(formData, "admin_platform_marketing_activate_campaign");
}

export async function archiveMarketingCampaignPlaceholder(formData: FormData) {
  await recordPlatformMarketingAction(formData, "admin_platform_marketing_archive_campaign");
}

export async function viewMarketingUsagePlaceholder(formData: FormData) {
  await recordPlatformMarketingAction(formData, "admin_platform_marketing_view_usage");
}
