import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { maskSensitiveText } from "@/lib/integrations/safe-diagnostics";
import type { Database } from "@/types/database";
import {
  SUPPORT_REGISTRY_SOURCE
} from "@/src/lib/support/support-registry-runtime";

export type SupportTicketConversationRuntimeSource = "support_ticket_conversation_runtime";

export type SupportTicketConversationLoadingState = "error" | "loaded" | "unselected";

export type SupportTicketConversationAuthorRole = "customer" | "super_admin" | "support_agent" | "system";

export type SupportTicketConversationVisibility = "customer" | "internal" | "super_admin";

export type SupportTicketConversationMessageSource = "opening_message" | "support_ticket_messages";

export type SupportTicketConversationResultCode =
  | "error"
  | "invalid"
  | "not_found"
  | "success"
  | "unauthorized";

export type SupportTicketConversationMessage = {
  attachmentsIndicator: "available" | "none";
  author: string;
  authorRole: SupportTicketConversationAuthorRole | "unknown";
  createdAt: string;
  messageBody: string;
  messageId: string;
  messageKey: string;
  messageSource: SupportTicketConversationMessageSource;
  registryKey: "sp-ticket-conversation";
  safeSummary: string;
  visibility: SupportTicketConversationVisibility | "unknown";
};

export type SupportTicketConversationRuntimeSummary = {
  canCreateMessage: boolean;
  creationFoundation: "available" | "read_only";
  emptyMessage: string | null;
  loadError: string | null;
  loadingState: SupportTicketConversationLoadingState;
  messageCount: number;
  messagesTableDetected: boolean;
  readOnly: true;
  registrySource: typeof SUPPORT_REGISTRY_SOURCE;
  selectedTicketId: string | null;
  source: SupportTicketConversationRuntimeSource;
  status: "conversation_runtime_ready" | "load_error" | "needs_attention" | "unselected";
  summary: string;
};

export type SupportTicketConversationAuthorization = {
  canCreateMessage: boolean;
  reason: string;
  roleLabel: string;
};

type AnyRecord = Record<string, unknown>;

export const SUPPORT_TICKET_CONVERSATION_RUNTIME_SOURCE = "support_ticket_conversation_runtime" as const;

const MESSAGE_COLUMNS =
  "id, ticket_id, workspace_id, store_id, author_user_id, author_role, author_label, message_body, visibility, has_attachments, created_at";

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalizeAuthorRole(value: string): SupportTicketConversationAuthorRole | "unknown" {
  switch (value.toLowerCase()) {
    case "customer":
      return "customer";
    case "support_agent":
      return "support_agent";
    case "super_admin":
      return "super_admin";
    case "system":
      return "system";
    default:
      return "unknown";
  }
}

function normalizeVisibility(value: string): SupportTicketConversationVisibility | "unknown" {
  switch (value.toLowerCase()) {
    case "customer":
      return "customer";
    case "internal":
      return "internal";
    case "super_admin":
      return "super_admin";
    default:
      return "unknown";
  }
}

function buildSafeMessageBody(value: string) {
  return maskSensitiveText(value).slice(0, 4000);
}

export function resolveSupportTicketConversationAuthorization(input: {
  role: "internal_team" | "super_admin";
}): SupportTicketConversationAuthorization {
  if (input.role === "super_admin") {
    return {
      canCreateMessage: true,
      reason: "Super Admin may create support ticket conversation messages through explicit form submission.",
      roleLabel: "super_admin"
    };
  }

  return {
    canCreateMessage: false,
    reason: "Ticket conversation message creation is restricted to Super Admin in SP-7.",
    roleLabel: input.role
  };
}

function buildOpeningMessage(input: {
  createdAt: string;
  message: string;
  ticketId: string;
  userId: string | null;
}): SupportTicketConversationMessage | null {
  const trimmed = input.message.trim();

  if (!trimmed) {
    return null;
  }

  const messageBody = buildSafeMessageBody(trimmed);

  return {
    attachmentsIndicator: "none",
    author: input.userId ? `Reporter ${input.userId}` : "Ticket reporter",
    authorRole: "customer",
    createdAt: input.createdAt,
    messageBody,
    messageId: `opening-${input.ticketId}`,
    messageKey: `opening-message-${input.ticketId}`,
    messageSource: "opening_message",
    registryKey: "sp-ticket-conversation",
    safeSummary: [
      "source opening_message",
      "author customer",
      "visibility customer",
      messageBody ? "body available" : "body empty"
    ].join("; "),
    visibility: "customer"
  };
}

function buildConversationMessage(row: AnyRecord): SupportTicketConversationMessage {
  const messageId = text(row.id);
  const authorRole = normalizeAuthorRole(text(row.author_role));
  const visibility = normalizeVisibility(text(row.visibility));
  const messageBody = buildSafeMessageBody(text(row.message_body));
  const hasAttachments = row.has_attachments === true;

  return {
    attachmentsIndicator: hasAttachments ? "available" : "none",
    author: text(row.author_label) || "Support participant",
    authorRole,
    createdAt: text(row.created_at),
    messageBody,
    messageId,
    messageKey: `conversation-message-${messageId}`,
    messageSource: "support_ticket_messages",
    registryKey: "sp-ticket-conversation",
    safeSummary: [
      `message ${messageId}`,
      `author ${text(row.author_label) || "unknown"}`,
      `role ${authorRole}`,
      `visibility ${visibility}`,
      hasAttachments ? "attachments available" : "attachments none"
    ].join("; "),
    visibility
  };
}

function buildUnselectedSummary(
  authorization: SupportTicketConversationAuthorization
): SupportTicketConversationRuntimeSummary {
  return {
    canCreateMessage: false,
    creationFoundation: "read_only",
    emptyMessage: "Select a ticket to load its conversation thread.",
    loadError: null,
    loadingState: "unselected",
    messageCount: 0,
    messagesTableDetected: false,
    readOnly: true,
    registrySource: SUPPORT_REGISTRY_SOURCE,
    selectedTicketId: null,
    source: SUPPORT_TICKET_CONVERSATION_RUNTIME_SOURCE,
    status: "unselected",
    summary: "status unselected; select a ticket to view conversation messages"
  };
}

function buildConversationSummary(input: {
  authorization: SupportTicketConversationAuthorization;
  loadError: string | null;
  loadingState: SupportTicketConversationLoadingState;
  messageCount: number;
  messagesTableDetected: boolean;
  selectedTicketId: string | null;
}): SupportTicketConversationRuntimeSummary {
  const creationFoundation = input.authorization.canCreateMessage ? "available" : "read_only";
  const status = input.loadError
    ? ("load_error" as const)
    : input.loadingState === "unselected"
      ? ("unselected" as const)
      : !input.messagesTableDetected
        ? ("needs_attention" as const)
        : ("conversation_runtime_ready" as const);

  return {
    canCreateMessage: input.authorization.canCreateMessage && creationFoundation === "available",
    creationFoundation,
    emptyMessage:
      input.messageCount === 0 && input.loadingState === "loaded"
        ? "No conversation messages yet for this ticket."
        : null,
    loadError: input.loadError,
    loadingState: input.loadingState,
    messageCount: input.messageCount,
    messagesTableDetected: input.messagesTableDetected,
    readOnly: true,
    registrySource: SUPPORT_REGISTRY_SOURCE,
    selectedTicketId: input.selectedTicketId,
    source: SUPPORT_TICKET_CONVERSATION_RUNTIME_SOURCE,
    status,
    summary: input.loadError
      ? `status load_error; ${input.loadError}`
      : input.loadingState === "unselected"
        ? "status unselected; no ticket selected"
        : [
            `status ${status}`,
            `${input.messageCount} messages`,
            input.messagesTableDetected
              ? "support_ticket_messages table detected"
              : "support_ticket_messages table not detected",
            `creation foundation ${creationFoundation}`,
            input.authorization.canCreateMessage ? "message creation authorized" : "message creation read-only"
          ].join("; ")
  };
}

export async function loadSupportTicketConversationRuntimeReadOnlySafe(params: {
  authorization: SupportTicketConversationAuthorization;
  loadError?: string | null;
  selectedTicketId?: string | null;
  supabase: SupabaseClient<Database> | null;
}) {
  if (!params.supabase || params.loadError) {
    return {
      messages: [] as SupportTicketConversationMessage[],
      ticketConversationRuntime: buildConversationSummary({
        authorization: params.authorization,
        loadError: params.loadError ?? "Admin client unavailable",
        loadingState: "error",
        messageCount: 0,
        messagesTableDetected: false,
        selectedTicketId: params.selectedTicketId?.trim() || null
      })
    };
  }

  const selectedTicketId = params.selectedTicketId?.trim() || null;

  if (!selectedTicketId) {
    return {
      messages: [],
      ticketConversationRuntime: buildUnselectedSummary(params.authorization)
    };
  }

  if (!isUuid(selectedTicketId)) {
    return {
      messages: [],
      ticketConversationRuntime: buildConversationSummary({
        authorization: params.authorization,
        loadError: null,
        loadingState: "loaded",
        messageCount: 0,
        messagesTableDetected: false,
        selectedTicketId
      })
    };
  }

  const ticketLoad = await params.supabase
    .from("support_tickets" as never)
    .select("id, message, user_id, created_at")
    .eq("id", selectedTicketId)
    .maybeSingle();

  if (ticketLoad.error) {
    return {
      messages: [],
      ticketConversationRuntime: buildConversationSummary({
        authorization: params.authorization,
        loadError: ticketLoad.error.message,
        loadingState: "error",
        messageCount: 0,
        messagesTableDetected: false,
        selectedTicketId
      })
    };
  }

  if (!ticketLoad.data) {
    return {
      messages: [],
      ticketConversationRuntime: buildConversationSummary({
        authorization: params.authorization,
        loadError: "Ticket not found",
        loadingState: "error",
        messageCount: 0,
        messagesTableDetected: false,
        selectedTicketId
      })
    };
  }

  const ticketRow = ticketLoad.data as AnyRecord;
  const openingMessage = buildOpeningMessage({
    createdAt: text(ticketRow.created_at),
    message: text(ticketRow.message),
    ticketId: text(ticketRow.id),
    userId: ticketRow.user_id ? text(ticketRow.user_id) : null
  });

  const messagesLoad = await params.supabase
    .from("support_ticket_messages" as never)
    .select(MESSAGE_COLUMNS)
    .eq("ticket_id", selectedTicketId)
    .order("created_at", { ascending: true })
    .limit(200);

  const messagesTableDetected = !messagesLoad.error?.message?.includes("support_ticket_messages");

  if (messagesLoad.error) {
    return {
      messages: openingMessage ? [openingMessage] : [],
      ticketConversationRuntime: buildConversationSummary({
        authorization: params.authorization,
        loadError: messagesLoad.error.message,
        loadingState: "error",
        messageCount: openingMessage ? 1 : 0,
        messagesTableDetected,
        selectedTicketId
      })
    };
  }

  const threadMessages = (Array.isArray(messagesLoad.data) ? messagesLoad.data : []).map((row) =>
    buildConversationMessage(row as AnyRecord)
  );
  const messages = [...(openingMessage ? [openingMessage] : []), ...threadMessages].sort(
    (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
  );

  return {
    messages,
    ticketConversationRuntime: buildConversationSummary({
      authorization: params.authorization,
      loadError: null,
      loadingState: "loaded",
      messageCount: messages.length,
      messagesTableDetected,
      selectedTicketId
    })
  };
}

export function mapSupportTicketConversationRuntimeToAdminFields(
  input: Awaited<ReturnType<typeof loadSupportTicketConversationRuntimeReadOnlySafe>>
) {
  return {
    ticketConversationMessages: input.messages,
    ticketConversationRuntime: input.ticketConversationRuntime
  };
}

export function supportTicketConversationResultMessage(code: SupportTicketConversationResultCode) {
  switch (code) {
    case "success":
      return "Conversation message created successfully.";
    case "invalid":
      return "The conversation message could not be validated.";
    case "not_found":
      return "The requested support ticket was not found.";
    case "unauthorized":
      return "Only Super Admin accounts may create support ticket conversation messages in SP-7.";
    case "error":
      return "The conversation message could not be created safely.";
  }
}

export function supportTicketConversationAuthorRoleLabel(role: string) {
  switch (role) {
    case "customer":
      return "Customer";
    case "support_agent":
      return "Support Agent";
    case "super_admin":
      return "Super Admin";
    case "system":
      return "System";
    default:
      return "Unknown";
  }
}

export function supportTicketConversationVisibilityLabel(visibility: string) {
  switch (visibility) {
    case "customer":
      return "Customer visible";
    case "internal":
      return "Internal";
    case "super_admin":
      return "Super Admin";
    default:
      return "Unknown";
  }
}
