import "server-only";

import { createHash } from "crypto";
import type { AIVisualGenerationJob } from "@/lib/storefront/ai-visual-queue";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordAiAuditLog } from "@/src/lib/ai/audit/ai-audit-log";
import { sanitizeOpenAIJobError } from "@/src/lib/ai/runtime/openai-job-model";
import type {
  OpenAIAssetPersistenceResult,
  OpenAIAssetRecord,
  OpenAIAssetRuntimeSnapshot,
  OpenAIAssetStatus,
  OpenAIAssetStorageStatus
} from "@/src/lib/ai/assets/openai-asset-types";

type OpenAIAssetRow = {
  asset_type?: string | null;
  content_type?: string | null;
  created_at?: string | null;
  error_code?: string | null;
  export_prepared_at?: string | null;
  export_status?: string | null;
  height?: number | null;
  id?: string | null;
  job_id?: string | null;
  provider_key?: string | null;
  safe_error_message?: string | null;
  slot?: string | null;
  status?: string | null;
  storage_provider?: string | null;
  storage_status?: string | null;
  store_id?: string | null;
  target_id?: string | null;
  target_type?: string | null;
  user_id?: string | null;
  width?: number | null;
  workspace_id?: string | null;
};

const MAX_ASSET_ROWS = 200;

function text(value: unknown, maxLength = 240) {
  return typeof value === "string" && value.trim()
    ? value.trim().replace(/\s+/g, " ").slice(0, maxLength)
    : "";
}

function nullableText(value: unknown, maxLength = 240) {
  const cleaned = text(value, maxLength);

  return cleaned || null;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function hashStorageReference(value: string | null | undefined) {
  const cleaned = text(value, 1000);

  if (!cleaned) {
    return null;
  }

  return createHash("sha256").update(cleaned).digest("hex");
}

function parseAssetRow(row: unknown): OpenAIAssetRecord | null {
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    return null;
  }

  const value = row as OpenAIAssetRow;
  const id = text(value.id, 120);
  const jobId = text(value.job_id, 160);
  const status = text(value.status, 80) as OpenAIAssetRecord["status"];
  const createdAt = text(value.created_at, 80);

  if (!id || !jobId || !status || !createdAt) {
    return null;
  }

  return {
    assetType: nullableText(value.asset_type, 120),
    contentType: nullableText(value.content_type, 120),
    createdAt,
    errorCode: nullableText(value.error_code, 160),
    exportPreparedAt: nullableText(value.export_prepared_at, 80),
    exportStatus: (text(value.export_status, 80) || "not_prepared") as OpenAIAssetRecord["exportStatus"],
    height: numberValue(value.height),
    id,
    jobId,
    providerKey: "openai",
    safeErrorMessage: sanitizeOpenAIJobError(value.safe_error_message),
    slot: nullableText(value.slot, 120),
    status,
    storageProvider: nullableText(value.storage_provider, 80),
    storageStatus: (text(value.storage_status, 80) || "unknown") as OpenAIAssetStorageStatus,
    storeId: nullableText(value.store_id, 120),
    targetId: nullableText(value.target_id, 160),
    targetType: nullableText(value.target_type, 80),
    userId: nullableText(value.user_id, 120),
    width: numberValue(value.width),
    workspaceId: nullableText(value.workspace_id, 120)
  };
}

function assetStatusForJob(job: AIVisualGenerationJob): OpenAIAssetStatus {
  if (job.status !== "completed" || !job.result?.asset) {
    return "generated";
  }

  if (job.result.publicUrl || job.result.asset.publicUrl || job.result.asset.url) {
    return "stored";
  }

  return "storage_failed";
}

function storageStatusForJob(job: AIVisualGenerationJob): OpenAIAssetStorageStatus {
  if (job.status !== "completed") {
    return "pending";
  }

  if (job.result?.publicUrl || job.result?.asset?.publicUrl || job.result?.asset?.url) {
    return "stored";
  }

  return "failed";
}

async function recordAssetAudit({
  asset = null,
  errorCode = null,
  eventType,
  job,
  safeErrorMessage = null,
  status
}: {
  asset?: OpenAIAssetRecord | null;
  errorCode?: string | null;
  eventType:
    | "openai_asset_export_failed"
    | "openai_asset_export_prepared"
    | "openai_asset_persisted"
    | "openai_asset_persistence_started"
    | "openai_asset_storage_failed";
  job: AIVisualGenerationJob;
  safeErrorMessage?: string | null;
  status: "failed" | "started" | "success";
}) {
  await recordAiAuditLog({
    assetType: asset?.assetType ?? job.kind,
    errorCode,
    errorMessage: sanitizeOpenAIJobError(safeErrorMessage),
    eventType,
    jobId: job.jobId,
    providerKey: "openai",
    safeSummary: {
      assetStatus: asset?.status ?? null,
      exportStatus: asset?.exportStatus ?? null,
      hasPublicUrl: Boolean(job.result?.publicUrl || job.result?.asset?.publicUrl || job.result?.asset?.url),
      storageStatus: asset?.storageStatus ?? storageStatusForJob(job),
      targetType: job.attachTarget.type
    },
    status,
    storeId: job.storeId,
    userId: job.requestedByUserId,
    workspaceId: job.workspaceId
  });
}

export async function persistOpenAIAssetForJob(job: AIVisualGenerationJob): Promise<OpenAIAssetPersistenceResult> {
  const admin = createAdminClient();

  await recordAssetAudit({
    eventType: "openai_asset_persistence_started",
    job,
    status: "started"
  });

  if (!admin) {
    return {
      asset: null,
      error: "Supabase admin client is not configured.",
      ok: false,
      status: "storage_failed"
    };
  }

  if (job.provider !== "openai-image") {
    return {
      asset: null,
      error: null,
      ok: true,
      status: "skipped"
    };
  }

  const asset = job.result?.asset ?? null;
  const status = assetStatusForJob(job);
  const storageStatus = storageStatusForJob(job);
  const storageReference = asset?.storageKey ?? asset?.r2Key ?? null;
  const { data, error } = await admin
    .from("openai_assets" as never)
    .upsert({
      asset_type: job.kind,
      content_type: null,
      error_code: status === "storage_failed" ? "openai_asset_storage_failed" : null,
      height: typeof asset?.height === "number" ? asset.height : null,
      job_id: job.jobId,
      provider_key: "openai",
      safe_error_message: status === "storage_failed" ? "OpenAI asset completed without stored output." : null,
      safe_metadata: {
        approvalStatus: asset?.approvalStatus ?? null,
        hasPublicUrl: Boolean(job.result?.publicUrl || asset?.publicUrl || asset?.url),
        promptKey: asset?.promptKey ?? null,
        source: asset?.source ?? null
      },
      slot: job.slot,
      source_kind: "openai_job",
      status,
      storage_provider: asset?.bucket ? "cloudflare-r2" : null,
      storage_reference_hash: hashStorageReference(storageReference),
      storage_status: storageStatus,
      store_id: job.storeId,
      target_id: job.attachTarget.entityId,
      target_type: job.attachTarget.type,
      user_id: job.requestedByUserId,
      width: typeof asset?.width === "number" ? asset.width : null,
      workspace_id: job.workspaceId
    } as never, { onConflict: "job_id" })
    .select("*")
    .single();

  if (error) {
    await recordAssetAudit({
      errorCode: "openai_asset_persist_failed",
      eventType: "openai_asset_storage_failed",
      job,
      safeErrorMessage: error.message,
      status: "failed"
    });

    return {
      asset: null,
      error: sanitizeOpenAIJobError(error.message),
      ok: false,
      status: "storage_failed"
    };
  }

  const parsed = parseAssetRow(data);

  await recordAssetAudit({
    asset: parsed,
    errorCode: parsed?.status === "storage_failed" ? "openai_asset_storage_failed" : null,
    eventType: parsed?.status === "storage_failed" ? "openai_asset_storage_failed" : "openai_asset_persisted",
    job,
    safeErrorMessage: parsed?.safeErrorMessage,
    status: parsed?.status === "storage_failed" ? "failed" : "success"
  });

  return {
    asset: parsed,
    error: null,
    ok: Boolean(parsed),
    status: parsed?.status ?? "storage_failed"
  };
}

export async function prepareOpenAIAssetExport(jobId: string) {
  const admin = createAdminClient();

  if (!admin) {
    return {
      asset: null,
      error: "Supabase admin client is not configured.",
      ok: false
    };
  }

  const { data } = await admin
    .from("openai_assets" as never)
    .select("*")
    .eq("job_id" as never, jobId as never)
    .maybeSingle();
  const asset = parseAssetRow(data);

  if (!asset) {
    return {
      asset: null,
      error: "OpenAI asset is not persisted yet.",
      ok: false
    };
  }

  if (asset.storageStatus !== "stored") {
    const { data: failedData } = await admin
      .from("openai_assets" as never)
      .update({
        error_code: "openai_asset_export_storage_unavailable",
        export_status: "export_failed",
        safe_error_message: "OpenAI asset export requires stored asset output.",
        status: "export_failed"
      } as never)
      .eq("id" as never, asset.id as never)
      .select("*")
      .single();

    return {
      asset: parseAssetRow(failedData),
      error: "OpenAI asset export requires stored asset output.",
      ok: false
    };
  }

  const { data: preparedData, error } = await admin
    .from("openai_assets" as never)
    .update({
      export_prepared_at: new Date().toISOString(),
      export_status: "export_ready",
      status: "export_ready"
    } as never)
    .eq("id" as never, asset.id as never)
    .select("*")
    .single();

  if (error) {
    return {
      asset,
      error: sanitizeOpenAIJobError(error.message),
      ok: false
    };
  }

  return {
    asset: parseAssetRow(preparedData),
    error: null,
    ok: true
  };
}

export async function prepareOpenAIAssetExportForJob(job: AIVisualGenerationJob) {
  const result = await prepareOpenAIAssetExport(job.jobId);

  await recordAssetAudit({
    asset: result.asset,
    errorCode: result.ok ? null : "openai_asset_export_failed",
    eventType: result.ok ? "openai_asset_export_prepared" : "openai_asset_export_failed",
    job,
    safeErrorMessage: result.error,
    status: result.ok ? "success" : "failed"
  });

  return result;
}

export async function getOpenAIAssetRuntimeSnapshot(): Promise<OpenAIAssetRuntimeSnapshot> {
  const admin = createAdminClient();

  if (!admin) {
    return {
      exportFailed: 0,
      exportReady: 0,
      generatedAssets: 0,
      generatedAt: new Date().toISOString(),
      recentAssets: [],
      storageFailures: 0,
      storedAssets: 0,
      totalAssets: 0
    };
  }

  const { data } = await admin
    .from("openai_assets" as never)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(MAX_ASSET_ROWS);
  const assets = (data ?? [])
    .map(parseAssetRow)
    .filter((asset): asset is OpenAIAssetRecord => Boolean(asset));

  return {
    exportFailed: assets.filter((asset) => asset.exportStatus === "export_failed" || asset.status === "export_failed").length,
    exportReady: assets.filter((asset) => asset.exportStatus === "export_ready" || asset.status === "export_ready").length,
    generatedAssets: assets.filter((asset) => asset.status === "generated").length,
    generatedAt: new Date().toISOString(),
    recentAssets: assets.slice(0, 20),
    storageFailures: assets.filter((asset) => asset.storageStatus === "failed" || asset.status === "storage_failed").length,
    storedAssets: assets.filter((asset) => asset.storageStatus === "stored" || asset.status === "stored").length,
    totalAssets: assets.length
  };
}

export async function listOpenAIAssetsForStore({
  limit = 20,
  storeId,
  workspaceId
}: {
  limit?: number;
  storeId: string;
  workspaceId?: string | null;
}) {
  const admin = createAdminClient();

  if (!admin) {
    return [] as OpenAIAssetRecord[];
  }

  let query = admin
    .from("openai_assets" as never)
    .select("*")
    .eq("store_id" as never, storeId as never)
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 50));

  if (workspaceId) {
    query = query.eq("workspace_id" as never, workspaceId as never);
  }

  const { data } = await query;

  return (data ?? [])
    .map(parseAssetRow)
    .filter((asset): asset is OpenAIAssetRecord => Boolean(asset));
}
