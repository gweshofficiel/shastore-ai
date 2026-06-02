import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspaceForUser } from "@/lib/workspaces/active-workspace";

export const dynamic = "force-dynamic";

type ActivityLogRow = {
  action: string;
  actor_email: string | null;
  actor_user_id: string | null;
  created_at: string;
  entity_id: string | null;
  entity_type: string;
  id: string;
  metadata: Record<string, unknown> | null;
  store_id: string | null;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

function formatLabel(value: string | null | undefined) {
  return (value || "unknown").replace(/[._-]/g, " ");
}

function metadataSummary(metadata: Record<string, unknown> | null) {
  const entries = Object.entries(metadata ?? {})
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .slice(0, 4);

  if (!entries.length) {
    return "No extra details.";
  }

  return entries
    .map(([key, value]) => `${formatLabel(key)}: ${Array.isArray(value) ? value.join(", ") : String(value)}`)
    .join(" • ");
}

export default async function ActivityLogsPage() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="grid gap-6">
        <PageHeader description="Sign in to review workspace activity." title="Activity Logs" />
        <Card className="p-6">
          <p className="text-sm font-bold text-muted">Please sign in to view activity logs.</p>
        </Card>
      </div>
    );
  }

  const selection = await getActiveWorkspaceForUser({ supabase, userId: user.id });
  const { data, error } = await supabase
    .from("workspace_activity_logs" as never)
    .select("id, store_id, actor_user_id, actor_email, action, entity_type, entity_id, metadata, created_at")
    .eq("workspace_id" as never, selection.activeWorkspaceId as never)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.warn("[activity-logs] load failed", {
      message: error.message,
      userId: user.id,
      workspaceId: selection.activeWorkspaceId
    });
  }

  const logs = (data ?? []) as unknown as ActivityLogRow[];

  return (
    <div className="grid gap-6 lg:gap-8">
      <PageHeader
        description="Workspace and store activity for team, permissions, content, orders, products, and settings."
        title="Activity Logs"
      />
      <Card className="p-5">
        <p className="text-sm font-bold text-muted">
          Showing the latest {logs.length} activity events for the active workspace.
        </p>
      </Card>
      <div className="grid gap-4">
        {logs.length ? (
          logs.map((log) => (
            <Card className="p-5" key={log.id}>
              <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                    {formatLabel(log.action)}
                  </p>
                  <h2 className="mt-2 text-lg font-black tracking-[-0.02em] text-ink">
                    {formatLabel(log.entity_type)}
                    {log.entity_id ? ` • ${log.entity_id.slice(0, 12)}` : ""}
                  </h2>
                  <p className="mt-2 text-sm font-semibold leading-6 text-muted">
                    {metadataSummary(log.metadata)}
                  </p>
                  <p className="mt-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                    Actor: {log.actor_email ?? log.actor_user_id ?? "system"}
                  </p>
                </div>
                <div className="text-sm font-black text-slate-500">{formatDate(log.created_at)}</div>
              </div>
            </Card>
          ))
        ) : (
          <Card className="p-6">
            <p className="text-sm font-bold text-muted">No activity logs yet.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
