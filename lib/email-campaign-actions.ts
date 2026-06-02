"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  assertStoreAccessInWorkspace,
  getWorkspaceDataContext
} from "@/lib/workspaces/data-access";
import type { Json } from "@/types/database";

const campaignsPath = "/dashboard/email-campaigns";

type CampaignSegment =
  | "all_customers"
  | "new_customers"
  | "returning_customers"
  | "vip_customers"
  | "digital_product_customers";

type StoreCustomerRow = {
  email?: string | null;
  id: string;
  name?: string | null;
  normalized_email?: string | null;
  segment?: string | null;
  total_orders?: number | null;
  total_spent?: number | string | null;
};

type CampaignRow = {
  campaign_name: string;
  content: string;
  id: string;
  status: string;
  store_id: string;
  subject: string;
  target_segment: CampaignSegment;
  workspace_id: string;
};

function cleanText(value: FormDataEntryValue | null, maxLength = 2000) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanEmail(value: string | null | undefined) {
  const email = (value ?? "").trim().toLowerCase();
  return email.includes("@") ? email.slice(0, 180) : "";
}

function numericValue(value: number | string | null | undefined) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function normalizeSegment(value: FormDataEntryValue | null): CampaignSegment {
  const segment = cleanText(value, 60);

  return segment === "new_customers" ||
    segment === "returning_customers" ||
    segment === "vip_customers" ||
    segment === "digital_product_customers"
    ? segment
    : "all_customers";
}

function campaignsRedirect(storeId: string, status: string): never {
  const params = new URLSearchParams({ campaigns: status, storeId });
  redirect(`${campaignsPath}?${params.toString()}`);
}

async function requireCampaignStore(storeId: string) {
  const { supabase, user, workspaceId } = await getWorkspaceDataContext({
    permission: "can_view_notifications",
    redirectTo: campaignsPath
  });
  const access = await assertStoreAccessInWorkspace({
    permission: "can_view_notifications",
    storeId,
    supabase,
    userId: user.id,
    workspaceId
  });

  if (!access.allowed) {
    campaignsRedirect(storeId, "not-authorized");
  }

  return { supabase, workspaceId };
}

function customerMatchesSegment(customer: StoreCustomerRow, segment: CampaignSegment, digitalCustomerIds: Set<string>) {
  if (segment === "all_customers") {
    return true;
  }

  if (segment === "new_customers") {
    return (customer.segment ?? "new") === "new" || (customer.total_orders ?? 0) <= 1;
  }

  if (segment === "returning_customers") {
    return (customer.segment === "returning" || (customer.total_orders ?? 0) >= 2) && customer.segment !== "vip";
  }

  if (segment === "vip_customers") {
    return customer.segment === "vip" || (customer.total_orders ?? 0) >= 10 || numericValue(customer.total_spent) >= 1000;
  }

  return digitalCustomerIds.has(customer.id);
}

function storeOrderHasDigitalItems(value: unknown) {
  if (!Array.isArray(value)) {
    return false;
  }

  return value.some((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return false;
    }

    const record = item as Record<string, unknown>;
    return (
      record.productType === "digital" ||
      record.product_type === "digital" ||
      Boolean(record.digitalDeliveryStatus) ||
      Boolean(record.digitalFileName)
    );
  });
}

async function digitalCustomerIdsForStore({
  storeId,
  supabase,
  workspaceId
}: {
  storeId: string;
  supabase: Awaited<ReturnType<typeof getWorkspaceDataContext>>["supabase"];
  workspaceId: string;
}) {
  const { data: customers } = await supabase
    .from("store_customers" as never)
    .select("id, email, normalized_email")
    .eq("workspace_id" as never, workspaceId as never)
    .eq("store_id" as never, storeId as never);
  const emailToCustomerId = new Map(
    ((customers ?? []) as unknown as StoreCustomerRow[])
      .map((customer) => [cleanEmail(customer.normalized_email || customer.email), customer.id] as const)
      .filter(([email]) => Boolean(email))
  );
  const { data: orders } = await supabase
    .from("store_orders" as never)
    .select("customer_email, items")
    .eq("workspace_id" as never, workspaceId as never)
    .eq("store_id" as never, storeId as never);
  const customerIds = new Set<string>();

  for (const order of (orders ?? []) as unknown as Array<{ customer_email?: string | null; items?: Json }>) {
    if (!storeOrderHasDigitalItems(order.items)) {
      continue;
    }

    const customerId = emailToCustomerId.get(cleanEmail(order.customer_email));

    if (customerId) {
      customerIds.add(customerId);
    }
  }

  return customerIds;
}

export async function createEmailCampaignAction(formData: FormData) {
  const storeId = cleanText(formData.get("storeId"), 80);
  const campaignName = cleanText(formData.get("campaignName"), 180);
  const subject = cleanText(formData.get("subject"), 240);
  const content = cleanText(formData.get("content"), 8000);
  const targetSegment = normalizeSegment(formData.get("targetSegment"));

  if (!storeId || !campaignName || !subject || !content) {
    campaignsRedirect(storeId, "invalid");
  }

  const { supabase, workspaceId } = await requireCampaignStore(storeId);
  const { error } = await supabase.from("email_campaigns" as never).insert({
    campaign_name: campaignName,
    content,
    status: "draft",
    store_id: storeId,
    subject,
    target_segment: targetSegment,
    workspace_id: workspaceId
  } as never);

  if (error) {
    campaignsRedirect(storeId, "create-failed");
  }

  revalidatePath(campaignsPath);
  campaignsRedirect(storeId, "created");
}

export async function sendEmailCampaignAction(formData: FormData) {
  const campaignId = cleanText(formData.get("campaignId"), 80);
  const storeId = cleanText(formData.get("storeId"), 80);

  if (!campaignId || !storeId) {
    campaignsRedirect(storeId, "missing-campaign");
  }

  const { supabase, workspaceId } = await requireCampaignStore(storeId);
  const { data: campaignRow } = await supabase
    .from("email_campaigns" as never)
    .select("id, workspace_id, store_id, campaign_name, subject, content, target_segment, status")
    .eq("id" as never, campaignId as never)
    .eq("workspace_id" as never, workspaceId as never)
    .eq("store_id" as never, storeId as never)
    .maybeSingle();
  const campaign = campaignRow as CampaignRow | null;

  if (!campaign) {
    campaignsRedirect(storeId, "missing-campaign");
  }

  if (campaign.status === "sent") {
    campaignsRedirect(storeId, "already-sent");
  }

  const { data: customers } = await supabase
    .from("store_customers" as never)
    .select("id, name, email, normalized_email, segment, total_orders, total_spent")
    .eq("workspace_id" as never, workspaceId as never)
    .eq("store_id" as never, storeId as never);
  const digitalCustomerIds = campaign.target_segment === "digital_product_customers"
    ? await digitalCustomerIdsForStore({ storeId, supabase, workspaceId })
    : new Set<string>();
  const recipientsByEmail = new Map<string, StoreCustomerRow>();

  for (const customer of (customers ?? []) as unknown as StoreCustomerRow[]) {
    if (!customerMatchesSegment(customer, campaign.target_segment, digitalCustomerIds)) {
      continue;
    }

    const email = cleanEmail(customer.normalized_email || customer.email);

    if (email) {
      recipientsByEmail.set(email, customer);
    }
  }

  if (!recipientsByEmail.size) {
    campaignsRedirect(storeId, "no-recipients");
  }

  const now = new Date().toISOString();
  let queuedCount = 0;

  for (const [recipientEmail, customer] of recipientsByEmail.entries()) {
    const { data: existingRecipient } = await supabase
      .from("email_campaign_recipients" as never)
      .select("id")
      .eq("campaign_id" as never, campaign.id as never)
      .eq("recipient_email" as never, recipientEmail as never)
      .maybeSingle();

    if (existingRecipient) {
      continue;
    }

    const { data: recipientRow, error: recipientInsertError } = await supabase
      .from("email_campaign_recipients" as never)
      .insert({
        campaign_id: campaign.id,
        customer_id: customer.id,
        customer_name: customer.name ?? null,
        recipient_email: recipientEmail,
        status: "pending",
        store_id: storeId,
        workspace_id: workspaceId
      } as never)
      .select("id")
      .maybeSingle();

    if (recipientInsertError || !recipientRow) {
      continue;
    }

    const recipientId = (recipientRow as { id: string }).id;
    const { data: eventRow, error: eventError } = await supabase
      .from("email_event_logs" as never)
      .insert({
        metadata: {
          campaignContent: campaign.content,
          campaignId: campaign.id,
          campaignName: campaign.campaign_name,
          campaignRecipientId: recipientId,
          campaignSubject: campaign.subject,
          customerId: customer.id,
          customerName: customer.name ?? "Customer",
          targetSegment: campaign.target_segment
        } as Json,
        recipient: recipientEmail,
        status: "pending",
        store_id: storeId,
        subject: campaign.subject,
        template_key: "email_campaign",
        workspace_id: workspaceId
      } as never)
      .select("id")
      .maybeSingle();

    if (eventError || !eventRow) {
      await supabase
        .from("email_campaign_recipients" as never)
        .update({ status: "failed" } as never)
        .eq("id" as never, recipientId as never)
        .eq("workspace_id" as never, workspaceId as never)
        .eq("store_id" as never, storeId as never);
      continue;
    }

    await supabase
      .from("email_campaign_recipients" as never)
      .update({
        email_event_log_id: (eventRow as { id: string }).id,
        queued_at: now,
        status: "queued"
      } as never)
      .eq("id" as never, recipientId as never)
      .eq("workspace_id" as never, workspaceId as never)
      .eq("store_id" as never, storeId as never);
    queuedCount += 1;
  }

  if (!queuedCount) {
    campaignsRedirect(storeId, "duplicate");
  }

  await supabase
    .from("email_campaigns" as never)
    .update({
      recipient_count: queuedCount,
      sent_at: now,
      status: "sent"
    } as never)
    .eq("id" as never, campaign.id as never)
    .eq("workspace_id" as never, workspaceId as never)
    .eq("store_id" as never, storeId as never);

  revalidatePath(campaignsPath);
  revalidatePath("/dashboard/email");
  campaignsRedirect(storeId, "sent");
}
