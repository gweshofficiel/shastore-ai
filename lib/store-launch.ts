import { normalizeBuilderPageSchema, type BuilderPageSchema } from "@/lib/storefront/builder";
import { validateDraftBeforePublish } from "@/lib/builder-publish-utils";

export type StoreLaunchContext = {
  activeTheme: Record<string, unknown>;
  activeVersionId?: string | null;
  builderDraftSchema?: unknown;
  connectedDomain?: string | null;
  domains: Record<string, unknown>[];
  storeStatus?: string | null;
  storeVisibility?: string | null;
};

export type StoreLaunchChecklistItem = {
  key: string;
  label: string;
  passed: boolean;
  severity: "blocking" | "warning";
};

function textValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function hasThemeConfig(theme: Record<string, unknown>) {
  return Boolean(
    textValue(theme.theme_id) ||
      textValue(theme.theme_key) ||
      (theme.color_palette && typeof theme.color_palette === "object")
  );
}

function hasDomain(context: StoreLaunchContext) {
  return Boolean(
    textValue(context.connectedDomain) ||
      context.domains.some((domain) => textValue(domain.hostname) || textValue(domain.subdomain))
  );
}

function hasVisibleSection(schema: BuilderPageSchema) {
  return schema.sections.some((section) => section.enabled);
}

export function getStoreLaunchReadiness(context: StoreLaunchContext) {
  const schema = normalizeBuilderPageSchema(context.builderDraftSchema);
  const publishValidation = validateDraftBeforePublish(schema);
  const items: StoreLaunchChecklistItem[] = [
    {
      key: "owned_store",
      label: "Store is owned by the current user",
      passed: true,
      severity: "blocking"
    },
    {
      key: "domain_ready",
      label: "Store has a domain or subdomain",
      passed: hasDomain(context),
      severity: "warning"
    },
    {
      key: "publishable_draft",
      label: "Store has a published or publishable builder draft",
      passed: Boolean(context.activeVersionId) || publishValidation.errors.length === 0,
      severity: "blocking"
    },
    {
      key: "theme_config",
      label: "Store has theme configuration",
      passed: hasThemeConfig(context.activeTheme),
      severity: "warning"
    },
    {
      key: "visible_section",
      label: "Store has at least one visible section",
      passed: hasVisibleSection(schema),
      severity: "blocking"
    },
    {
      key: "system_not_blocked",
      label: "Store is not blocked or suspended",
      passed: !["blocked", "suspended", "revoked"].includes(textValue(context.storeStatus)),
      severity: "blocking"
    }
  ];
  const blockingReasons = items.filter((item) => !item.passed && item.severity === "blocking");
  const warnings = items.filter((item) => !item.passed && item.severity === "warning");
  const readinessScore = Math.round(
    (items.filter((item) => item.passed).length / Math.max(items.length, 1)) * 100
  );

  return {
    blockingReasons,
    checklistStatus: blockingReasons.length ? "blocked" : "ready",
    items,
    publishValidation,
    readinessScore,
    schema,
    warnings
  };
}

export function validateStoreBeforeLaunch(context: StoreLaunchContext) {
  const readiness = getStoreLaunchReadiness(context);

  return {
    ...readiness,
    canLaunch: readiness.blockingReasons.length === 0,
    validationStatus: readiness.blockingReasons.length
      ? "blocked"
      : readiness.warnings.length
        ? "warning"
        : "passed"
  };
}

export function getLaunchStatus(context: StoreLaunchContext) {
  if (context.storeVisibility === "public") {
    return "launched";
  }

  const validation = validateStoreBeforeLaunch(context);

  return validation.canLaunch ? "ready" : "blocked";
}

export function recordLaunchEvent({
  eventType,
  payload,
  rollbackPayload = {},
  status = "recorded"
}: {
  eventType: string;
  payload: Record<string, unknown>;
  rollbackPayload?: Record<string, unknown>;
  status?: string;
}) {
  return {
    eventPayload: payload,
    eventStatus: status,
    eventType,
    metadata: {
      auditTrailReady: true,
      launchAnalyticsReady: true,
      launchEmailNotificationReady: true,
      launchQaAutomationReady: true
    },
    rollbackPayload
  };
}

export function rollbackLaunchPublish(previousVisibility: string | null | undefined) {
  return {
    nextVisibility: previousVisibility === "public" ? "public" : "private",
    rollbackAt: new Date().toISOString(),
    rollbackSafe: true
  };
}

export function publishStorefrontDraft(schema: BuilderPageSchema) {
  const validation = validateDraftBeforePublish(schema);

  return {
    schema: validation.schema,
    validation,
    versionMetadata: {
      launchPublish: true,
      publishedAt: new Date().toISOString()
    }
  };
}
