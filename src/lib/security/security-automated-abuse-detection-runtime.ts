import "server-only";

import {
  SECURITY_REGISTRY_SOURCE,
  getSecurityRegistryEntry
} from "@/src/lib/security/security-registry-runtime";
import {
  SECURITY_FUTURE_HOOKS_SOURCE,
  getSecurityFutureHook
} from "@/src/lib/security/security-future-hooks-runtime";

export type SecurityAutomatedAbuseSource = "security_automated_abuse_detection_runtime";

export type SecurityAutomatedAbuseCategory =
  | "Access Control"
  | "Account Abuse"
  | "Content Abuse"
  | "Rate Abuse"
  | "Session Abuse";

export type SecurityAutomatedAbuseType =
  | "abuse_flag"
  | "access_denied"
  | "content_abuse"
  | "rate_limit"
  | "repeated_failure"
  | "suspicious_login"
  | "unauthorized";

export type SecurityAutomatedAbuseTargetType = "ip" | "request" | "store" | "user";

export type SecurityAutomatedAbuseSourceModule =
  | "abuse_reports"
  | "access_control"
  | "audit"
  | "login_monitoring"
  | "rate_limit";

export type SecurityAutomatedAbuseSeverity = "critical" | "high" | "low" | "medium";

export type SecurityAutomatedAbuseRuntimeStatus = "foundation" | "planned" | "reserved";

export type SecurityAutomatedAbuseRuntimeState = "abuse_detection_ready" | "needs_attention";

export type SecurityAutomatedAbuseDefinition = {
  abuseType: SecurityAutomatedAbuseType;
  auditRequired: boolean;
  category: SecurityAutomatedAbuseCategory;
  definitionId: string;
  definitionKey: string;
  description: string;
  displayName: string;
  requiredDataSources: readonly string[];
  runtimeStatus: SecurityAutomatedAbuseRuntimeStatus;
  safetyNotes: string;
  severity: SecurityAutomatedAbuseSeverity;
  sourceModule: SecurityAutomatedAbuseSourceModule;
  targetType: SecurityAutomatedAbuseTargetType;
};

export type SecurityAutomatedAbuseRule = {
  abuseType: SecurityAutomatedAbuseType;
  auditRequired: boolean;
  category: SecurityAutomatedAbuseCategory;
  definitionId: string;
  definitionKey: string;
  description: string;
  detectionAllowed: false;
  displayName: string;
  enabled: false;
  enforcementAllowed: false;
  metadataOnly: true;
  readOnly: true;
  requiredDataSources: string[];
  runtimeStatus: SecurityAutomatedAbuseRuntimeStatus;
  safetyNotes: string;
  severity: SecurityAutomatedAbuseSeverity;
  source: SecurityAutomatedAbuseSource;
  sourceModule: SecurityAutomatedAbuseSourceModule;
  targetType: SecurityAutomatedAbuseTargetType;
};

export type SecurityAutomatedAbuseCategoryGroup = {
  category: SecurityAutomatedAbuseCategory;
  definitionKeys: string[];
  definitions: SecurityAutomatedAbuseRule[];
};

export type SecurityAutomatedAbuseSummary = {
  auditRequiredDefinitions: number;
  categoryCount: number;
  criticalDefinitions: number;
  detectingDefinitions: number;
  enabledDefinitions: number;
  enforcingDefinitions: number;
  foundationDefinitions: number;
  highDefinitions: number;
  readOnly: true;
  registryKey: string;
  registrySource: typeof SECURITY_REGISTRY_SOURCE;
  source: SecurityAutomatedAbuseSource;
  status: SecurityAutomatedAbuseRuntimeState;
  summary: string;
  totalDefinitions: number;
};

export type SecurityAutomatedAbuseValidation = {
  isValid: boolean;
  issues: string[];
};

export type SecurityAutomatedAbuseLoadingState = {
  loading: true;
  message: string;
  readOnly: true;
  source: SecurityAutomatedAbuseSource;
};

export const SECURITY_AUTOMATED_ABUSE_SOURCE = "security_automated_abuse_detection_runtime" as const;

export const SECURITY_AUTOMATED_ABUSE_REGISTRY_KEY = "sec-abuse-detection" as const;

export const SECURITY_AUTOMATED_ABUSE_FUTURE_HOOK_KEY = "sec-hook-automated-abuse-detection" as const;

export const SECURITY_AUTOMATED_ABUSE_PHASE_NOTE =
  "Metadata-only in this phase. Definitions document reserved automated abuse detection rules; no detection executes, no abuse score is calculated, no abuse event is created, no user/IP/device/store/request is blocked, no rate limit changes, and no notification is sent from this runtime.";

const SECURITY_AUTOMATED_ABUSE_DEFINITIONS: readonly SecurityAutomatedAbuseDefinition[] = [
  {
    abuseType: "repeated_failure",
    auditRequired: true,
    category: "Account Abuse",
    definitionId: "security:abuse-detection:repeated-login-failure",
    definitionKey: "sec-abuse-detection-repeated-login-failure",
    description:
      "Foundation definition describing repeated login failures from a single actor. Metadata only; no detection executes and no score is calculated in this phase.",
    displayName: "Repeated Login Failure",
    requiredDataSources: ["security_audit_logs", "sec-login-monitoring-runtime"],
    runtimeStatus: "foundation",
    safetyNotes: "No detection, scoring, block, or suspension runs from this definition.",
    severity: "high",
    sourceModule: "login_monitoring",
    targetType: "user"
  },
  {
    abuseType: "rate_limit",
    auditRequired: true,
    category: "Rate Abuse",
    definitionId: "security:abuse-detection:rate-limit-abuse",
    definitionKey: "sec-abuse-detection-rate-limit-abuse",
    description:
      "Foundation definition describing repeated rate-limit violations from a single actor. Metadata only; no detection executes and no rate limit changes in this phase.",
    displayName: "Rate Limit Abuse",
    requiredDataSources: ["security_audit_logs", "sec-rate-limits-runtime"],
    runtimeStatus: "foundation",
    safetyNotes: "No detection, throttling, block, or rate-limit change runs from this definition.",
    severity: "high",
    sourceModule: "rate_limit",
    targetType: "ip"
  },
  {
    abuseType: "unauthorized",
    auditRequired: true,
    category: "Access Control",
    definitionId: "security:abuse-detection:unauthorized-access-attempts",
    definitionKey: "sec-abuse-detection-unauthorized-access-attempts",
    description:
      "Foundation definition describing repeated unauthorized access attempts. Metadata only; no detection executes and no request is blocked in this phase.",
    displayName: "Unauthorized Access Attempts",
    requiredDataSources: ["security_audit_logs", "sec-abuse-detection-runtime"],
    runtimeStatus: "foundation",
    safetyNotes: "No detection, request block, or access change runs from this definition.",
    severity: "high",
    sourceModule: "access_control",
    targetType: "user"
  },
  {
    abuseType: "access_denied",
    auditRequired: true,
    category: "Access Control",
    definitionId: "security:abuse-detection:repeated-access-denied",
    definitionKey: "sec-abuse-detection-repeated-access-denied",
    description:
      "Foundation definition describing repeated access-denied events. Metadata only; no detection executes and no enforcement runs in this phase.",
    displayName: "Repeated Access Denied",
    requiredDataSources: ["security_audit_logs", "sec-abuse-detection-runtime"],
    runtimeStatus: "foundation",
    safetyNotes: "No detection, enforcement, or block runs from this definition.",
    severity: "medium",
    sourceModule: "access_control",
    targetType: "user"
  },
  {
    abuseType: "suspicious_login",
    auditRequired: true,
    category: "Session Abuse",
    definitionId: "security:abuse-detection:suspicious-login-pattern",
    definitionKey: "sec-abuse-detection-suspicious-login-pattern",
    description:
      "Foundation definition describing suspicious login patterns across sessions. Metadata only; no detection executes and no session is modified in this phase.",
    displayName: "Suspicious Login Pattern",
    requiredDataSources: ["security_audit_logs", "sec-login-monitoring-runtime", "sec-ip-monitoring-runtime"],
    runtimeStatus: "planned",
    safetyNotes: "No detection, session modification, or block runs from this definition.",
    severity: "high",
    sourceModule: "login_monitoring",
    targetType: "user"
  },
  {
    abuseType: "abuse_flag",
    auditRequired: true,
    category: "Account Abuse",
    definitionId: "security:abuse-detection:reported-abuse-signal",
    definitionKey: "sec-abuse-detection-reported-abuse-signal",
    description:
      "Foundation definition describing reported abuse signals tied to a user or store. Metadata only; no detection executes and no suspension runs in this phase.",
    displayName: "Reported Abuse Signal",
    requiredDataSources: ["security_audit_logs", "sec-abuse-detection-runtime"],
    runtimeStatus: "planned",
    safetyNotes: "No detection, suspension, or enforcement runs from this definition.",
    severity: "medium",
    sourceModule: "abuse_reports",
    targetType: "store"
  },
  {
    abuseType: "content_abuse",
    auditRequired: true,
    category: "Content Abuse",
    definitionId: "security:abuse-detection:content-abuse-pattern",
    definitionKey: "sec-abuse-detection-content-abuse-pattern",
    description:
      "Foundation definition describing content abuse patterns observed in existing moderation-related signals. Metadata only; no detection executes and no content action runs in this phase.",
    displayName: "Content Abuse Pattern",
    requiredDataSources: ["security_audit_logs", "sec-abuse-detection-runtime"],
    runtimeStatus: "reserved",
    safetyNotes: "No detection, content removal, or moderation action runs from this definition.",
    severity: "low",
    sourceModule: "abuse_reports",
    targetType: "store"
  },
  {
    abuseType: "abuse_flag",
    auditRequired: true,
    category: "Rate Abuse",
    definitionId: "security:abuse-detection:distributed-abuse-cluster",
    definitionKey: "sec-abuse-detection-distributed-abuse-cluster",
    description:
      "Foundation definition describing distributed abuse activity across multiple IPs. Metadata only; no detection executes and no block runs in this phase.",
    displayName: "Distributed Abuse Cluster",
    requiredDataSources: ["security_audit_logs", "sec-ip-monitoring-runtime", "sec-rate-limits-runtime"],
    runtimeStatus: "reserved",
    safetyNotes: "No detection, clustering enforcement, or block runs from this definition.",
    severity: "critical",
    sourceModule: "audit",
    targetType: "ip"
  }
] as const;

const SECURITY_AUTOMATED_ABUSE_CATEGORY_ORDER: readonly SecurityAutomatedAbuseCategory[] = [
  "Account Abuse",
  "Access Control",
  "Rate Abuse",
  "Session Abuse",
  "Content Abuse"
] as const;

function finalizeAbuseDefinition(definition: SecurityAutomatedAbuseDefinition): SecurityAutomatedAbuseRule {
  return {
    abuseType: definition.abuseType,
    auditRequired: definition.auditRequired,
    category: definition.category,
    definitionId: definition.definitionId,
    definitionKey: definition.definitionKey,
    description: definition.description,
    detectionAllowed: false,
    displayName: definition.displayName,
    enabled: false,
    enforcementAllowed: false,
    metadataOnly: true,
    readOnly: true,
    requiredDataSources: [...definition.requiredDataSources],
    runtimeStatus: definition.runtimeStatus,
    safetyNotes: definition.safetyNotes,
    severity: definition.severity,
    source: SECURITY_AUTOMATED_ABUSE_SOURCE,
    sourceModule: definition.sourceModule,
    targetType: definition.targetType
  };
}

export function listSecurityAutomatedAbuseDefinitions(): SecurityAutomatedAbuseDefinition[] {
  return SECURITY_AUTOMATED_ABUSE_DEFINITIONS.map((definition) => ({
    ...definition,
    requiredDataSources: [...definition.requiredDataSources]
  }));
}

export function resolveSecurityAutomatedAbuseDefinitions(): SecurityAutomatedAbuseRule[] {
  return SECURITY_AUTOMATED_ABUSE_DEFINITIONS.map((definition) => finalizeAbuseDefinition(definition));
}

export function getSecurityAutomatedAbuseDefinition(definitionKey: string): SecurityAutomatedAbuseRule | null {
  const definition = SECURITY_AUTOMATED_ABUSE_DEFINITIONS.find((entry) => entry.definitionKey === definitionKey);

  if (!definition) {
    return null;
  }

  return finalizeAbuseDefinition(definition);
}

export function securityAutomatedAbuseSeverityBadgeTone(severity: SecurityAutomatedAbuseSeverity) {
  switch (severity) {
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

export function securityAutomatedAbuseStatusBadgeTone(status: SecurityAutomatedAbuseRuntimeStatus) {
  switch (status) {
    case "foundation":
      return "blue" as const;
    case "planned":
      return "amber" as const;
    case "reserved":
      return "slate" as const;
  }
}

export function buildSecurityAutomatedAbuseCategories(
  definitions: SecurityAutomatedAbuseRule[]
): SecurityAutomatedAbuseCategoryGroup[] {
  const groups = new Map<SecurityAutomatedAbuseCategory, SecurityAutomatedAbuseRule[]>();

  for (const definition of definitions) {
    const existing = groups.get(definition.category);

    if (existing) {
      existing.push(definition);
    } else {
      groups.set(definition.category, [definition]);
    }
  }

  return SECURITY_AUTOMATED_ABUSE_CATEGORY_ORDER.filter((category) => groups.has(category)).map((category) => {
    const categoryDefinitions = groups.get(category) ?? [];

    return {
      category,
      definitionKeys: categoryDefinitions.map((definition) => definition.definitionKey),
      definitions: categoryDefinitions
    };
  });
}

export function getSecurityAutomatedAbuseSummary(
  definitions: SecurityAutomatedAbuseRule[]
): SecurityAutomatedAbuseSummary {
  const foundationDefinitions = definitions.filter((definition) => definition.runtimeStatus === "foundation").length;
  const criticalDefinitions = definitions.filter((definition) => definition.severity === "critical").length;
  const highDefinitions = definitions.filter((definition) => definition.severity === "high").length;
  const auditRequiredDefinitions = definitions.filter((definition) => definition.auditRequired).length;
  const enabledDefinitions = definitions.filter((definition) => definition.enabled).length;
  const detectingDefinitions = definitions.filter((definition) => definition.detectionAllowed).length;
  const enforcingDefinitions = definitions.filter((definition) => definition.enforcementAllowed).length;
  const categoryCount = buildSecurityAutomatedAbuseCategories(definitions).length;
  const status: SecurityAutomatedAbuseRuntimeState =
    enabledDefinitions === 0 && detectingDefinitions === 0 && enforcingDefinitions === 0
      ? "abuse_detection_ready"
      : "needs_attention";

  return {
    auditRequiredDefinitions,
    categoryCount,
    criticalDefinitions,
    detectingDefinitions,
    enabledDefinitions,
    enforcingDefinitions,
    foundationDefinitions,
    highDefinitions,
    readOnly: true,
    registryKey: SECURITY_AUTOMATED_ABUSE_REGISTRY_KEY,
    registrySource: SECURITY_REGISTRY_SOURCE,
    source: SECURITY_AUTOMATED_ABUSE_SOURCE,
    status,
    summary: [
      `status ${status}`,
      `${definitions.length} abuse detection definitions`,
      `${foundationDefinitions} foundation`,
      `${criticalDefinitions} critical`,
      `${highDefinitions} high`,
      `${enabledDefinitions} enabled`,
      `${detectingDefinitions} detecting`,
      `${enforcingDefinitions} enforcing`
    ].join("; "),
    totalDefinitions: definitions.length
  };
}

export function validateSecurityAutomatedAbuseRuntime(
  definitions: SecurityAutomatedAbuseRule[]
): SecurityAutomatedAbuseValidation {
  const issues: string[] = [];

  if (definitions.length !== SECURITY_AUTOMATED_ABUSE_DEFINITIONS.length) {
    issues.push("Security automated abuse detection runtime must include all SEC-25 definitions.");
  }

  const keys = new Set<string>();

  for (const definition of definitions) {
    if (definition.enabled !== false) {
      issues.push(`${definition.definitionKey} must remain disabled in this phase.`);
    }

    if (definition.detectionAllowed !== false) {
      issues.push(`${definition.definitionKey} must not allow detection in this phase.`);
    }

    if (definition.enforcementAllowed !== false) {
      issues.push(`${definition.definitionKey} must not allow enforcement in this phase.`);
    }

    if (definition.metadataOnly !== true || definition.readOnly !== true) {
      issues.push(`${definition.definitionKey} must remain metadata-only and read-only.`);
    }

    if (definition.source !== SECURITY_AUTOMATED_ABUSE_SOURCE) {
      issues.push(`${definition.definitionKey} must originate from the security automated abuse detection runtime.`);
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
      issues.push(`Duplicate security automated abuse definition key: ${definition.definitionKey}.`);
    }

    keys.add(definition.definitionKey);
  }

  return {
    isValid: issues.length === 0,
    issues
  };
}

export function buildSecurityAutomatedAbuseLoadingState(): SecurityAutomatedAbuseLoadingState {
  return {
    loading: true,
    message: "Loading the read-only Security automated abuse detection foundation from the security registry.",
    readOnly: true,
    source: SECURITY_AUTOMATED_ABUSE_SOURCE
  };
}

export function mapSecurityAutomatedAbuseToAdminComponent(definition: SecurityAutomatedAbuseRule) {
  return {
    abuseType: definition.abuseType,
    auditRequired: definition.auditRequired,
    category: definition.category,
    definitionId: definition.definitionId,
    definitionKey: definition.definitionKey,
    description: definition.description,
    detectionAllowed: definition.detectionAllowed,
    displayName: definition.displayName,
    enabled: definition.enabled,
    enforcementAllowed: definition.enforcementAllowed,
    metadataOnly: definition.metadataOnly,
    requiredDataSources: definition.requiredDataSources,
    runtimeStatus: definition.runtimeStatus,
    safetyNotes: definition.safetyNotes,
    severity: definition.severity,
    sourceModule: definition.sourceModule,
    targetType: definition.targetType
  };
}

export function mapSecurityAutomatedAbuseRuntimeToAdminFields() {
  const registryEntry = getSecurityRegistryEntry(SECURITY_AUTOMATED_ABUSE_REGISTRY_KEY);

  if (!registryEntry || registryEntry.visibility !== "super_admin") {
    return {
      categories: [] as ReturnType<typeof buildSecurityAutomatedAbuseCategories>,
      definitions: [] as ReturnType<typeof mapSecurityAutomatedAbuseToAdminComponent>[],
      futureHook: null,
      phaseNote: SECURITY_AUTOMATED_ABUSE_PHASE_NOTE,
      registry: null,
      summary: {
        auditRequiredDefinitions: 0,
        categoryCount: 0,
        criticalDefinitions: 0,
        detectingDefinitions: 0,
        enabledDefinitions: 0,
        enforcingDefinitions: 0,
        foundationDefinitions: 0,
        highDefinitions: 0,
        readOnly: true as const,
        registryKey: SECURITY_AUTOMATED_ABUSE_REGISTRY_KEY,
        registrySource: SECURITY_REGISTRY_SOURCE,
        source: SECURITY_AUTOMATED_ABUSE_SOURCE,
        status: "needs_attention" as const,
        summary: "Abuse detection is not registered as a super-admin module in the security registry.",
        totalDefinitions: 0
      }
    };
  }

  const definitions = resolveSecurityAutomatedAbuseDefinitions();
  const validation = validateSecurityAutomatedAbuseRuntime(definitions);
  const summary = getSecurityAutomatedAbuseSummary(definitions);
  const futureHook = getSecurityFutureHook(SECURITY_AUTOMATED_ABUSE_FUTURE_HOOK_KEY);

  return {
    categories: buildSecurityAutomatedAbuseCategories(definitions),
    definitions: definitions.map(mapSecurityAutomatedAbuseToAdminComponent),
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
    phaseNote: SECURITY_AUTOMATED_ABUSE_PHASE_NOTE,
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
          summary: "Security automated abuse detection validation requires safe metadata-only defaults."
        }
  };
}

export async function loadSecurityAutomatedAbuseReadOnlySafe() {
  return mapSecurityAutomatedAbuseRuntimeToAdminFields();
}
