"use server";

import { revalidatePath } from "next/cache";
import {
  buildSecurityClearRiskIdleResult,
  runSecurityClearRisk,
  type SecurityClearRiskResult
} from "@/src/lib/security/security-clear-risk-runtime";

function cleanText(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function clearSecurityEventRiskAction(
  formData: FormData
): Promise<SecurityClearRiskResult> {
  const eventId = cleanText(formData.get("eventId"));
  const eventType = cleanText(formData.get("eventType"));
  const confirmed = cleanText(formData.get("confirm"));

  if (confirmed !== "true") {
    return {
      ...buildSecurityClearRiskIdleResult(),
      message: "Clear Risk requires explicit confirmation before it can run."
    };
  }

  const result = await runSecurityClearRisk({ eventId, eventType });

  if (result.ok) {
    revalidatePath("/admin/security");
  }

  return result;
}

export async function clearSecurityEventRiskFormState(
  _previousState: SecurityClearRiskResult,
  formData: FormData
): Promise<SecurityClearRiskResult> {
  return clearSecurityEventRiskAction(formData);
}
