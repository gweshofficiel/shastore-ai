import "server-only";
import type { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type DomainOrderStatus = "draft" | "submitted" | "pending" | "active" | "failed";

export type DomainOrderRecordInput = {
  createdAt: string;
  domainName: string;
  id: string;
  provider: "httpapi";
  providerEntityId?: string | null;
  providerOrderId?: string | null;
  rawResponse: unknown;
  registrationYears: number;
  status: DomainOrderStatus;
  storeId: string;
  tld: string;
};

export async function createDomainOrderRecord({
  createdAt,
  domainName,
  id,
  provider,
  providerEntityId = null,
  providerOrderId = null,
  rawResponse,
  registrationYears,
  status,
  storeId,
  supabase,
  tld
}: DomainOrderRecordInput & {
  supabase: SupabaseClient;
}) {
  const { error } = await supabase.from("domain_orders" as never).insert({
    created_at: createdAt,
    domain_name: domainName,
    id,
    provider,
    provider_entity_id: providerEntityId,
    provider_order_id: providerOrderId,
    raw_response: rawResponse ?? {},
    registration_years: registrationYears,
    status,
    store_id: storeId,
    tld
  } as never);

  return { error };
}

export async function updateDomainOrderRecord({
  id,
  providerEntityId,
  providerOrderId,
  rawResponse,
  status,
  supabase
}: {
  id: string;
  providerEntityId?: string | null;
  providerOrderId?: string | null;
  rawResponse: unknown;
  status: DomainOrderStatus;
  supabase: SupabaseClient;
}) {
  const { error } = await supabase
    .from("domain_orders" as never)
    .update({
      provider_entity_id: providerEntityId ?? null,
      provider_order_id: providerOrderId ?? null,
      raw_response: rawResponse ?? {},
      status
    } as never)
    .eq("id" as never, id as never);

  return { error };
}
