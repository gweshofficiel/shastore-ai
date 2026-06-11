import type { AdminUser } from "@/lib/admin/data";

export type AdminUserRuntimeFilterParams = {
  plan?: string | null;
  q?: string | null;
  risk?: string | null;
  role?: string | null;
  status?: string | null;
  stores?: string | null;
};

export type AdminUserRuntimeFilters = {
  planFilter: string;
  riskFilter: string;
  roleFilter: string;
  searchTerm: string;
  statusFilter: string;
  storeFilter: string;
};

export function cleanAdminUserStatusFilter(value: string | null | undefined) {
  return value === "active" || value === "suspended" || value === "pending" ? value : "all";
}

export function cleanAdminUserStoreFilter(value: string | null | undefined) {
  return value === "owner" || value === "none" ? value : "all";
}

export function cleanAdminUserRiskFilter(value: string | null | undefined) {
  return value === "high_risk" || value === "reviewed" || value === "clear" ? value : "all";
}

export function adminUserRuntimeFiltersFromParams(params: AdminUserRuntimeFilterParams): AdminUserRuntimeFilters {
  return {
    planFilter: String(params.plan ?? "all").trim(),
    riskFilter: cleanAdminUserRiskFilter(params.risk),
    roleFilter: String(params.role ?? "all").trim(),
    searchTerm: String(params.q ?? "").trim().toLowerCase(),
    statusFilter: cleanAdminUserStatusFilter(params.status),
    storeFilter: cleanAdminUserStoreFilter(params.stores)
  };
}

export function filterAdminUsersForRuntime(users: AdminUser[], filters: AdminUserRuntimeFilters) {
  return users.filter((user) => {
    const matchesSearch =
      !filters.searchTerm ||
      user.email.toLowerCase().includes(filters.searchTerm) ||
      user.emailMasked.toLowerCase().includes(filters.searchTerm) ||
      user.id.toLowerCase().includes(filters.searchTerm) ||
      (user.fullName ?? "").toLowerCase().includes(filters.searchTerm);
    const matchesStatus =
      filters.statusFilter === "all" ||
      (filters.statusFilter === "suspended"
        ? user.accountStatus === "suspended"
        : filters.statusFilter === "pending"
          ? user.accountStatus === "pending"
          : user.accountStatus !== "suspended");
    const matchesRole = filters.roleFilter === "all" || user.primaryRole === filters.roleFilter;
    const matchesPlan = filters.planFilter === "all" || user.planId === filters.planFilter;
    const matchesStore =
      filters.storeFilter === "all" ||
      (filters.storeFilter === "owner" ? user.storesCount > 0 : user.storesCount === 0);
    const matchesRisk = filters.riskFilter === "all" || user.riskStatus === filters.riskFilter;

    return matchesSearch && matchesStatus && matchesRole && matchesPlan && matchesStore && matchesRisk;
  });
}
