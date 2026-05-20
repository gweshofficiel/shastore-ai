"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { defaultStoreThemeSettings } from "@/lib/store-theme";
import {
  defaultStoreTemplateId,
  storeTemplateDescriptions,
  storeTemplateId,
  storeTemplates
} from "@/lib/store-templates";
import type { StoreThemeSettings } from "@/types/storefront";

type DraftCategory = {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
};

type DraftProduct = {
  id: string;
  categoryId: string;
  name: string;
  price: string;
  description: string;
  imageUrl: string;
};

type StoreState = {
  storeName: string;
  storeDescription: string;
  brandColor: string;
  currency: string;
  whatsappNumber: string;
  templateId: string;
};

type StoreBuilderProps = {
  saveStoreDraft: (formData: FormData) => Promise<void>;
};

const tabs = ["Basics", "Categories", "Products", "Theme", "Templates", "Preview"];

const initialStore: StoreState = {
  storeName: "",
  storeDescription: "",
  brandColor: "#0f172a",
  currency: "USD",
  whatsappNumber: "",
  templateId: defaultStoreTemplateId
};

function uid(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function StoreBuilder({ saveStoreDraft }: StoreBuilderProps) {
  const [tab, setTab] = useState(0);
  const [store, setStore] = useState<StoreState>(initialStore);
  const [categories, setCategories] = useState<DraftCategory[]>([
    { id: "category-1", name: "", description: "", imageUrl: "" }
  ]);
  const [products, setProducts] = useState<DraftProduct[]>([
    {
      id: "product-1",
      categoryId: "",
      name: "",
      price: "",
      description: "",
      imageUrl: ""
    }
  ]);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [theme, setTheme] = useState<StoreThemeSettings>(defaultStoreThemeSettings);

  const visibleCategories = useMemo(
    () => categories.filter((category) => category.name.trim()),
    [categories]
  );
  const visibleProducts = useMemo(
    () => products.filter((product) => product.name.trim()),
    [products]
  );

  function updateStore(field: keyof StoreState, value: string) {
    setStore((current) => ({ ...current, [field]: value }));
  }

  function updateTheme<K extends keyof StoreThemeSettings>(
    field: K,
    value: StoreThemeSettings[K]
  ) {
    setTheme((current) => ({ ...current, [field]: value }));
  }

  function updateCategory(id: string, field: keyof DraftCategory, value: string) {
    setCategories((current) =>
      current.map((category) =>
        category.id === id ? { ...category, [field]: value } : category
      )
    );
  }

  function updateProduct(id: string, field: keyof DraftProduct, value: string) {
    setProducts((current) =>
      current.map((product) =>
        product.id === id ? { ...product, [field]: value } : product
      )
    );
  }

  function addCategory() {
    setCategories((current) => [
      ...current,
      { id: uid("category"), name: "", description: "", imageUrl: "" }
    ]);
  }

  function addProduct() {
    setProducts((current) => [
      ...current,
      {
        id: uid("product"),
        categoryId: visibleCategories[0]?.id ?? "",
        name: "",
        price: "",
        description: "",
        imageUrl: ""
      }
    ]);
  }

  return (
    <form
      action={saveStoreDraft}
      className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(380px,0.85fr)]"
    >
      <input name="categories" type="hidden" value={JSON.stringify(categories)} />
      <input name="products" type="hidden" value={JSON.stringify(products)} />
      <input name="templateId" type="hidden" value={store.templateId} />
      <input name="themeSettings" type="hidden" value={JSON.stringify(theme)} />

      <Card className="grid min-w-0 gap-6 p-5 lg:p-6">
        <div className="flex flex-wrap gap-2">
          {tabs.map((label, index) => (
            <button
              className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.16em] transition ${
                tab === index
                  ? "bg-ink text-white"
                  : "border border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50"
              }`}
              key={label}
              onClick={() => setTab(index)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>

        <div className={tab === 0 ? "grid gap-4" : "hidden"}>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
              Store setup
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">
              Store basics
            </h2>
          </div>
          <Input
            id="storeName"
            label="Store name"
            name="storeName"
            onChange={(event) => updateStore("storeName", event.target.value)}
            placeholder="SHASTORE Demo Store"
            required
            value={store.storeName}
          />
          <Textarea
            id="storeDescription"
            label="Store description"
            name="storeDescription"
            onChange={(event) =>
              updateStore("storeDescription", event.target.value)
            }
            placeholder="Describe your categories, products, and customer experience."
            value={store.storeDescription}
          />
          <Input
            accept="image/*"
            id="storeLogo"
            label="Store logo upload"
            name="logoImage"
            type="file"
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <Input
              id="brandColor"
              label="Brand color"
              name="brandColor"
              onChange={(event) => {
                updateStore("brandColor", event.target.value);
                updateTheme("primaryColor", event.target.value);
              }}
              type="color"
              value={store.brandColor}
            />
            <Input
              id="currency"
              label="Currency"
              name="currency"
              onChange={(event) => updateStore("currency", event.target.value)}
              placeholder="USD"
              value={store.currency}
            />
            <Input
              id="whatsappNumber"
              label="WhatsApp number"
              name="whatsappNumber"
              onChange={(event) =>
                updateStore("whatsappNumber", event.target.value)
              }
              placeholder="+15551234567"
              value={store.whatsappNumber}
            />
          </div>
        </div>

        <div className={tab === 1 ? "grid gap-4" : "hidden"}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                Catalog structure
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">
                Categories
              </h2>
            </div>
            <Button onClick={addCategory} type="button" variant="secondary">
              Add category
            </Button>
          </div>
          {categories.map((category, index) => (
            <div
              className="grid gap-4 rounded-3xl border border-slate-200 bg-slate-50 p-4"
              key={category.id}
            >
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                Category {index + 1}
              </p>
              <Input
                id={`category-${category.id}-name`}
                label="Category name"
                onChange={(event) =>
                  updateCategory(category.id, "name", event.target.value)
                }
                placeholder="Skincare"
                value={category.name}
              />
              <Textarea
                id={`category-${category.id}-description`}
                label="Category description"
                onChange={(event) =>
                  updateCategory(category.id, "description", event.target.value)
                }
                placeholder="A short description for this collection."
                value={category.description}
              />
              <Input
                accept="image/*"
                id={`category-${category.id}-image`}
                label="Category image placeholder"
                type="file"
              />
              <Input
                id={`category-${category.id}-image-url`}
                label="Category image URL"
                onChange={(event) =>
                  updateCategory(category.id, "imageUrl", event.target.value)
                }
                placeholder="https://example.com/category.jpg"
                value={category.imageUrl}
              />
            </div>
          ))}
        </div>

        <div className={tab === 2 ? "grid gap-4" : "hidden"}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                Product catalog
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">
                Products
              </h2>
            </div>
            <Button onClick={addProduct} type="button" variant="secondary">
              Add product
            </Button>
          </div>
          {products.map((product, index) => (
            <div
              className="grid gap-4 rounded-3xl border border-slate-200 bg-slate-50 p-4"
              key={product.id}
            >
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                Product {index + 1}
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  id={`product-${product.id}-name`}
                  label="Product name"
                  onChange={(event) =>
                    updateProduct(product.id, "name", event.target.value)
                  }
                  placeholder="Glow Serum"
                  value={product.name}
                />
                <Input
                  id={`product-${product.id}-price`}
                  label="Product price"
                  onChange={(event) =>
                    updateProduct(product.id, "price", event.target.value)
                  }
                  placeholder="$39"
                  value={product.price}
                />
              </div>
              <Textarea
                id={`product-${product.id}-description`}
                label="Product description"
                onChange={(event) =>
                  updateProduct(product.id, "description", event.target.value)
                }
                placeholder="Describe the product benefits and offer."
                value={product.description}
              />
              <label className="grid gap-2 text-sm font-semibold text-ink">
                <span>Assign to category</span>
                <select
                  className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink shadow-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                  onChange={(event) =>
                    updateProduct(product.id, "categoryId", event.target.value)
                  }
                  value={product.categoryId}
                >
                  <option value="">Unassigned</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name || "Untitled category"}
                    </option>
                  ))}
                </select>
              </label>
              <Input
                accept="image/*"
                id={`product-${product.id}-image`}
                label="Product image placeholder"
                type="file"
              />
              <Input
                id={`product-${product.id}-image-url`}
                label="Product image URL"
                onChange={(event) =>
                  updateProduct(product.id, "imageUrl", event.target.value)
                }
                placeholder="https://example.com/product.jpg"
                value={product.imageUrl}
              />
            </div>
          ))}
        </div>

        <div className={tab === 3 ? "grid gap-4" : "hidden"}>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
              Theme customization
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">
              Customize the storefront theme
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Tune colors, typography, header, hero, buttons, and footer without
              changing store products or categories.
            </p>
          </div>

          <div className="grid gap-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
              Brand colors
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              <Input
                id="themePrimaryColor"
                label="Primary color"
                onChange={(event) => {
                  updateTheme("primaryColor", event.target.value);
                  updateStore("brandColor", event.target.value);
                }}
                type="color"
                value={theme.primaryColor}
              />
              <Input
                id="themeSecondaryColor"
                label="Secondary color"
                onChange={(event) => updateTheme("secondaryColor", event.target.value)}
                type="color"
                value={theme.secondaryColor}
              />
              <Input
                id="themeAccentColor"
                label="Accent color"
                onChange={(event) => updateTheme("accentColor", event.target.value)}
                type="color"
                value={theme.accentColor}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Input
                id="themeGradientFrom"
                label="Gradient from"
                onChange={(event) => updateTheme("gradientFrom", event.target.value)}
                type="color"
                value={theme.gradientFrom}
              />
              <Input
                id="themeGradientTo"
                label="Gradient to"
                onChange={(event) => updateTheme("gradientTo", event.target.value)}
                type="color"
                value={theme.gradientTo}
              />
              <label className="grid gap-2 text-sm font-semibold text-ink">
                <span>Button style</span>
                <select
                  className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink shadow-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                  onChange={(event) =>
                    updateTheme(
                      "buttonStyle",
                      event.target.value as StoreThemeSettings["buttonStyle"]
                    )
                  }
                  value={theme.buttonStyle}
                >
                  <option value="pill">Pill</option>
                  <option value="rounded">Rounded</option>
                  <option value="sharp">Sharp</option>
                </select>
              </label>
            </div>
          </div>

          <div className="grid gap-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
              Typography
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="grid gap-2 text-sm font-semibold text-ink">
                <span>Heading font</span>
                <select
                  className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink shadow-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                  onChange={(event) =>
                    updateTheme(
                      "headingFont",
                      event.target.value as StoreThemeSettings["headingFont"]
                    )
                  }
                  value={theme.headingFont}
                >
                  <option value="inter">Modern sans</option>
                  <option value="serif">Editorial serif</option>
                  <option value="display">Premium display</option>
                  <option value="mono">Tech mono</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm font-semibold text-ink">
                <span>Body font</span>
                <select
                  className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink shadow-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                  onChange={(event) =>
                    updateTheme(
                      "bodyFont",
                      event.target.value as StoreThemeSettings["bodyFont"]
                    )
                  }
                  value={theme.bodyFont}
                >
                  <option value="inter">Modern sans</option>
                  <option value="serif">Editorial serif</option>
                  <option value="display">Premium display</option>
                  <option value="mono">Tech mono</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm font-semibold text-ink">
                <span>Font scale</span>
                <select
                  className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink shadow-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                  onChange={(event) =>
                    updateTheme(
                      "fontScale",
                      event.target.value as StoreThemeSettings["fontScale"]
                    )
                  }
                  value={theme.fontScale}
                >
                  <option value="compact">Compact</option>
                  <option value="comfortable">Comfortable</option>
                  <option value="large">Large</option>
                </select>
              </label>
            </div>
          </div>

          <div className="grid gap-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
              Header and hero
            </p>
            <Input
              id="themeLogoUrl"
              label="Logo URL"
              onChange={(event) => updateTheme("logoUrl", event.target.value)}
              placeholder="https://example.com/logo.png"
              value={theme.logoUrl}
            />
            <Input
              id="themeAnnouncementText"
              label="Announcement bar"
              onChange={(event) => updateTheme("announcementText", event.target.value)}
              placeholder="Free delivery this week"
              value={theme.announcementText}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold text-ink">
                <span>Navigation style</span>
                <select
                  className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink shadow-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                  onChange={(event) =>
                    updateTheme(
                      "navigationStyle",
                      event.target.value as StoreThemeSettings["navigationStyle"]
                    )
                  }
                  value={theme.navigationStyle}
                >
                  <option value="centered">Centered</option>
                  <option value="split">Split</option>
                  <option value="minimal">Minimal</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm font-semibold text-ink">
                <span>Sticky header</span>
                <select
                  className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink shadow-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                  onChange={(event) =>
                    updateTheme("stickyHeader", event.target.value === "true")
                  }
                  value={String(theme.stickyHeader)}
                >
                  <option value="true">Enabled</option>
                  <option value="false">Disabled</option>
                </select>
              </label>
            </div>
            <Input
              id="themeHeroTitle"
              label="Hero title"
              onChange={(event) => updateTheme("heroTitle", event.target.value)}
              placeholder="Premium products for modern customers"
              value={theme.heroTitle}
            />
            <Textarea
              id="themeHeroSubtitle"
              label="Hero subtitle"
              onChange={(event) => updateTheme("heroSubtitle", event.target.value)}
              placeholder="A custom hero message for this storefront."
              value={theme.heroSubtitle}
            />
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="grid gap-2 text-sm font-semibold text-ink">
                <span>Hero background</span>
                <select
                  className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink shadow-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                  onChange={(event) =>
                    updateTheme(
                      "heroBackground",
                      event.target.value as StoreThemeSettings["heroBackground"]
                    )
                  }
                  value={theme.heroBackground}
                >
                  <option value="gradient">Gradient</option>
                  <option value="solid">Solid</option>
                  <option value="glass">Glass</option>
                  <option value="image">Image-led</option>
                </select>
              </label>
              <Input
                id="themeCtaText"
                label="CTA text"
                onChange={(event) => updateTheme("ctaText", event.target.value)}
                value={theme.ctaText}
              />
              <label className="grid gap-2 text-sm font-semibold text-ink">
                <span>CTA style</span>
                <select
                  className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink shadow-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                  onChange={(event) =>
                    updateTheme("ctaStyle", event.target.value as StoreThemeSettings["ctaStyle"])
                  }
                  value={theme.ctaStyle}
                >
                  <option value="filled">Filled</option>
                  <option value="outline">Outline</option>
                  <option value="glass">Glass</option>
                </select>
              </label>
            </div>
          </div>

          <div className="grid gap-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
              Footer
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="grid gap-2 text-sm font-semibold text-ink">
                <span>Footer style</span>
                <select
                  className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink shadow-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                  onChange={(event) =>
                    updateTheme(
                      "footerStyle",
                      event.target.value as StoreThemeSettings["footerStyle"]
                    )
                  }
                  value={theme.footerStyle}
                >
                  <option value="minimal">Minimal</option>
                  <option value="bold">Bold</option>
                  <option value="glass">Glass</option>
                </select>
              </label>
              <Input
                id="themeFooterBackground"
                label="Footer background"
                onChange={(event) => updateTheme("footerBackgroundColor", event.target.value)}
                type="color"
                value={theme.footerBackgroundColor}
              />
              <Input
                id="themeFooterText"
                label="Footer text"
                onChange={(event) => updateTheme("footerTextColor", event.target.value)}
                type="color"
                value={theme.footerTextColor}
              />
            </div>
            <Input
              id="themeCopyright"
              label="Copyright text"
              onChange={(event) => updateTheme("copyrightText", event.target.value)}
              placeholder="© 2026 Your Store. All rights reserved."
              value={theme.copyrightText}
            />
            <div className="grid gap-4 sm:grid-cols-3">
              <Input
                id="themeInstagram"
                label="Instagram URL"
                onChange={(event) => updateTheme("instagramUrl", event.target.value)}
                placeholder="https://instagram.com/..."
                value={theme.instagramUrl}
              />
              <Input
                id="themeTiktok"
                label="TikTok URL"
                onChange={(event) => updateTheme("tiktokUrl", event.target.value)}
                placeholder="https://tiktok.com/@..."
                value={theme.tiktokUrl}
              />
              <Input
                id="themeFacebook"
                label="Facebook URL"
                onChange={(event) => updateTheme("facebookUrl", event.target.value)}
                placeholder="https://facebook.com/..."
                value={theme.facebookUrl}
              />
            </div>
          </div>
        </div>

        <div className={tab === 4 ? "grid gap-4" : "hidden"}>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
              Store templates
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">
              Choose a store template
            </h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {storeTemplates.map((template) => {
              const templateId = storeTemplateId(template);
              return (
                <label
                  className={`cursor-pointer rounded-3xl border p-4 transition ${
                    store.templateId === templateId
                      ? "border-ink bg-slate-50 shadow-sm"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                  }`}
                  key={template}
                >
                  <input
                    checked={store.templateId === templateId}
                    className="sr-only"
                    onChange={() => updateStore("templateId", templateId)}
                    type="radio"
                    value={templateId}
                  />
                  <span className="block font-black text-ink">{template}</span>
                  <span className="mt-1 block text-sm leading-6 text-muted">
                    {storeTemplateDescriptions[templateId]}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        <div className={tab === 5 ? "grid gap-4" : "hidden"}>
          <h2 className="text-2xl font-black tracking-[-0.03em] text-ink">
            Review store draft
          </h2>
          <p className="text-sm leading-6 text-muted">
            Save this Store Mode project as a draft. Public store publishing is
            intentionally not enabled yet.
          </p>
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm">
            <p className="font-bold text-ink">
              {store.storeName || "Untitled store"}
            </p>
            <p className="mt-2 text-muted">
              {visibleCategories.length} categories · {visibleProducts.length} products
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 border-t border-slate-200 pt-4">
          <Button
            disabled={tab === 0}
            onClick={() => setTab((current) => Math.max(0, current - 1))}
            type="button"
            variant="secondary"
          >
            Back
          </Button>
          {tab < tabs.length - 1 ? (
            <Button
              onClick={() => setTab((current) => Math.min(tabs.length - 1, current + 1))}
              type="button"
            >
              Continue
            </Button>
          ) : null}
          {tab === tabs.length - 1 ? (
            <Button disabled={!store.storeName} type="submit">
              Save store draft
            </Button>
          ) : (
            <Button disabled={!store.storeName} type="submit" variant="secondary">
              Save draft
            </Button>
          )}
        </div>
      </Card>

      <Card className="min-w-0 p-5 lg:sticky lg:top-8 lg:self-start lg:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
            Template preview
          </p>
          <div className="flex rounded-full border border-slate-200 bg-white p-1">
            {(["desktop", "mobile"] as const).map((mode) => (
              <button
                className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] transition ${
                  previewMode === mode
                    ? "bg-ink text-white"
                    : "text-slate-500 hover:bg-slate-50"
                }`}
                key={mode}
                onClick={() => setPreviewMode(mode)}
                type="button"
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
        <div
          className={`overflow-hidden rounded-[2rem] border border-slate-200 bg-white transition ${
            previewMode === "mobile" ? "mx-auto max-w-[340px]" : ""
          }`}
        >
          <div
            className="flex items-center justify-between border-b border-slate-200 px-4 py-3"
            style={{
              background: `linear-gradient(135deg, ${theme.gradientFrom}, ${theme.gradientTo})`,
              color: "#fff"
            }}
          >
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-white/60">
                Live preview
              </p>
              <p className="mt-1 text-sm font-bold text-white">
                {store.storeName || "Store homepage"}
              </p>
            </div>
            <div
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: store.brandColor }}
            />
          </div>
          <div className="p-5">
            {theme.announcementText ? (
              <div
                className="mb-4 rounded-2xl px-4 py-2 text-center text-xs font-black uppercase tracking-[0.18em] text-white"
                style={{ backgroundColor: theme.accentColor }}
              >
                {theme.announcementText}
              </div>
            ) : null}
            <div
              className="rounded-[1.75rem] p-5"
              style={{
                background:
                  theme.heroBackground === "solid"
                    ? theme.primaryColor
                    : `linear-gradient(135deg, ${theme.gradientFrom}, ${theme.gradientTo})`,
                color: "#fff"
              }}
            >
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                {store.templateId}
              </p>
              <h2 className="mt-3 text-3xl font-black tracking-[-0.04em] text-white">
                {theme.heroTitle || store.storeName || "Your multi-category store"}
              </h2>
              <p className="mt-3 text-sm leading-6 text-white/75">
                {theme.heroSubtitle ||
                  store.storeDescription ||
                  "A premium storefront preview for categories, products, and WhatsApp ordering."}
              </p>
              <a
                className={`mt-5 inline-flex h-10 items-center justify-center px-4 text-xs font-black ${
                  theme.buttonStyle === "sharp"
                    ? "rounded-lg"
                    : theme.buttonStyle === "rounded"
                      ? "rounded-2xl"
                      : "rounded-full"
                }`}
                href={`https://wa.me/${store.whatsappNumber.replace(/\D/g, "")}`}
                style={{
                  backgroundColor:
                    theme.ctaStyle === "outline" ? "transparent" : theme.primaryColor,
                  border: `1px solid ${theme.accentColor}`,
                  color: theme.ctaStyle === "outline" ? theme.accentColor : "#fff"
                }}
              >
                {theme.ctaText}
              </a>
            </div>
            <div className="mt-4">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                Categories
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {(visibleCategories.length ? visibleCategories : categories.slice(0, 2)).map(
                  (category, index) => (
                    <div
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
                      key={category.id}
                    >
                      <p className="text-sm font-bold text-ink">
                        {category.name || `Category ${index + 1}`}
                      </p>
                    </div>
                  )
                )}
              </div>
            </div>
            <div className="mt-4">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                Featured products
              </p>
              <div className="mt-3 grid gap-2">
                {(visibleProducts.length ? visibleProducts : products.slice(0, 2)).map(
                  (product, index) => (
                    <div
                      className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-3"
                      key={product.id}
                    >
                      <p className="text-sm font-bold text-ink">
                        {product.name || `Product ${index + 1}`}
                      </p>
                      <p className="text-xs font-black text-slate-400">
                        {product.price || store.currency}
                      </p>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>
    </form>
  );
}
