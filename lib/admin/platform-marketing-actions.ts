"use server";

import { revalidatePath } from "next/cache";
import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  assertMarketingLifecycleActionReady,
  canRecordMarketingPlatformAction,
  isValidMarketingActionType,
  isValidMarketingRegistryKey,
  sanitizeMarketingSecurityText
} from "@/src/lib/marketing/marketing-security-certification";

type PlatformMarketingAction =
  | "admin_platform_marketing_activate_campaign"
  | "admin_platform_marketing_archive_campaign"
  | "admin_platform_marketing_create_draft"
  | "admin_platform_marketing_pause_campaign"
  | "admin_platform_marketing_view_usage";

function cleanFormText(value: FormDataEntryValue | null, maxLength = 200) {
  return sanitizeMarketingSecurityText(typeof value === "string" ? value : "", maxLength);
}

async function recordPlatformMarketingAction(formData: FormData, action: PlatformMarketingAction) {
  const access = await getAdminAccess();

  if (!canRecordMarketingPlatformAction(access)) {
    throw new Error("Marketing platform actions require marketing operator or super admin access.");
  }

  const campaignId = cleanFormText(formData.get("campaignId"), 160);
  const campaignName = cleanFormText(formData.get("campaignName"), 200);
  const campaignType = cleanFormText(formData.get("campaignType"), 40);
  const campaignStatus = cleanFormText(formData.get("campaignStatus"), 40);

  if (!isValidMarketingRegistryKey(campaignId)) {
    throw new Error("Invalid platform marketing campaign id.");
  }

  if (campaignType && !isValidMarketingActionType(campaignType)) {
    throw new Error("Invalid platform marketing campaign type.");
  }

  assertMarketingLifecycleActionReady({
    action,
    status: campaignStatus || "draft"
  });

  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for platform marketing controls.");
  }

  const { data: registryRow, error: registryError } = await admin
    .from("marketing_registry_items")
    .select("registry_key, marketing_type, status")
    .eq("registry_key", campaignId)
    .maybeSingle();

  if (registryError) {
    throw new Error("Unable to verify platform marketing campaign safely.");
  }

  const registryItem = registryRow as
    | {
        marketing_type: string;
        registry_key: string;
        status: string;
      }
    | null;

  if (!registryItem) {
    throw new Error("Unknown platform marketing campaign.");
  }

  if (campaignType && registryItem.marketing_type !== campaignType) {
    throw new Error("Platform marketing campaign type mismatch.");
  }

  await admin.from("monitoring_events" as never).insert({
    entity_id: null,
    entity_type: "admin_platform_marketing",
    event_status: "info",
    event_type: action,
    metadata: {
      campaign_id: campaignId,
      campaign_name: campaignName || sanitizeMarketingSecurityText(registryItem.registry_key, 200),
      campaign_status: sanitizeMarketingSecurityText(registryItem.status, 40) || "draft",
      campaign_type: sanitizeMarketingSecurityText(registryItem.marketing_type, 40),
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
