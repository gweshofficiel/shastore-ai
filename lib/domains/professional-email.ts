export type ProfessionalEmailMailboxType = "info" | "support" | "sales";

export type ProfessionalEmailMailboxStatus = "draft" | "pending" | "active" | "failed";

export type ProfessionalEmailMailboxPlanId = "starter_mailbox" | "business_mailbox" | "team_mailbox";

export type ProfessionalEmailFutureHooks = {
  checkDomainOwnership: "reserved";
  createMailbox: "reserved";
  setupDnsRecords: "reserved";
  renewMailbox: "reserved";
  resetPassword: "reserved";
  suspendMailbox: "reserved";
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
  allowanceUsed: number;
  createdAt: string;
  customerDue: number;
  customerDueCents: number;
  domain: string;
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
    checkDomainOwnership: "reserved",
    createMailbox: "reserved",
    setupDnsRecords: "reserved",
    renewMailbox: "reserved",
    resetPassword: "reserved",
    suspendMailbox: "reserved"
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
