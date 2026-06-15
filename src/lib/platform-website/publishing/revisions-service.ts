import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";

export type PlatformContentType = "platform_blog_post" | "platform_page" | "platform_page_block";
export type PlatformApprovalStatus = "approved" | "draft" | "pending_review" | "rejected";

export type PlatformContentRevisionRecord = {
  contentId: string;
  contentType: PlatformContentType;
  createdAt: string | null;
  createdBy: string | null;
  id: string;
  note: string | null;
  revisionNumber: number;
  snapshot: Record<string, unknown>;
};

export type PlatformPublishingMetadata = {
  approvalStatus: PlatformApprovalStatus;
  approvedAt: string | null;
  approvedBy: string | null;
  scheduledPublishAt: string | null;
};

export type PlatformAdvancedPublishingItem = PlatformPublishingMetadata & {
  contentId: string;
  contentType: "platform_blog_post" | "platform_page";
  label: string;
  status: string;
  updatedAt: string | null;
};

export type PlatformAdvancedPublishingDashboard = {
  pendingReviewItems: PlatformAdvancedPublishingItem[];
  recentRevisions: PlatformContentRevisionRecord[];
  rejectedItems: PlatformAdvancedPublishingItem[];
  scheduledItems: PlatformAdvancedPublishingItem[];
};

type RevisionRow = {
  content_id?: string | null;
  content_type?: string | null;
  created_at?: string | null;
  created_by?: string | null;
  id?: string | null;
  note?: string | null;
  revision_number?: number | null;
  snapshot?: unknown;
};

type MetadataRow = {
  approval_status?: string | null;
  approved_at?: string | null;
  approved_by?: string | null;
  id?: string | null;
  scheduled_publish_at?: string | null;
  status?: string | null;
  title?: string | null;
  updated_at?: string | null;
};

const contentTypes: PlatformContentType[] = ["platform_page", "platform_blog_post", "platform_page_block"];
const approvalStatuses: PlatformApprovalStatus[] = ["draft", "pending_review", "approved", "rejected"];

const selects: Record<PlatformContentType, string> = {
  platform_blog_post: "id, slug, title, excerpt, content, status, author_name, cover_image_url, seo_title, seo_description, translations, published_at, approval_status, approved_by, approved_at, scheduled_publish_at, created_at, updated_at",
  platform_page: "id, slug, title, status, route_path, page_type, headline, subtitle, body, seo_title, seo_description, canonical_path, open_graph, translations, content_status, approval_status, approved_by, approved_at, scheduled_publish_at, created_at, updated_at",
  platform_page_block: "id, page_id, block_type, title, subtitle, content, settings, sort_order, status, created_at, updated_at"
};

const tables: Record<PlatformContentType, string> = {
  platform_blog_post: "platform_blog_posts",
  platform_page: "platform_pages",
  platform_page_block: "platform_page_blocks"
};

const rollbackFields: Record<PlatformContentType, string[]> = {
  platform_blog_post: [
    "author_name",
    "content",
    "cover_image_url",
    "excerpt",
    "seo_description",
    "seo_title",
    "slug",
    "title",
    "translations"
  ],
  platform_page: [
    "body",
    "canonical_path",
    "content_status",
    "headline",
    "open_graph",
    "seo_description",
    "seo_title",
    "subtitle",
    "title",
    "translations"
  ],
  platform_page_block: [
    "block_type",
    "content",
    "settings",
    "sort_order",
    "status",
    "subtitle",
    "title"
  ]
};

function text(value: unknown, maxLength = 2000) {
  if (typeof value !== "string") return "";

  return value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/\bjavascript:/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function safeJson(value: unknown, depth = 0): unknown {
  if (depth > 8) return null;
  if (typeof value === "string") return text(value, 5000);
  if (typeof value === "number" || typeof value === "boolean" || value === null) return value;
  if (Array.isArray(value)) return value.slice(0, 200).map((item) => safeJson(item, depth + 1));
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 200)
        .map(([key, item]) => [text(key, 120), safeJson(item, depth + 1)])
        .filter(([key]) => Boolean(key))
    );
  }

  return null;
}

function safeJsonRecord(value: unknown) {
  const sanitized = safeJson(value);

  return isRecord(sanitized) ? sanitized : {};
}

function parseContentType(value: unknown): PlatformContentType {
  const cleaned = text(value, 60);

  if (!contentTypes.includes(cleaned as PlatformContentType)) {
    throw new Error("Invalid platform content type.");
  }

  return cleaned as PlatformContentType;
}

function parseApprovalStatus(value: unknown): PlatformApprovalStatus {
  return approvalStatuses.includes(value as PlatformApprovalStatus)
    ? value as PlatformApprovalStatus
    : "draft";
}

function parseRevision(row: unknown): PlatformContentRevisionRecord | null {
  if (!isRecord(row)) return null;

  const value = row as RevisionRow;
  const id = text(value.id, 120);
  const contentId = text(value.content_id, 120);
  const revisionNumber = typeof value.revision_number === "number" ? value.revision_number : 0;

  if (!id || !contentId || revisionNumber < 1) return null;

  return {
    contentId,
    contentType: parseContentType(value.content_type),
    createdAt: text(value.created_at, 80) || null,
    createdBy: text(value.created_by, 120) || null,
    id,
    note: text(value.note, 500) || null,
    revisionNumber,
    snapshot: safeJsonRecord(value.snapshot)
  };
}

function parseMetadata(row: unknown): PlatformPublishingMetadata {
  const value = isRecord(row) ? row as MetadataRow : {};

  return {
    approvalStatus: parseApprovalStatus(value.approval_status),
    approvedAt: text(value.approved_at, 80) || null,
    approvedBy: text(value.approved_by, 120) || null,
    scheduledPublishAt: text(value.scheduled_publish_at, 80) || null
  };
}

async function requireSuperAdmin() {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can manage platform publishing workflow.");
  }

  return access;
}

function requireAdminClient() {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for platform publishing workflow.");
  }

  return admin;
}

async function readSnapshot(contentType: PlatformContentType, contentId: string) {
  const admin = requireAdminClient();
  const { data, error } = await admin
    .from(tables[contentType] as never)
    .select(selects[contentType])
    .eq("id" as never, contentId as never)
    .maybeSingle();

  if (error) {
    throw new Error(`Platform content snapshot could not be loaded: ${error.message}`);
  }

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Platform content was not found for revision.");
  }

  return safeJsonRecord(data);
}

async function nextRevisionNumber(contentType: PlatformContentType, contentId: string) {
  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("platform_content_revisions" as never)
    .select("revision_number")
    .eq("content_type" as never, contentType as never)
    .eq("content_id" as never, contentId as never)
    .order("revision_number" as never, { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(`Platform revision number could not be loaded: ${error.message}`);
  }

  const latestRow: Record<string, unknown> = Array.isArray(data) && isRecord(data[0]) ? data[0] : {};
  const latest = typeof latestRow.revision_number === "number"
    ? latestRow.revision_number
    : 0;

  return latest + 1;
}

export async function createRevision(
  contentType: PlatformContentType,
  contentId: string,
  snapshot?: unknown,
  note?: string | null
) {
  const access = await requireSuperAdmin();
  const type = parseContentType(contentType);
  const id = text(contentId, 120);

  if (!id) {
    throw new Error("Platform content id is required for revision.");
  }

  const revisionNumber = await nextRevisionNumber(type, id);
  const revisionSnapshot = snapshot === undefined ? await readSnapshot(type, id) : safeJsonRecord(snapshot);
  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("platform_content_revisions" as never)
    .insert({
      content_id: id,
      content_type: type,
      created_by: access.user.id,
      note: text(note, 500) || null,
      revision_number: revisionNumber,
      snapshot: revisionSnapshot
    } as never)
    .select("id, content_type, content_id, revision_number, snapshot, created_by, created_at, note")
    .single();

  if (error) {
    throw new Error(`Platform revision could not be created: ${error.message}`);
  }

  return parseRevision(data);
}

export async function listRevisions(contentType: PlatformContentType, contentId: string) {
  await requireSuperAdmin();
  const type = parseContentType(contentType);
  const id = text(contentId, 120);

  if (!id) return [];

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("platform_content_revisions" as never)
    .select("id, content_type, content_id, revision_number, snapshot, created_by, created_at, note")
    .eq("content_type" as never, type as never)
    .eq("content_id" as never, id as never)
    .order("revision_number" as never, { ascending: false })
    .limit(20);

  if (error) {
    throw new Error(`Platform revisions could not be loaded: ${error.message}`);
  }

  return (Array.isArray(data) ? data : [])
    .map((row) => parseRevision(row))
    .filter((revision): revision is PlatformContentRevisionRecord => Boolean(revision));
}

export async function listRecentRevisions(limit = 10) {
  await requireSuperAdmin();
  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("platform_content_revisions" as never)
    .select("id, content_type, content_id, revision_number, snapshot, created_by, created_at, note")
    .order("created_at" as never, { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Recent platform revisions could not be loaded: ${error.message}`);
  }

  return (Array.isArray(data) ? data : [])
    .map((row) => parseRevision(row))
    .filter((revision): revision is PlatformContentRevisionRecord => Boolean(revision));
}

export async function rollbackToRevision(revisionId: string) {
  await requireSuperAdmin();
  const id = text(revisionId, 120);

  if (!id) {
    throw new Error("Revision id is required for rollback.");
  }

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("platform_content_revisions" as never)
    .select("id, content_type, content_id, revision_number, snapshot, created_by, created_at, note")
    .eq("id" as never, id as never)
    .maybeSingle();

  if (error) {
    throw new Error(`Platform revision could not be loaded: ${error.message}`);
  }

  const revision = parseRevision(data);

  if (!revision) {
    throw new Error("Platform revision was not found.");
  }

  const snapshot = revision.snapshot;
  const update = Object.fromEntries(
    rollbackFields[revision.contentType]
      .filter((field) => field in snapshot)
      .map((field) => [field, snapshot[field]])
  );

  if (!Object.keys(update).length) {
    throw new Error("Revision does not contain restorable fields.");
  }

  const { error: updateError } = await admin
    .from(tables[revision.contentType] as never)
    .update(update as never)
    .eq("id" as never, revision.contentId as never);

  if (updateError) {
    throw new Error(`Platform content rollback failed: ${updateError.message}`);
  }

  const restoredSnapshot = await readSnapshot(revision.contentType, revision.contentId);
  const rollbackRevision = await createRevision(
    revision.contentType,
    revision.contentId,
    restoredSnapshot,
    `Rollback to revision ${revision.revisionNumber}`
  );

  return {
    restoredRevision: revision,
    rollbackRevision
  };
}

export async function getPublishingMetadata(contentType: "platform_blog_post" | "platform_page", contentId: string) {
  await requireSuperAdmin();
  const id = text(contentId, 120);

  if (!id) {
    return null;
  }

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from(tables[contentType] as never)
    .select("approval_status, approved_by, approved_at, scheduled_publish_at")
    .eq("id" as never, id as never)
    .maybeSingle();

  if (error) {
    throw new Error(`Platform publishing metadata could not be loaded: ${error.message}`);
  }

  return parseMetadata(data);
}

export async function updateApprovalStatus(
  contentType: "platform_blog_post" | "platform_page",
  contentId: string,
  approvalStatus: PlatformApprovalStatus
) {
  const access = await requireSuperAdmin();
  const id = text(contentId, 120);
  const status = parseApprovalStatus(approvalStatus);

  if (!id) {
    throw new Error("Platform content id is required.");
  }

  const update = {
    approval_status: status,
    approved_at: status === "approved" ? new Date().toISOString() : null,
    approved_by: status === "approved" ? access.user.id : null
  };
  const admin = requireAdminClient();
  const { error } = await admin
    .from(tables[contentType] as never)
    .update(update as never)
    .eq("id" as never, id as never);

  if (error) {
    throw new Error(`Platform approval status could not be updated: ${error.message}`);
  }

  return getPublishingMetadata(contentType, id);
}

export async function schedulePublish(
  contentType: "platform_blog_post" | "platform_page",
  contentId: string,
  scheduledPublishAt: string
) {
  await requireSuperAdmin();
  const id = text(contentId, 120);
  const date = new Date(scheduledPublishAt);

  if (!id) {
    throw new Error("Platform content id is required.");
  }

  if (!Number.isFinite(date.getTime())) {
    throw new Error("Scheduled publish date is invalid.");
  }

  const admin = requireAdminClient();
  const { error } = await admin
    .from(tables[contentType] as never)
    .update({ scheduled_publish_at: date.toISOString() } as never)
    .eq("id" as never, id as never);

  if (error) {
    throw new Error(`Platform scheduled publish date could not be saved: ${error.message}`);
  }

  return getPublishingMetadata(contentType, id);
}

export async function cancelScheduledPublish(contentType: "platform_blog_post" | "platform_page", contentId: string) {
  await requireSuperAdmin();
  const id = text(contentId, 120);

  if (!id) {
    throw new Error("Platform content id is required.");
  }

  const admin = requireAdminClient();
  const { error } = await admin
    .from(tables[contentType] as never)
    .update({ scheduled_publish_at: null } as never)
    .eq("id" as never, id as never);

  if (error) {
    throw new Error(`Platform scheduled publish date could not be cancelled: ${error.message}`);
  }

  return getPublishingMetadata(contentType, id);
}

function parseDashboardItem(row: unknown, contentType: "platform_blog_post" | "platform_page"): PlatformAdvancedPublishingItem | null {
  if (!isRecord(row)) return null;

  const value = row as MetadataRow;
  const id = text(value.id, 120);
  const label = text(value.title, 180);

  if (!id || !label) return null;

  return {
    ...parseMetadata(value),
    contentId: id,
    contentType,
    label,
    status: text(value.status, 40) || "draft",
    updatedAt: text(value.updated_at, 80) || null
  };
}

export async function getAdvancedPublishingDashboard(): Promise<PlatformAdvancedPublishingDashboard> {
  await requireSuperAdmin();
  const admin = requireAdminClient();
  const [pagesResult, postsResult, recentRevisions] = await Promise.all([
    admin
      .from("platform_pages" as never)
      .select("id, title, status, approval_status, approved_by, approved_at, scheduled_publish_at, updated_at")
      .in("approval_status" as never, ["pending_review", "rejected"] as never),
    admin
      .from("platform_blog_posts" as never)
      .select("id, title, status, approval_status, approved_by, approved_at, scheduled_publish_at, updated_at")
      .in("approval_status" as never, ["pending_review", "rejected"] as never),
    listRecentRevisions(10)
  ]);

  if (pagesResult.error) {
    throw new Error(`Platform page approval items could not be loaded: ${pagesResult.error.message}`);
  }

  if (postsResult.error) {
    throw new Error(`Platform blog approval items could not be loaded: ${postsResult.error.message}`);
  }

  const scheduledResults = await Promise.all([
    admin
      .from("platform_pages" as never)
      .select("id, title, status, approval_status, approved_by, approved_at, scheduled_publish_at, updated_at")
      .not("scheduled_publish_at" as never, "is", null),
    admin
      .from("platform_blog_posts" as never)
      .select("id, title, status, approval_status, approved_by, approved_at, scheduled_publish_at, updated_at")
      .not("scheduled_publish_at" as never, "is", null)
  ]);

  if (scheduledResults[0].error) {
    throw new Error(`Scheduled platform pages could not be loaded: ${scheduledResults[0].error.message}`);
  }

  if (scheduledResults[1].error) {
    throw new Error(`Scheduled platform blog posts could not be loaded: ${scheduledResults[1].error.message}`);
  }

  const items = [
    ...(Array.isArray(pagesResult.data) ? pagesResult.data : []).map((row) => parseDashboardItem(row, "platform_page")),
    ...(Array.isArray(postsResult.data) ? postsResult.data : []).map((row) => parseDashboardItem(row, "platform_blog_post"))
  ].filter((item): item is PlatformAdvancedPublishingItem => Boolean(item));
  const scheduledItems = [
    ...(Array.isArray(scheduledResults[0].data) ? scheduledResults[0].data : []).map((row) => parseDashboardItem(row, "platform_page")),
    ...(Array.isArray(scheduledResults[1].data) ? scheduledResults[1].data : []).map((row) => parseDashboardItem(row, "platform_blog_post"))
  ].filter((item): item is PlatformAdvancedPublishingItem => Boolean(item));

  return {
    pendingReviewItems: items.filter((item) => item.approvalStatus === "pending_review"),
    recentRevisions,
    rejectedItems: items.filter((item) => item.approvalStatus === "rejected"),
    scheduledItems
  };
}
