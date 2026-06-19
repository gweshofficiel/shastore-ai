import "server-only";

import {
  getMarketingStatusLabel,
  parseMarketingStatus,
  type MarketingStatus
} from "@/src/lib/marketing/marketing-status-runtime";

export type MarketingLifecycleAction =
  | "activate"
  | "archive"
  | "create_draft"
  | "pause"
  | "view_usage";

export type MarketingLifecycleActionDefinition = {
  action: MarketingLifecycleAction;
  description: string;
  foundationOnly: true;
  label: string;
  ready: boolean;
};

export type MarketingCampaignLifecycleView = {
  actions: MarketingLifecycleActionDefinition[];
  availableActions: MarketingLifecycleAction[];
  lifecycleDescription: string;
  lifecycleLabel: string;
  lifecycleState: MarketingStatus;
};

export const MARKETING_LIFECYCLE_ACTIONS: readonly MarketingLifecycleAction[] = [
  "create_draft",
  "pause",
  "activate",
  "archive",
  "view_usage"
] as const;

const lifecycleDescriptions: Record<MarketingStatus, string> = {
  active: "Active lifecycle foundation. No sending, redemption, payout, or analytics execution.",
  archived: "Archived lifecycle foundation. Historical Super Admin reference only.",
  draft: "Draft lifecycle foundation. Safe for internal review without public execution.",
  expired: "Expired lifecycle foundation. Requires review before any future activation.",
  paused: "Paused lifecycle foundation. Temporarily suspended without data mutation."
};

const actionLabels: Record<MarketingLifecycleAction, string> = {
  activate: "Activate",
  archive: "Archive",
  create_draft: "Create draft",
  pause: "Pause",
  view_usage: "View usage"
};

const actionDescriptions: Record<MarketingLifecycleAction, string> = {
  activate: "Placeholder activation only. Records a monitoring event. No campaign sending.",
  archive: "Placeholder archive only. Records a monitoring event. No deletion or payout changes.",
  create_draft: "Placeholder draft action only. Records a monitoring event. No registry mutation.",
  pause: "Placeholder pause only. Records a monitoring event. No delivery interruption.",
  view_usage: "Placeholder usage review only. Records a monitoring event. No analytics engine."
};

const availableActionsByStatus: Record<MarketingStatus, MarketingLifecycleAction[]> = {
  active: ["pause", "archive", "view_usage"],
  archived: ["view_usage"],
  draft: ["create_draft", "activate", "archive", "view_usage"],
  expired: ["create_draft", "archive", "view_usage"],
  paused: ["activate", "archive", "view_usage"]
};

function text(value: unknown, maxLength = 500) {
  if (typeof value !== "string") return "";

  return value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/\bjavascript:/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function getMarketingLifecycleLabel(status: MarketingStatus) {
  return `${getMarketingStatusLabel(status)} lifecycle`;
}

export function getMarketingLifecycleDescription(status: MarketingStatus) {
  return lifecycleDescriptions[status];
}

export function listMarketingLifecycleActionsForStatus(status: MarketingStatus): MarketingLifecycleAction[] {
  return [...(availableActionsByStatus[status] ?? MARKETING_LIFECYCLE_ACTIONS)];
}

export function isMarketingLifecycleActionReady(
  status: MarketingStatus,
  action: MarketingLifecycleAction
): boolean {
  return listMarketingLifecycleActionsForStatus(status).includes(action);
}

function buildLifecycleActionDefinition(
  status: MarketingStatus,
  action: MarketingLifecycleAction
): MarketingLifecycleActionDefinition {
  const ready = isMarketingLifecycleActionReady(status, action);

  return {
    action,
    description: ready
      ? actionDescriptions[action]
      : `${actionDescriptions[action]} Not lifecycle-ready in ${getMarketingStatusLabel(status).toLowerCase()} state.`,
    foundationOnly: true,
    label: actionLabels[action],
    ready
  };
}

export function resolveMarketingCampaignLifecycleView(status: unknown): MarketingCampaignLifecycleView {
  const lifecycleState = parseMarketingStatus(status) ?? "draft";
  const availableActions = listMarketingLifecycleActionsForStatus(lifecycleState);

  return {
    actions: MARKETING_LIFECYCLE_ACTIONS.map((action) =>
      buildLifecycleActionDefinition(lifecycleState, action)
    ),
    availableActions,
    lifecycleDescription: parseMarketingStatus(status)
      ? lifecycleDescriptions[lifecycleState]
      : "Lifecycle state could not be resolved. Showing safe draft foundation defaults.",
    lifecycleLabel: parseMarketingStatus(status)
      ? getMarketingLifecycleLabel(lifecycleState)
      : "Unknown lifecycle",
    lifecycleState
  };
}

export function getMarketingLifecycleActionLabel(action: MarketingLifecycleAction) {
  return actionLabels[action];
}

export function getMarketingLifecycleActionDescription(action: MarketingLifecycleAction) {
  return actionDescriptions[action];
}

export function resolveMarketingLifecycleActionReadiness(params: {
  action: MarketingLifecycleAction;
  status: unknown;
}) {
  const lifecycle = resolveMarketingCampaignLifecycleView(params.status);
  const definition = lifecycle.actions.find((entry) => entry.action === params.action);

  return (
    definition ?? {
      action: params.action,
      description: getMarketingLifecycleActionDescription(params.action),
      foundationOnly: true as const,
      label: getMarketingLifecycleActionLabel(params.action),
      ready: false
    }
  );
}

export function sanitizeMarketingLifecycleNote(value: unknown) {
  const cleaned = text(value, 240);
  return cleaned || "Lifecycle foundation only.";
}
