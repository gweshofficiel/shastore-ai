import { getPublicStorefrontAccess } from "@/lib/billing/publish-access";
import { getPublicStorefrontPreview } from "@/lib/public-storefront-preview";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type PublicStoreFaq = {
  answer: string;
  id: string;
  question: string;
  sortOrder: number | null;
};

function normalizeFaq(value: unknown): PublicStoreFaq | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = typeof record.id === "string" ? record.id : "";
  const question = typeof record.question === "string" ? record.question : "";
  const answer = typeof record.answer === "string" ? record.answer : "";

  if (!id || !question || !answer) {
    return null;
  }

  return {
    answer,
    id,
    question,
    sortOrder: typeof record.sort_order === "number" ? record.sort_order : null
  };
}

export async function loadPublishedStoreFaqsForStore(storeId: string, limit = 50) {
  const admin = createAdminClient();
  const readClient = admin ?? (await createClient());
  const { data } = await readClient
    .from("store_faqs" as never)
    .select("id, question, answer, sort_order")
    .eq("store_id" as never, storeId as never)
    .eq("status" as never, "published" as never)
    .order("sort_order" as never, { ascending: true, nullsFirst: false } as never)
    .order("created_at" as never, { ascending: true } as never)
    .limit(limit);

  return ((data ?? []) as unknown[])
    .map(normalizeFaq)
    .filter((faq): faq is PublicStoreFaq => Boolean(faq));
}

export async function loadPublicStoreFaqs(slug: string) {
  const preview = await getPublicStorefrontPreview(slug);

  if (!preview) {
    return { faqs: [], preview: null };
  }

  const admin = createAdminClient();
  const storefrontAccess = admin
    ? await getPublicStorefrontAccess({
        storeId: preview.store.id,
        supabase: admin
      })
    : { allowed: true };

  if (!storefrontAccess.allowed) {
    return { faqs: [], preview };
  }

  return {
    faqs: await loadPublishedStoreFaqsForStore(preview.store.id),
    preview
  };
}
