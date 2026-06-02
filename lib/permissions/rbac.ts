import type { SupabaseClient } from "@supabase/supabase-js";
import { getActiveWorkspaceForUser } from "@/lib/workspaces/active-workspace";

export type WorkspaceRole = "owner" | "admin" | "editor" | "support" | "billing_manager" | "viewer";

export type WorkspacePermission =
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

export const rolePermissions: Record<WorkspaceRole, WorkspacePermission[]> = {
  owner: [
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
    "can_view_overview",
    "view_orders",
    "can_view_orders",
    "can_view_customers",
    "view_analytics",
    "can_view_notifications",
    "can_view_settings"
  ],
  billing_manager: [
    "manage_billing",
    "can_manage_billing",
    "can_manage_payments",
    "can_view_notifications",
    "can_view_settings"
  ],
  viewer: ["can_view_overview", "can_view_notifications", "can_view_settings"]
};

export const dashboardRoutePermissions = [
  { href: "/dashboard", label: "Overview", icon: "overview", permission: "can_view_overview" },
  { href: "/dashboard/landings/new", label: "New landing", icon: "landings", permission: "can_edit_landings", showInSidebar: false },
  { href: "/dashboard/landings", label: "Landings", icon: "landings", permission: "can_view_landings" },
  { href: "/dashboard/stores/new", label: "New store", icon: "stores", permission: "can_edit_stores", showInSidebar: false },
  { href: "/dashboard/stores", label: "Stores", icon: "stores", permission: "can_view_stores" },
  { href: "/dashboard/homepage", label: "Homepage", icon: "pages", permission: "can_edit_stores" },
  { href: "/dashboard/navigation", label: "Navigation", icon: "navigation", permission: "can_edit_stores" },
  { href: "/dashboard/pages", label: "Pages", icon: "pages", permission: "can_edit_stores" },
  { href: "/dashboard/about", label: "About Us", icon: "pages", permission: "can_edit_stores" },
  { href: "/dashboard/legal-pages", label: "Legal Pages", icon: "pages", permission: "can_edit_stores" },
  { href: "/dashboard/footer-links", label: "Footer Links", icon: "pages", permission: "can_edit_stores" },
  { href: "/dashboard/contact", label: "Contact", icon: "pages", permission: "can_edit_stores" },
  { href: "/dashboard/blog", label: "Blog / Articles", icon: "pages", permission: "can_edit_stores" },
  { href: "/dashboard/faq", label: "FAQ", icon: "pages", permission: "can_edit_stores" },
  { href: "/dashboard/products", label: "Products", icon: "products", permission: "can_edit_stores" },
  { href: "/dashboard/categories", label: "Categories", icon: "products", permission: "manage_products" },
  { href: "/dashboard/back-in-stock", label: "Back in stock", icon: "products", permission: "manage_products" },
  { href: "/dashboard/product-qa", label: "Product Q&A", icon: "products", permission: "manage_products" },
  { href: "/dashboard/orders", label: "Orders", icon: "orders", permission: "can_view_orders" },
  { href: "/dashboard/abandoned-carts", label: "Abandoned carts", icon: "orders", permission: "can_view_orders" },
  { href: "/dashboard/customers", label: "Customers", icon: "customers", permission: "can_view_customers" },
  { href: "/dashboard/reviews", label: "Reviews", icon: "customers", permission: "manage_products" },
  { href: "/dashboard/analytics", label: "Analytics", icon: "analytics", permission: "view_analytics" },
  { href: "/dashboard/monitoring", label: "Monitoring", icon: "monitoring", permission: "view_analytics" },
  { href: "/dashboard/support", label: "Support", icon: "support", permission: "can_view_notifications" },
  { href: "/dashboard/payments", label: "Payments", icon: "payments", permission: "can_manage_payments" },
  { href: "/dashboard/tax", label: "Tax", icon: "payments", permission: "can_manage_payments" },
  { href: "/dashboard/shipping", label: "Shipping", icon: "shipping", permission: "can_manage_shipping" },
  { href: "/dashboard/templates/studio", label: "Template studio", icon: "templates", permission: "can_edit_templates", showInSidebar: false },
  { href: "/dashboard/templates", label: "Templates", icon: "templates", permission: "can_view_templates" },
  { href: "/dashboard/domains", label: "Domains", icon: "domains", permission: "can_manage_domains" },
  { href: "/dashboard/team", label: "Team", icon: "team", permission: "can_manage_team" },
  { href: "/dashboard/billing", label: "Billing", icon: "billing", permission: "can_manage_billing" },
  { href: "/dashboard/reseller", label: "Reseller", icon: "stores", permission: "can_manage_billing", showInSidebar: false },
  { href: "/dashboard/projects", label: "Projects", icon: "landings", permission: "can_edit_landings", showInSidebar: false },
  { href: "/dashboard/notifications", label: "Notifications", icon: "notifications", permission: "can_view_notifications" },
  { href: "/dashboard/email", label: "Email", icon: "notifications", permission: "can_view_notifications" },
  { href: "/dashboard/settings/commerce", label: "Commerce settings", icon: "settings", permission: "can_manage_shipping", showInSidebar: false },
  { href: "/dashboard/settings", label: "Settings", icon: "settings", permission: "can_view_settings" }
] as const satisfies ReadonlyArray<{
  href: string;
  icon: string;
  label: string;
  permission: WorkspacePermission;
  showInSidebar?: boolean;
}>;

export type DashboardRouteHref = (typeof dashboardRoutePermissions)[number]["href"];

export function getDashboardPermissionForPath(pathname: string): WorkspacePermission {
  const normalizedPath = pathname.split("?")[0]?.replace(/\/$/, "") || "/dashboard";
  const match = [...dashboardRoutePermissions]
    .sort((a, b) => b.href.length - a.href.length)
    .find((route) => normalizedPath === route.href || normalizedPath.startsWith(`${route.href}/`));

  return match?.permission ?? "can_view_overview";
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
  permission: WorkspacePermission
) {
  return Boolean(role && rolePermissions[role]?.includes(permission));
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
    .select("role, status")
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

  const membership = data as { role?: string | null; status?: string | null } | null;
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
  const allowed = hasPermission(role, permission);

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

export async function getUserPrimaryWorkspaceId(supabase: SupabaseClient, userId: string) {
  const selection = await getActiveWorkspaceForUser({ supabase, userId });

  console.info("[workspace-selection] primary workspace resolved", {
    source: selection.source,
    userId,
    workspaceId: selection.activeWorkspaceId
  });

  return selection.activeWorkspaceId;
}
