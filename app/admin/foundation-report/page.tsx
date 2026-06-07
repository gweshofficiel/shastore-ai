import {
  AdminBadge,
  AdminHeader,
  AdminStatGrid,
  AdminTable,
  formatAdminMoney
} from "@/components/admin/admin-control";
import { adminNavItems } from "@/components/admin/admin-sidebar";
import { getAdminOverview, getAdminPlatformHealth, getAdminUsers } from "@/lib/admin/data";

type FoundationStatus = "missing" | "partial" | "ready";

type AdminHref =
  | "/admin"
  | "/admin/users"
  | "/admin/subscriptions"
  | "/admin/billing/payment-providers"
  | "/admin/domains-hosting"
  | "/admin/integrations"
  | "/admin/ai"
  | "/admin/platform-website"
  | "/admin/platform-theme"
  | "/admin/templates"
  | "/admin/marketplace"
  | "/admin/foundation-report"
  | "/admin/sellers"
  | "/admin/resellers"
  | "/admin/reports"
  | "/admin/support"
  | "/admin/security"
  | "/admin/moderation"
  | "/admin/settings"
  | "/admin/stores";

type FoundationModule = {
  href?: AdminHref;
  name: string;
  notes: string;
  status: FoundationStatus;
};

const modules: FoundationModule[] = [
  {
    href: "/admin",
    name: "Overview",
    notes: "Uses real users, stores, revenue, orders, visitors, conversion rate, and platform health.",
    status: "ready"
  },
  {
    href: "/admin/users",
    name: "Users",
    notes: "Uses real user, plan, status, created date, store count, and action data.",
    status: "ready"
  },
  {
    href: "/admin/security",
    name: "Security",
    notes: "Uses real security audit logs for login events, access denials, and rate limits.",
    status: "ready"
  },
  {
    href: "/admin/support",
    name: "Support",
    notes: "Uses real support tickets, monitoring events, and error events.",
    status: "ready"
  },
  {
    href: "/admin/sellers",
    name: "Sellers",
    notes: "Navigation and placeholder foundation exist; detailed seller operations remain future work.",
    status: "partial"
  },
  {
    href: "/admin/resellers",
    name: "Resellers",
    notes: "Navigation and placeholder foundation exist; reseller verification and operations remain future work.",
    status: "partial"
  },
  {
    href: "/admin/reports",
    name: "Reports",
    notes: "Placeholder foundation exists; consolidated platform reporting remains future work.",
    status: "partial"
  },
  {
    href: "/admin/moderation",
    name: "Moderation",
    notes: "Placeholder foundation exists; abuse queues and moderation actions remain future work.",
    status: "partial"
  },
  {
    href: "/admin/settings",
    name: "Settings",
    notes: "Admin access settings exist; broader operational controls remain future work.",
    status: "partial"
  },
  {
    href: "/admin/billing/payment-providers",
    name: "Payment Providers",
    notes: "Admin monitoring foundation exists for provider configuration, store payment adoption, webhook events, and safe placeholder controls.",
    status: "ready"
  },
  {
    href: "/admin/domains-hosting",
    name: "Domain & Hosting",
    notes: "Admin monitoring foundation exists for domain drafts, email mailbox drafts, DNS/SSL state, hosting placeholders, balance placeholders, and safe review controls.",
    status: "ready"
  },
  {
    href: "/admin/integrations",
    name: "Platform Integrations",
    notes: "Central integration monitoring exists for AI, payments, domain/email/hosting, email sending, storage, SMS/WhatsApp, analytics, and webhook placeholders with masked secret status only.",
    status: "ready"
  },
  {
    href: "/admin/ai",
    name: "AI Control",
    notes: "Admin monitoring foundation exists for AI visual jobs, provider status, store usage, failure monitoring, safe public asset links, and governance placeholders.",
    status: "ready"
  },
  {
    href: "/admin/platform-website",
    name: "Platform Website",
    notes: "Admin management foundation exists for SHASTORE public pages, landing readiness, SEO previews, multilingual placeholders, and safe page status controls.",
    status: "ready"
  },
  {
    href: "/admin/platform-theme",
    name: "Platform Theme",
    notes: "Admin management foundation exists for SHASTORE SaaS and public platform branding previews, RTL/LTR readiness, and safe placeholder branding actions.",
    status: "ready"
  },
  {
    href: "/admin/templates",
    name: "Templates",
    notes: "Admin management foundation exists over the existing template library and package registry with visibility controls, package summaries, version placeholders, and safe governance actions.",
    status: "ready"
  },
  {
    href: "/admin/marketplace",
    name: "Marketplace",
    notes: "Admin management foundation exists for template, theme, plugin, app, and service marketplace preparation with approval workflow placeholders and no payments or installs.",
    status: "ready"
  },
  {
    name: "Billing Center",
    notes: "Dedicated billing operations center is not built yet; subscription controls remain separate.",
    status: "missing"
  },
  {
    name: "AI Center",
    notes: "AI Control Center is available for global monitoring; provider pausing, store-level AI disablement, failed-job retry, exports, and cost enforcement remain future work.",
    status: "partial"
  },
  {
    name: "Domain Center",
    notes: "Domain and hosting control center is available for monitoring; real provider registration, mailbox creation, SSL issuance, and hosting provisioning remain future work.",
    status: "partial"
  },
  {
    name: "Marketplace",
    notes: "Marketplace administration is not built yet.",
    status: "missing"
  },
  {
    name: "Operations",
    notes: "Central operations command center is not built yet.",
    status: "missing"
  }
];

function statusTone(status: FoundationStatus) {
  if (status === "ready") {
    return "green" as const;
  }

  if (status === "partial") {
    return "amber" as const;
  }

  return "red" as const;
}

function statusLabel(status: FoundationStatus) {
  return status === "ready" ? "Ready" : status === "partial" ? "Partial" : "Missing";
}

function readinessScore() {
  const score = modules.reduce((total, module) => {
    if (module.status === "ready") {
      return total + 1;
    }

    if (module.status === "partial") {
      return total + 0.5;
    }

    return total;
  }, 0);

  return Math.round((score / modules.length) * 100);
}

export default async function AdminFoundationReportPage() {
  const [overview, users, health] = await Promise.all([
    getAdminOverview(),
    getAdminUsers(),
    getAdminPlatformHealth()
  ]);
  const ready = modules.filter((module) => module.status === "ready");
  const partial = modules.filter((module) => module.status === "partial");
  const missing = modules.filter((module) => module.status === "missing");
  const navHrefs = new Set<AdminHref>(adminNavItems.map((item) => item.href as AdminHref));
  const expectedNavModules = modules.filter(
    (module): module is FoundationModule & { href: AdminHref } => Boolean(module.href)
  );
  const navigationGaps = expectedNavModules.filter((module) => !navHrefs.has(module.href));

  return (
    <div className="grid gap-6 lg:gap-8">
      <AdminHeader
        description="Production-safety audit for the Super Admin foundation using real platform data and existing modules."
        title="Super Admin Foundation Report"
      />

      <AdminStatGrid
        stats={[
          { label: "Readiness score", value: `${readinessScore()}%` },
          { label: "Ready modules", value: ready.length },
          { label: "Partial modules", value: partial.length },
          { label: "Missing modules", value: missing.length },
          { label: "Users audited", value: users.length },
          { label: "Stores", value: overview.stores },
          { label: "Revenue estimate", value: formatAdminMoney(overview.revenueEstimate) },
          { label: "Platform health", value: health.label }
        ]}
      />

      <AdminTable headers={["Module", "Status", "Route", "Audit notes"]}>
        {modules.map((module) => (
          <tr key={module.name}>
            <td className="px-5 py-4 font-bold text-slate-950">{module.name}</td>
            <td className="px-5 py-4">
              <AdminBadge tone={statusTone(module.status)}>{statusLabel(module.status)}</AdminBadge>
            </td>
            <td className="px-5 py-4 text-slate-600">{module.href ?? "Not created"}</td>
            <td className="px-5 py-4 text-slate-500">{module.notes}</td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable headers={["Navigation check", "Status", "Details"]}>
        <tr>
          <td className="px-5 py-4 font-bold text-slate-950">Ready and partial routes</td>
          <td className="px-5 py-4">
            <AdminBadge tone={navigationGaps.length ? "red" : "green"}>
              {navigationGaps.length ? "Needs review" : "Ready"}
            </AdminBadge>
          </td>
          <td className="px-5 py-4 text-slate-500">
            {navigationGaps.length
              ? `Missing navigation entries: ${navigationGaps.map((module) => module.name).join(", ")}`
              : "All ready and partial foundation routes are present in Super Admin navigation."}
          </td>
        </tr>
        <tr>
          <td className="px-5 py-4 font-bold text-slate-950">Missing modules</td>
          <td className="px-5 py-4"><AdminBadge tone="amber">Intentional</AdminBadge></td>
          <td className="px-5 py-4 text-slate-500">
            Missing modules are reported here but not added to navigation until real foundations exist.
          </td>
        </tr>
      </AdminTable>
    </div>
  );
}
