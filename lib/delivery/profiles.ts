import { createAdminClient } from "@/lib/supabase/admin";

export type DeliveryProfileStatus = "pending" | "active" | "suspended";
export type DeliveryVerificationStatus = "pending" | "verified" | "rejected";
export type DeliveryProfileType = "individual" | "company";

export type DeliveryProfile = {
  city: string | null;
  country: string | null;
  email: string;
  id: string;
  name: string | null;
  phone: string | null;
  region: string | null;
  reputation_score: number;
  status: DeliveryProfileStatus;
  type: DeliveryProfileType;
  user_id: string;
  verification_status: DeliveryVerificationStatus;
  zone: string | null;
};

function fallbackName(email: string) {
  return email.split("@")[0]?.replace(/[._-]+/g, " ").trim() || "Delivery agent";
}

function profileStatus(value: unknown): DeliveryProfileStatus {
  return value === "active" || value === "suspended" ? value : "pending";
}

function verificationStatus(value: unknown): DeliveryVerificationStatus {
  return value === "verified" || value === "rejected" ? value : "pending";
}

function profileType(value: unknown): DeliveryProfileType {
  return value === "company" ? "company" : "individual";
}

function toDeliveryProfile(row: Record<string, unknown>): DeliveryProfile {
  return {
    city: typeof row.city === "string" ? row.city : null,
    country: typeof row.country === "string" ? row.country : null,
    email: typeof row.email === "string" ? row.email : "",
    id: String(row.id),
    name: typeof row.name === "string" ? row.name : null,
    phone: typeof row.phone === "string" ? row.phone : null,
    region: typeof row.region === "string" ? row.region : null,
    reputation_score: typeof row.reputation_score === "number" ? row.reputation_score : 0,
    status: profileStatus(row.status),
    type: profileType(row.type),
    user_id: String(row.user_id),
    verification_status: verificationStatus(row.verification_status),
    zone: typeof row.zone === "string" ? row.zone : null
  };
}

export async function ensureDeliveryProfileForUser({
  email,
  name,
  phone,
  userId
}: {
  email: string | null | undefined;
  name?: string | null;
  phone?: string | null;
  userId: string;
}) {
  const admin = createAdminClient();
  const normalizedEmail = email?.trim().toLowerCase() ?? "";

  if (!admin || !normalizedEmail) {
    console.warn("[delivery-profile] profile creation unavailable", {
      hasAdminClient: Boolean(admin),
      hasEmail: Boolean(normalizedEmail),
      userId
    });
    return null;
  }

  const { data, error } = await admin
    .from("delivery_profiles" as never)
    .upsert(
      {
        email: normalizedEmail,
        name: name?.trim() || fallbackName(normalizedEmail),
        phone: phone?.trim() || null,
        user_id: userId
      } as never,
      { onConflict: "user_id" } as never
    )
    .select("*")
    .single();

  if (error) {
    console.warn("[delivery-profile] profile upsert failed", {
      code: error.code,
      message: error.message,
      userId
    });
    return null;
  }

  return toDeliveryProfile(data as unknown as Record<string, unknown>);
}

export async function getDeliveryProfileForUser(userId: string) {
  const admin = createAdminClient();

  if (!admin) {
    return null;
  }

  const { data, error } = await admin
    .from("delivery_profiles" as never)
    .select("*")
    .eq("user_id" as never, userId as never)
    .maybeSingle();

  if (error) {
    console.warn("[delivery-profile] profile lookup failed", {
      code: error.code,
      message: error.message,
      userId
    });
    return null;
  }

  return data ? toDeliveryProfile(data as unknown as Record<string, unknown>) : null;
}
