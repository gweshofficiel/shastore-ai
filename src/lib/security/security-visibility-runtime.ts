import "server-only";

import {
  SECURITY_REGISTRY_SOURCE,
  getSecurityRegistryEntry,
  type SecurityRuntimeStatus
} from "@/src/lib/security/security-registry-runtime";

export type SecurityVisibilitySource = "security_visibility_runtime";

export type SecurityVisibilityStatus = "disabled" | "hidden" | "visible";

export type SecurityVisibilityDependencyStatus = "none" | "satisfied" | "unsatisfied";

export type SecurityVisibilityRuntimeStatus = SecurityRuntimeStatus | "unavailable";

export type SecurityVisibilityTier = "foundation" | "runtime";

export type SecurityVisibilityRuntimeState = "disabled" | "empty" | "success";

export type SecurityVisibilityDefinition = {
  dependencies: readonly string[];
  displayName: string;
  moduleKey: string;
  requiredPermission: string;
  safetyNotes: string;
  tier: SecurityVisibilityTier;
  visibilityId: string;
};

export type SecurityVisibilityRule = {
  dependencies: string[];
  dependencyStatus: SecurityVisibilityDependencyStatus;
  disabledReason: string | null;
  displayName: string;
  moduleKey: string;
  readOnly: true;
  requiredPermission: string;
  runtimeStatus: SecurityVisibilityRuntimeStatus;
  safetyNotes: string;
  source: SecurityVisibilitySource;
  tier: SecurityVisibilityTier;
  visibilityId: string;
  visibilityStatus: SecurityVisibilityStatus;
};

export type SecurityVisibilitySummary = {
  disabledCount: number;
  hiddenCount: number;
  readOnly: true;
  source: SecurityVisibilitySource;
  summary: string;
  totalRules: number;
  visibleCount: number;
};

export type SecurityVisibilitySupport = {
  disabledReason: string | null;
  readOnly: true;
  registryKey: string;
  registrySource: typeof SECURITY_REGISTRY_SOURCE;
  source: SecurityVisibilitySource;
  supported: boolean;
};

export type SecurityVisibilityValidation = {
  isValid: boolean;
  issues: string[];
};

export type SecurityVisibilityResult = {
  readOnly: true;
  rules: SecurityVisibilityRule[];
  source: SecurityVisibilitySource;
  state: SecurityVisibilityRuntimeState;
  summary: SecurityVisibilitySummary;
};

export type SecurityVisibilityLoadingState = {
  loading: true;
  message: string;
  readOnly: true;
  source: SecurityVisibilitySource;
};

export const SECURITY_VISIBILITY_SOURCE = "security_visibility_runtime" as const;

export const SECURITY_VISIBILITY_REGISTRY_KEY = "sec-advanced-security-center" as const;

export const SECURITY_VISIBILITY_READ_PERMISSION = "super_admin:read" as const;

export const SECURITY_VISIBILITY_ACTION_PERMISSION = "super_admin:safe_action" as const;

export const SECURITY_VISIBILITY_DISABLED_STATE =
  "Security Visibility is not available in the current runtime configuration.";

export const SECURITY_VISIBILITY_DEFINITIONS: readonly SecurityVisibilityDefinition[] = [
  {
    dependencies: [],
    displayName: "Security Dashboard",
    moduleKey: "sec-advanced-security-center",
    requiredPermission: SECURITY_VISIBILITY_READ_PERMISSION,
    safetyNotes: "Read-only aggregation surface. Displays existing security signals only; no mutation on page load.",
    tier: "runtime",
    visibilityId: "sec-visibility-dashboard"
  },
  {
    dependencies: [],
    displayName: "Audit Logs",
    moduleKey: "sec-audit-logs",
    requiredPermission: SECURITY_VISIBILITY_READ_PERMISSION,
    safetyNotes: "Read-only audit log review. No audit writes, exports, or purges on page load.",
    tier: "runtime",
    visibilityId: "sec-visibility-audit-logs"
  },
  {
    dependencies: [],
    displayName: "Login Monitoring",
    moduleKey: "sec-login-monitoring",
    requiredPermission: SECURITY_VISIBILITY_READ_PERMISSION,
    safetyNotes: "Read-only login success/failure visibility. No credential, session, or account mutation.",
    tier: "runtime",
    visibilityId: "sec-visibility-login-monitoring"
  },
  {
    dependencies: ["sec-login-monitoring"],
    displayName: "IP Monitoring",
    moduleKey: "sec-ip-monitoring",
    requiredPermission: SECURITY_VISIBILITY_READ_PERMISSION,
    safetyNotes: "Read-only masked IP visibility. No IP blocking or geolocation provider calls.",
    tier: "runtime",
    visibilityId: "sec-visibility-ip-monitoring"
  },
  {
    dependencies: ["sec-login-monitoring"],
    displayName: "Device Monitoring",
    moduleKey: "sec-device-monitoring",
    requiredPermission: SECURITY_VISIBILITY_READ_PERMISSION,
    safetyNotes: "Read-only device/browser visibility. No fingerprinting or device revocation.",
    tier: "runtime",
    visibilityId: "sec-visibility-device-monitoring"
  },
  {
    dependencies: ["sec-login-monitoring", "sec-ip-monitoring", "sec-rate-limits"],
    displayName: "Abuse Detection",
    moduleKey: "sec-abuse-detection",
    requiredPermission: SECURITY_VISIBILITY_READ_PERMISSION,
    safetyNotes: "Read-only observed abuse signals. No scoring, blocking, or background jobs.",
    tier: "runtime",
    visibilityId: "sec-visibility-abuse-detection"
  },
  {
    dependencies: ["sec-login-monitoring", "sec-device-monitoring", "sec-risk-score"],
    displayName: "Fraud Detection",
    moduleKey: "sec-fraud-detection",
    requiredPermission: SECURITY_VISIBILITY_READ_PERMISSION,
    safetyNotes: "Read-only observed fraud signals. No scoring, provider calls, or background jobs.",
    tier: "runtime",
    visibilityId: "sec-visibility-fraud-detection"
  },
  {
    dependencies: [],
    displayName: "Rate Limits",
    moduleKey: "sec-rate-limits",
    requiredPermission: SECURITY_VISIBILITY_READ_PERMISSION,
    safetyNotes: "Read-only limit visibility. No limit mutation or counter reset.",
    tier: "runtime",
    visibilityId: "sec-visibility-rate-limits"
  },
  {
    dependencies: ["sec-login-monitoring", "sec-ip-monitoring", "sec-device-monitoring"],
    displayName: "Risk Score",
    moduleKey: "sec-risk-score",
    requiredPermission: SECURITY_VISIBILITY_READ_PERMISSION,
    safetyNotes: "Read-only derived risk scores. No automated enforcement or scoring jobs.",
    tier: "runtime",
    visibilityId: "sec-visibility-risk-score"
  },
  {
    dependencies: ["sec-risk-score"],
    displayName: "Risk Levels",
    moduleKey: "sec-risk-levels",
    requiredPermission: SECURITY_VISIBILITY_READ_PERMISSION,
    safetyNotes: "Read-only severity tier mapping. No automated actions triggered by risk level.",
    tier: "runtime",
    visibilityId: "sec-visibility-risk-levels"
  },
  {
    dependencies: ["sec-audit-logs"],
    displayName: "Security Events",
    moduleKey: "sec-security-events",
    requiredPermission: SECURITY_VISIBILITY_READ_PERMISSION,
    safetyNotes: "Read-only event stream. No event mutation or export execution on page load.",
    tier: "runtime",
    visibilityId: "sec-visibility-security-events"
  },
  {
    dependencies: ["sec-security-events"],
    displayName: "Security Event Details",
    moduleKey: "sec-security-events",
    requiredPermission: SECURITY_VISIBILITY_READ_PERMISSION,
    safetyNotes: "Read-only single-event detail view with masked fields. No mutation on page load.",
    tier: "runtime",
    visibilityId: "sec-visibility-security-event-details"
  },
  {
    dependencies: ["sec-security-events"],
    displayName: "Security Safe Actions",
    moduleKey: "sec-security-actions",
    requiredPermission: SECURITY_VISIBILITY_ACTION_PERMISSION,
    safetyNotes: "Explicit Super Admin actions only. No execution on page load; every action requires click, validation, and audit.",
    tier: "runtime",
    visibilityId: "sec-visibility-security-safe-actions"
  },
  {
    dependencies: ["sec-security-events", "sec-audit-logs"],
    displayName: "Security Export",
    moduleKey: "sec-security-actions",
    requiredPermission: SECURITY_VISIBILITY_ACTION_PERMISSION,
    safetyNotes: "Explicit read-only export of masked data. No secrets exported; no automatic execution.",
    tier: "runtime",
    visibilityId: "sec-visibility-security-export"
  },
  {
    dependencies: [],
    displayName: "Future Hooks",
    moduleKey: "sec-future-hooks",
    requiredPermission: SECURITY_VISIBILITY_READ_PERMISSION,
    safetyNotes: "Metadata-only reserved integration points. Disabled and non-executing by design.",
    tier: "foundation",
    visibilityId: "sec-visibility-future-hooks"
  },
  {
    dependencies: ["sec-fraud-detection"],
    displayName: "Fraud Rules",
    moduleKey: "sec-fraud-detection",
    requiredPermission: SECURITY_VISIBILITY_READ_PERMISSION,
    safetyNotes: "Metadata-only fraud rule definitions. Non-executing and non-scoring foundation.",
    tier: "foundation",
    visibilityId: "sec-visibility-fraud-rules"
  },
  {
    dependencies: ["sec-ip-monitoring"],
    displayName: "IP Blocklist",
    moduleKey: "sec-ip-monitoring",
    requiredPermission: SECURITY_VISIBILITY_READ_PERMISSION,
    safetyNotes: "Metadata-only IP blocklist definitions. Non-enforcing foundation.",
    tier: "foundation",
    visibilityId: "sec-visibility-ip-blocklist"
  },
  {
    dependencies: ["sec-device-monitoring"],
    displayName: "Device Fingerprinting",
    moduleKey: "sec-device-monitoring",
    requiredPermission: SECURITY_VISIBILITY_READ_PERMISSION,
    safetyNotes: "Metadata-only fingerprinting definitions. Non-collecting and non-enforcing foundation.",
    tier: "foundation",
    visibilityId: "sec-visibility-device-fingerprinting"
  },
  {
    dependencies: ["sec-abuse-detection"],
    displayName: "Automated Abuse Detection",
    moduleKey: "sec-abuse-detection",
    requiredPermission: SECURITY_VISIBILITY_READ_PERMISSION,
    safetyNotes: "Metadata-only abuse detection definitions. Non-detecting and non-enforcing foundation.",
    tier: "foundation",
    visibilityId: "sec-visibility-automated-abuse-detection"
  },
  {
    dependencies: ["sec-advanced-security-center"],
    displayName: "Security Alert Notifications",
    moduleKey: "sec-advanced-security-center",
    requiredPermission: SECURITY_VISIBILITY_READ_PERMISSION,
    safetyNotes: "Metadata-only alert notification readiness. Non-sending foundation.",
    tier: "foundation",
    visibilityId: "sec-visibility-security-alert-notifications"
  },
  {
    dependencies: ["sec-security-events", "sec-audit-logs"],
    displayName: "Security Search",
    moduleKey: "sec-advanced-security-center",
    requiredPermission: SECURITY_VISIBILITY_READ_PERMISSION,
    safetyNotes: "Read-only search across existing datasets with masked fields. No indexing or mutation.",
    tier: "runtime",
    visibilityId: "sec-visibility-security-search"
  },
  {
    dependencies: ["sec-security-events", "sec-audit-logs"],
    displayName: "Security Filters",
    moduleKey: "sec-advanced-security-center",
    requiredPermission: SECURITY_VISIBILITY_READ_PERMISSION,
    safetyNotes: "Read-only filtering across existing datasets with masked fields. No mutation or indexing.",
    tier: "runtime",
    visibilityId: "sec-visibility-security-filters"
  },
  {
    dependencies: ["sec-advanced-security-center"],
    displayName: "Security Metrics",
    moduleKey: "sec-advanced-security-center",
    requiredPermission: SECURITY_VISIBILITY_READ_PERMISSION,
    safetyNotes: "Read-only lightweight counts from existing datasets. No aggregation jobs or persistence.",
    tier: "runtime",
    visibilityId: "sec-visibility-security-metrics"
  }
] as const;

export function resolveSecurityVisibilitySupport(): SecurityVisibilitySupport {
  const registryEntry = getSecurityRegistryEntry(SECURITY_VISIBILITY_REGISTRY_KEY);

  const base = {
    readOnly: true as const,
    registryKey: SECURITY_VISIBILITY_REGISTRY_KEY,
    registrySource: SECURITY_REGISTRY_SOURCE,
    source: SECURITY_VISIBILITY_SOURCE
  };

  if (!registryEntry || registryEntry.visibility !== "super_admin") {
    return {
      ...base,
      disabledReason: "The advanced security center is not registered as a super-admin module in the security registry.",
      supported: false
    };
  }

  return {
    ...base,
    disabledReason: null,
    supported: true
  };
}

export function listSecurityVisibilityDefinitions(): SecurityVisibilityDefinition[] {
  return SECURITY_VISIBILITY_DEFINITIONS.map((definition) => ({
    ...definition,
    dependencies: [...definition.dependencies]
  }));
}

function resolveDependencyStatus(dependencies: readonly string[]): SecurityVisibilityDependencyStatus {
  if (dependencies.length === 0) {
    return "none";
  }

  const satisfied = dependencies.every((dependency) => {
    const entry = getSecurityRegistryEntry(dependency);
    return Boolean(entry && entry.visibility === "super_admin");
  });

  return satisfied ? "satisfied" : "unsatisfied";
}

function unavailableDependencies(dependencies: readonly string[]): string[] {
  return dependencies.filter((dependency) => {
    const entry = getSecurityRegistryEntry(dependency);
    return !entry || entry.visibility !== "super_admin";
  });
}

export function resolveSecurityVisibilityRule(
  definition: SecurityVisibilityDefinition
): SecurityVisibilityRule {
  const registryEntry = getSecurityRegistryEntry(definition.moduleKey);
  const dependencyStatus = resolveDependencyStatus(definition.dependencies);

  const base = {
    dependencies: [...definition.dependencies],
    dependencyStatus,
    displayName: definition.displayName,
    moduleKey: definition.moduleKey,
    readOnly: true as const,
    requiredPermission: definition.requiredPermission,
    safetyNotes: definition.safetyNotes,
    source: SECURITY_VISIBILITY_SOURCE,
    tier: definition.tier,
    visibilityId: definition.visibilityId
  };

  if (!registryEntry || registryEntry.visibility !== "super_admin") {
    return {
      ...base,
      disabledReason: `${definition.displayName} is not registered as a super-admin module in the security registry.`,
      runtimeStatus: "unavailable",
      visibilityStatus: "hidden"
    };
  }

  if (dependencyStatus === "unsatisfied") {
    return {
      ...base,
      disabledReason: `Required dependencies are unavailable: ${unavailableDependencies(definition.dependencies).join(", ")}.`,
      runtimeStatus: registryEntry.runtimeStatus,
      visibilityStatus: "disabled"
    };
  }

  if (definition.tier === "foundation") {
    return {
      ...base,
      disabledReason: `${definition.displayName} is a metadata-only foundation reserved for a future phase and remains non-executing.`,
      runtimeStatus: registryEntry.runtimeStatus,
      visibilityStatus: "disabled"
    };
  }

  if (registryEntry.runtimeStatus === "planned") {
    return {
      ...base,
      disabledReason: `${definition.displayName} is planned and not yet active in the security registry.`,
      runtimeStatus: registryEntry.runtimeStatus,
      visibilityStatus: "disabled"
    };
  }

  if (registryEntry.runtimeStatus === "review_required") {
    return {
      ...base,
      disabledReason: `${definition.displayName} requires review before it is fully enabled.`,
      runtimeStatus: registryEntry.runtimeStatus,
      visibilityStatus: "disabled"
    };
  }

  return {
    ...base,
    disabledReason: null,
    runtimeStatus: registryEntry.runtimeStatus,
    visibilityStatus: "visible"
  };
}

export function resolveSecurityVisibilityRules(): SecurityVisibilityRule[] {
  return SECURITY_VISIBILITY_DEFINITIONS.map((definition) => resolveSecurityVisibilityRule(definition));
}

export function getSecurityVisibilityRule(visibilityId: string): SecurityVisibilityRule | null {
  const definition = SECURITY_VISIBILITY_DEFINITIONS.find((entry) => entry.visibilityId === visibilityId);
  return definition ? resolveSecurityVisibilityRule(definition) : null;
}

export function isSecurityModuleVisible(visibilityId: string): boolean {
  return getSecurityVisibilityRule(visibilityId)?.visibilityStatus === "visible";
}

export function buildSecurityVisibilitySummary(rules: SecurityVisibilityRule[]): SecurityVisibilitySummary {
  const visibleCount = rules.filter((rule) => rule.visibilityStatus === "visible").length;
  const disabledCount = rules.filter((rule) => rule.visibilityStatus === "disabled").length;
  const hiddenCount = rules.filter((rule) => rule.visibilityStatus === "hidden").length;

  return {
    disabledCount,
    hiddenCount,
    readOnly: true,
    source: SECURITY_VISIBILITY_SOURCE,
    summary: [
      `${rules.length} visibility rules`,
      `${visibleCount} visible`,
      `${disabledCount} disabled`,
      `${hiddenCount} hidden`
    ].join("; "),
    totalRules: rules.length,
    visibleCount
  };
}

export function validateSecurityVisibilityRuntime(
  rules: SecurityVisibilityRule[]
): SecurityVisibilityValidation {
  const issues: string[] = [];
  const ids = new Set<string>();

  if (rules.length !== SECURITY_VISIBILITY_DEFINITIONS.length) {
    issues.push("Security visibility runtime must include every visibility definition.");
  }

  for (const rule of rules) {
    if (ids.has(rule.visibilityId)) {
      issues.push(`Duplicate visibility id: ${rule.visibilityId}.`);
    }

    ids.add(rule.visibilityId);

    if (!rule.readOnly) {
      issues.push(`${rule.visibilityId} must remain read-only.`);
    }

    if (rule.source !== SECURITY_VISIBILITY_SOURCE) {
      issues.push(`${rule.visibilityId} must originate from the security visibility runtime.`);
    }

    if (rule.visibilityStatus !== "visible" && !rule.disabledReason) {
      issues.push(`${rule.visibilityId} must provide a reason when not visible.`);
    }
  }

  return {
    isValid: issues.length === 0,
    issues
  };
}

export function buildSecurityVisibilityLoadingState(): SecurityVisibilityLoadingState {
  return {
    loading: true,
    message: "Resolving read-only security visibility rules from the security registry.",
    readOnly: true,
    source: SECURITY_VISIBILITY_SOURCE
  };
}

export function runSecurityVisibility(): SecurityVisibilityResult {
  const support = resolveSecurityVisibilitySupport();

  if (!support.supported) {
    const rules = SECURITY_VISIBILITY_DEFINITIONS.map((definition) => ({
      dependencies: [...definition.dependencies],
      dependencyStatus: resolveDependencyStatus(definition.dependencies),
      disabledReason: support.disabledReason ?? SECURITY_VISIBILITY_DISABLED_STATE,
      displayName: definition.displayName,
      moduleKey: definition.moduleKey,
      readOnly: true as const,
      requiredPermission: definition.requiredPermission,
      runtimeStatus: "unavailable" as const,
      safetyNotes: definition.safetyNotes,
      source: SECURITY_VISIBILITY_SOURCE,
      tier: definition.tier,
      visibilityId: definition.visibilityId,
      visibilityStatus: "hidden" as const
    }));

    return {
      readOnly: true,
      rules,
      source: SECURITY_VISIBILITY_SOURCE,
      state: "disabled",
      summary: buildSecurityVisibilitySummary(rules)
    };
  }

  const rules = resolveSecurityVisibilityRules();
  const summary = buildSecurityVisibilitySummary(rules);

  return {
    readOnly: true,
    rules,
    source: SECURITY_VISIBILITY_SOURCE,
    state: rules.length === 0 ? "empty" : "success",
    summary
  };
}

export function mapSecurityVisibilityRuntimeToAdminFields() {
  const result = runSecurityVisibility();
  const validation = validateSecurityVisibilityRuntime(result.rules);

  return {
    readOnly: true as const,
    rules: result.rules,
    source: SECURITY_VISIBILITY_SOURCE,
    state: result.state,
    summary: validation.isValid
      ? result.summary
      : { ...result.summary, summary: "Security visibility validation requires safe read-only defaults." },
    validation
  };
}
