import "server-only";

import {
  SECURITY_REGISTRY_SOURCE,
  getSecurityRegistryEntry
} from "@/src/lib/security/security-registry-runtime";
import {
  SECURITY_FUTURE_HOOKS_SOURCE,
  getSecurityFutureHook
} from "@/src/lib/security/security-future-hooks-runtime";

export type SecurityIpBlocklistSource = "security_ip_blocklist_runtime";

export type SecurityIpBlocklistCategory =
  | "Abuse Source"
  | "Fraud Source"
  | "Geo Restriction"
  | "Login Threat"
  | "Reputation";

export type SecurityIpBlocklistScope =
  | "asn"
  | "cidr_range"
  | "geo_country"
  | "ip_reputation"
  | "single_ip";

export type SecurityIpBlocklistSeverity = "critical" | "high" | "low" | "medium";

export type SecurityIpBlocklistTargetType = "asn" | "country" | "ip" | "network";

export type SecurityIpBlocklistSourceModule = "abuse" | "audit" | "fraud" | "login" | "rate_limit";

export type SecurityIpBlocklistRuntimeStatus = "foundation" | "planned" | "reserved";

export type SecurityIpBlocklistRuntimeState = "ip_blocklist_ready" | "needs_attention";

export type SecurityIpBlocklistDefinition = {
  auditRequired: boolean;
  category: SecurityIpBlocklistCategory;
  description: string;
  displayName: string;
  ipScope: SecurityIpBlocklistScope;
  requiredDataSources: readonly string[];
  ruleId: string;
  ruleKey: string;
  runtimeStatus: SecurityIpBlocklistRuntimeStatus;
  safetyNotes: string;
  severity: SecurityIpBlocklistSeverity;
  sourceModule: SecurityIpBlocklistSourceModule;
  targetType: SecurityIpBlocklistTargetType;
};

export type SecurityIpBlocklistRule = {
  auditRequired: boolean;
  category: SecurityIpBlocklistCategory;
  description: string;
  displayName: string;
  enabled: false;
  enforcementAllowed: false;
  ipScope: SecurityIpBlocklistScope;
  metadataOnly: true;
  readOnly: true;
  requiredDataSources: string[];
  ruleId: string;
  ruleKey: string;
  runtimeStatus: SecurityIpBlocklistRuntimeStatus;
  safetyNotes: string;
  severity: SecurityIpBlocklistSeverity;
  source: SecurityIpBlocklistSource;
  sourceModule: SecurityIpBlocklistSourceModule;
  targetType: SecurityIpBlocklistTargetType;
};

export type SecurityIpBlocklistCategoryGroup = {
  category: SecurityIpBlocklistCategory;
  ruleKeys: string[];
  rules: SecurityIpBlocklistRule[];
};

export type SecurityIpBlocklistSummary = {
  auditRequiredRules: number;
  categoryCount: number;
  criticalRules: number;
  enabledRules: number;
  enforcingRules: number;
  foundationRules: number;
  highRules: number;
  readOnly: true;
  registryKey: string;
  registrySource: typeof SECURITY_REGISTRY_SOURCE;
  source: SecurityIpBlocklistSource;
  status: SecurityIpBlocklistRuntimeState;
  summary: string;
  totalRules: number;
};

export type SecurityIpBlocklistValidation = {
  isValid: boolean;
  issues: string[];
};

export type SecurityIpBlocklistLoadingState = {
  loading: true;
  message: string;
  readOnly: true;
  source: SecurityIpBlocklistSource;
};

export const SECURITY_IP_BLOCKLIST_SOURCE = "security_ip_blocklist_runtime" as const;

export const SECURITY_IP_BLOCKLIST_REGISTRY_KEY = "sec-ip-monitoring" as const;

export const SECURITY_IP_BLOCKLIST_FUTURE_HOOK_KEY = "sec-hook-ip-blocklist" as const;

export const SECURITY_IP_BLOCKLIST_PHASE_NOTE =
  "Metadata-only in this phase. Definitions document reserved IP blocklist rules; no IP is blocked, no middleware or edge behavior changes, no rate limit changes, and no enforcement runs from this runtime.";

const SECURITY_IP_BLOCKLIST_DEFINITIONS: readonly SecurityIpBlocklistDefinition[] = [
  {
    auditRequired: true,
    category: "Login Threat",
    description:
      "Foundation definition describing a single IP with repeated failed login attempts. Metadata only; no IP is blocked or throttled in this phase.",
    displayName: "Brute Force Source IP",
    ipScope: "single_ip",
    requiredDataSources: ["security_audit_logs", "sec-login-monitoring-runtime"],
    ruleId: "security:ip-blocklist:brute-force-source-ip",
    ruleKey: "sec-ip-blocklist-brute-force-source-ip",
    runtimeStatus: "foundation",
    safetyNotes: "No IP block, middleware change, or rate-limit change runs from this rule.",
    severity: "high",
    sourceModule: "login",
    targetType: "ip"
  },
  {
    auditRequired: true,
    category: "Abuse Source",
    description:
      "Foundation definition describing a single IP repeatedly exceeding rate limits. Metadata only; no throttling or block is enforced in this phase.",
    displayName: "Rate Limit Abuse IP",
    ipScope: "single_ip",
    requiredDataSources: ["security_audit_logs", "sec-rate-limits-runtime"],
    ruleId: "security:ip-blocklist:rate-limit-abuse-ip",
    ruleKey: "sec-ip-blocklist-rate-limit-abuse-ip",
    runtimeStatus: "foundation",
    safetyNotes: "No rate-limit change, throttling, or block runs from this rule.",
    severity: "high",
    sourceModule: "rate_limit",
    targetType: "ip"
  },
  {
    auditRequired: true,
    category: "Fraud Source",
    description:
      "Foundation definition describing an IP associated with fraud signals. Metadata only; no IP is blocked and no payment is affected in this phase.",
    displayName: "Fraud-Associated IP",
    ipScope: "single_ip",
    requiredDataSources: ["security_audit_logs", "sec-fraud-detection-runtime"],
    ruleId: "security:ip-blocklist:fraud-associated-ip",
    ruleKey: "sec-ip-blocklist-fraud-associated-ip",
    runtimeStatus: "foundation",
    safetyNotes: "No IP block, payment action, or suspension runs from this rule.",
    severity: "critical",
    sourceModule: "fraud",
    targetType: "ip"
  },
  {
    auditRequired: true,
    category: "Abuse Source",
    description:
      "Foundation definition describing an IP linked to abuse signals across modules. Metadata only; no IP is blocked in this phase.",
    displayName: "Abuse-Associated IP",
    ipScope: "single_ip",
    requiredDataSources: ["security_audit_logs", "sec-abuse-detection-runtime"],
    ruleId: "security:ip-blocklist:abuse-associated-ip",
    ruleKey: "sec-ip-blocklist-abuse-associated-ip",
    runtimeStatus: "foundation",
    safetyNotes: "No IP block, abuse automation, or suspension runs from this rule.",
    severity: "high",
    sourceModule: "abuse",
    targetType: "ip"
  },
  {
    auditRequired: true,
    category: "Abuse Source",
    description:
      "Foundation definition describing a CIDR range showing coordinated abuse activity. Metadata only; no network range is blocked in this phase.",
    displayName: "Suspicious CIDR Range",
    ipScope: "cidr_range",
    requiredDataSources: ["security_audit_logs", "sec-ip-monitoring-runtime"],
    ruleId: "security:ip-blocklist:suspicious-cidr-range",
    ruleKey: "sec-ip-blocklist-suspicious-cidr-range",
    runtimeStatus: "planned",
    safetyNotes: "No network-range block or middleware change runs from this rule.",
    severity: "medium",
    sourceModule: "audit",
    targetType: "network"
  },
  {
    auditRequired: true,
    category: "Reputation",
    description:
      "Foundation definition describing an ASN with poor reputation observed in existing security data. Metadata only; no ASN is blocked in this phase.",
    displayName: "Low-Reputation ASN",
    ipScope: "asn",
    requiredDataSources: ["security_audit_logs", "sec-ip-monitoring-runtime"],
    ruleId: "security:ip-blocklist:low-reputation-asn",
    ruleKey: "sec-ip-blocklist-low-reputation-asn",
    runtimeStatus: "planned",
    safetyNotes: "No ASN block, external reputation lookup, or enforcement runs from this rule.",
    severity: "medium",
    sourceModule: "audit",
    targetType: "asn"
  },
  {
    auditRequired: true,
    category: "Reputation",
    description:
      "Foundation definition describing an IP flagged by reputation indicators in existing data. Metadata only; no external reputation service is called and no block occurs in this phase.",
    displayName: "IP Reputation Flag",
    ipScope: "ip_reputation",
    requiredDataSources: ["security_audit_logs", "sec-ip-monitoring-runtime"],
    ruleId: "security:ip-blocklist:ip-reputation-flag",
    ruleKey: "sec-ip-blocklist-ip-reputation-flag",
    runtimeStatus: "planned",
    safetyNotes: "No external reputation call, IP block, or enforcement runs from this rule.",
    severity: "medium",
    sourceModule: "audit",
    targetType: "ip"
  },
  {
    auditRequired: true,
    category: "Geo Restriction",
    description:
      "Foundation definition describing a high-risk country observed in existing security activity. Metadata only; no geo restriction is enforced in this phase.",
    displayName: "High-Risk Geo Country",
    ipScope: "geo_country",
    requiredDataSources: ["security_audit_logs", "sec-ip-monitoring-runtime"],
    ruleId: "security:ip-blocklist:high-risk-geo-country",
    ruleKey: "sec-ip-blocklist-high-risk-geo-country",
    runtimeStatus: "reserved",
    safetyNotes: "No geo enforcement, country block, or middleware change runs from this rule.",
    severity: "low",
    sourceModule: "audit",
    targetType: "country"
  }
] as const;

const SECURITY_IP_BLOCKLIST_CATEGORY_ORDER: readonly SecurityIpBlocklistCategory[] = [
  "Fraud Source",
  "Abuse Source",
  "Login Threat",
  "Reputation",
  "Geo Restriction"
] as const;

function finalizeIpBlocklistRule(definition: SecurityIpBlocklistDefinition): SecurityIpBlocklistRule {
  return {
    auditRequired: definition.auditRequired,
    category: definition.category,
    description: definition.description,
    displayName: definition.displayName,
    enabled: false,
    enforcementAllowed: false,
    ipScope: definition.ipScope,
    metadataOnly: true,
    readOnly: true,
    requiredDataSources: [...definition.requiredDataSources],
    ruleId: definition.ruleId,
    ruleKey: definition.ruleKey,
    runtimeStatus: definition.runtimeStatus,
    safetyNotes: definition.safetyNotes,
    severity: definition.severity,
    source: SECURITY_IP_BLOCKLIST_SOURCE,
    sourceModule: definition.sourceModule,
    targetType: definition.targetType
  };
}

export function listSecurityIpBlocklistDefinitions(): SecurityIpBlocklistDefinition[] {
  return SECURITY_IP_BLOCKLIST_DEFINITIONS.map((definition) => ({
    ...definition,
    requiredDataSources: [...definition.requiredDataSources]
  }));
}

export function resolveSecurityIpBlocklistRules(): SecurityIpBlocklistRule[] {
  return SECURITY_IP_BLOCKLIST_DEFINITIONS.map((definition) => finalizeIpBlocklistRule(definition));
}

export function getSecurityIpBlocklistRule(ruleKey: string): SecurityIpBlocklistRule | null {
  const definition = SECURITY_IP_BLOCKLIST_DEFINITIONS.find((entry) => entry.ruleKey === ruleKey);

  if (!definition) {
    return null;
  }

  return finalizeIpBlocklistRule(definition);
}

export function securityIpBlocklistSeverityBadgeTone(severity: SecurityIpBlocklistSeverity) {
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

export function securityIpBlocklistStatusBadgeTone(status: SecurityIpBlocklistRuntimeStatus) {
  switch (status) {
    case "foundation":
      return "blue" as const;
    case "planned":
      return "amber" as const;
    case "reserved":
      return "slate" as const;
  }
}

export function buildSecurityIpBlocklistCategories(
  rules: SecurityIpBlocklistRule[]
): SecurityIpBlocklistCategoryGroup[] {
  const groups = new Map<SecurityIpBlocklistCategory, SecurityIpBlocklistRule[]>();

  for (const rule of rules) {
    const existing = groups.get(rule.category);

    if (existing) {
      existing.push(rule);
    } else {
      groups.set(rule.category, [rule]);
    }
  }

  return SECURITY_IP_BLOCKLIST_CATEGORY_ORDER.filter((category) => groups.has(category)).map((category) => {
    const categoryRules = groups.get(category) ?? [];

    return {
      category,
      ruleKeys: categoryRules.map((rule) => rule.ruleKey),
      rules: categoryRules
    };
  });
}

export function getSecurityIpBlocklistSummary(rules: SecurityIpBlocklistRule[]): SecurityIpBlocklistSummary {
  const foundationRules = rules.filter((rule) => rule.runtimeStatus === "foundation").length;
  const criticalRules = rules.filter((rule) => rule.severity === "critical").length;
  const highRules = rules.filter((rule) => rule.severity === "high").length;
  const auditRequiredRules = rules.filter((rule) => rule.auditRequired).length;
  const enabledRules = rules.filter((rule) => rule.enabled).length;
  const enforcingRules = rules.filter((rule) => rule.enforcementAllowed).length;
  const categoryCount = buildSecurityIpBlocklistCategories(rules).length;
  const status: SecurityIpBlocklistRuntimeState =
    enabledRules === 0 && enforcingRules === 0 ? "ip_blocklist_ready" : "needs_attention";

  return {
    auditRequiredRules,
    categoryCount,
    criticalRules,
    enabledRules,
    enforcingRules,
    foundationRules,
    highRules,
    readOnly: true,
    registryKey: SECURITY_IP_BLOCKLIST_REGISTRY_KEY,
    registrySource: SECURITY_REGISTRY_SOURCE,
    source: SECURITY_IP_BLOCKLIST_SOURCE,
    status,
    summary: [
      `status ${status}`,
      `${rules.length} ip blocklist rules`,
      `${foundationRules} foundation`,
      `${criticalRules} critical`,
      `${highRules} high`,
      `${enabledRules} enabled`,
      `${enforcingRules} enforcing`
    ].join("; "),
    totalRules: rules.length
  };
}

export function validateSecurityIpBlocklistRuntime(
  rules: SecurityIpBlocklistRule[]
): SecurityIpBlocklistValidation {
  const issues: string[] = [];

  if (rules.length !== SECURITY_IP_BLOCKLIST_DEFINITIONS.length) {
    issues.push("Security IP blocklist runtime must include all SEC-23 rule definitions.");
  }

  const keys = new Set<string>();

  for (const rule of rules) {
    if (rule.enabled !== false) {
      issues.push(`${rule.ruleKey} must remain disabled in this phase.`);
    }

    if (rule.enforcementAllowed !== false) {
      issues.push(`${rule.ruleKey} must not allow enforcement in this phase.`);
    }

    if (rule.metadataOnly !== true || rule.readOnly !== true) {
      issues.push(`${rule.ruleKey} must remain metadata-only and read-only.`);
    }

    if (rule.source !== SECURITY_IP_BLOCKLIST_SOURCE) {
      issues.push(`${rule.ruleKey} must originate from the security IP blocklist runtime.`);
    }

    if (!rule.auditRequired) {
      issues.push(`${rule.ruleKey} must require audit.`);
    }

    if (rule.requiredDataSources.length === 0) {
      issues.push(`${rule.ruleKey} must declare at least one required data source.`);
    }

    if (!rule.safetyNotes) {
      issues.push(`${rule.ruleKey} must declare safety notes.`);
    }

    if (keys.has(rule.ruleKey)) {
      issues.push(`Duplicate security IP blocklist rule key: ${rule.ruleKey}.`);
    }

    keys.add(rule.ruleKey);
  }

  return {
    isValid: issues.length === 0,
    issues
  };
}

export function buildSecurityIpBlocklistLoadingState(): SecurityIpBlocklistLoadingState {
  return {
    loading: true,
    message: "Loading the read-only Security IP blocklist foundation from the security registry.",
    readOnly: true,
    source: SECURITY_IP_BLOCKLIST_SOURCE
  };
}

export function mapSecurityIpBlocklistRuleToAdminComponent(rule: SecurityIpBlocklistRule) {
  return {
    auditRequired: rule.auditRequired,
    category: rule.category,
    description: rule.description,
    displayName: rule.displayName,
    enabled: rule.enabled,
    enforcementAllowed: rule.enforcementAllowed,
    ipScope: rule.ipScope,
    metadataOnly: rule.metadataOnly,
    requiredDataSources: rule.requiredDataSources,
    ruleId: rule.ruleId,
    ruleKey: rule.ruleKey,
    runtimeStatus: rule.runtimeStatus,
    safetyNotes: rule.safetyNotes,
    severity: rule.severity,
    sourceModule: rule.sourceModule,
    targetType: rule.targetType
  };
}

export function mapSecurityIpBlocklistRuntimeToAdminFields() {
  const registryEntry = getSecurityRegistryEntry(SECURITY_IP_BLOCKLIST_REGISTRY_KEY);

  if (!registryEntry || registryEntry.visibility !== "super_admin") {
    return {
      categories: [] as ReturnType<typeof buildSecurityIpBlocklistCategories>,
      futureHook: null,
      phaseNote: SECURITY_IP_BLOCKLIST_PHASE_NOTE,
      registry: null,
      rules: [] as ReturnType<typeof mapSecurityIpBlocklistRuleToAdminComponent>[],
      summary: {
        auditRequiredRules: 0,
        categoryCount: 0,
        criticalRules: 0,
        enabledRules: 0,
        enforcingRules: 0,
        foundationRules: 0,
        highRules: 0,
        readOnly: true as const,
        registryKey: SECURITY_IP_BLOCKLIST_REGISTRY_KEY,
        registrySource: SECURITY_REGISTRY_SOURCE,
        source: SECURITY_IP_BLOCKLIST_SOURCE,
        status: "needs_attention" as const,
        summary: "IP monitoring is not registered as a super-admin module in the security registry.",
        totalRules: 0
      }
    };
  }

  const rules = resolveSecurityIpBlocklistRules();
  const validation = validateSecurityIpBlocklistRuntime(rules);
  const summary = getSecurityIpBlocklistSummary(rules);
  const futureHook = getSecurityFutureHook(SECURITY_IP_BLOCKLIST_FUTURE_HOOK_KEY);

  return {
    categories: buildSecurityIpBlocklistCategories(rules),
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
    phaseNote: SECURITY_IP_BLOCKLIST_PHASE_NOTE,
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
    rules: rules.map(mapSecurityIpBlocklistRuleToAdminComponent),
    summary: validation.isValid
      ? summary
      : {
          ...summary,
          status: "needs_attention" as const,
          summary: "Security IP blocklist validation requires safe metadata-only defaults."
        }
  };
}

export async function loadSecurityIpBlocklistReadOnlySafe() {
  return mapSecurityIpBlocklistRuntimeToAdminFields();
}
