"use server";

import { revalidatePath } from "next/cache";
import {
  buildSecurityStoreSuspendIdleResult,
  runSecurityStoreSuspendShortcut,
  type SecurityStoreSuspendResult
} from "@/src/lib/security/security-store-suspend-shortcut-runtime";

function cleanText(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function suspendSecurityStoreShortcutAction(
  formData: FormData
): Promise<SecurityStoreSuspendResult> {
  const storeId = cleanText(formData.get("storeId"));
  const confirmed = cleanText(formData.get("confirm"));
  const confirmationToken = cleanText(formData.get("confirmationToken"));

  if (confirmed !== "true") {
    return {
      ...buildSecurityStoreSuspendIdleResult(),
      message: "Store Suspend Shortcut requires explicit confirmation before it can run.",
      storeId
    };
  }

  const result = await runSecurityStoreSuspendShortcut({ confirmationToken, storeId });

  if (result.ok) {
    revalidatePath("/admin/security");
  }

  return result;
}

export async function suspendSecurityStoreShortcutFormState(
  _previousState: SecurityStoreSuspendResult,
  formData: FormData
): Promise<SecurityStoreSuspendResult> {
  return suspendSecurityStoreShortcutAction(formData);
}
