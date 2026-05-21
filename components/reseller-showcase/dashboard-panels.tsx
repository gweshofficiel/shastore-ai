import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TemplateHeroThumbnail } from "@/components/templates/demo-store-preview";
import {
  publishResellerShowcaseItem,
  saveResellerProfile,
  saveResellerShowcaseItem,
  unpublishResellerShowcaseItem
} from "@/lib/reseller-showcase/actions";
import type { ResellerDashboardData } from "@/lib/reseller-showcase/data";
import { resellerShowcaseThemes } from "@/lib/reseller-showcase/themes";
import { getStoreTemplate } from "@/lib/template-studio/library";
import type {
  ResellerProfile,
  ResellerShowcaseItem
} from "@/lib/reseller-showcase/types";

export type ResellerPageQuery = {
  error?: string;
  saved?: string;
};

function asStringList(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item)).join("\n") : "";
}

function itemStatusClass(status: ResellerShowcaseItem["status"]) {
  if (status === "published") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (status === "unpublished") {
    return "bg-amber-100 text-amber-700";
  }

  return "bg-slate-100 text-slate-600";
}

function returnTo(path: string) {
  return <input name="returnTo" type="hidden" value={path} />;
}

export function ResellerStatusAlerts({
  query
}: {
  query: ResellerPageQuery;
}) {
  return (
    <>
      {query.saved ? (
        <Card className="border-emerald-200 bg-emerald-50 p-5">
          <p className="text-sm font-bold text-emerald-700">Reseller dashboard saved.</p>
        </Card>
      ) : null}
      {query.error ? (
        <Card className="border-red-200 bg-red-50 p-5">
          <p className="text-sm font-bold text-red-700">{query.error}</p>
        </Card>
      ) : null}
    </>
  );
}

export function ResellerOverviewCards({ data }: { data: ResellerDashboardData }) {
  const publishedItems = data.items.filter((item) => item.status === "published");
  const draftItems = data.items.filter((item) => item.status !== "published");

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Card className="p-5">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
          Showcase Status
        </p>
        <p className="mt-3 text-3xl font-black text-ink">
          {data.profile?.is_published ? "Live" : "Draft"}
        </p>
        <p className="mt-1 text-sm text-muted">
          {data.profile ? `/reseller/${data.profile.slug}` : "Create your profile"}
        </p>
      </Card>
      <Card className="p-5">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
          Published Stores
        </p>
        <p className="mt-3 text-3xl font-black text-ink">{publishedItems.length}</p>
        <p className="mt-1 text-sm text-muted">Live marketplace listings</p>
      </Card>
      <Card className="p-5">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
          Draft Stores
        </p>
        <p className="mt-3 text-3xl font-black text-ink">{draftItems.length}</p>
        <p className="mt-1 text-sm text-muted">Saved or unpublished listings</p>
      </Card>
      <Card className="p-5">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
          Public Link
        </p>
        <p className="mt-3 text-3xl font-black text-ink">
          {data.profile?.is_published ? "Ready" : "Hidden"}
        </p>
        <p className="mt-1 text-sm text-muted">Dedicated reseller showcase</p>
      </Card>
    </div>
  );
}

export function ResellerQuickActions({ profile }: { profile: ResellerProfile | null }) {
  return (
    <Card className="p-6 lg:p-8">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
        Quick Actions
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link
          className="inline-flex h-11 items-center rounded-full bg-ink px-5 text-sm font-black text-white"
          href="/reseller/dashboard/showcase"
        >
          Edit showcase
        </Link>
        <Link
          className="inline-flex h-11 items-center rounded-full border border-slate-200 bg-white px-5 text-sm font-black text-ink"
          href="/reseller/dashboard/stores"
        >
          Manage listings
        </Link>
        {profile?.is_published ? (
          <Link
            className="inline-flex h-11 items-center rounded-full border border-slate-200 bg-white px-5 text-sm font-black text-ink"
            href={`/reseller/${profile.slug}`}
            target="_blank"
          >
            Preview public showcase
          </Link>
        ) : null}
      </div>
      <p className="mt-4 text-sm leading-6 text-muted">
        Reseller tools are separated from normal seller tools. Storefronts, buyer checkout,
        seller payment settings, and platform billing remain outside this dashboard area.
      </p>
    </Card>
  );
}

export function ResellerShowcaseProfileForm({
  profile,
  returnPath
}: {
  profile: ResellerProfile | null;
  returnPath: string;
}) {
  return (
    <form action={saveResellerProfile} className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
      {returnTo(returnPath)}
      <Card className="p-6 lg:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
          Showcase Manager
        </p>
        <h2 className="mt-3 text-2xl font-black tracking-[-0.03em] text-ink">
          Profile and branding
        </h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Input
            defaultValue={profile?.display_name ?? ""}
            id="displayName"
            label="Showcase name"
            name="displayName"
            placeholder="Acme Store Studio"
            required
          />
          <Input
            defaultValue={profile?.slug ?? ""}
            id="slug"
            label="Showcase slug"
            name="slug"
            placeholder="acme-studio"
          />
          <Input
            defaultValue={profile?.logo_url ?? ""}
            id="logoUrl"
            label="Logo URL"
            name="logoUrl"
            placeholder="https://..."
          />
          <Input
            defaultValue={profile?.banner_url ?? ""}
            id="bannerUrl"
            label="Banner URL"
            name="bannerUrl"
            placeholder="https://..."
          />
        </div>
        <div className="mt-4">
          <Textarea
            defaultValue={profile?.bio ?? ""}
            id="bio"
            label="Showcase bio"
            name="bio"
            placeholder="Tell buyers what kind of stores and templates you build."
          />
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Input
            defaultValue={profile?.website_url ?? ""}
            id="websiteUrl"
            label="Website"
            name="websiteUrl"
            placeholder="https://..."
          />
          <Input
            defaultValue={profile?.instagram_url ?? ""}
            id="instagramUrl"
            label="Instagram"
            name="instagramUrl"
            placeholder="https://instagram.com/..."
          />
          <Input
            defaultValue={profile?.tiktok_url ?? ""}
            id="tiktokUrl"
            label="TikTok"
            name="tiktokUrl"
            placeholder="https://tiktok.com/@..."
          />
        </div>
        <label className="mt-5 flex items-start gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-ink">
          <input
            className="mt-1 h-4 w-4"
            defaultChecked={profile?.is_published ?? false}
            name="isPublished"
            type="checkbox"
          />
          Publish this reseller showcase publicly
        </label>
        {profile?.is_published ? (
          <Link
            className="mt-4 inline-flex h-11 items-center rounded-full border border-slate-200 bg-white px-5 text-sm font-black text-ink"
            href={`/reseller/${profile.slug}`}
            target="_blank"
          >
            Preview public showcase
          </Link>
        ) : null}
      </Card>

      <Card className="p-6 lg:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
          Showcase Design
        </p>
        <h2 className="mt-3 text-2xl font-black tracking-[-0.03em] text-ink">
          Theme selection
        </h2>
        <div className="mt-5 grid gap-3">
          {resellerShowcaseThemes.map((theme) => (
            <label
              className="grid cursor-pointer gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4"
              key={theme.id}
            >
              <span className={`h-20 rounded-2xl ${theme.previewClass}`} />
              <span className="flex items-start gap-3">
                <input
                  className="mt-1"
                  defaultChecked={(profile?.theme_id ?? "minimal") === theme.id}
                  name="themeId"
                  type="radio"
                  value={theme.id}
                />
                <span>
                  <span className="block font-black text-ink">{theme.name}</span>
                  <span className="mt-1 block text-sm leading-6 text-muted">
                    {theme.description}
                  </span>
                </span>
              </span>
            </label>
          ))}
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Input
            defaultValue={profile?.primary_color ?? "#0f172a"}
            id="primaryColor"
            label="Primary color"
            name="primaryColor"
          />
          <Input
            defaultValue={profile?.accent_color ?? "#2563eb"}
            id="accentColor"
            label="Accent color"
            name="accentColor"
          />
        </div>
        <div className="mt-5">
          <Button type="submit">Save showcase</Button>
        </div>
      </Card>
    </form>
  );
}

export function ResellerShowcaseItemForm({
  returnPath,
  stores
}: {
  returnPath: string;
  stores: ResellerDashboardData["stores"];
}) {
  return (
    <Card className="p-6 lg:p-8">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
        Store Listings Manager
      </p>
      <h2 className="mt-3 text-2xl font-black tracking-[-0.03em] text-ink">
        Create marketplace listing
      </h2>
      <form action={saveResellerShowcaseItem} className="mt-5 grid gap-4">
        {returnTo(returnPath)}
        <div className="grid gap-4 md:grid-cols-3">
          <Input id="title" label="Title" name="title" placeholder="Luxury Fashion Store" required />
          <Input id="itemSlug" label="Listing slug" name="itemSlug" placeholder="luxury-fashion-store" />
          <label className="grid min-w-0 gap-2 text-sm font-semibold text-ink">
            Linked store draft
            <select
              className="h-12 min-w-0 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink shadow-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
              name="sourceStoreId"
            >
              <option value="">No linked store</option>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>
          </label>
          <Input id="category" label="Category" name="category" placeholder="Fashion" />
          <Input id="priceLabel" label="Price" name="priceLabel" placeholder="$299 setup" />
          <Input id="demoUrl" label="Demo link" name="demoUrl" placeholder="/store/demo-slug" />
          <Input id="thumbnailUrl" label="Thumbnail URL" name="thumbnailUrl" placeholder="https://..." />
          <Input id="sortOrder" label="Sort order" name="sortOrder" placeholder="0" type="number" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Textarea
            id="description"
            label="Description"
            name="description"
            placeholder="Describe what buyers get with this store/template."
          />
          <Textarea
            id="features"
            label="Features"
            name="features"
            placeholder="One feature per line"
          />
          <Textarea
            id="previewImages"
            label="Preview images"
            name="previewImages"
            placeholder="One image URL per line"
          />
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm font-bold text-ink">
            <input name="publishNow" type="checkbox" />
            Publish immediately
          </label>
          <Button type="submit">Save marketplace item</Button>
        </div>
        <div className="rounded-3xl border border-blue-200 bg-blue-50 p-4 text-sm font-semibold leading-6 text-blue-900">
          Future expansion points: ownership transfer, reseller sales, template duplication,
          client takeover, and verification codes can attach to these listings later.
        </div>
      </form>
    </Card>
  );
}

export function ResellerListingsGrid({
  items,
  returnPath,
  title
}: {
  items: ResellerShowcaseItem[];
  returnPath: string;
  title: string;
}) {
  return (
    <Card className="p-6 lg:p-8">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
        {title}
      </p>
      <div className="mt-5 grid gap-3">
        {items.length ? (
          items.map((item) => (
            <ShowcaseItemCard item={item} key={item.id} returnPath={returnPath} />
          ))
        ) : (
          <p className="rounded-3xl bg-slate-50 p-4 text-sm leading-6 text-muted">
            No listings in this section yet.
          </p>
        )}
      </div>
    </Card>
  );
}

function ShowcaseItemCard({
  item,
  returnPath
}: {
  item: ResellerShowcaseItem;
  returnPath: string;
}) {
  const featureSummary = asStringList(item.features).split("\n").slice(0, 3).join(" / ");
  const templatePreviewId = Array.isArray(item.preview_images)
    ? item.preview_images
        .map((image) => String(image))
        .find((image) => image.startsWith("template:"))
        ?.replace("template:", "")
    : null;
  const templatePreview = templatePreviewId ? getStoreTemplate(templatePreviewId) : null;

  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
      {templatePreview ? (
        <div className="mb-4">
          <TemplateHeroThumbnail template={templatePreview} />
        </div>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-black text-ink">{item.title}</h3>
          <p className="mt-1 text-sm text-muted">{item.price_label ?? "Pricing on request"}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${itemStatusClass(item.status)}`}>
          {item.status}
        </span>
      </div>
      <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted">
        {item.description ?? "No description yet."}
      </p>
      {featureSummary ? (
        <p className="mt-2 text-xs font-semibold text-slate-500">{featureSummary}</p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {item.demo_url ? (
          <Link
            className="inline-flex h-10 items-center rounded-full border border-slate-200 bg-white px-4 text-sm font-bold text-ink"
            href={item.demo_url}
            target="_blank"
          >
            Demo
          </Link>
        ) : null}
        {item.status === "published" ? (
          <form action={unpublishResellerShowcaseItem}>
            {returnTo(returnPath)}
            <input name="itemId" type="hidden" value={item.id} />
            <Button type="submit" variant="secondary">
              Unpublish
            </Button>
          </form>
        ) : (
          <form action={publishResellerShowcaseItem}>
            {returnTo(returnPath)}
            <input name="itemId" type="hidden" value={item.id} />
            <Button type="submit">Publish</Button>
          </form>
        )}
      </div>
    </div>
  );
}

export function ResellerPlaceholderPanel({
  description,
  items,
  title
}: {
  description: string;
  items: string[];
  title: string;
}) {
  return (
    <Card className="p-8 text-center lg:p-10">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
        Placeholder
      </p>
      <h2 className="mt-3 text-3xl font-black tracking-[-0.04em] text-ink">{title}</h2>
      <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-muted">{description}</p>
      <div className="mx-auto mt-6 grid max-w-3xl gap-3 md:grid-cols-3">
        {items.map((item) => (
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-ink" key={item}>
            {item}
          </div>
        ))}
      </div>
    </Card>
  );
}

export function ResellerSettingsPanel({ profile }: { profile: ResellerProfile | null }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
      <Card className="p-6 lg:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
          Reseller Settings
        </p>
        <h2 className="mt-3 text-2xl font-black tracking-[-0.03em] text-ink">
          Business info
        </h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Input
            defaultValue={profile?.display_name ?? ""}
            disabled
            id="businessName"
            label="Business name"
          />
          <Input
            defaultValue={profile?.website_url ?? ""}
            disabled
            id="supportContact"
            label="Support contact placeholder"
            placeholder="support@example.com"
          />
        </div>
        <p className="mt-4 rounded-3xl bg-slate-50 p-4 text-sm leading-6 text-muted">
          Reseller business profile fields are currently managed from Showcase Manager.
          Dedicated business settings can be persisted here in a future reseller account
          settings migration.
        </p>
      </Card>
      <Card className="p-6 lg:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
          Payouts and notifications
        </p>
        <div className="mt-5 grid gap-3">
          {["Payout method placeholder", "VIP reseller earnings placeholder", "Email notifications placeholder"].map((item) => (
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-ink" key={item}>
              {item}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
