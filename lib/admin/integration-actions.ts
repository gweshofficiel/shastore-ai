"use server";

import { revalidatePath } from "next/cache";
import { getAdminAccess } from "@/lib/admin-access";
import {
  runAllIntegrationHealthChecks,
  runIntegrationHealthCheck
} from "@/lib/integrations/health-engine";
import {
  markIntegrationErrorResolved,
  reopenIntegrationError
} from "@/lib/integrations/error-center";
import {
  runAllProviderDiagnostics,
  runProviderDiagnostic
} from "@/lib/integrations/provider-diagnostics";
import {
  markRotationRequired,
  markSecretRotated,
  updateSecretRotationNote
} from "@/lib/integrations/secret-rotation";
import { createAdminClient } from "@/lib/supabase/admin";

type IntegrationAction =
  | "admin_integration_clear_review"
  | "admin_integration_mark_review"
  | "admin_integration_setup_checklist_viewed"
  | "admin_integration_view_logs";

function cleanText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

async function recordIntegrationAction(formData: FormData, action: IntegrationAction) {
  const access = await getAdminAccess();
  const integrationKey = cleanText(formData.get("integrationKey"));
  const integrationName = cleanText(formData.get("integrationName"));
  const category = cleanText(formData.get("category"));

  if (!integrationKey) {
    throw new Error("Missing integration key.");
  }

  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for integration controls.");
  }

  await admin.from("monitoring_events" as never).insert({
    entity_id: null,
    entity_type: "admin_platform_integration",
    event_status: "info",
    event_type: action,
    metadata: {
      category,
      integration_key: integrationKey,
      integration_name: integrationName,
      note: "Placeholder integration control only. No external API was called and no secrets were read.",
      source: "super_admin_platform_integrations_center"
    },
    store_id: null,
    user_id: access.user.id,
    workspace_id: null
  } as never);

  revalidatePath("/admin/integrations");
}

export async function markIntegrationUnderReview(formData: FormData) {
  await recordIntegrationAction(formData, "admin_integration_mark_review");
}

export async function clearIntegrationReview(formData: FormData) {
  await recordIntegrationAction(formData, "admin_integration_clear_review");
}

export async function viewIntegrationLogs(formData: FormData) {
  await recordIntegrationAction(formData, "admin_integration_view_logs");
}

export async function viewIntegrationSetupChecklist(formData: FormData) {
  await recordIntegrationAction(formData, "admin_integration_setup_checklist_viewed");
}

export async function checkIntegrationProvider(formData: FormData) {
  await runIntegrationHealthCheck(cleanText(formData.get("integrationKey")));
  revalidatePath("/admin/integrations");
}

export async function checkAllIntegrationProviders() {
  await runAllIntegrationHealthChecks();
  revalidatePath("/admin/integrations");
}

export async function markIntegrationErrorResolvedAction(formData: FormData) {
  await markIntegrationErrorResolved(
    cleanText(formData.get("errorId")),
    cleanText(formData.get("resolutionNote"))
  );
  revalidatePath("/admin/integrations");
}

export async function reopenIntegrationErrorAction(formData: FormData) {
  await reopenIntegrationError(cleanText(formData.get("errorId")));
  revalidatePath("/admin/integrations");
}

export async function testIntegrationConnectionAction(formData: FormData) {
  await runProviderDiagnostic(cleanText(formData.get("integrationKey")));
  revalidatePath("/admin/integrations");
}

export async function syncIntegrationProviderStatusAction(formData: FormData) {
  await runProviderDiagnostic(cleanText(formData.get("integrationKey")));
  revalidatePath("/admin/integrations");
}

export async function runAllProviderDiagnosticsAction() {
  await runAllProviderDiagnostics();
  revalidatePath("/admin/integrations");
}

export async function markSecretRotatedAction(formData: FormData) {
  await markSecretRotated({
    nextRotationDueAt: cleanText(formData.get("nextRotationDueAt")),
    providerKey: cleanText(formData.get("providerKey")),
    rotationNote: cleanText(formData.get("rotationNote")),
    secretKeyName: cleanText(formData.get("secretKeyName"))
  });
  revalidatePath("/admin/integrations");
}

export async function markRotationRequiredAction(formData: FormData) {
  await markRotationRequired({
    nextRotationDueAt: cleanText(formData.get("nextRotationDueAt")),
    providerKey: cleanText(formData.get("providerKey")),
    rotationNote: cleanText(formData.get("rotationNote")),
    secretKeyName: cleanText(formData.get("secretKeyName"))
  });
  revalidatePath("/admin/integrations");
}

export async function updateSecretRotationNoteAction(formData: FormData) {
  await updateSecretRotationNote({
    providerKey: cleanText(formData.get("providerKey")),
    rotationNote: cleanText(formData.get("rotationNote")),
    secretKeyName: cleanText(formData.get("secretKeyName"))
  });
  revalidatePath("/admin/integrations");
}
