export type ProfessionalEmailMailboxType = "info" | "support" | "sales";

export type ProfessionalEmailMailboxStatus = "draft" | "pending" | "active" | "failed";

export type ProfessionalEmailFutureHooks = {
  checkDomainOwnership: "reserved";
  createMailbox: "reserved";
  renewMailbox: "reserved";
  resetPassword: "reserved";
  suspendMailbox: "reserved";
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

export const professionalEmailMailboxTypes: ProfessionalEmailMailboxType[] = [
  "info",
  "support",
  "sales"
];

export function professionalEmailFutureHooks(): ProfessionalEmailFutureHooks {
  return {
    checkDomainOwnership: "reserved",
    createMailbox: "reserved",
    renewMailbox: "reserved",
    resetPassword: "reserved",
    suspendMailbox: "reserved"
  };
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
