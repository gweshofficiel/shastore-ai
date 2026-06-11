import { NextRequest, NextResponse } from "next/server";
import { getAdminAccess } from "@/lib/admin-access";
import { getAdminUsers, type AdminUser } from "@/lib/admin/data";
import {
  adminUserRuntimeFiltersFromParams,
  filterAdminUsersForRuntime
} from "@/lib/admin/user-runtime-filters";
import { getRequestAuditFields, recordSecurityAuditLog } from "@/lib/security/audit";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type ExportFormat = "csv" | "json";

type SafeUserExportRow = {
  created_at: string | null;
  email: string;
  role: string;
  status: string;
  stores_count: number;
  subscription_current_period_end: string | null;
  subscription_plan_id: string;
  subscription_plan_name: string;
  subscription_status: string;
  user_id: string;
};

function exportFormat(value: string | null): ExportFormat | null {
  return value === "csv" || value === "json" ? value : null;
}

function safeExportRow(user: AdminUser): SafeUserExportRow {
  return {
    created_at: user.createdAt,
    email: user.email,
    role: user.primaryRole,
    status: user.accountStatus,
    stores_count: user.storesCount,
    subscription_current_period_end: user.subscription.currentPeriodEnd,
    subscription_plan_id: user.subscription.planId,
    subscription_plan_name: user.subscription.planName,
    subscription_status: user.subscription.status,
    user_id: user.id
  };
}

function csvValue(value: string | number | null) {
  const raw = String(value ?? "");

  if (/[",\r\n]/.test(raw)) {
    return `"${raw.replaceAll("\"", "\"\"")}"`;
  }

  return raw;
}

function rowsToCsv(rows: SafeUserExportRow[]) {
  const headers: Array<keyof SafeUserExportRow> = [
    "user_id",
    "email",
    "role",
    "status",
    "created_at",
    "stores_count",
    "subscription_plan_id",
    "subscription_plan_name",
    "subscription_status",
    "subscription_current_period_end"
  ];
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvValue(row[header])).join(","))
  ];

  return lines.join("\n");
}

async function recordExportAudit({
  actorUserId,
  format,
  rowCount
}: {
  actorUserId: string;
  format: ExportFormat;
  rowCount: number;
}) {
  const admin = createAdminClient();

  if (!admin) {
    return;
  }

  const requestAudit = await getRequestAuditFields();

  await admin.from("monitoring_events" as never).insert({
    entity_id: actorUserId,
    entity_type: "admin_user_export",
    event_status: "info",
    event_type: "admin_users_exported",
    metadata: {
      format,
      row_count: rowCount,
      safe_fields_only: true,
      source: "super_admin_users_runtime"
    },
    store_id: null,
    user_id: actorUserId,
    workspace_id: null
  } as never);

  await recordSecurityAuditLog({
    ...requestAudit,
    action: "admin_users_exported",
    client: admin,
    metadata: {
      format,
      row_count: rowCount,
      safe_fields_only: true,
      source: "super_admin_users_runtime"
    },
    reason: "Super Admin exported safe user summaries from the Users Runtime.",
    route: "/admin/users/export",
    userId: actorUserId
  });
}

export async function GET(request: NextRequest) {
  const format = exportFormat(request.nextUrl.searchParams.get("format"));

  if (!format) {
    return NextResponse.json({ error: "Unsupported export format." }, { status: 400 });
  }

  const access = await getAdminAccess();
  const filters = adminUserRuntimeFiltersFromParams({
    plan: request.nextUrl.searchParams.get("plan"),
    q: request.nextUrl.searchParams.get("q"),
    risk: request.nextUrl.searchParams.get("risk"),
    role: request.nextUrl.searchParams.get("role"),
    status: request.nextUrl.searchParams.get("status"),
    stores: request.nextUrl.searchParams.get("stores")
  });
  const rows = filterAdminUsersForRuntime(await getAdminUsers(), filters).map(safeExportRow);
  const filename = `admin-users-${new Date().toISOString().slice(0, 10)}.${format}`;

  await recordExportAudit({
    actorUserId: access.user.id,
    format,
    rowCount: rows.length
  });

  if (format === "json") {
    return NextResponse.json(rows, {
      headers: {
        "content-disposition": `attachment; filename="${filename}"`
      }
    });
  }

  return new NextResponse(rowsToCsv(rows), {
    headers: {
      "content-disposition": `attachment; filename="${filename}"`,
      "content-type": "text/csv; charset=utf-8"
    }
  });
}
