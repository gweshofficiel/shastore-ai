import type { DomainDnsSetupStatus, DomainSslStatus } from "@/lib/domains/domain-dns-ssl";

export type ConnectedDomainStatus =
  | "draft"
  | "awaiting_payment"
  | "ready_for_registration"
  | "dns_pending"
  | "dns_verified"
  | "ssl_pending"
  | "ssl_active"
  | "connected"
  | "primary";

export type DomainRoutingStatus = "preparation_only" | "ready_for_future_routing";

export type DomainRoutingFutureHooks = {
  addDomainToDeploymentPlatform: "reserved";
  attachDomainToStoreRuntime: "reserved";
  keepFallbackUrlActive: "reserved";
  redirectDefaultSubdomainToPrimaryDomain: "reserved";
  verifyDomainOwnership: "reserved";
};

export type DomainRoutingPreparation = {
  createdAt: string;
  fallbackShastoreSubdomain: string;
  futureHookPoints: DomainRoutingFutureHooks;
  id: string;
  primaryDomain: string;
  routingStatus: DomainRoutingStatus;
  selectedStoreId: string;
};

export type ConnectedDomainSummary = {
  canPreparePrimary: boolean;
  dnsStatus: DomainDnsSetupStatus | "not_started";
  domain: string;
  isPrimary: boolean;
  sourceId: string;
  sslStatus: DomainSslStatus | "ssl_pending";
  status: ConnectedDomainStatus;
  storeId: string;
};

export function domainRoutingFutureHooks(): DomainRoutingFutureHooks {
  return {
    addDomainToDeploymentPlatform: "reserved",
    attachDomainToStoreRuntime: "reserved",
    keepFallbackUrlActive: "reserved",
    redirectDefaultSubdomainToPrimaryDomain: "reserved",
    verifyDomainOwnership: "reserved"
  };
}

export function buildDomainRoutingPreparation({
  fallbackShastoreSubdomain,
  id,
  primaryDomain,
  selectedStoreId
}: {
  fallbackShastoreSubdomain: string;
  id: string;
  primaryDomain: string;
  selectedStoreId: string;
}): DomainRoutingPreparation {
  return {
    createdAt: new Date().toISOString(),
    fallbackShastoreSubdomain,
    futureHookPoints: domainRoutingFutureHooks(),
    id,
    primaryDomain,
    routingStatus: "preparation_only",
    selectedStoreId
  };
}
