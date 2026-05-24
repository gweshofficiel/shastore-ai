"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordStoreAuditLogSafe } from "@/lib/audit/store-audit";
import {
  buildDnsVerification,
  buildNameserverInstructions,
  getDefaultDnsTarget,
  verifyDomainWithHostinsh
} from "@/lib/domains/hostinsh";
import {
  canConnectAnotherDomain
} from "@/lib/billing/domain-access";
import { getUserSubscriptionAccess } from "@/lib/billing/access";
import {
  buildFreeHostname,
  cleanSourceSlug,
  createVerificationToken,
  normalizeHostname,
  normalizeSubdomain,
  sourcePublicationUrl
} from "@/lib/domains/utils";
import { createClient } from "@/lib/supabase/server";
import type { DomainRecord, DomainSourceType } from "@/lib/domains/types";

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

function sourceTypeFromForm(formData: FormData): DomainSourceType {
  return formData.get("sourceType") === "store" ? "store" : "landing";
}

async function createUniqueFreeHostname(
  supabase: Awaited<ReturnType<typeof createClient>>,
  preferred: string
) {
  const base = normalizeSubdomain(preferred) || `brand-${crypto.randomUUID().slice(0, 6)}`;

  for (let index = 0; index < 12; index += 1) {
    const candidate = index === 0 ? base : `${base}-${index + 1}`;
    const hostname = buildFreeHostname(candidate);
    const { data } = await supabase
      .from("publication_hosts" as never)
      .select("id")
      .eq("hostname", hostname)
      .maybeSingle();

    if (!data) {
      return { hostname, subdomain: candidate };
    }
  }

  const fallback = `${base}-${crypto.randomUUID().slice(0, 6)}`;
  return { hostname: buildFreeHostname(fallback), subdomain: fallback };
}

async function upsertPublicationHost({
  domainId,
  hostname,
  sourceSlug,
  sourceType,
  status,
  userId
}: {
  domainId: string;
  hostname: string;
  sourceSlug: string;
  sourceType: DomainSourceType;
  status: "pending" | "published";
  userId: string;
}) {
  const supabase = await createClient();
  const publicationStatus = status === "published" ? "published" : "draft";

  await supabase.from("publication_hosts" as never).upsert({
    canonical_url: `https://${hostname}`,
    domain_id: domainId,
    hostname,
    publication_url: sourcePublicationUrl(sourceType, sourceSlug),
    published_at: publicationStatus === "published" ? new Date().toISOString() : null,
    robots_indexable: publicationStatus === "published",
    sitemap_enabled: true,
    source_slug: sourceSlug,
    source_type: sourceType,
    status: publicationStatus,
    user_id: userId
  } as never, { onConflict: "hostname" });

  await supabase.from("publish_events" as never).insert({
    event_type: status === "published" ? "host_published" : "host_prepared",
    hostname,
    metadata: {
      publicationUrl: sourcePublicationUrl(sourceType, sourceSlug)
    },
    source_slug: sourceSlug,
    source_type: sourceType,
    user_id: userId
  } as never);
}

async function storeIdForStoreSource(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sourceSlug: string,
  userId: string
) {
  const { data } = await supabase
    .from("stores")
    .select("id")
    .eq("slug", sourceSlug)
    .or(`owner_user_id.eq.${userId},user_id.eq.${userId}`)
    .maybeSingle();

  return (data as { id?: string } | null)?.id ?? null;
}

export async function reserveFreeSubdomain(formData: FormData) {
  const { supabase, user } = await requireUser();
  const sourceType = sourceTypeFromForm(formData);
  const sourceSlug = cleanSourceSlug(String(formData.get("sourceSlug") ?? ""));
  const preferredSubdomain = String(formData.get("freeSubdomain") ?? sourceSlug);

  if (!sourceSlug) {
    redirect("/dashboard/domains?error=missing-source");
  }

  const { hostname, subdomain } = await createUniqueFreeHostname(supabase, preferredSubdomain);
  const token = createVerificationToken();
  const { data: domain, error } = await supabase
    .from("domains" as never)
    .insert({
      dns_target: getDefaultDnsTarget(),
      hostname,
      kind: "free_subdomain",
      nameserver_instructions: buildNameserverInstructions(hostname),
      ssl_status: "ready",
      status: "verified",
      user_id: user.id,
      verification_token: token
    } as never)
    .select("*")
    .single();

  if (error || !domain) {
    redirect("/dashboard/domains?error=domain-migration-required");
  }

  await upsertPublicationHost({
    domainId: (domain as DomainRecord).id,
    hostname,
    sourceSlug,
    sourceType,
    status: "published",
    userId: user.id
  });
  await recordStoreAuditLogSafe({
    action: "domain_connected",
    actorUserId: user.id,
    metadata: {
      domainType: "subdomain",
      source: "domains"
    },
    storeId:
      sourceType === "store"
        ? await storeIdForStoreSource(supabase, sourceSlug, user.id)
        : null,
    supabase
  });

  revalidatePath("/dashboard/domains");
  redirect(`/dashboard/domains?saved=${subdomain}`);
}

export async function connectCustomDomain(formData: FormData) {
  const { supabase, user } = await requireUser();
  const sourceType = sourceTypeFromForm(formData);
  const sourceSlug = cleanSourceSlug(String(formData.get("sourceSlug") ?? ""));
  const hostname = normalizeHostname(String(formData.get("customDomain") ?? ""));

  if (!sourceSlug || !hostname) {
    redirect("/dashboard/domains?error=missing-domain");
  }

  const subscription = await getUserSubscriptionAccess(user.id);
  const domainAccess = canConnectAnotherDomain({ subscription });

  if (!domainAccess.allowed) {
    redirect("/dashboard/domains?error=limit-reached");
  }

  const token = createVerificationToken();
  const verification = buildDnsVerification(hostname, token);
  const { data: domain, error } = await supabase
    .from("domains" as never)
    .insert({
      dns_target: getDefaultDnsTarget(),
      hostname,
      kind: "custom_domain",
      nameserver_instructions: buildNameserverInstructions(hostname),
      ssl_status: "pending",
      status: "pending",
      user_id: user.id,
      verification_token: token
    } as never)
    .select("*")
    .single();

  if (error || !domain) {
    redirect("/dashboard/domains?error=domain-conflict-or-migration-required");
  }

  const domainRecord = domain as DomainRecord;

  await supabase.from("dns_verifications" as never).insert({
    domain_id: domainRecord.id,
    hostname,
    record_name: verification.recordName,
    record_type: verification.recordType,
    record_value: verification.recordValue,
    status: "pending",
    user_id: user.id
  } as never);

  await upsertPublicationHost({
    domainId: domainRecord.id,
    hostname,
    sourceSlug,
    sourceType,
    status: "pending",
    userId: user.id
  });
  await recordStoreAuditLogSafe({
    action: "domain_connected",
    actorUserId: user.id,
    metadata: {
      domainType: "custom",
      source: "domains"
    },
    storeId:
      sourceType === "store"
        ? await storeIdForStoreSource(supabase, sourceSlug, user.id)
        : null,
    supabase
  });

  revalidatePath("/dashboard/domains");
  redirect(`/dashboard/domains?saved=${hostname}`);
}

export async function verifyDomainAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  const domainId = String(formData.get("domainId") ?? "");
  const { data: domain } = await supabase
    .from("domains" as never)
    .select("*")
    .eq("id", domainId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!domain) {
    redirect("/dashboard/domains?error=domain-not-found");
  }

  const { data: verification } = await supabase
    .from("dns_verifications" as never)
    .select("*")
    .eq("domain_id", domainId)
    .eq("user_id", user.id)
    .maybeSingle();

  const result = await verifyDomainWithHostinsh(
    domain as DomainRecord,
    verification as never
  );

  await supabase
    .from("dns_verifications" as never)
    .update({
      checked_at: new Date().toISOString(),
      status: result.status
    } as never)
    .eq("domain_id", domainId)
    .eq("user_id", user.id);

  if (result.status === "verified") {
    await supabase
      .from("domains" as never)
      .update({ ssl_status: "ready", status: "verified" } as never)
      .eq("id", domainId)
      .eq("user_id", user.id);
  }

  revalidatePath("/dashboard/domains");
  redirect(`/dashboard/domains?verified=${result.status}`);
}
