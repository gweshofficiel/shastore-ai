"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { LivePreview } from "@/components/landing/live-preview";
import { useCopyGeneration } from "@/hooks/use-copy-generation";
import {
  defaultLandingThemeSettings,
  normalizeLandingThemeSettings
} from "@/lib/landing-theme";
import { landingTemplates } from "@/templates/registry";
import type {
  AiLandingCopy,
  LandingThemeSettings,
  PaymentMethod,
  TemplateId
} from "@/types/landing";

type BuilderState = {
  productName: string;
  productPrice: string;
  comparePrice: string;
  shortDescription: string;
  longDescription: string;
  productDescription: string;
  ctaText: string;
  whatsappNumber: string;
  brandColor: string;
  seoTitle: string;
  seoDescription: string;
};

const steps = ["Product", "Theme", "Template", "Payments", "AI", "Preview"];
const buyerCheckoutPaymentMethods = ["whatsapp", "cod"] satisfies PaymentMethod[];
const paymentOptions: Array<{ id: PaymentMethod; label: string; placeholder?: string }> = [
  { id: "whatsapp", label: "WhatsApp orders" },
  { id: "cod", label: "Cash on Delivery" },
  { id: "stripe", label: "Stripe", placeholder: "Client-owned Stripe placeholder" },
  { id: "paypal", label: "PayPal", placeholder: "Client-owned PayPal placeholder" }
];

function isBuyerCheckoutPaymentMethod(method: PaymentMethod) {
  return buyerCheckoutPaymentMethods.some((supported) => supported === method);
}

const initialState: BuilderState = {
  productName: "",
  productPrice: "",
  comparePrice: "",
  shortDescription: "",
  longDescription: "",
  productDescription: "",
  ctaText: "Order on WhatsApp",
  whatsappNumber: "",
  brandColor: "#0f172a",
  seoTitle: "",
  seoDescription: ""
};

type LandingBuilderProps = {
  publishLandingPage: (formData: FormData) => Promise<void>;
  initialData?: Partial<BuilderState> & {
    aiCopy?: AiLandingCopy | null;
    heroImageUrl?: string | null;
    id?: string;
    paymentMethods?: PaymentMethod[];
    templateId?: TemplateId;
    themeSettings?: Partial<LandingThemeSettings> | null;
  };
  mode?: "create" | "edit";
};

function normalizeBuyerCheckoutPaymentMethods(
  methods: PaymentMethod[] | undefined
): PaymentMethod[] {
  const supported = (methods ?? []).filter((method) =>
    isBuyerCheckoutPaymentMethod(method)
  );

  return supported.length ? supported : ["whatsapp"];
}

export function LandingBuilder({
  initialData,
  mode = "create",
  publishLandingPage
}: LandingBuilderProps) {
  const [step, setStep] = useState(0);
  const [product, setProduct] = useState<BuilderState>({
    ...initialState,
    ...initialData,
    ctaText: initialData?.ctaText ?? initialState.ctaText,
    productDescription:
      initialData?.productDescription ??
      initialData?.shortDescription ??
      initialState.productDescription
  });
  const [templateId, setTemplateId] = useState<TemplateId>(
    initialData?.templateId ?? "minimal"
  );
  const [themeSettings, setThemeSettings] = useState<LandingThemeSettings>(
    normalizeLandingThemeSettings({
      ...defaultLandingThemeSettings,
      ...initialData?.themeSettings,
      ctaText:
        initialData?.themeSettings?.ctaText ??
        initialData?.ctaText ??
        initialData?.aiCopy?.ctaText ??
        defaultLandingThemeSettings.ctaText
    })
  );
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>(
    normalizeBuyerCheckoutPaymentMethods(initialData?.paymentMethods)
  );
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [generatingField, setGeneratingField] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [heroPreview, setHeroPreview] = useState<string | null>(
    initialData?.heroImageUrl ?? null
  );
  const {
    copy,
    error: copyError,
    generateCopy,
    isGenerating
  } = useCopyGeneration();

  useEffect(() => {
    return () => {
      if (heroPreview) {
        URL.revokeObjectURL(heroPreview);
      }
    };
  }, [heroPreview]);

  const mergedCopy = useMemo(() => {
    const sourceCopy = copy ?? initialData?.aiCopy;

    if (!sourceCopy) {
      return null;
    }

    return {
      ...sourceCopy,
      productTitle: product.productName || sourceCopy.productTitle,
      headline: themeSettings.heroTitle || sourceCopy.headline,
      description:
        product.longDescription || product.shortDescription || sourceCopy.description,
      seoTitle: product.seoTitle || sourceCopy.seoTitle,
      seoDescription: product.seoDescription || sourceCopy.seoDescription,
      pricing: {
        ...sourceCopy.pricing,
        price: product.productPrice || sourceCopy.pricing.price
      },
      ctaText: themeSettings.ctaText || product.ctaText || sourceCopy.ctaText
    };
  }, [copy, initialData?.aiCopy, product, themeSettings.ctaText, themeSettings.heroTitle]);

  function updateProduct(field: keyof BuilderState, value: string) {
    setProduct((current) => ({
      ...current,
      [field]: value,
      productDescription:
        field === "shortDescription" ? value : current.productDescription
    }));
  }

  function updateTheme(field: keyof LandingThemeSettings, value: string) {
    setThemeSettings((current) => ({
      ...current,
      [field]: value
    }));

    if (field === "primaryColor") {
      updateProduct("brandColor", value);
    }
    if (field === "ctaText") {
      updateProduct("ctaText", value);
    }
  }

  function togglePayment(method: PaymentMethod) {
    if (!isBuyerCheckoutPaymentMethod(method)) {
      return;
    }

    setPaymentMethods((current) =>
      current.includes(method)
        ? current.filter((item) => item !== method)
        : [...current, method]
    );
  }

  async function generateField(field: "title" | "description" | "cta" | "seo") {
    setGeneratingField(field);
    setFieldError(null);
    try {
      const response = await fetch("/api/ai/field", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          field,
          productName: product.productName,
          shortDescription: product.shortDescription,
          longDescription: product.longDescription,
          price: product.productPrice,
          templateId
        })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? "Unable to generate field");
      }

      const data = (await response.json()) as {
        value?: string;
        seoTitle?: string;
        seoDescription?: string;
      };

      if (field === "title" && data.value) {
        updateProduct("productName", data.value);
      }
      if (field === "description" && data.value) {
        updateProduct("longDescription", data.value);
      }
      if (field === "cta" && data.value) {
        updateProduct("ctaText", data.value);
        updateTheme("ctaText", data.value);
      }
      if (field === "seo") {
        if (data.seoTitle) {
          updateProduct("seoTitle", data.seoTitle);
        }
        if (data.seoDescription) {
          updateProduct("seoDescription", data.seoDescription);
        }
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to generate field";
      setFieldError(message);
    } finally {
      setGeneratingField(null);
    }
  }

  async function onGenerateFullCopy() {
    setFieldError(null);
    try {
      await generateCopy({
        productName: product.productName,
        productPrice: product.productPrice,
        productDescription: product.shortDescription || product.longDescription,
        whatsappNumber: product.whatsappNumber,
        brandColor: product.brandColor,
        templateId
      });
    } catch {
      // The hook stores a user-facing error message.
    }
  }

  const aiCopyPayload: AiLandingCopy | null = mergedCopy
    ? {
        ...mergedCopy,
        seoTitle: product.seoTitle || mergedCopy.seoTitle,
        seoDescription: product.seoDescription || mergedCopy.seoDescription
      }
    : null;

  return (
    <form
      action={publishLandingPage}
      className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(380px,0.95fr)]"
    >
      <input name="aiCopy" type="hidden" value={aiCopyPayload ? JSON.stringify(aiCopyPayload) : ""} />
      <input name="paymentMethods" type="hidden" value={JSON.stringify(paymentMethods)} />
      <input name="landingId" type="hidden" value={initialData?.id ?? ""} />
      <input name="themeSettings" type="hidden" value={JSON.stringify(themeSettings)} />
      <input name="comparePrice" type="hidden" value={product.comparePrice} />
      <input name="longDescription" type="hidden" value={product.longDescription} />
      <input name="ctaText" type="hidden" value={product.ctaText} />
      <input name="seoTitle" type="hidden" value={product.seoTitle} />
      <input name="seoDescription" type="hidden" value={product.seoDescription} />
      <input name="productDescription" type="hidden" value={product.shortDescription} />

      <Card className="grid min-w-0 gap-6 p-5 lg:p-6">
        <div className="flex flex-wrap gap-2">
          {steps.map((label, index) => (
            <button
              className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.16em] transition ${
                step === index
                  ? "bg-ink text-white"
                  : "border border-slate-200 bg-white text-slate-500"
              }`}
              key={label}
              onClick={() => setStep(index)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>

        {fieldError || copyError ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm font-semibold leading-6 text-red-700">
            {fieldError ?? copyError}
          </div>
        ) : null}

        <div className={step === 0 ? "grid gap-4" : "hidden"}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-black tracking-[-0.02em] text-ink">
                Product details
              </h2>
              <Button
                disabled={Boolean(generatingField)}
                onClick={() => generateField("title")}
                type="button"
                variant="secondary"
              >
                {generatingField === "title" ? "Generating..." : "Generate title"}
              </Button>
            </div>
            <Input
              accept="image/*"
              id="heroImage"
              label="Product image"
              name="heroImage"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) {
                  return;
                }
                setHeroPreview(URL.createObjectURL(file));
              }}
              type="file"
            />
            <Input
              accept="image/*"
              id="galleryImages"
              label="Gallery uploads"
              multiple
              name="galleryImages"
              type="file"
            />
            <Input
              id="productName"
              label="Product name"
              name="productName"
              onChange={(event) => updateProduct("productName", event.target.value)}
              placeholder="Lumi Skin Serum"
              required
              value={product.productName}
            />
            <Textarea
              id="shortDescription"
              label="Short description"
              onChange={(event) => updateProduct("shortDescription", event.target.value)}
              placeholder="A lightweight serum for clear, glowing skin."
              required
              value={product.shortDescription}
            />
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-ink">Long description</p>
              <Button
                disabled={Boolean(generatingField)}
                onClick={() => generateField("description")}
                type="button"
                variant="secondary"
              >
                {generatingField === "description" ? "Generating..." : "Generate description"}
              </Button>
            </div>
            <Textarea
              id="longDescription"
              label=""
              onChange={(event) => updateProduct("longDescription", event.target.value)}
              placeholder="Explain the product benefits, ingredients, and why customers should buy."
              value={product.longDescription}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                id="productPrice"
                label="Product price"
                name="productPrice"
                onChange={(event) => updateProduct("productPrice", event.target.value)}
                placeholder="$39"
                required
                value={product.productPrice}
              />
              <Input
                id="comparePrice"
                label="Compare price"
                onChange={(event) => updateProduct("comparePrice", event.target.value)}
                placeholder="$59"
                value={product.comparePrice}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-ink">CTA text</p>
              <Button
                disabled={Boolean(generatingField)}
                onClick={() => generateField("cta")}
                type="button"
                variant="secondary"
              >
                {generatingField === "cta" ? "Generating..." : "Generate CTA"}
              </Button>
            </div>
            <Input
              id="ctaText"
              label=""
              onChange={(event) => updateTheme("ctaText", event.target.value)}
              placeholder="Order on WhatsApp"
              value={product.ctaText}
            />
            <Input
              id="whatsappNumber"
              label="WhatsApp number"
              name="whatsappNumber"
              onChange={(event) => updateProduct("whatsappNumber", event.target.value)}
              placeholder="+15551234567"
              required
              value={product.whatsappNumber}
            />
            <Input
              id="brandColor"
              label="Brand color"
              name="brandColor"
              onChange={(event) => updateTheme("primaryColor", event.target.value)}
              type="color"
              value={product.brandColor}
            />
        </div>

        <div className={step === 1 ? "grid gap-4" : "hidden"}>
            <h2 className="text-xl font-black tracking-[-0.02em] text-ink">
              Landing theme
            </h2>
            <p className="text-sm leading-6 text-muted">
              Customize colors, logo, hero title, CTA, footer, and announcement bar.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                id="themePrimaryColor"
                label="Primary color"
                onChange={(event) => updateTheme("primaryColor", event.target.value)}
                type="color"
                value={themeSettings.primaryColor}
              />
              <Input
                id="themeSecondaryColor"
                label="Background color"
                onChange={(event) => updateTheme("secondaryColor", event.target.value)}
                type="color"
                value={themeSettings.secondaryColor}
              />
            </div>
            <Input
              id="themeLogoUrl"
              label="Logo URL"
              onChange={(event) => updateTheme("logoUrl", event.target.value)}
              placeholder="https://..."
              value={themeSettings.logoUrl}
            />
            <Input
              id="themeHeroTitle"
              label="Hero title override"
              onChange={(event) => updateTheme("heroTitle", event.target.value)}
              placeholder="A sharper headline for your offer"
              value={themeSettings.heroTitle}
            />
            <Input
              id="themeCtaText"
              label="CTA text"
              onChange={(event) => updateTheme("ctaText", event.target.value)}
              placeholder="Order now"
              value={themeSettings.ctaText}
            />
            <Input
              id="themeAnnouncementText"
              label="Announcement bar"
              onChange={(event) => updateTheme("announcementText", event.target.value)}
              placeholder="Free delivery today only"
              value={themeSettings.announcementText}
            />
            <Input
              id="themeFooterText"
              label="Footer text"
              onChange={(event) => updateTheme("footerText", event.target.value)}
              placeholder="Powered by SHASTORE AI"
              value={themeSettings.footerText}
            />
        </div>

        <div className={step === 2 ? "grid gap-4" : "hidden"}>
            <h2 className="text-xl font-black tracking-[-0.02em] text-ink">
              Choose template
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {landingTemplates.map((template) => (
                <label
                  className={`cursor-pointer overflow-hidden rounded-3xl border transition ${
                    templateId === template.id
                      ? "border-ink bg-slate-50 shadow-sm"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                  }`}
                  key={template.id}
                >
                  <input
                    checked={templateId === template.id}
                    className="sr-only"
                    name="templateId"
                    onChange={() => setTemplateId(template.id as TemplateId)}
                    type="radio"
                    value={template.id}
                  />
                  <span
                    className="block h-28 p-4"
                    style={{ background: template.previewImage }}
                  >
                    <span className="flex h-full items-end justify-between gap-3 rounded-2xl bg-white/80 p-3 backdrop-blur">
                      <span>
                        <span className="block text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                          {template.category}
                        </span>
                        <span className="mt-1 block font-black text-ink">
                          {template.name}
                        </span>
                      </span>
                      <span className="rounded-full bg-ink px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-white">
                        Quick apply
                      </span>
                    </span>
                  </span>
                  <span className="block p-4">
                    <span className="block text-sm leading-6 text-muted">
                      {template.description}
                    </span>
                    <span className="mt-3 flex flex-wrap gap-2">
                      {template.colorPalette.map((color) => (
                        <span
                          className="h-5 w-5 rounded-full border border-white shadow ring-1 ring-slate-200"
                          key={color}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </span>
                    <span className="mt-3 flex flex-wrap gap-2">
                      {template.mobileOptimized ? (
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700">
                          Mobile optimized
                        </span>
                      ) : null}
                      {template.conversionOptimized ? (
                        <span className="rounded-full bg-blue-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-blue-700">
                          Conversion
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-3 block text-xs font-semibold leading-5 text-slate-500">
                      Best for {template.recommendedNiches.join(", ")}
                    </span>
                  </span>
                </label>
              ))}
            </div>
        </div>

        <div className={step === 3 ? "grid gap-4" : "hidden"}>
            <h2 className="text-xl font-black tracking-[-0.02em] text-ink">
              Payment methods
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {paymentOptions.map((option) => {
                const disabled = !isBuyerCheckoutPaymentMethod(option.id);

                return (
                  <label
                    className={`flex items-center justify-between rounded-3xl border p-4 transition ${
                      paymentMethods.includes(option.id)
                        ? "border-ink bg-slate-50"
                        : "border-slate-200 bg-white"
                    } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
                    key={option.id}
                  >
                    <span>
                      <span className="block font-bold text-ink">{option.label}</span>
                      {option.placeholder ? (
                        <span className="mt-1 block text-xs font-semibold text-muted">
                          {option.placeholder}
                        </span>
                      ) : null}
                    </span>
                    <input
                      checked={paymentMethods.includes(option.id)}
                      className="h-4 w-4"
                      disabled={disabled}
                      onChange={() => togglePayment(option.id)}
                      type="checkbox"
                    />
                  </label>
                );
              })}
            </div>
        </div>

        <div className={step === 4 ? "grid gap-4" : "hidden"}>
            <h2 className="text-xl font-black tracking-[-0.02em] text-ink">
              AI generation
            </h2>
            <p className="text-sm leading-6 text-muted">
              Generate individual fields or create the full landing page copy in one pass.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Button
                disabled={Boolean(generatingField)}
                onClick={() => generateField("title")}
                type="button"
                variant="secondary"
              >
                {generatingField === "title" ? "Generating..." : "Generate title"}
              </Button>
              <Button
                disabled={Boolean(generatingField)}
                onClick={() => generateField("description")}
                type="button"
                variant="secondary"
              >
                {generatingField === "description"
                  ? "Generating..."
                  : "Generate description"}
              </Button>
              <Button
                disabled={Boolean(generatingField)}
                onClick={() => generateField("cta")}
                type="button"
                variant="secondary"
              >
                {generatingField === "cta" ? "Generating..." : "Generate CTA"}
              </Button>
              <Button
                disabled={Boolean(generatingField)}
                onClick={() => generateField("seo")}
                type="button"
                variant="secondary"
              >
                {generatingField === "seo" ? "Generating..." : "Generate SEO copy"}
              </Button>
            </div>
            <Button disabled={isGenerating} onClick={onGenerateFullCopy} type="button">
              {isGenerating ? "Generating..." : "Generate full landing copy"}
            </Button>
            <div className="grid gap-3">
              <Input
                id="seoTitle"
                label="SEO title"
                onChange={(event) => updateProduct("seoTitle", event.target.value)}
                value={product.seoTitle}
              />
              <Textarea
                id="seoDescription"
                label="SEO description"
                onChange={(event) =>
                  updateProduct("seoDescription", event.target.value)
                }
                value={product.seoDescription}
              />
            </div>
        </div>

        <div className={step === 5 ? "grid gap-4" : "hidden"}>
            <h2 className="text-xl font-black tracking-[-0.02em] text-ink">
              Review and publish
            </h2>
            <p className="text-sm leading-6 text-muted">
              Save as draft or publish instantly to a public `/l/[slug]` route.
            </p>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm">
              <p className="font-bold text-ink">{product.productName || "Untitled product"}</p>
              <p className="mt-2 text-muted">
                {product.shortDescription || "Add a short description to improve conversion."}
              </p>
            </div>
        </div>

        <div className="flex flex-wrap gap-3 border-t border-slate-200 pt-4">
          <Button
            disabled={step === 0}
            onClick={() => setStep((current) => Math.max(0, current - 1))}
            type="button"
            variant="secondary"
          >
            Back
          </Button>
          {step < steps.length - 1 ? (
            <Button
              onClick={() => setStep((current) => Math.min(steps.length - 1, current + 1))}
              type="button"
            >
              Continue
            </Button>
          ) : (
            <>
              <Button name="publishMode" type="submit" value="draft" variant="secondary">
                Save draft
              </Button>
              <Button
                disabled={!product.productName}
                name="publishMode"
                type="submit"
                value="publish"
              >
                {mode === "edit" ? "Save and publish" : "Publish landing page"}
              </Button>
            </>
          )}
        </div>
      </Card>

      <Card className="min-w-0 p-5 lg:sticky lg:top-8 lg:self-start lg:p-6">
        <div className="mb-4 flex gap-2">
          {(["desktop", "mobile"] as const).map((modeOption) => (
            <button
              className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.16em] ${
                previewMode === modeOption
                  ? "bg-ink text-white"
                  : "border border-slate-200 bg-white text-slate-500"
              }`}
              key={modeOption}
              onClick={() => setPreviewMode(modeOption)}
              type="button"
            >
              {modeOption}
            </button>
          ))}
        </div>
        <LivePreview
          brandColor={product.brandColor}
          comparePrice={product.comparePrice}
          copy={mergedCopy}
          ctaText={product.ctaText}
          longDescription={product.longDescription}
          paymentMethods={paymentMethods}
          price={product.productPrice}
          previewMode={previewMode}
          productName={product.productName}
          shortDescription={product.shortDescription}
          templateId={templateId}
          whatsappNumber={product.whatsappNumber}
          heroPreview={heroPreview}
          themeSettings={themeSettings}
        />
      </Card>
    </form>
  );
}
