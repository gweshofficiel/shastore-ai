"use server";

import {
  createFallbackAdminNotificationControl,
  getAdminNotificationControl,
  type AdminNotificationControl
} from "@/lib/admin/data";

const NOTIFICATION_LOAD_TIMEOUT_MS = 15_000;

export type PlatformNotificationControlLoadResult = {
  control: AdminNotificationControl;
  ok: boolean;
  warning?: string;
};

function withNotificationLoadTimeout<T>(promise: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Notification data load timed out after 15 seconds."));
    }, NOTIFICATION_LOAD_TIMEOUT_MS);

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

export async function loadPlatformNotificationControlSafe(): Promise<PlatformNotificationControlLoadResult> {
  try {
    const result = await withNotificationLoadTimeout(getAdminNotificationControl());

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
    console.error("[loadPlatformNotificationControlSafe] notification control load failed", error);

    return {
      control: createFallbackAdminNotificationControl(),
      ok: false,
      warning: message
    };
  }
}
