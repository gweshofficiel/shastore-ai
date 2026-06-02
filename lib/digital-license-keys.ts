import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertStoreAccessInWorkspace, getWorkspaceDataContext } from "@/lib/workspaces/data-access";
import { recordWorkspaceActivitySafe } from "@/lib/audit/workspace-activity";

const productsPath = "/dashboard/products";

export type LicenseKeyStats = {
  assigned: number;
  available: number;
  revoked: number;
  total: number;
};

export type AssignedLicenseKey = {
  assignedAt: string | null;
  keyValue: string;
  productId: string;
};

function cleanText(value: FormDataEntryValue | null, maxLength = 4000) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function productsRedirect(storeId: string, status: string, productId?: string): never {
  const params = new URLSearchParams({ licenses: status, storeId });
  if (productId) {
    params.set("edit", productId);
  }
  redirect(`${productsPath}?${params.toString()}`);
}

function uniqueKeys(value: FormDataEntryValue | null) {
  return Array.from(
    new Set(
      cleanText(value, 20000)
        .split(/\r?\n|,/)
        .map((key) => key.trim())
        .filter(Boolean)
        .slice(0, 500)
    )
  );
}

async function requireWorkspaceProduct(formData: FormData) {
  const productId = cleanText(formData.get("productId"), 80);
  const storeId = cleanText(formData.get("storeId"), 80);

  if (!productId || !storeId) {
    redirect(`${productsPath}?licenses=missing-product`);
  }

  const { supabase, user, workspaceId } = await getWorkspaceDataContext({
    permission: "products.edit",
    redirectTo: productsPath
  });
  const access = await assertStoreAccessInWorkspace({
    permission: "products.edit",
    storeId,
    supabase,
    userId: user.id,
    workspaceId
  });

  if (!access.allowed) {
    productsRedirect(storeId, "not-authorized", productId);
  }

  const { data: product } = await supabase
    .from("store_products" as never)
    .select("id, product_type, title, name")
    .eq("id" as never, productId as never)
    .eq("store_id" as never, storeId as never)
    .eq("workspace_id" as never, workspaceId as never)
    .maybeSingle();
  const productRow = product as { id: string; name?: string | null; product_type?: string | null; title?: string | null } | null;

  if (!productRow || productRow.product_type !== "digital") {
    productsRedirect(storeId, "digital-required", productId);
  }

  return {
    product: productRow,
    productId,
    storeId,
    supabase,
    user,
    workspaceId
  };
}

export async function importDigitalProductLicenseKeys(formData: FormData) {
  "use server";

  const { product, productId, storeId, supabase, user, workspaceId } = await requireWorkspaceProduct(formData);
  const keys = uniqueKeys(formData.get("licenseKeys"));

  if (!keys.length) {
    productsRedirect(storeId, "missing-keys", productId);
  }

  const { error } = await supabase.from("store_product_license_keys" as never).upsert(
    keys.map((key) => ({
      key_value: key,
      product_id: productId,
      status: "available",
      store_id: storeId,
      workspace_id: workspaceId
    })) as never,
    { onConflict: "product_id,key_value", ignoreDuplicates: true } as never
  );

  if (error) {
    console.error("[license-keys] import failed", {
      code: error.code,
      message: error.message,
      productId,
      storeId
    });
    productsRedirect(storeId, "import-failed", productId);
  }

  await recordWorkspaceActivitySafe({
    action: "license_keys_imported",
    actorEmail: user.email,
    actorUserId: user.id,
    entityId: productId,
    entityType: "product_license_keys",
    metadata: {
      importedCount: keys.length,
      productName: product.title ?? product.name ?? "Digital product"
    },
    storeId,
    supabase,
    workspaceId
  });

  revalidatePath(productsPath);
  productsRedirect(storeId, "keys-imported", productId);
}

export async function getLicenseKeyStatsByProduct({
  productIds,
  storeId,
  supabase,
  workspaceId
}: {
  productIds: string[];
  storeId: string;
  supabase: SupabaseClient;
  workspaceId: string;
}) {
  if (!productIds.length) {
    return new Map<string, LicenseKeyStats>();
  }

  const { data } = await supabase
    .from("store_product_license_keys" as never)
    .select("product_id, status")
    .eq("workspace_id" as never, workspaceId as never)
    .eq("store_id" as never, storeId as never)
    .in("product_id" as never, productIds as never);
  const stats = new Map<string, LicenseKeyStats>();

  for (const productId of productIds) {
    stats.set(productId, { assigned: 0, available: 0, revoked: 0, total: 0 });
  }

  for (const row of (data ?? []) as unknown as Array<{ product_id?: string | null; status?: string | null }>) {
    if (!row.product_id) {
      continue;
    }

    const current = stats.get(row.product_id) ?? { assigned: 0, available: 0, revoked: 0, total: 0 };
    current.total += 1;
    if (row.status === "assigned") {
      current.assigned += 1;
    } else if (row.status === "revoked") {
      current.revoked += 1;
    } else {
      current.available += 1;
    }
    stats.set(row.product_id, current);
  }

  return stats;
}

export async function assignLicenseKeysForOrder({
  customerEmail,
  items,
  orderId,
  orderSource,
  storeId,
  supabase,
  workspaceId
}: {
  customerEmail: string | null;
  items: Array<{ product_id?: string | null; productId?: string | null }>;
  orderId: string;
  orderSource: "orders" | "store_orders";
  storeId: string;
  supabase?: SupabaseClient;
  workspaceId?: string | null;
}) {
  const admin = createAdminClient() ?? supabase;
  const email = customerEmail?.trim().toLowerCase();

  if (!admin || !email || !items.length) {
    return [];
  }

  const productIds = Array.from(
    new Set(
      items
        .map((item) => item.product_id ?? item.productId ?? null)
        .filter((productId): productId is string => Boolean(productId))
    )
  );

  if (!productIds.length) {
    return [];
  }

  const { data: products } = await admin
    .from("store_products" as never)
    .select("id, product_type")
    .eq("store_id" as never, storeId as never)
    .in("id" as never, productIds as never);
  const digitalProductIds = new Set(
    ((products ?? []) as unknown as Array<{ id: string; product_type?: string | null }>)
      .filter((product) => product.product_type === "digital")
      .map((product) => product.id)
  );
  const assigned: AssignedLicenseKey[] = [];

  for (const productId of productIds) {
    if (!digitalProductIds.has(productId)) {
      continue;
    }

    const existing = await admin
      .from("store_product_license_keys" as never)
      .select("key_value, assigned_at")
      .eq("product_id" as never, productId as never)
      .eq("assigned_order_id" as never, orderId as never)
      .eq("assigned_order_source" as never, orderSource as never)
      .eq("assigned_customer_email" as never, email as never)
      .eq("status" as never, "assigned" as never)
      .maybeSingle();

    if (existing.data) {
      const key = existing.data as { assigned_at?: string | null; key_value: string };
      assigned.push({
        assignedAt: key.assigned_at ?? null,
        keyValue: key.key_value,
        productId
      });
      continue;
    }

    const { data, error } = await admin.rpc("assign_store_product_license_key" as never, {
      candidate_customer_email: email,
      candidate_order_id: orderId,
      candidate_order_source: orderSource,
      candidate_product_id: productId
    } as never);

    if (error) {
      console.warn("[license-keys] assignment failed", {
        code: error.code,
        message: error.message,
        orderId,
        productId
      });
      continue;
    }

    const row = Array.isArray(data) ? data[0] as { assigned_at?: string | null; key_value?: string | null } | undefined : null;

    if (row?.key_value) {
      assigned.push({
        assignedAt: row.assigned_at ?? null,
        keyValue: row.key_value,
        productId
      });
    }
  }

  if (assigned.length && workspaceId) {
    await recordWorkspaceActivitySafe({
      action: "license_keys_assigned",
      actorEmail: null,
      actorUserId: null,
      entityId: orderId,
      entityType: "order",
      metadata: {
        assignedCount: assigned.length,
        orderSource
      },
      storeId,
      supabase: admin,
      workspaceId
    });
  }

  return assigned;
}

export async function getAssignedLicenseKeysForOrder({
  customerEmail,
  orderId,
  orderSource,
  productIds,
  storeId,
  supabase
}: {
  customerEmail: string | null;
  orderId: string;
  orderSource: "orders" | "store_orders";
  productIds: string[];
  storeId: string;
  supabase?: SupabaseClient;
}) {
  const admin = createAdminClient() ?? supabase;
  const email = customerEmail?.trim().toLowerCase();

  if (!admin || !email || !productIds.length) {
    return new Map<string, AssignedLicenseKey>();
  }

  const { data } = await admin
    .from("store_product_license_keys" as never)
    .select("product_id, key_value, assigned_at")
    .eq("store_id" as never, storeId as never)
    .eq("assigned_order_id" as never, orderId as never)
    .eq("assigned_order_source" as never, orderSource as never)
    .eq("assigned_customer_email" as never, email as never)
    .eq("status" as never, "assigned" as never)
    .in("product_id" as never, productIds as never);

  return new Map(
    ((data ?? []) as unknown as Array<{ assigned_at?: string | null; key_value?: string | null; product_id?: string | null }>)
      .filter((row) => row.product_id && row.key_value)
      .map((row) => [
        row.product_id as string,
        {
          assignedAt: row.assigned_at ?? null,
          keyValue: row.key_value as string,
          productId: row.product_id as string
        }
      ])
  );
}
