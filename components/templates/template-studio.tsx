"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TemplateHeroThumbnail } from "@/components/templates/demo-store-preview";
import {
  duplicateTemplate,
  publishTemplate,
  restoreTemplateDefaults,
  saveTemplateDraft,
  unpublishTemplate
} from "@/lib/template-studio/actions";
import type { StoreTemplate, TemplateCustomizationDefaults } from "@/lib/template-studio/types";

type StudioStatus = "draft" | "published" | "unpublished" | "duplicated" | "restored";

const editorSections = [
  {
    description: "Logo, banner, and public store identity.",
    id: "branding",
    label: "Branding"
  },
  {
    description: "Primary and secondary storefront colors.",
    id: "colors",
    label: "Colors"
  },
  {
    description: "Hero copy and first impression content.",
    id: "header",
    label: "Header"
  },
  {
    description: "Footer message shown near the bottom of the template.",
    id: "footer",
    label: "Footer"
  },
  {
    description: "Homepage sections, offers, and merchandising story.",
    id: "homepage",
    label: "Homepage"
  },
  {
    description: "Template demo products and product placeholders.",
    id: "products",
    label: "Products"
  },
  {
    description: "Protected category mapping and visible category chips.",
    id: "categories",
    label: "Categories"
  },
  {
    description: "Primary call-to-action used in the hero and preview.",
    id: "cta",
    label: "CTA"
  },
  {
    description: "Contact, social, and support information.",
    id: "contact",
    label: "Contact info"
  },
  {
    description: "Search title and description placeholders.",
    id: "seo",
    label: "SEO placeholders"
  },
  {
    description: "Store name, description, and customer support details.",
    id: "footer-store",
    label: "Footer store info"
  },
  {
    description: "Legal page labels and links.",
    id: "footer-legal",
    label: "Footer legal pages"
  },
  {
    description: "Shipping, payment, and copyright display.",
    id: "footer-shipping",
    label: "Footer shipping/payment"
  },
  {
    description: "The protected SHASTORE AI platform credit.",
    id: "locked-brand",
    label: "Locked SHASTORE AI brand"
  }
] as const;

type EditorSectionId = (typeof editorSections)[number]["id"];

function Field({
  label,
  name,
  onChange,
  value,
  type = "text"
}: {
  label: string;
  name: keyof TemplateCustomizationDefaults | "instagram" | "tiktok" | "facebook";
  onChange: (name: string, value: string) => void;
  value: string;
  type?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-bold text-slate-700">
      {label}
      <input
        className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-ink outline-none transition focus:border-slate-400"
        name={name}
        onChange={(event) => onChange(name, event.target.value)}
        type={type}
        value={value}
      />
    </label>
  );
}

function TextAreaField({
  label,
  name,
  onChange,
  value
}: {
  label: string;
  name: keyof TemplateCustomizationDefaults;
  onChange: (name: string, value: string) => void;
  value: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-bold text-slate-700">
      {label}
      <textarea
        className="min-h-24 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold leading-6 text-ink outline-none transition focus:border-slate-400"
        name={name}
        onChange={(event) => onChange(name, event.target.value)}
        value={value}
      />
    </label>
  );
}

function ActionSubmit({
  label,
  pendingLabel,
  variant = "primary"
}: {
  label: string;
  pendingLabel: string;
  variant?: "primary" | "secondary" | "ghost";
}) {
  const { pending } = useFormStatus();

  return (
    <Button disabled={pending} type="submit" variant={variant}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

function ActionForm({
  action,
  actionPath,
  customizationPayload,
  label,
  onSubmit,
  pendingLabel,
  templateId,
  variant
}: {
  action: (formData: FormData) => void | Promise<void>;
  actionPath: string;
  customizationPayload: string;
  label: string;
  onSubmit?: () => void;
  pendingLabel: string;
  templateId: string;
  variant?: "primary" | "secondary" | "ghost";
}) {
  return (
    <form action={action} onSubmit={onSubmit}>
      <input name="returnTo" type="hidden" value={actionPath} />
      <input name="templateId" type="hidden" value={templateId} />
      <input name="customization" type="hidden" value={customizationPayload} />
      <ActionSubmit label={label} pendingLabel={pendingLabel} variant={variant} />
    </form>
  );
}

export function TemplateStudio({
  actionPath,
  backPath,
  initialCustomization,
  initialStatus,
  lastSavedAt,
  template,
  variant
}: {
  actionPath: string;
  backPath: string;
  initialCustomization?: TemplateCustomizationDefaults | null;
  initialStatus?: StudioStatus | null;
  lastSavedAt?: string | null;
  template: StoreTemplate;
  variant: "seller" | "reseller";
}) {
  const searchParams = useSearchParams();
  const saved = searchParams.get("saved");
  const error = searchParams.get("error");
  const [customization, setCustomization] = useState(
    initialCustomization ?? template.defaultCustomization
  );
  const [activeSection, setActiveSection] = useState<EditorSectionId>("branding");
  const [toast, setToast] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const status: StudioStatus =
    saved === "published"
      ? "published"
      : saved === "unpublished"
        ? "unpublished"
        : initialStatus === "published" || initialStatus === "unpublished"
          ? initialStatus
          : "draft";
  const featuredProducts = useMemo(
    () => template.demoProducts.filter((product) => product.featured),
    [template.demoProducts]
  );
  const customizationPayload = useMemo(
    () => JSON.stringify(customization),
    [customization]
  );
  const activeSectionMeta = editorSections.find((section) => section.id === activeSection);

  useEffect(() => {
    if (saved) {
      const label =
        saved === "draft"
          ? "Draft saved."
          : saved === "published"
            ? "Template saved and published."
            : saved === "unpublished"
              ? "Template unpublished."
              : saved === "duplicated"
                ? "Template duplicated."
                : saved === "restored"
                  ? "Defaults restored."
                  : "Template action completed.";

      setToast({ message: label, tone: "success" });
      return;
    }

    if (error) {
      setToast({ message: error, tone: "error" });
    }
  }, [error, saved]);

  function updateCustomization(name: string, value: string) {
    if (name === "instagram" || name === "tiktok" || name === "facebook") {
      setCustomization((current) => ({
        ...current,
        socialLinks: {
          ...current.socialLinks,
          [name]: value
        }
      }));
      return;
    }

    setCustomization((current) => ({
      ...current,
      [name]: value
    }));
  }

  function resetVisibleDefaults() {
    setCustomization(template.defaultCustomization);
  }

  function selectSection(section: EditorSectionId) {
    setActiveSection(section);
    panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderActivePanel() {
    switch (activeSection) {
      case "branding":
        return (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Logo" name="logo" onChange={updateCustomization} value={customization.logo} />
              <Field label="Banner" name="banner" onChange={updateCustomization} value={customization.banner} />
              <Field
                label="Store name"
                name="storeName"
                onChange={updateCustomization}
                value={customization.storeName}
              />
            </div>
            <TextAreaField
              label="Store description"
              name="storeDescription"
              onChange={updateCustomization}
              value={customization.storeDescription}
            />
          </>
        );
      case "colors":
        return (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="Primary color"
                name="primaryColor"
                onChange={updateCustomization}
                type="color"
                value={customization.primaryColor}
              />
              <Field
                label="Secondary color"
                name="secondaryColor"
                onChange={updateCustomization}
                type="color"
                value={customization.secondaryColor}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div
                className="rounded-[2rem] p-5 text-sm font-black text-white"
                style={{ backgroundColor: customization.primaryColor }}
              >
                Primary preview
              </div>
              <div
                className="rounded-[2rem] p-5 text-sm font-black text-white"
                style={{ backgroundColor: customization.secondaryColor }}
              >
                Secondary preview
              </div>
            </div>
          </>
        );
      case "header":
        return (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Logo" name="logo" onChange={updateCustomization} value={customization.logo} />
              <Field label="Banner" name="banner" onChange={updateCustomization} value={customization.banner} />
              <Field
                label="Hero title"
                name="heroTitle"
                onChange={updateCustomization}
                value={customization.heroTitle}
              />
            </div>
            <TextAreaField
              label="Hero subtitle"
              name="heroSubtitle"
              onChange={updateCustomization}
              value={customization.heroSubtitle}
            />
          </>
        );
      case "footer":
        return (
          <>
            <TextAreaField
              label="Footer text"
              name="footerText"
              onChange={updateCustomization}
              value={customization.footerText}
            />
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold leading-6 text-muted">
              This text appears above the detailed footer store info, legal links, shipping, payment,
              and locked platform branding.
            </div>
          </>
        );
      case "homepage":
        return (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="Hero title"
                name="heroTitle"
                onChange={updateCustomization}
                value={customization.heroTitle}
              />
              <Field
                label="CTA text"
                name="ctaText"
                onChange={updateCustomization}
                value={customization.ctaText}
              />
            </div>
            <TextAreaField
              label="Hero subtitle"
              name="heroSubtitle"
              onChange={updateCustomization}
              value={customization.heroSubtitle}
            />
            <div className="grid gap-3">
              {template.demoSections.map((section) => (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4" key={section.title}>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                    {section.eyebrow}
                  </p>
                  <p className="mt-2 font-black text-ink">{section.title}</p>
                  <p className="mt-1 text-sm leading-6 text-muted">{section.body}</p>
                </div>
              ))}
              {template.demoOffers.map((offer) => (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4" key={offer.code}>
                  <p className="font-black text-emerald-950">{offer.title}</p>
                  <p className="mt-1 text-sm font-semibold leading-6 text-emerald-800">
                    {offer.description}
                  </p>
                  <p className="mt-2 text-xs font-black uppercase tracking-[0.18em] text-emerald-600">
                    Code: {offer.code}
                  </p>
                </div>
              ))}
            </div>
          </>
        );
      case "products":
        return (
          <div className="grid gap-4">
            {template.demoProducts.map((product) => (
              <div className="rounded-2xl border border-slate-200 bg-white p-4" key={product.name}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-ink">{product.name}</p>
                    <p className="mt-1 text-sm font-bold text-muted">{product.category}</p>
                  </div>
                  <p className="font-black text-ink">{product.price}</p>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{product.shortDescription}</p>
                <p className="mt-3 text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                  {product.type === "digital"
                    ? product.fileDeliveryPlaceholder
                    : product.type === "marketplace"
                      ? `${product.vendorPlaceholder} | ${product.commissionPlaceholder}`
                      : `${product.imagePlaceholder} | ${product.stockPlaceholder}`}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(product.productBadges ?? []).map((badge) => (
                    <span
                      className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500"
                      key={badge}
                    >
                      {badge}
                    </span>
                  ))}
                </div>
                <p className="mt-3 text-xs font-bold text-slate-500">
                  SKU {product.skuPlaceholder} | Variants{" "}
                  {(product.variantsPlaceholder ?? []).join(" / ")}
                </p>
              </div>
            ))}
          </div>
        );
      case "categories":
        return (
          <>
            <div className="flex flex-wrap gap-2">
              {template.demoCategories.map((category) => (
                <span
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black text-slate-600"
                  key={category}
                >
                  {category}
                </span>
              ))}
            </div>
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
              <p className="text-sm font-black text-blue-950">Locked to {template.categoryName}</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-blue-800">
                {template.protection.validationPlaceholder}
              </p>
              <p className="mt-1 text-xs font-semibold leading-5 text-blue-700">
                {template.protection.wrongCategoryPublishPlaceholder}
              </p>
            </div>
          </>
        );
      case "cta":
        return (
          <Field
            label="CTA text"
            name="ctaText"
            onChange={updateCustomization}
            value={customization.ctaText}
          />
        );
      case "contact":
        return (
          <div className="grid gap-4 md:grid-cols-2">
            <Field
              label="Contact info"
              name="contactInfo"
              onChange={updateCustomization}
              value={customization.contactInfo}
            />
            <Field
              label="Support email"
              name="supportEmail"
              onChange={updateCustomization}
              value={customization.supportEmail}
            />
            <Field label="Phone" name="phone" onChange={updateCustomization} value={customization.phone} />
            <Field
              label="WhatsApp"
              name="whatsapp"
              onChange={updateCustomization}
              value={customization.whatsapp}
            />
            <Field
              label="Instagram"
              name="instagram"
              onChange={updateCustomization}
              value={customization.socialLinks.instagram}
            />
            <Field
              label="TikTok"
              name="tiktok"
              onChange={updateCustomization}
              value={customization.socialLinks.tiktok}
            />
            <Field
              label="Facebook"
              name="facebook"
              onChange={updateCustomization}
              value={customization.socialLinks.facebook}
            />
            <Field
              label="Address"
              name="address"
              onChange={updateCustomization}
              value={customization.address}
            />
          </div>
        );
      case "seo":
        return (
          <>
            <TextAreaField
              label="SEO title"
              name="seoTitle"
              onChange={updateCustomization}
              value={customization.seoTitle}
            />
            <TextAreaField
              label="SEO description"
              name="seoDescription"
              onChange={updateCustomization}
              value={customization.seoDescription}
            />
          </>
        );
      case "footer-store":
        return (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="Store name"
                name="storeName"
                onChange={updateCustomization}
                value={customization.storeName}
              />
              <Field
                label="Support email"
                name="supportEmail"
                onChange={updateCustomization}
                value={customization.supportEmail}
              />
              <Field label="Phone" name="phone" onChange={updateCustomization} value={customization.phone} />
              <Field
                label="WhatsApp"
                name="whatsapp"
                onChange={updateCustomization}
                value={customization.whatsapp}
              />
              <Field
                label="Address"
                name="address"
                onChange={updateCustomization}
                value={customization.address}
              />
            </div>
            <TextAreaField
              label="Store description"
              name="storeDescription"
              onChange={updateCustomization}
              value={customization.storeDescription}
            />
          </>
        );
      case "footer-legal":
        return (
          <div className="grid gap-4 md:grid-cols-2">
            <Field
              label="Privacy policy text"
              name="privacyPolicyText"
              onChange={updateCustomization}
              value={customization.privacyPolicyText}
            />
            <Field
              label="Privacy policy link"
              name="privacyPolicyLink"
              onChange={updateCustomization}
              value={customization.privacyPolicyLink}
            />
            <Field
              label="Terms text"
              name="termsText"
              onChange={updateCustomization}
              value={customization.termsText}
            />
            <Field
              label="Terms link"
              name="termsLink"
              onChange={updateCustomization}
              value={customization.termsLink}
            />
            <Field
              label="Refund policy text"
              name="refundPolicyText"
              onChange={updateCustomization}
              value={customization.refundPolicyText}
            />
            <Field
              label="Refund policy link"
              name="refundPolicyLink"
              onChange={updateCustomization}
              value={customization.refundPolicyLink}
            />
            <Field
              label="Shipping policy text"
              name="shippingPolicyText"
              onChange={updateCustomization}
              value={customization.shippingPolicyText}
            />
            <Field
              label="Shipping policy link"
              name="shippingPolicyLink"
              onChange={updateCustomization}
              value={customization.shippingPolicyLink}
            />
          </div>
        );
      case "footer-shipping":
        return (
          <>
            <Field
              label="Payment icons"
              name="paymentIcons"
              onChange={updateCustomization}
              value={customization.paymentIcons}
            />
            <TextAreaField
              label="Shipping method icons/text"
              name="shippingMethodText"
              onChange={updateCustomization}
              value={customization.shippingMethodText}
            />
            <TextAreaField
              label="Copyright text"
              name="copyrightText"
              onChange={updateCustomization}
              value={customization.copyrightText}
            />
          </>
        );
      case "locked-brand":
        return (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-black text-amber-900">Locked platform branding</p>
            <p className="mt-1 text-sm font-semibold text-amber-800">
              {customization.lockedPoweredBy} is locked for sellers and resellers. Only platform
              admin can remove or edit this phrase.
            </p>
          </div>
        );
      default:
        return null;
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
      <aside className="grid gap-4 xl:sticky xl:top-6 xl:self-start">
        <Card className="grid gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
              Studio Sections
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-ink">
              Customize before publishing
            </h2>
          </div>
          <div className="grid gap-2">
            {editorSections.map((section) => {
              const isActive = section.id === activeSection;

              return (
                <button
                  aria-current={isActive ? "step" : undefined}
                  aria-expanded={isActive}
                  className={`rounded-2xl border px-4 py-3 text-left text-sm transition duration-200 ${
                    isActive
                      ? "border-blue-300 bg-blue-50 text-blue-950 shadow-sm"
                      : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white hover:text-ink"
                  }`}
                  key={section.id}
                  onClick={() => selectSection(section.id)}
                  type="button"
                >
                  <span className="block font-black">{section.label}</span>
                  <span
                    className={`mt-1 block overflow-hidden text-xs font-semibold leading-5 transition-all duration-300 xl:hidden ${
                      isActive ? "max-h-16 opacity-100" : "max-h-0 opacity-0"
                    }`}
                  >
                    {section.description}
                  </span>
                </button>
              );
            })}
          </div>
        </Card>
        <Card className="grid gap-3 border-blue-200 bg-blue-50">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-500">
            Category Protection
          </p>
          <p className="text-sm font-bold leading-6 text-blue-900">
            Locked to {template.categoryName}. {template.protection.validationPlaceholder}
          </p>
          <p className="text-xs font-semibold leading-5 text-blue-700">
            {template.protection.wrongCategoryPublishPlaceholder}
          </p>
        </Card>
      </aside>

      <div className="grid gap-6">
        <Card className="grid gap-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                {template.categoryName} Studio
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-ink">
                {template.name}
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
                {template.description}
              </p>
            </div>
            <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-black capitalize text-ink">
              {status}
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <ActionForm
              action={saveTemplateDraft}
              actionPath={actionPath}
              customizationPayload={customizationPayload}
              label="Save Draft"
              pendingLabel="Saving..."
              templateId={template.id}
              variant="secondary"
            />
            <ActionForm
              action={publishTemplate}
              actionPath={actionPath}
              customizationPayload={customizationPayload}
              label="Save & Publish"
              pendingLabel="Publishing..."
              templateId={template.id}
            />
            <ActionForm
              action={unpublishTemplate}
              actionPath={actionPath}
              customizationPayload={customizationPayload}
              label="Unpublish"
              pendingLabel="Unpublishing..."
              templateId={template.id}
              variant="secondary"
            />
            <ActionForm
              action={duplicateTemplate}
              actionPath={actionPath}
              customizationPayload={customizationPayload}
              label="Duplicate"
              pendingLabel="Duplicating..."
              templateId={template.id}
              variant="secondary"
            />
            <ActionForm
              action={restoreTemplateDefaults}
              actionPath={actionPath}
              customizationPayload={customizationPayload}
              label="Restore Defaults"
              onSubmit={resetVisibleDefaults}
              pendingLabel="Restoring..."
              templateId={template.id}
              variant="ghost"
            />
            <Link
              className="inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-bold text-muted transition hover:bg-slate-100 hover:text-ink"
              href={backPath}
            >
              Back to library
            </Link>
            <Link
              className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 bg-white px-5 text-sm font-bold text-ink transition hover:border-slate-300 hover:bg-slate-50"
              href={`${backPath}/preview/${template.id}`}
              target="_blank"
            >
              Preview
            </Link>
          </div>
          {toast ? (
            <div
              aria-live="polite"
              className={`rounded-2xl border px-4 py-3 text-sm font-bold transition duration-300 ${
                toast.tone === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-red-200 bg-red-50 text-red-700"
              }`}
              role="status"
            >
              {toast.message}
            </div>
          ) : null}
          {!saved && lastSavedAt ? (
            <p className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700">
              Saved draft loaded from Supabase. Last updated {new Date(lastSavedAt).toLocaleString()}.
            </p>
          ) : null}
        </Card>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
          <Card className="grid gap-5 transition duration-300">
            <div ref={panelRef} />
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                Active Editor
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-ink">
                {activeSectionMeta?.label ?? "Template section"}
              </h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-muted">
                {activeSectionMeta?.description}
              </p>
            </div>
            <div className="grid gap-5 animate-in fade-in duration-300" key={activeSection}>
              {renderActivePanel()}
            </div>
          </Card>

          <Card className="overflow-hidden p-0">
            <div className="p-4">
              <TemplateHeroThumbnail customization={customization} template={template} />
            </div>
            <div className="grid gap-4 p-5">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                  Categories Preview
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {template.demoCategories.map((category) => (
                    <span
                      className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black text-slate-600"
                      key={category}
                    >
                      {category}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                  Featured Products
                </p>
                <div className="mt-3 grid gap-3">
                  {featuredProducts.map((product) => (
                    <div
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
                      key={product.name}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-black text-ink">{product.name}</p>
                          <p className="mt-1 text-xs font-bold text-muted">{product.category}</p>
                        </div>
                        <p className="font-black text-ink">{product.price}</p>
                      </div>
                      <p className="mt-2 text-xs font-semibold leading-5 text-slate-600">
                        {product.shortDescription}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-dashed border-slate-300 p-4">
                <p className="text-sm font-black text-ink">Publishing connectors</p>
                <p className="mt-2 text-xs font-semibold leading-5 text-muted">
                  {variant === "reseller"
                    ? "Save & Publish creates or updates a reseller showcase listing with this template preview."
                    : "Seller publishing saves the template customization as published without touching checkout, billing, shipping, or payments."}
                </p>
              </div>
            </div>
          </Card>
        </div>

      </div>
    </div>
  );
}
