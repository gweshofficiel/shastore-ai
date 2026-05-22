import { cache } from "react";
import { headers } from "next/headers";
import type { PublicStorefrontPreview } from "@/lib/public-storefront-preview";
import { getPublicStorefrontPreview } from "@/lib/public-storefront-preview";
import { getStorefrontContextFromHostname } from "@/lib/storefront-hostname-context";
import { createAdminClient } from "@/lib/supabase/admin";
import type { StoreThemeTokens } from "@/lib/tenant/theme";
import { getStoreTheme, resolveThemeTokens } from "@/lib/tenant/theme";

export type TenantSource = "custom_domain" | "hostname" | "localhost_subdomain" | "slug";

export type TenantBranding = {
  primaryColor: string;
  secondaryColor: string;
  themeMode: string;
};

export type TenantSettings = {
  description: string | null;
  status: string;
  title: string;
  visibility: string;
};

export type TenantDomain = {
  hostname: string | null;
  primaryDomain: string | null;
  sslStatus: string | null;
  verificationStatus: string | null;
};

export type StoreTenantContext = {
  branding: TenantBranding;
  domain: TenantDomain;
  hostname: string | null;
  owner_user_id: string | null;
  preview: PublicStorefrontPreview;
  primary_domain: string | null;
  publish_state: string;
  settings: TenantSettings;
  source: TenantSource;
  store_instance_id: string;
  store_slug: string;
  theme: StoreThemeTokens;
};

type ResolveTenantStoreInput = {
  hostname?: string | null;
  slug?: string | null;
  source?: TenantSource | null;
};

type StoreInstanceMetadata = {
  owner_user_id: string | null;
  visibility: string | null;
};

type StoreDomainMetadata = {
  hostname: string | null;
  primary_domain: string | null;
  ssl_status: string | null;
  verification_status: string | null;
};

function tenantSourceFromHeader(value: string | null): TenantSource {
  if (value === "custom_domain" || value === "localhost_subdomain") {
    return value;
  }

  if (value === "platform_subdomain") {
    return "hostname";
  }

  return "slug";
}

async function getStoreInstanceMetadata(storeInstanceId: string): Promise<StoreInstanceMetadata> {
  const admin = createAdminClient();

  if (!admin) {
    return {
      owner_user_id: null,
      visibility: null
    };
  }

  const { data, error } = await admin
    .from("store_instances" as never)
    .select("owner_user_id, visibility")
    .eq("id", storeInstanceId)
    .maybeSingle();

  if (error || !data) {
    return {
      owner_user_id: null,
      visibility: null
    };
  }

  const row = data as StoreInstanceMetadata;
  return {
    owner_user_id: row.owner_user_id ?? null,
    visibility: row.visibility ?? null
  };
}

async function getDomainMetadata(
  storeInstanceId: string,
  hostname: string | null
): Promise<StoreDomainMetadata> {
  const admin = createAdminClient();

  if (!admin) {
    return {
      hostname,
      primary_domain: hostname,
      ssl_status: null,
      verification_status: null
    };
  }

  let query = admin
    .from("store_domains" as never)
    .select("hostname, primary_domain, ssl_status, verification_status")
    .eq("store_instance_id", storeInstanceId);

  query = hostname ? query.eq("hostname", hostname) : query.eq("is_primary", true);

  const { data, error } = await query.maybeSingle();

  if (error || !data) {
    return {
      hostname,
      primary_domain: hostname,
      ssl_status: null,
      verification_status: null
    };
  }

  const row = data as StoreDomainMetadata;
  return {
    hostname: row.hostname ?? hostname,
    primary_domain: row.primary_domain ?? row.hostname ?? hostname,
    ssl_status: row.ssl_status ?? null,
    verification_status: row.verification_status ?? null
  };
}

const resolveTenantStoreCached = cache(async function resolveTenantStoreCached(
  input: ResolveTenantStoreInput
): Promise<StoreTenantContext | null> {
  const hostname = input.hostname?.trim() || null;
  let slug = input.slug?.trim() || null;
  let source = input.source ?? (hostname ? "hostname" : "slug");

  if (!slug && hostname) {
    const hostnameContext = await getStorefrontContextFromHostname(hostname);

    if (!hostnameContext) {
      return null;
    }

    slug = hostnameContext.storeSlug;
    source =
      hostnameContext.source === "localhost_subdomain"
        ? "localhost_subdomain"
        : hostnameContext.source === "custom_domain"
          ? "custom_domain"
          : "hostname";
  }

  if (!slug) {
    return null;
  }

  const preview = await getPublicStorefrontPreview(slug);

  if (!preview) {
    return null;
  }

  const [instanceMetadata, domainMetadata] = await Promise.all([
    getStoreInstanceMetadata(preview.store.id),
    getDomainMetadata(preview.store.id, hostname)
  ]);
  const publishState =
    preview.store.visibility === "public" && preview.store.status === "active"
      ? "published"
      : preview.store.status;

  const baseContext = {
    branding: getTenantBranding(preview),
    domain: {
      hostname: domainMetadata.hostname,
      primaryDomain: domainMetadata.primary_domain,
      sslStatus: domainMetadata.ssl_status,
      verificationStatus: domainMetadata.verification_status
    },
    hostname,
    owner_user_id: instanceMetadata.owner_user_id,
    preview,
    primary_domain: domainMetadata.primary_domain,
    publish_state: publishState,
    settings: getTenantSettings(preview),
    source,
    store_instance_id: preview.store.id,
    store_slug: preview.store.slug,
    theme: null as unknown as StoreThemeTokens
  };
  const theme = await getStoreTheme(baseContext);

  return {
    ...baseContext,
    theme: resolveThemeTokens(theme)
  };
});

export async function resolveTenantStore(input: ResolveTenantStoreInput) {
  return resolveTenantStoreCached(input);
}

export async function getCurrentStoreContext(slug?: string) {
  const headerStore = await headers();
  const headerSlug = headerStore.get("x-shastore-store-slug");
  const hostname = headerStore.get("x-shastore-hostname");
  const source = tenantSourceFromHeader(headerStore.get("x-shastore-hostname-source"));

  return resolveTenantStore({
    hostname,
    slug: slug ?? headerSlug,
    source: hostname ? source : "slug"
  });
}

export function getTenantBranding(previewOrContext: PublicStorefrontPreview | StoreTenantContext) {
  const branding =
    "preview" in previewOrContext
      ? previewOrContext.preview.branding
      : previewOrContext.branding;

  return {
    primaryColor: branding.primaryColor,
    secondaryColor: branding.secondaryColor,
    themeMode: branding.themeMode
  };
}

export function getTenantSettings(previewOrContext: PublicStorefrontPreview | StoreTenantContext) {
  if ("preview" in previewOrContext) {
    return previewOrContext.settings;
  }

  const store = previewOrContext.store;

  return {
    description: store.description,
    status: store.status,
    title: store.title,
    visibility: store.visibility
  };
}

export function getTenantDomain(context: StoreTenantContext) {
  return context.domain;
}
