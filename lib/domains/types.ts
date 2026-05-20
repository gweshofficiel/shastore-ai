export type DomainSourceType = "landing" | "store";
export type DomainKind = "free_subdomain" | "custom_domain" | "branded_domain";
export type DomainStatus = "pending" | "verified" | "failed";
export type SslStatus = "pending" | "ready" | "failed";

export type DomainRecord = {
  id: string;
  user_id: string;
  hostname: string;
  kind: DomainKind;
  status: DomainStatus;
  ssl_status: SslStatus;
  verification_token: string;
  dns_target: string;
  nameserver_instructions: string[] | null;
  hostinsh_zone_id: string | null;
  created_at: string;
  updated_at: string;
};

export type PublicationHost = {
  id: string;
  user_id: string;
  domain_id: string | null;
  hostname: string;
  source_type: DomainSourceType;
  source_slug: string;
  publication_url: string;
  status: "draft" | "published" | "unpublished";
  seo_title: string | null;
  seo_description: string | null;
  canonical_url: string | null;
  sitemap_enabled: boolean;
  robots_indexable: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DnsVerification = {
  id: string;
  user_id: string;
  domain_id: string;
  hostname: string;
  record_type: "TXT" | "CNAME" | "A";
  record_name: string;
  record_value: string;
  status: DomainStatus;
  checked_at: string | null;
  created_at: string;
};

export type PublishEvent = {
  id: string;
  user_id: string;
  source_type: DomainSourceType;
  source_slug: string;
  hostname: string | null;
  event_type: string;
  metadata: Record<string, unknown>;
  created_at: string;
};
