"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  getUserSubscriptionAccess
} from "@/lib/billing/access";
import { assertUsageWithinLimits } from "@/lib/billing/enforcement";
import { getDomainBase } from "@/lib/domains/hostinsh";
import {
  buildFreeHostname,
  isReservedSubdomain,
  isValidHostname,
  normalizeHostname,
  normalizeSubdomain
} from "@/lib/domains/utils";
import { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

type ClaimedStoreRow = {
  access_role?: string | null;
  id: string;
  owner_user_id?: string | null;
};

function cleanText(value: FormDataEntryValue | null, maxLength = 240) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function domainsRedirect(storeId: string, status: string): never {
  redirect(`/dashboard/domains?storeId=${encodeURIComponent(storeId)}&domains=${encodeURIComponent(status)}`);
}

async function getClaimedStore(supabase: SupabaseClient, storeId: string) {
  const { data, error } = await supabase.rpc(
    "get_claimed_store_instances_for_current_user" as never
  );

  if (error || !Array.isArray(data)) {
    return null;
  }

  return (
    (data as ClaimedStoreRow[]).find(
      (store) =>
        store.id === storeId &&
        (!store.access_role || store.access_role === "owner" || store.access_role === "admin")
    ) ?? null
  );
}

async function requireClaimedStore(formData: FormData) {
  const storeId = cleanText(formData.get("storeId"), 80);

  if (!storeId) {
    redirect("/dashboard/domains?domains=missing-store");
  }

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent("/dashboard/domains")}`);
  }

  const claimedStore = await getClaimedStore(supabase, storeId);

  if (!claimedStore) {
    domainsRedirect(storeId, "not-authorized");
  }

  return { storeId, supabase, userId: user.id };
}

async function ensureHostnameAvailable(
  supabase: SupabaseClient,
  hostname: string,
  currentStoreId: string
) {
  const { data } = await supabase
    .from("store_domains" as never)
    .select("store_instance_id")
    .eq("hostname", hostname)
    .maybeSingle();

  return !data || (data as { store_instance_id?: string }).store_instance_id === currentStoreId;
}

async function clearPrimaryDomain(supabase: SupabaseClient, storeId: string) {
  await supabase
    .from("store_domains" as never)
    .update({ is_primary: false, primary_domain: null } as never)
    .eq("store_instance_id", storeId);
}

export async function createStoreSubdomain(formData: FormData) {
  const { storeId, supabase, userId } = await requireClaimedStore(formData);
  const subdomain = normalizeSubdomain(cleanText(formData.get("subdomain"), 80));
  const access = await getUserSubscriptionAccess(userId);

  try {
    assertUsageWithinLimits(access, "domains");
  } catch {
    domainsRedirect(storeId, "limit-reached");
  }

  if (!subdomain || subdomain.length < 3) {
    domainsRedirect(storeId, "invalid-subdomain");
  }

  if (isReservedSubdomain(subdomain)) {
    domainsRedirect(storeId, "reserved-subdomain");
  }

  const hostname = buildFreeHostname(subdomain);
  const available = await ensureHostnameAvailable(supabase, hostname, storeId);

  if (!available) {
    domainsRedirect(storeId, "duplicate-domain");
  }

  await clearPrimaryDomain(supabase, storeId);

  const subdomainPayload = {
    custom_domain: null,
    dns_status: "verified",
    domain_type: "subdomain",
    hostname,
    is_primary: true,
    owner_user_id: userId,
    primary_domain: hostname,
    ssl_status: "active",
    store_instance_id: storeId,
    subdomain,
    verification_status: "verified"
  };
  const { data: existingSubdomain } = await supabase
    .from("store_domains" as never)
    .select("id")
    .eq("store_instance_id", storeId)
    .eq("domain_type", "subdomain")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = existingSubdomain
    ? await supabase
        .from("store_domains" as never)
        .update(subdomainPayload as never)
        .eq("id", (existingSubdomain as { id: string }).id)
        .eq("store_instance_id", storeId)
    : await supabase.from("store_domains" as never).insert(subdomainPayload as never);

  if (error) {
    console.error("[store-domains] set subdomain failed", {
      code: error.code,
      hostname,
      message: error.message,
      storeId
    });
    domainsRedirect(storeId, "save-failed");
  }

  revalidatePath("/dashboard/domains");
  domainsRedirect(storeId, "subdomain-saved");
}

export async function attachCustomDomain(formData: FormData) {
  const { storeId, supabase, userId } = await requireClaimedStore(formData);
  const hostname = normalizeHostname(cleanText(formData.get("customDomain"), 253));
  const access = await getUserSubscriptionAccess(userId);

  try {
    assertUsageWithinLimits(access, "domains");
  } catch {
    domainsRedirect(storeId, "limit-reached");
  }

  if (!isValidHostname(hostname)) {
    domainsRedirect(storeId, "invalid-domain");
  }

  if (hostname.endsWith(`.${normalizeHostname(getDomainBase())}`)) {
    domainsRedirect(storeId, "use-subdomain-form");
  }

  const available = await ensureHostnameAvailable(supabase, hostname, storeId);

  if (!available) {
    domainsRedirect(storeId, "duplicate-domain");
  }

  const makePrimary = cleanText(formData.get("makePrimary"), 10) === "on";

  if (makePrimary) {
    await clearPrimaryDomain(supabase, storeId);
  }

  const { error } = await supabase.from("store_domains" as never).upsert(
    {
      custom_domain: hostname,
      dns_status: "pending",
      domain_type: "custom",
      hostname,
      is_primary: makePrimary,
      owner_user_id: userId,
      primary_domain: makePrimary ? hostname : null,
      ssl_status: "pending",
      store_instance_id: storeId,
      subdomain: null,
      verification_status: "pending"
    } as never,
    { onConflict: "store_instance_id,hostname" }
  );

  if (error) {
    console.error("[store-domains] connect custom domain failed", {
      code: error.code,
      hostname,
      message: error.message,
      storeId
    });
    domainsRedirect(storeId, "save-failed");
  }

  revalidatePath("/dashboard/domains");
  domainsRedirect(storeId, "custom-domain-saved");
}

export async function setPrimaryDomain(formData: FormData) {
  const { storeId, supabase } = await requireClaimedStore(formData);
  const domainId = cleanText(formData.get("domainId"), 80);

  if (!domainId) {
    domainsRedirect(storeId, "missing-domain");
  }

  const { data: domain } = await supabase
    .from("store_domains" as never)
    .select("id, hostname")
    .eq("id", domainId)
    .eq("store_instance_id", storeId)
    .maybeSingle();

  if (!domain) {
    domainsRedirect(storeId, "domain-not-found");
  }

  await clearPrimaryDomain(supabase, storeId);

  const hostname = (domain as { hostname: string }).hostname;
  const { error } = await supabase
    .from("store_domains" as never)
    .update({ is_primary: true, primary_domain: hostname } as never)
    .eq("id", domainId)
    .eq("store_instance_id", storeId);

  if (error) {
    domainsRedirect(storeId, "save-failed");
  }

  revalidatePath("/dashboard/domains");
  domainsRedirect(storeId, "primary-updated");
}

export async function markStoreDomainVerificationPending(formData: FormData) {
  const { storeId, supabase } = await requireClaimedStore(formData);
  const domainId = cleanText(formData.get("domainId"), 80);

  if (!domainId) {
    domainsRedirect(storeId, "missing-domain");
  }

  const { error } = await supabase
    .from("store_domains" as never)
    .update({
      dns_status: "pending",
      ssl_status: "pending",
      verification_status: "pending"
    } as never)
    .eq("id", domainId)
    .eq("store_instance_id", storeId);

  if (error) {
    domainsRedirect(storeId, "verify-failed");
  }

  revalidatePath("/dashboard/domains");
  domainsRedirect(storeId, "verification-pending");
}

export async function removeDomain(formData: FormData) {
  const { storeId, supabase } = await requireClaimedStore(formData);
  const domainId = cleanText(formData.get("domainId"), 80);

  if (!domainId) {
    domainsRedirect(storeId, "missing-domain");
  }

  const { error } = await supabase
    .from("store_domains" as never)
    .delete()
    .eq("id", domainId)
    .eq("store_instance_id", storeId);

  if (error) {
    domainsRedirect(storeId, "delete-failed");
  }

  revalidatePath("/dashboard/domains");
  domainsRedirect(storeId, "domain-deleted");
}

export const setStoreSubdomain = createStoreSubdomain;
export const connectStoreCustomDomain = attachCustomDomain;
export const setPrimaryStoreDomain = setPrimaryDomain;
export const deleteStoreDomain = removeDomain;
