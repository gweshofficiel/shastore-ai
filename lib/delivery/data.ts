import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

export type DeliveryRole = "delivery" | "pending_delivery" | "suspended_delivery";

export type DeliveryAgentAccessRecord = {
  agentId: string;
  agentName: string;
  cityZone: string | null;
  email: string | null;
  role: DeliveryRole;
  status: "active" | "inactive";
  storeId: string;
  storeName: string | null;
  workspaceId: string;
};

export type DeliveryAccessLookup =
  | { access: DeliveryAgentAccessRecord; status: "approved" }
  | { access: DeliveryAgentAccessRecord; status: "inactive" }
  | { status: "missing_email" }
  | { status: "not_found" };

type DeliveryAgentRow = {
  city_zone?: string | null;
  email?: string | null;
  id: string;
  metadata?: Record<string, unknown> | null;
  name: string;
  normalized_email?: string | null;
  status?: string | null;
  store_id: string;
  stores?: { name?: string | null } | { name?: string | null }[] | null;
  workspace_id: string;
};

function normalizeDeliveryEmail(value: string | null | undefined) {
  const email = value?.trim().toLowerCase() ?? "";
  return email.includes("@") ? email : "";
}

function agentRoleForStatus(status: string | null | undefined): DeliveryRole {
  return status === "inactive" ? "suspended_delivery" : "delivery";
}

function storeNameFromRow(row: DeliveryAgentRow) {
  const store = row.stores;

  if (Array.isArray(store)) {
    return store[0]?.name ?? null;
  }

  return store?.name ?? null;
}

function toAccessRecord(row: DeliveryAgentRow): DeliveryAgentAccessRecord {
  const status = row.status === "inactive" ? "inactive" : "active";

  return {
    agentId: row.id,
    agentName: row.name,
    cityZone: row.city_zone ?? null,
    email: row.email ?? row.normalized_email ?? null,
    role: agentRoleForStatus(row.status),
    status,
    storeId: row.store_id,
    storeName: storeNameFromRow(row),
    workspaceId: row.workspace_id
  };
}

async function loadDeliveryAgentRows({
  email,
  userId
}: {
  email?: string | null;
  userId?: string | null;
}) {
  const admin = createAdminClient();

  if (!admin) {
    return [];
  }

  const select =
    "id, name, email, normalized_email, city_zone, status, store_id, workspace_id, metadata, stores:store_id ( name )";

  if (userId) {
    const { data: linkedRows } = await admin
      .from("store_delivery_agents" as never)
      .select(select)
      .contains("metadata" as never, { auth_user_id: userId } as never)
      .order("created_at" as never, { ascending: false } as never);

    if (linkedRows?.length) {
      return linkedRows as unknown as DeliveryAgentRow[];
    }
  }

  const normalizedEmail = normalizeDeliveryEmail(email);

  if (!normalizedEmail) {
    return [];
  }

  const { data, error } = await admin
    .from("store_delivery_agents" as never)
    .select(select)
    .eq("normalized_email" as never, normalizedEmail as never)
    .order("created_at" as never, { ascending: false } as never);

  if (error) {
    console.warn("[delivery-access] agent lookup failed", {
      message: error.message,
      normalizedEmail,
      userId
    });
    return [];
  }

  return (data ?? []) as unknown as DeliveryAgentRow[];
}

export async function getDeliveryAccessForUser({
  email,
  userId
}: {
  email?: string | null;
  userId?: string | null;
}): Promise<DeliveryAccessLookup> {
  const normalizedEmail = normalizeDeliveryEmail(email);

  if (!normalizedEmail && !userId) {
    return { status: "missing_email" };
  }

  const rows = await loadDeliveryAgentRows({ email: normalizedEmail, userId });

  if (!rows.length) {
    return normalizedEmail ? { status: "not_found" } : { status: "missing_email" };
  }

  const access = toAccessRecord(rows[0]);

  if (access.status === "inactive") {
    return { access, status: "inactive" };
  }

  return { access, status: "approved" };
}

export async function findAuthUserIdByEmail(email: string) {
  const normalizedEmail = normalizeDeliveryEmail(email);

  if (!normalizedEmail) {
    return null;
  }

  const admin = createAdminClient();

  if (!admin) {
    return null;
  }

  const { data: profile } = await admin
    .from("profiles" as never)
    .select("id, email")
    .ilike("email", normalizedEmail)
    .maybeSingle();

  const profileUserId = (profile as { id?: string | null } | null)?.id ?? null;

  if (profileUserId) {
    return profileUserId;
  }

  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });

  if (error) {
    console.warn("[delivery-access] auth email lookup failed", {
      message: error.message,
      normalizedEmail
    });
    return null;
  }

  return data.users.find((user) => user.email?.toLowerCase() === normalizedEmail)?.id ?? null;
}

export async function linkDeliveryAgentToAuthUser({
  agentId,
  userId
}: {
  agentId: string;
  userId: string;
}) {
  const admin = createAdminClient();

  if (!admin) {
    return;
  }

  const { data: existing } = await admin
    .from("store_delivery_agents" as never)
    .select("metadata")
    .eq("id" as never, agentId as never)
    .maybeSingle();

  const metadata = ((existing as { metadata?: Record<string, unknown> } | null)?.metadata ??
    {}) as Record<string, unknown>;

  if (metadata.auth_user_id === userId) {
    return;
  }

  const { error } = await admin
    .from("store_delivery_agents" as never)
    .update({
      metadata: {
        ...metadata,
        auth_user_id: userId,
        linked_at: new Date().toISOString()
      },
      updated_at: new Date().toISOString()
    } as never)
    .eq("id" as never, agentId as never);

  if (error) {
    console.warn("[delivery-access] agent auth link skipped", {
      agentId,
      message: error.message,
      userId
    });
  }
}

export async function getDeliveryDashboardData({
  supabase,
  user
}: {
  supabase: SupabaseClient;
  user: { email?: string | null; id: string };
}) {
  const lookup = await getDeliveryAccessForUser({
    email: user.email,
    userId: user.id
  });

  return lookup.status === "approved" || lookup.status === "inactive" ? lookup.access : null;
}
