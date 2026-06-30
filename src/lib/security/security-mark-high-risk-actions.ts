"use server";

import { revalidatePath } from "next/cache";
import {
  buildSecurityMarkHighRiskIdleResult,
  runSecurityMarkHighRisk,
  type SecurityMarkHighRiskResult
} from "@/src/lib/security/security-mark-high-risk-runtime";

function cleanText(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function markSecurityEventHighRiskAction(
  formData: FormData
): Promise<SecurityMarkHighRiskResult> {
  const eventId = cleanText(formData.get("eventId"));
  const eventType = cleanText(formData.get("eventType"));
  const confirmed = cleanText(formData.get("confirm"));

  if (confirmed !== "true") {
    return {
      ...buildSecurityMarkHighRiskIdleResult(),
      message: "Mark High Risk requires explicit confirmation before it can run."
    };
  }

  const result = await runSecurityMarkHighRisk({ eventId, eventType });

  if (result.ok) {
    revalidatePath("/admin/security");
  }

  return result;
}

export async function markSecurityEventHighRiskFormState(
  _previousState: SecurityMarkHighRiskResult,
  formData: FormData
): Promise<SecurityMarkHighRiskResult> {
  return markSecurityEventHighRiskAction(formData);
}
