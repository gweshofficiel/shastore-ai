import {
  getTemplatePackageForTemplate,
  resolveInstalledTemplatePackageMetadata,
  type TemplatePackage,
  type TemplatePackageVersionMetadata
} from "@/lib/storefront/template-packages";

export type TemplateUpdateStatus = "legacy_unversioned" | "up_to_date" | "update_available";

export type TemplateUpdateHistoryRecord = {
  appliedTargets: string[];
  newVersion: number | null;
  packageId: string | null;
  previousVersion: number | null;
  templateId: string;
  updatedAt: string;
  updateStatus: "applied_metadata_only" | "skipped" | "failed";
};

export type TemplateUpdatePlan = {
  installed: TemplatePackageVersionMetadata;
  latestPackage: TemplatePackage | null;
  latestVersion: number | null;
  protectedOwnerData: string[];
  safeUpdateTargets: string[];
  status: TemplateUpdateStatus;
};

export const templateUpdateProtectedOwnerData = [
  "products",
  "categories",
  "prices",
  "product images",
  "pages",
  "contact info",
  "legal pages",
  "AI generated visuals",
  "cart",
  "checkout",
  "orders",
  "domains"
];

export const templateUpdateSafeTargets = [
  "template package metadata",
  "installed package version pointer",
  "template update history",
  "future shared layout/runtime defaults",
  "future non-destructive visual/runtime improvements"
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function updateHistoryFromStoreData(storeData: unknown): TemplateUpdateHistoryRecord[] {
  const data = isRecord(storeData) ? storeData : {};
  const history = data.templatePackageUpdateHistory;

  return Array.isArray(history)
    ? history.filter((entry): entry is TemplateUpdateHistoryRecord => isRecord(entry))
    : [];
}

export function getTemplateUpdatePlan({
  fallbackTemplateId,
  storeData
}: {
  fallbackTemplateId: string;
  storeData: unknown;
}): TemplateUpdatePlan {
  const installed = resolveInstalledTemplatePackageMetadata(storeData, fallbackTemplateId);
  const latestPackage = getTemplatePackageForTemplate(installed.templateId);
  const latestVersion = latestPackage?.version ?? null;
  const installedVersion = installed.packageVersion;
  const status: TemplateUpdateStatus =
    installed.isLegacy || !installedVersion || !latestVersion
      ? "legacy_unversioned"
      : installedVersion < latestVersion
        ? "update_available"
        : "up_to_date";

  return {
    installed,
    latestPackage,
    latestVersion,
    protectedOwnerData: [...templateUpdateProtectedOwnerData],
    safeUpdateTargets: [...templateUpdateSafeTargets],
    status
  };
}

export function templateUpdateStatusLabel(status: TemplateUpdateStatus) {
  if (status === "update_available") {
    return "Update available";
  }

  if (status === "legacy_unversioned") {
    return "Legacy / unversioned";
  }

  return "Up to date";
}

export function applySafeTemplateUpdateToStoreData({
  actorUserId,
  now,
  plan,
  storeData
}: {
  actorUserId: string;
  now: string;
  plan: TemplateUpdatePlan;
  storeData: Record<string, unknown>;
}) {
  if (plan.status !== "update_available" || !plan.latestPackage || !plan.latestVersion) {
    return {
      nextStoreData: storeData,
      updateRecord: null
    };
  }

  const installedTemplatePackage = {
    installedAt: plan.installed.installedAt,
    installedBy: plan.installed.installedBy,
    packageId: plan.latestPackage.id,
    packageSource: "template-package-registry",
    packageVersion: plan.latestVersion,
    status: "installed",
    templateId: plan.installed.templateId,
    updatedAt: now,
    updatedBy: actorUserId
  };
  const previousInstallations = isRecord(storeData.templatePackageInstallations)
    ? storeData.templatePackageInstallations
    : {};
  const previousInstallation = previousInstallations[plan.latestPackage.id];
  const currentInstallation: Record<string, unknown> = isRecord(previousInstallation)
    ? previousInstallation
    : {};
  const updateRecord: TemplateUpdateHistoryRecord = {
    appliedTargets: ["template package metadata", "installed package version pointer"],
    newVersion: plan.latestVersion,
    packageId: plan.latestPackage.id,
    previousVersion: plan.installed.packageVersion,
    templateId: plan.installed.templateId,
    updatedAt: now,
    updateStatus: "applied_metadata_only"
  };

  return {
    nextStoreData: {
      ...storeData,
      installedTemplatePackage,
      templatePackageInstallations: {
        ...previousInstallations,
        [plan.latestPackage.id]: {
          ...currentInstallation,
          completedAt: now,
          installedAt: plan.installed.installedAt ?? now,
          installedBy: plan.installed.installedBy ?? actorUserId,
          packageId: plan.latestPackage.id,
          packageSource: "template-package-registry",
          packageVersion: plan.latestVersion,
          status: "installed",
          templateId: plan.installed.templateId,
          updatedAt: now,
          updatedBy: actorUserId
        }
      },
      templatePackageUpdateHistory: [
        updateRecord,
        ...updateHistoryFromStoreData(storeData)
      ].slice(0, 20)
    },
    updateRecord
  };
}
