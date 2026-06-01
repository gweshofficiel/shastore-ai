"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  assertStoreAccessInWorkspace,
  getWorkspaceDataContext
} from "@/lib/workspaces/data-access";

const qaDashboardPath = "/dashboard/product-qa";

function cleanText(value: FormDataEntryValue | null, maxLength = 2000) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function cleanEmail(value: FormDataEntryValue | null) {
  const email = cleanText(value, 180).toLowerCase();
  return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

function publicQuestionRedirect(slug: string, productId: string, status: string): never {
  const params = new URLSearchParams({ question: status });
  redirect(`/store/${slug}/product/${encodeURIComponent(productId)}?${params.toString()}`);
}

function dashboardRedirect(storeId: string, status: string): never {
  const params = new URLSearchParams({ qa: status, storeId });
  redirect(`${qaDashboardPath}?${params.toString()}`);
}

function isSpamLikeQuestion(question: string) {
  const urlMatches = question.match(/https?:\/\/|www\./gi) ?? [];
  const repeatedCharacters = /(.)\1{8,}/.test(question);
  const mostlySymbols = question.length > 0 && question.replace(/[^a-z0-9]/gi, "").length < 6;

  return urlMatches.length > 1 || repeatedCharacters || mostlySymbols;
}

function questionStatus(value: FormDataEntryValue | null) {
  const status = cleanText(value, 20);
  return status === "approved" || status === "hidden" ? status : "pending";
}

export async function submitProductQuestion(formData: FormData) {
  const customerEmail = cleanEmail(formData.get("customerEmail"));
  const customerName = cleanText(formData.get("customerName"), 120);
  const honeypot = cleanText(formData.get("website"), 120);
  const productId = cleanText(formData.get("productId"), 80);
  const questionText = cleanText(formData.get("questionText"), 2000);
  const slug = cleanText(formData.get("slug"), 120).toLowerCase();
  const storeId = cleanText(formData.get("storeId"), 80);
  const submittedWorkspaceId = cleanText(formData.get("workspaceId"), 80);

  if (!slug || !productId || !storeId) {
    redirect("/store");
  }

  if (honeypot || questionText.length < 10 || isSpamLikeQuestion(questionText)) {
    publicQuestionRedirect(slug, productId, "invalid");
  }

  const admin = createAdminClient();

  if (!admin) {
    publicQuestionRedirect(slug, productId, "not-configured");
  }

  const { data: storeRow } = await admin
    .from("stores" as never)
    .select("id, workspace_id, status")
    .eq("id" as never, storeId as never)
    .eq("slug" as never, slug as never)
    .eq("status" as never, "published" as never)
    .maybeSingle();
  const store = storeRow as { id: string; workspace_id?: string | null } | null;
  const workspaceId = submittedWorkspaceId || store?.workspace_id || "";

  if (!store || !workspaceId) {
    publicQuestionRedirect(slug, productId, "failed");
  }

  const { data: productRow } = await admin
    .from("store_products" as never)
    .select("id")
    .eq("id" as never, productId as never)
    .eq("store_id" as never, storeId as never)
    .eq("status" as never, "active" as never)
    .maybeSingle();

  if (!productRow) {
    publicQuestionRedirect(slug, productId, "failed");
  }

  const { error } = await admin.from("product_questions" as never).insert({
    customer_email: customerEmail || null,
    customer_name: customerName || null,
    product_id: productId,
    question_text: questionText,
    status: "pending",
    store_id: storeId,
    workspace_id: workspaceId
  } as never);

  if (error) {
    publicQuestionRedirect(slug, productId, "failed");
  }

  revalidatePath(`/store/${slug}/product/${productId}`);
  revalidatePath(qaDashboardPath);
  publicQuestionRedirect(slug, productId, "submitted");
}

export async function moderateProductQuestion(formData: FormData) {
  const answerText = cleanText(formData.get("answerText"), 4000);
  const productId = cleanText(formData.get("productId"), 80);
  const questionId = cleanText(formData.get("questionId"), 80);
  const storeId = cleanText(formData.get("storeId"), 80);
  const status = questionStatus(formData.get("status"));

  if (!questionId || !storeId) {
    redirect(`${qaDashboardPath}?qa=missing-question`);
  }

  if (status === "approved" && answerText.length < 2) {
    dashboardRedirect(storeId, "answer-required");
  }

  const { supabase, user, workspaceId } = await getWorkspaceDataContext({
    permission: "manage_products",
    redirectTo: qaDashboardPath
  });
  const access = await assertStoreAccessInWorkspace({
    permission: "manage_products",
    storeId,
    supabase,
    userId: user.id,
    workspaceId
  });

  if (!access.allowed) {
    dashboardRedirect(storeId, "not-authorized");
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("product_questions" as never)
    .update({
      answer_text: answerText || null,
      answered_at: answerText ? now : null,
      moderated_at: now,
      status,
      updated_at: now
    } as never)
    .eq("id" as never, questionId as never)
    .eq("store_id" as never, storeId as never)
    .eq("workspace_id" as never, workspaceId as never);

  if (error) {
    dashboardRedirect(storeId, "moderation-failed");
  }

  revalidatePath(qaDashboardPath);

  if (productId) {
    revalidatePath(`/dashboard/products`);
  }

  dashboardRedirect(storeId, status);
}
