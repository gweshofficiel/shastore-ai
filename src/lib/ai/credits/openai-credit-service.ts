import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { recordAiAuditLog } from "@/src/lib/ai/audit/ai-audit-log";
import { sanitizeOpenAIJobError } from "@/src/lib/ai/runtime/openai-job-model";
import type {
  OpenAICreditLedgerEntry,
  OpenAICreditLedgerOperation,
  OpenAICreditLedgerStatus,
  OpenAICreditOperationInput,
  OpenAICreditOperationResult,
  OpenAICreditRuntimeSnapshot
} from "@/src/lib/ai/credits/openai-credit-types";

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;

type CreditRow = {
  balance?: number | null;
  user_id?: string | null;
};

type LedgerRow = {
  amount?: number | null;
  asset_type?: string | null;
  balance_after?: number | null;
  balance_before?: number | null;
  created_at?: string | null;
  error_code?: string | null;
  id?: string | null;
  idempotency_key?: string | null;
  job_id?: string | null;
  operation?: OpenAICreditLedgerOperation | string | null;
  provider_key?: string | null;
  safe_error_message?: string | null;
  status?: OpenAICreditLedgerStatus | string | null;
  store_id?: string | null;
  user_id?: string | null;
  workspace_id?: string | null;
};

const MAX_LEDGER_ROWS = 200;

function text(value: unknown, maxLength = 240) {
  return typeof value === "string" && value.trim()
    ? value.trim().replace(/\s+/g, " ").slice(0, maxLength)
    : "";
}

function amountValue(value: unknown) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;

  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

function nullableUuid(value: unknown) {
  const cleaned = text(value, 80);

  return cleaned || null;
}

function idempotencyKey(jobId: string, operation: "deduction" | "refund" | "release" | "reservation") {
  return `openai:${jobId}:${operation}`;
}

function parseLedgerEntry(row: unknown): OpenAICreditLedgerEntry | null {
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    return null;
  }

  const value = row as LedgerRow;
  const id = text(value.id, 120);
  const jobId = text(value.job_id, 160);
  const operation = text(value.operation, 40) as OpenAICreditLedgerOperation;
  const status = text(value.status, 40) as OpenAICreditLedgerStatus;
  const createdAt = text(value.created_at, 80);

  if (!id || !jobId || !operation || !status || !createdAt) {
    return null;
  }

  return {
    amount: amountValue(value.amount),
    assetType: text(value.asset_type, 120) || null,
    balanceAfter: typeof value.balance_after === "number" ? value.balance_after : null,
    balanceBefore: typeof value.balance_before === "number" ? value.balance_before : null,
    createdAt,
    errorCode: text(value.error_code, 160) || null,
    id,
    idempotencyKey: text(value.idempotency_key, 240),
    jobId,
    operation,
    providerKey: text(value.provider_key, 80) || "openai",
    safeErrorMessage: sanitizeOpenAIJobError(value.safe_error_message),
    status,
    storeId: text(value.store_id, 120) || null,
    userId: text(value.user_id, 120) || null,
    workspaceId: text(value.workspace_id, 120) || null
  };
}

function failedResult(input: OpenAICreditOperationInput, error: string, creditStatus: OpenAICreditOperationResult["creditStatus"]): OpenAICreditOperationResult {
  return {
    amount: amountValue(input.amount),
    availableCredits: null,
    creditStatus,
    error: sanitizeOpenAIJobError(error),
    ledgerEntry: null,
    ok: false
  };
}

async function recordCreditAudit({
  entry,
  errorCode = null,
  eventType,
  input,
  safeErrorMessage = null,
  status
}: {
  entry?: OpenAICreditLedgerEntry | null;
  errorCode?: string | null;
  eventType:
    | "openai_credit_blocked_insufficient"
    | "openai_credit_check_started"
    | "openai_credit_deducted"
    | "openai_credit_refunded"
    | "openai_credit_reserved";
  input: OpenAICreditOperationInput;
  safeErrorMessage?: string | null;
  status: "blocked" | "failed" | "skipped" | "started" | "success";
}) {
  await recordAiAuditLog({
    assetType: input.assetType ?? entry?.assetType ?? null,
    errorCode,
    errorMessage: safeErrorMessage ? sanitizeOpenAIJobError(safeErrorMessage) : null,
    eventType,
    jobId: input.jobId,
    providerKey: "openai",
    safeSummary: {
      amount: amountValue(input.amount),
      balanceAfter: entry?.balanceAfter ?? null,
      balanceBefore: entry?.balanceBefore ?? null,
      creditOperation: entry?.operation ?? null,
      creditStatus: entry?.status ?? null,
      idempotencyKey: entry?.idempotencyKey ? "[recorded]" : null
    },
    status,
    storeId: input.storeId ?? entry?.storeId ?? null,
    userId: input.userId ?? entry?.userId ?? null,
    workspaceId: input.workspaceId ?? entry?.workspaceId ?? null
  });
}

async function ledgerRowsForJob(admin: AdminClient, jobId: string) {
  const { data } = await admin
    .from("openai_credit_ledger" as never)
    .select("*")
    .eq("job_id" as never, jobId as never)
    .order("created_at", { ascending: false })
    .limit(25);

  return (data ?? [])
    .map(parseLedgerEntry)
    .filter((entry): entry is OpenAICreditLedgerEntry => Boolean(entry));
}

async function ledgerEntryByIdempotencyKey(admin: AdminClient, key: string) {
  const { data } = await admin
    .from("openai_credit_ledger" as never)
    .select("*")
    .eq("idempotency_key" as never, key as never)
    .maybeSingle();

  return parseLedgerEntry(data);
}

async function availableCreditsForUser(admin: AdminClient, userId: string) {
  const { data } = await admin
    .from("credits" as never)
    .select("user_id, balance")
    .eq("user_id" as never, userId as never)
    .maybeSingle();
  const creditRow = data as CreditRow | null;
  const balance = typeof creditRow?.balance === "number" ? creditRow.balance : 0;
  const { data: reservationRows } = await admin
    .from("openai_credit_ledger" as never)
    .select("amount")
    .eq("user_id" as never, userId as never)
    .eq("operation" as never, "reservation" as never)
    .eq("status" as never, "reserved" as never)
    .limit(1000);
  const reserved = (reservationRows ?? [])
    .map((row) => amountValue((row as { amount?: unknown }).amount))
    .reduce((total, amount) => total + amount, 0);

  return {
    available: Math.max(0, balance - reserved),
    balance,
    reserved
  };
}

async function insertLedgerEntry({
  admin,
  balanceAfter,
  balanceBefore,
  errorCode = null,
  input,
  operation,
  referenceId = null,
  safeErrorMessage = null,
  status,
  suffix
}: {
  admin: AdminClient;
  balanceAfter?: number | null;
  balanceBefore?: number | null;
  errorCode?: string | null;
  input: OpenAICreditOperationInput;
  operation: OpenAICreditLedgerOperation;
  referenceId?: string | null;
  safeErrorMessage?: string | null;
  status: OpenAICreditLedgerStatus;
  suffix: "deduction" | "refund" | "release" | "reservation";
}) {
  const key = idempotencyKey(input.jobId, suffix);
  const existing = await ledgerEntryByIdempotencyKey(admin, key);

  if (existing) {
    return { entry: existing, inserted: false };
  }

  const { data, error } = await admin
    .from("openai_credit_ledger" as never)
    .insert({
      amount: amountValue(input.amount),
      asset_type: input.assetType ?? null,
      balance_after: balanceAfter ?? null,
      balance_before: balanceBefore ?? null,
      error_code: errorCode,
      idempotency_key: key,
      job_id: input.jobId,
      metadata: {
        creditRuntime: "openai",
        idempotent: true
      },
      operation,
      provider_key: "openai",
      reference_id: referenceId,
      safe_error_message: sanitizeOpenAIJobError(safeErrorMessage),
      status,
      store_id: nullableUuid(input.storeId),
      user_id: nullableUuid(input.userId),
      workspace_id: nullableUuid(input.workspaceId)
    } as never)
    .select("*")
    .single();

  if (error) {
    return { entry: null, error: error.message, inserted: false };
  }

  return {
    entry: parseLedgerEntry(data),
    inserted: true
  };
}

async function updateReservationStatus(admin: AdminClient, reservationId: string, status: OpenAICreditLedgerStatus) {
  await admin
    .from("openai_credit_ledger" as never)
    .update({ status } as never)
    .eq("id" as never, reservationId as never);
}

async function updateCreditBalance(admin: AdminClient, userId: string, nextBalance: number) {
  const { error } = await admin
    .from("credits" as never)
    .upsert({
      balance: Math.max(0, nextBalance),
      updated_at: new Date().toISOString(),
      user_id: userId
    } as never, { onConflict: "user_id" });

  return error?.message ?? null;
}

export async function reserveOpenAICredits(input: OpenAICreditOperationInput): Promise<OpenAICreditOperationResult> {
  const admin = createAdminClient();
  const amount = amountValue(input.amount);

  await recordCreditAudit({
    eventType: "openai_credit_check_started",
    input,
    status: "started"
  });

  if (!admin) {
    return failedResult(input, "Supabase admin client is not configured.", "failed");
  }

  if (!input.userId) {
    return failedResult(input, "OpenAI credit reservation requires an owner user.", "blocked_insufficient");
  }

  if (amount <= 0) {
    return {
      amount,
      availableCredits: null,
      creditStatus: "not_required",
      error: null,
      ledgerEntry: null,
      ok: true
    };
  }

  const existingRows = await ledgerRowsForJob(admin, input.jobId);
  const existingCharged = existingRows.find((row) => row.operation === "deduction" && row.status === "charged");

  if (existingCharged) {
    return {
      amount,
      availableCredits: existingCharged.balanceAfter,
      creditStatus: "charged",
      error: null,
      ledgerEntry: existingCharged,
      ok: true
    };
  }

  const existingReservation = existingRows.find((row) => row.operation === "reservation" && row.status === "reserved");

  if (existingReservation) {
    return {
      amount,
      availableCredits: existingReservation.balanceAfter,
      creditStatus: "reserved",
      error: null,
      ledgerEntry: existingReservation,
      ok: true
    };
  }

  const credits = await availableCreditsForUser(admin, input.userId);

  if (credits.available < amount) {
    const { entry } = await insertLedgerEntry({
      admin,
      balanceAfter: credits.balance,
      balanceBefore: credits.balance,
      errorCode: "openai_credit_insufficient",
      input,
      operation: "reservation",
      safeErrorMessage: `Insufficient OpenAI credits. ${amount} required, ${credits.available} available.`,
      status: "blocked",
      suffix: "reservation"
    });

    await recordCreditAudit({
      entry,
      errorCode: "openai_credit_insufficient",
      eventType: "openai_credit_blocked_insufficient",
      input,
      safeErrorMessage: `Insufficient OpenAI credits. ${amount} required, ${credits.available} available.`,
      status: "blocked"
    });

    return {
      amount,
      availableCredits: credits.available,
      creditStatus: "blocked_insufficient",
      error: `Insufficient OpenAI credits. ${amount} required, ${credits.available} available.`,
      ledgerEntry: entry,
      ok: false
    };
  }

  const { entry, error } = await insertLedgerEntry({
    admin,
    balanceAfter: credits.balance,
    balanceBefore: credits.balance,
    input,
    operation: "reservation",
    status: "reserved",
    suffix: "reservation"
  });

  if (error || !entry) {
    return failedResult(input, error ?? "OpenAI credit reservation failed.", "failed");
  }

  await recordCreditAudit({
    entry,
    eventType: "openai_credit_reserved",
    input,
    status: "success"
  });

  return {
    amount,
    availableCredits: credits.available - amount,
    creditStatus: "reserved",
    error: null,
    ledgerEntry: entry,
    ok: true
  };
}

export async function deductReservedOpenAICredits(input: OpenAICreditOperationInput): Promise<OpenAICreditOperationResult> {
  const admin = createAdminClient();
  const amount = amountValue(input.amount);

  if (!admin) {
    return failedResult(input, "Supabase admin client is not configured.", "failed");
  }

  if (!input.userId || amount <= 0) {
    return failedResult(input, "OpenAI credit deduction requires owner and positive amount.", "failed");
  }

  const existingDeduction = await ledgerEntryByIdempotencyKey(admin, idempotencyKey(input.jobId, "deduction"));

  if (existingDeduction?.status === "charged") {
    return {
      amount,
      availableCredits: existingDeduction.balanceAfter,
      creditStatus: "charged",
      error: null,
      ledgerEntry: existingDeduction,
      ok: true
    };
  }

  const rows = await ledgerRowsForJob(admin, input.jobId);
  const reservation = rows.find((row) => row.operation === "reservation" && row.status === "reserved");

  if (!reservation) {
    return failedResult(input, "OpenAI credit deduction skipped because no active reservation exists.", "failed");
  }

  const credits = await availableCreditsForUser(admin, input.userId);
  const nextBalance = Math.max(0, credits.balance - amount);
  const { entry, error, inserted } = await insertLedgerEntry({
    admin,
    balanceAfter: nextBalance,
    balanceBefore: credits.balance,
    input,
    operation: "deduction",
    referenceId: reservation.id,
    status: "charged",
    suffix: "deduction"
  });

  if (error || !entry) {
    return failedResult(input, error ?? "OpenAI credit deduction failed.", "failed");
  }

  if (inserted) {
    const balanceError = await updateCreditBalance(admin, input.userId, nextBalance);

    if (balanceError) {
      return failedResult(input, balanceError, "failed");
    }

    await updateReservationStatus(admin, reservation.id, "charged");
  }

  await recordCreditAudit({
    entry,
    eventType: "openai_credit_deducted",
    input,
    status: "success"
  });

  return {
    amount,
    availableCredits: nextBalance,
    creditStatus: "charged",
    error: null,
    ledgerEntry: entry,
    ok: true
  };
}

export async function refundReservedOpenAICredits(input: OpenAICreditOperationInput): Promise<OpenAICreditOperationResult> {
  const admin = createAdminClient();
  const amount = amountValue(input.amount);

  if (!admin) {
    return failedResult(input, "Supabase admin client is not configured.", "failed");
  }

  const rows = await ledgerRowsForJob(admin, input.jobId);
  const reservation = rows.find((row) => row.operation === "reservation" && (row.status === "reserved" || row.status === "charged"));

  if (!reservation) {
    return {
      amount,
      availableCredits: null,
      creditStatus: "refunded",
      error: null,
      ledgerEntry: null,
      ok: true
    };
  }

  const credits = input.userId ? await availableCreditsForUser(admin, input.userId) : { available: null, balance: null, reserved: 0 };
  const wasCharged = reservation.status === "charged";
  const nextBalance = typeof credits.balance === "number" && wasCharged ? credits.balance + amount : credits.balance;
  const { entry, error, inserted } = await insertLedgerEntry({
    admin,
    balanceAfter: nextBalance,
    balanceBefore: credits.balance,
    input,
    operation: "refund",
    referenceId: reservation.id,
    status: "refunded",
    suffix: "refund"
  });

  if (error || !entry) {
    return failedResult(input, error ?? "OpenAI credit refund failed.", "failed");
  }

  if (inserted && input.userId && typeof nextBalance === "number" && wasCharged) {
    const balanceError = await updateCreditBalance(admin, input.userId, nextBalance);

    if (balanceError) {
      return failedResult(input, balanceError, "failed");
    }
  }

  if (inserted) {
    await updateReservationStatus(admin, reservation.id, "refunded");
  }

  await recordCreditAudit({
    entry,
    eventType: "openai_credit_refunded",
    input,
    status: "success"
  });

  return {
    amount,
    availableCredits: typeof nextBalance === "number" ? nextBalance : null,
    creditStatus: "refunded",
    error: null,
    ledgerEntry: entry,
    ok: true
  };
}

export async function releaseOpenAICreditReservation(input: OpenAICreditOperationInput): Promise<OpenAICreditOperationResult> {
  const admin = createAdminClient();
  const amount = amountValue(input.amount);

  if (!admin) {
    return failedResult(input, "Supabase admin client is not configured.", "failed");
  }

  const rows = await ledgerRowsForJob(admin, input.jobId);
  const reservation = rows.find((row) => row.operation === "reservation" && row.status === "reserved");

  if (!reservation) {
    return {
      amount,
      availableCredits: null,
      creditStatus: "released",
      error: null,
      ledgerEntry: null,
      ok: true
    };
  }

  const { entry, error, inserted } = await insertLedgerEntry({
    admin,
    balanceAfter: reservation.balanceAfter,
    balanceBefore: reservation.balanceBefore,
    input,
    operation: "adjustment",
    referenceId: reservation.id,
    status: "released",
    suffix: "release"
  });

  if (error || !entry) {
    return failedResult(input, error ?? "OpenAI credit release failed.", "failed");
  }

  if (inserted) {
    await updateReservationStatus(admin, reservation.id, "released");
  }

  return {
    amount,
    availableCredits: entry.balanceAfter,
    creditStatus: "released",
    error: null,
    ledgerEntry: entry,
    ok: true
  };
}

export async function getOpenAICreditRuntimeSnapshot(): Promise<OpenAICreditRuntimeSnapshot> {
  const admin = createAdminClient();

  if (!admin) {
    return {
      chargedCredits: 0,
      failedOperations: 0,
      generatedAt: new Date().toISOString(),
      recentEntries: [],
      refundedCredits: 0,
      releasedCredits: 0,
      reservedCredits: 0,
      totalEntries: 0
    };
  }

  const { data } = await admin
    .from("openai_credit_ledger" as never)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(MAX_LEDGER_ROWS);
  const entries = (data ?? [])
    .map(parseLedgerEntry)
    .filter((entry): entry is OpenAICreditLedgerEntry => Boolean(entry));

  return {
    chargedCredits: entries.filter((entry) => entry.operation === "deduction" && entry.status === "charged").reduce((total, entry) => total + entry.amount, 0),
    failedOperations: entries.filter((entry) => entry.status === "failed" || entry.status === "blocked").length,
    generatedAt: new Date().toISOString(),
    recentEntries: entries.slice(0, 20),
    refundedCredits: entries.filter((entry) => entry.operation === "refund" && entry.status === "refunded").reduce((total, entry) => total + entry.amount, 0),
    releasedCredits: entries.filter((entry) => entry.operation === "adjustment" && entry.status === "released").reduce((total, entry) => total + entry.amount, 0),
    reservedCredits: entries.filter((entry) => entry.operation === "reservation" && entry.status === "reserved").reduce((total, entry) => total + entry.amount, 0),
    totalEntries: entries.length
  };
}
