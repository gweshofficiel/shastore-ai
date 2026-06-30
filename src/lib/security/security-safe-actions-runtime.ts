import "server-only";

import {
  SECURITY_REGISTRY_SOURCE,
  getSecurityRegistryEntry
} from "@/src/lib/security/security-registry-runtime";

export type SecuritySafeActionsSource = "security_safe_actions_runtime";

export type SecuritySafeActionCategory =
  | "Data Export"
  | "Governance Shortcut"
  | "Review Management"
  | "Risk Management";

export type SecuritySafeActionTargetType =
  | "security_data"
  | "security_event"
  | "store"
  | "user";

export type SecuritySafeActionRuntimeStatus = "planned" | "review_required" | "supported";

export type SecuritySafeActionsRuntimeStatus = "needs_attention" | "safe_actions_ready";

export type SecuritySafeActionDefinition = {
  actionId: string;
  actionKey: string;
  auditRequired: boolean;
  category: SecuritySafeActionCategory;
  confirmationRequired: boolean;
  description: string;
  destructive: boolean;
  displayName: string;
  requiredPermission: string;
  runtimeStatus: SecuritySafeActionRuntimeStatus;
  targetType: SecuritySafeActionTargetType;
};

export type SecuritySafeAction = SecuritySafeActionDefinition & {
  disabledReason: string | null;
  enabled: boolean;
  executes: false;
  metadataOnly: true;
  readOnly: true;
  source: SecuritySafeActionsSource;
};

export type SecuritySafeActionsSummary = {
  destructiveActions: number;
  disabledActions: number;
  enabledActions: number;
  readOnly: true;
  registryKey: string;
  registrySource: typeof SECURITY_REGISTRY_SOURCE;
  source: SecuritySafeActionsSource;
  status: SecuritySafeActionsRuntimeStatus;
  summary: string;
  supportedActions: number;
  totalActions: number;
};

export type SecuritySafeActionsValidation = {
  isValid: boolean;
  issues: string[];
};

export type SecuritySafeActionsLoadingState = {
  loading: true;
  message: string;
  readOnly: true;
  source: SecuritySafeActionsSource;
};

export const SECURITY_SAFE_ACTIONS_SOURCE = "security_safe_actions_runtime" as const;

export const SECURITY_SAFE_ACTIONS_REGISTRY_KEY = "sec-security-actions" as const;

export const SECURITY_SAFE_ACTIONS_PHASE_NOTE =
  "Metadata-only in this phase. Definitions describe guarded Super Admin security actions; no security action executes on page load or from this runtime.";

const SECURITY_SAFE_ACTION_DEFINITIONS: readonly SecuritySafeActionDefinition[] = [
  {
    actionId: "security:action:mark-reviewed",
    actionKey: "sec-action-mark-reviewed",
    auditRequired: true,
    category: "Review Management",
    confirmationRequired: true,
    description:
      "Mark a security event as reviewed. Metadata-only definition for SEC-14; explicit Super Admin execution, validation, and audit are wired in a later phase.",
    destructive: false,
    displayName: "Mark Reviewed",
    requiredPermission: "super_admin:safe_action",
    runtimeStatus: "supported",
    targetType: "security_event"
  },
  {
    actionId: "security:action:mark-high-risk",
    actionKey: "sec-action-mark-high-risk",
    auditRequired: true,
    category: "Risk Management",
    confirmationRequired: true,
    description:
      "Flag a security event as high risk. Metadata-only definition for SEC-14; no risk update executes in this phase.",
    destructive: false,
    displayName: "Mark High Risk",
    requiredPermission: "super_admin:safe_action",
    runtimeStatus: "supported",
    targetType: "security_event"
  },
  {
    actionId: "security:action:clear-risk",
    actionKey: "sec-action-clear-risk",
    auditRequired: true,
    category: "Risk Management",
    confirmationRequired: true,
    description:
      "Clear the risk flag on a security event. Metadata-only definition for SEC-14; no risk update executes in this phase.",
    destructive: false,
    displayName: "Clear Risk",
    requiredPermission: "super_admin:safe_action",
    runtimeStatus: "supported",
    targetType: "security_event"
  },
  {
    actionId: "security:action:user-suspend-shortcut",
    actionKey: "sec-action-user-suspend-shortcut",
    auditRequired: true,
    category: "Governance Shortcut",
    confirmationRequired: true,
    description:
      "Shortcut to the certified user suspension workflow. Metadata-only definition for SEC-14; this runtime never suspends a user and disables the control until a later phase.",
    destructive: true,
    displayName: "User Suspend Shortcut",
    requiredPermission: "super_admin:safe_action",
    runtimeStatus: "review_required",
    targetType: "user"
  },
  {
    actionId: "security:action:store-suspend-shortcut",
    actionKey: "sec-action-store-suspend-shortcut",
    auditRequired: true,
    category: "Governance Shortcut",
    confirmationRequired: true,
    description:
      "Shortcut to the certified store suspension workflow. Metadata-only definition for SEC-14; this runtime never suspends a store and disables the control until a later phase.",
    destructive: true,
    displayName: "Store Suspend Shortcut",
    requiredPermission: "super_admin:safe_action",
    runtimeStatus: "review_required",
    targetType: "store"
  },
  {
    actionId: "security:action:export-security-data",
    actionKey: "sec-action-export-security-data",
    auditRequired: true,
    category: "Data Export",
    confirmationRequired: true,
    description:
      "Export sanitized security data for review. Metadata-only definition for SEC-14; no export executes in this phase.",
    destructive: false,
    displayName: "Export Security Data",
    requiredPermission: "super_admin:safe_action",
    runtimeStatus: "planned",
    targetType: "security_data"
  }
] as const;

function resolveDisabledReason(definition: SecuritySafeActionDefinition): string | null {
  switch (definition.runtimeStatus) {
    case "supported":
      return null;
    case "review_required":
      return `${definition.displayName} is defined but disabled in this phase. ${SECURITY_SAFE_ACTIONS_PHASE_NOTE}`;
    case "planned":
      return `${definition.displayName} is a planned action and not yet available. ${SECURITY_SAFE_ACTIONS_PHASE_NOTE}`;
  }
}

function finalizeSafeAction(definition: SecuritySafeActionDefinition): SecuritySafeAction {
  const disabledReason = resolveDisabledReason(definition);

  return {
    ...definition,
    disabledReason,
    enabled: disabledReason === null,
    executes: false,
    metadataOnly: true,
    readOnly: true,
    source: SECURITY_SAFE_ACTIONS_SOURCE
  };
}

export function listSecuritySafeActionDefinitions() {
  return SECURITY_SAFE_ACTION_DEFINITIONS.map((definition) => ({ ...definition }));
}

export function resolveSecuritySafeActions(): SecuritySafeAction[] {
  return SECURITY_SAFE_ACTION_DEFINITIONS.map((definition) => finalizeSafeAction(definition));
}

export function getSecuritySafeAction(actionKey: string): SecuritySafeAction | null {
  const definition = SECURITY_SAFE_ACTION_DEFINITIONS.find((entry) => entry.actionKey === actionKey);

  if (!definition) {
    return null;
  }

  return finalizeSafeAction(definition);
}

export function securitySafeActionStatusBadgeTone(status: SecuritySafeActionRuntimeStatus) {
  switch (status) {
    case "supported":
      return "green" as const;
    case "review_required":
      return "amber" as const;
    case "planned":
      return "slate" as const;
  }
}

export function getSecuritySafeActionsSummary(actions: SecuritySafeAction[]): SecuritySafeActionsSummary {
  const supportedActions = actions.filter((action) => action.runtimeStatus === "supported").length;
  const enabledActions = actions.filter((action) => action.enabled).length;
  const disabledActions = actions.filter((action) => !action.enabled).length;
  const destructiveActions = actions.filter((action) => action.destructive).length;
  const status: SecuritySafeActionsRuntimeStatus = actions.some(
    (action) => action.runtimeStatus === "review_required"
  )
    ? "needs_attention"
    : "safe_actions_ready";

  return {
    destructiveActions,
    disabledActions,
    enabledActions,
    readOnly: true,
    registryKey: SECURITY_SAFE_ACTIONS_REGISTRY_KEY,
    registrySource: SECURITY_REGISTRY_SOURCE,
    source: SECURITY_SAFE_ACTIONS_SOURCE,
    status,
    summary: [
      `status ${status}`,
      `${actions.length} safe actions`,
      `${supportedActions} supported`,
      `${enabledActions} enabled`,
      `${disabledActions} disabled`,
      `${destructiveActions} destructive`
    ].join("; "),
    supportedActions,
    totalActions: actions.length
  };
}

export function validateSecuritySafeActionsRuntime(actions: SecuritySafeAction[]): SecuritySafeActionsValidation {
  const issues: string[] = [];

  if (actions.length !== SECURITY_SAFE_ACTION_DEFINITIONS.length) {
    issues.push("Security safe actions runtime must include all SEC-14 action definitions.");
  }

  const keys = new Set<string>();

  for (const action of actions) {
    if (action.executes !== false || action.metadataOnly !== true) {
      issues.push(`${action.actionKey} must remain metadata-only and non-executing.`);
    }

    if (!action.readOnly) {
      issues.push(`${action.actionKey} must remain read-only.`);
    }

    if (action.source !== SECURITY_SAFE_ACTIONS_SOURCE) {
      issues.push(`${action.actionKey} must originate from the security safe actions runtime.`);
    }

    if (!action.requiredPermission) {
      issues.push(`${action.actionKey} must declare a required permission.`);
    }

    if (!action.auditRequired) {
      issues.push(`${action.actionKey} must require audit.`);
    }

    if (action.destructive && action.enabled) {
      issues.push(`${action.actionKey} is destructive and must remain disabled in this phase.`);
    }

    if (keys.has(action.actionKey)) {
      issues.push(`Duplicate security safe action key: ${action.actionKey}.`);
    }

    keys.add(action.actionKey);
  }

  return {
    isValid: issues.length === 0,
    issues
  };
}

export function buildSecuritySafeActionsLoadingState(): SecuritySafeActionsLoadingState {
  return {
    loading: true,
    message: "Loading the read-only Security safe actions runtime from the security registry.",
    readOnly: true,
    source: SECURITY_SAFE_ACTIONS_SOURCE
  };
}

export function mapSecuritySafeActionToAdminComponent(action: SecuritySafeAction) {
  return {
    actionId: action.actionId,
    actionKey: action.actionKey,
    auditRequired: action.auditRequired,
    category: action.category,
    confirmationRequired: action.confirmationRequired,
    description: action.description,
    destructive: action.destructive,
    disabledReason: action.disabledReason,
    displayName: action.displayName,
    enabled: action.enabled,
    metadataOnly: action.metadataOnly,
    requiredPermission: action.requiredPermission,
    runtimeStatus: action.runtimeStatus,
    targetType: action.targetType
  };
}

export function mapSecuritySafeActionsRuntimeToAdminFields() {
  const registryEntry = getSecurityRegistryEntry(SECURITY_SAFE_ACTIONS_REGISTRY_KEY);

  if (!registryEntry || registryEntry.visibility !== "super_admin") {
    return {
      actions: [] as ReturnType<typeof mapSecuritySafeActionToAdminComponent>[],
      phaseNote: SECURITY_SAFE_ACTIONS_PHASE_NOTE,
      registry: null,
      summary: {
        destructiveActions: 0,
        disabledActions: 0,
        enabledActions: 0,
        readOnly: true as const,
        registryKey: SECURITY_SAFE_ACTIONS_REGISTRY_KEY,
        registrySource: SECURITY_REGISTRY_SOURCE,
        source: SECURITY_SAFE_ACTIONS_SOURCE,
        status: "needs_attention" as const,
        summary: "Security actions are not registered as a super-admin module in the security registry.",
        supportedActions: 0,
        totalActions: 0
      }
    };
  }

  const actions = resolveSecuritySafeActions();
  const validation = validateSecuritySafeActionsRuntime(actions);
  const summary = getSecuritySafeActionsSummary(actions);

  return {
    actions: actions.map(mapSecuritySafeActionToAdminComponent),
    phaseNote: SECURITY_SAFE_ACTIONS_PHASE_NOTE,
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
          summary: "Security safe actions validation requires safe read-only defaults."
        }
  };
}

export async function loadSecuritySafeActionsReadOnlySafe() {
  return mapSecuritySafeActionsRuntimeToAdminFields();
}
