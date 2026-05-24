"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getUserSubscriptionAccess } from "@/lib/billing/access";
import {
  assertUsageWithinLimits,
  billingEnforcementMessage
} from "@/lib/billing/enforcement";
import { createClient } from "@/lib/supabase/server";

function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

  return slug || "product";
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return { supabase, user };
}

export async function duplicateLandingPage(formData: FormData) {
  const { supabase, user } = await requireUser();
  const landingId = String(formData.get("landingId") ?? "");
  const access = await getUserSubscriptionAccess(user.id);

  try {
    assertUsageWithinLimits(access, "landings");
  } catch (error) {
    const params = new URLSearchParams({
      error: "limit-reached",
      detail:
        billingEnforcementMessage(error) ??
        "Your current plan has reached its landing page limit. Upgrade at /dashboard/billing."
    });
    redirect(`/dashboard/landings?${params.toString()}`);
  }

  const { data: landing, error } = await supabase
    .from("landing_pages")
    .select("*")
    .eq("id", landingId)
    .eq("user_id", user.id)
    .single();

  if (error || !landing) {
    throw error ?? new Error("Landing page not found");
  }

  const nextId = crypto.randomUUID();
  const nextName = `${landing.product_name} Copy`;
  const nextSlug = `${slugify(nextName)}-${nextId.slice(0, 8)}`;

  const { error: insertError } = await supabase.from("landing_pages").insert({
    id: nextId,
    user_id: user.id,
    template_id: landing.template_id,
    slug: nextSlug,
    status: "draft",
    product_name: nextName,
    product_price: landing.product_price,
    product_description: landing.product_description,
    whatsapp_number: landing.whatsapp_number,
    brand_color: landing.brand_color,
    hero_image_url: landing.hero_image_url,
    ai_copy: landing.ai_copy,
    published_at: null
  });

  if (insertError) {
    throw insertError;
  }

  await supabase.from("landings").insert({
    user_id: user.id,
    landing_page_id: nextId,
    title: nextName,
    status: "draft"
  });

  revalidatePath("/dashboard/landings");
  redirect("/dashboard/landings?duplicated=true");
}

export async function deleteLandingPage(formData: FormData) {
  const { supabase, user } = await requireUser();
  const landingId = String(formData.get("landingId") ?? "");

  const { error } = await supabase
    .from("landing_pages")
    .delete()
    .eq("id", landingId)
    .eq("user_id", user.id);

  if (error) {
    throw error;
  }

  revalidatePath("/dashboard/landings");
  redirect("/dashboard/landings?deleted=true");
}

export async function unpublishLandingPage(formData: FormData) {
  const { supabase, user } = await requireUser();
  const landingId = String(formData.get("landingId") ?? "");

  const { data: landing, error } = await supabase
    .from("landing_pages")
    .update({
      status: "draft",
      published_at: null
    })
    .eq("id", landingId)
    .eq("user_id", user.id)
    .select("id")
    .single();

  if (error || !landing) {
    throw error ?? new Error("Landing page not found");
  }

  await supabase
    .from("landings")
    .update({ status: "draft" })
    .eq("landing_page_id", landing.id)
    .eq("user_id", user.id);

  await supabase
    .from("publications")
    .update({ status: "draft", published_at: null })
    .eq("landing_page_id", landing.id)
    .eq("user_id", user.id);

  revalidatePath("/dashboard/landings");
  redirect("/dashboard/landings?unpublished=true");
}
