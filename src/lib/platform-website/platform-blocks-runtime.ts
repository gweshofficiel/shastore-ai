import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformLocale } from "@/src/lib/platform-website/platform-translations-runtime";

export type PlatformPageBlockType =
  | "cta"
  | "custom"
  | "faq"
  | "features"
  | "footer"
  | "hero"
  | "pricing"
  | "stats"
  | "testimonials";

export type PlatformPageBlockStatus = "draft" | "hidden" | "published";

export type PlatformPageBlockRecord = {
  blockType: PlatformPageBlockType;
  content: Record<string, unknown>;
  createdAt: string | null;
  id: string;
  pageId: string;
  settings: Record<string, unknown>;
  sortOrder: number;
  status: PlatformPageBlockStatus;
  subtitle: string | null;
  title: string | null;
  updatedAt: string | null;
};

export type PlatformPageBlockInput = {
  blockType?: PlatformPageBlockType;
  content?: unknown;
  pageId?: string;
  settings?: unknown;
  sortOrder?: number;
  status?: PlatformPageBlockStatus;
  subtitle?: string | null;
  title?: string | null;
};

export type PlatformPageBlockOrderInput = Array<{
  blockId: string;
  sortOrder: number;
}>;

type PlatformPageBlockRow = {
  block_type?: string | null;
  content?: unknown;
  created_at?: string | null;
  id?: string | null;
  page_id?: string | null;
  settings?: unknown;
  sort_order?: number | null;
  status?: string | null;
  subtitle?: string | null;
  title?: string | null;
  updated_at?: string | null;
};

const blockTypes: PlatformPageBlockType[] = [
  "hero",
  "features",
  "pricing",
  "cta",
  "faq",
  "testimonials",
  "stats",
  "footer",
  "custom"
];
const blockStatuses: PlatformPageBlockStatus[] = ["draft", "published", "hidden"];

function text(value: unknown, maxLength = 2000) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/\bjavascript:/gi, "")
    .trim()
    .slice(0, maxLength);
}

function nullableText(value: unknown, maxLength = 2000) {
  const cleaned = text(value, maxLength);

  return cleaned || null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function safeJson(value: unknown, depth = 0): unknown {
  if (depth > 8) {
    return null;
  }

  if (typeof value === "string") {
    return text(value, 5000);
  }

  if (typeof value === "number" || typeof value === "boolean" || value === null) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 100).map((item) => safeJson(item, depth + 1));
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 100)
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

function parseBlockType(value: unknown): PlatformPageBlockType {
  const cleaned = text(value, 40);

  if (!blockTypes.includes(cleaned as PlatformPageBlockType)) {
    throw new Error("Invalid platform page block type.");
  }

  return cleaned as PlatformPageBlockType;
}

function parseBlockStatus(value: unknown, fallback: PlatformPageBlockStatus): PlatformPageBlockStatus {
  const cleaned = text(value, 40) || fallback;

  if (!blockStatuses.includes(cleaned as PlatformPageBlockStatus)) {
    throw new Error("Invalid platform page block status.");
  }

  return cleaned as PlatformPageBlockStatus;
}

function parseBlockRow(row: unknown): PlatformPageBlockRecord | null {
  if (!isRecord(row)) {
    return null;
  }

  const value = row as PlatformPageBlockRow;
  const id = text(value.id, 120);
  const pageId = text(value.page_id, 120);

  if (!id || !pageId) {
    return null;
  }

  return {
    blockType: parseBlockType(value.block_type),
    content: safeJsonRecord(value.content),
    createdAt: text(value.created_at, 80) || null,
    id,
    pageId,
    settings: safeJsonRecord(value.settings),
    sortOrder: typeof value.sort_order === "number" ? value.sort_order : 0,
    status: parseBlockStatus(value.status, "draft"),
    subtitle: nullableText(value.subtitle, 500),
    title: nullableText(value.title, 180),
    updatedAt: text(value.updated_at, 80) || null
  };
}

async function requireSuperAdmin() {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can manage platform page blocks.");
  }
}

function requireAdminClient() {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for platform page blocks.");
  }

  return admin;
}

function blockSelect() {
  return "id, page_id, block_type, title, subtitle, content, settings, sort_order, status, created_at, updated_at";
}

function normalizeBlockInput(input: PlatformPageBlockInput, options: { requirePageId?: boolean; requireType?: boolean }) {
  const pageId = text(input.pageId, 120);
  const update: Record<string, unknown> = {};

  if (options.requirePageId && !pageId) {
    throw new Error("Platform page id is required for block creation.");
  }

  if (options.requireType || input.blockType !== undefined) {
    update.block_type = parseBlockType(input.blockType);
  }

  if (input.title !== undefined) update.title = nullableText(input.title, 180);
  if (input.subtitle !== undefined) update.subtitle = nullableText(input.subtitle, 500);
  if (input.content !== undefined) update.content = safeJsonRecord(input.content);
  if (input.settings !== undefined) update.settings = safeJsonRecord(input.settings);
  if (input.sortOrder !== undefined) update.sort_order = Number.isFinite(input.sortOrder) ? Math.trunc(input.sortOrder) : 0;
  if (input.status !== undefined) update.status = parseBlockStatus(input.status, "draft");

  return {
    pageId,
    update
  };
}

export async function listPageBlocks(pageId: string) {
  await requireSuperAdmin();
  const cleanedPageId = text(pageId, 120);

  if (!cleanedPageId) {
    return [];
  }

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("platform_page_blocks" as never)
    .select(blockSelect())
    .eq("page_id" as never, cleanedPageId as never)
    .order("sort_order" as never, { ascending: true })
    .order("created_at" as never, { ascending: true });

  if (error) {
    throw new Error(`Platform page blocks could not be loaded: ${error.message}`);
  }

  return (Array.isArray(data) ? data : [])
    .map((row) => parseBlockRow(row))
    .filter((block): block is PlatformPageBlockRecord => Boolean(block));
}

export async function getPublishedPageBlocks(pageId: string) {
  const cleanedPageId = text(pageId, 120);

  if (!cleanedPageId) {
    return [];
  }

  const admin = createAdminClient();

  if (!admin) {
    return [];
  }

  const { data, error } = await admin
    .from("platform_page_blocks" as never)
    .select(blockSelect())
    .eq("page_id" as never, cleanedPageId as never)
    .eq("status" as never, "published" as never)
    .order("sort_order" as never, { ascending: true })
    .order("created_at" as never, { ascending: true });

  if (error) {
    throw new Error(`Published platform page blocks could not be loaded: ${error.message}`);
  }

  return (Array.isArray(data) ? data : [])
    .map((row) => parseBlockRow(row))
    .filter((block): block is PlatformPageBlockRecord => Boolean(block));
}

export async function createPageBlock(input: PlatformPageBlockInput) {
  await requireSuperAdmin();
  const { pageId, update } = normalizeBlockInput(input, { requirePageId: true, requireType: true });
  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("platform_page_blocks" as never)
    .insert({
      ...update,
      page_id: pageId,
      status: update.status ?? "draft"
    } as never)
    .select(blockSelect())
    .single();

  if (error) {
    throw new Error(`Platform page block could not be created: ${error.message}`);
  }

  return parseBlockRow(data);
}

export async function updatePageBlock(blockId: string, input: PlatformPageBlockInput) {
  await requireSuperAdmin();
  const cleanedBlockId = text(blockId, 120);

  if (!cleanedBlockId) {
    throw new Error("Platform page block id is required.");
  }

  const { update } = normalizeBlockInput(input, {});

  if (!Object.keys(update).length) {
    throw new Error("No platform page block fields were provided.");
  }

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("platform_page_blocks" as never)
    .update(update as never)
    .eq("id" as never, cleanedBlockId as never)
    .select(blockSelect())
    .single();

  if (error) {
    throw new Error(`Platform page block could not be updated: ${error.message}`);
  }

  return parseBlockRow(data);
}

export async function reorderPageBlocks(pageId: string, order: PlatformPageBlockOrderInput) {
  await requireSuperAdmin();
  const cleanedPageId = text(pageId, 120);

  if (!cleanedPageId) {
    throw new Error("Platform page id is required for block reordering.");
  }

  const admin = requireAdminClient();

  for (const item of order) {
    const blockId = text(item.blockId, 120);

    if (!blockId) {
      continue;
    }

    const { error } = await admin
      .from("platform_page_blocks" as never)
      .update({ sort_order: Number.isFinite(item.sortOrder) ? Math.trunc(item.sortOrder) : 0 } as never)
      .eq("id" as never, blockId as never)
      .eq("page_id" as never, cleanedPageId as never);

    if (error) {
      throw new Error(`Platform page blocks could not be reordered: ${error.message}`);
    }
  }

  return listPageBlocks(cleanedPageId);
}

export async function hidePageBlock(blockId: string) {
  return updatePageBlock(blockId, { status: "hidden" });
}

export async function publishPageBlock(blockId: string) {
  return updatePageBlock(blockId, { status: "published" });
}

export function translatePlatformPageBlock(block: PlatformPageBlockRecord, locale?: string): PlatformPageBlockRecord {
  if (!locale || !isPlatformLocale(locale)) {
    return block;
  }

  const translations = safeJsonRecord(block.content.translations);
  const translated = safeJsonRecord(translations[locale]);

  if (!Object.keys(translated).length) {
    return block;
  }

  return {
    ...block,
    content: isRecord(translated.content) ? safeJsonRecord(translated.content) : block.content,
    settings: isRecord(translated.settings) ? safeJsonRecord(translated.settings) : block.settings,
    subtitle: nullableText(translated.subtitle, 500) ?? block.subtitle,
    title: nullableText(translated.title, 180) ?? block.title
  };
}
