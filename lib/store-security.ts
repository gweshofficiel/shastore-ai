export type StoreSecuritySettings = {
  loginAlertsEnabled: boolean;
  sessionTimeoutMinutes: number;
  suspiciousLoginAlertsEnabled: boolean;
};

export const securitySessionTimeoutOptions = [
  { label: "30 minutes", minutes: 30 },
  { label: "1 hour", minutes: 60 },
  { label: "2 hours", minutes: 120 },
  { label: "8 hours", minutes: 480 },
  { label: "24 hours", minutes: 1440 }
] as const;

const allowedTimeoutMinutes = new Set<number>(securitySessionTimeoutOptions.map((option) => option.minutes));

export const securityAuditActions = {
  forceLogoutAll: "security.session.force_logout_all",
  loginFailed: "security.login.failed",
  loginSuccess: "security.login.success",
  passwordResetRequested: "security.password.reset_requested",
  sessionRevoked: "security.session.revoked",
  suspiciousLogin: "security.login.suspicious"
} as const;

export function normalizeStoreSecuritySettings(value: unknown): StoreSecuritySettings {
  const input = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const rawTimeout = Number(input.sessionTimeoutMinutes);

  return {
    loginAlertsEnabled: input.loginAlertsEnabled !== false,
    sessionTimeoutMinutes: allowedTimeoutMinutes.has(rawTimeout) ? rawTimeout : 480,
    suspiciousLoginAlertsEnabled: input.suspiciousLoginAlertsEnabled !== false
  };
}

export function isSecurityActivityAction(action: string) {
  const normalized = action.toLowerCase();

  return (
    normalized.startsWith("security.")
    || normalized.includes("login")
    || normalized.includes("password")
    || normalized.includes("session")
    || normalized.includes("auth.")
    || normalized.includes("access.denied")
    || normalized.includes("rate_limit")
  );
}

export function isTeamSecurityActivityAction(action: string) {
  const normalized = action.toLowerCase();

  return (
    normalized.includes("team")
    || normalized.includes("invite")
    || normalized.includes("member")
    || normalized.includes("permission")
    || normalized.includes("role")
    || normalized.includes("suspend")
  );
}

export function maskUserId(userId: string | null | undefined) {
  if (!userId) {
    return "Unknown user";
  }

  return `${userId.slice(0, 8)}…`;
}
