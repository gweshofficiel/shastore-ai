import "server-only";

import {
  SECURITY_REGISTRY_SOURCE,
  getSecurityRegistryEntry
} from "@/src/lib/security/security-registry-runtime";
import {
  SECURITY_FUTURE_HOOKS_SOURCE,
  getSecurityFutureHook
} from "@/src/lib/security/security-future-hooks-runtime";

export type SecurityAlertNotificationsSource = "security_alert_notifications_runtime";

export type SecurityAlertNotificationCategory =
  | "Abuse"
  | "Fraud"
  | "Login"
  | "Rate Limit"
  | "Risk"
  | "System";

export type SecurityAlertType =
  | "abuse_alert"
  | "fraud_alert"
  | "login_alert"
  | "rate_limit_alert"
  | "risk_alert"
  | "system_alert";

export type SecurityAlertSeverity = "critical" | "high" | "low" | "medium";

export type SecurityAlertTargetAudience = "security_team" | "store_owner" | "super_admin";

export type SecurityAlertSourceModule =
  | "abuse"
  | "audit"
  | "fraud"
  | "login"
  | "rate_limit"
  | "risk";

export type SecurityAlertDeliveryChannel = "email" | "in_app" | "push" | "webhook";

export type SecurityAlertRuntimeStatus = "foundation" | "planned" | "reserved";

export type SecurityAlertNotificationsRuntimeState = "alert_notifications_ready" | "needs_attention";

export type SecurityAlertNotificationDefinition = {
  alertType: SecurityAlertType;
  auditRequired: boolean;
  category: SecurityAlertNotificationCategory;
  deliveryChannel: SecurityAlertDeliveryChannel;
  description: string;
  displayName: string;
  notificationId: string;
  notificationKey: string;
  requiredDataSources: readonly string[];
  runtimeStatus: SecurityAlertRuntimeStatus;
  safetyNotes: string;
  severity: SecurityAlertSeverity;
  sourceModule: SecurityAlertSourceModule;
  targetAudience: SecurityAlertTargetAudience;
};

export type SecurityAlertNotification = {
  alertType: SecurityAlertType;
  auditRequired: boolean;
  category: SecurityAlertNotificationCategory;
  deliveryChannel: SecurityAlertDeliveryChannel;
  description: string;
  displayName: string;
  enabled: false;
  metadataOnly: true;
  notificationId: string;
  notificationKey: string;
  readOnly: true;
  requiredDataSources: string[];
  runtimeStatus: SecurityAlertRuntimeStatus;
  safetyNotes: string;
  sendingAllowed: false;
  severity: SecurityAlertSeverity;
  source: SecurityAlertNotificationsSource;
  sourceModule: SecurityAlertSourceModule;
  targetAudience: SecurityAlertTargetAudience;
};

export type SecurityAlertNotificationCategoryGroup = {
  category: SecurityAlertNotificationCategory;
  notificationKeys: string[];
  notifications: SecurityAlertNotification[];
};

export type SecurityAlertNotificationsSummary = {
  auditRequiredNotifications: number;
  categoryCount: number;
  criticalNotifications: number;
  enabledNotifications: number;
  foundationNotifications: number;
  highNotifications: number;
  readOnly: true;
  registryKey: string;
  registrySource: typeof SECURITY_REGISTRY_SOURCE;
  sendingNotifications: number;
  source: SecurityAlertNotificationsSource;
  status: SecurityAlertNotificationsRuntimeState;
  summary: string;
  totalNotifications: number;
};

export type SecurityAlertNotificationsValidation = {
  isValid: boolean;
  issues: string[];
};

export type SecurityAlertNotificationsLoadingState = {
  loading: true;
  message: string;
  readOnly: true;
  source: SecurityAlertNotificationsSource;
};

export const SECURITY_ALERT_NOTIFICATIONS_SOURCE = "security_alert_notifications_runtime" as const;

export const SECURITY_ALERT_NOTIFICATIONS_REGISTRY_KEY = "sec-advanced-security-center" as const;

export const SECURITY_ALERT_NOTIFICATIONS_FUTURE_HOOK_KEY = "sec-hook-security-alert-notifications" as const;

export const SECURITY_ALERT_NOTIFICATIONS_PHASE_NOTE =
  "Metadata-only in this phase. Definitions document reserved security alert notifications; no alert is sent, no email/in-app/webhook/push notification is dispatched, no notification job is created or enqueued, and the certified Notifications Runtime is not modified from this runtime.";

const SECURITY_ALERT_NOTIFICATION_DEFINITIONS: readonly SecurityAlertNotificationDefinition[] = [
  {
    alertType: "fraud_alert",
    auditRequired: true,
    category: "Fraud",
    deliveryChannel: "in_app",
    description:
      "Foundation definition describing a critical fraud alert surfaced to Super Admin. Metadata only; no alert is sent in this phase.",
    displayName: "Critical Fraud Alert",
    notificationId: "security:alert:critical-fraud",
    notificationKey: "sec-alert-critical-fraud",
    requiredDataSources: ["security_audit_logs", "sec-fraud-detection-runtime"],
    runtimeStatus: "foundation",
    safetyNotes: "No email, in-app, webhook, or push notification is sent from this definition.",
    severity: "critical",
    sourceModule: "fraud",
    targetAudience: "super_admin"
  },
  {
    alertType: "abuse_alert",
    auditRequired: true,
    category: "Abuse",
    deliveryChannel: "in_app",
    description:
      "Foundation definition describing an abuse alert for repeated abuse signals. Metadata only; no alert is sent in this phase.",
    displayName: "Abuse Signal Alert",
    notificationId: "security:alert:abuse-signal",
    notificationKey: "sec-alert-abuse-signal",
    requiredDataSources: ["security_audit_logs", "sec-abuse-detection-runtime"],
    runtimeStatus: "foundation",
    safetyNotes: "No notification dispatch or job creation runs from this definition.",
    severity: "high",
    sourceModule: "abuse",
    targetAudience: "super_admin"
  },
  {
    alertType: "login_alert",
    auditRequired: true,
    category: "Login",
    deliveryChannel: "in_app",
    description:
      "Foundation definition describing a suspicious login alert. Metadata only; no alert is sent in this phase.",
    displayName: "Suspicious Login Alert",
    notificationId: "security:alert:suspicious-login",
    notificationKey: "sec-alert-suspicious-login",
    requiredDataSources: ["security_audit_logs", "sec-login-monitoring-runtime"],
    runtimeStatus: "foundation",
    safetyNotes: "No notification dispatch or enqueue runs from this definition.",
    severity: "high",
    sourceModule: "login",
    targetAudience: "super_admin"
  },
  {
    alertType: "risk_alert",
    auditRequired: true,
    category: "Risk",
    deliveryChannel: "in_app",
    description:
      "Foundation definition describing a high-risk target alert. Metadata only; no alert is sent in this phase.",
    displayName: "High Risk Target Alert",
    notificationId: "security:alert:high-risk-target",
    notificationKey: "sec-alert-high-risk-target",
    requiredDataSources: ["security_audit_logs", "sec-risk-score-runtime"],
    runtimeStatus: "foundation",
    safetyNotes: "No notification dispatch or job creation runs from this definition.",
    severity: "high",
    sourceModule: "risk",
    targetAudience: "super_admin"
  },
  {
    alertType: "rate_limit_alert",
    auditRequired: true,
    category: "Rate Limit",
    deliveryChannel: "in_app",
    description:
      "Foundation definition describing a rate-limit breach alert. Metadata only; no alert is sent in this phase.",
    displayName: "Rate Limit Breach Alert",
    notificationId: "security:alert:rate-limit-breach",
    notificationKey: "sec-alert-rate-limit-breach",
    requiredDataSources: ["security_audit_logs", "sec-rate-limits-runtime"],
    runtimeStatus: "planned",
    safetyNotes: "No notification dispatch, enqueue, or rate-limit change runs from this definition.",
    severity: "medium",
    sourceModule: "rate_limit",
    targetAudience: "security_team"
  },
  {
    alertType: "fraud_alert",
    auditRequired: true,
    category: "Fraud",
    deliveryChannel: "email",
    description:
      "Foundation definition describing a fraud digest email to Super Admin. Metadata only; no email is sent in this phase.",
    displayName: "Fraud Digest Email",
    notificationId: "security:alert:fraud-digest-email",
    notificationKey: "sec-alert-fraud-digest-email",
    requiredDataSources: ["security_audit_logs", "sec-fraud-detection-runtime"],
    runtimeStatus: "planned",
    safetyNotes: "No email is sent and the certified Email/Notifications runtimes are not invoked from this definition.",
    severity: "medium",
    sourceModule: "fraud",
    targetAudience: "super_admin"
  },
  {
    alertType: "system_alert",
    auditRequired: true,
    category: "System",
    deliveryChannel: "webhook",
    description:
      "Foundation definition describing a security webhook alert to an external SIEM. Metadata only; no webhook is sent and no external service is called in this phase.",
    displayName: "Security Webhook Alert",
    notificationId: "security:alert:security-webhook",
    notificationKey: "sec-alert-security-webhook",
    requiredDataSources: ["security_audit_logs", "sec-security-events-runtime"],
    runtimeStatus: "reserved",
    safetyNotes: "No webhook dispatch or external service call runs from this definition.",
    severity: "high",
    sourceModule: "audit",
    targetAudience: "security_team"
  },
  {
    alertType: "system_alert",
    auditRequired: true,
    category: "System",
    deliveryChannel: "push",
    description:
      "Foundation definition describing a critical security push notification. Metadata only; no push notification is triggered in this phase.",
    displayName: "Critical Security Push",
    notificationId: "security:alert:critical-security-push",
    notificationKey: "sec-alert-critical-security-push",
    requiredDataSources: ["security_audit_logs", "sec-security-events-runtime"],
    runtimeStatus: "reserved",
    safetyNotes: "No push notification, dispatch, or job creation runs from this definition.",
    severity: "critical",
    sourceModule: "audit",
    targetAudience: "super_admin"
  }
] as const;

const SECURITY_ALERT_NOTIFICATION_CATEGORY_ORDER: readonly SecurityAlertNotificationCategory[] = [
  "Fraud",
  "Abuse",
  "Login",
  "Risk",
  "Rate Limit",
  "System"
] as const;

function finalizeAlertNotification(
  definition: SecurityAlertNotificationDefinition
): SecurityAlertNotification {
  return {
    alertType: definition.alertType,
    auditRequired: definition.auditRequired,
    category: definition.category,
    deliveryChannel: definition.deliveryChannel,
    description: definition.description,
    displayName: definition.displayName,
    enabled: false,
    metadataOnly: true,
    notificationId: definition.notificationId,
    notificationKey: definition.notificationKey,
    readOnly: true,
    requiredDataSources: [...definition.requiredDataSources],
    runtimeStatus: definition.runtimeStatus,
    safetyNotes: definition.safetyNotes,
    sendingAllowed: false,
    severity: definition.severity,
    source: SECURITY_ALERT_NOTIFICATIONS_SOURCE,
    sourceModule: definition.sourceModule,
    targetAudience: definition.targetAudience
  };
}

export function listSecurityAlertNotificationDefinitions(): SecurityAlertNotificationDefinition[] {
  return SECURITY_ALERT_NOTIFICATION_DEFINITIONS.map((definition) => ({
    ...definition,
    requiredDataSources: [...definition.requiredDataSources]
  }));
}

export function resolveSecurityAlertNotifications(): SecurityAlertNotification[] {
  return SECURITY_ALERT_NOTIFICATION_DEFINITIONS.map((definition) => finalizeAlertNotification(definition));
}

export function getSecurityAlertNotification(notificationKey: string): SecurityAlertNotification | null {
  const definition = SECURITY_ALERT_NOTIFICATION_DEFINITIONS.find(
    (entry) => entry.notificationKey === notificationKey
  );

  if (!definition) {
    return null;
  }

  return finalizeAlertNotification(definition);
}

export function securityAlertSeverityBadgeTone(severity: SecurityAlertSeverity) {
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

export function securityAlertStatusBadgeTone(status: SecurityAlertRuntimeStatus) {
  switch (status) {
    case "foundation":
      return "blue" as const;
    case "planned":
      return "amber" as const;
    case "reserved":
      return "slate" as const;
  }
}

export function buildSecurityAlertNotificationCategories(
  notifications: SecurityAlertNotification[]
): SecurityAlertNotificationCategoryGroup[] {
  const groups = new Map<SecurityAlertNotificationCategory, SecurityAlertNotification[]>();

  for (const notification of notifications) {
    const existing = groups.get(notification.category);

    if (existing) {
      existing.push(notification);
    } else {
      groups.set(notification.category, [notification]);
    }
  }

  return SECURITY_ALERT_NOTIFICATION_CATEGORY_ORDER.filter((category) => groups.has(category)).map(
    (category) => {
      const categoryNotifications = groups.get(category) ?? [];

      return {
        category,
        notificationKeys: categoryNotifications.map((notification) => notification.notificationKey),
        notifications: categoryNotifications
      };
    }
  );
}

export function getSecurityAlertNotificationsSummary(
  notifications: SecurityAlertNotification[]
): SecurityAlertNotificationsSummary {
  const foundationNotifications = notifications.filter(
    (notification) => notification.runtimeStatus === "foundation"
  ).length;
  const criticalNotifications = notifications.filter(
    (notification) => notification.severity === "critical"
  ).length;
  const highNotifications = notifications.filter((notification) => notification.severity === "high").length;
  const auditRequiredNotifications = notifications.filter((notification) => notification.auditRequired).length;
  const enabledNotifications = notifications.filter((notification) => notification.enabled).length;
  const sendingNotifications = notifications.filter((notification) => notification.sendingAllowed).length;
  const categoryCount = buildSecurityAlertNotificationCategories(notifications).length;
  const status: SecurityAlertNotificationsRuntimeState =
    enabledNotifications === 0 && sendingNotifications === 0 ? "alert_notifications_ready" : "needs_attention";

  return {
    auditRequiredNotifications,
    categoryCount,
    criticalNotifications,
    enabledNotifications,
    foundationNotifications,
    highNotifications,
    readOnly: true,
    registryKey: SECURITY_ALERT_NOTIFICATIONS_REGISTRY_KEY,
    registrySource: SECURITY_REGISTRY_SOURCE,
    sendingNotifications,
    source: SECURITY_ALERT_NOTIFICATIONS_SOURCE,
    status,
    summary: [
      `status ${status}`,
      `${notifications.length} alert notifications`,
      `${foundationNotifications} foundation`,
      `${criticalNotifications} critical`,
      `${highNotifications} high`,
      `${enabledNotifications} enabled`,
      `${sendingNotifications} sending`
    ].join("; "),
    totalNotifications: notifications.length
  };
}

export function validateSecurityAlertNotificationsRuntime(
  notifications: SecurityAlertNotification[]
): SecurityAlertNotificationsValidation {
  const issues: string[] = [];

  if (notifications.length !== SECURITY_ALERT_NOTIFICATION_DEFINITIONS.length) {
    issues.push("Security alert notifications runtime must include all SEC-26 notification definitions.");
  }

  const keys = new Set<string>();

  for (const notification of notifications) {
    if (notification.enabled !== false) {
      issues.push(`${notification.notificationKey} must remain disabled in this phase.`);
    }

    if (notification.sendingAllowed !== false) {
      issues.push(`${notification.notificationKey} must not allow sending in this phase.`);
    }

    if (notification.metadataOnly !== true || notification.readOnly !== true) {
      issues.push(`${notification.notificationKey} must remain metadata-only and read-only.`);
    }

    if (notification.source !== SECURITY_ALERT_NOTIFICATIONS_SOURCE) {
      issues.push(`${notification.notificationKey} must originate from the security alert notifications runtime.`);
    }

    if (!notification.auditRequired) {
      issues.push(`${notification.notificationKey} must require audit.`);
    }

    if (notification.requiredDataSources.length === 0) {
      issues.push(`${notification.notificationKey} must declare at least one required data source.`);
    }

    if (!notification.safetyNotes) {
      issues.push(`${notification.notificationKey} must declare safety notes.`);
    }

    if (keys.has(notification.notificationKey)) {
      issues.push(`Duplicate security alert notification key: ${notification.notificationKey}.`);
    }

    keys.add(notification.notificationKey);
  }

  return {
    isValid: issues.length === 0,
    issues
  };
}

export function buildSecurityAlertNotificationsLoadingState(): SecurityAlertNotificationsLoadingState {
  return {
    loading: true,
    message: "Loading the read-only Security alert notifications runtime from the security registry.",
    readOnly: true,
    source: SECURITY_ALERT_NOTIFICATIONS_SOURCE
  };
}

export function mapSecurityAlertNotificationToAdminComponent(notification: SecurityAlertNotification) {
  return {
    alertType: notification.alertType,
    auditRequired: notification.auditRequired,
    category: notification.category,
    deliveryChannel: notification.deliveryChannel,
    description: notification.description,
    displayName: notification.displayName,
    enabled: notification.enabled,
    metadataOnly: notification.metadataOnly,
    notificationId: notification.notificationId,
    notificationKey: notification.notificationKey,
    requiredDataSources: notification.requiredDataSources,
    runtimeStatus: notification.runtimeStatus,
    safetyNotes: notification.safetyNotes,
    sendingAllowed: notification.sendingAllowed,
    severity: notification.severity,
    sourceModule: notification.sourceModule,
    targetAudience: notification.targetAudience
  };
}

export function mapSecurityAlertNotificationsRuntimeToAdminFields() {
  const registryEntry = getSecurityRegistryEntry(SECURITY_ALERT_NOTIFICATIONS_REGISTRY_KEY);

  if (!registryEntry || registryEntry.visibility !== "super_admin") {
    return {
      categories: [] as ReturnType<typeof buildSecurityAlertNotificationCategories>,
      futureHook: null,
      notifications: [] as ReturnType<typeof mapSecurityAlertNotificationToAdminComponent>[],
      phaseNote: SECURITY_ALERT_NOTIFICATIONS_PHASE_NOTE,
      registry: null,
      summary: {
        auditRequiredNotifications: 0,
        categoryCount: 0,
        criticalNotifications: 0,
        enabledNotifications: 0,
        foundationNotifications: 0,
        highNotifications: 0,
        readOnly: true as const,
        registryKey: SECURITY_ALERT_NOTIFICATIONS_REGISTRY_KEY,
        registrySource: SECURITY_REGISTRY_SOURCE,
        sendingNotifications: 0,
        source: SECURITY_ALERT_NOTIFICATIONS_SOURCE,
        status: "needs_attention" as const,
        summary: "The advanced security center is not registered as a super-admin module in the security registry.",
        totalNotifications: 0
      }
    };
  }

  const notifications = resolveSecurityAlertNotifications();
  const validation = validateSecurityAlertNotificationsRuntime(notifications);
  const summary = getSecurityAlertNotificationsSummary(notifications);
  const futureHook = getSecurityFutureHook(SECURITY_ALERT_NOTIFICATIONS_FUTURE_HOOK_KEY);

  return {
    categories: buildSecurityAlertNotificationCategories(notifications),
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
    notifications: notifications.map(mapSecurityAlertNotificationToAdminComponent),
    phaseNote: SECURITY_ALERT_NOTIFICATIONS_PHASE_NOTE,
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
          summary: "Security alert notifications validation requires safe metadata-only defaults."
        }
  };
}

export async function loadSecurityAlertNotificationsReadOnlySafe() {
  return mapSecurityAlertNotificationsRuntimeToAdminFields();
}
