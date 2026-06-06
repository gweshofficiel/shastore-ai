export type ProfessionalEmailMailboxType = "info" | "support" | "sales";

export type ProfessionalEmailMailboxStatus = "draft" | "pending" | "active" | "failed";

export type ProfessionalEmailMailboxPlanId = "starter_mailbox" | "business_mailbox" | "team_mailbox";

export type ProfessionalEmailActivationStatus =
  | "draft"
  | "awaiting_payment"
  | "ready_for_activation"
  | "dns_pending"
  | "dns_verified"
  | "active"
  | "failed";

export type ProfessionalEmailDnsRecordStatus = "pending" | "verified" | "failed";

export type ProfessionalEmailDnsRecordType = "MX" | "SPF" | "DKIM" | "DMARC";

export type ProfessionalEmailFutureHooks = {
  checkDomainOwnership: "reserved";
  createMailbox: "reserved";
  setupDnsRecords: "reserved";
  verifyDkim: "reserved";
  verifyDmarc: "reserved";
  verifyMx: "reserved";
  verifySpf: "reserved";
  activateMailbox: "reserved";
  resendSetupInstructions: "reserved";
  renewMailbox: "reserved";
  resetPassword: "reserved";
  suspendMailbox: "reserved";
};

export type ProfessionalEmailDnsRecord = {
  host: string;
  note: string;
  status: ProfessionalEmailDnsRecordStatus;
  type: ProfessionalEmailDnsRecordType;
  value: string;
};

export type ProfessionalEmailDnsSetup = {
  domain: string;
  records: ProfessionalEmailDnsRecord[];
  status: "dns_pending" | "dns_verified" | "failed";
};

export type ProfessionalEmailMailboxPlan = {
  id: ProfessionalEmailMailboxPlanId;
  label: string;
  monthlyPriceCents: number;
  storagePlaceholder: string;
  yearlyPriceCents: number;
};

export type ProfessionalEmailMailboxDraft = {
  createdAt: string;
  domain: string;
  emailAddress: string;
  futureHookPoints: ProfessionalEmailFutureHooks;
  id: string;
  mailboxType: ProfessionalEmailMailboxType;
  status: ProfessionalEmailMailboxStatus;
  storagePlaceholder: string;
  storeId: string;
};

export type ProfessionalEmailOrderDraft = {
  activationStatus: ProfessionalEmailActivationStatus;
  activationStatuses: ProfessionalEmailActivationStatus[];
  allowanceUsed: number;
  createdAt: string;
  customerDue: number;
  customerDueCents: number;
  domain: string;
  emailDnsSetup: ProfessionalEmailDnsSetup;
  futureHookPoints: ProfessionalEmailFutureHooks;
  id: string;
  mailboxAddress: string;
  mailboxPlan: ProfessionalEmailMailboxPlan;
  price: {
    monthlyCents: number;
    yearlyCents: number;
  };
  status: "draft";
  storeId: string;
};

export const professionalEmailMailboxTypes: ProfessionalEmailMailboxType[] = [
  "info",
  "support",
  "sales"
];

export const professionalEmailMailboxPlans: ProfessionalEmailMailboxPlan[] = [
  {
    id: "starter_mailbox",
    label: "Starter mailbox",
    monthlyPriceCents: 500,
    storagePlaceholder: "Starter mailbox storage placeholder",
    yearlyPriceCents: 5000
  },
  {
    id: "business_mailbox",
    label: "Business mailbox",
    monthlyPriceCents: 1200,
    storagePlaceholder: "Business mailbox storage placeholder",
    yearlyPriceCents: 12000
  },
  {
    id: "team_mailbox",
    label: "Team mailbox",
    monthlyPriceCents: 2500,
    storagePlaceholder: "Team mailbox storage placeholder",
    yearlyPriceCents: 25000
  }
];

export function professionalEmailFutureHooks(): ProfessionalEmailFutureHooks {
  return {
    activateMailbox: "reserved",
    checkDomainOwnership: "reserved",
    createMailbox: "reserved",
    resendSetupInstructions: "reserved",
    setupDnsRecords: "reserved",
    verifyDkim: "reserved",
    verifyDmarc: "reserved",
    verifyMx: "reserved",
    verifySpf: "reserved",
    renewMailbox: "reserved",
    resetPassword: "reserved",
    suspendMailbox: "reserved"
  };
}

export const professionalEmailActivationStatuses: ProfessionalEmailActivationStatus[] = [
  "draft",
  "awaiting_payment",
  "ready_for_activation",
  "dns_pending",
  "dns_verified",
  "active",
  "failed"
];

export function buildProfessionalEmailDnsSetup(domain: string): ProfessionalEmailDnsSetup {
  return {
    domain,
    records: [
      {
        host: "@",
        note: "Routes inbound mail for this domain after mailbox activation is connected.",
        status: "pending",
        type: "MX",
        value: "mail.shastore.email"
      },
      {
        host: "@",
        note: "Helps receiving mail systems recognize approved outbound mail.",
        status: "pending",
        type: "SPF",
        value: "v=spf1 include:shastore.email ~all"
      },
      {
        host: `shastore._domainkey.${domain}`,
        note: "Reserved signing record for future authenticated outbound mail.",
        status: "pending",
        type: "DKIM",
        value: "pending"
      },
      {
        host: `_dmarc.${domain}`,
        note: "Reserved policy record for future domain mail protection.",
        status: "pending",
        type: "DMARC",
        value: "v=DMARC1; p=none"
      }
    ],
    status: "dns_pending"
  };
}

export function getProfessionalEmailMailboxPlan(planId: string) {
  return professionalEmailMailboxPlans.find((plan) => plan.id === planId) ?? null;
}

export function includedProfessionalEmailMailboxAllowance(planId: string) {
  if (planId === "free") {
    return 0;
  }

  if (planId === "starter") {
    return 1;
  }

  if (planId === "pro") {
    return 3;
  }

  return 5;
}

export function professionalEmailAddress({
  domain,
  mailboxType
}: {
  domain: string;
  mailboxType: ProfessionalEmailMailboxType;
}) {
  return `${mailboxType}@${domain}`;
}

export function professionalEmailStoragePlaceholder(mailboxType: ProfessionalEmailMailboxType) {
  return `${mailboxType} mailbox storage will be configured when email activation is connected.`;
}
