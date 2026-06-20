"use server";

import {
  createFallbackAdminEmailControl,
  getAdminEmailControl,
  type AdminEmailControl
} from "@/lib/admin/data";

const EMAIL_LOAD_TIMEOUT_MS = 15_000;

export type PlatformEmailControlLoadResult = {
  control: AdminEmailControl;
  ok: boolean;
  warning?: string;
};

function withEmailLoadTimeout<T>(promise: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Email data load timed out after 15 seconds."));
    }, EMAIL_LOAD_TIMEOUT_MS);

    void promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

export async function loadPlatformEmailControlSafe(): Promise<PlatformEmailControlLoadResult> {
  try {
    const result = await withEmailLoadTimeout(getAdminEmailControl());

    if (result.runtimeWarning) {
      return {
        control: result,
        ok: false,
        warning: result.runtimeWarning
      };
    }

    return { control: result, ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[loadPlatformEmailControlSafe] email control load failed", error);

    return {
      control: createFallbackAdminEmailControl(),
      ok: false,
      warning: message
    };
  }
}
