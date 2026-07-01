import "server-only";

import {
  SECURITY_REGISTRY_SOURCE,
  getSecurityRegistryEntry
} from "@/src/lib/security/security-registry-runtime";

export type SecurityFutureHooksSource = "security_future_hooks_runtime";

export type SecurityFutureHookCategory =
  | "Alerting"
  | "Certification"
  | "Data Operations"
  | "Governance"
  | "Observability"
  | "Threat Prevention"
  | "Validation";

export type SecurityFutureHookRuntimeStatus = "foundation_ready" | "planned" | "reserved";

export type SecurityFutureHooksRuntimeStatus = "future_hooks_ready" | "needs_attention";

export type SecurityFutureHookDefinition = {
  category: SecurityFutureHookCategory;
  dependencies: readonly string[];
  description: string;
  displayName: string;
  futurePhase: string;
  hookId: string;
  hookKey: string;
  requiredPermissions: readonly string[];
  runtimeStatus: SecurityFutureHookRuntimeStatus;
  safetyNotes: string;
};

export type SecurityFutureHook = {
  category: SecurityFutureHookCategory;
  dependencies: string[];
  description: string;
  displayName: string;
  enabled: false;
  executionAllowed: false;
  futurePhase: string;
  hookId: string;
  hookKey: string;
  metadataOnly: true;
  readOnly: true;
  requiredPermissions: string[];
  runtimeStatus: SecurityFutureHookRuntimeStatus;
  safetyNotes: string;
  source: SecurityFutureHooksSource;
};

export type SecurityFutureHooksCategoryGroup = {
  category: SecurityFutureHookCategory;
  hookKeys: string[];
  hooks: SecurityFutureHook[];
};

export type SecurityFutureHooksSummary = {
  categoryCount: number;
  enabledHooks: number;
  executableHooks: number;
  foundationReadyHooks: number;
  plannedHooks: number;
  readOnly: true;
  registryKey: string;
  registrySource: typeof SECURITY_REGISTRY_SOURCE;
  reservedHooks: number;
  source: SecurityFutureHooksSource;
  status: SecurityFutureHooksRuntimeStatus;
  summary: string;
  totalHooks: number;
};

export type SecurityFutureHooksValidation = {
  isValid: boolean;
  issues: string[];
};

export type SecurityFutureHooksLoadingState = {
  loading: true;
  message: string;
  readOnly: true;
  source: SecurityFutureHooksSource;
};

export const SECURITY_FUTURE_HOOKS_SOURCE = "security_future_hooks_runtime" as const;

export const SECURITY_FUTURE_HOOKS_REGISTRY_KEY = "sec-future-hooks" as const;

export const SECURITY_FUTURE_HOOKS_PHASE_NOTE =
  "Metadata-only in this phase. Definitions document reserved Super Admin security integration points; no hook executes, and no worker, queue, cron, retry, alert, automation, external call, or mutation runs on page load or from this runtime.";

const SECURITY_FUTURE_HOOK_DEFINITIONS: readonly SecurityFutureHookDefinition[] = [
  {
    category: "Threat Prevention",
    dependencies: ["sec-fraud-detection", "sec-risk-score", "sec-security-events"],
    description:
      "Reserved foundation for a configurable fraud rules engine that will evaluate existing fraud signals. Metadata only; no rules evaluate, and no scoring, blocking, or background jobs run in this phase.",
    displayName: "Fraud Rules Engine",
    futurePhase: "SEC-22",
    hookId: "security:hook:fraud-rules-engine",
    hookKey: "sec-hook-fraud-rules-engine",
    requiredPermissions: ["super_admin:read"],
    runtimeStatus: "foundation_ready",
    safetyNotes:
      "No fraud rule executes, no payment/provider call is made, and no automated enforcement occurs until a dedicated guarded phase enables it."
  },
  {
    category: "Threat Prevention",
    dependencies: ["sec-ip-monitoring", "sec-security-events"],
    description:
      "Reserved integration point for an IP blocklist. Metadata only; no IP is blocked, throttled, or enforced, and no middleware or edge behavior changes in this phase.",
    displayName: "IP Blocklist",
    futurePhase: "SEC-23",
    hookId: "security:hook:ip-blocklist",
    hookKey: "sec-hook-ip-blocklist",
    requiredPermissions: ["super_admin:read"],
    runtimeStatus: "planned",
    safetyNotes: "No IP blocking, rate-limit change, or request rejection occurs from this runtime."
  },
  {
    category: "Threat Prevention",
    dependencies: ["sec-device-monitoring", "sec-security-events"],
    description:
      "Reserved integration point for device fingerprinting. Metadata only; no fingerprint is generated, stored, or evaluated in this phase.",
    displayName: "Device Fingerprinting",
    futurePhase: "SEC-24",
    hookId: "security:hook:device-fingerprinting",
    hookKey: "sec-hook-device-fingerprinting",
    requiredPermissions: ["super_admin:read"],
    runtimeStatus: "planned",
    safetyNotes: "No new device fingerprinting, tracking, or device revocation runs from this runtime."
  },
  {
    category: "Threat Prevention",
    dependencies: ["sec-abuse-detection", "sec-rate-limits", "sec-security-events"],
    description:
      "Reserved integration point for automated abuse detection. Metadata only; no abuse scoring, suspension, or automation runs in this phase.",
    displayName: "Automated Abuse Detection",
    futurePhase: "SEC-25",
    hookId: "security:hook:automated-abuse-detection",
    hookKey: "sec-hook-automated-abuse-detection",
    requiredPermissions: ["super_admin:read"],
    runtimeStatus: "planned",
    safetyNotes: "No abuse scoring, user/store suspension, or automated action runs from this runtime."
  },
  {
    category: "Alerting",
    dependencies: ["sec-security-events"],
    description:
      "Reserved integration point for security alert notifications. Metadata only; no alert, email, webhook, or notification is dispatched in this phase.",
    displayName: "Security Alert Notifications",
    futurePhase: "SEC-26",
    hookId: "security:hook:security-alert-notifications",
    hookKey: "sec-hook-security-alert-notifications",
    requiredPermissions: ["super_admin:read"],
    runtimeStatus: "planned",
    safetyNotes: "No notification, alert delivery, or external messaging is triggered from this runtime."
  },
  {
    category: "Data Operations",
    dependencies: ["sec-audit-logs"],
    description:
      "Reserved integration point for scheduled audit log export. Metadata only; no scheduled export, worker, or cron job runs in this phase.",
    displayName: "Export Audit Logs",
    futurePhase: "SEC-27",
    hookId: "security:hook:export-audit-logs",
    hookKey: "sec-hook-export-audit-logs",
    requiredPermissions: ["super_admin:read"],
    runtimeStatus: "planned",
    safetyNotes: "No automated export runs; explicit Super Admin export remains handled by the SEC-20 export runtime only."
  },
  {
    category: "Data Operations",
    dependencies: ["sec-audit-logs", "sec-security-events"],
    description:
      "Reserved integration point for security search. Metadata only; no search index is built and no query executes from this runtime in this phase.",
    displayName: "Security Search",
    futurePhase: "SEC-28",
    hookId: "security:hook:security-search",
    hookKey: "sec-hook-security-search",
    requiredPermissions: ["super_admin:read"],
    runtimeStatus: "planned",
    safetyNotes: "No search execution or indexing changes existing read-only security behavior."
  },
  {
    category: "Data Operations",
    dependencies: ["sec-audit-logs", "sec-security-events"],
    description:
      "Reserved integration point for security filters. Metadata only; existing filter placeholders remain non-executing in this phase.",
    displayName: "Security Filters",
    futurePhase: "SEC-29",
    hookId: "security:hook:security-filters",
    hookKey: "sec-hook-security-filters",
    requiredPermissions: ["super_admin:read"],
    runtimeStatus: "planned",
    safetyNotes: "No filtering logic executes; current filter metadata placeholders are unchanged."
  },
  {
    category: "Observability",
    dependencies: ["sec-security-events", "sec-risk-score"],
    description:
      "Reserved integration point for security metrics. Metadata only; no metric aggregation job runs in this phase.",
    displayName: "Security Metrics",
    futurePhase: "SEC-30",
    hookId: "security:hook:security-metrics",
    hookKey: "sec-hook-security-metrics",
    requiredPermissions: ["super_admin:read"],
    runtimeStatus: "planned",
    safetyNotes: "No metric computation changes existing read-only security dashboards."
  },
  {
    category: "Observability",
    dependencies: ["sec-advanced-security-center"],
    description:
      "Reserved integration point for security visibility controls. Metadata only; no visibility rule is enforced from this runtime in this phase.",
    displayName: "Security Visibility",
    futurePhase: "SEC-31",
    hookId: "security:hook:security-visibility",
    hookKey: "sec-hook-security-visibility",
    requiredPermissions: ["super_admin:read"],
    runtimeStatus: "planned",
    safetyNotes: "No visibility enforcement weakens RLS or changes existing access rules."
  },
  {
    category: "Observability",
    dependencies: ["sec-audit-logs"],
    description:
      "Reserved integration point for extended security audit coverage. Metadata only; no audit automation runs in this phase.",
    displayName: "Security Audit",
    futurePhase: "SEC-32",
    hookId: "security:hook:security-audit",
    hookKey: "sec-hook-security-audit",
    requiredPermissions: ["super_admin:read"],
    runtimeStatus: "planned",
    safetyNotes: "No audit write automation runs; existing audit mechanisms are unchanged."
  },
  {
    category: "Governance",
    dependencies: ["sec-security-events", "sec-security-actions"],
    description:
      "Reserved integration point for structured security review workflows. Metadata only; no review automation or state change runs in this phase.",
    displayName: "Security Review",
    futurePhase: "SEC-33",
    hookId: "security:hook:security-review",
    hookKey: "sec-hook-security-review",
    requiredPermissions: ["super_admin:read"],
    runtimeStatus: "planned",
    safetyNotes: "No review workflow executes or modifies existing security records from this runtime."
  },
  {
    category: "Certification",
    dependencies: ["sec-audit-logs"],
    description:
      "Reserved integration point for data certification checks. Metadata only; no certification job runs in this phase.",
    displayName: "Data Certification",
    futurePhase: "SEC-34",
    hookId: "security:hook:data-certification",
    hookKey: "sec-hook-data-certification",
    requiredPermissions: ["super_admin:read"],
    runtimeStatus: "reserved",
    safetyNotes: "No certification process mutates data or runs background validation."
  },
  {
    category: "Certification",
    dependencies: ["sec-advanced-security-center"],
    description:
      "Reserved integration point for security certification checks. Metadata only; no certification job runs in this phase.",
    displayName: "Security Certification",
    futurePhase: "SEC-35",
    hookId: "security:hook:security-certification",
    hookKey: "sec-hook-security-certification",
    requiredPermissions: ["super_admin:read"],
    runtimeStatus: "reserved",
    safetyNotes: "No certification process changes security behavior or runs automation."
  },
  {
    category: "Certification",
    dependencies: ["sec-advanced-security-center"],
    description:
      "Reserved integration point for runtime certification checks. Metadata only; no certification job runs in this phase.",
    displayName: "Runtime Certification",
    futurePhase: "SEC-36",
    hookId: "security:hook:runtime-certification",
    hookKey: "sec-hook-runtime-certification",
    requiredPermissions: ["super_admin:read"],
    runtimeStatus: "reserved",
    safetyNotes: "No runtime certification mutates state or triggers background processing."
  },
  {
    category: "Certification",
    dependencies: ["sec-advanced-security-center"],
    description:
      "Reserved integration point for production certification checks. Metadata only; no certification job runs in this phase.",
    displayName: "Production Certification",
    futurePhase: "SEC-37",
    hookId: "security:hook:production-certification",
    hookKey: "sec-hook-production-certification",
    requiredPermissions: ["super_admin:read"],
    runtimeStatus: "reserved",
    safetyNotes: "No production certification changes deployment behavior or runs automation."
  },
  {
    category: "Validation",
    dependencies: ["sec-advanced-security-center"],
    description:
      "Reserved integration point for stress validation. Metadata only; no load, stress, or synthetic traffic is generated in this phase.",
    displayName: "Stress Validation",
    futurePhase: "SEC-38",
    hookId: "security:hook:stress-validation",
    hookKey: "sec-hook-stress-validation",
    requiredPermissions: ["super_admin:read"],
    runtimeStatus: "reserved",
    safetyNotes: "No stress test or synthetic traffic runs from this runtime."
  },
  {
    category: "Validation",
    dependencies: ["sec-advanced-security-center"],
    description:
      "Reserved integration point for production hardening checks. Metadata only; no hardening job runs in this phase.",
    displayName: "Production Hardening",
    futurePhase: "SEC-39",
    hookId: "security:hook:production-hardening",
    hookKey: "sec-hook-production-hardening",
    requiredPermissions: ["super_admin:read"],
    runtimeStatus: "reserved",
    safetyNotes: "No hardening automation modifies configuration or runs background processing."
  },
  {
    category: "Validation",
    dependencies: ["sec-advanced-security-center"],
    description:
      "Reserved integration point for final validation. Metadata only; no validation job runs in this phase.",
    displayName: "Final Validation",
    futurePhase: "SEC-40",
    hookId: "security:hook:final-validation",
    hookKey: "sec-hook-final-validation",
    requiredPermissions: ["super_admin:read"],
    runtimeStatus: "reserved",
    safetyNotes: "No final validation mutates state or runs automation."
  },
  {
    category: "Certification",
    dependencies: ["sec-advanced-security-center"],
    description:
      "Reserved integration point for final production certification. Metadata only; no certification job runs in this phase.",
    displayName: "Final Production Certification",
    futurePhase: "SEC-41",
    hookId: "security:hook:final-production-certification",
    hookKey: "sec-hook-final-production-certification",
    requiredPermissions: ["super_admin:read"],
    runtimeStatus: "reserved",
    safetyNotes: "No final production certification changes behavior or runs automation."
  }
] as const;

const SECURITY_FUTURE_HOOK_CATEGORY_ORDER: readonly SecurityFutureHookCategory[] = [
  "Threat Prevention",
  "Alerting",
  "Data Operations",
  "Observability",
  "Governance",
  "Certification",
  "Validation"
] as const;

function finalizeFutureHook(definition: SecurityFutureHookDefinition): SecurityFutureHook {
  return {
    category: definition.category,
    dependencies: [...definition.dependencies],
    description: definition.description,
    displayName: definition.displayName,
    enabled: false,
    executionAllowed: false,
    futurePhase: definition.futurePhase,
    hookId: definition.hookId,
    hookKey: definition.hookKey,
    metadataOnly: true,
    readOnly: true,
    requiredPermissions: [...definition.requiredPermissions],
    runtimeStatus: definition.runtimeStatus,
    safetyNotes: definition.safetyNotes,
    source: SECURITY_FUTURE_HOOKS_SOURCE
  };
}

export function listSecurityFutureHookDefinitions(): SecurityFutureHookDefinition[] {
  return SECURITY_FUTURE_HOOK_DEFINITIONS.map((definition) => ({
    ...definition,
    dependencies: [...definition.dependencies],
    requiredPermissions: [...definition.requiredPermissions]
  }));
}

export function resolveSecurityFutureHooks(): SecurityFutureHook[] {
  return SECURITY_FUTURE_HOOK_DEFINITIONS.map((definition) => finalizeFutureHook(definition));
}

export function getSecurityFutureHook(hookKey: string): SecurityFutureHook | null {
  const definition = SECURITY_FUTURE_HOOK_DEFINITIONS.find((entry) => entry.hookKey === hookKey);

  if (!definition) {
    return null;
  }

  return finalizeFutureHook(definition);
}

export function securityFutureHookStatusBadgeTone(status: SecurityFutureHookRuntimeStatus) {
  switch (status) {
    case "foundation_ready":
      return "blue" as const;
    case "planned":
      return "amber" as const;
    case "reserved":
      return "slate" as const;
  }
}

export function buildSecurityFutureHookCategories(
  hooks: SecurityFutureHook[]
): SecurityFutureHooksCategoryGroup[] {
  const groups = new Map<SecurityFutureHookCategory, SecurityFutureHook[]>();

  for (const hook of hooks) {
    const existing = groups.get(hook.category);

    if (existing) {
      existing.push(hook);
    } else {
      groups.set(hook.category, [hook]);
    }
  }

  return SECURITY_FUTURE_HOOK_CATEGORY_ORDER.filter((category) => groups.has(category)).map((category) => {
    const categoryHooks = groups.get(category) ?? [];

    return {
      category,
      hookKeys: categoryHooks.map((hook) => hook.hookKey),
      hooks: categoryHooks
    };
  });
}

export function getSecurityFutureHooksSummary(hooks: SecurityFutureHook[]): SecurityFutureHooksSummary {
  const foundationReadyHooks = hooks.filter((hook) => hook.runtimeStatus === "foundation_ready").length;
  const plannedHooks = hooks.filter((hook) => hook.runtimeStatus === "planned").length;
  const reservedHooks = hooks.filter((hook) => hook.runtimeStatus === "reserved").length;
  const enabledHooks = hooks.filter((hook) => hook.enabled).length;
  const executableHooks = hooks.filter((hook) => hook.executionAllowed).length;
  const categoryCount = buildSecurityFutureHookCategories(hooks).length;
  const status: SecurityFutureHooksRuntimeStatus =
    enabledHooks === 0 && executableHooks === 0 ? "future_hooks_ready" : "needs_attention";

  return {
    categoryCount,
    enabledHooks,
    executableHooks,
    foundationReadyHooks,
    plannedHooks,
    readOnly: true,
    registryKey: SECURITY_FUTURE_HOOKS_REGISTRY_KEY,
    registrySource: SECURITY_REGISTRY_SOURCE,
    reservedHooks,
    source: SECURITY_FUTURE_HOOKS_SOURCE,
    status,
    summary: [
      `status ${status}`,
      `${hooks.length} future hooks`,
      `${foundationReadyHooks} foundation-ready`,
      `${plannedHooks} planned`,
      `${reservedHooks} reserved`,
      `${enabledHooks} enabled`,
      `${executableHooks} executable`
    ].join("; "),
    totalHooks: hooks.length
  };
}

export function validateSecurityFutureHooksRuntime(
  hooks: SecurityFutureHook[]
): SecurityFutureHooksValidation {
  const issues: string[] = [];

  if (hooks.length !== SECURITY_FUTURE_HOOK_DEFINITIONS.length) {
    issues.push("Security future hooks runtime must include all SEC-21 hook definitions.");
  }

  const keys = new Set<string>();

  for (const hook of hooks) {
    if (hook.enabled !== false) {
      issues.push(`${hook.hookKey} must remain disabled in this phase.`);
    }

    if (hook.executionAllowed !== false) {
      issues.push(`${hook.hookKey} must not allow execution in this phase.`);
    }

    if (hook.metadataOnly !== true || hook.readOnly !== true) {
      issues.push(`${hook.hookKey} must remain metadata-only and read-only.`);
    }

    if (hook.source !== SECURITY_FUTURE_HOOKS_SOURCE) {
      issues.push(`${hook.hookKey} must originate from the security future hooks runtime.`);
    }

    if (hook.requiredPermissions.length === 0) {
      issues.push(`${hook.hookKey} must declare at least one required permission.`);
    }

    if (!hook.futurePhase) {
      issues.push(`${hook.hookKey} must declare a future phase.`);
    }

    if (!hook.safetyNotes) {
      issues.push(`${hook.hookKey} must declare safety notes.`);
    }

    if (keys.has(hook.hookKey)) {
      issues.push(`Duplicate security future hook key: ${hook.hookKey}.`);
    }

    keys.add(hook.hookKey);
  }

  return {
    isValid: issues.length === 0,
    issues
  };
}

export function buildSecurityFutureHooksLoadingState(): SecurityFutureHooksLoadingState {
  return {
    loading: true,
    message: "Loading the read-only Security future hooks runtime from the security registry.",
    readOnly: true,
    source: SECURITY_FUTURE_HOOKS_SOURCE
  };
}

export function mapSecurityFutureHookToAdminComponent(hook: SecurityFutureHook) {
  return {
    category: hook.category,
    dependencies: hook.dependencies,
    description: hook.description,
    displayName: hook.displayName,
    enabled: hook.enabled,
    executionAllowed: hook.executionAllowed,
    futurePhase: hook.futurePhase,
    hookId: hook.hookId,
    hookKey: hook.hookKey,
    metadataOnly: hook.metadataOnly,
    requiredPermissions: hook.requiredPermissions,
    runtimeStatus: hook.runtimeStatus,
    safetyNotes: hook.safetyNotes
  };
}

export function mapSecurityFutureHooksRuntimeToAdminFields() {
  const registryEntry = getSecurityRegistryEntry(SECURITY_FUTURE_HOOKS_REGISTRY_KEY);

  if (!registryEntry || registryEntry.visibility !== "super_admin") {
    return {
      categories: [] as ReturnType<typeof buildSecurityFutureHookCategories>,
      hooks: [] as ReturnType<typeof mapSecurityFutureHookToAdminComponent>[],
      phaseNote: SECURITY_FUTURE_HOOKS_PHASE_NOTE,
      registry: null,
      summary: {
        categoryCount: 0,
        enabledHooks: 0,
        executableHooks: 0,
        foundationReadyHooks: 0,
        plannedHooks: 0,
        readOnly: true as const,
        registryKey: SECURITY_FUTURE_HOOKS_REGISTRY_KEY,
        registrySource: SECURITY_REGISTRY_SOURCE,
        reservedHooks: 0,
        source: SECURITY_FUTURE_HOOKS_SOURCE,
        status: "needs_attention" as const,
        summary: "Future hooks are not registered as a super-admin module in the security registry.",
        totalHooks: 0
      }
    };
  }

  const hooks = resolveSecurityFutureHooks();
  const validation = validateSecurityFutureHooksRuntime(hooks);
  const summary = getSecurityFutureHooksSummary(hooks);

  return {
    categories: buildSecurityFutureHookCategories(hooks),
    hooks: hooks.map(mapSecurityFutureHookToAdminComponent),
    phaseNote: SECURITY_FUTURE_HOOKS_PHASE_NOTE,
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
          summary: "Security future hooks validation requires safe metadata-only defaults."
        }
  };
}

export async function loadSecurityFutureHooksReadOnlySafe() {
  return mapSecurityFutureHooksRuntimeToAdminFields();
}
