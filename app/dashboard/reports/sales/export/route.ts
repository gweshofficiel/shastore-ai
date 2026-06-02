import { NextRequest, NextResponse } from "next/server";
import { getUserPrimaryWorkspaceId, getUserWorkspaceRole, hasPermission } from "@/lib/permissions/rbac";
import { loadSalesReport, salesReportToCsv } from "@/lib/sales-reports";
import { createClient } from "@/lib/supabase/server";
import { fetchStoresForAuthUser } from "@/lib/stores/user-stores";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceId = await getUserPrimaryWorkspaceId(supabase, user.id);
  const role = await getUserWorkspaceRole(supabase, workspaceId, user.id);

  if (!hasPermission(role, "view_analytics")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { stores } = await fetchStoresForAuthUser(supabase, user.id, workspaceId);
  const report = await loadSalesReport({
    from: request.nextUrl.searchParams.get("from") ?? undefined,
    period: request.nextUrl.searchParams.get("period") ?? undefined,
    selectedStoreId: request.nextUrl.searchParams.get("storeId") ?? undefined,
    stores,
    supabase,
    to: request.nextUrl.searchParams.get("to") ?? undefined,
    workspaceId
  });
  const csv = salesReportToCsv(report);
  const filename = `sales-report-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "content-disposition": `attachment; filename="${filename}"`,
      "content-type": "text/csv; charset=utf-8"
    }
  });
}
