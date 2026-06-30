"use server";

import { revalidatePath } from "next/cache";
import {
  buildSecurityMarkReviewedIdleResult,
  runSecurityMarkReviewed,
  type SecurityMarkReviewedResult
} from "@/src/lib/security/security-mark-reviewed-runtime";

function cleanText(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function markSecurityEventReviewedAction(
  formData: FormData
): Promise<SecurityMarkReviewedResult> {
  const eventId = cleanText(formData.get("eventId"));
  const eventType = cleanText(formData.get("eventType"));
  const confirmed = cleanText(formData.get("confirm"));

  if (confirmed !== "true") {
    return {
      ...buildSecurityMarkReviewedIdleResult(),
      message: "Mark Reviewed requires explicit confirmation before it can run."
    };
  }

  const result = await runSecurityMarkReviewed({ eventId, eventType });

  if (result.ok) {
    revalidatePath("/admin/security");
  }

  return result;
}

export async function markSecurityEventReviewedFormState(
  _previousState: SecurityMarkReviewedResult,
  formData: FormData
): Promise<SecurityMarkReviewedResult> {
  return markSecurityEventReviewedAction(formData);
}
