import {
  AdminBadge,
  AdminStatGrid,
  formatAdminDate
} from "@/components/admin/admin-control";
import type { PlatformThemeRuntimeStatus } from "@/src/lib/platform-theme/platform-theme-runtime";

function runtimeTone(status: boolean) {
  return status ? "green" as const : "amber" as const;
}

function overallTone(status: PlatformThemeRuntimeStatus["overallStatus"]) {
  if (status === "ready") return "green" as const;
  if (status === "needs_attention") return "amber" as const;
  return "red" as const;
}

function optionLabel(value: string) {
  return value.replaceAll("_", " ");
}

export function PlatformThemeLiveRuntimePanel({
  runtime,
  source
}: {
  runtime: PlatformThemeRuntimeStatus;
  source: "defaults" | "published";
}) {
  return (
    <section className="grid gap-5 rounded-3xl border border-slate-200 bg-white p-5" id="theme-live-runtime">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Theme Live Runtime Status</p>
        <h2 className="mt-2 text-xl font-black tracking-[-0.03em] text-slate-950">Published theme live binding</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          Read-only verification that published platform theme values are bound to the live platform website shell. Draft values, storage credentials, and customer storefront data are never exposed.
        </p>
      </div>

      <AdminStatGrid
        stats={[
          { label: "Runtime source", value: source === "published" ? "Published theme" : "Safe defaults" },
          { label: "Overall status", value: optionLabel(runtime.overallStatus) },
          { label: "Published connected", value: runtime.publishedThemeConnected ? "Yes" : "No" },
          { label: "Logo bound", value: runtime.logoBound ? "Yes" : "Fallback" },
          { label: "Favicon bound", value: runtime.faviconBound ? "Yes" : "Fallback" },
          { label: "Colors bound", value: runtime.colorsBound ? "Yes" : "Fallback" }
        ]}
      />

      <div className="grid gap-2 lg:grid-cols-2">
        {[
          { bound: runtime.publishedThemeConnected, label: "Published theme connected" },
          { bound: runtime.logoBound, label: "Logo bound" },
          { bound: runtime.faviconBound, label: "Favicon bound" },
          { bound: runtime.colorsBound, label: "Colors bound" },
          { bound: runtime.typographyBound, label: "Typography bound" },
          { bound: runtime.landingPagesBound, label: "Landing pages bound" },
          { bound: runtime.navbarBound, label: "Navbar bound" },
          { bound: runtime.footerBound, label: "Footer bound" }
        ].map((item) => (
          <div key={item.label} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <span className="text-sm font-semibold text-slate-700">{item.label}</span>
            <AdminBadge tone={runtimeTone(item.bound)}>{item.bound ? "bound" : "fallback"}</AdminBadge>
          </div>
        ))}
      </div>

      <p className="text-sm font-semibold text-slate-500">
        Verified at {formatAdminDate(new Date().toISOString())}. Overall runtime status:{" "}
        <AdminBadge tone={overallTone(runtime.overallStatus)}>{runtime.overallStatus}</AdminBadge>
      </p>
    </section>
  );
}
