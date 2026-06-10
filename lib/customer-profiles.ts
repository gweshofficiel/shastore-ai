import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeCustomerPhone } from "@/lib/customer-account";

export type CustomerProfile = {
  email: string;
  id: string;
  name: string | null;
  phone: string;
  user_id: string;
};

function normalizeEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function fallbackName(email: string) {
  return email.split("@")[0]?.replace(/[._-]+/g, " ").trim() || "Customer";
}

function toCustomerProfile(row: Record<string, unknown>): CustomerProfile {
  return {
    email: String(row.email ?? ""),
    id: String(row.id),
    name: typeof row.name === "string" ? row.name : null,
    phone: String(row.phone ?? ""),
    user_id: String(row.user_id)
  };
}

export async function ensureCustomerProfileForUser({
  email,
  name,
  phone,
  userId
}: {
  email: string | null | undefined;
  name?: string | null;
  phone: string | null | undefined;
  userId: string;
}) {
  const admin = createAdminClient();
  const normalizedEmail = normalizeEmail(email);
  const normalizedPhone = normalizeCustomerPhone(phone);

  if (!admin || !normalizedEmail || !normalizedPhone) {
    console.warn("[customer-profile] profile creation unavailable", {
      hasAdminClient: Boolean(admin),
      hasEmail: Boolean(normalizedEmail),
      hasPhone: Boolean(normalizedPhone),
      userId
    });
    return null;
  }

  const { data, error } = await admin
    .from("customer_profiles" as never)
    .upsert(
      {
        email: normalizedEmail,
        name: name?.trim() || fallbackName(normalizedEmail),
        phone: normalizedPhone,
        user_id: userId
      } as never,
      { onConflict: "user_id" } as never
    )
    .select("*")
    .single();

  if (error) {
    console.warn("[customer-profile] profile upsert failed", {
      code: error.code,
      message: error.message,
      userId
    });
    return null;
  }

  return toCustomerProfile(data as unknown as Record<string, unknown>);
}

export async function getCustomerProfileForUser(userId: string) {
  const admin = createAdminClient();

  if (!admin) {
    return null;
  }

  const { data, error } = await admin
    .from("customer_profiles" as never)
    .select("*")
    .eq("user_id" as never, userId as never)
    .maybeSingle();

  if (error) {
    console.warn("[customer-profile] profile lookup failed", {
      code: error.code,
      message: error.message,
      userId
    });
    return null;
  }

  return data ? toCustomerProfile(data as unknown as Record<string, unknown>) : null;
}

export function customerNameFromUser(user: User) {
  return typeof user.user_metadata?.name === "string"
    ? user.user_metadata.name
    : typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : null;
}

export async function linkStoreCustomersForUser({
  email,
  phone,
  userId
}: {
  email: string;
  phone: string;
  userId: string;
}) {
  const admin = createAdminClient();
  const normalizedEmail = normalizeEmail(email);
  const normalizedPhone = normalizeCustomerPhone(phone);

  if (!admin || (!normalizedEmail && !normalizedPhone)) {
    return;
  }

  const { data, error } = await admin
    .from("store_customers" as never)
    .select("id, metadata")
    .or(
      [
        normalizedEmail ? `normalized_email.eq.${normalizedEmail}` : "",
        normalizedPhone ? `normalized_phone.eq.${normalizedPhone}` : ""
      ].filter(Boolean).join(",")
    );

  if (error) {
    console.warn("[customer-profile] store customer lookup failed", {
      code: error.code,
      message: error.message,
      userId
    });
    return;
  }

  for (const row of (data ?? []) as unknown as Array<{ id: string; metadata?: Record<string, unknown> | null }>) {
    await admin
      .from("store_customers" as never)
      .update({
        metadata: {
          ...(row.metadata ?? {}),
          auth_user_id: userId,
          auth_linked_at: new Date().toISOString(),
          auth_link_source: "customer_account"
        }
      } as never)
      .eq("id" as never, row.id as never);
  }
}
