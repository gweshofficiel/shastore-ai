import { createClient } from "@/lib/supabase/server";
import type {
  ResellerBusinessData,
  ResellerBusinessSettings
} from "@/lib/reseller-business/types";

function isMissingResellerBusinessTable(error: { code?: string; message?: string } | null) {
  const message = (error?.message ?? "").toLowerCase();

  return (
    error?.code === "PGRST205" ||
    error?.code === "PGRST204" ||
    message.includes("reseller_business_settings") ||
    message.includes("could not find the table")
  );
}

export async function getResellerBusinessSettings(): Promise<ResellerBusinessData> {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { ready: true, settings: null };
  }

  const { data, error } = await supabase
    .from("reseller_business_settings" as never)
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return { ready: !isMissingResellerBusinessTable(error), settings: null };
  }

  return {
    ready: true,
    settings: (data as ResellerBusinessSettings | null) ?? null
  };
}

export function resellerBusinessMigrationMessage() {
  return "Apply supabase/migrations/reseller-business-settings-safe.sql to enable reseller business and store delivery settings.";
}
