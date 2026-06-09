import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function DeliveryProfileAliasPage() {
  redirect("/delivery/dashboard/profile");
}
