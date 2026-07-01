import "server-only";

import {
  SECURITY_REGISTRY_SOURCE,
  getSecurityRegistryEntry
} from "@/src/lib/security/security-registry-runtime";
import {
  SECURITY_FUTURE_HOOKS_SOURCE,
  getSecurityFutureHook
} from "@/src/lib/security/security-future-hooks-runtime";

export type SecurityFraudRulesEngineSource = "security_fraud_rules_engine_runtime";

export type SecurityFraudRuleCategory =
  | "Account Takeover"
  | "Chargeback"
  | "Dispute"
  | "Payment Anomaly"
  | "Refund Abuse"
  | "Token Abuse"
  | "Velocity";

export type SecurityFraudRuleSeverity = "critical" | "high" | "low" | "medium";

export type SecurityFraudRuleTargetType = "ip" | "order" | "payment" | "store" | "user";

export type SecurityFraudRuleSourceModule = "audit" | "billing" | "disputes" | "orders" | "payments";

export type SecurityFraudRuleRuntimeStatus = "foundation" | "planned" | "reserved";

export type SecurityFraudRulesEngineRuntimeStatus = "fraud_rules_ready" | "needs_attention";

export type SecurityFraudRuleDefinition = {
  auditRequired: boolean;
  category: SecurityFraudRuleCategory;
  description: string;
  displayName: string;
  requiredDataSources: readonly string[];
  ruleId: string;
  ruleKey: string;
  runtimeStatus: SecurityFraudRuleRuntimeStatus;
  safetyNotes: string;
  severity: SecurityFraudRuleSeverity;
  sourceModule: SecurityFraudRuleSourceModule;
  targetType: SecurityFraudRuleTargetType;
};

export type SecurityFraudRule = {
  auditRequired: boolean;
  category: SecurityFraudRuleCategory;
  description: string;
  displayName: string;
  enabled: false;
  executionAllowed: false;
  metadataOnly: true;
  readOnly: true;
  requiredDataSources: string[];
  ruleId: string;
  ruleKey: string;
  runtimeStatus: SecurityFraudRuleRuntimeStatus;
  safetyNotes: string;
  severity: SecurityFraudRuleSeverity;
  source: SecurityFraudRulesEngineSource;
  sourceModule: SecurityFraudRuleSourceModule;
  targetType: SecurityFraudRuleTargetType;
};

export type SecurityFraudRulesCategoryGroup = {
  category: SecurityFraudRuleCategory;
  ruleKeys: string[];
  rules: SecurityFraudRule[];
};

export type SecurityFraudRulesEngineSummary = {
  auditRequiredRules: number;
  categoryCount: number;
  criticalRules: number;
  enabledRules: number;
  executableRules: number;
  foundationRules: number;
  highRules: number;
  readOnly: true;
  registryKey: string;
  registrySource: typeof SECURITY_REGISTRY_SOURCE;
  source: SecurityFraudRulesEngineSource;
  status: SecurityFraudRulesEngineRuntimeStatus;
  summary: string;
  totalRules: number;
};

export type SecurityFraudRulesEngineValidation = {
  isValid: boolean;
  issues: string[];
};

export type SecurityFraudRulesEngineLoadingState = {
  loading: true;
  message: string;
  readOnly: true;
  source: SecurityFraudRulesEngineSource;
};

export const SECURITY_FRAUD_RULES_ENGINE_SOURCE = "security_fraud_rules_engine_runtime" as const;

export const SECURITY_FRAUD_RULES_ENGINE_REGISTRY_KEY = "sec-fraud-detection" as const;

export const SECURITY_FRAUD_RULES_ENGINE_FUTURE_HOOK_KEY = "sec-hook-fraud-rules-engine" as const;

export const SECURITY_FRAUD_RULES_ENGINE_PHASE_NOTE =
  "Metadata-only in this phase. Definitions document reserved fraud rules; no rule evaluates, no fraud score is calculated, no fraud decision is created, and no payment, order, billing, dispute, chargeback, subscription, user, or store is modified from this runtime.";

const SECURITY_FRAUD_RULE_DEFINITIONS: readonly SecurityFraudRuleDefinition[] = [
  {
    auditRequired: true,
    category: "Chargeback",
    description:
      "Foundation definition describing repeated chargeback activity concentrated on a payment or store. Metadata only; no chargeback is evaluated, scored, or actioned in this phase.",
    displayName: "Chargeback Spike",
    requiredDataSources: ["security_audit_logs", "sec-fraud-detection-runtime"],
    ruleId: "security:fraud-rule:chargeback-spike",
    ruleKey: "sec-fraud-rule-chargeback-spike",
    runtimeStatus: "foundation",
    safetyNotes: "No chargeback decision, payment block, or refund runs from this rule.",
    severity: "critical",
    sourceModule: "disputes",
    targetType: "payment"
  },
  {
    auditRequired: true,
    category: "Payment Anomaly",
    description:
      "Foundation definition describing explicit payment fraud signals recorded in existing security data. Metadata only; no payment fraud score is computed in this phase.",
    displayName: "Payment Fraud Signal",
    requiredDataSources: ["security_audit_logs", "sec-fraud-detection-runtime"],
    ruleId: "security:fraud-rule:payment-fraud-signal",
    ruleKey: "sec-fraud-rule-payment-fraud-signal",
    runtimeStatus: "foundation",
    safetyNotes: "No payment is blocked, held, or reversed from this rule.",
    severity: "critical",
    sourceModule: "payments",
    targetType: "payment"
  },
  {
    auditRequired: true,
    category: "Velocity",
    description:
      "Foundation definition describing suspicious payment velocity from a single user, store, or IP. Metadata only; no velocity threshold is enforced in this phase.",
    displayName: "Suspicious Payment Velocity",
    requiredDataSources: ["security_audit_logs", "sec-rate-limits-runtime"],
    ruleId: "security:fraud-rule:suspicious-payment-velocity",
    ruleKey: "sec-fraud-rule-suspicious-payment-velocity",
    runtimeStatus: "foundation",
    safetyNotes: "No throttling, blocking, or rate-limit change runs from this rule.",
    severity: "high",
    sourceModule: "payments",
    targetType: "user"
  },
  {
    auditRequired: true,
    category: "Refund Abuse",
    description:
      "Foundation definition describing repeated refund abuse patterns tied to a user or store. Metadata only; no refund is evaluated or reversed in this phase.",
    displayName: "Refund Abuse Pattern",
    requiredDataSources: ["security_audit_logs", "sec-fraud-detection-runtime"],
    ruleId: "security:fraud-rule:refund-abuse-pattern",
    ruleKey: "sec-fraud-rule-refund-abuse-pattern",
    runtimeStatus: "foundation",
    safetyNotes: "No refund, billing change, or suspension runs from this rule.",
    severity: "high",
    sourceModule: "billing",
    targetType: "user"
  },
  {
    auditRequired: true,
    category: "Dispute",
    description:
      "Foundation definition describing escalating dispute activity on payments or orders. Metadata only; no dispute is opened, resolved, or actioned in this phase.",
    displayName: "Dispute Escalation",
    requiredDataSources: ["security_audit_logs", "sec-fraud-detection-runtime"],
    ruleId: "security:fraud-rule:dispute-escalation",
    ruleKey: "sec-fraud-rule-dispute-escalation",
    runtimeStatus: "foundation",
    safetyNotes: "No dispute or order state change runs from this rule.",
    severity: "high",
    sourceModule: "disputes",
    targetType: "payment"
  },
  {
    auditRequired: true,
    category: "Token Abuse",
    description:
      "Foundation definition describing token or API abuse associated with fraud attempts. Metadata only; no token is revoked and no request is blocked in this phase.",
    displayName: "Token / API Abuse",
    requiredDataSources: ["security_audit_logs", "sec-abuse-detection-runtime"],
    ruleId: "security:fraud-rule:token-api-abuse",
    ruleKey: "sec-fraud-rule-token-api-abuse",
    runtimeStatus: "foundation",
    safetyNotes: "No token revocation, key rotation, or request rejection runs from this rule.",
    severity: "high",
    sourceModule: "audit",
    targetType: "user"
  },
  {
    auditRequired: true,
    category: "Velocity",
    description:
      "Foundation definition describing repeated failed payment attempts from a single actor. Metadata only; no lockout or block is applied in this phase.",
    displayName: "Repeated Failed Payments",
    requiredDataSources: ["security_audit_logs", "sec-login-monitoring-runtime"],
    ruleId: "security:fraud-rule:repeated-failed-payments",
    ruleKey: "sec-fraud-rule-repeated-failed-payments",
    runtimeStatus: "planned",
    safetyNotes: "No lockout, block, or payment restriction runs from this rule.",
    severity: "medium",
    sourceModule: "payments",
    targetType: "user"
  },
  {
    auditRequired: true,
    category: "Payment Anomaly",
    description:
      "Foundation definition describing mismatched billing geography or provider anomalies. Metadata only; no payment anomaly decision is generated in this phase.",
    displayName: "Mismatched Billing Geo",
    requiredDataSources: ["security_audit_logs", "sec-ip-monitoring-runtime"],
    ruleId: "security:fraud-rule:mismatched-billing-geo",
    ruleKey: "sec-fraud-rule-mismatched-billing-geo",
    runtimeStatus: "planned",
    safetyNotes: "No geo enforcement, block, or payment decision runs from this rule.",
    severity: "medium",
    sourceModule: "payments",
    targetType: "payment"
  },
  {
    auditRequired: true,
    category: "Refund Abuse",
    description:
      "Foundation definition describing order cancellation abuse patterns. Metadata only; no order is cancelled or modified in this phase.",
    displayName: "Order Cancellation Abuse",
    requiredDataSources: ["security_audit_logs", "sec-fraud-detection-runtime"],
    ruleId: "security:fraud-rule:order-cancellation-abuse",
    ruleKey: "sec-fraud-rule-order-cancellation-abuse",
    runtimeStatus: "planned",
    safetyNotes: "No order cancellation, modification, or refund runs from this rule.",
    severity: "medium",
    sourceModule: "orders",
    targetType: "order"
  },
  {
    auditRequired: true,
    category: "Account Takeover",
    description:
      "Foundation definition describing high-risk account takeover indicators combined with payment activity. Metadata only; no account action is taken in this phase.",
    displayName: "High-Risk Account Takeover",
    requiredDataSources: ["security_audit_logs", "sec-login-monitoring-runtime", "sec-risk-score-runtime"],
    ruleId: "security:fraud-rule:high-risk-account-takeover",
    ruleKey: "sec-fraud-rule-high-risk-account-takeover",
    runtimeStatus: "reserved",
    safetyNotes: "No account suspension, session revocation, or payment block runs from this rule.",
    severity: "critical",
    sourceModule: "audit",
    targetType: "user"
  }
] as const;

const SECURITY_FRAUD_RULE_CATEGORY_ORDER: readonly SecurityFraudRuleCategory[] = [
  "Chargeback",
  "Payment Anomaly",
  "Dispute",
  "Refund Abuse",
  "Velocity",
  "Token Abuse",
  "Account Takeover"
] as const;

function finalizeFraudRule(definition: SecurityFraudRuleDefinition): SecurityFraudRule {
  return {
    auditRequired: definition.auditRequired,
    category: definition.category,
    description: definition.description,
    displayName: definition.displayName,
    enabled: false,
    executionAllowed: false,
    metadataOnly: true,
    readOnly: true,
    requiredDataSources: [...definition.requiredDataSources],
    ruleId: definition.ruleId,
    ruleKey: definition.ruleKey,
    runtimeStatus: definition.runtimeStatus,
    safetyNotes: definition.safetyNotes,
    severity: definition.severity,
    source: SECURITY_FRAUD_RULES_ENGINE_SOURCE,
    sourceModule: definition.sourceModule,
    targetType: definition.targetType
  };
}

export function listSecurityFraudRuleDefinitions(): SecurityFraudRuleDefinition[] {
  return SECURITY_FRAUD_RULE_DEFINITIONS.map((definition) => ({
    ...definition,
    requiredDataSources: [...definition.requiredDataSources]
  }));
}

export function resolveSecurityFraudRules(): SecurityFraudRule[] {
  return SECURITY_FRAUD_RULE_DEFINITIONS.map((definition) => finalizeFraudRule(definition));
}

export function getSecurityFraudRule(ruleKey: string): SecurityFraudRule | null {
  const definition = SECURITY_FRAUD_RULE_DEFINITIONS.find((entry) => entry.ruleKey === ruleKey);

  if (!definition) {
    return null;
  }

  return finalizeFraudRule(definition);
}

export function securityFraudRuleSeverityBadgeTone(severity: SecurityFraudRuleSeverity) {
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

export function securityFraudRuleStatusBadgeTone(status: SecurityFraudRuleRuntimeStatus) {
  switch (status) {
    case "foundation":
      return "blue" as const;
    case "planned":
      return "amber" as const;
    case "reserved":
      return "slate" as const;
  }
}

export function buildSecurityFraudRuleCategories(rules: SecurityFraudRule[]): SecurityFraudRulesCategoryGroup[] {
  const groups = new Map<SecurityFraudRuleCategory, SecurityFraudRule[]>();

  for (const rule of rules) {
    const existing = groups.get(rule.category);

    if (existing) {
      existing.push(rule);
    } else {
      groups.set(rule.category, [rule]);
    }
  }

  return SECURITY_FRAUD_RULE_CATEGORY_ORDER.filter((category) => groups.has(category)).map((category) => {
    const categoryRules = groups.get(category) ?? [];

    return {
      category,
      ruleKeys: categoryRules.map((rule) => rule.ruleKey),
      rules: categoryRules
    };
  });
}

export function getSecurityFraudRulesEngineSummary(rules: SecurityFraudRule[]): SecurityFraudRulesEngineSummary {
  const foundationRules = rules.filter((rule) => rule.runtimeStatus === "foundation").length;
  const criticalRules = rules.filter((rule) => rule.severity === "critical").length;
  const highRules = rules.filter((rule) => rule.severity === "high").length;
  const auditRequiredRules = rules.filter((rule) => rule.auditRequired).length;
  const enabledRules = rules.filter((rule) => rule.enabled).length;
  const executableRules = rules.filter((rule) => rule.executionAllowed).length;
  const categoryCount = buildSecurityFraudRuleCategories(rules).length;
  const status: SecurityFraudRulesEngineRuntimeStatus =
    enabledRules === 0 && executableRules === 0 ? "fraud_rules_ready" : "needs_attention";

  return {
    auditRequiredRules,
    categoryCount,
    criticalRules,
    enabledRules,
    executableRules,
    foundationRules,
    highRules,
    readOnly: true,
    registryKey: SECURITY_FRAUD_RULES_ENGINE_REGISTRY_KEY,
    registrySource: SECURITY_REGISTRY_SOURCE,
    source: SECURITY_FRAUD_RULES_ENGINE_SOURCE,
    status,
    summary: [
      `status ${status}`,
      `${rules.length} fraud rules`,
      `${foundationRules} foundation`,
      `${criticalRules} critical`,
      `${highRules} high`,
      `${enabledRules} enabled`,
      `${executableRules} executable`
    ].join("; "),
    totalRules: rules.length
  };
}

export function validateSecurityFraudRulesEngineRuntime(
  rules: SecurityFraudRule[]
): SecurityFraudRulesEngineValidation {
  const issues: string[] = [];

  if (rules.length !== SECURITY_FRAUD_RULE_DEFINITIONS.length) {
    issues.push("Security fraud rules engine runtime must include all SEC-22 rule definitions.");
  }

  const keys = new Set<string>();

  for (const rule of rules) {
    if (rule.enabled !== false) {
      issues.push(`${rule.ruleKey} must remain disabled in this phase.`);
    }

    if (rule.executionAllowed !== false) {
      issues.push(`${rule.ruleKey} must not allow execution in this phase.`);
    }

    if (rule.metadataOnly !== true || rule.readOnly !== true) {
      issues.push(`${rule.ruleKey} must remain metadata-only and read-only.`);
    }

    if (rule.source !== SECURITY_FRAUD_RULES_ENGINE_SOURCE) {
      issues.push(`${rule.ruleKey} must originate from the security fraud rules engine runtime.`);
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
      issues.push(`Duplicate security fraud rule key: ${rule.ruleKey}.`);
    }

    keys.add(rule.ruleKey);
  }

  return {
    isValid: issues.length === 0,
    issues
  };
}

export function buildSecurityFraudRulesEngineLoadingState(): SecurityFraudRulesEngineLoadingState {
  return {
    loading: true,
    message: "Loading the read-only Security fraud rules engine foundation from the security registry.",
    readOnly: true,
    source: SECURITY_FRAUD_RULES_ENGINE_SOURCE
  };
}

export function mapSecurityFraudRuleToAdminComponent(rule: SecurityFraudRule) {
  return {
    auditRequired: rule.auditRequired,
    category: rule.category,
    description: rule.description,
    displayName: rule.displayName,
    enabled: rule.enabled,
    executionAllowed: rule.executionAllowed,
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

export function mapSecurityFraudRulesEngineRuntimeToAdminFields() {
  const registryEntry = getSecurityRegistryEntry(SECURITY_FRAUD_RULES_ENGINE_REGISTRY_KEY);

  if (!registryEntry || registryEntry.visibility !== "super_admin") {
    return {
      categories: [] as ReturnType<typeof buildSecurityFraudRuleCategories>,
      futureHook: null,
      phaseNote: SECURITY_FRAUD_RULES_ENGINE_PHASE_NOTE,
      registry: null,
      rules: [] as ReturnType<typeof mapSecurityFraudRuleToAdminComponent>[],
      summary: {
        auditRequiredRules: 0,
        categoryCount: 0,
        criticalRules: 0,
        enabledRules: 0,
        executableRules: 0,
        foundationRules: 0,
        highRules: 0,
        readOnly: true as const,
        registryKey: SECURITY_FRAUD_RULES_ENGINE_REGISTRY_KEY,
        registrySource: SECURITY_REGISTRY_SOURCE,
        source: SECURITY_FRAUD_RULES_ENGINE_SOURCE,
        status: "needs_attention" as const,
        summary: "Fraud detection is not registered as a super-admin module in the security registry.",
        totalRules: 0
      }
    };
  }

  const rules = resolveSecurityFraudRules();
  const validation = validateSecurityFraudRulesEngineRuntime(rules);
  const summary = getSecurityFraudRulesEngineSummary(rules);
  const futureHook = getSecurityFutureHook(SECURITY_FRAUD_RULES_ENGINE_FUTURE_HOOK_KEY);

  return {
    categories: buildSecurityFraudRuleCategories(rules),
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
    phaseNote: SECURITY_FRAUD_RULES_ENGINE_PHASE_NOTE,
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
    rules: rules.map(mapSecurityFraudRuleToAdminComponent),
    summary: validation.isValid
      ? summary
      : {
          ...summary,
          status: "needs_attention" as const,
          summary: "Security fraud rules engine validation requires safe metadata-only defaults."
        }
  };
}

export async function loadSecurityFraudRulesEngineReadOnlySafe() {
  return mapSecurityFraudRulesEngineRuntimeToAdminFields();
}
