import { getPublicStorefrontAccess } from "@/lib/billing/publish-access";
import { getPublicStorefrontPreview } from "@/lib/public-storefront-preview";
import { createAdminClient } from "@/lib/supabase/admin";

export async function loadPublicStoreContact(slug: string) {
  const preview = await getPublicStorefrontPreview(slug);

  if (!preview) {
    return { contactMessage: null, preview: null };
  }

  const admin = createAdminClient();
  const storefrontAccess = admin
    ? await getPublicStorefrontAccess({
        storeId: preview.store.id,
        supabase: admin
      })
    : { allowed: true };

  if (!storefrontAccess.allowed) {
    return { contactMessage: null, preview: null };
  }

  if (!admin) {
    return { contactMessage: null, preview };
  }

  const { data } = await admin
    .from("stores" as never)
    .select("contact_message")
    .eq("id" as never, preview.store.id as never)
    .maybeSingle();
  const store = data as { contact_message?: string | null } | null;

  return {
    contactMessage: store?.contact_message || null,
    preview
  };
}
