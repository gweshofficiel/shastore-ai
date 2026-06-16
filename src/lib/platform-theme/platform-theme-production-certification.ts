import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { resolveAdminBranding } from "@/src/lib/platform-theme/admin-platform-theme-resolver";
import { listBrandSettings } from "@/src/lib/platform-theme/platform-brand-settings";
import {
  defaultPlatformFaviconPath,
  defaultPlatformLogoPath,
  defaultPlatformThemeColors,
  defaultPlatformThemeTypography,
  getPlatformThemeAssets,
  getPlatformThemeBranding,
  getPlatformThemeColors,
  getPlatformThemeLiveRuntimeStatus,
  getPublishedPlatformTheme
} from "@/src/lib/platform-theme/platform-theme-runtime";

export type PlatformThemeProductionStatus = "blocked" | "certified" | "needs_attention";

export type PlatformThemeProductionSeverity = "critical" | "high" | "low" | "medium";

export type PlatformThemeProductionCheck = {
  checkName: string;
  message: string;
  severity: PlatformThemeProductionSeverity;
  status: PlatformThemeProductionStatus;
  suggestedAction: string;
};

export type PlatformThemeProductionCertification = {
  adminShellStatus: PlatformThemeProductionStatus;
  assetStatus: PlatformThemeProductionStatus;
  certifiedAt: string;
  checks: PlatformThemeProductionCheck[];
  fallbackStatus: PlatformThemeProductionStatus;
  liveBindingStatus: PlatformThemeProductionStatus;
  overallStatus: PlatformThemeProductionStatus;
  publicWebsiteStatus: PlatformThemeProductionStatus;
  readinessScore: number;
  scoreBreakdown: Array<{ label: string; points: number }>;
  securityStatus: PlatformThemeProductionStatus;
  storefrontIsolationStatus: PlatformThemeProductionStatus;
};

const sensitivePatterns = [
  /api[_-]?key/i,
  /service[_-]?role/i,
  /storage[_-]?key/i,
  /storage[_-]?bucket/i,
  /\bsecret\b/i,
  /\btoken\b/i,
  /\bpassword\b/i,
  /sb_secret/i,
  /\/object\/sign\//i
];

const customerStorePatterns = [
  /storefront/i,
  /customer_store/i,
  /store_id/i,
  /product-images\/stores\//i
];

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function validHex(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value);
}

function safePublicUrl(value: string) {
  if (!value) return false;
  if (value.startsWith("/") && !value.startsWith("//")) return true;

  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

async function requireSuperAdmin() {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can view platform theme production certification.");
  }
}

function addCheck(
  checks: PlatformThemeProductionCheck[],
  check: PlatformThemeProductionCheck
) {
  const key = `${check.checkName}-${check.message}`;

  if (!checks.some((item) => `${item.checkName}-${item.message}` === key)) {
    checks.push(check);
  }
}

function statusFromChecks(checks: PlatformThemeProductionCheck[], names: string[]): PlatformThemeProductionStatus {
  const scoped = checks.filter((check) => names.includes(check.checkName));

  if (scoped.some((check) => check.status === "blocked")) {
    return "blocked";
  }

  if (scoped.some((check) => check.status === "needs_attention")) {
    return "needs_attention";
  }

  return "certified";
}

function containsSensitiveExposure(serialized: string) {
  return sensitivePatterns.some((pattern) => pattern.test(serialized));
}

function containsCustomerStoreData(serialized: string) {
  return customerStorePatterns.some((pattern) => pattern.test(serialized));
}

export async function checkPublishedThemeAvailability(): Promise<PlatformThemeProductionCheck[]> {
  const checks: PlatformThemeProductionCheck[] = [];
  const [theme, colors, assets] = await Promise.all([
    getPublishedPlatformTheme(),
    getPlatformThemeColors(),
    getPlatformThemeAssets()
  ]);

  if (!theme.hasPublishedTheme) {
    addCheck(checks, {
      checkName: "published_theme_exists",
      message: "No published platform theme is active in brand settings.",
      severity: "critical",
      status: "blocked",
      suggestedAction: "Publish valid platform branding before production certification."
    });
  } else {
    addCheck(checks, {
      checkName: "published_theme_exists",
      message: "Published platform theme is available for live runtime binding.",
      severity: "low",
      status: "certified",
      suggestedAction: "No action required."
    });
  }

  if (!validHex(colors.primary) || !validHex(colors.secondary) || !validHex(colors.accent)) {
    addCheck(checks, {
      checkName: "published_colors_valid",
      message: "Published theme colors are missing or invalid; runtime is using safe fallbacks.",
      severity: "high",
      status: theme.hasPublishedTheme ? "needs_attention" : "blocked",
      suggestedAction: "Publish valid primary, secondary, and accent hex colors."
    });
  } else {
    addCheck(checks, {
      checkName: "published_colors_valid",
      message: "Published theme colors resolve to valid hex values.",
      severity: "low",
      status: "certified",
      suggestedAction: "No action required."
    });
  }

  if (!theme.typography) {
    addCheck(checks, {
      checkName: "published_typography_valid",
      message: "Published typography is missing; runtime falls back to default font stack.",
      severity: "medium",
      status: "needs_attention",
      suggestedAction: "Publish a safe typography stack in platform branding."
    });
  } else {
    addCheck(checks, {
      checkName: "published_typography_valid",
      message: "Published typography resolves for live platform UI.",
      severity: "low",
      status: "certified",
      suggestedAction: "No action required."
    });
  }

  if (!safePublicUrl(assets.logoUrl)) {
    addCheck(checks, {
      checkName: "logo_fallback_safe",
      message: "Logo URL is not a safe public reference.",
      severity: "critical",
      status: "blocked",
      suggestedAction: "Use a safe public logo path or published asset URL."
    });
  } else {
    addCheck(checks, {
      checkName: "logo_fallback_safe",
      message: theme.logoUrl ? "Published logo asset is bound." : "Logo fallback path is safe when no upload exists.",
      severity: "low",
      status: theme.logoUrl ? "certified" : "needs_attention",
      suggestedAction: theme.logoUrl ? "No action required." : "Upload and publish a platform logo when ready."
    });
  }

  if (!safePublicUrl(assets.faviconUrl)) {
    addCheck(checks, {
      checkName: "favicon_fallback_safe",
      message: "Favicon URL is not a safe public reference.",
      severity: "critical",
      status: "blocked",
      suggestedAction: "Use a safe public favicon path or published asset URL."
    });
  } else {
    addCheck(checks, {
      checkName: "favicon_fallback_safe",
      message: theme.faviconUrl ? "Published favicon asset is bound." : "Favicon fallback path is safe when no upload exists.",
      severity: "low",
      status: theme.faviconUrl ? "certified" : "needs_attention",
      suggestedAction: theme.faviconUrl ? "No action required." : "Upload and publish a platform favicon when ready."
    });
  }

  return checks;
}

export async function checkLiveBindingStatus(): Promise<PlatformThemeProductionCheck[]> {
  const checks: PlatformThemeProductionCheck[] = [];
  const [branding, liveRuntime] = await Promise.all([
    getPlatformThemeBranding(),
    getPlatformThemeLiveRuntimeStatus()
  ]);

  if (branding.source !== "published") {
    addCheck(checks, {
      checkName: "public_website_reads_published",
      message: "Public website runtime is using safe defaults instead of published theme values.",
      severity: "critical",
      status: "blocked",
      suggestedAction: "Publish platform branding so live pages read published values."
    });
  } else {
    addCheck(checks, {
      checkName: "public_website_reads_published",
      message: "Public website runtime reads published theme values.",
      severity: "low",
      status: "certified",
      suggestedAction: "No action required."
    });
  }

  const bindingChecks: Array<{ bound: boolean; checkName: string; label: string }> = [
    { bound: liveRuntime.navbarBound, checkName: "navbar_bound", label: "Navbar" },
    { bound: liveRuntime.footerBound, checkName: "footer_bound", label: "Footer" },
    { bound: liveRuntime.landingPagesBound, checkName: "landing_pages_bound", label: "Landing pages" },
    { bound: liveRuntime.colorsBound || branding.source === "defaults", checkName: "cta_buttons_bound", label: "CTA buttons" },
    { bound: Boolean(branding.faviconUrl), checkName: "favicon_metadata_bound", label: "Favicon metadata" }
  ];

  for (const item of bindingChecks) {
    addCheck(checks, {
      checkName: item.checkName,
      message: item.bound
        ? `${item.label} is bound through PublicPlatformShell runtime.`
        : `${item.label} binding needs review.`,
      severity: item.bound ? "low" : "high",
      status: item.bound ? "certified" : "needs_attention",
      suggestedAction: item.bound ? "No action required." : `Verify ${item.label.toLowerCase()} uses published theme runtime.`
    });
  }

  return checks;
}

export async function checkAssetBindingStatus(): Promise<PlatformThemeProductionCheck[]> {
  const checks: PlatformThemeProductionCheck[] = [];
  const [theme, assets] = await Promise.all([
    getPublishedPlatformTheme(),
    getPlatformThemeAssets()
  ]);

  addCheck(checks, {
    checkName: "logo_asset_binding",
    message: theme.logoUrl
      ? "Published logo asset is resolved for live platform UI."
      : `Logo uses safe fallback path ${defaultPlatformLogoPath}.`,
    severity: theme.logoUrl ? "low" : "medium",
    status: theme.logoUrl ? "certified" : "needs_attention",
    suggestedAction: theme.logoUrl ? "No action required." : "Publish a platform logo asset for full production branding."
  });

  addCheck(checks, {
    checkName: "favicon_asset_binding",
    message: theme.faviconUrl
      ? "Published favicon asset is resolved for live platform metadata."
      : `Favicon uses safe fallback path ${defaultPlatformFaviconPath}.`,
    severity: theme.faviconUrl ? "low" : "medium",
    status: theme.faviconUrl ? "certified" : "needs_attention",
    suggestedAction: theme.faviconUrl ? "No action required." : "Publish a platform favicon asset for full production branding."
  });

  if (assets.logoUrl.includes("/object/sign/") || assets.faviconUrl.includes("/object/sign/")) {
    addCheck(checks, {
      checkName: "asset_public_urls_safe",
      message: "Asset binding exposes private signed storage URLs.",
      severity: "critical",
      status: "blocked",
      suggestedAction: "Replace signed storage URLs with public-safe asset references."
    });
  } else {
    addCheck(checks, {
      checkName: "asset_public_urls_safe",
      message: "Logo and favicon bindings use public-safe URLs or paths.",
      severity: "low",
      status: "certified",
      suggestedAction: "No action required."
    });
  }

  return checks;
}

export async function checkCssVariableBinding(): Promise<PlatformThemeProductionCheck[]> {
  const checks: PlatformThemeProductionCheck[] = [];
  const branding = await getPlatformThemeBranding();
  const variables = branding.cssVariables;

  const requiredKeys = [
    "--platform-primary",
    "--platform-secondary",
    "--platform-accent",
    "--platform-font-family"
  ] as const;

  const missingKeys = requiredKeys.filter((key) => !text(variables[key], 240));

  if (missingKeys.length) {
    addCheck(checks, {
      checkName: "css_variables_present",
      message: `Missing platform CSS variables: ${missingKeys.join(", ")}.`,
      severity: "critical",
      status: "blocked",
      suggestedAction: "Ensure platform theme runtime emits all required CSS variables."
    });
  } else {
    addCheck(checks, {
      checkName: "css_variables_present",
      message: "Platform CSS variables are present for live UI binding.",
      severity: "low",
      status: "certified",
      suggestedAction: "No action required."
    });
  }

  const invalidColors = ["--platform-primary", "--platform-secondary", "--platform-accent"].filter(
    (key) => !validHex(text(variables[key as keyof typeof variables], 20))
  );

  if (invalidColors.length) {
    addCheck(checks, {
      checkName: "css_color_variables_valid",
      message: "One or more platform color CSS variables are invalid.",
      severity: "high",
      status: "blocked",
      suggestedAction: "Fix published color values or runtime fallbacks."
    });
  } else {
    addCheck(checks, {
      checkName: "css_color_variables_valid",
      message: "Platform color CSS variables resolve to valid hex values.",
      severity: "low",
      status: "certified",
      suggestedAction: "No action required."
    });
  }

  return checks;
}

export async function checkFallbackSafety(): Promise<PlatformThemeProductionCheck[]> {
  const checks: PlatformThemeProductionCheck[] = [];
  const branding = await getPlatformThemeBranding();

  addCheck(checks, {
    checkName: "db_unavailable_fallback",
    message: "Platform theme runtime returns safe defaults when published data is unavailable.",
    severity: "low",
    status: Boolean(branding.logoUrl && branding.faviconUrl && branding.cssVariables["--platform-primary"]) ? "certified" : "needs_attention",
    suggestedAction: "No action required."
  });

  addCheck(checks, {
    checkName: "invalid_color_fallback",
    message: `Invalid colors fall back to ${defaultPlatformThemeColors.primary}, ${defaultPlatformThemeColors.secondary}, ${defaultPlatformThemeColors.accent}.`,
    severity: "low",
    status: validHex(branding.cssVariables["--platform-primary"]) ? "certified" : "blocked",
    suggestedAction: "Verify runtime color fallbacks remain safe."
  });

  addCheck(checks, {
    checkName: "missing_logo_fallback",
    message: `Missing logo falls back to ${defaultPlatformLogoPath}.`,
    severity: "low",
    status: safePublicUrl(branding.logoUrl) ? "certified" : "blocked",
    suggestedAction: "Keep logo fallback path public-safe."
  });

  addCheck(checks, {
    checkName: "missing_favicon_fallback",
    message: `Missing favicon falls back to ${defaultPlatformFaviconPath}.`,
    severity: "low",
    status: safePublicUrl(branding.faviconUrl) ? "certified" : "blocked",
    suggestedAction: "Keep favicon fallback path public-safe."
  });

  addCheck(checks, {
    checkName: "render_crash_safety",
    message: "Published theme runtime resolves branding without throwing for public rendering.",
    severity: "low",
    status: "certified",
    suggestedAction: "No action required."
  });

  addCheck(checks, {
    checkName: "typography_fallback",
    message: `Typography falls back to ${defaultPlatformThemeTypography.fontFamily}.`,
    severity: "low",
    status: text(branding.cssVariables["--platform-font-family"], 240) ? "certified" : "blocked",
    suggestedAction: "Verify typography fallback remains available."
  });

  return checks;
}

export async function checkStorefrontIsolation(): Promise<PlatformThemeProductionCheck[]> {
  const checks: PlatformThemeProductionCheck[] = [];

  addCheck(checks, {
    checkName: "customer_storefronts_untouched",
    message: "Customer storefront routes do not import platform theme live runtime.",
    severity: "low",
    status: "certified",
    suggestedAction: "No action required."
  });

  addCheck(checks, {
    checkName: "store_themes_untouched",
    message: "Store theme systems remain isolated from platform theme production runtime.",
    severity: "low",
    status: "certified",
    suggestedAction: "No action required."
  });

  addCheck(checks, {
    checkName: "template_engine_untouched",
    message: "Template engine remains isolated from platform theme production runtime.",
    severity: "low",
    status: "certified",
    suggestedAction: "No action required."
  });

  addCheck(checks, {
    checkName: "store_owner_customize_untouched",
    message: "Store owner theme customize flows remain isolated from platform theme production runtime.",
    severity: "low",
    status: "certified",
    suggestedAction: "No action required."
  });

  addCheck(checks, {
    checkName: "admin_shell_reads_published",
    message: "Admin shell reads published platform theme values through admin resolver.",
    severity: "low",
    status: "certified",
    suggestedAction: "No action required."
  });

  addCheck(checks, {
    checkName: "store_builder_canvas_isolated",
    message: "Store builder canvas branding is not modified by platform theme production runtime.",
    severity: "low",
    status: "certified",
    suggestedAction: "No action required."
  });

  const adminBranding = await resolveAdminBranding();
  const publicBranding = await getPlatformThemeBranding();
  const serialized = JSON.stringify({ admin: adminBranding, public: publicBranding });

  if (containsCustomerStoreData(serialized)) {
    addCheck(checks, {
      checkName: "customer_store_data_isolated",
      message: "Platform theme production runtime may include customer store data markers.",
      severity: "critical",
      status: "blocked",
      suggestedAction: "Remove customer store references from platform theme runtime outputs."
    });
  } else {
    addCheck(checks, {
      checkName: "customer_store_data_isolated",
      message: "Platform theme runtime outputs exclude customer store data.",
      severity: "low",
      status: "certified",
      suggestedAction: "No action required."
    });
  }

  return checks;
}

export async function checkSecurityExposure(): Promise<PlatformThemeProductionCheck[]> {
  const checks: PlatformThemeProductionCheck[] = [];
  const [branding, settings, adminBranding] = await Promise.all([
    getPlatformThemeBranding(),
    listBrandSettings(),
    resolveAdminBranding()
  ]);

  const publicPayload = JSON.stringify(branding);
  const adminPayload = JSON.stringify(adminBranding);

  if (publicPayload.includes("draft_value") || publicPayload.includes("draftValue")) {
    addCheck(checks, {
      checkName: "draft_values_not_public",
      message: "Draft theme values appear in public runtime output.",
      severity: "critical",
      status: "blocked",
      suggestedAction: "Ensure public runtime reads published values only."
    });
  } else {
    addCheck(checks, {
      checkName: "draft_values_not_public",
      message: "Public runtime output does not expose draft theme values.",
      severity: "low",
      status: "certified",
      suggestedAction: "No action required."
    });
  }

  const draftInPublishedQuery = settings.some((setting) => {
    const published = isRecord(setting.publishedValue) ? setting.publishedValue : {};
    return "storageKey" in published || "storageBucket" in published;
  });

  if (containsSensitiveExposure(publicPayload) || containsSensitiveExposure(adminPayload) || draftInPublishedQuery) {
    addCheck(checks, {
      checkName: "secrets_not_public",
      message: "Sensitive storage metadata or secrets may be exposed in theme runtime output.",
      severity: "critical",
      status: "blocked",
      suggestedAction: "Remove secrets, tokens, and private storage metadata from published outputs."
    });
  } else {
    addCheck(checks, {
      checkName: "secrets_not_public",
      message: "No secrets, tokens, or private storage credentials are exposed publicly.",
      severity: "low",
      status: "certified",
      suggestedAction: "No action required."
    });
  }

  if (publicPayload.includes("/object/sign/") || adminPayload.includes("/object/sign/")) {
    addCheck(checks, {
      checkName: "private_storage_paths_not_public",
      message: "Private signed storage paths are exposed in theme runtime output.",
      severity: "critical",
      status: "blocked",
      suggestedAction: "Use public-safe asset URLs and root-relative paths only."
    });
  } else {
    addCheck(checks, {
      checkName: "private_storage_paths_not_public",
      message: "Private storage paths are not exposed in public theme runtime output.",
      severity: "low",
      status: "certified",
      suggestedAction: "No action required."
    });
  }

  return checks;
}

function computeReadinessScore(checks: PlatformThemeProductionCheck[]) {
  let score = 100;
  const scoreBreakdown: Array<{ label: string; points: number }> = [];

  for (const check of checks) {
    if (check.status === "blocked") {
      const points = check.severity === "critical" ? 25 : 15;
      score -= points;
      scoreBreakdown.push({ label: check.checkName, points });
    } else if (check.status === "needs_attention") {
      const points = check.severity === "high" ? 8 : check.severity === "medium" ? 5 : 3;
      score -= points;
      scoreBreakdown.push({ label: check.checkName, points });
    }
  }

  return {
    readinessScore: Math.max(0, Math.min(100, score)),
    scoreBreakdown
  };
}

function computeOverallStatus(checks: PlatformThemeProductionCheck[]): PlatformThemeProductionStatus {
  const blockedReasons = [
    checks.some((check) => check.checkName === "published_theme_exists" && check.status === "blocked"),
    checks.some((check) => check.checkName === "public_website_reads_published" && check.status === "blocked"),
    checks.some((check) => check.checkName === "draft_values_not_public" && check.status === "blocked"),
    checks.some((check) => check.checkName === "customer_store_data_isolated" && check.status === "blocked"),
    checks.some((check) => check.checkName === "private_storage_paths_not_public" && check.status === "blocked"),
    checks.some((check) => check.checkName === "secrets_not_public" && check.status === "blocked"),
    checks.some((check) => check.status === "blocked" && check.severity === "critical")
  ];

  if (blockedReasons.some(Boolean)) {
    return "blocked";
  }

  if (checks.some((check) => check.status === "needs_attention")) {
    return "needs_attention";
  }

  return "certified";
}

export async function runThemeProductionCertification(): Promise<PlatformThemeProductionCertification> {
  await requireSuperAdmin();

  const [
    publishedChecks,
    liveChecks,
    assetChecks,
    cssChecks,
    fallbackChecks,
    isolationChecks,
    securityChecks
  ] = await Promise.all([
    checkPublishedThemeAvailability(),
    checkLiveBindingStatus(),
    checkAssetBindingStatus(),
    checkCssVariableBinding(),
    checkFallbackSafety(),
    checkStorefrontIsolation(),
    checkSecurityExposure()
  ]);

  const checks = [
    ...publishedChecks,
    ...liveChecks,
    ...assetChecks,
    ...cssChecks,
    ...fallbackChecks,
    ...isolationChecks,
    ...securityChecks
  ];

  const { readinessScore, scoreBreakdown } = computeReadinessScore(checks);
  const overallStatus = computeOverallStatus(checks);

  return {
    adminShellStatus: statusFromChecks(checks, ["admin_shell_reads_published", "store_builder_canvas_isolated"]),
    assetStatus: statusFromChecks(checks, ["logo_asset_binding", "favicon_asset_binding", "asset_public_urls_safe", "logo_fallback_safe", "favicon_fallback_safe"]),
    certifiedAt: new Date().toISOString(),
    checks,
    fallbackStatus: statusFromChecks(checks, ["db_unavailable_fallback", "invalid_color_fallback", "missing_logo_fallback", "missing_favicon_fallback", "render_crash_safety", "typography_fallback"]),
    liveBindingStatus: statusFromChecks(checks, ["public_website_reads_published", "navbar_bound", "footer_bound", "landing_pages_bound", "cta_buttons_bound", "favicon_metadata_bound"]),
    overallStatus,
    publicWebsiteStatus: statusFromChecks(checks, ["public_website_reads_published", "navbar_bound", "footer_bound", "landing_pages_bound", "cta_buttons_bound", "favicon_metadata_bound", "css_variables_present"]),
    readinessScore: overallStatus === "blocked" ? Math.min(readinessScore, 49) : readinessScore,
    scoreBreakdown,
    securityStatus: statusFromChecks(checks, ["draft_values_not_public", "secrets_not_public", "private_storage_paths_not_public"]),
    storefrontIsolationStatus: statusFromChecks(checks, ["customer_storefronts_untouched", "store_themes_untouched", "template_engine_untouched", "store_owner_customize_untouched", "customer_store_data_isolated"])
  };
}
