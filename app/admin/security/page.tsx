import {
  AdminBadge,
  AdminHeader,
  AdminStatGrid,
  AdminTable,
  formatAdminDate
} from "@/components/admin/admin-control";
import { createAdminClient } from "@/lib/supabase/admin";

type SecurityAuditLogRow = {
  action: string;
  created_at: string;
  id: string;
  ip_address: string | null;
  reason: string;
  route: string | null;
  store_id: string | null;
  user_agent: string | null;
  user_id: string | null;
  workspace_id: string | null;
};

function badgeTone(action: string) {
  if (action.includes("rate_limit")) {
    return "amber" as const;
  }

  if (action.includes("denied") || action.includes("required")) {
    return "red" as const;
  }

  return "slate" as const;
}

export default async function AdminSecurityPage() {
  const admin = createAdminClient();
  const { data, error } = admin
    ? await admin
        .from("security_audit_logs" as never)
        .select(
          "id, workspace_id, store_id, user_id, action, reason, route, ip_address, user_agent, created_at"
        )
        .order("created_at" as never, { ascending: false } as never)
        .limit(100)
    : { data: null, error: new Error("Admin client unavailable.") };
  const logs = ((data ?? []) as unknown as SecurityAuditLogRow[]);
  const deniedCount = logs.filter((log) => log.action.includes("denied")).length;
  const rateLimitCount = logs.filter((log) => log.action.includes("rate_limit")).length;
  const uniqueUsers = new Set(logs.map((log) => log.user_id).filter(Boolean)).size;

  return (
    <div className="grid gap-6 lg:gap-8">
      <AdminHeader
        description="Security audit foundation for denied access, rate-limit events, and suspicious platform actions."
        title="Security"
      />
      <AdminStatGrid
        stats={[
          { label: "Recent events", value: logs.length },
          { label: "Denied attempts", value: deniedCount },
          { label: "Rate limit events", value: rateLimitCount },
          { label: "Users observed", value: uniqueUsers }
        ]}
      />
      <AdminTable
        empty={
          error
            ? "Security logs are not available yet. Apply the security_audit_logs migration to enable this page."
            : logs.length
              ? null
              : "No security audit events recorded yet."
        }
        headers={["Event", "Reason", "Route", "Scope", "Client", "Created"]}
      >
        {logs.map((log) => (
          <tr key={log.id}>
            <td className="px-5 py-4">
              <AdminBadge tone={badgeTone(log.action)}>{log.action}</AdminBadge>
            </td>
            <td className="px-5 py-4 font-bold text-slate-950">{log.reason}</td>
            <td className="px-5 py-4 text-slate-600">{log.route ?? "Not recorded"}</td>
            <td className="px-5 py-4 text-slate-500">
              <div className="grid gap-1">
                <span>Workspace: {log.workspace_id ?? "n/a"}</span>
                <span>Store: {log.store_id ?? "n/a"}</span>
                <span>User: {log.user_id ?? "anonymous"}</span>
              </div>
            </td>
            <td className="px-5 py-4 text-slate-500">
              <div className="grid gap-1">
                <span>{log.ip_address ?? "IP not recorded"}</span>
                <span className="max-w-xs truncate">{log.user_agent ?? "Agent not recorded"}</span>
              </div>
            </td>
            <td className="px-5 py-4 text-slate-500">{formatAdminDate(log.created_at)}</td>
          </tr>
        ))}
      </AdminTable>
    </div>
  );
}
