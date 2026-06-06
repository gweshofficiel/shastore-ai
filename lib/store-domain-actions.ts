"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordStoreAuditLogSafe } from "@/lib/audit/store-audit";
import { getCurrentUserSubscriptionAccess } from "@/lib/billing/access";
import {
  assertCanConnectCustomDomain,
  assertCanUseExistingCustomDomain
} from "@/lib/billing/domain-access";
import { getBillingPlan } from "@/lib/billing/plans";
import { assertStoreMutationAllowed } from "@/lib/billing/store-access";
import { calculateDomainLineCreditQuote } from "@/lib/domains/domain-credit";
import {
  buildDomainPaymentPreparation,
  type DomainPaymentPreparationStatus
} from "@/lib/domains/domain-payment-preparation";
import { getDomainExtension, normalizeDomainExtension } from "@/lib/domains/extension-catalog";
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
import { getActiveWorkspaceForUser } from "@/lib/workspaces/active-workspace";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

type ClaimedStoreRow = {
  access_role?: string | null;
  id: string;
  owner_user_id?: string | null;
  workspace_id?: string | null;
};

type DomainLifecycleStatus = "pending" | "verifying" | "verified" | "active" | "failed";

type DomainStoreDataRecord = {
  cnameTarget: string;
  connectedAt: string | null;
  dnsStatus: string;
  domainType: "custom" | "subdomain";
  hostname: string;
  isPrimary: boolean;
  packageSource: "store-domain-actions";
  sslStatus: string;
  status: string;
  updatedAt: string;
  verificationStatus: string;
};

type DomainOrderDraftRecord = {
  createdAt: string;
  creditUsed: number;
  creditUsedCents: number;
  customerDue: number;
  customerDueCents: number;
  domainPrice: number;
  domainPriceCents: number;
  extension: string;
  futureHookPoints: {
    autoConnectAfterPurchase: "reserved";
    availabilityRefresh: "reserved";
    attachDomainToStore: "reserved";
    checkPlatformBalance: "reserved";
    confirmPayment: "reserved";
    createPaymentSession: "reserved";
    paymentSession: "reserved";
    registerDomain: "reserved";
    registrationRequest: "reserved";
    startSslProvisioning: "reserved";
    sslProvisioningAfterConnection: "reserved";
  };
  id: string;
  includedDomainCredit: number;
  includedDomainCreditCents: number;
  planMonthlyPrice: string;
  paymentPreparation: {
    amountDueNowCents: number;
    nextStep: DomainPaymentPreparationStatus;
    paymentRequired: boolean;
    primaryStatus: DomainPaymentPreparationStatus;
    statuses: DomainPaymentPreparationStatus[];
  };
  paymentPreparationStatus: DomainPaymentPreparationStatus;
  platformBalanceSafetyStatus: "blocked_until_platform_balance_check";
  selectedDomain: string;
  selectedPlan: {
    id: string;
    name: string;
  };
  status: "draft";
  storeId: string;
  storeName: string;
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

function cleanPreviewDomain(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "")
    .replace(/\s+/g, "-")
    .replace(/(^\.|\.$)+/g, "")
    .slice(0, 253);
}

function createDomainVerificationToken() {
  return randomUUID().replace(/-/g, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

async function writeDomainStoreDataRecord({
  record,
  storeId,
  supabase
}: {
  record: DomainStoreDataRecord;
  storeId: string;
  supabase: SupabaseClient;
}) {
  const { data, error: loadError } = await supabase
    .from("stores" as never)
    .select("store_data")
    .eq("id" as never, storeId as never)
    .maybeSingle();

  if (loadError) {
    console.warn("[store-domains] store_data domain mirror skipped", {
      message: loadError.message,
      storeId
    });
    return;
  }

  const storeRow: Record<string, unknown> = isRecord(data) ? data : {};
  const storeData = isRecord(storeRow.store_data) ? storeRow.store_data : {};
  const domainConnectionRecords = isRecord(storeData.domainConnectionRecords)
    ? storeData.domainConnectionRecords
    : {};
  const { error } = await supabase
    .from("stores" as never)
    .update({
      store_data: {
        ...storeData,
        domainConnectionRecords: {
          ...domainConnectionRecords,
          [record.hostname]: record
        },
        domainConnectionSummary: {
          defaultUrlActive: true,
          hostinshHooksReady: Boolean(process.env.HOSTINSH_API_KEY),
          lastUpdatedAt: record.updatedAt,
          sslProvisioningMode: "placeholder"
        }
      },
      updated_at: record.updatedAt
    } as never)
    .eq("id" as never, storeId as never);

  if (error) {
    console.warn("[store-domains] store_data domain mirror failed", {
      message: error.message,
      storeId
    });
  }
}

async function writeDomainOrderDraft({
  draft,
  storeId,
  supabase
}: {
  draft: DomainOrderDraftRecord;
  storeId: string;
  supabase: SupabaseClient;
}) {
  const { data, error: loadError } = await supabase
    .from("stores" as never)
    .select("store_data")
    .eq("id" as never, storeId as never)
    .maybeSingle();

  if (loadError) {
    console.warn("[store-domains] domain order draft load failed", {
      message: loadError.message,
      storeId
    });
    domainsRedirect(storeId, "domain-order-draft-failed");
  }

  const storeRow: Record<string, unknown> = isRecord(data) ? data : {};
  const storeData = isRecord(storeRow.store_data) ? storeRow.store_data : {};
  const domainOrderDrafts = isRecord(storeData.domainOrderDrafts)
    ? storeData.domainOrderDrafts
    : {};
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("stores" as never)
    .update({
      store_data: {
        ...storeData,
        domainOrderDrafts: {
          ...domainOrderDrafts,
          [draft.id]: draft
        },
        domainOrderPreparationSummary: {
          latestDraftId: draft.id,
          latestStatus: "draft",
          latestUpdatedAt: now,
          paymentPreparationStatus: draft.paymentPreparationStatus,
          nextStep: draft.paymentPreparation.nextStep,
          platformBalanceSafetyStatus: draft.platformBalanceSafetyStatus,
          createPaymentSession: "reserved",
          confirmPayment: "reserved",
          checkPlatformBalance: "reserved",
          registerDomain: "reserved",
          attachDomainToStore: "reserved",
          startSslProvisioning: "reserved",
          availabilityRefresh: "reserved",
          registrationRequest: "reserved",
          autoConnectAfterPurchase: "reserved",
          paymentSession: "reserved",
          sslProvisioningAfterConnection: "reserved"
        }
      },
      updated_at: now
    } as never)
    .eq("id" as never, storeId as never);

  if (error) {
    console.warn("[store-domains] domain order draft write failed", {
      message: error.message,
      storeId
    });
    domainsRedirect(storeId, "domain-order-draft-failed");
  }
}

async function mirrorDomainToStoreData({
  connectedAt = null,
  dnsStatus,
  domainType,
  hostname,
  isPrimary,
  sslStatus,
  status,
  storeId,
  supabase,
  verificationStatus
}: Omit<DomainStoreDataRecord, "cnameTarget" | "connectedAt" | "packageSource" | "updatedAt"> & {
  connectedAt?: string | null;
  storeId: string;
  supabase: SupabaseClient;
}) {
  await writeDomainStoreDataRecord({
    record: {
      cnameTarget: getDefaultDnsTarget(),
      connectedAt,
      dnsStatus,
      domainType,
      hostname,
      isPrimary,
      packageSource: "store-domain-actions",
      sslStatus,
      status,
      updatedAt: new Date().toISOString(),
      verificationStatus
    },
    storeId,
    supabase
  });
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

async function getClaimedStore(supabase: SupabaseClient, storeId: string, userId: string) {
  const { data, error } = await supabase.rpc(
    "get_claimed_store_instances_for_current_user" as never
  );

  if (!error && Array.isArray(data)) {
    const claimedStore =
      (data as ClaimedStoreRow[]).find(
        (store) =>
          store.id === storeId &&
          (!store.access_role || store.access_role === "owner" || store.access_role === "admin")
      ) ?? null;

    if (claimedStore) {
      return claimedStore;
    }
  }

  const workspaceSelection = await getActiveWorkspaceForUser({ supabase, userId });
  const { data: store } = await supabase
    .from("stores" as never)
    .select("id, owner_user_id, workspace_id")
    .eq("id" as never, storeId as never)
    .maybeSingle();
  const storeRow = isRecord(store) ? (store as ClaimedStoreRow) : null;

  if (
    storeRow &&
    (storeRow.owner_user_id === userId ||
      storeRow.workspace_id === workspaceSelection.activeWorkspaceId)
  ) {
    return {
      ...storeRow,
      access_role: "owner"
    };
  }

  return null;
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

  const claimedStore = await getClaimedStore(supabase, storeId, user.id);

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

  await mirrorDomainToStoreData({
    connectedAt: new Date().toISOString(),
    dnsStatus: "verified",
    domainType: "subdomain",
    hostname,
    isPrimary: true,
    sslStatus: "active",
    status: "active",
    storeId,
    supabase,
    verificationStatus: "verified"
  });

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

  await mirrorDomainToStoreData({
    dnsStatus: "pending",
    domainType: "custom",
    hostname,
    isPrimary: makePrimary,
    sslStatus: "pending",
    status: "pending",
    storeId,
    supabase,
    verificationStatus: "pending"
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

export async function prepareDomainOrderDraft(formData: FormData) {
  const { storeId, supabase, userId } = await requireClaimedStore(formData);
  const selectedDomain = cleanPreviewDomain(formData.get("selectedDomain"));
  const extension = normalizeDomainExtension(cleanText(formData.get("extension"), 40));
  const extensionCatalogItem = getDomainExtension(extension);
  const storeName = cleanText(formData.get("storeName"), 160) || "Selected store";

  try {
    await assertStoreMutationAllowed(supabase, userId, { id: storeId });
  } catch {
    domainsRedirect(storeId, "store-locked");
  }

  if (
    !selectedDomain ||
    !extensionCatalogItem ||
    !selectedDomain.includes(".") ||
    !selectedDomain.endsWith(extensionCatalogItem.extension)
  ) {
    domainsRedirect(storeId, "invalid-domain");
  }

  const access = await getCurrentUserSubscriptionAccess();
  const plan = access?.plan ?? getBillingPlan("free");
  const credit = calculateDomainLineCreditQuote({
    domainPriceCents: extensionCatalogItem.registrationPriceCents,
    plan
  });
  const paymentPreparation = buildDomainPaymentPreparation(credit.customerDueCents);
  const createdAt = new Date().toISOString();
  const draft: DomainOrderDraftRecord = {
    createdAt,
    creditUsed: credit.creditUsedCents,
    creditUsedCents: credit.creditUsedCents,
    customerDue: credit.customerDueCents,
    customerDueCents: credit.customerDueCents,
    domainPrice: credit.domainPriceCents,
    domainPriceCents: credit.domainPriceCents,
    extension: extensionCatalogItem.extension,
    futureHookPoints: {
      autoConnectAfterPurchase: "reserved",
      availabilityRefresh: "reserved",
      attachDomainToStore: "reserved",
      checkPlatformBalance: "reserved",
      confirmPayment: "reserved",
      createPaymentSession: "reserved",
      paymentSession: "reserved",
      registerDomain: "reserved",
      registrationRequest: "reserved",
      startSslProvisioning: "reserved",
      sslProvisioningAfterConnection: "reserved"
    },
    id: randomUUID(),
    includedDomainCredit: credit.includedCreditCents,
    includedDomainCreditCents: credit.includedCreditCents,
    planMonthlyPrice: credit.planPrice,
    paymentPreparation,
    paymentPreparationStatus: paymentPreparation.primaryStatus,
    platformBalanceSafetyStatus: "blocked_until_platform_balance_check",
    selectedDomain,
    selectedPlan: {
      id: credit.planId,
      name: credit.planName
    },
    status: "draft",
    storeId,
    storeName
  };

  await writeDomainOrderDraft({
    draft,
    storeId,
    supabase
  });

  await recordStoreAuditLogSafe({
    action: "domain_order_draft_prepared",
    actorUserId: userId,
    metadata: {
      customerDueCents: draft.customerDueCents,
      extension: draft.extension,
      paymentPreparationStatus: draft.paymentPreparationStatus,
      source: "store_data_domain_order_drafts",
      status: draft.status
    },
    storeId,
    supabase
  });

  revalidatePath("/dashboard/domains");
  domainsRedirect(storeId, "domain-order-draft-prepared");
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
        : "DNS verification is waiting for service settings. Add the CNAME and TXT records shown in the dashboard.",
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
      : "Verification is pending because service settings are not configured.",
    status: "verifying",
    storeId,
    supabase,
    userId
  });

  await mirrorDomainToStoreData({
    dnsStatus: "pending",
    domainType: (domain as { domain_type?: string | null }).domain_type === "subdomain" ? "subdomain" : "custom",
    hostname: (domain as { hostname: string }).hostname,
    isPrimary: false,
    sslStatus: "pending",
    status: "verifying",
    storeId,
    supabase,
    verificationStatus: "pending"
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

  await mirrorDomainToStoreData({
    connectedAt: new Date().toISOString(),
    dnsStatus: "verified",
    domainType: "custom",
    hostname: domainRow.hostname,
    isPrimary: true,
    sslStatus: domainRow.ssl_status === "ready" ? "active" : (domainRow.ssl_status ?? "active"),
    status: "active",
    storeId,
    supabase,
    verificationStatus: "verified"
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
