"use server";

import {
  createFallbackAdminPlatformMarketingControl,
  getAdminPlatformMarketingControl,
  type AdminPlatformMarketingControl
} from "@/lib/admin/data";

const MARKETING_LOAD_TIMEOUT_MS = 15_000;

export type PlatformMarketingControlLoadResult = {
  control: AdminPlatformMarketingControl;
  ok: boolean;
  warning?: string;
};

function withMarketingLoadTimeout<T>(promise: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Marketing data load timed out after 15 seconds."));
    }, MARKETING_LOAD_TIMEOUT_MS);

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

export async function loadPlatformMarketingControlSafe(): Promise<PlatformMarketingControlLoadResult> {
  try {
    const result = await withMarketingLoadTimeout(getAdminPlatformMarketingControl());

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
    console.error("[loadPlatformMarketingControlSafe] marketing control load failed", error);

    return {
      control: createFallbackAdminPlatformMarketingControl(),
      ok: false,
      warning: message
    };
  }
}
