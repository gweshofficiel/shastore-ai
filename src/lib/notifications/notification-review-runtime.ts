import "server-only";

import type { NotificationAuditRecord } from "@/src/lib/notifications/notification-audit-runtime";
import type { NotificationFailureRecord } from "@/src/lib/notifications/notification-failure-runtime";
import { sanitizeNotificationFailureReason } from "@/src/lib/notifications/notification-failure-runtime";
import { sanitizeNotificationMonitoringMetadata } from "@/src/lib/notifications/notification-monitoring-runtime";
import {
  maskNotificationSecurityIdentifierSafe,
  sanitizeNotificationAdminDisplayTextSafe
} from "@/src/lib/notifications/notification-security-runtime";

export type NotificationReviewStatus =
  | "ignored"
  | "resolved"
  | "reviewed"
  | "under_review"
  | "unreviewed";

export type NotificationReviewRecord = {
  createdAt: string | null;
  failureReference: string;
  notificationReference: string;
  reviewId: string;
  reviewNote: string;
  reviewStatus: NotificationReviewStatus;
  reviewStatusLabel: string;
  reviewed: boolean;
  reviewedAt: string | null;
  reviewerReference: string;
  safeSummary: string;
  updatedAt: string | null;
};

export type NotificationReviewRuntimeStats = {
  ignoredReviews: number;
  resolvedReviews: number;
  reviewedReviews: number;
  totalReviews: number;
  underReviewItems: number;
  unreviewedReviews: number;
  unknownReviews: number;
};

export const NOTIFICATION_REVIEW_FALLBACK_ID = "unknown_notification_review" as const;

export const NOTIFICATION_REVIEW_STATUSES: readonly NotificationReviewStatus[] = [
  "unreviewed",
  "under_review",
  "reviewed",
  "ignored",
  "resolved"
] as const;

const reviewStatusLabels: Record<NotificationReviewStatus, string> = {
  ignored: "Ignored",
  resolved: "Resolved",
  reviewed: "Reviewed",
  under_review: "Under review",
  unreviewed: "Unreviewed"
};

function text(value: unknown, maxLength = 500) {
  if (typeof value !== "string") return "";

  return value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/\bjavascript:/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function dateValue(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function getNotificationReviewStatusLabel(status: NotificationReviewStatus) {
  return reviewStatusLabels[status];
}

export function resolveNotificationReviewStatusSafe(
  failure: NotificationFailureRecord
): NotificationReviewStatus {
  if (failure.reviewed) {
    if (failure.failureStatus === "retry_exhausted") {
      return "resolved";
    }

    return "reviewed";
  }

  if (failure.failureStatus === "retry_pending") {
    return "under_review";
  }

  if (failure.failureStatus === "template_error") {
    return "ignored";
  }

  return "unreviewed";
}

export function sanitizeNotificationReviewNoteSafe(value: unknown, maxLength = 240) {
  const cleaned = sanitizeNotificationFailureReason(value) || sanitizeNotificationAdminDisplayTextSafe(value, maxLength);
  if (!cleaned) {
    return "No safe review note recorded.";
  }

  return cleaned;
}

function findMarkReviewedAudit(params: {
  auditItems: NotificationAuditRecord[];
  notificationReference: string;
}) {
  return params.auditItems.find(
    (auditItem) =>
      auditItem.action === "admin_notification_mark_reviewed" &&
      auditItem.notificationId === params.notificationReference
  );
}

function buildReviewSafeSummary(params: {
  failureReference: string;
  notificationReference: string;
  reviewStatus: NotificationReviewStatus;
  reviewerReference: string;
}) {
  return sanitizeNotificationAdminDisplayTextSafe(
    [
      `${getNotificationReviewStatusLabel(params.reviewStatus)} review state for notification ${params.notificationReference}.`,
      `Failure reference ${params.failureReference}.`,
      `Reviewer reference ${params.reviewerReference}.`,
      "Read-only notification review foundation only. No automatic review, resolve, or retry connected."
    ].join(" "),
    240
  );
}

function buildReviewRecordFromFailure(params: {
  auditItems: NotificationAuditRecord[];
  failure: NotificationFailureRecord;
}): NotificationReviewRecord {
  const notificationReference =
    maskNotificationSecurityIdentifierSafe(params.failure.notificationId, "notification") ||
    NOTIFICATION_REVIEW_FALLBACK_ID;
  const failureReference =
    maskNotificationSecurityIdentifierSafe(params.failure.failureId, "failure") ||
    NOTIFICATION_REVIEW_FALLBACK_ID;
  const reviewStatus = resolveNotificationReviewStatusSafe(params.failure);
  const markReviewedAudit = findMarkReviewedAudit({
    auditItems: params.auditItems,
    notificationReference: params.failure.notificationId
  });
  const reviewerReference =
    sanitizeNotificationAdminDisplayTextSafe(markReviewedAudit?.actorIdReference, 120) || "Not assigned";
  const reviewNote = markReviewedAudit
    ? sanitizeNotificationReviewNoteSafe(markReviewedAudit.safeSummary || markReviewedAudit.metadataSummary)
    : sanitizeNotificationReviewNoteSafe(params.failure.failureReason);
  const reviewId =
    maskNotificationSecurityIdentifierSafe(`${params.failure.failureId}:review`, "review") ||
    NOTIFICATION_REVIEW_FALLBACK_ID;
  const reviewedAt = text(params.failure.reviewedAt, 80) || text(markReviewedAudit?.createdAt, 80) || null;
  const createdAt = text(params.failure.createdAt, 80) || reviewedAt;
  const updatedAt = text(params.failure.updatedAt, 80) || reviewedAt || createdAt;

  return {
    createdAt,
    failureReference,
    notificationReference,
    reviewId,
    reviewNote,
    reviewStatus,
    reviewStatusLabel: getNotificationReviewStatusLabel(reviewStatus),
    reviewed: params.failure.reviewed,
    reviewedAt,
    reviewerReference,
    safeSummary: buildReviewSafeSummary({
      failureReference,
      notificationReference,
      reviewStatus,
      reviewerReference
    }),
    updatedAt
  };
}

export function buildNotificationReviewFallbackRecordSafe(): NotificationReviewRecord {
  return {
    createdAt: null,
    failureReference: NOTIFICATION_REVIEW_FALLBACK_ID,
    notificationReference: NOTIFICATION_REVIEW_FALLBACK_ID,
    reviewId: NOTIFICATION_REVIEW_FALLBACK_ID,
    reviewNote: "No safe review note recorded.",
    reviewStatus: "unreviewed",
    reviewStatusLabel: getNotificationReviewStatusLabel("unreviewed"),
    reviewed: false,
    reviewedAt: null,
    reviewerReference: "Not assigned",
    safeSummary:
      "Notification review foundation placeholder only. No review assignment, resolution, or retry connected.",
    updatedAt: null
  };
}

export function buildNotificationReviewRecordsSafe(params: {
  auditItems?: NotificationAuditRecord[] | null;
  failureItems?: NotificationFailureRecord[] | null;
}): { reviewItems: NotificationReviewRecord[]; warning: string | null } {
  try {
    const auditItems = Array.isArray(params.auditItems) ? params.auditItems : [];
    const failureItems = Array.isArray(params.failureItems) ? params.failureItems : [];

    if (!failureItems.length) {
      return {
        reviewItems: [buildNotificationReviewFallbackRecordSafe()],
        warning: null
      };
    }

    const reviewItems = failureItems
      .map((failure) =>
        buildReviewRecordFromFailure({
          auditItems,
          failure
        })
      )
      .sort((left, right) => dateValue(right.updatedAt ?? "") - dateValue(left.updatedAt ?? ""));

    return {
      reviewItems,
      warning: null
    };
  } catch (error) {
    console.error("[notification-review-runtime] review records build failed", error);

    return {
      reviewItems: [buildNotificationReviewFallbackRecordSafe()],
      warning: "Notification review runtime fallback applied."
    };
  }
}

export function buildNotificationReviewRuntimeStatsSafe(
  reviewItems: NotificationReviewRecord[] | null | undefined
): NotificationReviewRuntimeStats {
  try {
    const items = Array.isArray(reviewItems) ? reviewItems : [];

    return {
      ignoredReviews: items.filter((item) => item.reviewStatus === "ignored").length,
      resolvedReviews: items.filter((item) => item.reviewStatus === "resolved").length,
      reviewedReviews: items.filter((item) => item.reviewStatus === "reviewed").length,
      totalReviews: items.length,
      underReviewItems: items.filter((item) => item.reviewStatus === "under_review").length,
      unreviewedReviews: items.filter((item) => item.reviewStatus === "unreviewed").length,
      unknownReviews: items.filter((item) => item.reviewId === NOTIFICATION_REVIEW_FALLBACK_ID).length
    };
  } catch (error) {
    console.error("[notification-review-runtime] review runtime stats build failed", error);

    return {
      ignoredReviews: 0,
      resolvedReviews: 0,
      reviewedReviews: 0,
      totalReviews: 0,
      underReviewItems: 0,
      unreviewedReviews: 0,
      unknownReviews: 0
    };
  }
}

export function listNotificationReviewStatusCatalog() {
  return NOTIFICATION_REVIEW_STATUSES.map((status) => ({
    description: `Read-only ${reviewStatusLabels[status].toLowerCase()} review visibility for Super Admin.`,
    label: reviewStatusLabels[status],
    status
  }));
}

export function sanitizeNotificationReviewMetadataSafe(params: {
  failureReference: string;
  notificationReference: string;
  reviewNote?: unknown;
  reviewStatus: NotificationReviewStatus;
  reviewerReference?: unknown;
}) {
  return sanitizeNotificationMonitoringMetadata({
    failure_ref: params.failureReference,
    notification_ref: params.notificationReference,
    note: sanitizeNotificationReviewNoteSafe(params.reviewNote, 120),
    review_status: params.reviewStatus,
    reviewer_ref: sanitizeNotificationAdminDisplayTextSafe(params.reviewerReference, 80) || undefined,
    source: "notification_review_runtime"
  });
}

// NT-22+ placeholders: review assignment, escalation, and automation stay disconnected.
export const NOTIFICATION_REVIEW_FUTURE_HOOKS = [
  "notification_review_assignment",
  "notification_review_escalation",
  "notification_review_automation"
] as const;
