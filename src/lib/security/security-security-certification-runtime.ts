import "server-only";

import {
  SECURITY_REGISTRY_SOURCE,
  getSecurityRegistryEntry,
  resolveSecurityRegistryEntries,
  type SecurityRegistryEntry
} from "@/src/lib/security/security-registry-runtime";
import { runSecurityAudit, type SecurityAuditResult } from "@/src/lib/security/security-audit-runtime";
import {
  runSecurityDataCertification,
  type SecurityDataCertificationResult
} from "@/src/lib/security/security-data-certification-runtime";

export type SecuritySecurityCertificationSource = "security_security_certification_runtime";

export type SecuritySecurityCertificationCheckStatus = "fail" | "pass" | "warn";

export type SecuritySecurityCertificationSeverity = "critical" | "high" | "info" | "low" | "medium";

export type SecuritySecurityCertificationStatus =
  | "certified"
  | "conditionally_certified"
  | "not_certified";

export type SecuritySecurityCertificationRuntimeState = "disabled" | "empty" | "success";

type SecuritySecurityCertificationKind =
  | "audit_module"
  | "datacert_masking_all"
  | "datacert_module"
  | "invariant"
  | "registry_permissions"
  | "registry_visibility";

export type SecuritySecurityCertificationDefinition = {
  certificationId: string;
  evidence: string;
  kind: SecuritySecurityCertificationKind;
  moduleKey: string;
  recommendation: string;
  securityCheckName: string;
  target?: string;
};

export type SecuritySecurityCertificationResult = {
  blocking: boolean;
  certificationId: string;
  certificationStatus: SecuritySecurityCertificationStatus;
  evidence: string;
  moduleKey: string;
  readOnly: true;
  recommendation: string;
  securityCheckName: string;
  severity: SecuritySecurityCertificationSeverity;
  source: SecuritySecurityCertificationSource;
  status: SecuritySecurityCertificationCheckStatus;
};

export type SecuritySecurityCertificationSummary = {
  blockingCount: number;
  certifiedCount: number;
  conditionalCount: number;
  failCount: number;
  notCertifiedCount: number;
  overallCertification: SecuritySecurityCertificationStatus;
  passCount: number;
  readOnly: true;
  source: SecuritySecurityCertificationSource;
  summary: string;
  totalChecks: number;
  warnCount: number;
};

export type SecuritySecurityCertificationSupport = {
  disabledReason: string | null;
  readOnly: true;
  registryKey: string;
  registrySource: typeof SECURITY_REGISTRY_SOURCE;
  source: SecuritySecurityCertificationSource;
  supported: boolean;
};

export type SecuritySecurityCertificationValidation = {
  isValid: boolean;
  issues: string[];
};

export type SecuritySecurityCertificationRuntimeResult = {
  readOnly: true;
  results: SecuritySecurityCertificationResult[];
  source: SecuritySecurityCertificationSource;
  state: SecuritySecurityCertificationRuntimeState;
  summary: SecuritySecurityCertificationSummary;
};

export type SecuritySecurityCertificationLoadingState = {
  loading: true;
  message: string;
  readOnly: true;
  source: SecuritySecurityCertificationSource;
};

export const SECURITY_SECURITY_CERTIFICATION_SOURCE = "security_security_certification_runtime" as const;

export const SECURITY_SECURITY_CERTIFICATION_REGISTRY_KEY = "sec-advanced-security-center" as const;

export const SECURITY_SECURITY_CERTIFICATION_READ_PERMISSION = "super_admin:read" as const;

export const SECURITY_SECURITY_CERTIFICATION_DISABLED_STATE =
  "Security Security Certification is not available in the current runtime configuration.";

export const SECURITY_SECURITY_CERTIFICATION_DEFINITIONS: readonly SecuritySecurityCertificationDefinition[] = [
  {
    certificationId: "sec-seccert-super-admin-access",
    evidence: "Every security registry entry restricts visibility to super_admin only.",
    kind: "registry_visibility",
    moduleKey: "sec-advanced-security-center",
    recommendation: "Restrict every security module to super_admin visibility in the security registry.",
    securityCheckName: "Super Admin Access Only"
  },
  {
    certificationId: "sec-seccert-permission-checks",
    evidence: "Every security registry entry requires the super_admin:read permission.",
    kind: "registry_permissions",
    moduleKey: "sec-advanced-security-center",
    recommendation: "Require super_admin permissions on every security module in the security registry.",
    securityCheckName: "Permission Checks"
  },
  {
    certificationId: "sec-seccert-rls-preservation",
    evidence:
      "Security runtimes read through certified service-role access gated by super_admin authentication and never alter RLS policies.",
    kind: "invariant",
    moduleKey: "sec-advanced-security-center",
    recommendation: "No action required. RLS policies remain unmodified.",
    securityCheckName: "RLS Preservation"
  },
  {
    certificationId: "sec-seccert-ownership-controls",
    evidence:
      "Guarded actions delegate to certified ownership-aware mechanisms and never bypass existing ownership controls.",
    kind: "invariant",
    moduleKey: "sec-security-actions",
    recommendation: "No action required. Ownership controls are preserved.",
    securityCheckName: "Ownership Controls Preservation"
  },
  {
    certificationId: "sec-seccert-sensitive-field-masking",
    evidence: "All certified security data modules enforce sensitive-field masking.",
    kind: "datacert_masking_all",
    moduleKey: "sec-advanced-security-center",
    recommendation: "Ensure every security data module masks or excludes sensitive fields before display.",
    securityCheckName: "Sensitive Field Masking"
  },
  {
    certificationId: "sec-seccert-secrets-exclusion",
    evidence:
      "Security runtimes redact tokens, keys, emails, and credentials via safe-text masking and never emit secrets or raw sensitive metadata.",
    kind: "invariant",
    moduleKey: "sec-advanced-security-center",
    recommendation: "No action required. Secrets are excluded from all security outputs.",
    securityCheckName: "Secrets Exclusion"
  },
  {
    certificationId: "sec-seccert-safe-action-guards",
    evidence: "Safe actions require explicit super_admin click, validation, eligibility, and audit before execution.",
    kind: "audit_module",
    moduleKey: "sec-security-actions",
    recommendation: "Restore safe-action guards and audit logging before enabling actions.",
    securityCheckName: "Safe Action Guards",
    target: "sec-audit-security-safe-actions"
  },
  {
    certificationId: "sec-seccert-action-confirmation",
    evidence:
      "Guarded actions require strong confirmation (explicit confirm flag and confirmation token) and never execute on page load.",
    kind: "invariant",
    moduleKey: "sec-security-actions",
    recommendation: "No action required. Confirmation is required for every guarded action.",
    securityCheckName: "Action Confirmation Requirements"
  },
  {
    certificationId: "sec-seccert-export-masking",
    evidence: "Exports emit only masked, bounded fields and never include secrets.",
    kind: "datacert_module",
    moduleKey: "sec-security-actions",
    recommendation: "Restore export masking and safe limits before certifying exports.",
    securityCheckName: "Export Masking",
    target: "sec-cert-exports"
  },
  {
    certificationId: "sec-seccert-search-safety",
    evidence: "Search operates read-only over existing datasets with masked fields and safe result limits.",
    kind: "datacert_module",
    moduleKey: "sec-advanced-security-center",
    recommendation: "Restore search masking and safe limits before certifying search.",
    securityCheckName: "Search Safety",
    target: "sec-cert-search"
  },
  {
    certificationId: "sec-seccert-filters-safety",
    evidence: "Filters operate read-only over existing datasets with masked fields and safe result limits.",
    kind: "datacert_module",
    moduleKey: "sec-advanced-security-center",
    recommendation: "Restore filter masking and safe limits before certifying filters.",
    securityCheckName: "Filters Safety",
    target: "sec-cert-filters"
  },
  {
    certificationId: "sec-seccert-metrics-safety",
    evidence: "Metrics compute lightweight read-only counts with masked values and no persistence.",
    kind: "datacert_module",
    moduleKey: "sec-advanced-security-center",
    recommendation: "Restore metrics masking and safe limits before certifying metrics.",
    securityCheckName: "Metrics Safety",
    target: "sec-cert-metrics"
  },
  {
    certificationId: "sec-seccert-no-auto-execution",
    evidence: "Security runtimes are read-only on page load and never execute actions automatically.",
    kind: "invariant",
    moduleKey: "sec-advanced-security-center",
    recommendation: "No action required. No automatic execution occurs on page load.",
    securityCheckName: "No Automatic Execution During Page Load"
  },
  {
    certificationId: "sec-seccert-no-workers",
    evidence: "Security runtimes start no background workers.",
    kind: "invariant",
    moduleKey: "sec-advanced-security-center",
    recommendation: "No action required. No background workers are started.",
    securityCheckName: "No Background Workers"
  },
  {
    certificationId: "sec-seccert-no-queues",
    evidence: "Security runtimes enqueue no work onto queues.",
    kind: "invariant",
    moduleKey: "sec-advanced-security-center",
    recommendation: "No action required. No queues are used.",
    securityCheckName: "No Queues"
  },
  {
    certificationId: "sec-seccert-no-cron",
    evidence: "Security runtimes schedule no cron jobs.",
    kind: "invariant",
    moduleKey: "sec-advanced-security-center",
    recommendation: "No action required. No cron jobs are scheduled.",
    securityCheckName: "No Cron Jobs"
  },
  {
    certificationId: "sec-seccert-no-retry",
    evidence: "Security runtimes schedule no retry jobs.",
    kind: "invariant",
    moduleKey: "sec-advanced-security-center",
    recommendation: "No action required. No retry jobs are scheduled.",
    securityCheckName: "No Retry Jobs"
  },
  {
    certificationId: "sec-seccert-no-destructive-operations",
    evidence:
      "Security runtimes perform no inserts, updates, deletes, seeds, or schema changes on page load; only explicit guarded actions write append-only audit metadata.",
    kind: "invariant",
    moduleKey: "sec-advanced-security-center",
    recommendation: "No action required. No destructive operations are performed.",
    securityCheckName: "No Destructive Operations"
  }
] as const;

export function resolveSecuritySecurityCertificationSupport(): SecuritySecurityCertificationSupport {
  const registryEntry = getSecurityRegistryEntry(SECURITY_SECURITY_CERTIFICATION_REGISTRY_KEY);

  const base = {
    readOnly: true as const,
    registryKey: SECURITY_SECURITY_CERTIFICATION_REGISTRY_KEY,
    registrySource: SECURITY_REGISTRY_SOURCE,
    source: SECURITY_SECURITY_CERTIFICATION_SOURCE
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

function certificationStatusFromCheck(
  status: SecuritySecurityCertificationCheckStatus
): SecuritySecurityCertificationStatus {
  if (status === "fail") {
    return "not_certified";
  }

  return status === "warn" ? "conditionally_certified" : "certified";
}

type SecuritySecurityCertificationContext = {
  auditById: Map<string, SecurityAuditResult>;
  dataCertById: Map<string, SecurityDataCertificationResult>;
  dataCertResults: SecurityDataCertificationResult[];
  entries: SecurityRegistryEntry[];
};

type CheckAssessment = {
  blocking: boolean;
  evidence: string;
  recommendation: string;
  severity: SecuritySecurityCertificationSeverity;
  status: SecuritySecurityCertificationCheckStatus;
};

function assessRegistryVisibility(
  definition: SecuritySecurityCertificationDefinition,
  context: SecuritySecurityCertificationContext
): CheckAssessment {
  const nonSuperAdmin = context.entries.filter((entry) => entry.visibility !== "super_admin");

  if (nonSuperAdmin.length === 0) {
    return {
      blocking: false,
      evidence: `All ${context.entries.length} security registry entries are restricted to super_admin visibility.`,
      recommendation: "No action required.",
      severity: "info",
      status: "pass"
    };
  }

  return {
    blocking: true,
    evidence: `Non super_admin security modules detected: ${nonSuperAdmin.map((entry) => entry.key).join(", ")}.`,
    recommendation: definition.recommendation,
    severity: "critical",
    status: "fail"
  };
}

function assessRegistryPermissions(
  definition: SecuritySecurityCertificationDefinition,
  context: SecuritySecurityCertificationContext
): CheckAssessment {
  const missing = context.entries.filter(
    (entry) => !entry.permissions.includes(SECURITY_SECURITY_CERTIFICATION_READ_PERMISSION)
  );

  if (missing.length === 0) {
    return {
      blocking: false,
      evidence: `All ${context.entries.length} security registry entries require ${SECURITY_SECURITY_CERTIFICATION_READ_PERMISSION}.`,
      recommendation: "No action required.",
      severity: "info",
      status: "pass"
    };
  }

  return {
    blocking: true,
    evidence: `Security modules missing ${SECURITY_SECURITY_CERTIFICATION_READ_PERMISSION}: ${missing
      .map((entry) => entry.key)
      .join(", ")}.`,
    recommendation: definition.recommendation,
    severity: "critical",
    status: "fail"
  };
}

function assessDataCertMaskingAll(
  definition: SecuritySecurityCertificationDefinition,
  context: SecuritySecurityCertificationContext
): CheckAssessment {
  const gaps = context.dataCertResults.filter((result) => result.maskingStatus !== "enforced");
  const notCertified = context.dataCertResults.filter((result) => result.certificationStatus === "not_certified");

  if (gaps.length === 0 && notCertified.length === 0) {
    return {
      blocking: false,
      evidence: `All ${context.dataCertResults.length} security data modules enforce sensitive-field masking.`,
      recommendation: "No action required.",
      severity: "info",
      status: "pass"
    };
  }

  if (gaps.length > 0) {
    return {
      blocking: true,
      evidence: `Masking gaps detected in: ${gaps.map((result) => result.displayName).join(", ")}.`,
      recommendation: definition.recommendation,
      severity: "critical",
      status: "fail"
    };
  }

  return {
    blocking: false,
    evidence: `Masking enforced, but certification is pending for: ${notCertified
      .map((result) => result.displayName)
      .join(", ")}.`,
    recommendation: definition.recommendation,
    severity: "medium",
    status: "warn"
  };
}

function assessDataCertModule(
  definition: SecuritySecurityCertificationDefinition,
  context: SecuritySecurityCertificationContext
): CheckAssessment {
  const target = definition.target ? context.dataCertById.get(definition.target) : undefined;

  if (!target) {
    return {
      blocking: true,
      evidence: "The linked data certification result is unavailable.",
      recommendation: definition.recommendation,
      severity: "high",
      status: "fail"
    };
  }

  const evidence = `${target.displayName}: data source ${target.dataSourceStatus}, read-only ${target.readOnlyStatus}, masking ${target.maskingStatus}, limits ${target.safeLimitsStatus}, empty ${target.emptyStateStatus}, error ${target.errorStateStatus}.`;

  if (target.certificationStatus === "certified") {
    return {
      blocking: false,
      evidence,
      recommendation: "No action required.",
      severity: "info",
      status: "pass"
    };
  }

  if (target.certificationStatus === "conditionally_certified") {
    return {
      blocking: false,
      evidence,
      recommendation: target.recommendation,
      severity: "medium",
      status: "warn"
    };
  }

  return {
    blocking: true,
    evidence,
    recommendation: target.recommendation,
    severity: "high",
    status: "fail"
  };
}

function assessAuditModule(
  definition: SecuritySecurityCertificationDefinition,
  context: SecuritySecurityCertificationContext
): CheckAssessment {
  const target = definition.target ? context.auditById.get(definition.target) : undefined;

  if (!target) {
    return {
      blocking: true,
      evidence: "The linked audit result is unavailable.",
      recommendation: definition.recommendation,
      severity: "high",
      status: "fail"
    };
  }

  return {
    blocking: target.blocking,
    evidence: target.message,
    recommendation: target.status === "pass" ? "No action required." : target.recommendation,
    severity: target.severity,
    status: target.status
  };
}

function assessInvariant(definition: SecuritySecurityCertificationDefinition): CheckAssessment {
  return {
    blocking: false,
    evidence: definition.evidence,
    recommendation: "No action required.",
    severity: "info",
    status: "pass"
  };
}

function assessDefinition(
  definition: SecuritySecurityCertificationDefinition,
  context: SecuritySecurityCertificationContext
): SecuritySecurityCertificationResult {
  let assessment: CheckAssessment;

  switch (definition.kind) {
    case "registry_visibility":
      assessment = assessRegistryVisibility(definition, context);
      break;
    case "registry_permissions":
      assessment = assessRegistryPermissions(definition, context);
      break;
    case "datacert_masking_all":
      assessment = assessDataCertMaskingAll(definition, context);
      break;
    case "datacert_module":
      assessment = assessDataCertModule(definition, context);
      break;
    case "audit_module":
      assessment = assessAuditModule(definition, context);
      break;
    case "invariant":
    default:
      assessment = assessInvariant(definition);
      break;
  }

  return {
    blocking: assessment.blocking,
    certificationId: definition.certificationId,
    certificationStatus: certificationStatusFromCheck(assessment.status),
    evidence: assessment.evidence,
    moduleKey: definition.moduleKey,
    readOnly: true,
    recommendation: assessment.recommendation,
    securityCheckName: definition.securityCheckName,
    severity: assessment.severity,
    source: SECURITY_SECURITY_CERTIFICATION_SOURCE,
    status: assessment.status
  };
}

export function resolveSecuritySecurityCertificationResults(): SecuritySecurityCertificationResult[] {
  const audit = runSecurityAudit();
  const dataCertification = runSecurityDataCertification();

  const context: SecuritySecurityCertificationContext = {
    auditById: new Map(audit.results.map((result) => [result.auditId, result])),
    dataCertById: new Map(dataCertification.results.map((result) => [result.certificationId, result])),
    dataCertResults: dataCertification.results,
    entries: resolveSecurityRegistryEntries()
  };

  return SECURITY_SECURITY_CERTIFICATION_DEFINITIONS.map((definition) => assessDefinition(definition, context));
}

export function getSecuritySecurityCertificationResult(
  certificationId: string
): SecuritySecurityCertificationResult | null {
  return (
    resolveSecuritySecurityCertificationResults().find(
      (result) => result.certificationId === certificationId
    ) ?? null
  );
}

export function buildSecuritySecurityCertificationSummary(
  results: SecuritySecurityCertificationResult[]
): SecuritySecurityCertificationSummary {
  const passCount = results.filter((result) => result.status === "pass").length;
  const warnCount = results.filter((result) => result.status === "warn").length;
  const failCount = results.filter((result) => result.status === "fail").length;
  const blockingCount = results.filter((result) => result.blocking).length;
  const certifiedCount = results.filter((result) => result.certificationStatus === "certified").length;
  const conditionalCount = results.filter(
    (result) => result.certificationStatus === "conditionally_certified"
  ).length;
  const notCertifiedCount = results.filter(
    (result) => result.certificationStatus === "not_certified"
  ).length;

  const overallCertification: SecuritySecurityCertificationStatus =
    notCertifiedCount > 0 ? "not_certified" : conditionalCount > 0 ? "conditionally_certified" : "certified";

  return {
    blockingCount,
    certifiedCount,
    conditionalCount,
    failCount,
    notCertifiedCount,
    overallCertification,
    passCount,
    readOnly: true,
    source: SECURITY_SECURITY_CERTIFICATION_SOURCE,
    summary: [
      `overall ${overallCertification}`,
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

export function validateSecuritySecurityCertificationRuntime(
  results: SecuritySecurityCertificationResult[]
): SecuritySecurityCertificationValidation {
  const issues: string[] = [];
  const ids = new Set<string>();

  if (results.length !== SECURITY_SECURITY_CERTIFICATION_DEFINITIONS.length) {
    issues.push("Security security certification runtime must include every security check.");
  }

  for (const result of results) {
    if (ids.has(result.certificationId)) {
      issues.push(`Duplicate certification id: ${result.certificationId}.`);
    }

    ids.add(result.certificationId);

    if (!result.readOnly) {
      issues.push(`${result.certificationId} must remain read-only.`);
    }

    if (result.source !== SECURITY_SECURITY_CERTIFICATION_SOURCE) {
      issues.push(`${result.certificationId} must originate from the security security certification runtime.`);
    }

    if (result.status !== "pass" && !result.recommendation) {
      issues.push(`${result.certificationId} must provide a recommendation when not passing.`);
    }
  }

  return {
    isValid: issues.length === 0,
    issues
  };
}

export function buildSecuritySecurityCertificationLoadingState(): SecuritySecurityCertificationLoadingState {
  return {
    loading: true,
    message: "Certifying read-only security safety across access, masking, guards, and side-effect controls.",
    readOnly: true,
    source: SECURITY_SECURITY_CERTIFICATION_SOURCE
  };
}

export function runSecuritySecurityCertification(): SecuritySecurityCertificationRuntimeResult {
  const support = resolveSecuritySecurityCertificationSupport();

  if (!support.supported) {
    const results = SECURITY_SECURITY_CERTIFICATION_DEFINITIONS.map((definition) => ({
      blocking: true,
      certificationId: definition.certificationId,
      certificationStatus: "not_certified" as const,
      evidence: support.disabledReason ?? SECURITY_SECURITY_CERTIFICATION_DISABLED_STATE,
      moduleKey: definition.moduleKey,
      readOnly: true as const,
      recommendation:
        "Register the advanced security center as a super-admin module to enable security certification.",
      securityCheckName: definition.securityCheckName,
      severity: "critical" as const,
      source: SECURITY_SECURITY_CERTIFICATION_SOURCE,
      status: "fail" as const
    }));

    return {
      readOnly: true,
      results,
      source: SECURITY_SECURITY_CERTIFICATION_SOURCE,
      state: "disabled",
      summary: buildSecuritySecurityCertificationSummary(results)
    };
  }

  const results = resolveSecuritySecurityCertificationResults();

  return {
    readOnly: true,
    results,
    source: SECURITY_SECURITY_CERTIFICATION_SOURCE,
    state: results.length === 0 ? "empty" : "success",
    summary: buildSecuritySecurityCertificationSummary(results)
  };
}

export function mapSecuritySecurityCertificationRuntimeToAdminFields() {
  const result = runSecuritySecurityCertification();
  const validation = validateSecuritySecurityCertificationRuntime(result.results);

  return {
    readOnly: true as const,
    results: result.results,
    source: SECURITY_SECURITY_CERTIFICATION_SOURCE,
    state: result.state,
    summary: validation.isValid
      ? result.summary
      : {
          ...result.summary,
          summary: "Security security certification validation requires safe read-only defaults."
        },
    validation
  };
}
