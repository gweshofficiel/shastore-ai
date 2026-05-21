"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { StoreTemplate, TemplateCustomizationDefaults } from "@/lib/template-studio/types";

type StudioStatus = "draft" | "published" | "unpublished";

const editorSections = [
  "Branding",
  "Colors",
  "Header",
  "Footer",
  "Homepage",
  "Products",
  "Categories",
  "CTA",
  "Contact info",
  "SEO placeholders"
] as const;

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

export function TemplateStudio({
  returnPath,
  template,
  variant
}: {
  returnPath: string;
  template: StoreTemplate;
  variant: "seller" | "reseller";
}) {
  const [status, setStatus] = useState<StudioStatus>("draft");
  const [message, setMessage] = useState("Draft mode is ready. Persistence is prepared in the database foundation.");
  const [customization, setCustomization] = useState(template.defaultCustomization);
  const featuredProducts = useMemo(
    () => template.demoProducts.filter((product) => product.featured),
    [template.demoProducts]
  );

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

  function saveDraft() {
    setStatus("draft");
    setMessage("Draft saved locally for this foundation. The template_customizations table is ready for per-user saves.");
  }

  function publish() {
    setStatus("published");
    setMessage(
      variant === "reseller"
        ? "Publish placeholder prepared for reseller showcase listings and marketplace listings."
        : "Publish placeholder prepared for seller stores and marketplace listings."
    );
  }

  function unpublish() {
    setStatus("unpublished");
    setMessage("Template unpublished in Studio state. Future persistence will update the published_at fields safely.");
  }

  function duplicate() {
    setStatus("draft");
    setMessage("Duplicate placeholder created. Future storage will copy defaults into a user-owned template draft.");
  }

  function restoreDefaults() {
    setCustomization(template.defaultCustomization);
    setStatus("draft");
    setMessage("Defaults restored from the protected template library.");
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
            {editorSections.map((section) => (
              <div
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-700"
                key={section}
              >
                {section}
              </div>
            ))}
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
            <Button onClick={saveDraft} type="button" variant="secondary">
              Save Draft
            </Button>
            <Button onClick={publish} type="button">
              Save & Publish
            </Button>
            <Button onClick={unpublish} type="button" variant="secondary">
              Unpublish
            </Button>
            <Button onClick={duplicate} type="button" variant="secondary">
              Duplicate
            </Button>
            <Button onClick={restoreDefaults} type="button" variant="ghost">
              Restore defaults
            </Button>
            <a
              className="inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-bold text-muted transition hover:bg-slate-100 hover:text-ink"
              href={returnPath}
            >
              Back to library
            </a>
          </div>
          <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
            {message}
          </p>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
          <Card className="grid gap-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                Editable Fields
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-ink">
                Branding, homepage, CTA, contact, and SEO
              </h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Logo" name="logo" onChange={updateCustomization} value={customization.logo} />
              <Field label="Banner" name="banner" onChange={updateCustomization} value={customization.banner} />
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
              <Field
                label="Contact info"
                name="contactInfo"
                onChange={updateCustomization}
                value={customization.contactInfo}
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
            </div>
            <TextAreaField
              label="Hero subtitle"
              name="heroSubtitle"
              onChange={updateCustomization}
              value={customization.heroSubtitle}
            />
            <TextAreaField
              label="Footer text"
              name="footerText"
              onChange={updateCustomization}
              value={customization.footerText}
            />
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
          </Card>

          <Card className="overflow-hidden p-0">
            <div
              className="p-6 text-white"
              style={{
                background: `linear-gradient(135deg, ${customization.primaryColor}, ${customization.secondaryColor})`
              }}
            >
              <p className="text-xs font-black uppercase tracking-[0.22em] text-white/70">
                Live Preview Placeholder
              </p>
              <h2 className="mt-8 text-3xl font-black tracking-[-0.05em]">
                {customization.heroTitle}
              </h2>
              <p className="mt-3 text-sm font-semibold leading-6 text-white/80">
                {customization.heroSubtitle}
              </p>
              <button className="mt-6 rounded-full bg-white px-5 py-3 text-sm font-black text-slate-950">
                {customization.ctaText}
              </button>
            </div>
            <div className="grid gap-4 p-5">
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
                  Seller store, reseller showcase listing, and marketplace listing connections
                  are prepared as safe placeholders for the publishing flow.
                </p>
              </div>
            </div>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="grid gap-4">
            <h2 className="text-xl font-black tracking-[-0.03em] text-ink">
              Demo Products
            </h2>
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
              </div>
            ))}
          </Card>
          <Card className="grid gap-5">
            <div>
              <h2 className="text-xl font-black tracking-[-0.03em] text-ink">
                Homepage Sections & Offers
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                These placeholders make each template feel like a complete store before a seller
                replaces the demo content.
              </p>
            </div>
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
          </Card>
        </div>
      </div>
    </div>
  );
}
