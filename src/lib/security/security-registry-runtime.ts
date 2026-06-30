import "server-only";

export type SecurityRegistrySource = "security_registry_runtime";

export type SecurityRegistryCategory =
  | "Access Monitoring"
  | "Audit & Compliance"
  | "Risk Intelligence"
  | "Security Center"
  | "Security Events"
  | "Security Governance"
  | "Security Platform"
  | "Threat Detection";

export type SecurityRuntimeStatus = "active" | "monitoring" | "planned" | "review_required";

export type SecurityImplementationStatus =
  | "architectural"
  | "planned"
  | "production_ready"
  | "registered";

export type SecurityRegistryVisibility = "hidden" | "internal" | "super_admin";

export type SecurityRegistryEntryDefinition = {
  auditEnabled: boolean;
  category: SecurityRegistryCategory;
  dependencies: readonly string[];
  description: string;
  displayName: string;
  featureFlags: readonly string[];
  id: string;
  implementationStatus: SecurityImplementationStatus;
  key: string;
  permissions: readonly string[];
  route: string;
  runtimeStatus: SecurityRuntimeStatus;
  supportedActions: readonly string[];
  telemetryEnabled: boolean;
  visibility: SecurityRegistryVisibility;
};

export type SecurityRegistryEntry = SecurityRegistryEntryDefinition & {
  readOnly: true;
  source: SecurityRegistrySource;
};

export type SecurityRegistryRuntimeStatus = "needs_attention" | "registry_ready";

export type SecurityRegistrySummary = {
  activeEntries: number;
  auditEnabledEntries: number;
  productionReadyEntries: number;
  readOnly: true;
  registeredEntries: number;
  status: SecurityRegistryRuntimeStatus;
  summary: string;
  telemetryEnabledEntries: number;
  totalEntries: number;
};

export type SecurityRegistryValidation = {
  isValid: boolean;
  issues: string[];
};

export type SecurityRegistryCategorySummary = {
  entryCount: number;
  name: SecurityRegistryCategory;
  status: "architectural" | "planned" | "ready";
};

export const SECURITY_REGISTRY_SOURCE = "security_registry_runtime" as const;

const SECURITY_REGISTRY_DEFINITIONS: readonly SecurityRegistryEntryDefinition[] = [
  {
    auditEnabled: true,
    category: "Security Center",
    dependencies: [
      "sec-audit-logs",
      "sec-login-monitoring",
      "sec-ip-monitoring",
      "sec-device-monitoring",
      "sec-rate-limits",
      "sec-risk-score",
      "sec-security-events"
    ],
    description:
      "Advanced Super Admin security center aggregating read-only audit, login, IP, device, rate-limit, risk, and event signals. No mutation, suspension, or secret exposure on page load.",
    displayName: "Advanced Security Center",
    featureFlags: ["security_center", "security_overview"],
    id: "security:advanced-security-center",
    implementationStatus: "production_ready",
    key: "sec-advanced-security-center",
    permissions: ["super_admin:read"],
    route: "/admin/security",
    runtimeStatus: "active",
    supportedActions: ["view"],
    telemetryEnabled: true,
    visibility: "super_admin"
  },
  {
    auditEnabled: true,
    category: "Audit & Compliance",
    dependencies: [],
    description:
      "Security audit log registry derived from existing certified audit storage. Read-only review only; no audit writes, exports, or purges on page load.",
    displayName: "Audit Logs",
    featureFlags: ["audit_logs"],
    id: "security:audit-logs",
    implementationStatus: "production_ready",
    key: "sec-audit-logs",
    permissions: ["super_admin:read"],
    route: "/admin/security",
    runtimeStatus: "active",
    supportedActions: ["view"],
    telemetryEnabled: true,
    visibility: "super_admin"
  },
  {
    auditEnabled: true,
    category: "Access Monitoring",
    dependencies: [],
    description:
      "Login activity monitoring registry from existing login event records. Read-only success/failure visibility; no credential, session, or account mutation on page load.",
    displayName: "Login Monitoring",
    featureFlags: ["login_monitoring"],
    id: "security:login-monitoring",
    implementationStatus: "production_ready",
    key: "sec-login-monitoring",
    permissions: ["super_admin:read"],
    route: "/admin/security",
    runtimeStatus: "monitoring",
    supportedActions: ["view"],
    telemetryEnabled: true,
    visibility: "super_admin"
  },
  {
    auditEnabled: true,
    category: "Access Monitoring",
    dependencies: ["sec-login-monitoring"],
    description:
      "IP signal monitoring registry from masked login event metadata. Read-only masked IP visibility only; no IP blocking or geolocation provider calls on page load.",
    displayName: "IP Monitoring",
    featureFlags: ["ip_monitoring"],
    id: "security:ip-monitoring",
    implementationStatus: "production_ready",
    key: "sec-ip-monitoring",
    permissions: ["super_admin:read"],
    route: "/admin/security",
    runtimeStatus: "monitoring",
    supportedActions: ["view"],
    telemetryEnabled: true,
    visibility: "super_admin"
  },
  {
    auditEnabled: true,
    category: "Access Monitoring",
    dependencies: ["sec-login-monitoring"],
    description:
      "Device and browser monitoring registry from existing user-agent metadata. Read-only device/browser visibility only; no device fingerprinting or revocation on page load.",
    displayName: "Device Monitoring",
    featureFlags: ["device_monitoring"],
    id: "security:device-monitoring",
    implementationStatus: "production_ready",
    key: "sec-device-monitoring",
    permissions: ["super_admin:read"],
    route: "/admin/security",
    runtimeStatus: "monitoring",
    supportedActions: ["view"],
    telemetryEnabled: true,
    visibility: "super_admin"
  },
  {
    auditEnabled: true,
    category: "Threat Detection",
    dependencies: ["sec-login-monitoring", "sec-ip-monitoring", "sec-rate-limits"],
    description:
      "Abuse detection registry metadata only. Architectural placeholder for future heuristics; no detection scoring, blocking, or background jobs run on page load.",
    displayName: "Abuse Detection",
    featureFlags: ["abuse_detection"],
    id: "security:abuse-detection",
    implementationStatus: "architectural",
    key: "sec-abuse-detection",
    permissions: ["super_admin:read"],
    route: "/admin/security",
    runtimeStatus: "review_required",
    supportedActions: ["view"],
    telemetryEnabled: true,
    visibility: "super_admin"
  },
  {
    auditEnabled: true,
    category: "Threat Detection",
    dependencies: ["sec-login-monitoring", "sec-device-monitoring", "sec-risk-score"],
    description:
      "Fraud detection registry metadata only. Architectural placeholder for future fraud signals; no scoring, provider calls, or background jobs run on page load.",
    displayName: "Fraud Detection",
    featureFlags: ["fraud_detection"],
    id: "security:fraud-detection",
    implementationStatus: "architectural",
    key: "sec-fraud-detection",
    permissions: ["super_admin:read"],
    route: "/admin/security",
    runtimeStatus: "review_required",
    supportedActions: ["view"],
    telemetryEnabled: true,
    visibility: "super_admin"
  },
  {
    auditEnabled: true,
    category: "Threat Detection",
    dependencies: [],
    description:
      "Rate limit registry derived from existing certified rate-limit runtime. Read-only limit visibility only; no limit mutation or counter reset on page load.",
    displayName: "Rate Limits",
    featureFlags: ["rate_limits"],
    id: "security:rate-limits",
    implementationStatus: "production_ready",
    key: "sec-rate-limits",
    permissions: ["super_admin:read"],
    route: "/admin/security",
    runtimeStatus: "active",
    supportedActions: ["view"],
    telemetryEnabled: true,
    visibility: "super_admin"
  },
  {
    auditEnabled: true,
    category: "Risk Intelligence",
    dependencies: ["sec-login-monitoring", "sec-ip-monitoring", "sec-device-monitoring"],
    description:
      "Risk scoring registry derived from read-only aggregated security signals. Derived scores only; no automated enforcement or background scoring jobs on page load.",
    displayName: "Risk Score",
    featureFlags: ["risk_score"],
    id: "security:risk-score",
    implementationStatus: "production_ready",
    key: "sec-risk-score",
    permissions: ["super_admin:read"],
    route: "/admin/security",
    runtimeStatus: "active",
    supportedActions: ["view"],
    telemetryEnabled: true,
    visibility: "super_admin"
  },
  {
    auditEnabled: true,
    category: "Risk Intelligence",
    dependencies: ["sec-risk-score"],
    description:
      "Risk level registry mapping derived risk scores to read-only severity tiers. Display mapping only; no automated actions triggered by risk level on page load.",
    displayName: "Risk Levels",
    featureFlags: ["risk_levels"],
    id: "security:risk-levels",
    implementationStatus: "production_ready",
    key: "sec-risk-levels",
    permissions: ["super_admin:read"],
    route: "/admin/security",
    runtimeStatus: "active",
    supportedActions: ["view"],
    telemetryEnabled: true,
    visibility: "super_admin"
  },
  {
    auditEnabled: true,
    category: "Security Events",
    dependencies: ["sec-audit-logs"],
    description:
      "Security events registry from existing read-only event records. Read-only event stream and filtering only; no event mutation or export execution on page load.",
    displayName: "Security Events",
    featureFlags: ["security_events"],
    id: "security:security-events",
    implementationStatus: "production_ready",
    key: "sec-security-events",
    permissions: ["super_admin:read"],
    route: "/admin/security",
    runtimeStatus: "active",
    supportedActions: ["view", "filter"],
    telemetryEnabled: true,
    visibility: "super_admin"
  },
  {
    auditEnabled: true,
    category: "Security Governance",
    dependencies: ["sec-security-events"],
    description:
      "Safe security actions registry for explicit Super Admin governance. No action execution on page load; every action requires explicit click, validation, and audit, and writes monitoring metadata only.",
    displayName: "Security Actions",
    featureFlags: ["security_actions", "security_safe_actions"],
    id: "security:security-actions",
    implementationStatus: "production_ready",
    key: "sec-security-actions",
    permissions: ["super_admin:read", "super_admin:safe_action"],
    route: "/admin/security",
    runtimeStatus: "active",
    supportedActions: [
      "mark_reviewed",
      "mark_high_risk",
      "clear_risk",
      "user_suspend_shortcut",
      "store_suspend_shortcut",
      "export_placeholder"
    ],
    telemetryEnabled: true,
    visibility: "super_admin"
  },
  {
    auditEnabled: false,
    category: "Security Platform",
    dependencies: [],
    description:
      "Reserved future security hooks for abuse heuristics, fraud signals, automated risk enforcement, IP blocking, device revocation, and security exports. Registry metadata only; no execution on page load.",
    displayName: "Future Hooks",
    featureFlags: ["security_future_hooks"],
    id: "security:future-hooks",
    implementationStatus: "planned",
    key: "sec-future-hooks",
    permissions: ["super_admin:read"],
    route: "/admin/security",
    runtimeStatus: "planned",
    supportedActions: [],
    telemetryEnabled: false,
    visibility: "super_admin"
  }
] as const;

function finalizeRegistryEntry(definition: SecurityRegistryEntryDefinition): SecurityRegistryEntry {
  return {
    ...definition,
    dependencies: [...definition.dependencies],
    featureFlags: [...definition.featureFlags],
    permissions: [...definition.permissions],
    readOnly: true,
    source: SECURITY_REGISTRY_SOURCE,
    supportedActions: [...definition.supportedActions]
  };
}

export function listSecurityRegistryDefinitions() {
  return SECURITY_REGISTRY_DEFINITIONS.map((definition) => ({
    ...definition,
    dependencies: [...definition.dependencies],
    featureFlags: [...definition.featureFlags],
    permissions: [...definition.permissions],
    supportedActions: [...definition.supportedActions]
  }));
}

export function resolveSecurityRegistryEntries(): SecurityRegistryEntry[] {
  return SECURITY_REGISTRY_DEFINITIONS.map((definition) => finalizeRegistryEntry(definition));
}

export function getSecurityRegistryEntry(key: string): SecurityRegistryEntry | null {
  const definition = SECURITY_REGISTRY_DEFINITIONS.find((entry) => entry.key === key);

  if (!definition) {
    return null;
  }

  return finalizeRegistryEntry(definition);
}

export function getSecurityRegistryStatus(entries: SecurityRegistryEntry[]): SecurityRegistryRuntimeStatus {
  const hasAttention = entries.some(
    (entry) =>
      entry.implementationStatus === "architectural" ||
      entry.implementationStatus === "planned" ||
      entry.runtimeStatus === "review_required"
  );

  return hasAttention ? "needs_attention" : "registry_ready";
}

export function getSecurityRegistrySummary(entries: SecurityRegistryEntry[]): SecurityRegistrySummary {
  const activeEntries = entries.filter((entry) => entry.runtimeStatus === "active").length;
  const auditEnabledEntries = entries.filter((entry) => entry.auditEnabled).length;
  const telemetryEnabledEntries = entries.filter((entry) => entry.telemetryEnabled).length;
  const productionReadyEntries = entries.filter((entry) => entry.implementationStatus === "production_ready").length;
  const registeredEntries = entries.filter((entry) => entry.implementationStatus !== "planned").length;
  const status = getSecurityRegistryStatus(entries);

  return {
    activeEntries,
    auditEnabledEntries,
    productionReadyEntries,
    readOnly: true,
    registeredEntries,
    status,
    summary: [
      `status ${status}`,
      `${entries.length} registry entries`,
      `${activeEntries} active`,
      `${productionReadyEntries} production ready`,
      `${registeredEntries} registered`
    ].join("; "),
    telemetryEnabledEntries,
    totalEntries: entries.length
  };
}

export function validateSecurityRegistryRuntime(entries: SecurityRegistryEntry[]): SecurityRegistryValidation {
  const issues: string[] = [];

  if (entries.length !== SECURITY_REGISTRY_DEFINITIONS.length) {
    issues.push("Security registry must include all SEC-1 registry entries.");
  }

  const keys = new Set<string>();

  for (const entry of entries) {
    if (!entry.readOnly) {
      issues.push(`${entry.key} must remain read-only.`);
    }

    if (entry.source !== SECURITY_REGISTRY_SOURCE) {
      issues.push(`${entry.key} must originate from the security registry runtime.`);
    }

    if (keys.has(entry.key)) {
      issues.push(`Duplicate security registry key: ${entry.key}.`);
    }

    keys.add(entry.key);

    if (entry.visibility !== "super_admin") {
      issues.push(`${entry.key} must remain super_admin only.`);
    }

    if (!entry.route) {
      issues.push(`${entry.key} must declare a route.`);
    }
  }

  for (const entry of entries) {
    for (const dependency of entry.dependencies) {
      if (!keys.has(dependency)) {
        issues.push(`${entry.key} references unknown dependency: ${dependency}.`);
      }
    }
  }

  return {
    isValid: issues.length === 0,
    issues
  };
}

export function buildSecurityRegistryCategories(entries: SecurityRegistryEntry[]): SecurityRegistryCategorySummary[] {
  const categoryNames = [...new Set(entries.map((entry) => entry.category))].sort();

  return categoryNames.map((name) => {
    const categoryEntries = entries.filter((entry) => entry.category === name);
    const status = categoryEntries.some((entry) => entry.implementationStatus === "production_ready")
      ? ("ready" as const)
      : categoryEntries.some((entry) => entry.implementationStatus === "architectural")
        ? ("architectural" as const)
        : ("planned" as const);

    return {
      entryCount: categoryEntries.length,
      name,
      status
    };
  });
}

export function buildSecurityRegistryFutureHooks(entries: SecurityRegistryEntry[]) {
  return entries
    .filter((entry) => entry.implementationStatus === "planned" || entry.runtimeStatus === "planned")
    .flatMap((entry) => [...entry.supportedActions, ...entry.featureFlags])
    .filter((value, index, all) => all.indexOf(value) === index)
    .sort();
}

export function mapSecurityRegistryEntryToAdminComponent(entry: SecurityRegistryEntry) {
  return {
    auditEnabled: entry.auditEnabled,
    category: entry.category,
    dependencies: [...entry.dependencies],
    description: entry.description,
    displayName: entry.displayName,
    featureFlags: [...entry.featureFlags],
    id: entry.id,
    implementationStatus: entry.implementationStatus,
    key: entry.key,
    permissions: [...entry.permissions],
    route: entry.route,
    runtimeStatus: entry.runtimeStatus,
    supportedActions: [...entry.supportedActions],
    telemetryEnabled: entry.telemetryEnabled,
    visibility: entry.visibility
  };
}

export function mapSecurityRegistryRuntimeToAdminFields() {
  const entries = resolveSecurityRegistryEntries();
  const validation = validateSecurityRegistryRuntime(entries);
  const summary = getSecurityRegistrySummary(entries);

  return {
    categories: buildSecurityRegistryCategories(entries),
    components: entries.map(mapSecurityRegistryEntryToAdminComponent),
    futureHooks: buildSecurityRegistryFutureHooks(entries),
    registry: {
      readOnly: true as const,
      source: SECURITY_REGISTRY_SOURCE,
      status: validation.isValid ? summary.status : ("needs_attention" as const),
      summary: validation.isValid
        ? summary.summary
        : "Security registry validation requires safe read-only defaults.",
      totalEntries: summary.totalEntries
    }
  };
}

export async function loadSecurityRegistryReadOnlySafe() {
  return mapSecurityRegistryRuntimeToAdminFields();
}
