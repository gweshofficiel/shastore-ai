import "server-only";

import { sanitizeNotificationMonitoringMetadata } from "@/src/lib/notifications/notification-monitoring-runtime";
import { sanitizeNotificationAdminDisplayTextSafe } from "@/src/lib/notifications/notification-security-runtime";

export type NotificationSafeAction =
  | "configure_channels"
  | "disable_template"
  | "export_logs"
  | "resolve_failure"
  | "review_failure"
  | "retry_failure"
  | "send_test_notification"
  | "template_editor"
  | "view_details";

export type NotificationSafeActionExecutionMode = "disabled" | "placeholder_submit" | "read_only";

export type NotificationSafeActionTone = "amber" | "blue" | "red" | "slate" | "white";

export type NotificationSafeActionDefinition = {
  action: NotificationSafeAction;
  description: string;
  executionMode: NotificationSafeActionExecutionMode;
  foundationOnly: true;
  guardMessage: string;
  label: string;
  ready: boolean;
  safeSummary: string;
  tone: NotificationSafeActionTone;
};

export type NotificationSafeActionRecord = NotificationSafeActionDefinition & {
  actionId: string;
  scope: "global" | "log";
};

export type NotificationSafeActionRuntimeStats = {
  disabledActions: number;
  globalActions: number;
  guardedActions: number;
  logScopedActions: number;
  placeholderSubmitActions: number;
  readOnlyActions: number;
  totalActions: number;
};

export type NotificationSafeActionPolicySummary = {
  actionsRunOnPageLoad: false;
  externalProvidersCalled: false;
  foundationOnly: true;
  policyDescription: string;
  queuesProcessed: false;
  retriesExecuted: false;
  safeSummary: string;
};

export type NotificationLogSafeActionInput = {
  channel: string;
  id: string;
  status: string;
  type: string;
};

export const NOTIFICATION_SAFE_ACTION_FALLBACK_ID = "unknown_notification_safe_action" as const;

export const NOTIFICATION_SAFE_ACTIONS: readonly NotificationSafeAction[] = [
  "review_failure",
  "resolve_failure",
  "retry_failure",
  "configure_channels",
  "send_test_notification",
  "export_logs",
  "template_editor",
  "disable_template",
  "view_details"
] as const;

const actionLabels: Record<NotificationSafeAction, string> = {
  configure_channels: "Configure channels",
  disable_template: "Disable template",
  export_logs: "Export notification logs",
  resolve_failure: "Resolve failure",
  review_failure: "Review failure",
  retry_failure: "Retry failed notification",
  send_test_notification: "Send test notification",
  template_editor: "Template editor",
  view_details: "View details"
};

const actionDescriptions: Record<NotificationSafeAction, string> = {
  configure_channels:
    "Channel configuration placeholder only. No provider credentials, webhook secrets, or channel routing is modified.",
  disable_template:
    "Template disable placeholder is guarded off. No template mutation, deletion, or provider binding changes are allowed.",
  export_logs:
    "Export placeholder is guarded off. No raw payloads, recipient lists, API keys, or full log dumps are generated.",
  resolve_failure:
    "Resolve failure placeholder is guarded off. No failure state mutation, queue clearing, or retry scheduling occurs.",
  review_failure:
    "Review failure placeholder only. Records a monitoring audit event on explicit admin submit. Does not auto-mark reviewed on page load.",
  retry_failure:
    "Retry placeholder is guarded off. No queue processing, provider calls, or delivery retries are executed.",
  send_test_notification:
    "Test send placeholder is guarded off. No notifications are sent to recipients or external providers.",
  template_editor:
    "Template editor placeholder is guarded off. No template content, bindings, or provider configs are edited.",
  view_details:
    "View details placeholder only. Records a safe monitoring audit event on explicit admin submit. No raw payload exposure."
};

const actionTones: Record<NotificationSafeAction, NotificationSafeActionTone> = {
  configure_channels: "slate",
  disable_template: "red",
  export_logs: "amber",
  resolve_failure: "blue",
  review_failure: "white",
  retry_failure: "amber",
  send_test_notification: "red",
  template_editor: "slate",
  view_details: "blue"
};

const defaultExecutionModes: Record<NotificationSafeAction, NotificationSafeActionExecutionMode> = {
  configure_channels: "disabled",
  disable_template: "disabled",
  export_logs: "disabled",
  resolve_failure: "disabled",
  review_failure: "placeholder_submit",
  retry_failure: "disabled",
  send_test_notification: "disabled",
  template_editor: "disabled",
  view_details: "placeholder_submit"
};

const guardMessages: Record<NotificationSafeAction, string> = {
  configure_channels: "Channel configuration remains disconnected. Super Admin read-only visibility only.",
  disable_template: "Template disable actions remain guarded. No destructive template changes are permitted.",
  export_logs: "Log export remains guarded. No raw payload or secret export paths are connected.",
  resolve_failure: "Failure resolution remains guarded. No automatic or manual resolve execution is connected.",
  review_failure: "Review runs only on explicit admin submit. Never during page load.",
  retry_failure: "Retry remains guarded. No queue processing or provider retry execution is connected.",
  send_test_notification: "Test send remains guarded. No notification delivery or provider calls are connected.",
  template_editor: "Template editor remains guarded. No template mutation paths are connected.",
  view_details: "Details view runs only on explicit admin submit. Safe metadata only."
};

function text(value: unknown, maxLength = 500) {
  if (typeof value !== "string") return "";

  return value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/\bjavascript:/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function isFailureLikeStatus(status: unknown) {
  const normalized = text(status, 80).toLowerCase();
  return ["failed", "retry", "retry_pending", "retry_exhausted", "warning"].includes(normalized);
}

export function getNotificationSafeActionLabel(action: NotificationSafeAction) {
  return actionLabels[action];
}

export function getNotificationSafeActionDescription(action: NotificationSafeAction) {
  return actionDescriptions[action];
}

export function getNotificationSafeActionGuardMessage(action: NotificationSafeAction) {
  return guardMessages[action];
}

export function mapNotificationAdminActionToSafeAction(action: string): NotificationSafeAction | null {
  switch (text(action, 160)) {
    case "admin_notification_details_viewed":
      return "view_details";
    case "admin_notification_disable_template":
      return "disable_template";
    case "admin_notification_mark_reviewed":
      return "review_failure";
    case "admin_notification_retry_placeholder":
      return "retry_failure";
    default:
      return null;
  }
}

export function resolveNotificationSafeActionExecutionMode(
  action: NotificationSafeAction
): NotificationSafeActionExecutionMode {
  return defaultExecutionModes[action] ?? "disabled";
}

export function isNotificationSafeActionSubmitAllowed(action: NotificationSafeAction) {
  return resolveNotificationSafeActionExecutionMode(action) === "placeholder_submit";
}

export function assertNotificationSafeActionSubmitAllowed(action: NotificationSafeAction) {
  if (!isNotificationSafeActionSubmitAllowed(action)) {
    throw new Error(
      sanitizeNotificationSafeActionErrorMessage(
        `${getNotificationSafeActionLabel(action)} is guarded off. ${getNotificationSafeActionGuardMessage(action)}`
      )
    );
  }
}

export function sanitizeNotificationSafeActionErrorMessage(value: unknown, maxLength = 240) {
  const cleaned = sanitizeNotificationAdminDisplayTextSafe(value, maxLength);
  return cleaned || "Notification safe action is unavailable.";
}

function buildSafeSummary(action: NotificationSafeAction, ready: boolean) {
  const base = `${getNotificationSafeActionLabel(action)} foundation only. ${getNotificationSafeActionGuardMessage(action)}`;
  if (!ready) {
    return sanitizeNotificationAdminDisplayTextSafe(`${base} Action is currently guarded off.`, 240);
  }

  return sanitizeNotificationAdminDisplayTextSafe(`${base} Explicit admin submit records a safe monitoring placeholder only.`, 240);
}

function resolveLogActionReadiness(params: {
  action: NotificationSafeAction;
  log: NotificationLogSafeActionInput;
}) {
  const executionMode = resolveNotificationSafeActionExecutionMode(params.action);

  if (executionMode === "disabled") {
    return false;
  }

  if (params.action === "review_failure") {
    return isFailureLikeStatus(params.log.status);
  }

  if (params.action === "view_details") {
    return Boolean(text(params.log.id, 160));
  }

  return executionMode === "placeholder_submit";
}

function buildActionDefinition(params: {
  action: NotificationSafeAction;
  log?: NotificationLogSafeActionInput | null;
  scope: "global" | "log";
}): NotificationSafeActionDefinition {
  const executionMode = resolveNotificationSafeActionExecutionMode(params.action);
  const ready =
    params.scope === "global"
      ? false
      : resolveLogActionReadiness({ action: params.action, log: params.log ?? { channel: "", id: "", status: "", type: "" } });

  return {
    action: params.action,
    description: ready
      ? getNotificationSafeActionDescription(params.action)
      : `${getNotificationSafeActionDescription(params.action)} Guarded off for current notification context.`,
    executionMode,
    foundationOnly: true,
    guardMessage: getNotificationSafeActionGuardMessage(params.action),
    label: getNotificationSafeActionLabel(params.action),
    ready,
    safeSummary: buildSafeSummary(params.action, ready),
    tone: actionTones[params.action]
  };
}

export function buildNotificationLogSafeActionsSafe(
  log: NotificationLogSafeActionInput
): NotificationSafeActionDefinition[] {
  const logActions: NotificationSafeAction[] = [
    "review_failure",
    "resolve_failure",
    "retry_failure",
    "disable_template",
    "view_details"
  ];

  try {
    return logActions.map((action) =>
      buildActionDefinition({
        action,
        log,
        scope: "log"
      })
    );
  } catch (error) {
    console.error("[notification-safe-action-runtime] log safe actions build failed", error);

    return [buildNotificationSafeActionFallbackRecordSafe("log")];
  }
}

export function buildNotificationSafeActionFallbackRecordSafe(
  scope: "global" | "log" = "global"
): NotificationSafeActionRecord {
  const definition = buildActionDefinition({
    action: "view_details",
    scope
  });

  return {
    ...definition,
    actionId: NOTIFICATION_SAFE_ACTION_FALLBACK_ID,
    ready: false,
    scope,
    safeSummary: "Notification safe action fallback applied. All actions remain guarded and non-destructive."
  };
}

export function buildNotificationSafeActionRecordsSafe(params?: {
  logs?: NotificationLogSafeActionInput[] | null;
}): { safeActionItems: NotificationSafeActionRecord[]; warning: string | null } {
  try {
    const globalItems = (
      [
        "configure_channels",
        "send_test_notification",
        "export_logs",
        "template_editor",
        "review_failure",
        "resolve_failure",
        "retry_failure"
      ] as const
    ).map((action) => {
      const definition = buildActionDefinition({ action, scope: "global" });

      return {
        ...definition,
        actionId: `global:${action}`,
        scope: "global" as const
      };
    });

    const logs = Array.isArray(params?.logs) ? params.logs : [];
    const logItems = logs.flatMap((log) =>
      buildNotificationLogSafeActionsSafe(log).map((definition) => ({
        ...definition,
        actionId: `log:${text(log.id, 160) || NOTIFICATION_SAFE_ACTION_FALLBACK_ID}:${definition.action}`,
        scope: "log" as const
      }))
    );

    return {
      safeActionItems: [...globalItems, ...logItems],
      warning: null
    };
  } catch (error) {
    console.error("[notification-safe-action-runtime] safe action records build failed", error);

    return {
      safeActionItems: [buildNotificationSafeActionFallbackRecordSafe()],
      warning: "Notification safe action runtime fallback applied."
    };
  }
}

export function buildNotificationSafeActionRuntimeStatsSafe(
  safeActionItems: NotificationSafeActionRecord[] | null | undefined
): NotificationSafeActionRuntimeStats {
  try {
    const items = Array.isArray(safeActionItems) ? safeActionItems : [];

    return {
      disabledActions: items.filter((item) => item.executionMode === "disabled" || !item.ready).length,
      globalActions: items.filter((item) => item.scope === "global").length,
      guardedActions: items.filter((item) => !item.ready).length,
      logScopedActions: items.filter((item) => item.scope === "log").length,
      placeholderSubmitActions: items.filter((item) => item.executionMode === "placeholder_submit").length,
      readOnlyActions: items.filter((item) => item.executionMode === "read_only").length,
      totalActions: items.length
    };
  } catch (error) {
    console.error("[notification-safe-action-runtime] safe action runtime stats build failed", error);

    return {
      disabledActions: 0,
      globalActions: 0,
      guardedActions: 0,
      logScopedActions: 0,
      placeholderSubmitActions: 0,
      readOnlyActions: 0,
      totalActions: 0
    };
  }
}

export function buildNotificationSafeActionPolicySummarySafe(): NotificationSafeActionPolicySummary {
  return {
    actionsRunOnPageLoad: false,
    externalProvidersCalled: false,
    foundationOnly: true,
    policyDescription:
      "Notification Center actions remain guarded, inactive, and non-destructive. Only explicit admin submit may record safe monitoring placeholders for review and view details. No send, retry, queue, export, resolve, provider, or template mutation paths are connected.",
    queuesProcessed: false,
    retriesExecuted: false,
    safeSummary:
      "NT-22 safe action runtime: read-only Super Admin visibility with guarded placeholders only. Nothing executes during page load."
  };
}

export function listNotificationSafeActionCatalog() {
  return NOTIFICATION_SAFE_ACTIONS.map((action) => ({
    action,
    description: getNotificationSafeActionDescription(action),
    executionMode: resolveNotificationSafeActionExecutionMode(action),
    guardMessage: getNotificationSafeActionGuardMessage(action),
    label: getNotificationSafeActionLabel(action)
  }));
}

export function sanitizeNotificationSafeActionMetadataSafe(params: {
  action: NotificationSafeAction;
  executionMode: NotificationSafeActionExecutionMode;
  ready: boolean;
  scope: "global" | "log";
}) {
  return sanitizeNotificationMonitoringMetadata({
    action: params.action,
    execution_mode: params.executionMode,
    ready: params.ready,
    scope: params.scope,
    source: "notification_safe_action_runtime"
  });
}

// NT-23+ placeholders: action orchestration, approval flows, and automation stay disconnected.
export const NOTIFICATION_SAFE_ACTION_FUTURE_HOOKS = [
  "notification_action_orchestration",
  "notification_action_approval",
  "notification_action_automation"
] as const;
