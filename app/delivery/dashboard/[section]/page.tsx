import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

const sectionDetails = {
  notifications: {
    description: "Reserved for delivery account alerts, order updates, and support notices.",
    title: "Notifications"
  },
  orders: {
    description: "Reserved for future assigned orders. No real order assignment happens yet.",
    title: "Assigned Orders"
  },
  profile: {
    description: "Reserved for delivery profile, identity, service area, and fulfillment preferences.",
    title: "Profile"
  },
  settings: {
    description: "Reserved for delivery account settings and notification preferences.",
    title: "Settings"
  },
  status: {
    description: "Reserved for availability, route status, and capacity controls.",
    title: "Delivery Status"
  },
  support: {
    description: "Reserved for support requests and delivery account review.",
    title: "Support"
  }
} as const;

export default async function DeliverySectionPage({
  params
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  const detail = sectionDetails[section as keyof typeof sectionDetails];

  if (!detail) {
    notFound();
  }

  return (
    <section className="rounded-[2rem] border border-emerald-100 bg-white/85 p-5 shadow-[0_24px_80px_-54px_rgba(6,78,59,0.65)] backdrop-blur lg:p-6">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-500">
        Delivery foundation
      </p>
      <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] text-slate-950 sm:text-4xl">
        {detail.title}
      </h1>
      <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
        {detail.description}
      </p>
      <div className="mt-6 rounded-3xl border border-dashed border-emerald-200 bg-emerald-50 p-5">
        <p className="text-sm font-bold leading-6 text-emerald-950">
          Placeholder only. This route prepares the delivery account surface without reading,
          assigning, updating, collecting for, or returning real orders.
        </p>
      </div>
      <Link
        className="mt-6 inline-flex h-11 items-center rounded-2xl bg-emerald-950 px-5 text-sm font-black text-white"
        href="/delivery/dashboard"
      >
        Back to overview
      </Link>
    </section>
  );
}
