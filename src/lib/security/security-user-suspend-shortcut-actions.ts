"use server";

import { revalidatePath } from "next/cache";
import {
  buildSecurityUserSuspendIdleResult,
  runSecurityUserSuspendShortcut,
  type SecurityUserSuspendResult
} from "@/src/lib/security/security-user-suspend-shortcut-runtime";

function cleanText(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function suspendSecurityUserShortcutAction(
  formData: FormData
): Promise<SecurityUserSuspendResult> {
  const userId = cleanText(formData.get("userId"));
  const confirmed = cleanText(formData.get("confirm"));
  const confirmationToken = cleanText(formData.get("confirmationToken"));

  if (confirmed !== "true") {
    return {
      ...buildSecurityUserSuspendIdleResult(),
      message: "User Suspend Shortcut requires explicit confirmation before it can run.",
      userId
    };
  }

  const result = await runSecurityUserSuspendShortcut({ confirmationToken, userId });

  if (result.ok) {
    revalidatePath("/admin/security");
  }

  return result;
}

export async function suspendSecurityUserShortcutFormState(
  _previousState: SecurityUserSuspendResult,
  formData: FormData
): Promise<SecurityUserSuspendResult> {
  return suspendSecurityUserShortcutAction(formData);
}
