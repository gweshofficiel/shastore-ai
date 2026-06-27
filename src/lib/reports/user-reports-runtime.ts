import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";

export type UserReportsSource = "user_reports_runtime";

export type UserReportsDateRange = "today" | "7d" | "30d" | "month" | "year";

export type UserReportsLoadingState = "empty" | "error" | "loaded";

export type UserReportsRuntimeStatus = "needs_attention" | "ready" | "unavailable";

export type UserReportsBreakdownItem = {
  count: number;
  dataAvailability: "available" | "planned";
  label: string;
};

export type UserReportsMetrics = {
  activeUsers: number;
  customersCount: number;
  newlyRegisteredUsers: number;
  ownersCount: number;
  resellersCount: number;
  suspendedDisabledUsers: number;
  teamMembersCount: number;
  totalUsers: number;
};

export type UserReportsSnapshot = {
  dataSources: string[];
  errorMessage: string | null;
  generatedAt: string;
  lastUpdatedAt: string | null;
  loadingState: UserReportsLoadingState;
  metrics: UserReportsMetrics;
  rangeLabel: string;
  readOnly: true;
  selectedRange: UserReportsDateRange;
  source: UserReportsSource;
  status: UserReportsRuntimeStatus;
  usersByRole: UserReportsBreakdownItem[];
  warnings: string[];
};

export type UserReportsSummary = {
  lastGeneratedState: string;
  readOnly: true;
  status: UserReportsRuntimeStatus;
  summary: string;
};

export type UserReportsValidation = {
  isValid: boolean;
  issues: string[];
};

export const USER_REPORTS_SOURCE = "user_reports_runtime" as const;

type RawRecord = Record<string, unknown>;

function text(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function dateValue(value: unknown) {
  const parsed = Date.parse(text(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function resolveRangeLabel(range: UserReportsDateRange) {
  switch (range) {
    case "today":
      return "Today";
    case "7d":
      return "Last 7 days";
    case "30d":
      return "Last 30 days";
    case "month":
      return "Current month";
    case "year":
      return "Current year";
    default:
      return "Last 30 days";
  }
}

function resolveRangeStart(range: UserReportsDateRange) {
  const now = new Date();

  if (range === "today") {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }

  if (range === "7d") {
    return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }

  if (range === "30d") {
    return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  if (range === "month") {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  }

  return new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
}

function isWithinRange(timestamp: string | null | undefined, rangeStart: Date) {
  const value = dateValue(timestamp);

  if (!value) {
    return false;
  }

  return value >= rangeStart.getTime();
}

function asRecords(data: unknown): RawRecord[] {
  return Array.isArray(data) ? (data as RawRecord[]) : [];
}

async function safeAdminSelect(table: string, columns: string) {
  const admin = createAdminClient();

  if (!admin) {
    return {
      records: [] as RawRecord[],
      warning: "Service-role admin access is unavailable. User report aggregates are empty."
    };
  }

  const { data, error } = await admin.from(table as never).select(columns as never).limit(5000);

  if (error) {
    return {
      records: [] as RawRecord[],
      warning: `User report source ${table} could not be loaded safely.`
    };
  }

  return {
    records: asRecords(data),
    warning: null as string | null
  };
}

function incrementBreakdown(map: Map<string, UserReportsBreakdownItem>, label: string) {
  const key = label || "unknown";
  const current = map.get(key) ?? {
    count: 0,
    dataAvailability: "available" as const,
    label: key
  };

  map.set(key, {
    ...current,
    count: current.count + 1
  });
}

function ownerUserId(record: RawRecord) {
  return text(record.owner_user_id) || text(record.user_id);
}

function isRestrictedAccountStatus(status: string) {
  const normalized = status.toLowerCase();

  return (
    normalized === "suspended" ||
    normalized === "disabled" ||
    normalized === "pending" ||
    normalized === "under_review"
  );
}

function buildEmptySnapshot(
  range: UserReportsDateRange,
  warnings: string[],
  errorMessage: string | null = null
): UserReportsSnapshot {
  return {
    dataSources: [],
    errorMessage,
    generatedAt: new Date().toISOString(),
    lastUpdatedAt: null,
    loadingState: errorMessage ? "error" : warnings.length ? "empty" : "loaded",
    metrics: {
      activeUsers: 0,
      customersCount: 0,
      newlyRegisteredUsers: 0,
      ownersCount: 0,
      resellersCount: 0,
      suspendedDisabledUsers: 0,
      teamMembersCount: 0,
      totalUsers: 0
    },
    rangeLabel: resolveRangeLabel(range),
    readOnly: true,
    selectedRange: range,
    source: USER_REPORTS_SOURCE,
    status: errorMessage ? "unavailable" : warnings.length ? "needs_attention" : "ready",
    usersByRole: [],
    warnings
  };
}

export async function runUserReportsSnapshot(
  range: UserReportsDateRange = "30d"
): Promise<UserReportsSnapshot> {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    return buildEmptySnapshot(range, ["Super Admin access is required for User Reports runtime."]);
  }

  const selectedRange = range;
  const rangeStart = resolveRangeStart(selectedRange);
  const warnings: string[] = [];
  const dataSources: string[] = [];
  let lastUpdatedAt: string | null = null;

  try {
    const [
      profilesResult,
      accountProfilesResult,
      accountRolesResult,
      workspaceMembersResult,
      internalTeamResult,
      resellerProfilesResult,
      storesResult,
      customersResult
    ] = await Promise.all([
      safeAdminSelect("profiles", "id, created_at, updated_at"),
      safeAdminSelect("account_profiles", "user_id, account_type, created_at, updated_at"),
      safeAdminSelect("account_roles", "user_id, role, status, updated_at, created_at"),
      safeAdminSelect("workspace_members", "user_id, role, status, created_at, updated_at"),
      safeAdminSelect("internal_team_members", "user_id, role, status, created_at, updated_at"),
      safeAdminSelect("reseller_profiles", "user_id, created_at, updated_at"),
      safeAdminSelect("stores", "user_id, owner_user_id, created_at, updated_at"),
      safeAdminSelect("commerce_customers", "id, user_id, created_at, updated_at")
    ]);

    for (const result of [
      profilesResult,
      accountProfilesResult,
      accountRolesResult,
      workspaceMembersResult,
      internalTeamResult,
      resellerProfilesResult,
      storesResult,
      customersResult
    ]) {
      if (result.warning) {
        warnings.push(result.warning);
      }
    }

    if (profilesResult.records.length) {
      dataSources.push("profiles");
    }

    if (accountProfilesResult.records.length) {
      dataSources.push("account_profiles");
    }

    if (accountRolesResult.records.length) {
      dataSources.push("account_roles");
    }

    if (workspaceMembersResult.records.length) {
      dataSources.push("workspace_members");
    }

    if (internalTeamResult.records.length) {
      dataSources.push("internal_team_members");
    }

    if (resellerProfilesResult.records.length) {
      dataSources.push("reseller_profiles");
    }

    if (storesResult.records.length) {
      dataSources.push("stores");
    }

    if (customersResult.records.length) {
      dataSources.push("commerce_customers");
    }

    const userIds = new Set<string>();
    const userCreatedAt = new Map<string, string>();
    const userUpdatedAt = new Map<string, string>();
    const usersByRole = new Map<string, UserReportsBreakdownItem>();
    const accountStatusByUser = new Map<string, string>();

    for (const profile of profilesResult.records) {
      const userId = text(profile.id);

      if (!userId) {
        continue;
      }

      userIds.add(userId);
      userCreatedAt.set(userId, text(profile.created_at));
      userUpdatedAt.set(userId, text(profile.updated_at) || text(profile.created_at));
    }

    for (const profile of accountProfilesResult.records) {
      const userId = text(profile.user_id);

      if (!userId) {
        continue;
      }

      userIds.add(userId);

      const createdAt = text(profile.created_at);
      const updatedAt = text(profile.updated_at) || createdAt;

      if (createdAt && (!userCreatedAt.has(userId) || dateValue(createdAt) < dateValue(userCreatedAt.get(userId)))) {
        userCreatedAt.set(userId, createdAt);
      }

      if (updatedAt && (!userUpdatedAt.has(userId) || dateValue(updatedAt) > dateValue(userUpdatedAt.get(userId)))) {
        userUpdatedAt.set(userId, updatedAt);
      }

      incrementBreakdown(usersByRole, text(profile.account_type, "user"));
    }

    for (const role of accountRolesResult.records) {
      const userId = text(role.user_id);

      if (!userId) {
        continue;
      }

      userIds.add(userId);
      incrementBreakdown(usersByRole, text(role.role, "user"));
      accountStatusByUser.set(userId, text(role.status, "active"));

      const updatedAt = text(role.updated_at) || text(role.created_at);

      if (updatedAt && (!userUpdatedAt.has(userId) || dateValue(updatedAt) > dateValue(userUpdatedAt.get(userId)))) {
        userUpdatedAt.set(userId, updatedAt);
      }
    }

    const ownerIds = new Set<string>();

    for (const store of storesResult.records) {
      const ownerId = ownerUserId(store);

      if (ownerId) {
        ownerIds.add(ownerId);
        userIds.add(ownerId);
      }

      const updatedAt = text(store.updated_at) || text(store.created_at);

      if (updatedAt && (!lastUpdatedAt || dateValue(updatedAt) > dateValue(lastUpdatedAt))) {
        lastUpdatedAt = updatedAt;
      }
    }

    const resellerIds = new Set<string>();

    for (const profile of resellerProfilesResult.records) {
      const userId = text(profile.user_id);

      if (userId) {
        resellerIds.add(userId);
        userIds.add(userId);
      }
    }

    for (const profile of accountProfilesResult.records) {
      if (text(profile.account_type) === "reseller") {
        const userId = text(profile.user_id);

        if (userId) {
          resellerIds.add(userId);
        }
      }
    }

    const workspaceTeamIds = new Set<string>();

    for (const member of workspaceMembersResult.records) {
      const userId = text(member.user_id);

      if (userId) {
        workspaceTeamIds.add(userId);
        userIds.add(userId);
      }

      const updatedAt = text(member.updated_at) || text(member.created_at);

      if (updatedAt && (!lastUpdatedAt || dateValue(updatedAt) > dateValue(lastUpdatedAt))) {
        lastUpdatedAt = updatedAt;
      }
    }

    const internalTeamIds = new Set(
      internalTeamResult.records.map((member) => text(member.user_id)).filter(Boolean)
    );

    let newlyRegisteredUsers = 0;

    for (const userId of userIds) {
      const createdAt = userCreatedAt.get(userId);

      if (isWithinRange(createdAt, rangeStart)) {
        newlyRegisteredUsers += 1;
      }

      const updatedAt = userUpdatedAt.get(userId);

      if (updatedAt && (!lastUpdatedAt || dateValue(updatedAt) > dateValue(lastUpdatedAt))) {
        lastUpdatedAt = updatedAt;
      }
    }

    let activeUsers = 0;
    let suspendedDisabledUsers = 0;

    for (const userId of userIds) {
      const status = accountStatusByUser.get(userId) ?? "active";

      if (isRestrictedAccountStatus(status)) {
        suspendedDisabledUsers += 1;
      } else {
        activeUsers += 1;
      }
    }

    const customersCount = customersResult.records.length;
    const teamMembersCount = new Set([...workspaceTeamIds, ...internalTeamIds]).size;
    const totalUsers = userIds.size;

    if (!profilesResult.records.length && !accountProfilesResult.records.length) {
      warnings.push("User totals rely on account profile and role rows because profile records are unavailable.");
    }

    const status: UserReportsRuntimeStatus =
      warnings.length || suspendedDisabledUsers > 0
        ? "needs_attention"
        : dataSources.length
          ? "ready"
          : "unavailable";

    return {
      dataSources,
      errorMessage: null,
      generatedAt: new Date().toISOString(),
      lastUpdatedAt,
      loadingState: dataSources.length ? "loaded" : "empty",
      metrics: {
        activeUsers,
        customersCount,
        newlyRegisteredUsers,
        ownersCount: ownerIds.size,
        resellersCount: resellerIds.size,
        suspendedDisabledUsers,
        teamMembersCount,
        totalUsers
      },
      rangeLabel: resolveRangeLabel(selectedRange),
      readOnly: true,
      selectedRange,
      source: USER_REPORTS_SOURCE,
      status,
      usersByRole: [...usersByRole.values()].sort((left, right) => right.count - left.count),
      warnings
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "User Reports runtime failed to load safely.";

    return buildEmptySnapshot(selectedRange, [], message);
  }
}

export function getUserReportsSummary(snapshot: UserReportsSnapshot): UserReportsSummary {
  return {
    lastGeneratedState: snapshot.lastUpdatedAt
      ? `Generated ${snapshot.generatedAt}; latest user activity ${snapshot.lastUpdatedAt}`
      : `Generated ${snapshot.generatedAt}; no user activity timestamps recorded`,
    readOnly: true,
    status: snapshot.status,
    summary: [
      `status ${snapshot.status}`,
      `${snapshot.rangeLabel}`,
      `${snapshot.metrics.totalUsers} total users`,
      `${snapshot.metrics.activeUsers} active`,
      `${snapshot.metrics.suspendedDisabledUsers} suspended/disabled`,
      `${snapshot.metrics.newlyRegisteredUsers} newly registered in range`
    ].join("; ")
  };
}

export function validateUserReportsRuntime(snapshot: UserReportsSnapshot): UserReportsValidation {
  const issues: string[] = [];

  if (!snapshot.readOnly) {
    issues.push("User Reports runtime must remain read-only.");
  }

  if (snapshot.source !== USER_REPORTS_SOURCE) {
    issues.push("User Reports runtime must originate from the user reports runtime.");
  }

  if (!snapshot.generatedAt) {
    issues.push("User Reports runtime must include generatedAt.");
  }

  if (snapshot.metrics.totalUsers < 0) {
    issues.push("User Reports total user count must not be negative.");
  }

  return {
    isValid: issues.length === 0,
    issues
  };
}

export async function mapUserReportsRuntimeToAdminFields(range: UserReportsDateRange = "30d") {
  const snapshot = await runUserReportsSnapshot(range);
  const validation = validateUserReportsRuntime(snapshot);
  const summary = getUserReportsSummary(snapshot);

  return {
    errorMessage: snapshot.errorMessage,
    generatedAt: snapshot.generatedAt,
    lastGeneratedState: summary.lastGeneratedState,
    lastUpdatedAt: snapshot.lastUpdatedAt,
    loadingState: snapshot.loadingState,
    metrics: snapshot.metrics,
    rangeLabel: snapshot.rangeLabel,
    readOnly: true as const,
    selectedRange: snapshot.selectedRange,
    status: validation.isValid ? summary.status : ("needs_attention" as const),
    summary: validation.isValid
      ? summary.summary
      : "User Reports runtime validation requires safe read-only defaults.",
    usersByRole: snapshot.usersByRole,
    warnings: [...snapshot.warnings, ...validation.issues]
  };
}
