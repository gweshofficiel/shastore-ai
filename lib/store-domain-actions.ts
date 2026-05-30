"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordStoreAuditLogSafe } from "@/lib/audit/store-audit";
import {
  assertCanConnectCustomDomain,
  assertCanUseExistingCustomDomain
} from "@/lib/billing/domain-access";
import { assertStoreMutationAllowed } from "@/lib/billing/store-access";
import { getUserPrimaryWorkspaceId, requirePermission } from "@/lib/permissions/rbac";
import { getDefaultDnsTarget, getDomainBase } from "@/lib/domains/hostinsh";
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

type DomainLifecycleStatus = "pending" | "verifying" | "verified" | "active" | "failed";

function cleanText(value: FormDataEntryValue | null, maxLength = 240) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function domainsRedirect(storeId: string, status: string): never {
  redirect(`/dashboard/domains?storeId=${encodeURIComponent(storeId)}&domains=${encodeURIComponent(status)}`);
}

function createDomainVerificationToken() {
  return randomUUID().replace(/-/g, "");
}

async function recordDomainVerificationLog({
  domainId,
  hostname,
  message,
  status,
  storeId,
  supabase,
  userId
}: {
  domainId: string;
  hostname: string;
  message: string;
  status: DomainLifecycleStatus;
  storeId: string;
  supabase: SupabaseClient;
  userId: string;
}) {
  const { error } = await supabase.from("store_domain_verification_logs" as never).insert({
    hostname,
    message,
    owner_user_id: userId,
    status,
    store_domain_id: domainId,
    store_instance_id: storeId
  } as never);

  if (error) {
    console.warn("[store-domains] verification log failed", {
      code: error.code,
      domainId,
      message: error.message,
      storeId
    });
  }
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

  try {
    await requirePermission({
      permission: "manage_domains",
      supabase,
      userId: user.id,
      workspaceId: await getUserPrimaryWorkspaceId(supabase, user.id)
    });
  } catch {
    domainsRedirect(storeId, "not-authorized");
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

  try {
    await assertStoreMutationAllowed(supabase, userId, { id: storeId });
  } catch {
    domainsRedirect(storeId, "store-locked");
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
    cname_target: getDefaultDnsTarget(),
    dns_status: "verified",
    domain_type: "subdomain",
    error_message: null,
    hostname,
    is_primary: true,
    last_checked_at: new Date().toISOString(),
    owner_user_id: userId,
    primary_domain: hostname,
    ssl_status: "active",
    status: "active",
    store_id: storeId,
    store_instance_id: storeId,
    subdomain,
    verification_status: "verified",
    verified_at: new Date().toISOString()
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

  const { data: savedSubdomain } = await supabase
    .from("store_domains" as never)
    .select("id")
    .eq("store_instance_id", storeId)
    .eq("hostname", hostname)
    .maybeSingle();
  const domainId = (savedSubdomain as { id?: string } | null)?.id;

  if (domainId) {
    await recordDomainVerificationLog({
      domainId,
      hostname,
      message: "SHASTORE subdomain is managed by the platform and marked active.",
      status: "active",
      storeId,
      supabase,
      userId
    });
  }

  await recordStoreAuditLogSafe({
    action: "domain_connected",
    actorUserId: userId,
    metadata: {
      domainType: "subdomain",
      source: "store_domains"
    },
    storeId,
    supabase
  });

  revalidatePath("/dashboard/domains");
  domainsRedirect(storeId, "subdomain-saved");
}

export async function attachCustomDomain(formData: FormData) {
  const { storeId, supabase, userId } = await requireClaimedStore(formData);
  const hostname = normalizeHostname(cleanText(formData.get("customDomain"), 253));

  try {
    await assertCanConnectCustomDomain(supabase, userId, storeId);
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
  const verificationToken = createDomainVerificationToken();

  if (makePrimary) {
    await clearPrimaryDomain(supabase, storeId);
  }

  const { data: domain, error } = await supabase.from("store_domains" as never).upsert(
    {
      cname_target: getDefaultDnsTarget(),
      custom_domain: hostname,
      dns_status: "pending",
      domain_type: "custom",
      error_message: null,
      hostname,
      is_primary: makePrimary,
      last_checked_at: null,
      owner_user_id: userId,
      primary_domain: makePrimary ? hostname : null,
      ssl_status: "pending",
      status: "pending",
      store_id: storeId,
      store_instance_id: storeId,
      subdomain: null,
      verification_token: verificationToken,
      verification_status: "pending"
    } as never,
    { onConflict: "store_instance_id,hostname" }
  ).select("id").single();

  if (error) {
    console.error("[store-domains] connect custom domain failed", {
      code: error.code,
      hostname,
      message: error.message,
      storeId
    });
    domainsRedirect(storeId, "save-failed");
  }

  await recordDomainVerificationLog({
    domainId: (domain as { id: string }).id,
    hostname,
    message: "Custom domain added. Add the CNAME and TXT records, then start verification.",
    status: "pending",
    storeId,
    supabase,
    userId
  });

  await recordStoreAuditLogSafe({
    action: "domain_connected",
    actorUserId: userId,
    metadata: {
      domainType: "custom",
      source: "store_domains"
    },
    storeId,
    supabase
  });

  revalidatePath("/dashboard/domains");
  domainsRedirect(storeId, "custom-domain-saved");
}

export async function setPrimaryDomain(formData: FormData) {
  const { storeId, supabase, userId } = await requireClaimedStore(formData);
  const domainId = cleanText(formData.get("domainId"), 80);

  if (!domainId) {
    domainsRedirect(storeId, "missing-domain");
  }

  const { data: domain } = await supabase
    .from("store_domains" as never)
    .select("id, hostname, domain_type")
    .eq("id", domainId)
    .eq("store_instance_id", storeId)
    .maybeSingle();

  if (!domain) {
    domainsRedirect(storeId, "domain-not-found");
  }

  const domainRow = domain as { domain_type?: string | null; hostname: string };

  try {
    if (domainRow.domain_type === "custom") {
      await assertCanUseExistingCustomDomain(supabase, userId, storeId);
    } else {
      await assertStoreMutationAllowed(supabase, userId, { id: storeId });
    }
  } catch {
    domainsRedirect(storeId, "store-locked");
  }

  await clearPrimaryDomain(supabase, storeId);

  const hostname = domainRow.hostname;
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
  const { storeId, supabase, userId } = await requireClaimedStore(formData);
  const domainId = cleanText(formData.get("domainId"), 80);

  if (!domainId) {
    domainsRedirect(storeId, "missing-domain");
  }

  const { data: domain } = await supabase
    .from("store_domains" as never)
    .select("domain_type, hostname")
    .eq("id", domainId)
    .eq("store_instance_id", storeId)
    .maybeSingle();

  if (!domain) {
    domainsRedirect(storeId, "domain-not-found");
  }

  try {
    if ((domain as { domain_type?: string | null }).domain_type === "custom") {
      await assertCanUseExistingCustomDomain(supabase, userId, storeId);
    } else {
      await assertStoreMutationAllowed(supabase, userId, { id: storeId });
    }
  } catch {
    domainsRedirect(storeId, "store-locked");
  }

  const { error } = await supabase
    .from("store_domains" as never)
    .update({
      error_message: process.env.HOSTINSH_API_KEY
        ? null
        : "DNS verification is waiting for HOSTINSH API credentials. Add the CNAME and TXT records shown in the dashboard.",
      last_checked_at: new Date().toISOString(),
      dns_status: "pending",
      ssl_status: "pending",
      status: "verifying",
      verification_status: "pending"
    } as never)
    .eq("id", domainId)
    .eq("store_instance_id", storeId);

  if (error) {
    domainsRedirect(storeId, "verify-failed");
  }

  await recordDomainVerificationLog({
    domainId,
    hostname: (domain as { hostname: string }).hostname,
    message: process.env.HOSTINSH_API_KEY
      ? "Domain verification was queued."
      : "Verification is pending because HOSTINSH API credentials are not configured.",
    status: "verifying",
    storeId,
    supabase,
    userId
  });

  revalidatePath("/dashboard/domains");
  domainsRedirect(storeId, "verification-pending");
}

export async function activateVerifiedStoreDomain(formData: FormData) {
  const { storeId, supabase, userId } = await requireClaimedStore(formData);
  const domainId = cleanText(formData.get("domainId"), 80);

  if (!domainId) {
    domainsRedirect(storeId, "missing-domain");
  }

  const { data: domain } = await supabase
    .from("store_domains" as never)
    .select("id, hostname, status, verification_status, dns_status, ssl_status")
    .eq("id", domainId)
    .eq("store_instance_id", storeId)
    .maybeSingle();

  if (!domain) {
    domainsRedirect(storeId, "domain-not-found");
  }

  const domainRow = domain as {
    dns_status?: string | null;
    hostname: string;
    ssl_status?: string | null;
    status?: string | null;
    verification_status?: string | null;
  };
  const verified =
    domainRow.status === "verified" ||
    (domainRow.verification_status === "verified" && domainRow.dns_status === "verified");

  if (!verified) {
    domainsRedirect(storeId, "not-verified");
  }

  await clearPrimaryDomain(supabase, storeId);

  const { error } = await supabase
    .from("store_domains" as never)
    .update({
      error_message: null,
      is_primary: true,
      last_checked_at: new Date().toISOString(),
      primary_domain: domainRow.hostname,
      ssl_status: domainRow.ssl_status === "ready" ? "active" : (domainRow.ssl_status ?? "active"),
      status: "active",
      verified_at: new Date().toISOString()
    } as never)
    .eq("id", domainId)
    .eq("store_instance_id", storeId);

  if (error) {
    domainsRedirect(storeId, "activation-failed");
  }

  await recordDomainVerificationLog({
    domainId,
    hostname: domainRow.hostname,
    message: "Verified domain was activated as the primary hostname.",
    status: "active",
    storeId,
    supabase,
    userId
  });

  revalidatePath("/dashboard/domains");
  domainsRedirect(storeId, "domain-activated");
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
