import "server-only";

export type AnalyticsProvider = "google-analytics";

export type AnalyticsConnectionState = "not_connected";

export type AnalyticsRuntimeStatus = AnalyticsConnectionState;

export type AnalyticsConnectionPlaceholder = {
  connected: false;
  message: string;
  provider: AnalyticsProvider;
  status: AnalyticsConnectionState;
};

export type AnalyticsRuntimeValidation = {
  isValid: boolean;
  issues: string[];
};

export const SEO_ANALYTICS_PROVIDER = "google-analytics" as const;
export const SEO_ANALYTICS_NOT_CONNECTED_MESSAGE =
  "Google Analytics integration is reserved for a later secure phase. OAuth, tokens, tracking scripts, and external API calls are not enabled." as const;
export const SEO_ANALYTICS_READINESS_NAME = "Google Analytics placeholder" as const;

const FORBIDDEN_CONNECTION_FIELDS = [
  "accessToken",
  "access_token",
  "apiKey",
  "api_key",
  "clientSecret",
  "client_secret",
  "measurementId",
  "measurement_id",
  "oauth",
  "refreshToken",
  "refresh_token",
  "token",
  "trackingId",
  "tracking_id"
] as const;

export function getAnalyticsConnectionPlaceholder(): AnalyticsConnectionPlaceholder {
  return {
    connected: false,
    message: SEO_ANALYTICS_NOT_CONNECTED_MESSAGE,
    provider: SEO_ANALYTICS_PROVIDER,
    status: "not_connected"
  };
}

export function isAnalyticsConnected() {
  return false;
}

export function getAnalyticsRuntimeStatus(): AnalyticsRuntimeStatus {
  return "not_connected";
}

export function validateAnalyticsRuntime(
  connection: unknown = getAnalyticsConnectionPlaceholder()
): AnalyticsRuntimeValidation {
  const issues: string[] = [];

  if (!connection || typeof connection !== "object" || Array.isArray(connection)) {
    return {
      isValid: false,
      issues: ["Analytics runtime must be a connection placeholder object."]
    };
  }

  const record = connection as Record<string, unknown>;

  if (record.connected !== false) {
    issues.push("Analytics runtime must remain disconnected in this phase.");
  }

  if (record.provider !== SEO_ANALYTICS_PROVIDER) {
    issues.push("Analytics runtime provider must be google-analytics.");
  }

  if (record.status !== "not_connected") {
    issues.push("Analytics runtime status must be not_connected in this phase.");
  }

  const message = typeof record.message === "string" ? record.message.trim() : "";
  if (!message) {
    issues.push("Analytics runtime message must explain the secure integration placeholder.");
  }

  for (const field of FORBIDDEN_CONNECTION_FIELDS) {
    if (field in record && record[field]) {
      issues.push("Analytics runtime must not expose OAuth tokens, measurement IDs, or secrets.");
      break;
    }
  }

  return {
    isValid: issues.length === 0,
    issues
  };
}

export function mapAnalyticsRuntimeToAdminFields() {
  const connection = getAnalyticsConnectionPlaceholder();
  const validation = validateAnalyticsRuntime(connection);

  return {
    analyticsReadinessItem: {
      name: SEO_ANALYTICS_READINESS_NAME,
      note: validation.isValid
        ? "Platform GA readiness placeholder only. Store Owner analytics remain separate."
        : "Analytics runtime validation requires safe not-connected defaults.",
      status: "placeholder" as const
    },
    runtimeStatus: getAnalyticsRuntimeStatus()
  };
}

// SEO-18+ placeholders: OAuth, measurement ID wiring, and tracking script integration stay disconnected.
export const SEO_ANALYTICS_FUTURE_HOOKS = [
  "seo_analytics_oauth",
  "seo_analytics_tracking_integration"
] as const;
