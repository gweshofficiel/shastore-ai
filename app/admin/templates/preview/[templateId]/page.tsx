import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminBadge, AdminHeader, AdminStatGrid, formatAdminDate } from "@/components/admin/admin-control";
import { TemplateAdminMockPreview } from "@/components/admin/template-admin-mock-preview";
import { getAdminAccess } from "@/lib/admin-access";
import { getTemplatePreview } from "@/src/lib/templates/template-preview-runtime";

export const dynamic = "force-dynamic";

type PreviewPageProps = {
  params: Promise<{ templateId: string }>;
};

function toneForReadiness(status: string) {
  if (status === "ready") return "green" as const;
  if (status === "invalid") return "red" as const;
  return "amber" as const;
}

function readinessLabel(status: string) {
  if (status === "ready") return "Ready";
  if (status === "invalid") return "Invalid";
  return "Needs attention";
}

function visibilityLabel(visibility: string) {
  if (visibility === "owner") return "Owner catalog";
  if (visibility === "reseller") return "Reseller catalog";
  if (visibility === "marketplace") return "Marketplace catalog";
  if (visibility === "internal") return "Hidden / internal";
  return visibility;
}

function triStateLabel(value: boolean | "unknown") {
  if (value === true) return "Ready";
  if (value === false) return "Not ready";
  return "Unknown";
}

export async function generateMetadata({ params }: PreviewPageProps): Promise<Metadata> {
  const { templateId } = await params;

  try {
    const access = await getAdminAccess();

    if (access.internalRole !== "super_admin") {
      return { title: "Template Preview" };
    }

    const preview = await getTemplatePreview(templateId);
    return {
      title: preview ? `${preview.model.name} — Template Preview` : "Template Preview"
    };
  } catch {
    return { title: "Template Preview" };
  }
}

export default async function AdminTemplatePreviewPage({ params }: PreviewPageProps) {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    notFound();
  }

  const { templateId } = await params;
  const preview = await getTemplatePreview(templateId);

  if (!preview) {
    notFound();
  }

  const { model } = preview;
  const { contents, summary } = model.package;

  return (
    <div className="grid gap-6 lg:gap-8">
      <AdminHeader
        description="Super Admin template preview runtime. Metadata, package structure, screenshots, and a safe mock layout only — no store installation and no storefront rendering changes."
        title={`Template Preview — ${model.name}`}
      />

      <div className="flex flex-wrap gap-3">
        <Link
          className="inline-flex h-10 items-center rounded-full border border-slate-200 bg-white px-4 text-xs font-black uppercase tracking-[0.14em] text-slate-700"
          href="/admin/templates"
        >
          Back to templates
        </Link>
        <AdminBadge tone={toneForReadiness(model.previewReadiness)}>
          Preview {readinessLabel(model.previewReadiness)}
        </AdminBadge>
        <AdminBadge tone={model.status === "active" ? "green" : model.status === "archived" ? "red" : "amber"}>
          {model.status}
        </AdminBadge>
        <AdminBadge tone="slate">{visibilityLabel(model.visibility)}</AdminBadge>
      </div>

      {model.readinessIssues.length ? (
        <div className="rounded-[1.5rem] border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-semibold text-amber-800">
          {model.readinessIssues.join(" · ")}
        </div>
      ) : null}

      <AdminStatGrid
        stats={[
          { label: "Version", value: model.version.number },
          { label: "Products", value: contents.products_count },
          { label: "Pages", value: contents.pages_count },
          { label: "Package readiness", value: model.package.readinessStatus }
        ]}
      />

      <div className="grid gap-4 rounded-[2rem] border border-slate-200 bg-white p-5 lg:grid-cols-2 lg:p-6">
        <div className="grid gap-3 text-sm text-slate-600">
          <p>
            <span className="font-bold text-slate-950">Template:</span> {model.name}
          </p>
          <p>
            <span className="font-bold text-slate-950">Category / industry:</span> {model.category ?? "—"} /{" "}
            {model.industry ?? "—"}
          </p>
          <p>
            <span className="font-bold text-slate-950">Registry id:</span> {model.registryId}
          </p>
          <p>
            <span className="font-bold text-slate-950">Template key:</span> {model.templateKey}
          </p>
          <p>
            <span className="font-bold text-slate-950">Slug:</span> {model.slug}
          </p>
          <p>
            <span className="font-bold text-slate-950">Store template reference:</span> {model.storeTemplateId ?? "—"}
          </p>
          <p>
            <span className="font-bold text-slate-950">Version status:</span> {model.version.status ?? "—"}
          </p>
          <p>
            <span className="font-bold text-slate-950">Published:</span> {formatAdminDate(model.version.publishedAt)}
          </p>
          <p>
            <span className="font-bold text-slate-950">Generated:</span> {formatAdminDate(preview.generatedAt)}
          </p>
        </div>

        <div className="grid gap-3">
          <div className="flex flex-wrap gap-2">
            {model.badges.official ? <AdminBadge tone="green">Official</AdminBadge> : null}
            {model.badges.recommended ? <AdminBadge tone="amber">Recommended</AdminBadge> : null}
            {model.badges.premium ? <AdminBadge tone="blue">Premium</AdminBadge> : null}
            {model.badges.labels.map((badge) => (
              <AdminBadge key={badge} tone="slate">
                {badge}
              </AdminBadge>
            ))}
          </div>

          <div className="grid gap-1 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs font-semibold text-slate-600">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Package summary</p>
            <p>Package: {model.package.packageName}</p>
            <p>Products: {summary.productsCount}</p>
            <p>Categories: {summary.categoriesCount}</p>
            <p>Pages: {summary.pagesCount}</p>
            <p>Blog: {summary.blogCount}</p>
            <p>FAQ: {summary.faqCount}</p>
            <p>AI support: {contents.ai_support_enabled ? "yes" : "no"}</p>
            <p>Domain readiness: {contents.domain_ready ? "ready" : "not ready"}</p>
            <p>Checkout readiness: {triStateLabel(contents.checkout_ready)}</p>
            <p>Navigation readiness: {triStateLabel(contents.navigation_ready)}</p>
            <p>Theme readiness: {triStateLabel(contents.theme_ready)}</p>
          </div>
        </div>
      </div>

      <AdminHeader
        description="Mock layout generated from package metadata counts and readiness flags. This is not a customer store and does not execute the template installer."
        title="Mock Storefront Preview"
      />

      <TemplateAdminMockPreview model={model} />
    </div>
  );
}
