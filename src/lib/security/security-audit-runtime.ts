import "server-only";

import {
  SECURITY_REGISTRY_SOURCE,
  getSecurityRegistryEntry,
  resolveSecurityRegistryEntries,
  validateSecurityRegistryRuntime
} from "@/src/lib/security/security-registry-runtime";
import {
  SECURITY_VISIBILITY_DEFINITIONS,
  resolveSecurityVisibilityRules,
  runSecurityVisibility,
  validateSecurityVisibilityRuntime,
  type SecurityVisibilityRule
} from "@/src/lib/security/security-visibility-runtime";

export type SecurityAuditSource = "security_audit_runtime";

export type SecurityAuditStatus = "fail" | "pass" | "warn";

export type SecurityAuditSeverity = "critical" | "high" | "info" | "low" | "medium";

export type SecurityAuditRuntimeState = "disabled" | "empty" | "success";

export type SecurityAuditResult = {
  auditId: string;
  blocking: boolean;
  checkName: string;
  message: string;
  moduleKey: string;
  readOnly: true;
  recommendation: string;
  severity: SecurityAuditSeverity;
  source: SecurityAuditSource;
  status: SecurityAuditStatus;
};

export type SecurityAuditSummary = {
  blockingCount: number;
  failCount: number;
  overallStatus: SecurityAuditStatus;
  passCount: number;
  readOnly: true;
  source: SecurityAuditSource;
  summary: string;
  totalChecks: number;
  warnCount: number;
};

export type SecurityAuditSupport = {
  disabledReason: string | null;
  readOnly: true;
  registryKey: string;
  registrySource: typeof SECURITY_REGISTRY_SOURCE;
  source: SecurityAuditSource;
  supported: boolean;
};

export type SecurityAuditValidation = {
  isValid: boolean;
  issues: string[];
};

export type SecurityAuditRuntimeResult = {
  readOnly: true;
  results: SecurityAuditResult[];
  source: SecurityAuditSource;
  state: SecurityAuditRuntimeState;
  summary: SecurityAuditSummary;
};

export type SecurityAuditLoadingState = {
  loading: true;
  message: string;
  readOnly: true;
  source: SecurityAuditSource;
};

export const SECURITY_AUDIT_SOURCE = "security_audit_runtime" as const;

export const SECURITY_AUDIT_REGISTRY_KEY = "sec-advanced-security-center" as const;

export const SECURITY_AUDIT_DISABLED_STATE =
  "Security Audit is not available in the current runtime configuration.";

function auditIdFromVisibility(visibilityId: string): string {
  return visibilityId.replace(/^sec-visibility-/, "sec-audit-");
}

function buildResult(
  auditId: string,
  moduleKey: string,
  checkName: string,
  status: SecurityAuditStatus,
  severity: SecurityAuditSeverity,
  message: string,
  blocking: boolean,
  recommendation: string
): SecurityAuditResult {
  return {
    auditId,
    blocking,
    checkName,
    message,
    moduleKey,
    readOnly: true,
    recommendation,
    severity,
    source: SECURITY_AUDIT_SOURCE,
    status
  };
}

export function resolveSecurityAuditSupport(): SecurityAuditSupport {
  const registryEntry = getSecurityRegistryEntry(SECURITY_AUDIT_REGISTRY_KEY);

  const base = {
    readOnly: true as const,
    registryKey: SECURITY_AUDIT_REGISTRY_KEY,
    registrySource: SECURITY_REGISTRY_SOURCE,
    source: SECURITY_AUDIT_SOURCE
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

function auditRegistryCompleteness(): SecurityAuditResult {
  const entries = resolveSecurityRegistryEntries();
  const validation = validateSecurityRegistryRuntime(entries);

  if (validation.isValid) {
    return buildResult(
      "sec-audit-registry-completeness",
      SECURITY_AUDIT_REGISTRY_KEY,
      "Registry Completeness",
      "pass",
      "info",
      `Security registry is complete with ${entries.length} certified entries.`,
      false,
      "No action required."
    );
  }

  return buildResult(
    "sec-audit-registry-completeness",
    SECURITY_AUDIT_REGISTRY_KEY,
    "Registry Completeness",
    "fail",
    "critical",
    `Security registry validation failed: ${validation.issues.join(" ")}`,
    true,
    "Restore the certified security registry definitions so every SEC-1 entry is present and read-only."
  );
}

function auditModuleRegistrationConsistency(): SecurityAuditResult {
  const missing = SECURITY_VISIBILITY_DEFINITIONS.filter((definition) => {
    const entry = getSecurityRegistryEntry(definition.moduleKey);
    return !entry || entry.visibility !== "super_admin";
  });

  if (missing.length === 0) {
    return buildResult(
      "sec-audit-module-registration",
      SECURITY_AUDIT_REGISTRY_KEY,
      "Module Registration Consistency",
      "pass",
      "info",
      "Every security module maps to a registered super-admin registry entry.",
      false,
      "No action required."
    );
  }

  return buildResult(
    "sec-audit-module-registration",
    SECURITY_AUDIT_REGISTRY_KEY,
    "Module Registration Consistency",
    "fail",
    "critical",
    `Modules missing registry registration: ${missing.map((definition) => definition.moduleKey).join(", ")}.`,
    true,
    "Register the missing modules as super-admin entries in the security registry."
  );
}

function checkNameForRule(rule: SecurityVisibilityRule): string {
  if (rule.visibilityId === "sec-visibility-dashboard") {
    return "Dashboard Compatibility";
  }

  return `${rule.displayName} Readiness`;
}

function auditVisibilityRule(rule: SecurityVisibilityRule): SecurityAuditResult {
  const auditId = auditIdFromVisibility(rule.visibilityId);
  const checkName = checkNameForRule(rule);

  if (rule.visibilityStatus === "visible") {
    return buildResult(
      auditId,
      rule.moduleKey,
      checkName,
      "pass",
      "info",
      `${rule.displayName} is active and read-only ready (runtime status ${rule.runtimeStatus}).`,
      false,
      "No action required."
    );
  }

  if (rule.visibilityStatus === "hidden") {
    return buildResult(
      auditId,
      rule.moduleKey,
      checkName,
      "fail",
      "critical",
      rule.disabledReason ?? `${rule.displayName} is not registered as a super-admin module.`,
      true,
      "Register the module as a super-admin entry in the security registry."
    );
  }

  if (rule.dependencyStatus === "unsatisfied") {
    return buildResult(
      auditId,
      rule.moduleKey,
      checkName,
      "fail",
      "high",
      rule.disabledReason ?? `${rule.displayName} has unsatisfied dependencies.`,
      true,
      "Restore the required dependency modules in the security registry."
    );
  }

  if (rule.tier === "foundation") {
    return buildResult(
      auditId,
      rule.moduleKey,
      checkName,
      "warn",
      "low",
      rule.disabledReason ?? `${rule.displayName} is a metadata-only foundation.`,
      false,
      "Reserved foundation; enable in its dedicated future security phase."
    );
  }

  if (rule.runtimeStatus === "planned") {
    return buildResult(
      auditId,
      rule.moduleKey,
      checkName,
      "warn",
      "low",
      rule.disabledReason ?? `${rule.displayName} is planned and not yet active.`,
      false,
      "Planned module; activate when the corresponding phase is certified."
    );
  }

  return buildResult(
    auditId,
    rule.moduleKey,
    checkName,
    "warn",
    "medium",
    rule.disabledReason ?? `${rule.displayName} requires review before it is fully enabled.`,
    false,
    "Complete the required review to activate the module."
  );
}

function auditVisibilityReadiness(): SecurityAuditResult {
  const visibility = runSecurityVisibility();
  const validation = validateSecurityVisibilityRuntime(visibility.rules);

  if (visibility.state === "disabled") {
    return buildResult(
      "sec-audit-visibility-readiness",
      SECURITY_AUDIT_REGISTRY_KEY,
      "Visibility Readiness",
      "fail",
      "critical",
      "Security visibility runtime is disabled in the current configuration.",
      true,
      "Register the advanced security center as a super-admin module to enable visibility resolution."
    );
  }

  if (!validation.isValid) {
    return buildResult(
      "sec-audit-visibility-readiness",
      SECURITY_AUDIT_REGISTRY_KEY,
      "Visibility Readiness",
      "fail",
      "high",
      `Security visibility validation failed: ${validation.issues.join(" ")}`,
      true,
      "Ensure every visibility rule is read-only and provides a reason when not visible."
    );
  }

  return buildResult(
    "sec-audit-visibility-readiness",
    SECURITY_AUDIT_REGISTRY_KEY,
    "Visibility Readiness",
    "pass",
    "info",
    `Security visibility runtime resolved ${visibility.rules.length} rules (${visibility.summary.visibleCount} visible).`,
    false,
    "No action required."
  );
}

export function resolveSecurityAuditResults(): SecurityAuditResult[] {
  const results: SecurityAuditResult[] = [
    auditRegistryCompleteness(),
    auditModuleRegistrationConsistency()
  ];

  for (const rule of resolveSecurityVisibilityRules()) {
    results.push(auditVisibilityRule(rule));
  }

  results.push(auditVisibilityReadiness());

  return results;
}

export function getSecurityAuditResult(auditId: string): SecurityAuditResult | null {
  return resolveSecurityAuditResults().find((result) => result.auditId === auditId) ?? null;
}

export function buildSecurityAuditSummary(results: SecurityAuditResult[]): SecurityAuditSummary {
  const passCount = results.filter((result) => result.status === "pass").length;
  const warnCount = results.filter((result) => result.status === "warn").length;
  const failCount = results.filter((result) => result.status === "fail").length;
  const blockingCount = results.filter((result) => result.blocking).length;
  const overallStatus: SecurityAuditStatus = failCount > 0 ? "fail" : warnCount > 0 ? "warn" : "pass";

  return {
    blockingCount,
    failCount,
    overallStatus,
    passCount,
    readOnly: true,
    source: SECURITY_AUDIT_SOURCE,
    summary: [
      `overall ${overallStatus}`,
      `${results.length} checks`,
      `${passCount} pass`,
      `${warnCount} warn`,
      `${failCount} fail`,
      `${blockingCount} blocking`
    ].join("; "),
    totalChecks: results.length,
    warnCount
  };
}

export function validateSecurityAuditRuntime(results: SecurityAuditResult[]): SecurityAuditValidation {
  const issues: string[] = [];
  const ids = new Set<string>();

  for (const result of results) {
    if (ids.has(result.auditId)) {
      issues.push(`Duplicate audit id: ${result.auditId}.`);
    }

    ids.add(result.auditId);

    if (!result.readOnly) {
      issues.push(`${result.auditId} must remain read-only.`);
    }

    if (result.source !== SECURITY_AUDIT_SOURCE) {
      issues.push(`${result.auditId} must originate from the security audit runtime.`);
    }

    if (result.status !== "pass" && !result.recommendation) {
      issues.push(`${result.auditId} must provide a recommendation when not passing.`);
    }
  }

  return {
    isValid: issues.length === 0,
    issues
  };
}

export function buildSecurityAuditLoadingState(): SecurityAuditLoadingState {
  return {
    loading: true,
    message: "Running the read-only security runtime audit against the security registry.",
    readOnly: true,
    source: SECURITY_AUDIT_SOURCE
  };
}

export function runSecurityAudit(): SecurityAuditRuntimeResult {
  const support = resolveSecurityAuditSupport();

  if (!support.supported) {
    const results = [
      buildResult(
        "sec-audit-runtime-support",
        SECURITY_AUDIT_REGISTRY_KEY,
        "Audit Runtime Support",
        "fail",
        "critical",
        support.disabledReason ?? SECURITY_AUDIT_DISABLED_STATE,
        true,
        "Register the advanced security center as a super-admin module to enable the audit runtime."
      )
    ];

    return {
      readOnly: true,
      results,
      source: SECURITY_AUDIT_SOURCE,
      state: "disabled",
      summary: buildSecurityAuditSummary(results)
    };
  }

  const results = resolveSecurityAuditResults();

  return {
    readOnly: true,
    results,
    source: SECURITY_AUDIT_SOURCE,
    state: results.length === 0 ? "empty" : "success",
    summary: buildSecurityAuditSummary(results)
  };
}

export function mapSecurityAuditRuntimeToAdminFields() {
  const result = runSecurityAudit();
  const validation = validateSecurityAuditRuntime(result.results);

  return {
    readOnly: true as const,
    results: result.results,
    source: SECURITY_AUDIT_SOURCE,
    state: result.state,
    summary: validation.isValid
      ? result.summary
      : { ...result.summary, summary: "Security audit validation requires safe read-only defaults." },
    validation
  };
}
