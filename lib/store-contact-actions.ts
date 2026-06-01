"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  assertStoreAccessInWorkspace,
  getWorkspaceDataContext
} from "@/lib/workspaces/data-access";

const contactDashboardPath = "/dashboard/contact";

type WorkspaceStoreRow = {
  id: string;
  slug?: string | null;
};

function cleanText(value: FormDataEntryValue | null, maxLength = 4000) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanOptionalText(value: FormDataEntryValue | null, maxLength = 4000) {
  const text = cleanText(value, maxLength);
  return text || null;
}

function cleanEmail(value: FormDataEntryValue | null) {
  const email = cleanText(value, 180).toLowerCase();
  return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

function dashboardRedirect(storeId: string, status: string): never {
  const params = new URLSearchParams({ contact: status, storeId });
  redirect(`${contactDashboardPath}?${params.toString()}`);
}

function publicContactRedirect(slug: string, status: string): never {
  const params = new URLSearchParams({ contact: status });
  redirect(`/store/${slug}/contact?${params.toString()}`);
}

async function requireWorkspaceStore(formData: FormData) {
  const storeId = cleanText(formData.get("storeId"), 80);

  if (!storeId) {
    redirect(`${contactDashboardPath}?contact=missing-store`);
  }

  const { supabase, user, workspaceId } = await getWorkspaceDataContext({
    permission: "can_edit_stores",
    redirectTo: contactDashboardPath
  });
  const access = await assertStoreAccessInWorkspace({
    permission: "can_edit_stores",
    storeId,
    supabase,
    userId: user.id,
    workspaceId
  });

  if (!access.allowed) {
    dashboardRedirect(storeId, "not-authorized");
  }

  return {
    store: access.store as WorkspaceStoreRow,
    storeId,
    supabase,
    workspaceId
  };
}

function revalidateContactPaths(store: WorkspaceStoreRow) {
  revalidatePath(contactDashboardPath);

  if (store.slug) {
    revalidatePath(`/store/${store.slug}`);
    revalidatePath(`/store/${store.slug}/contact`);
  }
}

export async function updateStoreContactSettings(formData: FormData) {
  const { store, storeId, supabase, workspaceId } = await requireWorkspaceStore(formData);

  const { error } = await supabase
    .from("stores" as never)
    .update({
      business_address: cleanOptionalText(formData.get("businessAddress"), 1000),
      business_hours: cleanOptionalText(formData.get("businessHours"), 1000),
      contact_message: cleanOptionalText(formData.get("contactMessage"), 1000),
      support_email: cleanOptionalText(formData.get("contactEmail"), 180),
      support_phone: cleanOptionalText(formData.get("phone"), 80),
      whatsapp_number: cleanOptionalText(formData.get("whatsappNumber"), 80)
    } as never)
    .eq("id" as never, storeId as never)
    .eq("workspace_id" as never, workspaceId as never);

  if (error) {
    dashboardRedirect(storeId, "settings-failed");
  }

  revalidateContactPaths(store);
  dashboardRedirect(storeId, "settings-saved");
}

export async function updateStoreContactMessageStatus(formData: FormData) {
  const { store, storeId, supabase, workspaceId } = await requireWorkspaceStore(formData);
  const messageId = cleanText(formData.get("messageId"), 80);
  const status = cleanText(formData.get("status"), 20);

  if (!messageId || !["read", "archived", "new"].includes(status)) {
    dashboardRedirect(storeId, "message-update-failed");
  }

  const { error } = await supabase
    .from("store_contact_messages" as never)
    .update({
      status,
      updated_at: new Date().toISOString()
    } as never)
    .eq("id" as never, messageId as never)
    .eq("store_id" as never, storeId as never)
    .eq("workspace_id" as never, workspaceId as never);

  if (error) {
    dashboardRedirect(storeId, "message-update-failed");
  }

  revalidateContactPaths(store);
  dashboardRedirect(storeId, "message-updated");
}

export async function submitStoreContactMessage(formData: FormData) {
  const customerEmail = cleanEmail(formData.get("email"));
  const customerName = cleanText(formData.get("name"), 160);
  const honeypot = cleanText(formData.get("website"), 120);
  const message = cleanText(formData.get("message"), 4000);
  const slug = cleanText(formData.get("slug"), 120).toLowerCase();
  const storeId = cleanText(formData.get("storeId"), 80);
  const subject = cleanText(formData.get("subject"), 220);
  const submittedWorkspaceId = cleanText(formData.get("workspaceId"), 80);

  if (!slug || !storeId) {
    redirect("/store");
  }

  if (honeypot || !customerEmail || !customerName || subject.length < 2 || message.length < 10) {
    publicContactRedirect(slug, "invalid");
  }

  const admin = createAdminClient();

  if (!admin) {
    publicContactRedirect(slug, "not-configured");
  }

  const { data: storeRow } = await admin
    .from("stores" as never)
    .select("id, workspace_id, status, slug")
    .eq("id" as never, storeId as never)
    .eq("slug" as never, slug as never)
    .eq("status" as never, "published" as never)
    .maybeSingle();
  const store = storeRow as { id: string; slug: string; workspace_id?: string | null } | null;
  const workspaceId = submittedWorkspaceId || store?.workspace_id || "";

  if (!store || !workspaceId) {
    publicContactRedirect(slug, "failed");
  }

  const { error } = await admin.from("store_contact_messages" as never).insert({
    customer_email: customerEmail,
    customer_name: customerName,
    message,
    status: "new",
    store_id: storeId,
    subject,
    workspace_id: workspaceId
  } as never);

  if (error) {
    publicContactRedirect(slug, "failed");
  }

  revalidatePath(contactDashboardPath);
  publicContactRedirect(slug, "sent");
}
