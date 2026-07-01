import "server-only";

import {
  SECURITY_REGISTRY_SOURCE,
  getSecurityRegistryEntry
} from "@/src/lib/security/security-registry-runtime";
import {
  SECURITY_FUTURE_HOOKS_SOURCE,
  getSecurityFutureHook
} from "@/src/lib/security/security-future-hooks-runtime";

export type SecurityDeviceFingerprintingSource = "security_device_fingerprinting_runtime";

export type SecurityDeviceFingerprintCategory =
  | "Browser"
  | "Device"
  | "Network"
  | "Operating System"
  | "Session";

export type SecurityDeviceFingerprintSignalType =
  | "browser"
  | "device_type"
  | "ip_device_pair"
  | "language"
  | "operating_system"
  | "session_pattern"
  | "user_agent";

export type SecurityDeviceFingerprintTargetType = "device" | "session" | "user";

export type SecurityDeviceFingerprintSourceModule = "audit" | "device" | "login" | "session";

export type SecurityDeviceFingerprintPrivacySensitivity = "critical" | "high" | "low" | "medium";

export type SecurityDeviceFingerprintRuntimeStatus = "foundation" | "planned" | "reserved";

export type SecurityDeviceFingerprintingRuntimeState = "device_fingerprinting_ready" | "needs_attention";

export type SecurityDeviceFingerprintDefinition = {
  auditRequired: boolean;
  category: SecurityDeviceFingerprintCategory;
  definitionId: string;
  definitionKey: string;
  description: string;
  displayName: string;
  privacySensitivity: SecurityDeviceFingerprintPrivacySensitivity;
  requiredDataSources: readonly string[];
  runtimeStatus: SecurityDeviceFingerprintRuntimeStatus;
  safetyNotes: string;
  signalType: SecurityDeviceFingerprintSignalType;
  sourceModule: SecurityDeviceFingerprintSourceModule;
  targetType: SecurityDeviceFingerprintTargetType;
};

export type SecurityDeviceFingerprint = {
  auditRequired: boolean;
  category: SecurityDeviceFingerprintCategory;
  collectionAllowed: false;
  definitionId: string;
  definitionKey: string;
  description: string;
  displayName: string;
  enabled: false;
  enforcementAllowed: false;
  metadataOnly: true;
  privacySensitivity: SecurityDeviceFingerprintPrivacySensitivity;
  readOnly: true;
  requiredDataSources: string[];
  runtimeStatus: SecurityDeviceFingerprintRuntimeStatus;
  safetyNotes: string;
  signalType: SecurityDeviceFingerprintSignalType;
  source: SecurityDeviceFingerprintingSource;
  sourceModule: SecurityDeviceFingerprintSourceModule;
  targetType: SecurityDeviceFingerprintTargetType;
};

export type SecurityDeviceFingerprintCategoryGroup = {
  category: SecurityDeviceFingerprintCategory;
  definitionKeys: string[];
  definitions: SecurityDeviceFingerprint[];
};

export type SecurityDeviceFingerprintingSummary = {
  auditRequiredDefinitions: number;
  categoryCount: number;
  collectingDefinitions: number;
  enabledDefinitions: number;
  enforcingDefinitions: number;
  foundationDefinitions: number;
  highPrivacyDefinitions: number;
  readOnly: true;
  registryKey: string;
  registrySource: typeof SECURITY_REGISTRY_SOURCE;
  source: SecurityDeviceFingerprintingSource;
  status: SecurityDeviceFingerprintingRuntimeState;
  summary: string;
  totalDefinitions: number;
};

export type SecurityDeviceFingerprintingValidation = {
  isValid: boolean;
  issues: string[];
};

export type SecurityDeviceFingerprintingLoadingState = {
  loading: true;
  message: string;
  readOnly: true;
  source: SecurityDeviceFingerprintingSource;
};

export const SECURITY_DEVICE_FINGERPRINTING_SOURCE = "security_device_fingerprinting_runtime" as const;

export const SECURITY_DEVICE_FINGERPRINTING_REGISTRY_KEY = "sec-device-monitoring" as const;

export const SECURITY_DEVICE_FINGERPRINTING_FUTURE_HOOK_KEY = "sec-hook-device-fingerprinting" as const;

export const SECURITY_DEVICE_FINGERPRINTING_PHASE_NOTE =
  "Metadata-only in this phase. Definitions document reserved device fingerprinting signals derived from already-observed data; no fingerprint is collected, no user is tracked, no session or authentication behavior changes, no device is blocked, and no enforcement runs from this runtime.";

const SECURITY_DEVICE_FINGERPRINT_DEFINITIONS: readonly SecurityDeviceFingerprintDefinition[] = [
  {
    auditRequired: true,
    category: "Browser",
    definitionId: "security:device-fingerprint:browser-signature",
    definitionKey: "sec-device-fingerprint-browser-signature",
    description:
      "Foundation definition describing a browser signature derived from already-observed user-agent data. Metadata only; no new fingerprint is collected in this phase.",
    displayName: "Browser Signature",
    privacySensitivity: "medium",
    requiredDataSources: ["security_audit_logs", "sec-device-monitoring-runtime"],
    runtimeStatus: "foundation",
    safetyNotes: "No fingerprint collection, user tracking, or device block runs from this definition.",
    signalType: "browser",
    sourceModule: "device",
    targetType: "device"
  },
  {
    auditRequired: true,
    category: "Operating System",
    definitionId: "security:device-fingerprint:os-signature",
    definitionKey: "sec-device-fingerprint-os-signature",
    description:
      "Foundation definition describing an operating-system signature derived from already-observed user-agent data. Metadata only; no new fingerprint is collected in this phase.",
    displayName: "Operating System Signature",
    privacySensitivity: "medium",
    requiredDataSources: ["security_audit_logs", "sec-device-monitoring-runtime"],
    runtimeStatus: "foundation",
    safetyNotes: "No fingerprint collection, tracking, or enforcement runs from this definition.",
    signalType: "operating_system",
    sourceModule: "device",
    targetType: "device"
  },
  {
    auditRequired: true,
    category: "Device",
    definitionId: "security:device-fingerprint:device-type-signature",
    definitionKey: "sec-device-fingerprint-device-type-signature",
    description:
      "Foundation definition describing a device-type classification derived from already-observed user-agent data. Metadata only; no new fingerprint is collected in this phase.",
    displayName: "Device Type Signature",
    privacySensitivity: "low",
    requiredDataSources: ["security_audit_logs", "sec-device-monitoring-runtime"],
    runtimeStatus: "foundation",
    safetyNotes: "No fingerprint collection, tracking, or device block runs from this definition.",
    signalType: "device_type",
    sourceModule: "device",
    targetType: "device"
  },
  {
    auditRequired: true,
    category: "Device",
    definitionId: "security:device-fingerprint:user-agent-summary",
    definitionKey: "sec-device-fingerprint-user-agent-summary",
    description:
      "Foundation definition describing a summarized user-agent signal already available in security data. Metadata only; no raw fingerprint is stored or collected in this phase.",
    displayName: "User Agent Summary",
    privacySensitivity: "medium",
    requiredDataSources: ["security_audit_logs", "sec-device-monitoring-runtime"],
    runtimeStatus: "foundation",
    safetyNotes: "No raw user-agent storage, collection, or tracking runs from this definition.",
    signalType: "user_agent",
    sourceModule: "audit",
    targetType: "device"
  },
  {
    auditRequired: true,
    category: "Network",
    definitionId: "security:device-fingerprint:ip-device-pair",
    definitionKey: "sec-device-fingerprint-ip-device-pair",
    description:
      "Foundation definition describing an association between an IP and a device signal already observed in security data. Metadata only; no new correlation is collected or enforced in this phase.",
    displayName: "IP + Device Association",
    privacySensitivity: "high",
    requiredDataSources: ["security_audit_logs", "sec-ip-monitoring-runtime", "sec-device-monitoring-runtime"],
    runtimeStatus: "planned",
    safetyNotes: "No correlation collection, tracking, or enforcement runs from this definition.",
    signalType: "ip_device_pair",
    sourceModule: "device",
    targetType: "user"
  },
  {
    auditRequired: true,
    category: "Session",
    definitionId: "security:device-fingerprint:session-pattern",
    definitionKey: "sec-device-fingerprint-session-pattern",
    description:
      "Foundation definition describing session usage patterns derived from already-observed login activity. Metadata only; no session is modified and no pattern is collected in this phase.",
    displayName: "Session Pattern",
    privacySensitivity: "high",
    requiredDataSources: ["security_audit_logs", "sec-login-monitoring-runtime"],
    runtimeStatus: "planned",
    safetyNotes: "No session modification, tracking, or authentication change runs from this definition.",
    signalType: "session_pattern",
    sourceModule: "session",
    targetType: "session"
  },
  {
    auditRequired: true,
    category: "Browser",
    definitionId: "security:device-fingerprint:language-signal",
    definitionKey: "sec-device-fingerprint-language-signal",
    description:
      "Foundation definition describing a language/locale signal that could be derived from already-observed request data. Metadata only; no new signal is collected in this phase.",
    displayName: "Language Signal",
    privacySensitivity: "low",
    requiredDataSources: ["security_audit_logs", "sec-device-monitoring-runtime"],
    runtimeStatus: "reserved",
    safetyNotes: "No signal collection, tracking, or enforcement runs from this definition.",
    signalType: "language",
    sourceModule: "audit",
    targetType: "device"
  },
  {
    auditRequired: true,
    category: "Device",
    definitionId: "security:device-fingerprint:composite-device-identity",
    definitionKey: "sec-device-fingerprint-composite-device-identity",
    description:
      "Foundation definition describing a composite, privacy-sensitive device identity concept. Metadata only; no composite fingerprint is generated, stored, or enforced in this phase.",
    displayName: "Composite Device Identity",
    privacySensitivity: "critical",
    requiredDataSources: ["security_audit_logs", "sec-device-monitoring-runtime", "sec-ip-monitoring-runtime"],
    runtimeStatus: "reserved",
    safetyNotes: "No composite fingerprint generation, collection, tracking, or device block runs from this definition.",
    signalType: "device_type",
    sourceModule: "device",
    targetType: "device"
  }
] as const;

const SECURITY_DEVICE_FINGERPRINT_CATEGORY_ORDER: readonly SecurityDeviceFingerprintCategory[] = [
  "Device",
  "Browser",
  "Operating System",
  "Network",
  "Session"
] as const;

function finalizeDeviceFingerprint(
  definition: SecurityDeviceFingerprintDefinition
): SecurityDeviceFingerprint {
  return {
    auditRequired: definition.auditRequired,
    category: definition.category,
    collectionAllowed: false,
    definitionId: definition.definitionId,
    definitionKey: definition.definitionKey,
    description: definition.description,
    displayName: definition.displayName,
    enabled: false,
    enforcementAllowed: false,
    metadataOnly: true,
    privacySensitivity: definition.privacySensitivity,
    readOnly: true,
    requiredDataSources: [...definition.requiredDataSources],
    runtimeStatus: definition.runtimeStatus,
    safetyNotes: definition.safetyNotes,
    signalType: definition.signalType,
    source: SECURITY_DEVICE_FINGERPRINTING_SOURCE,
    sourceModule: definition.sourceModule,
    targetType: definition.targetType
  };
}

export function listSecurityDeviceFingerprintDefinitions(): SecurityDeviceFingerprintDefinition[] {
  return SECURITY_DEVICE_FINGERPRINT_DEFINITIONS.map((definition) => ({
    ...definition,
    requiredDataSources: [...definition.requiredDataSources]
  }));
}

export function resolveSecurityDeviceFingerprints(): SecurityDeviceFingerprint[] {
  return SECURITY_DEVICE_FINGERPRINT_DEFINITIONS.map((definition) => finalizeDeviceFingerprint(definition));
}

export function getSecurityDeviceFingerprint(definitionKey: string): SecurityDeviceFingerprint | null {
  const definition = SECURITY_DEVICE_FINGERPRINT_DEFINITIONS.find(
    (entry) => entry.definitionKey === definitionKey
  );

  if (!definition) {
    return null;
  }

  return finalizeDeviceFingerprint(definition);
}

export function securityDeviceFingerprintPrivacyBadgeTone(
  privacy: SecurityDeviceFingerprintPrivacySensitivity
) {
  switch (privacy) {
    case "critical":
      return "red" as const;
    case "high":
      return "amber" as const;
    case "medium":
      return "blue" as const;
    case "low":
      return "slate" as const;
  }
}

export function securityDeviceFingerprintStatusBadgeTone(
  status: SecurityDeviceFingerprintRuntimeStatus
) {
  switch (status) {
    case "foundation":
      return "blue" as const;
    case "planned":
      return "amber" as const;
    case "reserved":
      return "slate" as const;
  }
}

export function buildSecurityDeviceFingerprintCategories(
  definitions: SecurityDeviceFingerprint[]
): SecurityDeviceFingerprintCategoryGroup[] {
  const groups = new Map<SecurityDeviceFingerprintCategory, SecurityDeviceFingerprint[]>();

  for (const definition of definitions) {
    const existing = groups.get(definition.category);

    if (existing) {
      existing.push(definition);
    } else {
      groups.set(definition.category, [definition]);
    }
  }

  return SECURITY_DEVICE_FINGERPRINT_CATEGORY_ORDER.filter((category) => groups.has(category)).map(
    (category) => {
      const categoryDefinitions = groups.get(category) ?? [];

      return {
        category,
        definitionKeys: categoryDefinitions.map((definition) => definition.definitionKey),
        definitions: categoryDefinitions
      };
    }
  );
}

export function getSecurityDeviceFingerprintingSummary(
  definitions: SecurityDeviceFingerprint[]
): SecurityDeviceFingerprintingSummary {
  const foundationDefinitions = definitions.filter(
    (definition) => definition.runtimeStatus === "foundation"
  ).length;
  const highPrivacyDefinitions = definitions.filter(
    (definition) =>
      definition.privacySensitivity === "critical" || definition.privacySensitivity === "high"
  ).length;
  const auditRequiredDefinitions = definitions.filter((definition) => definition.auditRequired).length;
  const enabledDefinitions = definitions.filter((definition) => definition.enabled).length;
  const collectingDefinitions = definitions.filter((definition) => definition.collectionAllowed).length;
  const enforcingDefinitions = definitions.filter((definition) => definition.enforcementAllowed).length;
  const categoryCount = buildSecurityDeviceFingerprintCategories(definitions).length;
  const status: SecurityDeviceFingerprintingRuntimeState =
    enabledDefinitions === 0 && collectingDefinitions === 0 && enforcingDefinitions === 0
      ? "device_fingerprinting_ready"
      : "needs_attention";

  return {
    auditRequiredDefinitions,
    categoryCount,
    collectingDefinitions,
    enabledDefinitions,
    enforcingDefinitions,
    foundationDefinitions,
    highPrivacyDefinitions,
    readOnly: true,
    registryKey: SECURITY_DEVICE_FINGERPRINTING_REGISTRY_KEY,
    registrySource: SECURITY_REGISTRY_SOURCE,
    source: SECURITY_DEVICE_FINGERPRINTING_SOURCE,
    status,
    summary: [
      `status ${status}`,
      `${definitions.length} device fingerprint definitions`,
      `${foundationDefinitions} foundation`,
      `${highPrivacyDefinitions} high-privacy`,
      `${enabledDefinitions} enabled`,
      `${collectingDefinitions} collecting`,
      `${enforcingDefinitions} enforcing`
    ].join("; "),
    totalDefinitions: definitions.length
  };
}

export function validateSecurityDeviceFingerprintingRuntime(
  definitions: SecurityDeviceFingerprint[]
): SecurityDeviceFingerprintingValidation {
  const issues: string[] = [];

  if (definitions.length !== SECURITY_DEVICE_FINGERPRINT_DEFINITIONS.length) {
    issues.push("Security device fingerprinting runtime must include all SEC-24 definitions.");
  }

  const keys = new Set<string>();

  for (const definition of definitions) {
    if (definition.enabled !== false) {
      issues.push(`${definition.definitionKey} must remain disabled in this phase.`);
    }

    if (definition.collectionAllowed !== false) {
      issues.push(`${definition.definitionKey} must not allow collection in this phase.`);
    }

    if (definition.enforcementAllowed !== false) {
      issues.push(`${definition.definitionKey} must not allow enforcement in this phase.`);
    }

    if (definition.metadataOnly !== true || definition.readOnly !== true) {
      issues.push(`${definition.definitionKey} must remain metadata-only and read-only.`);
    }

    if (definition.source !== SECURITY_DEVICE_FINGERPRINTING_SOURCE) {
      issues.push(`${definition.definitionKey} must originate from the security device fingerprinting runtime.`);
    }

    if (!definition.auditRequired) {
      issues.push(`${definition.definitionKey} must require audit.`);
    }

    if (definition.requiredDataSources.length === 0) {
      issues.push(`${definition.definitionKey} must declare at least one required data source.`);
    }

    if (!definition.safetyNotes) {
      issues.push(`${definition.definitionKey} must declare safety notes.`);
    }

    if (keys.has(definition.definitionKey)) {
      issues.push(`Duplicate security device fingerprint definition key: ${definition.definitionKey}.`);
    }

    keys.add(definition.definitionKey);
  }

  return {
    isValid: issues.length === 0,
    issues
  };
}

export function buildSecurityDeviceFingerprintingLoadingState(): SecurityDeviceFingerprintingLoadingState {
  return {
    loading: true,
    message: "Loading the read-only Security device fingerprinting foundation from the security registry.",
    readOnly: true,
    source: SECURITY_DEVICE_FINGERPRINTING_SOURCE
  };
}

export function mapSecurityDeviceFingerprintToAdminComponent(definition: SecurityDeviceFingerprint) {
  return {
    auditRequired: definition.auditRequired,
    category: definition.category,
    collectionAllowed: definition.collectionAllowed,
    definitionId: definition.definitionId,
    definitionKey: definition.definitionKey,
    description: definition.description,
    displayName: definition.displayName,
    enabled: definition.enabled,
    enforcementAllowed: definition.enforcementAllowed,
    metadataOnly: definition.metadataOnly,
    privacySensitivity: definition.privacySensitivity,
    requiredDataSources: definition.requiredDataSources,
    runtimeStatus: definition.runtimeStatus,
    safetyNotes: definition.safetyNotes,
    signalType: definition.signalType,
    sourceModule: definition.sourceModule,
    targetType: definition.targetType
  };
}

export function mapSecurityDeviceFingerprintingRuntimeToAdminFields() {
  const registryEntry = getSecurityRegistryEntry(SECURITY_DEVICE_FINGERPRINTING_REGISTRY_KEY);

  if (!registryEntry || registryEntry.visibility !== "super_admin") {
    return {
      categories: [] as ReturnType<typeof buildSecurityDeviceFingerprintCategories>,
      definitions: [] as ReturnType<typeof mapSecurityDeviceFingerprintToAdminComponent>[],
      futureHook: null,
      phaseNote: SECURITY_DEVICE_FINGERPRINTING_PHASE_NOTE,
      registry: null,
      summary: {
        auditRequiredDefinitions: 0,
        categoryCount: 0,
        collectingDefinitions: 0,
        enabledDefinitions: 0,
        enforcingDefinitions: 0,
        foundationDefinitions: 0,
        highPrivacyDefinitions: 0,
        readOnly: true as const,
        registryKey: SECURITY_DEVICE_FINGERPRINTING_REGISTRY_KEY,
        registrySource: SECURITY_REGISTRY_SOURCE,
        source: SECURITY_DEVICE_FINGERPRINTING_SOURCE,
        status: "needs_attention" as const,
        summary: "Device monitoring is not registered as a super-admin module in the security registry.",
        totalDefinitions: 0
      }
    };
  }

  const definitions = resolveSecurityDeviceFingerprints();
  const validation = validateSecurityDeviceFingerprintingRuntime(definitions);
  const summary = getSecurityDeviceFingerprintingSummary(definitions);
  const futureHook = getSecurityFutureHook(SECURITY_DEVICE_FINGERPRINTING_FUTURE_HOOK_KEY);

  return {
    categories: buildSecurityDeviceFingerprintCategories(definitions),
    definitions: definitions.map(mapSecurityDeviceFingerprintToAdminComponent),
    futureHook: futureHook
      ? {
          displayName: futureHook.displayName,
          enabled: futureHook.enabled,
          executionAllowed: futureHook.executionAllowed,
          futurePhase: futureHook.futurePhase,
          hookKey: futureHook.hookKey,
          runtimeStatus: futureHook.runtimeStatus,
          source: SECURITY_FUTURE_HOOKS_SOURCE
        }
      : null,
    phaseNote: SECURITY_DEVICE_FINGERPRINTING_PHASE_NOTE,
    registry: {
      auditEnabled: registryEntry.auditEnabled,
      description: registryEntry.description,
      displayName: registryEntry.displayName,
      key: registryEntry.key,
      permissions: [...registryEntry.permissions],
      route: registryEntry.route,
      runtimeStatus: registryEntry.runtimeStatus,
      source: SECURITY_REGISTRY_SOURCE,
      telemetryEnabled: registryEntry.telemetryEnabled,
      visibility: registryEntry.visibility
    },
    summary: validation.isValid
      ? summary
      : {
          ...summary,
          status: "needs_attention" as const,
          summary: "Security device fingerprinting validation requires safe metadata-only defaults."
        }
  };
}

export async function loadSecurityDeviceFingerprintingReadOnlySafe() {
  return mapSecurityDeviceFingerprintingRuntimeToAdminFields();
}
