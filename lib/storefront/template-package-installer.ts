import type { SupabaseClient } from "@supabase/supabase-js";
import { sanitizePageContent } from "@/lib/store-pages/content";
import {
  getTemplatePackageForTemplate,
  type TemplatePackage,
  type TemplatePackageInstallationRecord,
  type TemplatePackageStatus
} from "@/lib/storefront/template-packages";

type InstallStepResult = TemplatePackageInstallationRecord["steps"][number];

export type TemplatePackageInstallResult = {
  installed: boolean;
  packageId: string | null;
  status: TemplatePackageStatus | "skipped";
  steps: InstallStepResult[];
};

type InstallerInput = {
  storeId: string;
  supabase: SupabaseClient;
  templateId: string;
  userId: string;
  workspaceId: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);

  return slug || "template-item";
}

function asStoreData(value: unknown) {
  return isRecord(value) ? value : {};
}

function packageInstallations(value: unknown) {
  const data = asStoreData(value);
  const installations = data.templatePackageInstallations;
  return isRecord(installations) ? installations : {};
}

function packageStatusFromSteps(steps: InstallStepResult[]): TemplatePackageStatus {
  const failed = steps.filter((step) => step.status === "failed").length;
  const succeeded = steps.filter((step) => step.status === "success" || step.status === "skipped").length;

  if (failed === 0) {
    return "installed";
  }

  return succeeded > 0 ? "partially_installed" : "failed";
}

async function loadStoreData(supabase: SupabaseClient, storeId: string) {
  const { data, error } = await supabase
    .from("stores" as never)
    .select("store_data")
    .eq("id" as never, storeId as never)
    .maybeSingle();

  if (error) {
    return { error: error.message, storeData: {} };
  }

  return {
    error: null,
    storeData: asStoreData((data as { store_data?: unknown } | null)?.store_data)
  };
}

async function writeInstallationRecord({
  record,
  storeData,
  storeId,
  supabase
}: {
  record: TemplatePackageInstallationRecord;
  storeData: Record<string, unknown>;
  storeId: string;
  supabase: SupabaseClient;
}) {
  const installations = {
    ...packageInstallations(storeData),
    [record.packageId]: record
  };
  const nextStoreData = {
    ...storeData,
    templatePackageInstallations: installations
  };

  const { error } = await supabase
    .from("stores" as never)
    .update({
      store_data: nextStoreData,
      updated_at: new Date().toISOString()
    } as never)
    .eq("id" as never, storeId as never);

  return error?.message ?? null;
}

async function runStep(name: string, task: () => Promise<number>): Promise<InstallStepResult> {
  try {
    const count = await task();
    return { count, name, status: "success" };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
      name,
      status: "failed"
    };
  }
}

async function installCategories({
  installer,
  templatePackage
}: {
  installer: InstallerInput;
  templatePackage: TemplatePackage;
}) {
  const categories = templatePackage.categories ?? [];

  if (!categories.length) {
    return 0;
  }

  const { data } = await installer.supabase
    .from("store_categories" as never)
    .select("id, name, slug")
    .eq("store_id" as never, installer.storeId as never);
  const existing = Array.isArray(data) ? data as Array<{ id: string; name?: string | null; slug?: string | null }> : [];
  let inserted = 0;

  for (const category of categories) {
    const slug = slugify(category.key || category.name);
    const match = existing.find((row) => row.slug === slug || row.name === category.name);

    if (match) {
      continue;
    }

    const { error } = await installer.supabase
      .from("store_categories" as never)
      .insert({
        description: category.description ?? null,
        image_url: category.imageUrl ?? null,
        name: category.name,
        slug,
        sort_order: category.sortOrder ?? inserted,
        status: category.status ?? "active",
        store_id: installer.storeId,
        user_id: installer.userId,
        workspace_id: installer.workspaceId
      } as never);

    if (error) {
      throw new Error(error.message);
    }

    inserted += 1;
  }

  return inserted;
}

async function categoryIdMap(installer: InstallerInput, templatePackage: TemplatePackage) {
  const map = new Map<string, string>();
  const { data } = await installer.supabase
    .from("store_categories" as never)
    .select("id, name, slug")
    .eq("store_id" as never, installer.storeId as never);
  const rows = Array.isArray(data) ? data as Array<{ id: string; name?: string | null; slug?: string | null }> : [];

  for (const category of templatePackage.categories ?? []) {
    const slug = slugify(category.key || category.name);
    const row = rows.find((item) => item.slug === slug || item.name === category.name);

    if (row) {
      map.set(category.key, row.id);
    }
  }

  return map;
}

async function installProducts({
  installer,
  templatePackage
}: {
  installer: InstallerInput;
  templatePackage: TemplatePackage;
}) {
  const products = templatePackage.products ?? [];

  if (!products.length) {
    return 0;
  }

  const categories = await categoryIdMap(installer, templatePackage);
  const { data } = await installer.supabase
    .from("store_products" as never)
    .select("id, name, slug")
    .eq("store_id" as never, installer.storeId as never);
  const existing = Array.isArray(data) ? data as Array<{ id: string; name?: string | null; slug?: string | null }> : [];
  let inserted = 0;

  for (const product of products) {
    const slug = product.slug || slugify(product.key || product.name);
    const match = existing.find((row) => row.slug === slug || row.name === product.name);

    if (match) {
      continue;
    }

    const { error } = await installer.supabase
      .from("store_products" as never)
      .insert({
        category_id: product.categoryKey ? categories.get(product.categoryKey) ?? null : null,
        compare_at_price: product.compareAtPrice ?? null,
        currency: product.currency ?? "USD",
        description: product.description ?? null,
        image_url: product.imageUrl ?? null,
        inventory_status: product.trackInventory && (product.stockQuantity ?? 0) <= 0 ? "out_of_stock" : "in_stock",
        name: product.name,
        price: product.price,
        product_type: product.productType ?? "physical",
        requires_shipping: product.productType !== "digital",
        slug,
        status: product.status ?? "draft",
        stock_quantity: product.stockQuantity ?? 0,
        store_id: installer.storeId,
        title: product.name,
        track_inventory: product.trackInventory ?? false,
        user_id: installer.userId,
        workspace_id: installer.workspaceId
      } as never);

    if (error) {
      throw new Error(error.message);
    }

    inserted += 1;
  }

  return inserted;
}

async function productIdMap(installer: InstallerInput, templatePackage: TemplatePackage) {
  const map = new Map<string, string>();
  const { data } = await installer.supabase
    .from("store_products" as never)
    .select("id, name, slug")
    .eq("store_id" as never, installer.storeId as never);
  const rows = Array.isArray(data) ? data as Array<{ id: string; name?: string | null; slug?: string | null }> : [];

  for (const product of templatePackage.products ?? []) {
    const slug = product.slug || slugify(product.key || product.name);
    const row = rows.find((item) => item.slug === slug || item.name === product.name);

    if (row) {
      map.set(product.key, row.id);
    }
  }

  return map;
}

async function installVariants({
  installer,
  templatePackage
}: {
  installer: InstallerInput;
  templatePackage: TemplatePackage;
}) {
  const variants = templatePackage.variants ?? [];

  if (!variants.length) {
    return 0;
  }

  const products = await productIdMap(installer, templatePackage);
  let inserted = 0;

  for (const variant of variants) {
    const productId = products.get(variant.productKey);

    if (!productId) {
      continue;
    }

    const { error } = await installer.supabase
      .from("product_variants" as never)
      .insert({
        name: variant.name,
        option_color: variant.color ?? null,
        option_material: variant.material ?? null,
        option_size: variant.size ?? null,
        price_override: variant.priceOverride ?? null,
        product_id: productId,
        sku: variant.sku ?? null,
        status: variant.status ?? "active",
        stock_quantity: variant.stockQuantity ?? 0,
        store_id: installer.storeId,
        workspace_id: installer.workspaceId
      } as never);

    if (error) {
      throw new Error(error.message);
    }

    inserted += 1;
  }

  return inserted;
}

async function installReviews({
  installer,
  templatePackage
}: {
  installer: InstallerInput;
  templatePackage: TemplatePackage;
}) {
  const reviews = templatePackage.reviews ?? [];

  if (!reviews.length) {
    return 0;
  }

  const products = await productIdMap(installer, templatePackage);
  let inserted = 0;

  for (const review of reviews) {
    const productId = products.get(review.productKey);

    if (!productId) {
      continue;
    }

    const { error } = await installer.supabase
      .from("product_reviews" as never)
      .insert({
        comment: review.comment,
        customer_name: review.customerName,
        product_id: productId,
        rating: review.rating,
        status: "approved",
        store_id: installer.storeId,
        title: review.title ?? null,
        verified_purchase: false,
        workspace_id: installer.workspaceId
      } as never);

    if (error) {
      throw new Error(error.message);
    }

    inserted += 1;
  }

  return inserted;
}

async function installFaqs(installer: InstallerInput, templatePackage: TemplatePackage) {
  const faqs = templatePackage.faq ?? [];

  if (!faqs.length) {
    return 0;
  }

  const { data } = await installer.supabase
    .from("store_faqs" as never)
    .select("question")
    .eq("store_id" as never, installer.storeId as never);
  const existingQuestions = new Set(
    (Array.isArray(data) ? data : [])
      .map((row) => (row as { question?: string | null }).question)
      .filter(Boolean)
  );
  let inserted = 0;

  for (const faq of faqs) {
    if (existingQuestions.has(faq.question)) {
      continue;
    }

    const { error } = await installer.supabase
      .from("store_faqs" as never)
      .insert({
        answer: faq.answer,
        created_by: installer.userId,
        question: faq.question,
        sort_order: faq.sortOrder ?? inserted,
        status: faq.status ?? "published",
        store_id: installer.storeId,
        workspace_id: installer.workspaceId
      } as never);

    if (error) {
      throw new Error(error.message);
    }

    inserted += 1;
  }

  return inserted;
}

async function installBlogArticles(installer: InstallerInput, templatePackage: TemplatePackage) {
  const articles = templatePackage.blogArticles ?? [];

  if (!articles.length) {
    return 0;
  }

  const { data } = await installer.supabase
    .from("store_blog_articles" as never)
    .select("slug")
    .eq("store_id" as never, installer.storeId as never);
  const existingSlugs = new Set(
    (Array.isArray(data) ? data : [])
      .map((row) => (row as { slug?: string | null }).slug)
      .filter(Boolean)
  );
  let inserted = 0;

  for (const article of articles) {
    if (existingSlugs.has(article.slug)) {
      continue;
    }

    const { error } = await installer.supabase
      .from("store_blog_articles" as never)
      .insert({
        content: sanitizePageContent(article.content),
        created_by: installer.userId,
        excerpt: article.excerpt ?? null,
        published_at: article.status === "draft" ? null : new Date().toISOString(),
        slug: article.slug,
        status: article.status ?? "published",
        store_id: installer.storeId,
        title: article.title,
        workspace_id: installer.workspaceId
      } as never);

    if (error) {
      throw new Error(error.message);
    }

    inserted += 1;
  }

  return inserted;
}

async function installAboutPage(installer: InstallerInput, templatePackage: TemplatePackage) {
  const about = templatePackage.aboutPage;

  if (!about) {
    return 0;
  }

  const { data: existing } = await installer.supabase
    .from("store_about_pages" as never)
    .select("id")
    .eq("store_id" as never, installer.storeId as never)
    .maybeSingle();

  if (existing) {
    return 0;
  }

  const { error } = await installer.supabase
    .from("store_about_pages" as never)
    .insert({
      company_story: about.companyStory ?? null,
      created_by: installer.userId,
      founder_message: about.founderMessage ?? null,
      mission: about.mission ?? null,
      status: about.status ?? "published",
      store_id: installer.storeId,
      subtitle: about.subtitle ?? null,
      title: about.title,
      vision: about.vision ?? null,
      workspace_id: installer.workspaceId
    } as never);

  if (error) {
    throw new Error(error.message);
  }

  return 1;
}

async function installPages(installer: InstallerInput, templatePackage: TemplatePackage) {
  const pages = [...(templatePackage.pages ?? []), ...(templatePackage.legalPages ?? [])];

  if (!pages.length) {
    return 0;
  }

  const { data } = await installer.supabase
    .from("store_pages" as never)
    .select("slug, page_type")
    .eq("store_id" as never, installer.storeId as never);
  const existing = new Set(
    (Array.isArray(data) ? data : []).map((row) => {
      const page = row as { page_type?: string | null; slug?: string | null };
      return `${page.page_type ?? ""}:${page.slug ?? ""}`;
    })
  );
  let inserted = 0;

  for (const page of pages) {
    const key = `${page.pageType}:${page.slug}`;

    if (existing.has(key)) {
      continue;
    }

    const { error } = await installer.supabase
      .from("store_pages" as never)
      .insert({
        content: sanitizePageContent(page.content),
        created_by: installer.userId,
        page_type: page.pageType,
        slug: page.slug,
        status: page.status ?? "published",
        store_id: installer.storeId,
        title: page.title,
        workspace_id: installer.workspaceId
      } as never);

    if (error) {
      throw new Error(error.message);
    }

    inserted += 1;
  }

  return inserted;
}

async function installHomepageSections(installer: InstallerInput, templatePackage: TemplatePackage) {
  const sections = templatePackage.homepageSections ?? [];

  if (!sections.length) {
    return 0;
  }

  const rows = sections.map((section) => ({
    enabled: section.enabled ?? true,
    section_type: section.sectionType,
    settings: section.settings ?? {},
    sort_order: section.sortOrder,
    store_id: installer.storeId,
    subtitle: section.subtitle ?? null,
    title: section.title ?? null,
    workspace_id: installer.workspaceId
  }));
  const { error } = await installer.supabase
    .from("store_homepage_sections" as never)
    .upsert(rows as never, { onConflict: "store_id,section_type" });

  if (error) {
    throw new Error(error.message);
  }

  return rows.length;
}

async function installMarketingBlocks(installer: InstallerInput, templatePackage: TemplatePackage) {
  const blocks = templatePackage.marketingBlocks ?? [];

  if (!blocks.length) {
    return 0;
  }

  const { data } = await installer.supabase
    .from("store_marketing_messages" as never)
    .select("title, message_type")
    .eq("store_id" as never, installer.storeId as never);
  const existing = new Set(
    (Array.isArray(data) ? data : []).map((row) => {
      const message = row as { message_type?: string | null; title?: string | null };
      return `${message.message_type ?? ""}:${message.title ?? ""}`;
    })
  );
  let inserted = 0;

  for (const block of blocks) {
    const key = `${block.messageType}:${block.title}`;

    if (existing.has(key)) {
      continue;
    }

    const { error } = await installer.supabase
      .from("store_marketing_messages" as never)
      .insert({
        button_link: block.buttonLink ?? null,
        button_text: block.buttonText ?? null,
        created_by: installer.userId,
        message: block.message,
        message_type: block.messageType,
        status: block.status ?? "draft",
        store_id: installer.storeId,
        title: block.title,
        workspace_id: installer.workspaceId
      } as never);

    if (error) {
      throw new Error(error.message);
    }

    inserted += 1;
  }

  return inserted;
}

async function installNavigationLinks(installer: InstallerInput, templatePackage: TemplatePackage) {
  const links = templatePackage.navigationLinks ?? [];

  if (!links.length) {
    return 0;
  }

  const { data } = await installer.supabase
    .from("store_navigation_links" as never)
    .select("custom_url, label, location")
    .eq("store_id" as never, installer.storeId as never);
  const existing = new Set(
    (Array.isArray(data) ? data : []).map((row) => {
      const link = row as { custom_url?: string | null; label?: string | null; location?: string | null };
      return `${link.location ?? ""}:${link.custom_url ?? ""}:${link.label ?? ""}`;
    })
  );
  let inserted = 0;

  for (const link of links) {
    const key = `${link.location ?? "header"}:${link.customUrl ?? ""}:${link.label}`;

    if (existing.has(key)) {
      continue;
    }

    const { error } = await installer.supabase
      .from("store_navigation_links" as never)
      .insert({
        custom_url: link.customUrl ?? null,
        is_enabled: link.isEnabled ?? true,
        label: link.label,
        link_type: link.linkType ?? "custom",
        location: link.location ?? "header",
        sort_order: link.sortOrder,
        store_id: installer.storeId,
        workspace_id: installer.workspaceId
      } as never);

    if (error) {
      throw new Error(error.message);
    }

    inserted += 1;
  }

  return inserted;
}

async function installFooterSettings({
  installer,
  storeData,
  templatePackage
}: {
  installer: InstallerInput;
  storeData: Record<string, unknown>;
  templatePackage: TemplatePackage;
}) {
  if (!templatePackage.footerLinkSettings && !templatePackage.visualSlots) {
    return 0;
  }

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString()
  };
  let count = 0;

  if (templatePackage.footerLinkSettings) {
    updates.footer_link_settings = templatePackage.footerLinkSettings;
    count += 1;
  }

  if (templatePackage.visualSlots) {
    updates.store_data = {
      ...storeData,
      templateVisualSlots: {
        ...(isRecord(storeData.templateVisualSlots) ? storeData.templateVisualSlots : {}),
        [templatePackage.id]: templatePackage.visualSlots
      }
    };
    count += 1;
  }

  const { error } = await installer.supabase
    .from("stores" as never)
    .update(updates as never)
    .eq("id" as never, installer.storeId as never);

  if (error) {
    throw new Error(error.message);
  }

  return count;
}

export async function installTemplatePackageForTemplate(input: InstallerInput): Promise<TemplatePackageInstallResult> {
  const templatePackage = getTemplatePackageForTemplate(input.templateId);

  if (!templatePackage) {
    return {
      installed: false,
      packageId: null,
      status: "skipped",
      steps: [{ name: "package-registry", status: "skipped" }]
    };
  }

  return installTemplatePackage({
    ...input,
    templatePackage
  });
}

export async function installTemplatePackage(input: InstallerInput & { templatePackage: TemplatePackage }): Promise<TemplatePackageInstallResult> {
  const startedAt = new Date().toISOString();
  const storeDataResult = await loadStoreData(input.supabase, input.storeId);
  const existingInstall = packageInstallations(storeDataResult.storeData)[input.templatePackage.id];

  if (isRecord(existingInstall)) {
    const status = typeof existingInstall.status === "string" ? existingInstall.status : "installed";
    return {
      installed: false,
      packageId: input.templatePackage.id,
      status: status === "failed" || status === "partially_installed" || status === "installed" ? status : "skipped",
      steps: [{ name: "duplicate-prevention", status: "skipped" }]
    };
  }

  const steps: InstallStepResult[] = [];
  const installer = {
    storeId: input.storeId,
    supabase: input.supabase,
    templateId: input.templateId,
    userId: input.userId,
    workspaceId: input.workspaceId
  };

  steps.push(await runStep("categories", () => installCategories({ installer, templatePackage: input.templatePackage })));
  steps.push(await runStep("products", () => installProducts({ installer, templatePackage: input.templatePackage })));
  steps.push(await runStep("variants", () => installVariants({ installer, templatePackage: input.templatePackage })));
  steps.push(await runStep("reviews", () => installReviews({ installer, templatePackage: input.templatePackage })));
  steps.push(await runStep("faq", () => installFaqs(installer, input.templatePackage)));
  steps.push(await runStep("blog", () => installBlogArticles(installer, input.templatePackage)));
  steps.push(await runStep("about-page", () => installAboutPage(installer, input.templatePackage)));
  steps.push(await runStep("pages", () => installPages(installer, input.templatePackage)));
  steps.push(await runStep("homepage-sections", () => installHomepageSections(installer, input.templatePackage)));
  steps.push(await runStep("marketing-blocks", () => installMarketingBlocks(installer, input.templatePackage)));
  steps.push(await runStep("navigation-links", () => installNavigationLinks(installer, input.templatePackage)));
  steps.push(await runStep("footer-and-visual-settings", () => installFooterSettings({
    installer,
    storeData: storeDataResult.storeData,
    templatePackage: input.templatePackage
  })));

  const status = packageStatusFromSteps(steps);
  const record: TemplatePackageInstallationRecord = {
    completedAt: new Date().toISOString(),
    packageId: input.templatePackage.id,
    packageVersion: input.templatePackage.version,
    startedAt,
    status,
    steps,
    templateId: input.templateId
  };
  const latestStoreData = (await loadStoreData(input.supabase, input.storeId)).storeData;
  const metadataError = await writeInstallationRecord({
    record,
    storeData: latestStoreData,
    storeId: input.storeId,
    supabase: input.supabase
  });

  if (metadataError) {
    steps.push({ error: metadataError, name: "status-tracking", status: "failed" });
    return {
      installed: false,
      packageId: input.templatePackage.id,
      status: "partially_installed",
      steps
    };
  }

  return {
    installed: status === "installed",
    packageId: input.templatePackage.id,
    status,
    steps
  };
}
