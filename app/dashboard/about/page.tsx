import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { saveStoreAboutPage } from "@/lib/store-about-actions";
import { createClient } from "@/lib/supabase/server";
import { fetchStoresForAuthUser, type UserStoreRow } from "@/lib/stores/user-stores";
import { getActiveWorkspaceForUser } from "@/lib/workspaces/active-workspace";

export const dynamic = "force-dynamic";

type AboutPageRow = {
  company_story: string | null;
  cover_image_url: string | null;
  founder_message: string | null;
  gallery_images: string[] | null;
  id: string;
  mission: string | null;
  status: string;
  subtitle: string | null;
  team_intro: string | null;
  title: string;
  updated_at: string | null;
  vision: string | null;
};

type AboutDashboardData = {
  about: AboutPageRow | null;
  activeStore: UserStoreRow | null;
  error: string | null;
  stores: UserStoreRow[];
};

function statusMessage(status: string | undefined) {
  const messages: Record<string, string> = {
    "already-exists": "This store already has an About page. Refresh and edit the existing draft.",
    "draft-saved": "About page draft saved.",
    "missing-store": "Choose a store before managing About Us.",
    "missing-title": "About page title is required.",
    "not-authorized": "You do not have permission to manage that store.",
    published: "About page published.",
    "save-failed": "About page could not be saved."
  };

  return status ? messages[status] : null;
}

function statusClass(status: string) {
  return status === "published"
    ? "bg-emerald-100 text-emerald-700"
    : "bg-amber-100 text-amber-700";
}

function galleryText(value: string[] | null) {
  return Array.isArray(value) ? value.join("\n") : "";
}

async function getAboutDashboardData(selectedStoreId?: string): Promise<AboutDashboardData> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { about: null, activeStore: null, error: "Sign in to manage About Us.", stores: [] };
  }

  const selection = await getActiveWorkspaceForUser({ supabase, userId: user.id });
  const workspaceId = selection.activeWorkspaceId;
  const { stores, error: storesError } = await fetchStoresForAuthUser(supabase, user.id, workspaceId);

  if (storesError) {
    return { about: null, activeStore: null, error: "Stores could not be loaded.", stores: [] };
  }

  const activeStore = stores.find((store) => store.id === selectedStoreId) ?? stores[0] ?? null;

  if (!activeStore) {
    return { about: null, activeStore: null, error: null, stores };
  }

  const { data, error } = await supabase
    .from("store_about_pages" as never)
    .select("id, title, subtitle, company_story, mission, vision, founder_message, team_intro, cover_image_url, gallery_images, status, updated_at")
    .eq("workspace_id" as never, workspaceId as never)
    .eq("store_id" as never, activeStore.id as never)
    .maybeSingle();

  if (error) {
    return {
      about: null,
      activeStore,
      error: "About page could not be loaded. Confirm the About Us migration has been applied.",
      stores
    };
  }

  return {
    about: (data ?? null) as unknown as AboutPageRow | null,
    activeStore,
    error: null,
    stores
  };
}

export default async function AboutDashboard({
  searchParams
}: {
  searchParams: Promise<{ about?: string; storeId?: string }>;
}) {
  const query = await searchParams;
  const { about, activeStore, error, stores } = await getAboutDashboardData(query.storeId);
  const message = statusMessage(query.about);
  const status = about?.status ?? "draft";

  return (
    <div className="grid gap-6 lg:gap-8">
      <PageHeader
        description="Create a dedicated About Us page for your public storefront."
        title="About Us"
      />

      {message ? (
        <Card className="border-blue-100 bg-blue-50 p-4 text-sm font-bold text-blue-800">
          {message}
        </Card>
      ) : null}

      {error ? (
        <Card className="border-red-200 bg-red-50 p-5 text-sm font-bold text-red-700">
          {error}
        </Card>
      ) : null}

      {stores.length ? (
        <Card className="p-4">
          <form className="flex flex-wrap items-end gap-3">
            <label className="grid gap-2 text-sm font-bold text-ink">
              <span>Store</span>
              <select
                className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-ink outline-none"
                defaultValue={activeStore?.id}
                name="storeId"
              >
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.store_name || store.name || store.slug || store.id}
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit" variant="secondary">
              View store
            </Button>
          </form>
        </Card>
      ) : null}

      {activeStore ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.55fr)]">
          <Card className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${statusClass(status)}`}>
                  {status}
                </span>
                <h2 className="mt-3 text-2xl font-black tracking-[-0.03em] text-ink">
                  About page content
                </h2>
              </div>
              {about?.status === "published" && activeStore.slug ? (
                <a
                  className="rounded-full bg-slate-100 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-muted"
                  href={`/store/${activeStore.slug}/about`}
                  target="_blank"
                >
                  Preview
                </a>
              ) : null}
            </div>

            <form action={saveStoreAboutPage} className="mt-5 grid gap-4">
              <input name="storeId" type="hidden" value={activeStore.id} />
              {about ? <input name="aboutId" type="hidden" value={about.id} /> : null}
              <Input
                defaultValue={about?.title ?? "About Us"}
                id="about-title"
                label="Title"
                maxLength={180}
                name="title"
                required
              />
              <Textarea
                defaultValue={about?.subtitle ?? ""}
                id="about-subtitle"
                label="Subtitle"
                maxLength={500}
                name="subtitle"
                placeholder="A short introduction to your store."
                rows={3}
              />
              <Textarea
                defaultValue={about?.company_story ?? ""}
                id="about-company-story"
                label="Company Story"
                maxLength={12000}
                name="companyStory"
                placeholder="Tell customers how your store started."
                rows={8}
              />
              <div className="grid gap-4 md:grid-cols-2">
                <Textarea
                  defaultValue={about?.mission ?? ""}
                  id="about-mission"
                  label="Mission"
                  maxLength={4000}
                  name="mission"
                  rows={5}
                />
                <Textarea
                  defaultValue={about?.vision ?? ""}
                  id="about-vision"
                  label="Vision"
                  maxLength={4000}
                  name="vision"
                  rows={5}
                />
              </div>
              <Textarea
                defaultValue={about?.founder_message ?? ""}
                id="about-founder-message"
                label="Founder Message"
                maxLength={8000}
                name="founderMessage"
                rows={6}
              />
              <Textarea
                defaultValue={about?.team_intro ?? ""}
                id="about-team-intro"
                label="Team Introduction"
                maxLength={8000}
                name="teamIntro"
                rows={6}
              />
              <Input
                defaultValue={about?.cover_image_url ?? ""}
                id="about-cover-image"
                label="Cover Image URL"
                maxLength={1000}
                name="coverImageUrl"
                placeholder="https://..."
              />
              <Textarea
                defaultValue={galleryText(about?.gallery_images ?? null)}
                id="about-gallery-images"
                label="Gallery Images"
                maxLength={8000}
                name="galleryImages"
                placeholder="One image URL per line."
                rows={5}
              />
              <div className="flex flex-wrap gap-2">
                <Button name="status" type="submit" value="draft">
                  Save Draft
                </Button>
                <Button name="status" type="submit" value="published" variant="secondary">
                  Publish
                </Button>
                {about?.status === "published" ? (
                  <Button name="status" type="submit" value="draft" variant="secondary">
                    Unpublish
                  </Button>
                ) : null}
              </div>
            </form>
          </Card>

          <Card className="p-5">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
              Preview
            </p>
            {about?.cover_image_url ? (
              <img
                alt={about.title}
                className="mt-4 aspect-[16/9] w-full rounded-3xl object-cover"
                src={about.cover_image_url}
              />
            ) : null}
            <h3 className="mt-4 text-3xl font-black tracking-[-0.04em] text-ink">
              {about?.title ?? "About Us"}
            </h3>
            {about?.subtitle ? (
              <p className="mt-3 text-sm font-semibold leading-6 text-muted">
                {about.subtitle}
              </p>
            ) : null}
            <div className="mt-5 grid gap-3 text-sm font-semibold leading-6 text-muted">
              {[about?.company_story, about?.mission, about?.vision, about?.founder_message, about?.team_intro]
                .filter(Boolean)
                .slice(0, 3)
                .map((item, index) => (
                  <p className="rounded-2xl bg-slate-50 p-3" key={index}>
                    {item}
                  </p>
                ))}
            </div>
            {about?.gallery_images?.length ? (
              <div className="mt-5 grid grid-cols-2 gap-3">
                {about.gallery_images.slice(0, 4).map((imageUrl) => (
                  <img
                    alt=""
                    className="aspect-square rounded-2xl object-cover"
                    key={imageUrl}
                    src={imageUrl}
                  />
                ))}
              </div>
            ) : null}
          </Card>
        </div>
      ) : null}
    </div>
  );
}
