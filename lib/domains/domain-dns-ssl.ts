export type DomainDnsSetupStatus = "not_started" | "pending" | "verified" | "failed";

export type DomainSslStatus =
  | "ssl_pending"
  | "ssl_provisioning"
  | "ssl_active"
  | "ssl_failed";

export type DomainDnsRecordInstruction = {
  host: string;
  note: string;
  required: boolean;
  status: DomainDnsSetupStatus;
  ttl?: number;
  type: "CNAME" | "A" | "ALIAS" | "TXT";
  value: string;
  verificationStatus?: DomainDnsSetupStatus;
};

export type DomainDnsSetup = {
  domain: string;
  records: DomainDnsRecordInstruction[];
  status: DomainDnsSetupStatus;
  targetStore: string;
};

export type DomainSslSetup = {
  requestedAt: string | null;
  status: DomainSslStatus;
  targetDomain: string;
};

export type DomainDnsSslFutureHooks = {
  checkSslStatus: "reserved";
  markDomainAsConnected: "reserved";
  markDomainAsPrimary: "reserved";
  requestSsl: "reserved";
  verifyDns: "reserved";
};

const neutralDomainConnectionTarget = "domains.shastore.ai";

export function buildDomainDnsSetup({
  domain,
  status = "not_started",
  targetStore,
  verificationToken
}: {
  domain: string;
  status?: DomainDnsSetupStatus;
  targetStore: string;
  verificationToken: string;
}): DomainDnsSetup {
  return {
    domain,
    records: [
      {
        host: "www",
        note: "Required storefront record for the www hostname.",
        required: true,
        status,
        ttl: 3600,
        type: "CNAME",
        value: neutralDomainConnectionTarget,
        verificationStatus: status
      },
      {
        host: "@",
        note: "Apex/root instruction placeholder. Use ALIAS/ANAME flattening if your DNS provider supports it.",
        required: true,
        status,
        ttl: 3600,
        type: "ALIAS",
        value: neutralDomainConnectionTarget
      },
      {
        host: "@",
        note: "Reserved only if a root-domain address record is required later by the platform.",
        required: false,
        status: "not_started",
        ttl: 3600,
        type: "A",
        value: neutralDomainConnectionTarget,
        verificationStatus: "not_started"
      },
      {
        host: "_shastore-verification",
        note: "Required ownership verification record.",
        required: true,
        status,
        ttl: 3600,
        type: "TXT",
        value: verificationToken,
        verificationStatus: status
      }
    ],
    status,
    targetStore
  };
}

export function buildDomainSslSetup({
  status = "ssl_pending",
  targetDomain
}: {
  status?: DomainSslStatus;
  targetDomain: string;
}): DomainSslSetup {
  return {
    requestedAt: null,
    status,
    targetDomain
  };
}

export function domainDnsSslFutureHooks(): DomainDnsSslFutureHooks {
  return {
    checkSslStatus: "reserved",
    markDomainAsConnected: "reserved",
    markDomainAsPrimary: "reserved",
    requestSsl: "reserved",
    verifyDns: "reserved"
  };
}
