import "server-only";

export type SearchConsoleProvider = "google-search-console";

export type SearchConsoleConnectionState = "not_connected";

export type SearchConsoleRuntimeStatus = SearchConsoleConnectionState;

export type SearchConsoleConnectionPlaceholder = {
  connected: false;
  message: string;
  provider: SearchConsoleProvider;
  status: SearchConsoleConnectionState;
};

export type SearchConsoleRuntimeValidation = {
  isValid: boolean;
  issues: string[];
};

export const SEO_SEARCH_CONSOLE_PROVIDER = "google-search-console" as const;
export const SEO_SEARCH_CONSOLE_NOT_CONNECTED_MESSAGE =
  "Google Search Console integration is reserved for a later secure phase. OAuth, tokens, and external API calls are not enabled." as const;
export const SEO_SEARCH_CONSOLE_INDEXED_PAGES_PLACEHOLDER = "Search Console not connected" as const;

const FORBIDDEN_CONNECTION_FIELDS = [
  "accessToken",
  "access_token",
  "apiKey",
  "api_key",
  "clientSecret",
  "client_secret",
  "oauth",
  "refreshToken",
  "refresh_token",
  "token"
] as const;

export function getSearchConsoleConnectionPlaceholder(): SearchConsoleConnectionPlaceholder {
  return {
    connected: false,
    message: SEO_SEARCH_CONSOLE_NOT_CONNECTED_MESSAGE,
    provider: SEO_SEARCH_CONSOLE_PROVIDER,
    status: "not_connected"
  };
}

export function isSearchConsoleConnected() {
  return false;
}

export function getSearchConsoleRuntimeStatus(): SearchConsoleRuntimeStatus {
  return "not_connected";
}

export function validateSearchConsoleRuntime(
  connection: unknown = getSearchConsoleConnectionPlaceholder()
): SearchConsoleRuntimeValidation {
  const issues: string[] = [];

  if (!connection || typeof connection !== "object" || Array.isArray(connection)) {
    return {
      isValid: false,
      issues: ["Search Console runtime must be a connection placeholder object."]
    };
  }

  const record = connection as Record<string, unknown>;

  if (record.connected !== false) {
    issues.push("Search Console runtime must remain disconnected in this phase.");
  }

  if (record.provider !== SEO_SEARCH_CONSOLE_PROVIDER) {
    issues.push("Search Console runtime provider must be google-search-console.");
  }

  if (record.status !== "not_connected") {
    issues.push("Search Console runtime status must be not_connected in this phase.");
  }

  const message = typeof record.message === "string" ? record.message.trim() : "";
  if (!message) {
    issues.push("Search Console runtime message must explain the secure integration placeholder.");
  }

  for (const field of FORBIDDEN_CONNECTION_FIELDS) {
    if (field in record && record[field]) {
      issues.push("Search Console runtime must not expose OAuth tokens or secrets.");
      break;
    }
  }

  return {
    isValid: issues.length === 0,
    issues
  };
}

export function mapSearchConsoleRuntimeToAdminFields() {
  const connection = getSearchConsoleConnectionPlaceholder();
  const validation = validateSearchConsoleRuntime(connection);

  return {
    analyticsReadinessItem: {
      name: "Search Console placeholder",
      note: validation.isValid
        ? connection.message
        : "Search Console runtime validation requires safe not-connected defaults.",
      status: "placeholder" as const
    },
    indexedPagesPlaceholder: SEO_SEARCH_CONSOLE_INDEXED_PAGES_PLACEHOLDER,
    runtimeStatus: getSearchConsoleRuntimeStatus()
  };
}

// SEO-17+ placeholders: OAuth, token storage, and Google API integration stay disconnected.
export const SEO_SEARCH_CONSOLE_FUTURE_HOOKS = [
  "seo_search_console_oauth",
  "seo_search_console_api_integration"
] as const;
