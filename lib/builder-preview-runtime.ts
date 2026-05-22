import {
  normalizeBuilderPageSchema,
  type BuilderPageSchema,
  type BuilderResponsiveMode
} from "@/lib/storefront/builder";

const supportedModes = new Set(["desktop", "tablet", "mobile"]);

function now() {
  return new Date().toISOString();
}

function modeValue(value: unknown): BuilderResponsiveMode {
  return supportedModes.has(String(value)) ? (value as BuilderResponsiveMode) : "desktop";
}

function stablePreviewKey(schema: BuilderPageSchema, mode: BuilderResponsiveMode) {
  return [
    "draft-preview",
    mode,
    schema.version,
    schema.sections.length,
    schema.sections.map((section) => `${section.id}:${section.type}:${section.order}:${section.enabled}`).join("|")
  ].join(":");
}

export function validatePreviewSchema(value: unknown) {
  const schema = normalizeBuilderPageSchema(value);
  const errors: string[] = [];

  if (!schema.sections.length) {
    errors.push("Preview schema must include at least one draft section.");
  }

  if (schema.sections.some((section) => !section.id || !section.type)) {
    errors.push("Preview sections must have stable ids and supported types.");
  }

  return {
    errors,
    hydrationSafe: errors.length === 0,
    schema
  };
}

export function isolatePreviewRendering(schema: BuilderPageSchema, mode: BuilderResponsiveMode = "desktop") {
  const normalized = normalizeBuilderPageSchema(schema);
  const responsiveMode = modeValue(mode);
  const sections = normalized.sections
    .filter((section) => section.enabled)
    .sort((left, right) => left.order - right.order)
    .map((section) => ({
      id: section.id,
      order: section.order,
      props: {
        ...section.props,
        responsive: section.responsive[responsiveMode] ?? {}
      },
      type: section.type
    }));

  return {
    draftOnly: true,
    isolatedAt: now(),
    mode: responsiveMode,
    publishedMutationAllowed: false,
    renderTree: {
      layoutTree: normalized.layoutTree,
      sections
    },
    sectionCount: sections.length
  };
}

export function resolvePreviewRuntime({
  mode,
  schema,
  source = "manual_refresh"
}: {
  mode?: unknown;
  schema: unknown;
  source?: string;
}) {
  const previewMode = modeValue(mode);
  const validation = validatePreviewSchema(schema);
  const isolated = isolatePreviewRendering(validation.schema, previewMode);
  const resolvedAt = now();

  return {
    cacheKey: stablePreviewKey(validation.schema, previewMode),
    errorState: {
      errors: validation.errors,
      fallbackReady: validation.errors.length > 0
    },
    hydrationState: {
      hydrationSafe: validation.hydrationSafe,
      previewSafeHydration: true,
      resolvedAt
    },
    isolationState: {
      draftOnly: true,
      hostnameRoutingUnchanged: true,
      isolatedRendering: true,
      publishedStorefrontUntouched: true
    },
    renderTree: isolated.renderTree,
    responsiveState: {
      activeMode: previewMode,
      responsiveRuntime: true
    },
    runtimeSchema: validation.schema,
    runtimeStatus: validation.errors.length ? "fallback" : "ready",
    syncSource: source,
    syncedAt: resolvedAt
  };
}

export function syncDraftPreview({
  mode,
  schema,
  source = "draft_change"
}: {
  mode?: unknown;
  schema: unknown;
  source?: string;
}) {
  const runtime = resolvePreviewRuntime({ mode, schema, source });

  return {
    ...runtime,
    syncState: {
      cachePrepared: true,
      lastSyncAt: runtime.syncedAt,
      previewSyncPending: false,
      source
    }
  };
}

export function refreshPreviewState({
  mode,
  previousState,
  schema
}: {
  mode?: unknown;
  previousState?: Record<string, unknown>;
  schema: unknown;
}) {
  const runtime = syncDraftPreview({ mode, schema, source: "manual_refresh" });

  return {
    ...runtime,
    previousStatus: previousState?.runtime_status ?? previousState?.runtimeStatus ?? "unknown",
    refreshedAt: now()
  };
}

export function createPreviewSession({
  mode,
  schema,
  source = "manual_refresh"
}: {
  mode?: unknown;
  schema: unknown;
  source?: string;
}) {
  const runtime = syncDraftPreview({ mode, schema, source });

  return {
    hydrationState: runtime.hydrationState,
    isolationState: runtime.isolationState,
    metadata: {
      future: [
        "realtime_collaborative_preview",
        "preview_sharing",
        "ai_visual_editing",
        "visual_animations",
        "mobile_preview_mirroring",
        "preview_performance_optimization"
      ],
      source
    },
    previewMode: runtime.responsiveState.activeMode,
    sessionStatus: runtime.runtimeStatus === "ready" ? "active" : "error",
    syncState: runtime.syncState
  };
}
