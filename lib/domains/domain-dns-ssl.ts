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
  type: "CNAME" | "A" | "TXT";
  value: string;
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
        host: "@",
        note: "Route the root domain to the SHASTORE storefront connection target.",
        required: true,
        status,
        type: "CNAME",
        value: neutralDomainConnectionTarget
      },
      {
        host: "@",
        note: "Reserved only if a root-domain address record is required later.",
        required: false,
        status: "not_started",
        type: "A",
        value: "pending"
      },
      {
        host: `_shastore-verification.${domain}`,
        note: "Used later to confirm domain ownership before connection.",
        required: true,
        status,
        type: "TXT",
        value: verificationToken
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
