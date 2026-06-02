"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  assertStoreAccessInWorkspace,
  getWorkspaceDataContext
} from "@/lib/workspaces/data-access";

const productsPath = "/dashboard/products";

function cleanText(value: FormDataEntryValue | null, maxLength = 120) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function productsRedirect(storeId: string, status: string): never {
  const params = new URLSearchParams({ products: status, storeId });
  redirect(`${productsPath}?${params.toString()}`);
}

export async function saveManualProductRecommendations(formData: FormData) {
  const storeId = cleanText(formData.get("storeId"), 80);
  const productId = cleanText(formData.get("productId"), 80);
  const recommendedProductIds = formData
    .getAll("recommendedProductIds")
    .map((value) => cleanText(value, 80))
    .filter((value) => value && value !== productId)
    .slice(0, 12);

  if (!storeId || !productId) {
    productsRedirect(storeId, "recommendations-failed");
  }

  const { supabase, user, workspaceId } = await getWorkspaceDataContext({
    permission: "manage_products",
    redirectTo: productsPath
  });
  const access = await assertStoreAccessInWorkspace({
    permission: "manage_products",
    storeId,
    supabase,
    userId: user.id,
    workspaceId
  });

  if (!access.allowed) {
    productsRedirect(storeId, "not-authorized");
  }

  const { data: validProducts } = recommendedProductIds.length
    ? await supabase
        .from("store_products" as never)
        .select("id")
        .eq("workspace_id" as never, workspaceId as never)
        .eq("store_id" as never, storeId as never)
        .in("id" as never, recommendedProductIds as never)
    : { data: [] };
  const validIds = new Set(((validProducts ?? []) as unknown as Array<{ id: string }>).map((product) => product.id));

  const { error: deleteError } = await supabase
    .from("product_recommendation_links" as never)
    .delete()
    .eq("workspace_id" as never, workspaceId as never)
    .eq("store_id" as never, storeId as never)
    .eq("source_product_id" as never, productId as never)
    .eq("recommendation_context" as never, "related" as never);

  if (deleteError) {
    productsRedirect(storeId, "recommendations-failed");
  }

  const rows = recommendedProductIds
    .filter((id) => validIds.has(id))
    .map((recommendedProductId, index) => ({
      recommendation_context: "related",
      recommended_product_id: recommendedProductId,
      sort_order: index,
      source_product_id: productId,
      status: "active",
      store_id: storeId,
      workspace_id: workspaceId
    }));

  if (rows.length) {
    const { error } = await supabase
      .from("product_recommendation_links" as never)
      .insert(rows as never);

    if (error) {
      productsRedirect(storeId, "recommendations-failed");
    }
  }

  revalidatePath(productsPath);
  productsRedirect(storeId, "recommendations-saved");
}
