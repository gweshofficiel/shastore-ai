import "server-only";

import { cache } from "react";

import { getAdminAccess } from "@/lib/admin-access";
import { normalizeStorefrontTemplateKey } from "@/lib/storefront/theme-registry";
import type { StoreTenantContext } from "@/lib/tenant/context";
import { createAdminClient } from "@/lib/supabase/admin";

export type StoreRenderingSource =
  | "runtime_defaults"
  | "store_assignment"
  | "store_theme"
  | "template_install";

export type StoreRenderingIsolationStatus = "failed" | "safe" | "warning";

export type StoreRenderingAssetPreview = {
  id: string;
  label: string;
  previewUrl: string | null;
  type: string;
};

export type StoreRenderingAssignmentSnapshot = {
  assignmentId: string;
  assignmentSource: string;
  assignmentStatus: string;
  assignedAt: string | null;
  installId: string | null;
  templateId: string;
  templateName: string | null;
  templateVersionId: string | null;
  versionNumber: string | null;
};

export type StoreRenderingValidation = {
  assetsReadable: boolean;
  assignmentReadable: boolean;
  fallbackAvailable: boolean;
  isolationSafe: boolean;
  renderingBindingActive: boolean;
  templateVersionReadable: boolean;
};

export type StoreRenderingConfig = {
  assets: {
    assets: StoreRenderingAssetPreview[];
    screenshots: StoreRenderingAssetPreview[];
  };
  assignment: StoreRenderingAssignmentSnapshot | null;
  bindingActive: boolean;
  fallbackSource: StoreRenderingSource | null;
  isolationIssues: string[];
  isolationStatus: StoreRenderingIsolationStatus;
  packageKey: string | null;
  packageMetadata: Record<string, unknown>;
  renderingSource: StoreRenderingSource;
  storeId: string;
  storeName: string | null;
  storeTemplateId: string | null;
  templateRegistryId: string | null;
  templateVersionId: string | null;
  validation: StoreRenderingValidation;
  versionNumber: string | null;
};

export type LiveStoreRenderingStatus = {
  assignedTemplate: string | null;
  assignedVersion: string | null;
  fallbackSource: StoreRenderingSource | null;
  isolationStatus: StoreRenderingIsolationStatus;
  renderingSource: StoreRenderingSource;
  storeId: string;
  storeName: string | null;
  validation: StoreRenderingValidation;
};

const assignmentSelect =
  "id, store_id, template_id, template_version_id, install_id, assignment_status, assignment_source, assigned_by, assigned_at, unassigned_at, metadata, created_at, updated_at";

const versionSelect = "id, template_id, version_number, status, package_snapshot, published_at, created_at, updated_at";

const registrySelect =
  "id, name, template_key, slug, status, visibility, metadata, version, created_at, updated_at";

const packageSelect = "id, template_id, version_id, package_key, package_name, package_summary, contents, readiness_status";

const screenshotSelect = "id, template_id, screenshot_type, preview_url, status, sort_order";

const assetSelect = "id, template_id, asset_type, preview_url, status, original_filename";

const installSelect =
  "id, template_id, template_version_id, store_id, status, install_mode, completed_at, created_at";

const sensitivePatterns = [
  /api[_-]?key/i,
  /service[_-]?role/i,
  /storage[_-]?key/i,
  /storage[_-]?bucket/i,
  /\bsecret\b/i,
  /\btoken\b/i,
  /\bpassword\b/i,
  /sb_secret/i,
  /\/object\/sign\//i
];

function text(value: unknown, maxLength = 500) {
  if (typeof value !== "string") return "";

  return value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/\bjavascript:/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function coerceText(value: unknown, maxLength = 500) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return text(value, maxLength);
  return text(String(value), maxLength);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function safeRecord(value: unknown) {
  return isRecord(value) ? value : {};
}

function rowRecord(value: unknown) {
  const candidate = value as unknown;
  return isRecord(candidate) ? candidate : null;
}

function rowArray(value: unknown) {
  return Array.isArray(value) ? (value as unknown[]) : [];
}

function containsSensitiveExposure(serialized: string) {
  return sensitivePatterns.some((pattern) => pattern.test(serialized));
}

function sanitizePreviewUrl(value: unknown) {
  const cleaned = text(value, 1000);

  if (!cleaned) return null;
  if (containsSensitiveExposure(cleaned)) return null;
  if (/\/object\/sign\//i.test(cleaned)) return null;

  return cleaned;
}

function requireAdminClient() {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for store rendering resolution.");
  }

  return admin;
}

function storeTemplateIdFromMetadata(metadata: Record<string, unknown>, templateKey: string) {
  const fromMetadata = coerceText(metadata.storeTemplateId, 120);

  if (fromMetadata) {
    return normalizeStorefrontTemplateKey(fromMetadata);
  }

  return normalizeStorefrontTemplateKey(templateKey);
}

function emptyRenderingConfig(storeId: string): StoreRenderingConfig {
  return {
    assets: { assets: [], screenshots: [] },
    assignment: null,
    bindingActive: false,
    fallbackSource: null,
    isolationIssues: [],
    isolationStatus: "safe",
    packageKey: null,
    packageMetadata: {},
    renderingSource: "runtime_defaults",
    storeId,
    storeName: null,
    storeTemplateId: "general-starter",
    templateRegistryId: null,
    templateVersionId: null,
    validation: {
      assetsReadable: true,
      assignmentReadable: true,
      fallbackAvailable: true,
      isolationSafe: true,
      renderingBindingActive: false,
      templateVersionReadable: true
    },
    versionNumber: null
  };
}

function verifyRenderingIsolation(input: {
  assignmentStoreId?: string | null;
  installStoreId?: string | null;
  requestedStoreId: string;
  templateRegistryId?: string | null;
}): { isolationIssues: string[]; isolationStatus: StoreRenderingIsolationStatus } {
  const issues: string[] = [];
  const requestedStoreId = coerceText(input.requestedStoreId, 120);

  if (!requestedStoreId) {
    return {
      isolationIssues: ["Store id is required for rendering isolation."],
      isolationStatus: "failed"
    };
  }

  if (input.assignmentStoreId && input.assignmentStoreId !== requestedStoreId) {
    issues.push("Assignment store id does not match requested store.");
  }

  if (input.installStoreId && input.installStoreId !== requestedStoreId) {
    issues.push("Install store id does not match requested store.");
  }

  if (!input.templateRegistryId && (input.assignmentStoreId || input.installStoreId)) {
    issues.push("Template registry reference is missing for rendering binding.");
  }

  if (issues.some((issue) => issue.includes("does not match"))) {
    return { isolationIssues: issues, isolationStatus: "failed" };
  }

  if (issues.length) {
    return { isolationIssues: issues, isolationStatus: "warning" };
  }

  return { isolationIssues: [], isolationStatus: "safe" };
}

async function loadStoreReference(storeId: string) {
  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("store_instances" as never)
    .select("id, name, template_id")
    .eq("id" as never, storeId as never)
    .maybeSingle();

  if (error) {
    return {
      storeId,
      storeName: null,
      templateId: null
    };
  }

  const row = rowRecord(data);

  if (!row) {
    return {
      storeId,
      storeName: null,
      templateId: null
    };
  }

  return {
    storeId: coerceText(row.id, 120) || storeId,
    storeName: coerceText(row.name, 240) || null,
    templateId: coerceText(row.template_id, 120) || null
  };
}

async function loadRegistryTemplate(templateRegistryId: string) {
  const admin = requireAdminClient();
  const cleanedId = coerceText(templateRegistryId, 120);

  if (!cleanedId) return null;

  const { data, error } = await admin
    .from("template_registry" as never)
    .select(registrySelect as never)
    .eq("id" as never, cleanedId as never)
    .maybeSingle();

  const row = rowRecord(error ? null : data);

  if (!row) return null;

  const metadata = safeRecord(row.metadata);

  return {
    id: coerceText(row.id, 120),
    metadata,
    name: coerceText(row.name, 240) || "Template",
    status: coerceText(row.status, 40),
    storeTemplateId: storeTemplateIdFromMetadata(metadata, coerceText(row.template_key, 120)),
    templateKey: coerceText(row.template_key, 120)
  };
}

async function loadTemplateVersion(templateVersionId: string | null, templateRegistryId: string) {
  const admin = requireAdminClient();
  const cleanedVersionId = coerceText(templateVersionId, 120);
  const cleanedTemplateId = coerceText(templateRegistryId, 120);

  if (cleanedVersionId) {
    const { data, error } = await admin
      .from("template_versions" as never)
      .select(versionSelect as never)
      .eq("id" as never, cleanedVersionId as never)
      .maybeSingle();

    const row = rowRecord(error ? null : data);

    if (row && coerceText(row.template_id, 120) === cleanedTemplateId) {
      return {
        id: coerceText(row.id, 120),
        packageSnapshot: safeRecord(row.package_snapshot),
        status: coerceText(row.status, 40),
        templateId: cleanedTemplateId,
        versionNumber: coerceText(row.version_number, 40) || null
      };
    }
  }

  const { data, error } = await admin
    .from("template_versions" as never)
    .select(versionSelect as never)
    .eq("template_id" as never, cleanedTemplateId as never)
    .eq("status" as never, "published" as never)
    .order("published_at" as never, { ascending: false })
    .limit(1)
    .maybeSingle();

  const publishedRow = rowRecord(error ? null : data);

  if (!publishedRow) return null;

  return {
    id: coerceText(publishedRow.id, 120),
    packageSnapshot: safeRecord(publishedRow.package_snapshot),
    status: coerceText(publishedRow.status, 40),
    templateId: cleanedTemplateId,
    versionNumber: coerceText(publishedRow.version_number, 40) || null
  };
}

async function loadTemplatePackage(templateRegistryId: string, templateVersionId: string | null) {
  const admin = requireAdminClient();
  const cleanedTemplateId = coerceText(templateRegistryId, 120);

  if (!cleanedTemplateId) {
    return {
      packageKey: null,
      packageMetadata: {}
    };
  }

  let query = admin
    .from("template_packages" as never)
    .select(packageSelect as never)
    .eq("template_id" as never, cleanedTemplateId as never);

  const cleanedVersionId = coerceText(templateVersionId, 120);

  if (cleanedVersionId) {
    query = query.eq("version_id" as never, cleanedVersionId as never);
  }

  const { data, error } = await query.order("updated_at" as never, { ascending: false }).limit(1).maybeSingle();

  const row = rowRecord(error ? null : data);

  if (!row) {
    return {
      packageKey: null,
      packageMetadata: {}
    };
  }

  const packageMetadata = {
    ...safeRecord(row.package_summary),
    contents: safeRecord(row.contents),
    packageName: coerceText(row.package_name, 240) || null,
    readinessStatus: coerceText(row.readiness_status, 40) || null
  };

  const serialized = JSON.stringify(packageMetadata);

  if (containsSensitiveExposure(serialized)) {
    return {
      packageKey: coerceText(row.package_key, 120) || null,
      packageMetadata: {
        packageName: coerceText(row.package_name, 240) || null,
        readinessStatus: coerceText(row.readiness_status, 40) || null
      }
    };
  }

  return {
    packageKey: coerceText(row.package_key, 120) || null,
    packageMetadata
  };
}

async function loadCompletedInstall(storeId: string) {
  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("template_installs" as never)
    .select(installSelect as never)
    .eq("store_id" as never, storeId as never)
    .eq("status" as never, "completed" as never)
    .order("completed_at" as never, { ascending: false })
    .limit(1)
    .maybeSingle();

  const row = rowRecord(error ? null : data);

  if (!row) return null;

  return {
    id: coerceText(row.id, 120),
    storeId: coerceText(row.store_id, 120),
    templateId: coerceText(row.template_id, 120),
    templateVersionId: coerceText(row.template_version_id, 120) || null
  };
}

function buildAssignmentSnapshot(
  assignment: NonNullable<Awaited<ReturnType<typeof getActiveStoreTemplateAssignment>>>,
  templateName: string | null,
  versionNumber: string | null
): StoreRenderingAssignmentSnapshot {
  return {
    assignmentId: assignment.id,
    assignmentSource: assignment.assignmentSource,
    assignmentStatus: assignment.assignmentStatus,
    assignedAt: assignment.assignedAt,
    installId: assignment.installId,
    templateId: assignment.templateId,
    templateName,
    templateVersionId: assignment.templateVersionId,
    versionNumber
  };
}

function buildRenderingConfig(input: {
  assets: StoreRenderingConfig["assets"];
  assignment: StoreRenderingAssignmentSnapshot | null;
  fallbackSource: StoreRenderingSource | null;
  isolationIssues: string[];
  isolationStatus: StoreRenderingIsolationStatus;
  packageKey: string | null;
  packageMetadata: Record<string, unknown>;
  renderingSource: StoreRenderingSource;
  storeId: string;
  storeName: string | null;
  storeTemplateId: string | null;
  templateRegistryId: string | null;
  templateVersionId: string | null;
  validation: Partial<StoreRenderingValidation>;
  versionNumber: string | null;
}): StoreRenderingConfig {
  const bindingActive = input.renderingSource === "store_assignment";

  return {
    assets: input.assets,
    assignment: input.assignment,
    bindingActive,
    fallbackSource: input.fallbackSource,
    isolationIssues: input.isolationIssues,
    isolationStatus: input.isolationStatus,
    packageKey: input.packageKey,
    packageMetadata: input.packageMetadata,
    renderingSource: input.renderingSource,
    storeId: input.storeId,
    storeName: input.storeName,
    storeTemplateId: input.storeTemplateId,
    templateRegistryId: input.templateRegistryId,
    templateVersionId: input.templateVersionId,
    validation: {
      assetsReadable: input.validation.assetsReadable ?? true,
      assignmentReadable: input.validation.assignmentReadable ?? true,
      fallbackAvailable: input.validation.fallbackAvailable ?? true,
      isolationSafe: input.validation.isolationSafe ?? input.isolationStatus === "safe",
      renderingBindingActive: bindingActive,
      templateVersionReadable: input.validation.templateVersionReadable ?? true
    },
    versionNumber: input.versionNumber
  };
}

export async function getActiveStoreTemplateAssignment(storeId: string) {
  const admin = createAdminClient();
  const cleanedStoreId = coerceText(storeId, 120);

  if (!admin || !cleanedStoreId) return null;

  const { data, error } = await admin
    .from("store_template_assignments" as never)
    .select(assignmentSelect as never)
    .eq("store_id" as never, cleanedStoreId as never)
    .in("assignment_status" as never, ["active", "assigned"] as never)
    .order("assigned_at" as never, { ascending: false })
    .limit(1)
    .maybeSingle();

  const row = rowRecord(error ? null : data);

  if (!row) return null;

  const parsedStoreId = coerceText(row.store_id, 120);

  if (parsedStoreId !== cleanedStoreId) return null;

  return {
    assignedAt: coerceText(row.assigned_at, 80) || null,
    assignedBy: coerceText(row.assigned_by, 120) || null,
    assignmentSource: coerceText(row.assignment_source, 40) || "super_admin_manual",
    assignmentStatus: coerceText(row.assignment_status, 40) || "assigned",
    createdAt: coerceText(row.created_at, 80) || null,
    id: coerceText(row.id, 120),
    installId: coerceText(row.install_id, 120) || null,
    metadata: safeRecord(row.metadata),
    storeId: parsedStoreId,
    templateId: coerceText(row.template_id, 120),
    templateVersionId: coerceText(row.template_version_id, 120) || null,
    unassignedAt: coerceText(row.unassigned_at, 80) || null,
    updatedAt: coerceText(row.updated_at, 80) || null
  };
}

export async function getStoreRenderingTemplate(storeId: string) {
  const cleanedStoreId = coerceText(storeId, 120);

  if (!cleanedStoreId) return null;

  const assignment = await getActiveStoreTemplateAssignment(cleanedStoreId);

  if (assignment?.templateId) {
    return loadRegistryTemplate(assignment.templateId);
  }

  const install = await loadCompletedInstall(cleanedStoreId);

  if (install?.templateId) {
    return loadRegistryTemplate(install.templateId);
  }

  const store = await loadStoreReference(cleanedStoreId);

  if (store.templateId) {
    return {
      id: null,
      metadata: {},
      name: "Store template",
      status: "active",
      storeTemplateId: normalizeStorefrontTemplateKey(store.templateId),
      templateKey: store.templateId
    };
  }

  return null;
}

export async function resolveStoreTemplateVersion(storeId: string) {
  const cleanedStoreId = coerceText(storeId, 120);

  if (!cleanedStoreId) return null;

  const assignment = await getActiveStoreTemplateAssignment(cleanedStoreId);

  if (assignment?.templateId) {
    return loadTemplateVersion(assignment.templateVersionId, assignment.templateId);
  }

  const install = await loadCompletedInstall(cleanedStoreId);

  if (install?.templateId) {
    return loadTemplateVersion(install.templateVersionId, install.templateId);
  }

  return null;
}

export async function resolveStoreTemplateAssets(storeId: string, templateRegistryId?: string | null) {
  const cleanedStoreId = coerceText(storeId, 120);
  const admin = createAdminClient();

  if (!admin || !cleanedStoreId) {
    return { assets: [], screenshots: [] };
  }

  let registryId = coerceText(templateRegistryId, 120);

  if (!registryId) {
    const assignment = await getActiveStoreTemplateAssignment(cleanedStoreId);
    registryId = assignment?.templateId ?? "";
  }

  if (!registryId) {
    const install = await loadCompletedInstall(cleanedStoreId);
    registryId = install?.templateId ?? "";
  }

  if (!registryId) {
    return { assets: [], screenshots: [] };
  }

  const [screenshotResult, assetResult] = await Promise.all([
    admin
      .from("template_screenshots" as never)
      .select(screenshotSelect as never)
      .eq("template_id" as never, registryId as never)
      .eq("status" as never, "published" as never)
      .order("sort_order" as never, { ascending: true })
      .limit(12),
    admin
      .from("template_assets" as never)
      .select(assetSelect as never)
      .eq("template_id" as never, registryId as never)
      .in("status" as never, ["published", "draft"] as never)
      .order("created_at" as never, { ascending: false })
      .limit(12)
  ]);

  const screenshots = rowArray(screenshotResult.data)
    .map((entry) => rowRecord(entry))
    .filter((row): row is Record<string, unknown> => Boolean(row))
    .map((row) => ({
      id: coerceText(row.id, 120),
      label: coerceText(row.screenshot_type, 80) || "screenshot",
      previewUrl: sanitizePreviewUrl(row.preview_url),
      type: "screenshot"
    }))
    .filter((row) => row.id);

  const assets = rowArray(assetResult.data)
    .map((entry) => rowRecord(entry))
    .filter((row): row is Record<string, unknown> => Boolean(row))
    .map((row) => ({
      id: coerceText(row.id, 120),
      label: coerceText(row.original_filename, 160) || coerceText(row.asset_type, 80) || "asset",
      previewUrl: sanitizePreviewUrl(row.preview_url),
      type: coerceText(row.asset_type, 80) || "asset"
    }))
    .filter((row) => row.id);

  return { assets, screenshots };
}

const resolveStoreRenderingConfigCached = cache(async (storeId: string): Promise<StoreRenderingConfig> => {
  const cleanedStoreId = coerceText(storeId, 120);

  if (!cleanedStoreId) {
    return emptyRenderingConfig(storeId);
  }

  const store = await loadStoreReference(cleanedStoreId);
  const assignment = await getActiveStoreTemplateAssignment(cleanedStoreId);

  if (assignment?.templateId) {
    const template = await loadRegistryTemplate(assignment.templateId);
    const version = await loadTemplateVersion(assignment.templateVersionId, assignment.templateId);
    const assets = await resolveStoreTemplateAssets(cleanedStoreId, assignment.templateId);
    const pkg = await loadTemplatePackage(assignment.templateId, version?.id ?? null);
    const isolation = verifyRenderingIsolation({
      assignmentStoreId: assignment.storeId,
      requestedStoreId: cleanedStoreId,
      templateRegistryId: assignment.templateId
    });

    return buildRenderingConfig({
      assets,
      assignment: buildAssignmentSnapshot(assignment, template?.name ?? null, version?.versionNumber ?? null),
      fallbackSource: "store_theme",
      isolationIssues: isolation.isolationIssues,
      isolationStatus: isolation.isolationStatus,
      packageKey: pkg.packageKey,
      packageMetadata: pkg.packageMetadata,
      renderingSource: "store_assignment",
      storeId: cleanedStoreId,
      storeName: store.storeName,
      storeTemplateId: template?.storeTemplateId ?? normalizeStorefrontTemplateKey(store.templateId),
      templateRegistryId: assignment.templateId,
      templateVersionId: version?.id ?? assignment.templateVersionId,
      validation: {
        assignmentReadable: true,
        isolationSafe: isolation.isolationStatus === "safe",
        renderingBindingActive: true,
        templateVersionReadable: Boolean(version)
      },
      versionNumber: version?.versionNumber ?? null
    });
  }

  const install = await loadCompletedInstall(cleanedStoreId);

  if (install?.templateId) {
    const template = await loadRegistryTemplate(install.templateId);
    const version = await loadTemplateVersion(install.templateVersionId, install.templateId);
    const assets = await resolveStoreTemplateAssets(cleanedStoreId, install.templateId);
    const pkg = await loadTemplatePackage(install.templateId, version?.id ?? null);
    const isolation = verifyRenderingIsolation({
      installStoreId: install.storeId,
      requestedStoreId: cleanedStoreId,
      templateRegistryId: install.templateId
    });

    return buildRenderingConfig({
      assets,
      assignment: null,
      fallbackSource: store.templateId ? "store_theme" : "runtime_defaults",
      isolationIssues: isolation.isolationIssues,
      isolationStatus: isolation.isolationStatus,
      packageKey: pkg.packageKey,
      packageMetadata: pkg.packageMetadata,
      renderingSource: "template_install",
      storeId: cleanedStoreId,
      storeName: store.storeName,
      storeTemplateId: template?.storeTemplateId ?? normalizeStorefrontTemplateKey(store.templateId),
      templateRegistryId: install.templateId,
      templateVersionId: version?.id ?? install.templateVersionId,
      validation: {
        assignmentReadable: true,
        isolationSafe: isolation.isolationStatus === "safe",
        templateVersionReadable: Boolean(version)
      },
      versionNumber: version?.versionNumber ?? null
    });
  }

  if (store.templateId) {
    const storeTemplateId = normalizeStorefrontTemplateKey(store.templateId);
    const assets = await resolveStoreTemplateAssets(cleanedStoreId, null);

    return buildRenderingConfig({
      assets,
      assignment: null,
      fallbackSource: "runtime_defaults",
      isolationIssues: [],
      isolationStatus: "safe",
      packageKey: null,
      packageMetadata: {},
      renderingSource: "store_theme",
      storeId: cleanedStoreId,
      storeName: store.storeName,
      storeTemplateId,
      templateRegistryId: null,
      templateVersionId: null,
      validation: {
        assignmentReadable: true,
        fallbackAvailable: true,
        isolationSafe: true,
        renderingBindingActive: false,
        templateVersionReadable: true
      },
      versionNumber: null
    });
  }

  return buildRenderingConfig({
    assets: { assets: [], screenshots: [] },
    assignment: null,
    fallbackSource: null,
    isolationIssues: [],
    isolationStatus: "safe",
    packageKey: null,
    packageMetadata: {},
    renderingSource: "runtime_defaults",
    storeId: cleanedStoreId,
    storeName: store.storeName,
    storeTemplateId: "general-starter",
    templateRegistryId: null,
    templateVersionId: null,
    validation: {
      assignmentReadable: true,
      assetsReadable: true,
      fallbackAvailable: true,
      isolationSafe: true,
      renderingBindingActive: false,
      templateVersionReadable: true
    },
    versionNumber: null
  });
});

export async function resolveStoreRenderingConfig(storeId: string) {
  return resolveStoreRenderingConfigCached(storeId);
}

export function getEffectiveStoreTemplateId(context: StoreTenantContext) {
  if (context.templateRendering?.bindingActive && context.templateRendering.storeTemplateId) {
    return context.templateRendering.storeTemplateId;
  }

  if (context.templateRendering?.storeTemplateId) {
    return context.templateRendering.storeTemplateId;
  }

  return context.preview.templateId;
}

export function applyStoreRenderingBinding(
  context: StoreTenantContext,
  rendering: StoreRenderingConfig
): StoreTenantContext {
  const templateId =
    rendering.bindingActive && rendering.storeTemplateId
      ? rendering.storeTemplateId
      : rendering.storeTemplateId || context.preview.templateId;

  return {
    ...context,
    preview: {
      ...context.preview,
      templateId
    },
    templateRendering: rendering
  };
}

export async function getLiveStoreRenderingStatus(storeId: string): Promise<LiveStoreRenderingStatus> {
  const rendering = await resolveStoreRenderingConfig(storeId);

  return {
    assignedTemplate: rendering.assignment?.templateName ?? rendering.templateRegistryId,
    assignedVersion: rendering.versionNumber,
    fallbackSource: rendering.fallbackSource,
    isolationStatus: rendering.isolationStatus,
    renderingSource: rendering.renderingSource,
    storeId: rendering.storeId,
    storeName: rendering.storeName,
    validation: rendering.validation
  };
}

async function requireSuperAdminForDiagnostics() {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can view live store rendering diagnostics.");
  }
}

export async function listLiveStoreRenderingDiagnostics(limit = 50): Promise<LiveStoreRenderingStatus[]> {
  await requireSuperAdminForDiagnostics();

  const admin = requireAdminClient();
  const cappedLimit = Math.max(1, Math.min(limit, 100));

  const { data, error } = await admin
    .from("store_template_assignments" as never)
    .select("store_id")
    .in("assignment_status" as never, ["active", "assigned"] as never)
    .order("assigned_at" as never, { ascending: false })
    .limit(cappedLimit);

  if (error) {
    throw new Error(`Live store rendering diagnostics could not be loaded: ${error.message}`);
  }

  const storeIds = Array.from(
    new Set(
      rowArray(data)
        .map((entry) => rowRecord(entry))
        .map((row) => (row ? coerceText(row.store_id, 120) : ""))
        .filter(Boolean)
    )
  ).slice(0, cappedLimit);

  const statuses = await Promise.all(storeIds.map((storeId) => getLiveStoreRenderingStatus(storeId)));

  return statuses.sort((left, right) => (left.storeName ?? left.storeId).localeCompare(right.storeName ?? right.storeId));
}
