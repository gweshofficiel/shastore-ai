"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type StoreActivationView = {
  activation_status: "pending" | "activated" | "expired" | "cancelled" | "not_found";
  buyer_email: string | null;
  buyer_name: string | null;
  expires_at: string | null;
  store_instance_id: string | null;
  store_name: string | null;
  store_slug: string | null;
  transfer_code: string | null;
  target_account_id: string | null;
  target_account_lookup_status: string | null;
};

function cleanToken(value: string) {
  return value.trim().slice(0, 80);
}

export async function getStoreActivationByToken(token: string): Promise<StoreActivationView | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_store_activation_by_token" as never, {
    candidate_token: cleanToken(token)
  } as never);

  if (error || !Array.isArray(data) || !data[0]) {
    return null;
  }

  return data[0] as StoreActivationView;
}

export async function activateStoreByToken(formData: FormData) {
  const token = typeof formData.get("token") === "string" ? cleanToken(String(formData.get("token"))) : "";

  if (!token) {
    redirect("/activate-store/invalid?error=missing-token");
  }

  const supabase = await createClient();
  const { data } = await supabase.rpc("activate_store_by_token" as never, {
    candidate_token: token
  } as never);
  const result = Array.isArray(data)
    ? (data[0] as { activation_status?: string; store_slug?: string | null } | undefined)
    : null;

  redirect(
    `/activate-store/${encodeURIComponent(token)}?status=${encodeURIComponent(
      result?.activation_status ?? "not_found"
    )}`
  );
}
