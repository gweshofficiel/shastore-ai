"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function markNotificationRead(formData: FormData) {
  const notificationId = String(formData.get("notificationId") ?? "").trim();
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user || !notificationId) {
    return;
  }

  const { data, error } = await supabase
    .from("notifications" as never)
    .update({ read_at: new Date().toISOString() } as never)
    .eq("id", notificationId)
    .eq("user_id", user.id)
    .is("read_at", null)
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

  const { data, error } = await supabase
    .from("notifications" as never)
    .update({ read_at: new Date().toISOString() } as never)
    .eq("user_id", user.id)
    .is("read_at", null)
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
