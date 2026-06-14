export type OpenAICreditLedgerOperation =
  | "adjustment"
  | "deduction"
  | "refund"
  | "reservation";

export type OpenAICreditLedgerStatus =
  | "blocked"
  | "charged"
  | "failed"
  | "refunded"
  | "released"
  | "reserved"
  | "skipped";

export type OpenAIJobCreditStatus =
  | "blocked_insufficient"
  | "charged"
  | "failed"
  | "not_required"
  | "refunded"
  | "released"
  | "reserved";

export type OpenAICreditLedgerEntry = {
  amount: number;
  assetType: string | null;
  balanceAfter: number | null;
  balanceBefore: number | null;
  createdAt: string;
  errorCode: string | null;
  id: string;
  idempotencyKey: string;
  jobId: string;
  operation: OpenAICreditLedgerOperation;
  providerKey: string;
  safeErrorMessage: string | null;
  status: OpenAICreditLedgerStatus;
  storeId: string | null;
  userId: string | null;
  workspaceId: string | null;
};

export type OpenAICreditOperationInput = {
  amount: number;
  assetType?: string | null;
  jobId: string;
  storeId?: string | null;
  userId?: string | null;
  workspaceId?: string | null;
};

export type OpenAICreditOperationResult = {
  amount: number;
  availableCredits: number | null;
  creditStatus: OpenAIJobCreditStatus;
  error: string | null;
  ledgerEntry: OpenAICreditLedgerEntry | null;
  ok: boolean;
};

export type OpenAICreditRuntimeSnapshot = {
  chargedCredits: number;
  failedOperations: number;
  generatedAt: string;
  recentEntries: OpenAICreditLedgerEntry[];
  refundedCredits: number;
  releasedCredits: number;
  reservedCredits: number;
  totalEntries: number;
};
