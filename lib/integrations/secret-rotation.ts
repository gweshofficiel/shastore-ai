import "server-only";
import { getAdminAccess } from "@/lib/admin-access";
import { recordIntegrationAuditLog } from "@/lib/integrations/audit-log";
import { integrationDefinitions } from "@/lib/integrations/catalog";
import {
  maskIntegrationDiagnostic,
  maskSensitiveText
} from "@/lib/integrations/safe-diagnostics";
import { createAdminClient } from "@/lib/supabase/admin";

export type SecretRotationStatus =
  | "active"
  | "disabled"
  | "rotated"
  | "rotation_due"
  | "unknown";

export type SecretRotationRecord = {
  createdAt: string | null;
  id: string | null;
  lastRotatedAt: string | null;
  lastRotatedBy: string | null;
  nextRotationDueAt: string | null;
  providerKey: string;
  providerName: string;
  rotationNote: string | null;
  rotationRequired: boolean;
  secretCategory: string;
  secretKeyName: string;
  status: SecretRotationStatus;
  updatedAt: string | null;
};

export type SecretRotationInput = {
  nextRotationDueAt?: string | null;
  providerKey: string;
  rotationNote?: string | null;
  secretKeyName: string;
};

type RotationTable = {
  select: (columns: string) => {
    order: (column: string, options: { ascending: boolean }) => PromiseLike<{
      data: unknown[] | null;
      error: { message: string } | null;
    }>;
  };
  upsert: (
    values: never,
    options: { onConflict: string }
  ) => PromiseLike<{ error: { message: string } | null }>;
};

type AdminClient = {
  from: (table: string) => unknown;
};

const rotationStatuses: SecretRotationStatus[] = [
  "active",
  "disabled",
  "rotated",
  "rotation_due",
  "unknown"
];

function requireSuperAdmin(access: Awaited<ReturnType<typeof getAdminAccess>>) {
  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can access integration secret rotation metadata.");
  }
}

function table(client: AdminClient) {
  return client.from("integration_secret_rotation_records") as RotationTable;
}

function cleanText(value: unknown, maxLength = 500) {
  return typeof value === "string" ? maskSensitiveText(value.trim()).slice(0, maxLength) : "";
}

function nullableText(value: unknown, maxLength = 500) {
  const cleaned = cleanText(value, maxLength);

  return cleaned || null;
}

function cleanDate(value: unknown) {
  const cleaned = cleanText(value, 80);

  if (!cleaned) {
    return null;
  }

  const timestamp = Date.parse(cleaned);

  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function statusValue(value: unknown): SecretRotationStatus {
  return rotationStatuses.includes(value as SecretRotationStatus)
    ? (value as SecretRotationStatus)
    : "unknown";
}

function definitionForProvider(providerKey: string) {
  return integrationDefinitions.find((definition) => definition.key === providerKey);
}

function assertCatalogSecret(providerKey: string, secretKeyName: string) {
  const definition = definitionForProvider(providerKey);

  if (!definition || !definition.requiredEnv.includes(secretKeyName)) {
    throw new Error("Unknown integration secret key.");
  }

  return definition;
}

function parseRotationRecord(row: unknown): SecretRotationRecord | null {
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    return null;
  }

  const value = row as Record<string, unknown>;
  const providerKey = cleanText(value.provider_key, 120);
  const secretKeyName = cleanText(value.secret_key_name, 160);

  if (!providerKey || !secretKeyName) {
    return null;
  }

  const definition = definitionForProvider(providerKey);

  return {
    createdAt: cleanDate(value.created_at),
    id: cleanText(value.id, 80) || null,
    lastRotatedAt: cleanDate(value.last_rotated_at),
    lastRotatedBy: cleanText(value.last_rotated_by, 80) || null,
    nextRotationDueAt: cleanDate(value.next_rotation_due_at),
    providerKey,
    providerName: definition?.name ?? providerKey,
    rotationNote: nullableText(value.rotation_note, 500),
    rotationRequired: Boolean(value.rotation_required),
    secretCategory: cleanText(value.secret_category, 160) || definition?.category || "Unknown",
    secretKeyName,
    status: statusValue(value.status),
    updatedAt: cleanDate(value.updated_at)
  };
}

function defaultRotationRecord(providerKey: string, secretKeyName: string): SecretRotationRecord {
  const definition = assertCatalogSecret(providerKey, secretKeyName);

  return {
    createdAt: null,
    id: null,
    lastRotatedAt: null,
    lastRotatedBy: null,
    nextRotationDueAt: null,
    providerKey,
    providerName: definition.name,
    rotationNote: null,
    rotationRequired: false,
    secretCategory: definition.category,
    secretKeyName,
    status: "unknown",
    updatedAt: null
  };
}

function catalogRotationRecords() {
  return integrationDefinitions.flatMap((definition) =>
    definition.requiredEnv.map((secretKeyName) => defaultRotationRecord(definition.key, secretKeyName))
  );
}

async function auditSecretRotation({
  definition,
  input,
  operation,
  status
}: {
  definition: { category: string; key: string; name: string };
  input: SecretRotationInput;
  operation: string;
  status: "failed" | "success";
}) {
  await recordIntegrationAuditLog({
    category: definition.category,
    operation,
    providerKey: definition.key,
    providerName: definition.name,
    relatedEntityId: input.secretKeyName,
    relatedEntityType: "integration_secret_key",
    safeSummary: maskIntegrationDiagnostic({
      mutationPerformed: false,
      noteUpdated: Boolean(input.rotationNote),
      providerKey: definition.key,
      secretKeyName: input.secretKeyName
    }) as Record<string, unknown>,
    status
  });
}

export async function listSecretRotationRecords(): Promise<SecretRotationRecord[]> {
  const access = await getAdminAccess();
  requireSuperAdmin(access);

  const admin = createAdminClient();

  if (!admin) {
    return catalogRotationRecords();
  }

  const { data, error } = await table(admin)
    .select("id, provider_key, secret_key_name, secret_category, status, rotation_required, last_rotated_at, last_rotated_by, next_rotation_due_at, rotation_note, created_at, updated_at")
    .order("provider_key", { ascending: true });

  if (error) {
    return catalogRotationRecords();
  }

  const storedBySecret = new Map(
    (data ?? [])
      .map(parseRotationRecord)
      .filter((record): record is SecretRotationRecord => Boolean(record))
      .map((record) => [`${record.providerKey}:${record.secretKeyName}`, record])
  );

  return catalogRotationRecords().map((record) =>
    storedBySecret.get(`${record.providerKey}:${record.secretKeyName}`) ?? record
  );
}

export async function markSecretRotated(input: SecretRotationInput) {
  const access = await getAdminAccess();
  requireSuperAdmin(access);

  const providerKey = cleanText(input.providerKey, 120);
  const secretKeyName = cleanText(input.secretKeyName, 160);
  const definition = assertCatalogSecret(providerKey, secretKeyName);
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for secret rotation metadata.");
  }

  const now = new Date().toISOString();
  const { error } = await table(admin).upsert({
    last_rotated_at: now,
    last_rotated_by: access.user.id,
    next_rotation_due_at: cleanDate(input.nextRotationDueAt),
    provider_key: providerKey,
    rotation_note: nullableText(input.rotationNote),
    rotation_required: false,
    secret_category: definition.category,
    secret_key_name: secretKeyName,
    status: "rotated"
  } as never, { onConflict: "provider_key,secret_key_name" });

  if (error) {
    await auditSecretRotation({ definition, input: { ...input, providerKey, secretKeyName }, operation: "secret_rotation_marked_rotated", status: "failed" });
    throw new Error("Secret rotation metadata could not be marked as rotated.");
  }

  await auditSecretRotation({ definition, input: { ...input, providerKey, secretKeyName }, operation: "secret_rotation_marked_rotated", status: "success" });
}

export async function markRotationRequired(input: SecretRotationInput) {
  const access = await getAdminAccess();
  requireSuperAdmin(access);

  const providerKey = cleanText(input.providerKey, 120);
  const secretKeyName = cleanText(input.secretKeyName, 160);
  const definition = assertCatalogSecret(providerKey, secretKeyName);
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for secret rotation metadata.");
  }

  const { error } = await table(admin).upsert({
    next_rotation_due_at: cleanDate(input.nextRotationDueAt),
    provider_key: providerKey,
    rotation_note: nullableText(input.rotationNote),
    rotation_required: true,
    secret_category: definition.category,
    secret_key_name: secretKeyName,
    status: "rotation_due"
  } as never, { onConflict: "provider_key,secret_key_name" });

  if (error) {
    await auditSecretRotation({ definition, input: { ...input, providerKey, secretKeyName }, operation: "secret_rotation_required", status: "failed" });
    throw new Error("Secret rotation metadata could not be marked as required.");
  }

  await auditSecretRotation({ definition, input: { ...input, providerKey, secretKeyName }, operation: "secret_rotation_required", status: "success" });
}

export async function updateSecretRotationNote(input: SecretRotationInput) {
  const access = await getAdminAccess();
  requireSuperAdmin(access);

  const providerKey = cleanText(input.providerKey, 120);
  const secretKeyName = cleanText(input.secretKeyName, 160);
  const definition = assertCatalogSecret(providerKey, secretKeyName);
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for secret rotation metadata.");
  }

  const existing = (await listSecretRotationRecords()).find(
    (record) => record.providerKey === providerKey && record.secretKeyName === secretKeyName
  ) ?? defaultRotationRecord(providerKey, secretKeyName);
  const { error } = await table(admin).upsert({
    last_rotated_at: existing.lastRotatedAt,
    last_rotated_by: existing.lastRotatedBy,
    next_rotation_due_at: existing.nextRotationDueAt,
    provider_key: providerKey,
    rotation_note: nullableText(input.rotationNote),
    rotation_required: existing.rotationRequired,
    secret_category: definition.category,
    secret_key_name: secretKeyName,
    status: existing.status
  } as never, { onConflict: "provider_key,secret_key_name" });

  if (error) {
    await auditSecretRotation({ definition, input: { ...input, providerKey, secretKeyName }, operation: "secret_rotation_note_updated", status: "failed" });
    throw new Error("Secret rotation note could not be updated.");
  }

  await auditSecretRotation({ definition, input: { ...input, providerKey, secretKeyName }, operation: "secret_rotation_note_updated", status: "success" });
}
