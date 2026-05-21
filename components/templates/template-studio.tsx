"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
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
  "SEO placeholders",
  "Footer store info",
  "Footer legal pages",
  "Footer shipping/payment",
  "Locked SHASTORE AI brand"
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
  pendingLabel,
  templateId,
  variant
}: {
  action: (formData: FormData) => void | Promise<void>;
  actionPath: string;
  customizationPayload: string;
  label: string;
  pendingLabel: string;
  templateId: string;
  variant?: "primary" | "secondary" | "ghost";
}) {
  return (
    <form action={action}>
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
  template,
  variant
}: {
  actionPath: string;
  backPath: string;
  template: StoreTemplate;
  variant: "seller" | "reseller";
}) {
  const searchParams = useSearchParams();
  const saved = searchParams.get("saved");
  const error = searchParams.get("error");
  const [customization, setCustomization] = useState(template.defaultCustomization);
  const status: StudioStatus =
    saved === "published" ? "published" : saved === "unpublished" ? "unpublished" : "draft";
  const featuredProducts = useMemo(
    () => template.demoProducts.filter((product) => product.featured),
    [template.demoProducts]
  );
  const customizationPayload = useMemo(
    () => JSON.stringify(customization),
    [customization]
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

  function resetVisibleDefaults() {
    setCustomization(template.defaultCustomization);
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
            <form action={restoreTemplateDefaults}>
              <input name="returnTo" type="hidden" value={actionPath} />
              <input name="templateId" type="hidden" value={template.id} />
              <input name="customization" type="hidden" value={customizationPayload} />
              <Button onClick={resetVisibleDefaults} type="submit" variant="ghost">
                Restore defaults
              </Button>
            </form>
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
          {saved ? (
            <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
              Template action completed: {saved}.
            </p>
          ) : null}
          {error ? (
            <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              {error}
            </p>
          ) : null}
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
            <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                Footer Editor
              </p>
              <h3 className="mt-2 text-xl font-black tracking-[-0.03em] text-ink">
                Store info, legal, shipping, and payment display
              </h3>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
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
                <Field
                  label="Phone"
                  name="phone"
                  onChange={updateCustomization}
                  value={customization.phone}
                />
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
                <Field
                  label="Payment icons"
                  name="paymentIcons"
                  onChange={updateCustomization}
                  value={customization.paymentIcons}
                />
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
              <div className="mt-4 grid gap-4">
                <TextAreaField
                  label="Store description"
                  name="storeDescription"
                  onChange={updateCustomization}
                  value={customization.storeDescription}
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
              </div>
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-black text-amber-900">Locked platform branding</p>
                <p className="mt-1 text-sm font-semibold text-amber-800">
                  {customization.lockedPoweredBy} is locked for sellers and resellers. Only
                  platform admin can remove or edit this phrase.
                </p>
              </div>
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
