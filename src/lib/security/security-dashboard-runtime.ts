import "server-only";

import {
  SECURITY_REGISTRY_SOURCE,
  resolveSecurityRegistryEntries,
  type SecurityImplementationStatus,
  type SecurityRegistryCategory,
  type SecurityRegistryEntry,
  type SecurityRegistryVisibility,
  type SecurityRuntimeStatus
} from "@/src/lib/security/security-registry-runtime";

export type SecurityDashboardSource = "security_dashboard_runtime";

export type SecurityDashboardCardState =
  | "active"
  | "disabled"
  | "future"
  | "partial"
  | "placeholder"
  | "ready";

export type SecurityDashboardSectionKey =
  | "access-monitoring"
  | "audit"
  | "events"
  | "governance"
  | "platform"
  | "risk-intelligence"
  | "security-center"
  | "threat-detection";

export type SecurityDashboardStatus = "dashboard_ready" | "load_error" | "needs_attention";

export type SecurityDashboardSectionDefinition = {
  description: string;
  key: SecurityDashboardSectionKey;
  title: string;
};

export type SecurityDashboardCard = {
  auditEnabled: boolean;
  cardState: SecurityDashboardCardState;
  category: SecurityRegistryCategory;
  dependencies: string[];
  description: string;
  displayName: string;
  emptyState: string | null;
  featureFlags: string[];
  implementationStatus: SecurityImplementationStatus;
  key: string;
  permissions: string[];
  route: string;
  runtimeStatus: SecurityRuntimeStatus;
  sectionKey: SecurityDashboardSectionKey;
  supportedActions: string[];
  telemetryEnabled: boolean;
  visibility: SecurityRegistryVisibility;
};

export type SecurityDashboardSection = {
  cardCount: number;
  cards: SecurityDashboardCard[];
  description: string;
  key: SecurityDashboardSectionKey;
  title: string;
};

export type SecurityDashboardMetrics = {
  activeModules: number;
  auditEnabledModules: number;
  disabledModules: number;
  futureModules: number;
  partialModules: number;
  placeholderModules: number;
  readyModules: number;
  telemetryEnabledModules: number;
  totalModules: number;
  visibleModules: number;
};

export type SecurityDashboardSummary = {
  loadError: string | null;
  metrics: SecurityDashboardMetrics;
  readOnly: true;
  registrySource: typeof SECURITY_REGISTRY_SOURCE;
  sectionCount: number;
  source: SecurityDashboardSource;
  status: SecurityDashboardStatus;
  summary: string;
};

export type SecurityDashboardStat = {
  label: string;
  value: string;
};

export type SecurityDashboardRuntimeInput = {
  loadError: string | null;
};

export type SecurityDashboardLoadingState = {
  loading: true;
  message: string;
  readOnly: true;
  source: SecurityDashboardSource;
};

export const SECURITY_DASHBOARD_SOURCE = "security_dashboard_runtime" as const;

export const SECURITY_DASHBOARD_DEFAULT_INPUT: SecurityDashboardRuntimeInput = {
  loadError: null
};

const SECURITY_DASHBOARD_SECTIONS: readonly SecurityDashboardSectionDefinition[] = [
  {
    description: "Aggregated Super Admin security overview registered in the security runtime.",
    key: "security-center",
    title: "Security Center"
  },
  {
    description: "Audit and compliance modules registered in the security runtime.",
    key: "audit",
    title: "Audit & Compliance"
  },
  {
    description: "Login, IP, and device monitoring modules registered in the security runtime.",
    key: "access-monitoring",
    title: "Access Monitoring"
  },
  {
    description: "Abuse, fraud, and rate-limit modules registered in the security runtime.",
    key: "threat-detection",
    title: "Threat Detection"
  },
  {
    description: "Risk score and risk level modules registered in the security runtime.",
    key: "risk-intelligence",
    title: "Risk Intelligence"
  },
  {
    description: "Security event modules registered in the security runtime.",
    key: "events",
    title: "Security Events"
  },
  {
    description: "Safe security action and governance modules registered in the security runtime.",
    key: "governance",
    title: "Security Governance"
  },
  {
    description: "Reserved security platform and future-hook modules registered in the security runtime.",
    key: "platform",
    title: "Security Platform"
  }
] as const;

const CATEGORY_TO_SECTION: Record<SecurityRegistryCategory, SecurityDashboardSectionKey> = {
  "Access Monitoring": "access-monitoring",
  "Audit & Compliance": "audit",
  "Risk Intelligence": "risk-intelligence",
  "Security Center": "security-center",
  "Security Events": "events",
  "Security Governance": "governance",
  "Security Platform": "platform",
  "Threat Detection": "threat-detection"
};

export function resolveSecurityDashboardSectionKey(entry: SecurityRegistryEntry): SecurityDashboardSectionKey {
  return CATEGORY_TO_SECTION[entry.category] ?? "platform";
}

export function resolveSecurityDashboardCardState(entry: SecurityRegistryEntry): SecurityDashboardCardState {
  if (entry.visibility === "hidden") {
    return "disabled";
  }

  if (entry.implementationStatus === "planned" || entry.runtimeStatus === "planned") {
    return "future";
  }

  if (entry.implementationStatus === "architectural" || entry.runtimeStatus === "review_required") {
    return "placeholder";
  }

  if (entry.implementationStatus === "production_ready") {
    if (entry.runtimeStatus === "active") {
      return "active";
    }

    if (entry.runtimeStatus === "monitoring") {
      return "ready";
    }

    return "ready";
  }

  return "partial";
}

export function resolveSecurityDashboardEmptyState(cardState: SecurityDashboardCardState): string | null {
  switch (cardState) {
    case "placeholder":
      return "No security data is implemented yet. This module is an architectural placeholder pending future Security Runtime phases.";
    case "future":
      return "Reserved future security hook. No runtime data is available yet.";
    case "disabled":
      return "This security module is disabled and is not surfaced in the dashboard runtime.";
    case "partial":
      return "This security module is registered but its runtime data is not fully implemented yet.";
    case "active":
    case "ready":
      return null;
  }
}

export function securityDashboardCardStateLabel(cardState: SecurityDashboardCardState) {
  switch (cardState) {
    case "active":
      return "Active";
    case "disabled":
      return "Disabled";
    case "future":
      return "Future";
    case "partial":
      return "Partial";
    case "placeholder":
      return "Placeholder";
    case "ready":
      return "Ready";
  }
}

export function securityDashboardCardStateBadgeTone(cardState: SecurityDashboardCardState) {
  switch (cardState) {
    case "active":
    case "ready":
      return "green" as const;
    case "partial":
      return "blue" as const;
    case "placeholder":
      return "amber" as const;
    case "future":
      return "slate" as const;
    case "disabled":
      return "slate" as const;
  }
}

export function mapSecurityRegistryEntryToDashboardCard(entry: SecurityRegistryEntry): SecurityDashboardCard {
  const cardState = resolveSecurityDashboardCardState(entry);

  return {
    auditEnabled: entry.auditEnabled,
    cardState,
    category: entry.category,
    dependencies: [...entry.dependencies],
    description: entry.description,
    displayName: entry.displayName,
    emptyState: resolveSecurityDashboardEmptyState(cardState),
    featureFlags: [...entry.featureFlags],
    implementationStatus: entry.implementationStatus,
    key: entry.key,
    permissions: [...entry.permissions],
    route: entry.route,
    runtimeStatus: entry.runtimeStatus,
    sectionKey: resolveSecurityDashboardSectionKey(entry),
    supportedActions: [...entry.supportedActions],
    telemetryEnabled: entry.telemetryEnabled,
    visibility: entry.visibility
  };
}

export function buildSecurityDashboardCards(entries: SecurityRegistryEntry[]): SecurityDashboardCard[] {
  return entries.map(mapSecurityRegistryEntryToDashboardCard);
}

export function buildSecurityDashboardSections(entries: SecurityRegistryEntry[]): SecurityDashboardSection[] {
  const cards = buildSecurityDashboardCards(entries);

  return SECURITY_DASHBOARD_SECTIONS.map((section) => {
    const sectionCards = cards.filter((card) => card.sectionKey === section.key);

    return {
      cardCount: sectionCards.length,
      cards: sectionCards,
      description: section.description,
      key: section.key,
      title: section.title
    };
  }).filter((section) => section.cardCount > 0);
}

export function buildSecurityDashboardMetrics(entries: SecurityRegistryEntry[]): SecurityDashboardMetrics {
  const cards = buildSecurityDashboardCards(entries);

  return {
    activeModules: cards.filter((card) => card.cardState === "active").length,
    auditEnabledModules: cards.filter((card) => card.auditEnabled).length,
    disabledModules: cards.filter((card) => card.cardState === "disabled").length,
    futureModules: cards.filter((card) => card.cardState === "future").length,
    partialModules: cards.filter((card) => card.cardState === "partial").length,
    placeholderModules: cards.filter((card) => card.cardState === "placeholder").length,
    readyModules: cards.filter((card) => card.cardState === "ready").length,
    telemetryEnabledModules: cards.filter((card) => card.telemetryEnabled).length,
    totalModules: cards.length,
    visibleModules: cards.filter((card) => card.visibility !== "hidden").length
  };
}

export function getSecurityDashboardSummary(
  entries: SecurityRegistryEntry[],
  input: SecurityDashboardRuntimeInput
): SecurityDashboardSummary {
  const metrics = buildSecurityDashboardMetrics(entries);
  const sections = buildSecurityDashboardSections(entries);
  const status: SecurityDashboardStatus = input.loadError
    ? "load_error"
    : metrics.placeholderModules > 0
      ? "needs_attention"
      : "dashboard_ready";

  return {
    loadError: input.loadError,
    metrics,
    readOnly: true,
    registrySource: SECURITY_REGISTRY_SOURCE,
    sectionCount: sections.length,
    source: SECURITY_DASHBOARD_SOURCE,
    status,
    summary: input.loadError
      ? `status load_error; ${input.loadError}`
      : [
          `status ${status}`,
          `${metrics.totalModules} security modules`,
          `${metrics.activeModules} active`,
          `${metrics.readyModules} ready`,
          `${metrics.partialModules} partial`,
          `${metrics.placeholderModules} placeholder`,
          `${metrics.futureModules} future`
        ].join("; ")
  };
}

export function buildSecurityDashboardStats(summary: SecurityDashboardSummary): SecurityDashboardStat[] {
  return [
    { label: "Security modules", value: String(summary.metrics.totalModules) },
    { label: "Active", value: String(summary.metrics.activeModules) },
    { label: "Ready", value: String(summary.metrics.readyModules) },
    { label: "Partial", value: String(summary.metrics.partialModules) },
    { label: "Placeholder", value: String(summary.metrics.placeholderModules) },
    { label: "Future", value: String(summary.metrics.futureModules) },
    { label: "Audit enabled", value: String(summary.metrics.auditEnabledModules) },
    { label: "Telemetry enabled", value: String(summary.metrics.telemetryEnabledModules) }
  ];
}

export function buildSecurityDashboardLoadingState(): SecurityDashboardLoadingState {
  return {
    loading: true,
    message: "Loading the read-only Security dashboard runtime from the security registry.",
    readOnly: true,
    source: SECURITY_DASHBOARD_SOURCE
  };
}

export function mapSecurityDashboardRuntimeToAdminFields(
  input: SecurityDashboardRuntimeInput = SECURITY_DASHBOARD_DEFAULT_INPUT
) {
  const entries = resolveSecurityRegistryEntries();
  const summary = getSecurityDashboardSummary(entries, input);
  const sections = buildSecurityDashboardSections(entries);

  return {
    dashboard: summary,
    dashboardSections: sections,
    dashboardStats: buildSecurityDashboardStats(summary)
  };
}

export async function loadSecurityDashboardReadOnlySafe(
  input: SecurityDashboardRuntimeInput = SECURITY_DASHBOARD_DEFAULT_INPUT
) {
  return mapSecurityDashboardRuntimeToAdminFields(input);
}
