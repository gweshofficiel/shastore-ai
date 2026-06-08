import { redirect } from "next/navigation";
import { getCurrentDeliveryAccess } from "@/lib/delivery/access";

export const dynamic = "force-dynamic";

export default async function DeliveryIndexPage() {
  const { role, user } = await getCurrentDeliveryAccess();

  if (user && role && role !== "suspended_delivery") {
    redirect("/delivery/dashboard");
  }

  redirect("/delivery/login");
}
