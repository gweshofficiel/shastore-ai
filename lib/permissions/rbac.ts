import type { SupabaseClient } from "@supabase/supabase-js";
import { getActiveWorkspaceForUser } from "@/lib/workspaces/active-workspace";

export type WorkspaceRole = "owner" | "admin" | "editor" | "support" | "billing_manager" | "viewer";

export const permissionGroups = [
  "products",
  "orders",
  "customers",
  "analytics",
  "shipping",
  "blog",
  "pages",
  "faq",
  "contact",
  "settings",
  "team"
] as const;

export const permissionActions = ["view", "create", "edit", "delete"] as const;

export type PermissionGroup = (typeof permissionGroups)[number];
export type PermissionAction = (typeof permissionActions)[number];
export type GranularPermission = `${PermissionGroup}.${PermissionAction}`;
export type PermissionOverrides = Partial<Record<GranularPermission, boolean>>;

type LegacyWorkspacePermission =
  | "can_manage_payments"
  | "can_manage_shipping"
  | "can_edit_stores"
  | "can_edit_landings"
  | "can_edit_templates"
  | "can_manage_billing"
  | "can_manage_domains"
  | "can_manage_team"
  | "can_view_customers"
  | "can_view_landings"
  | "can_view_notifications"
  | "can_view_orders"
  | "can_view_overview"
  | "can_view_settings"
  | "can_view_stores"
  | "can_view_templates"
  | "manage_billing"
  | "manage_team"
  | "create_store"
  | "edit_store"
  | "publish_store"
  | "manage_domains"
  | "manage_products"
  | "view_orders"
  | "manage_orders"
  | "view_analytics"
  | "export_data";

export type WorkspacePermission = LegacyWorkspacePermission | GranularPermission;

function permissionsForGroups(groups: readonly PermissionGroup[], actions: readonly PermissionAction[]) {
  return groups.flatMap((group) => actions.map((action) => `${group}.${action}` as GranularPermission));
}

const allGranularPermissions = permissionsForGroups(permissionGroups, permissionActions);

const legacyPermissionAliases: Partial<Record<LegacyWorkspacePermission, GranularPermission[]>> = {
  can_manage_shipping: ["shipping.edit"],
  can_edit_stores: [
    "products.edit",
    "blog.edit",
    "pages.edit",
    "faq.edit",
    "contact.edit",
    "settings.edit"
  ],
  can_manage_team: ["team.edit"],
  can_view_customers: ["customers.view"],
  can_view_orders: ["orders.view"],
  can_view_settings: ["settings.view"],
  can_view_stores: ["settings.view"],
  manage_products: ["products.edit"],
  manage_team: ["team.edit"],
  view_orders: ["orders.view"],
  manage_orders: ["orders.edit"],
  view_analytics: ["analytics.view"],
  export_data: ["analytics.view"]
};

export const rolePermissions: Record<WorkspaceRole, WorkspacePermission[]> = {
  owner: [
    ...allGranularPermissions,
    "manage_billing",
    "can_manage_billing",
    "manage_team",
    "can_manage_team",
    "can_view_overview",
    "can_view_landings",
    "can_edit_landings",
    "create_store",
    "edit_store",
    "can_view_stores",
    "can_edit_stores",
    "publish_store",
    "manage_domains",
    "can_manage_domains",
    "manage_products",
    "can_view_templates",
    "can_edit_templates",
    "view_orders",
    "can_view_orders",
    "can_view_customers",
    "can_manage_payments",
    "can_manage_shipping",
    "manage_orders",
    "view_analytics",
    "export_data",
    "can_view_notifications",
    "can_view_settings"
  ],
  admin: [
    ...allGranularPermissions,
    "manage_billing",
    "can_manage_billing",
    "manage_team",
    "can_manage_team",
    "can_view_overview",
    "can_view_landings",
    "can_edit_landings",
    "create_store",
    "edit_store",
    "can_view_stores",
    "can_edit_stores",
    "publish_store",
    "manage_domains",
    "can_manage_domains",
    "manage_products",
    "can_view_templates",
    "can_edit_templates",
    "view_orders",
    "can_view_orders",
    "can_view_customers",
    "can_manage_payments",
    "can_manage_shipping",
    "manage_orders",
    "view_analytics",
    "export_data",
    "can_view_notifications",
    "can_view_settings"
  ],
  editor: [
    ...permissionsForGroups(["products", "blog", "pages", "faq", "contact"], ["view", "create", "edit"]),
    ...permissionsForGroups(["orders", "customers", "analytics", "settings"], ["view"]),
    "can_view_overview",
    "can_view_landings",
    "can_edit_landings",
    "can_view_templates",
    "can_edit_templates",
    "create_store",
    "edit_store",
    "can_view_stores",
    "can_edit_stores",
    "publish_store",
    "manage_products",
    "view_orders",
    "can_view_orders",
    "view_analytics",
    "export_data",
    "can_view_notifications",
    "can_view_settings"
  ],
  support: [
    ...permissionsForGroups(["orders", "customers"], ["view", "edit"]),
    ...permissionsForGroups(["analytics", "settings"], ["view"]),
    "can_view_overview",
    "view_orders",
    "can_view_orders",
    "can_view_customers",
    "view_analytics",
    "can_view_notifications",
    "can_view_settings"
  ],
  billing_manager: [
    ...permissionsForGroups(["analytics", "settings"], ["view"]),
    "manage_billing",
    "can_manage_billing",
    "can_manage_payments",
    "can_view_notifications",
    "can_view_settings"
  ],
  viewer: [
    ...permissionsForGroups(["analytics", "settings"], ["view"]),
    "can_view_overview",
    "can_view_notifications",
    "can_view_settings"
  ]
};

type DashboardRoutePermission = {
  anyPermissions?: readonly WorkspacePermission[];
  href: string;
  icon: string;
  label: string;
  permission: WorkspacePermission;
  showInSidebar?: boolean;
};

export const dashboardRoutePermissions: readonly DashboardRoutePermission[] = [
  { href: "/dashboard", label: "Overview", icon: "overview", permission: "can_view_overview" },
  { href: "/dashboard/landings/new", label: "New landing", icon: "landings", permission: "can_edit_landings", showInSidebar: false },
  { href: "/dashboard/landings", label: "Landings", icon: "landings", permission: "can_view_landings" },
  { href: "/dashboard/stores/new", label: "New store", icon: "stores", permission: "can_edit_stores", showInSidebar: false },
  { href: "/dashboard/stores", label: "Stores", icon: "stores", permission: "can_view_stores" },
  { href: "/dashboard/theme-customize", label: "Theme Customize", icon: "templates", permission: "settings.edit" },
  { href: "/dashboard/homepage", label: "Homepage", icon: "pages", permission: "settings.edit" },
  { href: "/dashboard/navigation", label: "Navigation", icon: "navigation", permission: "settings.edit" },
  { href: "/dashboard/popups-announcements", label: "Popups & Announcements", icon: "pages", permission: "can_edit_stores" },
  { href: "/dashboard/pages", label: "Pages", icon: "pages", permission: "pages.view" },
  { href: "/dashboard/about", label: "About Us", icon: "pages", permission: "pages.view" },
  { href: "/dashboard/legal-pages", label: "Legal Pages", icon: "pages", permission: "pages.view" },
  { href: "/dashboard/footer-links", label: "Footer Links", icon: "pages", permission: "pages.view" },
  { href: "/dashboard/contact", label: "Contact", icon: "pages", permission: "contact.view" },
  { href: "/dashboard/blog", label: "Blog / Articles", icon: "pages", permission: "blog.view" },
  { href: "/dashboard/faq", label: "FAQ", icon: "pages", permission: "faq.view" },
  { href: "/dashboard/products", label: "Products", icon: "products", permission: "products.view" },
  { href: "/dashboard/categories", label: "Categories", icon: "products", permission: "products.view" },
  { href: "/dashboard/back-in-stock", label: "Back in stock", icon: "products", permission: "products.view" },
  { href: "/dashboard/product-qa", label: "Product Q&A", icon: "products", permission: "products.view" },
  { href: "/dashboard/orders", label: "Orders", icon: "orders", permission: "orders.view" },
  { href: "/dashboard/abandoned-carts", label: "Abandoned carts", icon: "orders", permission: "orders.view" },
  { href: "/dashboard/discount-campaigns", label: "Discount Campaigns", icon: "orders", permission: "can_edit_stores" },
  { href: "/dashboard/gift-cards", label: "Gift Cards", icon: "orders", permission: "can_edit_stores" },
  { href: "/dashboard/customers", label: "Customers", icon: "customers", permission: "customers.view" },
  { href: "/dashboard/customer-segments", label: "Customer Segments", icon: "customers", permission: "customers.view" },
  { href: "/dashboard/loyalty", label: "Loyalty", icon: "customers", permission: "customers.view" },
  { href: "/dashboard/referrals", label: "Referrals", icon: "customers", permission: "customers.view" },
  { href: "/dashboard/affiliates", label: "Affiliates", icon: "customers", permission: "can_edit_stores" },
  { href: "/dashboard/reviews", label: "Reviews", icon: "customers", permission: "products.view" },
  { href: "/dashboard/analytics", label: "Analytics", icon: "analytics", permission: "analytics.view" },
  { href: "/dashboard/analytics-advanced", label: "Analytics Advanced", icon: "analytics", permission: "analytics.view" },
  { href: "/dashboard/seo", label: "SEO", icon: "pages", permission: "settings.edit" },
  { href: "/dashboard/reports/sales", label: "Sales Reports", icon: "analytics", permission: "analytics.view" },
  { href: "/dashboard/reports/products", label: "Product Reports", icon: "analytics", permission: "analytics.view" },
  { href: "/dashboard/reports/customers", label: "Customer Reports", icon: "analytics", permission: "analytics.view" },
  { href: "/dashboard/monitoring", label: "Monitoring", icon: "monitoring", permission: "analytics.view" },
  { href: "/dashboard/support", label: "Support Tickets", icon: "support", permission: "can_view_notifications" },
  { href: "/dashboard/payments", label: "Payments", icon: "payments", permission: "can_manage_payments" },
  { href: "/dashboard/tax", label: "Taxes", icon: "payments", permission: "can_manage_payments" },
  { href: "/dashboard/delivery-agents", label: "Delivery Agents", icon: "shipping", permission: "manage_orders" },
  { href: "/dashboard/returns", label: "Returns", icon: "shipping", permission: "manage_orders" },
  { href: "/dashboard/refunds", label: "Refunds", icon: "payments", permission: "manage_orders" },
  { href: "/dashboard/shipping", label: "Shipping", icon: "shipping", permission: "shipping.view" },
  { href: "/dashboard/shipping-profiles", label: "Shipping Profiles", icon: "shipping", permission: "shipping.view" },
  { href: "/dashboard/shipping-zones", label: "Shipping Zones", icon: "shipping", permission: "shipping.view" },
  { href: "/dashboard/shipping-rates", label: "Shipping Rates", icon: "shipping", permission: "shipping.view" },
  { href: "/dashboard/templates/studio", label: "Template studio", icon: "templates", permission: "can_edit_templates", showInSidebar: false },
  { href: "/dashboard/templates", label: "Templates", icon: "templates", permission: "can_view_templates" },
  { href: "/dashboard/domains", label: "Domains", icon: "domains", permission: "can_manage_domains" },
  { href: "/dashboard/team", label: "Team", icon: "team", permission: "team.view" },
  { href: "/dashboard/activity-logs", label: "Activity Logs", icon: "monitoring", permission: "settings.view", anyPermissions: ["team.view", "settings.view"] },
  { href: "/dashboard/billing", label: "Billing", icon: "billing", permission: "can_manage_billing" },
  { href: "/dashboard/reseller", label: "Reseller", icon: "stores", permission: "can_manage_billing", showInSidebar: false },
  { href: "/dashboard/projects", label: "Projects", icon: "landings", permission: "can_edit_landings", showInSidebar: false },
  { href: "/dashboard/notifications", label: "Notifications", icon: "notifications", permission: "can_view_notifications" },
  { href: "/dashboard/email", label: "Email", icon: "notifications", permission: "can_view_notifications" },
  { href: "/dashboard/email-campaigns", label: "Email Campaigns", icon: "notifications", permission: "can_view_notifications" },
  { href: "/dashboard/settings/commerce", label: "Commerce settings", icon: "settings", permission: "settings.edit", showInSidebar: false },
  { href: "/dashboard/settings", label: "Settings", icon: "settings", permission: "settings.view" }
] as const;

export type DashboardRouteHref = (typeof dashboardRoutePermissions)[number]["href"];

export function getDashboardPermissionForPath(pathname: string): WorkspacePermission {
  return getDashboardPermissionsForPath(pathname)[0] ?? "can_view_overview";
}

export function getDashboardPermissionsForPath(pathname: string): readonly WorkspacePermission[] {
  const normalizedPath = pathname.split("?")[0]?.replace(/\/$/, "") || "/dashboard";
  const match = [...dashboardRoutePermissions]
    .sort((a, b) => b.href.length - a.href.length)
    .find((route) => normalizedPath === route.href || normalizedPath.startsWith(`${route.href}/`));

  return match?.anyPermissions ?? [match?.permission ?? "can_view_overview"];
}

export class PermissionDeniedError extends Error {
  permission: WorkspacePermission;
  role: WorkspaceRole | null;
  userId: string;
  workspaceId: string;

  constructor({
    permission,
    role,
    userId,
    workspaceId
  }: {
    permission: WorkspacePermission;
    role: WorkspaceRole | null;
    userId: string;
    workspaceId: string;
  }) {
    super("You do not have permission to perform this action.");
    this.name = "PermissionDeniedError";
    this.permission = permission;
    this.role = role;
    this.userId = userId;
    this.workspaceId = workspaceId;
  }
}

function isWorkspaceRole(value: string | null | undefined): value is WorkspaceRole {
  return (
    value === "owner" ||
    value === "admin" ||
    value === "editor" ||
    value === "support" ||
    value === "billing_manager" ||
    value === "viewer"
  );
}

export function hasPermission(
  role: WorkspaceRole | null | undefined,
  permission: WorkspacePermission,
  overrides?: PermissionOverrides | null
) {
  if (!role) {
    return false;
  }

  if (role === "owner") {
    return true;
  }

  const defaults = rolePermissions[role] ?? [];
  const aliases = legacyPermissionAliases[permission as LegacyWorkspacePermission] ?? [];
  const defaultAllowed =
    defaults.includes(permission) || aliases.some((alias) => defaults.includes(alias));

  if (!defaultAllowed) {
    return false;
  }

  const granularPermission =
    permission.includes(".") ? (permission as GranularPermission) : aliases[0] ?? null;

  if (granularPermission && overrides?.[granularPermission] === false) {
    return false;
  }

  return true;
}

function normalizePermissionOverrides(value: unknown): PermissionOverrides {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const input = value as Record<string, unknown>;
  const overrides: PermissionOverrides = {};

  for (const group of permissionGroups) {
    for (const action of permissionActions) {
      const permission = `${group}.${action}` as GranularPermission;
      if (typeof input[permission] === "boolean") {
        overrides[permission] = input[permission];
      }
    }
  }

  return overrides;
}

export async function getUserWorkspaceRole(
  supabase: SupabaseClient,
  workspaceId: string,
  userId: string
): Promise<WorkspaceRole | null> {
  if (workspaceId === userId) {
    console.info("[rbac] owner fallback role resolved", { userId, workspaceId });
    return "owner";
  }

  const { data, error } = await supabase
    .from("workspace_members" as never)
    .select("role, status, permission_overrides")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.warn("[rbac] role lookup failed", {
      message: error.message,
      userId,
      workspaceId
    });
    return null;
  }

  const membership = data as {
    permission_overrides?: unknown;
    role?: string | null;
    status?: string | null;
  } | null;
  const status = membership?.status ?? "active";
  if (status !== "active") {
    console.warn("[rbac] inactive workspace role blocked", {
      status,
      userId,
      workspaceId
    });
    return null;
  }

  const role = membership?.role ?? null;
  const resolvedRole = isWorkspaceRole(role) ? role : null;

  console.info("[rbac] workspace role resolved", {
    role: resolvedRole,
    userId,
    workspaceId
  });

  return resolvedRole;
}

export async function requirePermission({
  permission,
  supabase,
  userId,
  workspaceId
}: {
  permission: WorkspacePermission;
  supabase: SupabaseClient;
  userId: string;
  workspaceId: string;
}) {
  const role = await getUserWorkspaceRole(supabase, workspaceId, userId);
  const overrides = await getUserWorkspacePermissionOverrides(supabase, workspaceId, userId);
  const allowed = hasPermission(role, permission, overrides);

  if (!allowed) {
    console.warn("[permission-denied] workspace permission denied", {
      permission,
      role,
      userId,
      workspaceId
    });
    throw new PermissionDeniedError({ permission, role, userId, workspaceId });
  }

  console.info("[permission-granted] workspace permission granted", {
    permission,
    role,
    userId,
    workspaceId
  });

  return { role };
}

export async function getUserWorkspacePermissionOverrides(
  supabase: SupabaseClient,
  workspaceId: string,
  userId: string
): Promise<PermissionOverrides> {
  if (workspaceId === userId) {
    return {};
  }

  const { data, error } = await supabase
    .from("workspace_members" as never)
    .select("permission_overrides")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.warn("[rbac] permission overrides lookup failed", {
      message: error.message,
      userId,
      workspaceId
    });
  }

  return normalizePermissionOverrides(
    (data as { permission_overrides?: unknown } | null)?.permission_overrides
  );
}

export function resolveRolePermissionState(
  role: WorkspaceRole,
  overrides?: PermissionOverrides | null
) {
  return Object.fromEntries(
    allGranularPermissions.map((permission) => [
      permission,
      hasPermission(role, permission, overrides)
    ])
  ) as Record<GranularPermission, boolean>;
}

export async function getUserPrimaryWorkspaceId(supabase: SupabaseClient, userId: string) {
  const selection = await getActiveWorkspaceForUser({ supabase, userId });

  console.info("[workspace-selection] primary workspace resolved", {
    source: selection.source,
    userId,
    workspaceId: selection.activeWorkspaceId
  });

  return selection.activeWorkspaceId;
}
