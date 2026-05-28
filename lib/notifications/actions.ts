"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspaceForUser } from "@/lib/workspaces/active-workspace";

export async function markNotificationRead(formData: FormData) {
  const notificationId = String(formData.get("notificationId") ?? "").trim();
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user || !notificationId) {
    return;
  }

  const selection = await getActiveWorkspaceForUser({ supabase, userId: user.id });
  const { data, error } = await supabase
    .from("notifications" as never)
    .update({ read_at: new Date().toISOString(), status: "read" } as never)
    .eq("id", notificationId)
    .or(`user_id.eq.${user.id},workspace_id.eq.${selection.activeWorkspaceId}`)
    .eq("status" as never, "unread" as never)
    .select("id");

  if (error) {
    console.warn("[notification-read] mark single failed", {
      message: error.message,
      notificationId,
      userId: user.id
    });
    return;
  }

  console.info("[notification-read] single notification marked read", {
    notificationId,
    updatedCount: data?.length ?? 0,
    userId: user.id
  });

  revalidatePath("/dashboard/notifications");
  revalidatePath("/dashboard", "layout");
}

export async function markAllNotificationsRead() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return;
  }

  const selection = await getActiveWorkspaceForUser({ supabase, userId: user.id });
  const { data, error } = await supabase
    .from("notifications" as never)
    .update({ read_at: new Date().toISOString(), status: "read" } as never)
    .or(`user_id.eq.${user.id},workspace_id.eq.${selection.activeWorkspaceId}`)
    .eq("status" as never, "unread" as never)
    .select("id");

  if (error) {
    console.warn("[notification-read] mark all failed", {
      message: error.message,
      userId: user.id
    });
    return;
  }

  console.info("[notification-read] all notifications marked read", {
    updatedCount: data?.length ?? 0,
    userId: user.id
  });

  revalidatePath("/dashboard/notifications");
  revalidatePath("/dashboard", "layout");
}
