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

  await supabase
    .from("notifications" as never)
    .update({ read_at: new Date().toISOString() } as never)
    .eq("id", notificationId)
    .eq("user_id", user.id);

  revalidatePath("/dashboard/notifications");
  revalidatePath("/dashboard");
}

export async function markAllNotificationsRead() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return;
  }

  await supabase
    .from("notifications" as never)
    .update({ read_at: new Date().toISOString() } as never)
    .eq("user_id", user.id)
    .is("read_at", null);

  revalidatePath("/dashboard/notifications");
  revalidatePath("/dashboard");
}
