const colorPattern = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export type ThemeTokenInput = {
  button?: Record<string, unknown>;
  colors?: Record<string, unknown>;
  radius?: Record<string, unknown>;
  spacing?: Record<string, unknown>;
  typography?: Record<string, unknown>;
};

export type VisualThemeStyles = {
  button: Record<string, string>;
  colors: Record<string, string>;
  radius: Record<string, string>;
  spacing: Record<string, string>;
  typography: Record<string, string>;
};

const defaultTokens: VisualThemeStyles = {
  button: {
    radius: "pill",
    style: "filled"
  },
  colors: {
    accent: "#f59e0b",
    background: "#f8fafc",
    muted: "#64748b",
    primary: "#0f172a",
    secondary: "#2563eb",
    surface: "#ffffff",
    text: "#0f172a"
  },
  radius: {
    card: "2rem",
    control: "999px",
    section: "2rem"
  },
  spacing: {
    density: "comfortable",
    section: "comfortable"
  },
  typography: {
    body: "inter",
    heading: "inter",
    scale: "comfortable"
  }
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function cleanText(value: unknown, fallback: string, maxLength = 80) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : fallback;
}

function cleanColor(value: unknown, fallback: string) {
  const text = cleanText(value, fallback, 24);
  return colorPattern.test(text) ? text : fallback;
}

function resolveColorTokens(tokens: Record<string, unknown>) {
  return {
    accent: cleanColor(tokens.accent, defaultTokens.colors.accent),
    background: cleanColor(tokens.background, defaultTokens.colors.background),
    muted: cleanColor(tokens.muted, defaultTokens.colors.muted),
    primary: cleanColor(tokens.primary, defaultTokens.colors.primary),
    secondary: cleanColor(tokens.secondary, defaultTokens.colors.secondary),
    surface: cleanColor(tokens.surface, defaultTokens.colors.surface),
    text: cleanColor(tokens.text, defaultTokens.colors.text)
  };
}

export function resolveVisualThemeStyles(
  baseTheme: Record<string, unknown> | null | undefined,
  overrides: ThemeTokenInput = {}
): VisualThemeStyles {
  const palette = isRecord(baseTheme?.color_palette) ? baseTheme.color_palette : {};
  const typography = isRecord(baseTheme?.typography) ? baseTheme.typography : {};

  return {
    button: {
      radius: cleanText(overrides.button?.radius, defaultTokens.button.radius),
      style: cleanText(overrides.button?.style, defaultTokens.button.style)
    },
    colors: resolveColorTokens({
      ...palette,
      ...(isRecord(overrides.colors) ? overrides.colors : {})
    }),
    radius: {
      card: cleanText(overrides.radius?.card ?? baseTheme?.border_radius, defaultTokens.radius.card),
      control: cleanText(overrides.radius?.control, defaultTokens.radius.control),
      section: cleanText(overrides.radius?.section ?? baseTheme?.border_radius, defaultTokens.radius.section)
    },
    spacing: {
      density: cleanText(overrides.spacing?.density ?? baseTheme?.spacing, defaultTokens.spacing.density),
      section: cleanText(overrides.spacing?.section ?? baseTheme?.spacing, defaultTokens.spacing.section)
    },
    typography: {
      body: cleanText(overrides.typography?.body ?? typography.body, defaultTokens.typography.body),
      heading: cleanText(overrides.typography?.heading ?? typography.heading, defaultTokens.typography.heading),
      scale: cleanText(overrides.typography?.scale ?? typography.scale, defaultTokens.typography.scale)
    }
  };
}

export function updateThemeTokens(
  baseTheme: Record<string, unknown> | null | undefined,
  overrides: ThemeTokenInput
) {
  return resolveVisualThemeStyles(baseTheme, overrides);
}

export function applySectionStyleOverride({
  currentOverrides,
  sectionId,
  styleTokens
}: {
  currentOverrides?: Record<string, unknown>;
  sectionId: string;
  styleTokens: Record<string, unknown>;
}) {
  return {
    ...(currentOverrides ?? {}),
    [sectionId]: {
      ...(isRecord(currentOverrides?.[sectionId]) ? currentOverrides?.[sectionId] : {}),
      ...styleTokens
    }
  };
}

export function validateThemeCustomization(tokens: VisualThemeStyles) {
  const errors: string[] = [];

  Object.entries(tokens.colors).forEach(([key, value]) => {
    if (!colorPattern.test(value)) {
      errors.push(`${key} must be a valid hex color.`);
    }
  });

  if (!tokens.typography.heading || !tokens.typography.body) {
    errors.push("Heading and body typography tokens are required.");
  }

  return { errors, tokens };
}

export function syncVisualStylePreview(tokens: VisualThemeStyles) {
  const validation = validateThemeCustomization(tokens);

  return {
    hydratedSafely: validation.errors.length === 0,
    previewIsolated: true,
    syncedAt: new Date().toISOString(),
    tokenGroups: Object.keys(tokens),
    validationErrors: validation.errors,
    visualStylePreviewOnly: true
  };
}
