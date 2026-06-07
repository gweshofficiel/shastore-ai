import {
  AdminBadge,
  AdminHeader,
  AdminStatGrid,
  AdminTable
} from "@/components/admin/admin-control";
import { getAdminPlatformSettingsControl } from "@/lib/admin/data";
import {
  exportSettingsSnapshotPlaceholder,
  featureFlagRolloutPlaceholder,
  maintenanceModePlaceholder,
  savePlatformSettingsPlaceholder,
  taxRulesEnginePlaceholder
} from "@/lib/admin/settings-actions";

function toneForStatus(status: string) {
  if (["enabled", "enforced", "ready"].includes(status)) {
    return "green" as const;
  }

  if (["off_placeholder", "placeholder", "placeholder_disabled"].includes(status)) {
    return "amber" as const;
  }

  return "blue" as const;
}

function SettingsHiddenFields({ targetName, targetType }: { targetName: string; targetType: string }) {
  return (
    <>
      <input name="targetName" type="hidden" value={targetName} />
      <input name="targetType" type="hidden" value={targetType} />
    </>
  );
}

function ActionButton({
  action,
  label,
  targetName,
  targetType,
  tone = "slate"
}: {
  action: (formData: FormData) => Promise<void>;
  label: string;
  targetName: string;
  targetType: string;
  tone?: "amber" | "blue" | "green" | "slate";
}) {
  const classes = {
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    slate: "border-slate-200 bg-white text-slate-700"
  };

  return (
    <form action={action}>
      <SettingsHiddenFields targetName={targetName} targetType={targetType} />
      <button className={`h-9 rounded-full border px-3 text-xs font-black uppercase tracking-[0.14em] ${classes[tone]}`} type="submit">
        {label}
      </button>
    </form>
  );
}

export default async function AdminSettingsPage() {
  const control = await getAdminPlatformSettingsControl();

  return (
    <div className="grid gap-6 lg:gap-8">
      <AdminHeader
        description="Global SHASTORE defaults for platform settings, localization, limits references, regional readiness, and maintenance placeholders. Store Owner settings, Platform Theme, and Billing enforcement remain separate."
        title="Platform Settings Center"
      />

      <AdminStatGrid
        stats={[
          { label: "Sections", value: control.overview.sections },
          { label: "Languages", value: control.overview.languages },
          { label: "Currencies", value: control.overview.currencies },
          { label: "Default language", value: control.overview.defaultLanguage },
          { label: "Default currency", value: control.overview.defaultCurrency },
          { label: "Store settings touched", value: control.overview.storeSettingsTouched },
          { label: "Maintenance modes", value: control.overview.maintenanceModes },
          { label: "Dangerous toggles", value: "Placeholder only" }
        ]}
      />

      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm font-semibold leading-6 text-amber-800">
        Warning: every control on this page is a global-default placeholder. It does not overwrite existing stores,
        does not toggle live maintenance mode, does not change billing enforcement, and does not publish Platform Theme changes.
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <ActionButton action={savePlatformSettingsPlaceholder} label="Save placeholder" targetName="Global settings" targetType="general" tone="green" />
        <ActionButton action={featureFlagRolloutPlaceholder} label="Feature rollout" targetName="Feature flags" targetType="feature_flags" tone="blue" />
        <ActionButton action={maintenanceModePlaceholder} label="Maintenance" targetName="Maintenance mode" targetType="maintenance" tone="amber" />
        <ActionButton action={taxRulesEnginePlaceholder} label="Tax rules" targetName="Taxes" targetType="taxes" tone="amber" />
        <ActionButton action={exportSettingsSnapshotPlaceholder} label="Export snapshot" targetName="Settings snapshot" targetType="export" />
      </div>

      <AdminTable headers={["Section", "Status", "Notes"]}>
        {control.sections.map((section) => (
          <tr key={section.name}>
            <td className="px-5 py-4 font-bold text-slate-950">{section.name}</td>
            <td className="px-5 py-4"><AdminBadge tone={toneForStatus(section.status)}>{section.status}</AdminBadge></td>
            <td className="px-5 py-4 text-slate-600">{section.note}</td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable headers={["General setting", "Value", "Notes"]}>
        {control.general.map((setting) => (
          <tr key={setting.key}>
            <td className="px-5 py-4">
              <p className="font-bold text-slate-950">{setting.label}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{setting.key}</p>
            </td>
            <td className="px-5 py-4 text-slate-600">{setting.value}</td>
            <td className="px-5 py-4 text-slate-600">{setting.note}</td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable headers={["Language", "Code", "Direction", "Readiness"]}>
        {control.languages.map((language) => (
          <tr key={language.code}>
            <td className="px-5 py-4 font-bold text-slate-950">{language.name}</td>
            <td className="px-5 py-4"><AdminBadge tone="slate">{language.code}</AdminBadge></td>
            <td className="px-5 py-4"><AdminBadge tone={language.direction === "RTL" ? "amber" : "blue"}>{language.direction}</AdminBadge></td>
            <td className="px-5 py-4"><AdminBadge tone={toneForStatus(language.readiness)}>{language.readiness}</AdminBadge></td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable headers={["Currency", "Code", "Default", "Status"]}>
        {control.currencies.map((currency) => (
          <tr key={currency.code}>
            <td className="px-5 py-4 font-bold text-slate-950">{currency.name}</td>
            <td className="px-5 py-4"><AdminBadge tone="slate">{currency.code}</AdminBadge></td>
            <td className="px-5 py-4 text-slate-600">{currency.isDefault ? "Default" : "Available placeholder"}</td>
            <td className="px-5 py-4"><AdminBadge tone={toneForStatus(currency.status)}>{currency.status}</AdminBadge></td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable headers={["Timezone", "Value", "Default"]}>
        {control.timezones.map((timezone) => (
          <tr key={timezone.value}>
            <td className="px-5 py-4 font-bold text-slate-950">{timezone.label}</td>
            <td className="px-5 py-4 text-slate-600">{timezone.value}</td>
            <td className="px-5 py-4">{timezone.isDefault ? <AdminBadge tone="green">default</AdminBadge> : <AdminBadge>available</AdminBadge>}</td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable headers={["Tax setting", "Value", "Notes"]}>
        {control.taxes.map((tax) => (
          <tr key={tax.key}>
            <td className="px-5 py-4">
              <p className="font-bold text-slate-950">{tax.label}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{tax.key}</p>
            </td>
            <td className="px-5 py-4 text-slate-600">{tax.value}</td>
            <td className="px-5 py-4 text-slate-600">{tax.note}</td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable headers={["Default limit", "Value", "Description"]}>
        {control.defaultLimits.map((limit) => (
          <tr key={limit.key}>
            <td className="px-5 py-4 font-bold text-slate-950">{limit.key.replace(/_/g, " ")}</td>
            <td className="px-5 py-4 text-slate-600">{limit.value}</td>
            <td className="px-5 py-4 text-slate-600">{limit.description}</td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable headers={["Regional setting", "Value"]}>
        {control.regionalSettings.map((setting) => (
          <tr key={setting.key}>
            <td className="px-5 py-4 font-bold text-slate-950">{setting.label}</td>
            <td className="px-5 py-4 text-slate-600">{setting.value}</td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable headers={["Maintenance mode", "Status", "Warning", "Notes"]}>
        {control.maintenanceModes.map((mode) => (
          <tr key={mode.name}>
            <td className="px-5 py-4 font-bold text-slate-950">{mode.name}</td>
            <td className="px-5 py-4"><AdminBadge tone={toneForStatus(mode.status)}>{mode.status}</AdminBadge></td>
            <td className="px-5 py-4 text-amber-700">{mode.warning}</td>
            <td className="px-5 py-4 text-slate-600">{mode.note}</td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable headers={["Policy", "Status", "Notes"]}>
        {control.legalPolicies.map((policy) => (
          <tr key={policy.name}>
            <td className="px-5 py-4 font-bold text-slate-950">{policy.name}</td>
            <td className="px-5 py-4"><AdminBadge tone={toneForStatus(policy.status)}>{policy.status}</AdminBadge></td>
            <td className="px-5 py-4 text-slate-600">{policy.note}</td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable headers={["Feature flag", "Status", "Notes"]}>
        {control.featureFlags.map((flag) => (
          <tr key={flag.key}>
            <td className="px-5 py-4 font-bold text-slate-950">{flag.key.replace(/_/g, " ")}</td>
            <td className="px-5 py-4"><AdminBadge tone={toneForStatus(flag.status)}>{flag.status}</AdminBadge></td>
            <td className="px-5 py-4 text-slate-600">{flag.note}</td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable headers={["Safety behavior", "Status", "Notes"]}>
        {control.safety.map((item) => (
          <tr key={item.name}>
            <td className="px-5 py-4 font-bold text-slate-950">{item.name}</td>
            <td className="px-5 py-4"><AdminBadge tone={toneForStatus(item.status)}>{item.status}</AdminBadge></td>
            <td className="px-5 py-4 text-slate-600">{item.note}</td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable headers={["Future hook", "Status"]}>
        {control.futureHooks.map((hook) => (
          <tr key={hook}>
            <td className="px-5 py-4 font-bold text-slate-950">{hook}</td>
            <td className="px-5 py-4">
              <button
                className="h-8 rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-400"
                disabled
                type="button"
              >
                Reserved placeholder
              </button>
            </td>
          </tr>
        ))}
      </AdminTable>
    </div>
  );
}
