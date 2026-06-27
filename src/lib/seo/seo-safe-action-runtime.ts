import "server-only";

export type SeoSafeActionId =
  | "export_report_placeholder"
  | "generate_sitemap_placeholder"
  | "mark_reviewed_placeholder"
  | "preview_seo"
  | "validate_robots_placeholder"
  | "validate_schema_placeholder"
  | "validate_sitemap_placeholder";

export type SeoSafeActionStatus = "available" | "blocked" | "placeholder";

export type SeoSafeActionSource = "seo_safe_action_runtime";

export type SeoSafeAction = {
  description: string;
  destructive: false;
  id: SeoSafeActionId;
  implemented: boolean;
  label: string;
  requiresConfirmation: false;
  source: SeoSafeActionSource;
  status: SeoSafeActionStatus;
};

export type SeoSafeActionRuntimeStatus = "action_ready" | "invalid" | "placeholder";

export type SeoSafeActionSummary = {
  readOnly: true;
  runtimeStatus: SeoSafeActionRuntimeStatus;
  summary: string;
};

export type SeoSafeActionValidation = {
  action: SeoSafeAction | null;
  isValid: boolean;
  issues: string[];
};

export const SEO_SAFE_ACTION_SOURCE = "seo_safe_action_runtime" as const;

export const SEO_PAGE_SAFE_ACTION_IDS = ["preview_seo", "mark_reviewed_placeholder"] as const;

export const SEO_SITEMAP_SAFE_ACTION_IDS = [
  "generate_sitemap_placeholder",
  "validate_sitemap_placeholder"
] as const;

export const SEO_ROBOTS_SAFE_ACTION_IDS = ["validate_robots_placeholder"] as const;

export const SEO_SCHEMA_SAFE_ACTION_IDS = ["validate_schema_placeholder"] as const;

export const SEO_EXPORT_SAFE_ACTION_IDS = ["export_report_placeholder"] as const;

const SEO_SAFE_ACTION_DEFINITIONS: readonly Omit<SeoSafeAction, "status">[] = [
  {
    description:
      "Read-only SEO preview action. Does not modify SEO metadata, routes, or tenant content.",
    destructive: false,
    id: "preview_seo",
    implemented: true,
    label: "Preview SEO",
    requiresConfirmation: false,
    source: SEO_SAFE_ACTION_SOURCE
  },
  {
    description:
      "Non-destructive review placeholder. Does not persist reviewed state or modify SEO data.",
    destructive: false,
    id: "mark_reviewed_placeholder",
    implemented: false,
    label: "Mark reviewed",
    requiresConfirmation: false,
    source: SEO_SAFE_ACTION_SOURCE
  },
  {
    description:
      "Read-only sitemap validation placeholder. Does not regenerate sitemap.xml or modify routes.",
    destructive: false,
    id: "validate_sitemap_placeholder",
    implemented: false,
    label: "Validate sitemap",
    requiresConfirmation: false,
    source: SEO_SAFE_ACTION_SOURCE
  },
  {
    description:
      "Read-only robots validation placeholder. Does not modify robots.txt or crawl rules.",
    destructive: false,
    id: "validate_robots_placeholder",
    implemented: false,
    label: "Validate robots",
    requiresConfirmation: false,
    source: SEO_SAFE_ACTION_SOURCE
  },
  {
    description:
      "Read-only structured data validation placeholder. Does not modify schema output or page metadata.",
    destructive: false,
    id: "validate_schema_placeholder",
    implemented: false,
    label: "Validate schema",
    requiresConfirmation: false,
    source: SEO_SAFE_ACTION_SOURCE
  },
  {
    description:
      "Non-destructive sitemap generation placeholder. Does not regenerate sitemap.xml in this phase.",
    destructive: false,
    id: "generate_sitemap_placeholder",
    implemented: false,
    label: "Generate placeholder",
    requiresConfirmation: false,
    source: SEO_SAFE_ACTION_SOURCE
  },
  {
    description:
      "Read-only SEO report export placeholder. Does not generate downloadable files in this phase.",
    destructive: false,
    id: "export_report_placeholder",
    implemented: false,
    label: "Export placeholder",
    requiresConfirmation: false,
    source: SEO_SAFE_ACTION_SOURCE
  }
] as const;

function resolveSafeActionStatus(action: Omit<SeoSafeAction, "status">): SeoSafeActionStatus {
  if (!action.implemented) {
    return "placeholder";
  }

  return "available";
}

function buildSeoSafeAction(action: Omit<SeoSafeAction, "status">): SeoSafeAction {
  return {
    ...action,
    status: resolveSafeActionStatus(action)
  };
}

export function listSeoSafeActions(): SeoSafeAction[] {
  return SEO_SAFE_ACTION_DEFINITIONS.map((action) => buildSeoSafeAction(action));
}

export function getSeoSafeActionById(actionId: string): SeoSafeAction | null {
  const action = listSeoSafeActions().find((item) => item.id === actionId);
  return action ?? null;
}

export function validateSeoSafeAction(actionId: string): SeoSafeActionValidation {
  const action = getSeoSafeActionById(actionId);
  const issues: string[] = [];

  if (!action) {
    return {
      action: null,
      isValid: false,
      issues: ["Unknown SEO safe action id."]
    };
  }

  if (action.destructive !== false) {
    issues.push("SEO safe actions must remain non-destructive.");
  }

  if (action.requiresConfirmation !== false) {
    issues.push("SEO safe actions must not require confirmation in this phase.");
  }

  if (action.source !== SEO_SAFE_ACTION_SOURCE) {
    issues.push("SEO safe actions must originate from the safe action runtime.");
  }

  if (!action.label.trim() || !action.description.trim()) {
    issues.push("SEO safe actions must include a label and description.");
  }

  return {
    action,
    isValid: issues.length === 0,
    issues
  };
}

export function getSeoSafeActionRuntimeStatus(actions: SeoSafeAction[]): SeoSafeActionRuntimeStatus {
  const validations = actions.map((action) => validateSeoSafeAction(action.id));

  if (validations.some((validation) => !validation.isValid)) {
    return "invalid";
  }

  if (actions.some((action) => !action.implemented)) {
    return "placeholder";
  }

  return "action_ready";
}

export function getSeoSafeActionSummary(actions: SeoSafeAction[]): SeoSafeActionSummary {
  const runtimeStatus = getSeoSafeActionRuntimeStatus(actions);
  const implementedCount = actions.filter((action) => action.implemented).length;
  const placeholderCount = actions.filter((action) => !action.implemented).length;

  return {
    readOnly: true,
    runtimeStatus,
    summary: [
      `${actions.length} safe action(s)`,
      `${implementedCount} implemented`,
      `${placeholderCount} placeholder`,
      "all non-destructive"
    ].join("; ")
  };
}

export function mapSeoSafeActionRuntimeToAdminFields() {
  const actions = listSeoSafeActions();
  const summary = getSeoSafeActionSummary(actions);
  const byId = Object.fromEntries(actions.map((action) => [action.id, action])) as Record<
    SeoSafeActionId,
    SeoSafeAction
  >;

  return {
    actions,
    byId,
    readOnly: true as const,
    runtimeStatus: summary.runtimeStatus,
    summary: summary.summary
  };
}

// SEO-23+ placeholders: real export, editor, AI generation, and persistence stay disconnected.
export const SEO_SAFE_ACTION_FUTURE_HOOKS = [
  "seo_action_persistence",
  "seo_editor",
  "seo_ai_generator"
] as const;
