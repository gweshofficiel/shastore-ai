import {
  normalizeBuilderPageSchema,
  type BuilderPageSchema,
  type BuilderResponsiveMode,
  type BuilderSectionSchema
} from "@/lib/storefront/builder";

export const responsiveBuilderModes: BuilderResponsiveMode[] = ["desktop", "tablet", "mobile"];

export const responsiveBreakpoints: Record<
  BuilderResponsiveMode,
  { height: number; label: string; maxWidth: number }
> = {
  desktop: { height: 720, label: "Desktop", maxWidth: 1280 },
  mobile: { height: 760, label: "Mobile", maxWidth: 390 },
  tablet: { height: 820, label: "Tablet", maxWidth: 768 }
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function getResponsiveBuilderMode(value: unknown): BuilderResponsiveMode {
  return value === "tablet" || value === "mobile" ? value : "desktop";
}

export function resolveResponsiveSectionConfig(
  section: BuilderSectionSchema,
  mode: BuilderResponsiveMode
) {
  return {
    ...section.props,
    ...(isRecord(section.responsive.desktop) ? section.responsive.desktop : {}),
    ...(mode !== "desktop" && isRecord(section.responsive[mode]) ? section.responsive[mode] : {}),
    responsiveMode: mode
  };
}

export function applyResponsiveLayoutOverride(
  schema: BuilderPageSchema,
  mode: BuilderResponsiveMode,
  overrides: Record<string, unknown>
) {
  const normalized = normalizeBuilderPageSchema(schema);

  return {
    ...normalized,
    responsive: {
      ...normalized.responsive,
      [mode]: {
        ...normalized.responsive[mode],
        ...overrides
      }
    }
  };
}

export function validateResponsiveSchema(schema: BuilderPageSchema) {
  const normalized = normalizeBuilderPageSchema(schema);
  const errors: string[] = [];

  responsiveBuilderModes.forEach((mode) => {
    if (!isRecord(normalized.responsive[mode])) {
      errors.push(`${mode} responsive config must be an object.`);
    }
  });

  normalized.sections.forEach((section) => {
    responsiveBuilderModes.forEach((mode) => {
      if (!isRecord(section.responsive[mode])) {
        errors.push(`${section.id} ${mode} section config must be an object.`);
      }
    });
  });

  return { errors, schema: normalized };
}

export function syncResponsivePreviewState({
  mode,
  schema
}: {
  mode: BuilderResponsiveMode;
  schema: BuilderPageSchema;
}) {
  const validated = validateResponsiveSchema(schema);
  const breakpoint = responsiveBreakpoints[mode];

  return {
    breakpoint,
    hydratedSafely: validated.errors.length === 0,
    mode,
    previewIsolated: true,
    responsiveSectionCount: validated.schema.sections.filter((section) => section.enabled).length,
    syncedAt: new Date().toISOString(),
    validationErrors: validated.errors
  };
}
