import type { DomainRecord, DnsVerification } from "@/lib/domains/types";

export type HostinshDnsCheck = {
  configured: boolean;
  status: "pending" | "verified" | "failed";
  message: string;
};

export type HostinshHookResult = {
  configured: boolean;
  hook: "domain_purchase" | "domain_search" | "email_purchase" | "reseller_balance";
  message: string;
  status: "placeholder";
};

export function getDomainBase() {
  return process.env.NEXT_PUBLIC_SHASTORE_DOMAIN || "shastore.ai";
}

export function getDefaultDnsTarget() {
  return process.env.HOSTINSH_DNS_TARGET || "cname.hostinsh.shastore.ai";
}

export function buildNameserverInstructions(hostname: string) {
  return [
    `Add ${hostname} in your HOSTINSH DNS zone.`,
    `Create a CNAME record pointing to ${getDefaultDnsTarget()}.`,
    "Keep the TXT verification record until the domain is verified.",
    "SSL provisioning will be marked ready after the production HOSTINSH API is connected."
  ];
}

export function buildDnsVerification(hostname: string, token: string) {
  return {
    recordName: `_shastore.${hostname}`,
    recordType: "TXT" as const,
    recordValue: `shastore-verify=${token}`
  };
}

export async function verifyDomainWithHostinsh(
  domain: DomainRecord,
  verification?: DnsVerification | null
): Promise<HostinshDnsCheck> {
  if (!process.env.HOSTINSH_API_KEY) {
    return {
      configured: false,
      status: "pending",
      message: `HOSTINSH API credentials are not configured. Add TXT ${verification?.record_name ?? `_shastore.${domain.hostname}`} with ${verification?.record_value ?? domain.verification_token}.`
    };
  }

  return {
    configured: true,
    status: "pending",
    message: "HOSTINSH API adapter is ready. Live DNS verification can be enabled when credentials and endpoint details are finalized."
  };
}

function placeholderHook(hook: HostinshHookResult["hook"]): HostinshHookResult {
  return {
    configured: Boolean(process.env.HOSTINSH_API_KEY),
    hook,
    message: "Future purchase service hook is reserved. No external call or customer charge is performed.",
    status: "placeholder"
  };
}

export async function searchHostinshDomain() {
  return placeholderHook("domain_search");
}

export async function purchaseHostinshDomain() {
  return placeholderHook("domain_purchase");
}

export async function purchaseHostinshEmail() {
  return placeholderHook("email_purchase");
}

export async function checkHostinshResellerBalance() {
  return placeholderHook("reseller_balance");
}

export type DomainProvisioningPlan = {
  hostname: string;
  subdomain: string;
  dnsTarget: string;
  verificationToken: string;
  instructions: string[];
};

const defaultDnsTarget = "cname.vercel-dns.com";

export function createSubdomain(userSlug: string) {
  const base = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN ?? "shastore.ai";
  return `${userSlug}.${base}`;
}

export function createDomainProvisioningPlan(
  hostname: string,
  userSlug: string
): DomainProvisioningPlan {
  const subdomain = createSubdomain(userSlug);
  const verificationToken = crypto.randomUUID();
  const dnsTarget = process.env.HOSTINSH_DNS_TARGET ?? defaultDnsTarget;

  return {
    hostname,
    subdomain,
    dnsTarget,
    verificationToken,
    instructions: [
      `Create a CNAME record for ${hostname} pointing to ${dnsTarget}.`,
      `Add TXT verification token: ${verificationToken}.`,
      "HOSTINSH API integration can verify DNS and attach the domain during publish."
    ]
  };
}
