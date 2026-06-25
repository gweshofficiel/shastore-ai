import { createClient as createServiceClient, type SupabaseClient } from "@supabase/supabase-js";
import { planLimitsConfig } from "@/lib/billing/plan-limits";
import { getBillingPlan } from "@/lib/billing/plans";
import { getAdminAccess } from "@/lib/admin-access";
import {
  MARKETING_AFFILIATE_TRACKING_FALLBACK_SUMMARIES,
  MARKETING_CAMPAIGN_EMAIL_FALLBACK_SUMMARIES,
  MARKETING_CAMPAIGN_NOTIFICATION_FALLBACK_SUMMARIES,
  MARKETING_COMMISSION_FALLBACK_SUMMARIES,
  MARKETING_COUPON_USAGE_FALLBACK_SUMMARIES,
  MARKETING_REFERRAL_TRACKING_FALLBACK_SUMMARIES,
  MARKETING_REGISTRY_FALLBACK_ITEMS,
  indexMarketingAffiliateTrackingSummariesByRegistryKey,
  indexMarketingCampaignEmailSummariesByRegistryKey,
  indexMarketingCampaignNotificationSummariesByRegistryKey,
  indexMarketingCommissionSummariesByRegistryKey,
  indexMarketingCouponUsageSummariesByRegistryKey,
  indexMarketingReferralTrackingSummariesByRegistryKey,
  toMarketingRegistryCampaignView
} from "@/src/lib/marketing/marketing-registry-runtime";
import {
  countMarketingStatusOverview,
  indexLatestMarketingPlatformActions,
  resolveMarketingRegistryStatus
} from "@/src/lib/marketing/marketing-status-runtime";
import { buildMarketingCouponViewsSafe } from "@/src/lib/marketing/marketing-coupon-runtime";
import { buildMarketingAuditSummarySafe } from "@/src/lib/marketing/marketing-audit-runtime";
import { buildMarketingCampaignAnalyticsSummarySafe } from "@/src/lib/marketing/marketing-campaign-analytics-runtime";
import {
  buildMarketingSecurityCertificationSafe,
  collectMarketingMetadataSummariesForCertification
} from "@/src/lib/marketing/marketing-security-certification";
import { buildMarketingProductionCertificationSafe } from "@/src/lib/marketing/marketing-production-certification";
import { buildEmailProviderStatsSafe } from "@/src/lib/email/email-provider-runtime";
import {
  buildEmailProviderHealthRecordsSafe,
  buildEmailProviderHealthStatsSafe
} from "@/src/lib/email/email-provider-health-runtime";
import {
  buildEmailBillingEmailRecordsSafe,
  buildEmailBillingEmailStatsSafe
} from "@/src/lib/email/email-billing-runtime";
import {
  buildEmailDomainEmailSetupEmailRecordsSafe,
  buildEmailDomainEmailSetupEmailStatsSafe
} from "@/src/lib/email/email-domain-email-setup-runtime";
import {
  buildEmailOrderEmailRecordsSafe,
  buildEmailOrderEmailStatsSafe
} from "@/src/lib/email/email-order-runtime";
import {
  buildEmailQueueRuntimeStatsSafe,
  buildEmailQueueRuntimeSummarySafe
} from "@/src/lib/email/email-queue-runtime";
import {
  buildEmailCampaignEmailRecordsSafe,
  buildEmailCampaignEmailStatsSafe
} from "@/src/lib/email/email-campaign-runtime";
import {
  buildEmailAuditRuntimeStatsSafe,
  buildEmailAuditRuntimeSummarySafe
} from "@/src/lib/email/email-audit-runtime";
import {
  buildEmailSecurityCertificationSafe,
  collectEmailMetadataSummariesForCertification,
  verifyEmailRuntimeFoundationsPresent
} from "@/src/lib/email/email-security-certification";
import {
  buildEmailProductionHardeningSafe,
  verifyEmailProductionFoundationsPresent
} from "@/src/lib/email/email-production-hardening";
import { buildEmailProductionCertificationSafe } from "@/src/lib/email/email-production-certification";
import {
  buildNotificationRegistryViewsSafe,
  buildNotificationTypeStatsSafe,
  listNotificationRegistryItemsReadOnlySafe,
  NOTIFICATION_REGISTRY_FALLBACK_ITEMS,
  resolveNotificationTypeFromSourceSafe,
  type NotificationType
} from "@/src/lib/notifications/notification-registry-runtime";
import {
  buildNotificationDeliveryStatusSummaryFromLogsSafe,
  buildNotificationRegistryStatusStatsSafe,
  getNotificationStatusLabel,
  parseNotificationDeliveryStatusSafe,
  type NotificationDeliveryStatus
} from "@/src/lib/notifications/notification-status-runtime";
import {
  buildNotificationChannelStatsSafe,
  buildNotificationChannelViewsSafe,
  getNotificationChannelLabel,
  parseNotificationChannelSafe,
  type NotificationChannel
} from "@/src/lib/notifications/notification-channel-runtime";
import {
  buildNotificationCategoryStatsSafe,
  buildNotificationRegistryCategoryStatsSafe,
  classifyNotificationCategoryFromSource,
  getNotificationCategoryLabel,
  type NotificationCategory
} from "@/src/lib/notifications/notification-category-runtime";
import {
  buildNotificationProviderStatsSafe,
  buildNotificationProviderViewsSafe,
  buildNotificationRegistryProviderStatsSafe,
  getNotificationProviderLabel,
  mapNotificationChannelToProvider,
  type NotificationProviderKey
} from "@/src/lib/notifications/notification-provider-runtime";
import {
  buildNotificationProviderAbstractionRecordsSafe,
  buildNotificationProviderAbstractionRuntimeStatsSafe,
  buildNotificationProviderAbstractionSummarySafe,
  type NotificationProviderAbstractionRecord,
  type NotificationProviderAbstractionRuntimeStats,
  type NotificationProviderAbstractionSummary
} from "@/src/lib/notifications/notification-provider-abstraction-runtime";
import {
  buildNotificationReadOnlyProtectionRecordsSafe,
  buildNotificationReadOnlyProtectionRuntimeStatsSafe,
  buildNotificationReadOnlyProtectionSummarySafe,
  verifyNotificationReadOnlyProtectionPresent,
  type NotificationReadOnlyProtectionRecord,
  type NotificationReadOnlyProtectionRuntimeStats,
  type NotificationReadOnlyProtectionSummary
} from "@/src/lib/notifications/notification-read-only-protection-runtime";
import {
  buildNotificationDataCertificationRecordsSafe,
  buildNotificationDataCertificationRuntimeStatsSafe,
  buildNotificationDataCertificationSummarySafe,
  collectNotificationDataCertificationInput,
  type NotificationDataCertificationRecord,
  type NotificationDataCertificationRuntimeStats,
  type NotificationDataCertificationSummary
} from "@/src/lib/notifications/notification-data-certification-runtime";
import {
  buildNotificationSecurityCertificationDomainRecordsSafe,
  buildNotificationSecurityCertificationDomainRuntimeStatsSafe,
  buildNotificationSecurityCertificationDomainSummarySafe,
  collectNotificationSecurityCertificationDomainInput,
  type NotificationSecurityCertificationDomainRecord,
  type NotificationSecurityCertificationDomainRuntimeStats,
  type NotificationSecurityCertificationDomainSummary
} from "@/src/lib/notifications/notification-security-certification-runtime";
import {
  buildNotificationRuntimeCertificationRecordsSafe,
  buildNotificationRuntimeCertificationRuntimeStatsSafe,
  buildNotificationRuntimeCertificationSummarySafe,
  collectNotificationRuntimeCertificationInput,
  verifyNotificationRuntimeCertificationPresent,
  type NotificationRuntimeCertificationRecord,
  type NotificationRuntimeCertificationRuntimeStats,
  type NotificationRuntimeCertificationSummary
} from "@/src/lib/notifications/notification-runtime-certification-runtime";
import {
  buildNotificationProductionCertificationRecordsSafe,
  buildNotificationProductionCertificationRuntimeStatsSafe,
  buildNotificationProductionCertificationSummarySafe,
  collectNotificationProductionCertificationInput,
  verifyNotificationProductionCertificationPresent,
  type NotificationProductionCertificationRecord,
  type NotificationProductionCertificationRuntimeStats,
  type NotificationProductionCertificationSummary
} from "@/src/lib/notifications/notification-production-certification-runtime";
import {
  listSeoPages,
  mapSeoPageRuntimeToAdminSeoPage
} from "@/src/lib/seo/seo-page-runtime";
import { mapMetaTitleRuntimeToAdminFields } from "@/src/lib/seo/seo-meta-title-runtime";
import { mapMetaDescriptionRuntimeToAdminFields } from "@/src/lib/seo/seo-meta-description-runtime";
import { mapCanonicalRuntimeToAdminFields } from "@/src/lib/seo/seo-canonical-runtime";
import { mapOpenGraphRuntimeToAdminFields } from "@/src/lib/seo/seo-open-graph-runtime";
import { mapSeoLanguageRuntimeToAdminFields } from "@/src/lib/seo/seo-language-runtime";
import { mapSitemapRuntimeToAdminFields } from "@/src/lib/seo/seo-sitemap-runtime";
import { mapRobotsRuntimeToAdminFields } from "@/src/lib/seo/seo-robots-runtime";
import { mapStructuredDataRuntimeToAdminFields } from "@/src/lib/seo/seo-structured-data-runtime";
import { mapSearchConsoleRuntimeToAdminFields } from "@/src/lib/seo/seo-search-console-runtime";
import {
  buildNotificationTemplateStatsSafe,
  buildNotificationTemplateViewsSafe,
  parseNotificationTemplateKeySafe,
  resolveNotificationTemplateLabel,
  type NotificationTemplateView
} from "@/src/lib/notifications/notification-template-runtime";
import {
  buildNotificationDeliveryRecordsSafe,
  buildNotificationDeliveryRuntimeStatsSafe,
  type NotificationDeliveryRecord
} from "@/src/lib/notifications/notification-delivery-runtime";
import {
  buildNotificationQueueRecordsSafe,
  buildNotificationQueueRuntimeStatsSafe,
  type NotificationQueueRecord
} from "@/src/lib/notifications/notification-queue-runtime";
import {
  buildNotificationRetryRecordsSafe,
  buildNotificationRetryRuntimeStatsSafe,
  type NotificationRetryRecord
} from "@/src/lib/notifications/notification-retry-runtime";
import {
  buildNotificationFailureRecordsSafe,
  buildNotificationFailureRuntimeStatsSafe,
  type NotificationFailureRecord
} from "@/src/lib/notifications/notification-failure-runtime";
import {
  buildNotificationAuditRecordsSafe,
  buildNotificationAuditRuntimeStatsSafe,
  type NotificationAuditRecord
} from "@/src/lib/notifications/notification-audit-runtime";
import {
  buildNotificationMonitoringRecordsSafe,
  buildNotificationMonitoringRuntimeStatsSafe,
  type NotificationMonitoringRecord
} from "@/src/lib/notifications/notification-monitoring-runtime";
import {
  buildNotificationMetricViewsSafe,
  buildNotificationMetricsSnapshotSafe,
  type NotificationMetricView,
  type NotificationMetricsSnapshot
} from "@/src/lib/notifications/notification-metrics-runtime";
import {
  buildNotificationAnalyticsBreakdownViewsSafe,
  buildNotificationAnalyticsPeriodViewsSafe,
  buildNotificationAnalyticsRateViewsSafe,
  buildNotificationAnalyticsRuntimeStatsSafe,
  buildNotificationAnalyticsSnapshotSafe,
  type NotificationAnalyticsBreakdownItem,
  type NotificationAnalyticsPeriodView,
  type NotificationAnalyticsRateView,
  type NotificationAnalyticsRuntimeStats,
  type NotificationAnalyticsSnapshot
} from "@/src/lib/notifications/notification-analytics-runtime";
import {
  buildNotificationHealthRecordsSafe,
  buildNotificationHealthRuntimeStatsSafe,
  buildNotificationHealthSnapshotSafe,
  type NotificationHealthRecord,
  type NotificationHealthRuntimeStats,
  type NotificationHealthSnapshot
} from "@/src/lib/notifications/notification-health-runtime";
import {
  buildNotificationSecurityCertificationSafe,
  buildNotificationSecurityRecordsSafe,
  buildNotificationSecurityRuntimeStatsSafe,
  collectNotificationSecurityCertificationInput,
  sanitizeNotificationAdminDisplayTextSafe,
  verifyNotificationSecurityFoundationsPresent,
  type NotificationSecurityCertificationSummary,
  type NotificationSecurityRecord,
  type NotificationSecurityRuntimeStats
} from "@/src/lib/notifications/notification-security-runtime";
import {
  buildNotificationRecipientRecordsSafe,
  buildNotificationRecipientRuntimeStatsSafe,
  type NotificationRecipientRecord,
  type NotificationRecipientRuntimeStats
} from "@/src/lib/notifications/notification-recipient-runtime";
import {
  buildNotificationEventRecordsSafe,
  buildNotificationEventRuntimeStatsSafe,
  type NotificationEventRecord,
  type NotificationEventRuntimeStats
} from "@/src/lib/notifications/notification-event-runtime";
import {
  buildNotificationLogRecordsSafe,
  buildNotificationLogRuntimeStatsSafe,
  type NotificationLogRecord,
  type NotificationLogRuntimeStats
} from "@/src/lib/notifications/notification-log-runtime";
import {
  buildNotificationReviewRecordsSafe,
  buildNotificationReviewRuntimeStatsSafe,
  type NotificationReviewRecord,
  type NotificationReviewRuntimeStats
} from "@/src/lib/notifications/notification-review-runtime";
import {
  buildNotificationSafeActionPolicySummarySafe,
  buildNotificationSafeActionRecordsSafe,
  buildNotificationSafeActionRuntimeStatsSafe,
  type NotificationSafeActionPolicySummary,
  type NotificationSafeActionRecord,
  type NotificationSafeActionRuntimeStats
} from "@/src/lib/notifications/notification-safe-action-runtime";
import {
  applyNotificationControlErrorSanitizationSafe,
  buildNotificationErrorSanitizationRecordsSafe,
  buildNotificationErrorSanitizationRuntimeStatsSafe,
  buildNotificationErrorSanitizationSummarySafe,
  type NotificationErrorSanitizationRecord,
  type NotificationErrorSanitizationRuntimeStats,
  type NotificationErrorSanitizationSummary
} from "@/src/lib/notifications/notification-error-sanitization-runtime";
import {
  buildEmailProviderFailoverRecordsSafe,
  buildEmailProviderFailoverRuntimeStatsSafe,
  buildEmailProviderFailoverRuntimeSummarySafe
} from "@/src/lib/email/email-provider-failover-runtime";
import {
  buildEmailAnalyticsRuntimeStatsSafe,
  buildEmailAnalyticsRuntimeSummarySafe
} from "@/src/lib/email/email-analytics-runtime";
import {
  buildEmailCampaignMonitoringRuntimeStatsSafe,
  buildEmailCampaignMonitoringRuntimeSummarySafe,
  buildEmailCampaignMonitoringScopeRecordsSafe
} from "@/src/lib/email/email-campaign-monitoring-runtime";
import {
  buildEmailCampaignQueueRuntimeStatsSafe,
  buildEmailCampaignQueueRuntimeSummarySafe,
  buildEmailCampaignQueueScopeRecordsSafe
} from "@/src/lib/email/email-campaign-queue-runtime";
import {
  buildEmailDeliveryRuntimeStatsSafe,
  buildEmailDeliveryRuntimeSummarySafe
} from "@/src/lib/email/email-delivery-runtime";
import {
  buildEmailFailureRuntimeRecordsSafe,
  buildEmailFailureRuntimeStatsSafe,
  buildEmailFailureRuntimeSummarySafe
} from "@/src/lib/email/email-failure-runtime";
import {
  buildEmailRetryRuntimeStatsSafe,
  buildEmailRetryRuntimeSummarySafe
} from "@/src/lib/email/email-retry-runtime";
import {
  buildEmailSecurityEmailRecordsSafe,
  buildEmailSecurityEmailStatsSafe
} from "@/src/lib/email/email-security-runtime";
import {
  buildEmailSupportEmailRecordsSafe,
  buildEmailSupportEmailStatsSafe
} from "@/src/lib/email/email-support-runtime";
import {
  buildEmailWelcomeEmailRecordsSafe,
  buildEmailWelcomeEmailStatsSafe
} from "@/src/lib/email/email-welcome-runtime";
import {
  buildEmailTemplateValidationRecordsSafe,
  buildEmailTemplateValidationStatsSafe
} from "@/src/lib/email/email-template-validation-runtime";
import {
  buildEmailTemplatePreviewRecordsSafe,
  buildEmailTemplatePreviewStatsSafe
} from "@/src/lib/email/email-template-preview-runtime";
import {
  buildEmailTemplateVersionRecordsSafe,
  buildEmailTemplateVersionStatsSafe
} from "@/src/lib/email/email-template-version-runtime";
import {
  buildEmailTemplateCategoryStatsSafe,
  groupEmailTemplateRecordsByCategorySafe
} from "@/src/lib/email/email-template-category-runtime";
import {
  buildEmailTemplateRegistryRecordsSafe,
  buildEmailTemplateRegistryStatsSafe
} from "@/src/lib/email/email-template-registry-runtime";
import {
  buildEmailRegistryViewsSafe,
  EMAIL_REGISTRY_FALLBACK_ITEMS,
  listEmailRegistryItemsReadOnlySafe,
  type EmailTemplateDisplayStatus
} from "@/src/lib/email/email-registry-runtime";
import { buildEmailRegistryTypeStatsSafe } from "@/src/lib/email/email-type-runtime";
import {
  buildEmailQueueStatusSummaryFromLogsSafe,
  buildEmailRegistryStatusStatsSafe
} from "@/src/lib/email/email-status-runtime";
import { buildMarketingCouponAnalyticsSummarySafe } from "@/src/lib/marketing/marketing-coupon-analytics-runtime";
import { buildMarketingGiftCodeViewsSafe } from "@/src/lib/marketing/marketing-gift-code-runtime";
import { buildMarketingAffiliateViewsSafe } from "@/src/lib/marketing/marketing-affiliate-runtime";
import { buildMarketingCampaignViewsSafe } from "@/src/lib/marketing/marketing-campaign-runtime";
import { buildMarketingReferralViewsSafe } from "@/src/lib/marketing/marketing-referral-runtime";
import { buildMarketingPromotionMetricsSummarySafe } from "@/src/lib/marketing/marketing-promotion-metrics-runtime";
import { buildMarketingPromotionViewsSafe } from "@/src/lib/marketing/marketing-promotion-runtime";
import type { MarketingCouponUsageSummaryRecord } from "@/src/lib/marketing/marketing-coupon-usage-runtime";
import type { MarketingAffiliateTrackingSummaryRecord } from "@/src/lib/marketing/marketing-affiliate-tracking-runtime";
import type { MarketingCampaignEmailSummaryRecord } from "@/src/lib/marketing/marketing-campaign-email-runtime";
import type { MarketingCampaignNotificationSummaryRecord } from "@/src/lib/marketing/marketing-campaign-notification-runtime";
import type { MarketingCommissionSummaryRecord } from "@/src/lib/marketing/marketing-commission-runtime";
import type { MarketingReferralTrackingSummaryRecord } from "@/src/lib/marketing/marketing-referral-tracking-runtime";
import {
  internalTeamRoleMeta,
  internalTeamRoles,
  normalizeInternalTeamRole,
  type InternalTeamInvitationRow,
  type InternalTeamMemberRow
} from "@/lib/admin/internal-team-runtime";
import { createClient } from "@/lib/supabase/server";
import { aiVisualQueueFromStoreData } from "@/lib/storefront/ai-visual-queue";
import { getAIVisualProviderRuntimeConfig } from "@/lib/storefront/ai-visual-provider";
import { getHttpApiReadiness } from "@/lib/domains/httpapi-client";
import {
  buildDefaultDomainDnsRecords,
  type DomainDnsRuntimeRecord
} from "@/lib/domains/dns-records";
import { integrationDefinitions } from "@/lib/integrations/catalog";
import { listIntegrationHealth, type IntegrationHealthStatus } from "@/lib/integrations/health-engine";
import { extractHttpApiErrorMessage } from "@/lib/domains/httpapi-registration";
import {
  calculateMarketplaceRevenue,
  evaluateMarketplaceAppBinding,
  evaluateMarketplaceCreatorAccount,
  evaluateMarketplaceCreatorSubmissionInspection,
  evaluateMarketplaceItemAssetsInspection,
  evaluateMarketplaceItemCreatorLink,
  listMarketplaceAssets,
  evaluateMarketplaceModerationInspection,
  evaluateMarketplacePluginBinding,
  evaluateMarketplaceServiceBinding,
  evaluateMarketplaceTemplateBinding,
  evaluateMarketplaceThemeBinding,
  getAvailableMarketplaceApprovalActions,
  getAvailableMarketplaceModerationActions,
  getMarketplacePlatformFeeRate,
  listMarketplaceAppBindings,
  listMarketplaceCreatorAccounts,
  listMarketplaceInstallEvents,
  listMarketplacePluginBindings,
  listMarketplaceServiceBindings,
  listMarketplaceRevenueEvents,
  getMarketplaceRegistryStatsReadOnly,
  createEmptyMarketplaceSectionItemGroups,
  listMarketplaceSectionItemGroupsReadOnly,
  toAdminMarketplaceSectionName,
  type MarketplaceInstallEventRecord,
  type MarketplaceRevenueEventRecord
} from "@/src/lib/marketplace/marketplace-registry";
import {
  getTemplateRegistryStats,
  listTemplates,
  listTemplatesReadOnly
} from "@/src/lib/templates/template-registry";
import {
  listAllTemplateVersions
} from "@/src/lib/templates/template-versions";
import { getTemplateVisibilityStats } from "@/src/lib/templates/template-visibility";
import { getTemplateActivationStats } from "@/src/lib/templates/template-activation";
import { listArchivedTemplates } from "@/src/lib/templates/template-archive";
import { getOfficialTemplateStats } from "@/src/lib/templates/template-official";
import {
  getRecommendedTemplateStats,
  listRecommendedTemplates
} from "@/src/lib/templates/template-recommendation";
import {
  getTemplatePackageStats,
  listTemplatePackages,
  validateTemplatePackage
} from "@/src/lib/templates/template-package-runtime";
import { listAllTemplateScreenshots } from "@/src/lib/templates/template-screenshot-storage";
import { listAllTemplateAssets } from "@/src/lib/templates/template-asset-storage";
import { listTemplateInstalls } from "@/src/lib/templates/template-install-runtime";
import { listStoreTemplateAssignments } from "@/src/lib/templates/store-template-assignment";
import { listStoreThemeIsolationIssues } from "@/src/lib/templates/store-theme-isolation";
import { listTemplateUpdateJobs } from "@/src/lib/templates/template-update-runtime";
import { listTemplateRollbackJobs } from "@/src/lib/templates/template-rollback-runtime";
import {
  getMarketplaceApprovalStats,
  listPendingMarketplaceListings
} from "@/src/lib/templates/marketplace-approval-runtime";
import {
  listTemplatePublishEvents,
  validateTemplateVersionPublish
} from "@/src/lib/templates/template-publish-runtime";
import {
  getResellerTemplateStats,
  listResellerTemplates
} from "@/src/lib/templates/reseller-template-runtime";
import {
  getMarketplaceCatalogPreview,
  getMarketplaceListingStats,
  listMarketplaceListings
} from "@/src/lib/templates/template-marketplace-runtime";
import { summarizeUserAgent } from "@/lib/security/user-agent";
import {
  type PlatformBrandSettingRecord,
  type PlatformBrandValidationStatus
} from "@/src/lib/platform-theme/platform-brand-settings";
import {
  ensurePlatformThemeRegistry,
  type PlatformThemeRegistrySection,
  type PlatformThemeSectionStatus
} from "@/src/lib/platform-theme/platform-theme-registry";
import {
  getThemeDraft,
  type PlatformThemeDraft
} from "@/src/lib/platform-theme/platform-theme-draft-runtime";
import {
  validateThemeBeforePublish,
  type PlatformThemePublishValidation
} from "@/src/lib/platform-theme/platform-theme-publish-runtime";
import {
  getCurrentPlatformLogo,
  type PlatformLogoReference
} from "@/src/lib/platform-theme/platform-logo-upload";
import {
  getCurrentPlatformFavicon,
  type PlatformFaviconReference
} from "@/src/lib/platform-theme/platform-favicon-upload";
import {
  listPlatformThemeAssets,
  type PlatformThemeAssetRecord
} from "@/src/lib/platform-theme/platform-theme-assets";
import {
  resolvePlatformBranding,
  type PlatformBranding
} from "@/src/lib/platform-theme/public-platform-theme-resolver";
import {
  resolveAdminBranding,
  type AdminPlatformBranding
} from "@/src/lib/platform-theme/admin-platform-theme-resolver";
import {
  listThemeVersions,
  type PlatformThemeVersionRecord
} from "@/src/lib/platform-theme/platform-theme-versions";
import {
  listThemePresets,
  type PlatformThemePresetRecord
} from "@/src/lib/platform-theme/platform-theme-presets";
import {
  defaultPlatformWhiteLabelSettings,
  getWhiteLabelSettings,
  type PlatformWhiteLabelSettings,
  type PlatformWhiteLabelStatus,
  type PlatformWhiteLabelValidation
} from "@/src/lib/platform-theme/platform-white-label";
import {
  listResellerBrandingSummaries,
  type EffectiveResellerBranding,
  type ResellerBrandingInheritanceMode,
  type ResellerBrandingSource,
  type ResellerBrandingStatus
} from "@/src/lib/platform-theme/reseller-branding";
import {
  listPlatformBlogPosts,
  type PlatformBlogPostRecord
} from "@/src/lib/platform-website/blog/platform-blog-service";
import {
  getAdvancedPublishingDashboard,
  type PlatformAdvancedPublishingDashboard
} from "@/src/lib/platform-website/publishing/revisions-service";
import {
  getPlatformAnalyticsSummary,
  type PlatformAnalyticsSummary
} from "@/src/lib/platform-website/analytics/platform-analytics-service";
import {
  getPlatformWebsiteCertification,
  type PlatformWebsiteCertificationSummary
} from "@/src/lib/platform-website/certification/platform-website-certification";
import {
  getPlatformWebsiteMonitoring,
  type PlatformWebsiteMonitoringFilters,
  type PlatformWebsiteMonitoringSummary
} from "@/src/lib/platform-website/monitoring/platform-website-monitoring";
import {
  listCategories,
  type PlatformBlogCategoryRecord
} from "@/src/lib/platform-website/blog/categories-service";
import {
  listTags,
  type PlatformBlogTagRecord
} from "@/src/lib/platform-website/blog/tags-service";
import {
  ensurePlatformPagesRegistry,
  type PlatformPageRegistryRecord
} from "@/src/lib/platform-website/platform-pages-registry";
import { isConnectedPlatformRoute } from "@/src/lib/platform-website/public-page-resolver";
import {
  getPlatformTranslationStatus,
  validatePlatformTranslations,
  type PlatformLocale,
  type PlatformTranslationReadiness
} from "@/src/lib/platform-website/platform-translations-runtime";
import type { Database } from "@/types/database";

type AnyRecord = Record<string, unknown>;

export type AdminUser = {
  activeSubscriptionLabel: string;
  id: string;
  email: string;
  emailMasked: string;
  fullName: string | null;
  isHighRisk: boolean;
  plan: string;
  planId: string;
  primaryRole: string;
  reviewedAt: string | null;
  riskStatus: "clear" | "high_risk" | "reviewed";
  securitySignals: Array<{
    createdAt: string;
    label: string;
    severity: "high" | "low" | "medium";
  }>;
  status: string;
  accountStatus: string;
  governanceStatus: "suspended" | null;
  createdAt: string | null;
  lastLoginAt: string | null;
  workspaceCount: number;
  storesCount: number;
  landingsCount: number;
  ordersCount: number;
  recentActivity: Array<{
    createdAt: string;
    label: string;
  }>;
  stores: Array<{
    createdAt: string;
    id: string;
    name: string;
    status: string;
  }>;
  subscription: {
    cancelAtPeriodEnd: boolean;
    currentPeriodEnd: string | null;
    currentPeriodStart: string | null;
    planId: string;
    planName: string;
    status: string;
  };
  workspaces: Array<{
    createdAt: string | null;
    id: string;
    role: string;
    status: string;
  }>;
};

export type AdminUserDetail = AdminUser & {
  recentOrders: Array<{
    createdAt: string;
    currency: string;
    id: string;
    sourceType: string;
    status: string;
    total: number;
  }>;
  stores: Array<{
    createdAt: string;
    id: string;
    name: string;
    status: string;
  }>;
};

export type AdminStoreHealthKey =
  | "domain_not_connected"
  | "missing_legal_pages"
  | "missing_products"
  | "no_payment_method"
  | "no_shipping_settings"
  | "publish_blocked"
  | "publish_ready";

export type AdminStore = {
  id: string;
  slug: string | null;
  workspaceId: string | null;
  ownerId: string | null;
  ownerEmail: string;
  ownerType: "owner" | "unknown";
  name: string;
  status: string;
  storeStatus: string;
  plan: string;
  planId: string;
  subscriptionStatus: string;
  publicationStatus: string;
  template: string;
  publishedUrl: string | null;
  createdAt: string;
  updatedAt: string | null;
  hasDomain: boolean;
  domainStatus: string;
  domains: Array<{
    hostname: string;
    status: string;
    verificationStatus: string;
  }>;
  productsCount: number;
  ordersCount: number;
  revenue: number;
  viewsCount: number;
  riskStatus: "clear" | "high_risk" | "reviewed";
  reviewedAt: string | null;
  riskSignals: Array<{
    createdAt: string | null;
    label: string;
    severity: "high" | "low" | "medium";
  }>;
  health: Array<{
    key: AdminStoreHealthKey;
    label: string;
    status: "blocked" | "ready" | "warning";
  }>;
  workspaceMembers: Array<{
    email: string;
    role: string;
    status: string;
    userId: string;
  }>;
};

export type AdminSeller = {
  userId: string;
  email: string;
  fullName: string | null;
  status: "active" | "suspended" | "under_review";
  createdAt: string | null;
  roleType: string;
  accountStatus: string;
  plan: string;
  planId: string;
  storesOwned: number;
  publishedStores: number;
  productsCount: number;
  ordersCount: number;
  customersCount: number;
  revenue: number;
  governanceStatus: "active" | "suspended" | "under_review";
  riskStatus: "clear" | "high_risk" | "reviewed";
  reviewedAt: string | null;
  riskSignals: Array<{
    createdAt: string | null;
    label: string;
    severity: "high" | "low" | "medium";
  }>;
  subscription: {
    planId: string;
    planName: string;
    status: string;
  };
  stores: Array<{
    createdAt: string;
    id: string;
    name: string;
    slug: string | null;
    status: string;
    workspaceId: string | null;
  }>;
  workspaceIds: string[];
  recentOrders: Array<{
    createdAt: string;
    currency: string;
    id: string;
    source: string;
    status: string;
    storeId: string;
    total: number;
  }>;
};

export type AdminReseller = {
  userId: string;
  email: string;
  fullName: string | null;
  status: "active" | "suspended" | "pending_verification" | "verified";
  governanceStatus: "active" | "suspended" | "pending_review";
  verificationStatus: "pending_verification" | "verified";
  createdAt: string | null;
  plan: string;
  planId: string;
  subscriptionStatus: string;
  workspaceIds: string[];
  storesCreated: number;
  storesSold: number;
  customersReferred: number;
  commissionsPlaceholder: string;
  commissionStatus: string;
  riskStatus: "clear" | "high_risk" | "reviewed";
  reviewedAt: string | null;
  riskSignals: Array<{
    createdAt: string | null;
    label: string;
    severity: "high" | "low" | "medium";
  }>;
  profile: {
    displayName: string | null;
    id: string | null;
    isPublished: boolean;
    slug: string | null;
  };
  ownedStores: Array<{
    createdAt: string;
    id: string;
    name: string;
    slug: string | null;
    status: string;
    workspaceId: string | null;
  }>;
  transferredStores: Array<{
    buyerEmail: string | null;
    id: string;
    name: string;
    status: string;
    transferredAt: string | null;
  }>;
  commissionSummary: {
    note: string;
    total: number;
  };
  branding: {
    customDraft: PlatformWhiteLabelSettings;
    customPreview: PlatformWhiteLabelSettings;
    effective: PlatformWhiteLabelSettings;
    effectiveSource: ResellerBrandingSource;
    hasCustomDraftChanges: boolean;
    hasCustomPublished: boolean;
    inheritanceMode: ResellerBrandingInheritanceMode;
    platformPreview: PlatformWhiteLabelSettings;
    publishStatus: ResellerBrandingStatus;
    validationOk: boolean;
  };
};

export type AdminPaymentProviderControl = {
  providers: Array<{
    configurationStatus: "configured" | "missing" | "partial";
    configChecks: Array<{
      label: string;
      status: "configured" | "missing" | "not_applicable";
    }>;
    connectedStoresCount: number;
    docsUrl: string | null;
    enabledStatus: "disabled" | "enabled" | "placeholder_disabled" | "under_review";
    environmentMode: "live" | "test" | "sandbox" | "placeholder";
    healthStatus: "healthy" | "missing_config" | "needs_review" | "warning";
    key: string;
    lastCheckedAt: string | null;
    lastEvent: string | null;
    name: string;
    scope: "manual_offline" | "platform_billing" | "store_payments";
    warnings: Array<"live_mode_not_verified" | "provider_not_configured" | "test_mode" | "webhook_missing">;
    webhookStatus: "configured" | "missing" | "not_applicable" | "placeholder";
  }>;
  storePaymentAdoption: {
    codStores: number;
    manualStores: number;
    missingPaymentMethodStores: number;
    stripePendingStores: number;
    stripeRestrictedStores: number;
    paypalStores: number;
    stripeStores: number;
    totalStores: number;
  };
  paymentSetupRisks: Array<{
    id: string;
    name: string;
    ownerEmail: string;
    reason: string;
    slug: string | null;
  }>;
  webhookMonitoring: {
    failedEvents: number;
    recentEvents: Array<{
      createdAt: string;
      eventStatus: string;
      eventType: string;
      provider: string;
    }>;
    totalEvents: number;
  };
};

export type AdminDomainsHostingControl = {
  overview: {
    connectedDomains: number;
    dnsConfigured: number;
    dnsFailed: number;
    dnsPending: number;
    dnsVerified: number;
    domainDrafts: number;
    emailMailboxDrafts: number;
    failedOperations: number;
    pendingDomainOrders: number;
    readyForRegistration: number;
    sslPending: number;
  };
  domainOrders: Array<{
    adminContactId: string | null;
    autoRenew: string | null;
    billingContactId: string | null;
    createdAt: string;
    customerDueCents: number;
    domain: string;
    domainOrderId: string | null;
    dnsRecords: DomainDnsRuntimeRecord[];
    extension: string;
    id: string;
    nameserverCount: number;
    nameservers: string[];
    nextStep: string;
    ownerEmail: string;
    planCreditUsedCents: number;
    provider: string | null;
    providerCustomerId: string | null;
    providerEntityId: string | null;
    providerErrorMessage: string | null;
    providerOrderId: string | null;
    providerResponse: unknown;
    providerStatusSyncedAt: string | null;
    registrantContactId: string | null;
    registrationYears: number | null;
    status: string;
    storeId: string;
    storeName: string;
    techContactId: string | null;
    timelineEvents: Array<{
      label: string;
      providerError: string | null;
      providerMessage: string | null;
      providerOrderId: string | null;
      status: "failed" | "info" | "pending" | "success";
      timestamp: string | null;
    }>;
    updatedAt: string;
  }>;
  emailOrders: Array<{
    activationStatus: string;
    createdAt: string;
    dnsStatus: string;
    domain: string;
    id: string;
    mailboxAddress: string;
    mailboxPlan: string;
    ownerEmail: string;
    status: string;
    storeId: string;
    storeName: string;
  }>;
  sslStatuses: Array<{
    createdAt: string;
    dnsStatus: string;
    domain: string;
    id: string;
    ownerEmail: string;
    primaryDomainStatus: string;
    provider: string | null;
    sslStatus: string;
    storeId: string;
    storeName: string;
  }>;
  providerHealth: Array<{
    service: string;
    status: "placeholder" | "ready" | "review";
    note: string;
  }>;
  hostingPlaceholder: {
    orders: string;
    providerHook: string;
    provisioning: string;
  };
  platformBalance: {
    note: string;
    status: string;
  };
};

export type AdminIntegrationsControl = {
  categories: string[];
  futureHooks: string[];
  integrations: Array<{
    category: string;
    configurationStatus: "configured" | "missing" | "partial";
    consecutiveFailures: number;
    enabledStatus: "disabled" | "enabled" | "under_review";
    healthStatus: IntegrationHealthStatus | "needs_review" | "warning";
    key: string;
    lastErrorCode: string | null;
    lastErrorMessage: string | null;
    lastChecked: string | null;
    lastFailureAt: string | null;
    lastSafeResponseSummary: Record<string, unknown>;
    lastSuccessAt: string | null;
    mode: "live" | "test" | "sandbox" | "placeholder";
    name: string;
    responseTimeMs: number | null;
    secretStatus: "masked_configured" | "masked_partial" | "missing" | "no_secret_required";
  }>;
  overview: {
    configured: number;
    missing: number;
    partial: number;
    total: number;
    underReview: number;
    webhookFailures: number;
  };
  webhooks: Array<{
    name: string;
    provider: string;
    recentFailures: number;
    retryStatus: string;
    status: "configured" | "missing" | "placeholder";
  }>;
};

export type AdminAIControl = {
  failureMonitoring: Array<{
    count: number;
    label: string;
    note: string;
  }>;
  futureHooks: string[];
  jobs: Array<{
    assetUrl: string | null;
    completedAt: string | null;
    costEstimate: number;
    createdAt: string;
    errorSummary: string | null;
    id: string;
    jobType: string;
    ownerEmail: string;
    provider: string;
    status: string;
    storeId: string | null;
    storeName: string;
  }>;
  overview: {
    completedJobs: number;
    estimatedCost: number;
    failedJobs: number;
    pendingJobs: number;
    processingJobs: number;
    storesUsingAI: number;
    topAssetTypes: string;
    totalJobs: number;
  };
  providers: Array<{
    configurationStatus: "configured" | "disabled" | "missing";
    costTracking: string;
    healthStatus: "healthy" | "missing_config" | "placeholder" | "warning";
    name: string;
    provider: string;
    secretStatus: "masked_configured" | "missing" | "no_secret_required";
  }>;
  storeUsage: Array<{
    completed: number;
    estimatedCost: number;
    failed: number;
    lastActivity: string | null;
    ownerEmail: string;
    storeId: string;
    storeName: string;
    totalJobs: number;
  }>;
};

export type AdminPlatformWebsiteControl = {
  advancedPublishing: PlatformAdvancedPublishingDashboard;
  analytics: PlatformAnalyticsSummary;
  certification: PlatformWebsiteCertificationSummary;
  monitoring: PlatformWebsiteMonitoringSummary;
  blogFoundation: {
    archivedPosts: number;
    categories: PlatformBlogCategoryRecord[];
    draftPosts: number;
    publishedPosts: number;
    recentPosts: PlatformBlogPostRecord[];
    tags: PlatformBlogTagRecord[];
    totalCategories: number;
    totalPosts: number;
    totalTags: number;
  };
  futureHooks: string[];
  landingStatus: Array<{
    label: string;
    ready: boolean;
    route: string;
  }>;
  pages: Array<{
    canonical: string;
    id: string;
    isLive: boolean;
    languages: Array<{
      language: "ar" | "en" | "fr";
      status: PlatformTranslationReadiness;
    }>;
    lastUpdated: string | null;
    metaDescription: string;
    metaTitle: string;
    openGraph: string;
    previewHref: string | null;
    route: string;
    publishingReadiness: {
      contentReady: boolean;
      routeReady: boolean;
      seoReady: boolean;
      translationStatus: PlatformTranslationReadiness;
    };
    publishingStatus: "Archived" | "Draft" | "Needs Content" | "Needs SEO" | "Published";
    section: string;
    seoStatus: "missing" | "needs_metadata" | "placeholder" | "ready";
    seoReadiness: {
      isReady: boolean;
      missingCanonical: boolean;
      missingDescription: boolean;
      missingOpenGraph: boolean;
      missingTitle: boolean;
    };
    contentStatus: "draft_ready" | "needs_attention" | "placeholder" | "ready";
    slug: string;
    status: "archived" | "draft" | "published";
    title: string;
    translationMissingFields: Record<PlatformLocale, string[]>;
  }>;
  overview: {
    archivedPages: number;
    draftPages: number;
    publishedPages: number;
    readyLandingPages: number;
    seoReadyPages: number;
    totalPages: number;
  };
};

export type AdminPlatformThemeControl = {
  assets: PlatformThemeAssetRecord[];
  adminTheme: AdminPlatformBranding;
  branding: {
    accentColor: string;
    darkMode: string;
    favicon: string;
    lightMode: string;
    logo: string;
    primaryColor: string;
    secondaryColor: string;
    typography: string;
  };
  draft: PlatformThemeDraft;
  favicon: PlatformFaviconReference;
  futureHooks: string[];
  logo: PlatformLogoReference;
  publicTheme: PlatformBranding;
  publishReadiness: PlatformThemePublishValidation;
  previews: {
    adminDashboard: Array<{
      description: string;
      label: string;
      status: "placeholder" | "ready";
    }>;
    publicWebsite: Array<{
      description: string;
      label: string;
      status: "placeholder" | "ready";
    }>;
  };
  readiness: Array<{
    direction: "LTR" | "RTL";
    language: "Arabic" | "English" | "French";
    status: "placeholder" | "ready";
  }>;
  sections: Array<{
    description: string;
    draftChanged: boolean;
    label: string;
    lastSavedAt: string | null;
    publishedValue: string;
    settingKey: string;
    settingType: string;
    status: PlatformThemeSectionStatus;
    validationMessage: string | null;
    validationStatus: PlatformBrandValidationStatus;
    value: string;
  }>;
  presets: PlatformThemePresetRecord[];
  versions: PlatformThemeVersionRecord[];
  whiteLabel: {
    draft: PlatformWhiteLabelSettings;
    hasDraftChanges: boolean;
    hasPublished: boolean;
    published: PlatformWhiteLabelSettings;
    status: PlatformWhiteLabelStatus;
    validation: PlatformWhiteLabelValidation;
  };
};

export type AdminTemplateManagementControl = {
  archivedTemplates: Array<{
    archivedAt: string | null;
    category: string;
    latestVersion: string | null;
    name: string;
    previousVisibility: "internal" | "marketplace" | "owner" | "reseller";
    registryId: string;
    templateKey: string;
  }>;
  futureHooks: string[];
  overview: {
    activeTemplates: number;
    archivedTemplates: number;
    draftTemplates: number;
    officialTemplates: number;
    recommendedTemplates: number;
    resellerVisibleTemplates: number;
    totalTemplates: number;
  };
  packageOverview: {
    draftPackages: number;
    invalidPackages: number;
    needsAttentionPackages: number;
    readyPackages: number;
    totalPackages: number;
  };
  packages: Array<{
    contents: {
      ai_support_enabled: boolean;
      blog_posts_count: number;
      categories_count: number;
      checkout_ready: boolean | "unknown";
      domain_ready: boolean;
      faq_count: number;
      navigation_ready: boolean | "unknown";
      pages_count: number;
      products_count: number;
      theme_ready: boolean | "unknown";
    };
    packageId: string;
    packageKey: string;
    packageName: string;
    readinessStatus: "draft" | "invalid" | "needs_attention" | "ready";
    registryId: string;
    templateKey: string;
    templateName: string;
    validationIssues: string[];
  }>;
  recommendedTemplates: Array<{
    category: string;
    latestVersion: string | null;
    name: string;
    recommendationOrder: number | null;
    registryId: string;
    templateKey: string;
    visibility: "internal" | "marketplace" | "owner" | "reseller";
  }>;
  screenshotOverview: {
    archivedScreenshots: number;
    draftScreenshots: number;
    publishedScreenshots: number;
    totalScreenshots: number;
  };
  assetOverview: {
    archivedAssets: number;
    draftAssets: number;
    publishedAssets: number;
    totalAssets: number;
  };
  assets: Array<{
    assetType: string;
    fileSize: number;
    id: string;
    managedExternally: boolean;
    mimeType: string;
    originalFilename: string;
    previewUrl: string | null;
    registryId: string;
    source: "template_assets" | "template_screenshots";
    status: "archived" | "deleted" | "draft" | "published";
    templateName: string;
    uploadedAt: string | null;
  }>;
  screenshots: Array<{
    id: string;
    originalFilename: string;
    previewUrl: string | null;
    registryId: string;
    screenshotType: "desktop" | "gallery" | "hero" | "mobile" | "tablet" | "thumbnail";
    sortOrder: number;
    status: "archived" | "deleted" | "draft" | "published";
    templateName: string;
  }>;
  installableStores: Array<{
    id: string;
    name: string;
    slug: string | null;
  }>;
  installOverview: {
    completedInstalls: number;
    failedInstalls: number;
    preparedInstalls: number;
    totalInstalls: number;
  };
  assignmentOverview: {
    activeAssignments: number;
    assignedAssignments: number;
    totalAssignments: number;
    unassignedAssignments: number;
  };
  assignableTemplates: Array<{
    name: string;
    publishedVersionId: string;
    publishedVersionNumber: string;
    registryId: string;
  }>;
  activeAssignmentStoreIds: string[];
  storeTemplateAssignments: Array<{
    assignedAt: string | null;
    assignmentSource: "migration" | "store_creation" | "super_admin_manual" | "template_install";
    assignmentStatus: "active" | "assigned" | "failed" | "inactive" | "unassigned";
    id: string;
    installId: string | null;
    ownerEmail: string;
    storeId: string;
    storeName: string;
    templateId: string;
    templateName: string;
    versionNumber: string | null;
  }>;
  isolationOverview: {
    failedSnapshots: number;
    safeSnapshots: number;
    totalSnapshots: number;
    warningSnapshots: number;
  };
  storeThemeIsolationSnapshots: Array<{
    createdAt: string | null;
    id: string;
    installId: string | null;
    isolationStatus: "failed" | "safe" | "warning";
    issueSummary: string | null;
    issuesCount: number;
    storeId: string;
    storeName: string;
    templateId: string | null;
    templateName: string;
  }>;
  updateOverview: {
    completedUpdates: number;
    failedUpdates: number;
    preparedUpdates: number;
    totalUpdates: number;
  };
  updatableTargets: Array<{
    assignmentId: string;
    currentVersionId: string | null;
    currentVersionNumber: string | null;
    registryId: string;
    storeId: string;
    storeName: string;
    targetVersionId: string;
    targetVersionNumber: string;
    templateName: string;
  }>;
  templateUpdateJobs: Array<{
    assignmentId: string | null;
    completedAt: string | null;
    conflictSummary: string | null;
    conflictsCount: number;
    createdAt: string | null;
    currentVersionNumber: string | null;
    errorMessage: string | null;
    id: string;
    status: "cancelled" | "completed" | "failed" | "prepared" | "updating";
    storeId: string;
    storeName: string;
    summaryNote: string | null;
    targetVersionNumber: string | null;
    templateId: string;
    templateName: string;
  }>;
  rollbackOverview: {
    completedRollbacks: number;
    failedRollbacks: number;
    preparedRollbacks: number;
    totalRollbacks: number;
  };
  rollbackableTargets: Array<{
    assignmentId: string;
    currentVersionId: string | null;
    currentVersionNumber: string | null;
    registryId: string;
    storeId: string;
    storeName: string;
    targetVersionId: string;
    targetVersionNumber: string;
    templateName: string;
    updateJobId: string | null;
  }>;
  templateRollbackJobs: Array<{
    assignmentId: string | null;
    completedAt: string | null;
    conflictSummary: string | null;
    conflictsCount: number;
    createdAt: string | null;
    currentVersionNumber: string | null;
    errorMessage: string | null;
    id: string;
    status: "cancelled" | "completed" | "failed" | "prepared" | "rolling_back";
    storeId: string;
    storeName: string;
    summaryNote: string | null;
    targetVersionNumber: string | null;
    templateId: string;
    templateName: string;
    updateJobId: string | null;
  }>;
  marketplaceListingOverview: {
    approvedListings: number;
    archivedListings: number;
    changesRequestedListings: number;
    draftListings: number;
    featuredListings: number;
    pendingReviewListings: number;
    publishedListings: number;
    rejectedListings: number;
    totalListings: number;
  };
  marketplaceApprovalOverview: {
    approvedListings: number;
    changesRequestedListings: number;
    pendingReviewListings: number;
    rejectedListings: number;
    totalReviewableListings: number;
  };
  marketplaceApprovalQueue: Array<{
    approvalStatus: "changes_requested" | "approved" | "pending_review" | "rejected";
    id: string;
    lastReviewNote: string | null;
    listingDescription: string | null;
    listingStatus: "archived" | "draft" | "published";
    listingTitle: string;
    pricingType: "free" | "included" | "paid";
    readinessLabel: string;
    rejectionReason: string | null;
    templateId: string;
    templateName: string | null;
    updatedAt: string | null;
    versionNumber: string | null;
  }>;
  marketplaceEligibleTemplates: Array<{
    packageReadiness: string;
    publishedVersionNumber: string | null;
    registryId: string;
    templateName: string;
    visibility: string;
    warnings: string[];
  }>;
  marketplaceListings: Array<{
    approvalStatus: "approved" | "changes_requested" | "pending_review" | "rejected";
    createdAt: string | null;
    currency: string | null;
    featured: boolean;
    id: string;
    listingDescription: string | null;
    listingStatus: "archived" | "draft" | "published";
    listingTitle: string;
    priceAmount: number | null;
    pricingLabel: string;
    pricingType: "free" | "included" | "paid";
    publishedAt: string | null;
    templateId: string;
    templateName: string;
    versionNumber: string | null;
  }>;
  marketplaceCatalogPreview: Array<{
    badges: string[];
    category: string | null;
    featured: boolean;
    id: string;
    isOfficial: boolean;
    isRecommended: boolean;
    listingDescription: string | null;
    listingStatus: string;
    listingTitle: string;
    previewGradient: string | null;
    pricingLabel: string;
    pricingType: string;
    publishedAt: string | null;
    screenshots: Array<{
      imageUrl: string | null;
      label: string;
    }>;
    templateName: string;
    templateSlug: string;
    versionNumber: string | null;
  }>;
  templatePublishOverview: {
    draftVersions: number;
    publishedVersions: number;
    recentPublishEvents: number;
    templatesWithPublishedVersion: number;
  };
  templatePublishEvents: Array<{
    createdAt: string | null;
    eventType: string;
    templateId: string | null;
    templateName: string | null;
    versionId: string | null;
    versionNumber: string | null;
  }>;
  templatePublishStatuses: Array<{
    currentPublishedVersion: string | null;
    draftVersionCount: number;
    lastPublishedAt: string | null;
    registryId: string;
    templateName: string;
    templateStatus: string;
  }>;
  resellerTemplateOverview: {
    activeAssignments: number;
    assignedTemplates: number;
    revokedAssignments: number;
    suspendedAssignments: number;
    totalAssignments: number;
  };
  resellerTemplateAssignments: Array<{
    accessId: string;
    accessStatus: "active" | "revoked" | "suspended";
    accessType: "assigned" | "inherited" | "marketplace";
    assignedAt: string | null;
    resellerId: string;
    resellerName: string;
    resellerSlug: string | null;
    templateId: string;
    templateName: string;
    versionNumber: string | null;
  }>;
  resellerAssignableTemplates: Array<{
    publishedVersionNumber: string | null;
    registryId: string;
    templateName: string;
    visibility: string;
  }>;
  resellerOptions: Array<{
    displayName: string;
    id: string;
    slug: string | null;
  }>;
  templateInstalls: Array<{
    completedAt: string | null;
    createdAt: string | null;
    errorMessage: string | null;
    id: string;
    status: "cancelled" | "completed" | "failed" | "installing" | "prepared";
    storeId: string;
    storeName: string;
    templateId: string;
    templateName: string;
  }>;
  templates: Array<{
    badges: {
      official: boolean;
      premium: boolean;
      recommended: boolean;
    };
    category: string;
    createdAt: string | null;
    domainEmailReadiness: "placeholder" | "ready";
    id: string;
    industry: string;
    installedVersionCount: number;
    lastUpdated: string | null;
    latestVersion: {
      publishedAt: string | null;
      status: "archived" | "draft" | "published";
      versionNumber: string;
    } | null;
    name: string;
    packageRuntime: {
      contents: {
        ai_support_enabled: boolean;
        blog_posts_count: number;
        categories_count: number;
        checkout_ready: boolean | "unknown";
        domain_ready: boolean;
        faq_count: number;
        navigation_ready: boolean | "unknown";
        pages_count: number;
        products_count: number;
        theme_ready: boolean | "unknown";
      };
      packageId: string;
      packageKey: string;
      packageName: string;
      readinessStatus: "draft" | "invalid" | "needs_attention" | "ready";
      validationIssues: string[];
    } | null;
    packageSummary: {
      aiVisualSupport: boolean;
      blogCount: number;
      categoriesCount: number;
      faqCount: number;
      pagesCount: number;
      productsCount: number;
    };
    packageVersion: number | null;
    previewHref: string;
    recommendationOrder: number | null;
    registryId: string;
    assets: Array<{
      assetType: string;
      fileSize: number;
      id: string;
      managedExternally: boolean;
      mimeType: string;
      originalFilename: string;
      previewUrl: string | null;
      status: "archived" | "deleted" | "draft" | "published";
      uploadedAt: string | null;
    }>;
    screenshots: Array<{
      id: string;
      originalFilename: string;
      previewUrl: string | null;
      screenshotType: "desktop" | "gallery" | "hero" | "mobile" | "tablet" | "thumbnail";
      sortOrder: number;
      status: "archived" | "deleted" | "draft" | "published";
    }>;
    status: "active" | "archived" | "draft";
    updateAvailable: "placeholder";
    versions: Array<{
      changelog: string | null;
      createdAt: string | null;
      id: string;
      publishReadiness: {
        canPublish: boolean;
        issues: string[];
      };
      publishedAt: string | null;
      status: "archived" | "draft" | "published";
      versionNumber: string;
    }>;
    visibility: "internal" | "marketplace" | "owner" | "reseller";
  }>;
  versionOverview: {
    archivedVersions: number;
    draftVersions: number;
    publishedVersions: number;
    templatesWithPublishedVersion: number;
    totalVersions: number;
  };
  visibility: {
    hiddenInternal: number;
    marketplaceVisible: number;
    ownerVisible: number;
    resellerVisible: number;
  };
};

export type AdminMarketplaceControl = {
  creators: Array<{
    accountId: string | null;
    creatorStatus: "active" | "archived" | "draft" | "suspended";
    creatorType: "agency" | "company" | "individual" | "internal";
    displayName: string;
    id: string;
    itemCount: number;
    linkedUserId: string | null;
    publicEligible: boolean;
    publicSlug: string;
    verificationIssues: string[];
    verificationStatus: "pending" | "rejected" | "unverified" | "verified";
    verified: boolean;
  }>;
  futureHooks: string[];
  items: Array<{
    approval: {
      action: "approve" | "archive" | "reject" | "restore_to_draft" | "submit_for_review" | null;
      approvalNote: string | null;
      approvalUpdatedAt: string | null;
      approvedAt: string | null;
      approvedBy: string | null;
      availableActions: Array<"approve" | "archive" | "reject" | "restore_to_draft" | "submit_for_review">;
      rejectedAt: string | null;
      rejectedBy: string | null;
      reviewedAt: string | null;
      reviewedBy: string | null;
    };
    creator: string;
    creatorAccount: {
      accountId: string | null;
      creatorAccountId: string | null;
      creatorStatus: "active" | "archived" | "draft" | "suspended" | null;
      creatorType: "agency" | "company" | "individual" | "internal" | null;
      displayName: string | null;
      linkedUserId: string | null;
      publicEligible: boolean;
      publicSlug: string | null;
      verificationIssues: string[];
      verificationStatus: "pending" | "rejected" | "unverified" | "verified" | null;
      verified: boolean;
    };
    id: string;
    installInspection: {
      eventCount: number;
      installCount: number;
      installCountUpdatedAt: string | null;
      installEligible: boolean;
      liveInstalls: number;
      publicInstallEligible: boolean;
      recentEvents: Array<{
        createdAt: string | null;
        id: string;
        installStatus: "active" | "disabled" | "failed" | "installed" | "uninstalled";
        source: string;
        storeId: string | null;
      }>;
    };
    installs: number;
    lastUpdated: string | null;
    moderation: {
      availableActions: Array<"approve" | "archive" | "reject" | "request_changes">;
      creatorAccountId: string | null;
      creatorDisplayName: string | null;
      itemName: string;
      itemType: string;
      marketplaceStatus: string;
      moderatedAt: string | null;
      moderatedBy: string | null;
      moderationAction: "approve" | "archive" | "reject" | "request_changes" | null;
      moderationNote: string | null;
      moderationReason: string | null;
      pricingMode: string;
      publicEligible: boolean;
      submissionNote: string | null;
      submissionStatus: "approved" | "draft" | "rejected" | "submitted" | "withdrawn" | null;
      submittedAt: string | null;
      verificationIssues: string[];
      verified: boolean;
      visibility: string;
    };
    name: string;
    pricing: {
      billingInterval: "monthly" | "yearly" | null;
      currency: "EUR" | "MAD" | "USD" | null;
      mode: "free" | "paid" | "subscription";
      priceAmount: number;
      pricingUpdatedAt: string | null;
      trialDays: number;
    };
    revenue: number;
    revenueInspection: {
      creatorRevenueAmount: number;
      currency: "EUR" | "MAD" | "USD" | null;
      eventCount: number;
      grossAmount: number;
      platformFeeAmount: number;
      platformFeeRate: number;
      processedEventCount: number;
      recordedAmount: number;
      recentEvents: Array<{
        createdAt: string | null;
        creatorRevenueAmount: number;
        currency: "EUR" | "MAD" | "USD";
        grossAmount: number;
        id: string;
        platformFeeAmount: number;
        revenueStatus: "cancelled" | "failed" | "pending" | "processed" | "refunded";
        source: string;
      }>;
    };
    section: "App Marketplace" | "Plugin Marketplace" | "Service Marketplace" | "Template Marketplace" | "Theme Marketplace";
    status: "approved" | "archived" | "draft" | "pending_review" | "rejected";
    templateBinding: {
      bindingStatus: "bound" | "invalid" | "orphaned" | "unbound" | null;
      bindingUpdatedAt: string | null;
      linkedTemplateId: string | null;
      templateKey: string | null;
      templateName: string | null;
      templateSlug: string | null;
      templateStatus: "active" | "archived" | "draft" | null;
      templateVersion: string | null;
      templateVisibility: "internal" | "marketplace" | "owner" | "reseller" | null;
      verificationIssues: string[];
      verified: boolean;
    } | null;
    themeBinding: {
      bindingStatus: "bound" | "invalid" | "orphaned" | "unbound" | null;
      bindingUpdatedAt: string | null;
      linkedThemeId: string | null;
      themeKey: string | null;
      themeName: string | null;
      themeStatus: "active" | "archived" | null;
      themeVersion: string | null;
      verificationIssues: string[];
      verified: boolean;
    } | null;
    pluginBinding: {
      bindingStatus: "active" | "archived" | "disabled" | "draft" | null;
      marketplaceStatus: string;
      marketplaceVisibility: string;
      pluginKey: string | null;
      pluginManifestSummary: string[];
      pluginName: string | null;
      pluginVersion: string | null;
      pricingMode: string;
      publicEligible: boolean;
      verificationIssues: string[];
      verified: boolean;
    } | null;
    appBinding: {
      appKey: string | null;
      appManifestSummary: string[];
      appName: string | null;
      appVersion: string | null;
      bindingStatus: "active" | "archived" | "disabled" | "draft" | null;
      marketplaceStatus: string;
      marketplaceVisibility: string;
      pricingMode: string;
      publicEligible: boolean;
      verificationIssues: string[];
      verified: boolean;
    } | null;
    serviceBinding: {
      bindingStatus: "active" | "archived" | "disabled" | "draft" | null;
      marketplaceStatus: string;
      marketplaceVisibility: string;
      pricingMode: string;
      publicEligible: boolean;
      serviceCategory: string | null;
      serviceDescription: string | null;
      serviceDurationDays: number | null;
      serviceKey: string | null;
      serviceName: string | null;
      serviceRequirementsSummary: string[];
      verificationIssues: string[];
      verified: boolean;
    } | null;
    assetInspection: {
      activeAssetCount: number;
      assetCount: number;
      assets: Array<{
        assetStatus: "active" | "archived" | "draft" | "hidden";
        assetType: "demo_media" | "documentation" | "gallery_image" | "preview_file" | "thumbnail";
        fileName: string;
        fileSize: number;
        hasPublicUrl: boolean;
        id: string;
        mimeType: string;
        sortOrder: number;
        storageProvider: "cloudflare-r2" | "external-url" | "supabase-storage";
      }>;
      marketplaceStatus: string;
      marketplaceVisibility: string;
      publicEligible: boolean;
      publicEligibleAssetCount: number;
      verificationIssues: string[];
      verified: boolean;
    };
    submission: {
      creatorAccountId: string | null;
      creatorDisplayName: string | null;
      creatorPublicSlug: string | null;
      marketplaceStatus: string;
      submissionNote: string | null;
      submissionStatus: "approved" | "draft" | "rejected" | "submitted" | "withdrawn" | null;
      submittedAt: string | null;
      submittedBy: string | null;
      verificationIssues: string[];
      verified: boolean;
    };
    type: "app" | "plugin" | "service" | "template" | "theme";
    visibility: "internal" | "private" | "public";
  }>;
  overview: {
    approvedItems: number;
    archivedItems: number;
    draftItems: number;
    liveInstalls: number;
    paymentsProcessed: number;
    pendingReviewItems: number;
    rejectedItems: number;
    totalCreatorRevenueProcessed: number;
    totalItems: number;
    totalPlatformFeesProcessed: number;
    verifiedTemplateBindings: number;
    verifiedThemeBindings: number;
    verifiedPluginBindings: number;
    verifiedAppBindings: number;
    verifiedServiceBindings: number;
    activeCreatorAccounts: number;
    totalCreatorAccounts: number;
    verifiedCreatorAccounts: number;
    submittedItems: number;
    moderatedItems: number;
    totalMarketplaceAssets: number;
    activeMarketplaceAssets: number;
    verifiedAssetItems: number;
  };
  sections: Array<{
    itemCount: number;
    itemType: "app" | "plugin" | "service" | "template" | "theme";
    name: "App Marketplace" | "Plugin Marketplace" | "Service Marketplace" | "Template Marketplace" | "Theme Marketplace";
    status: "placeholder" | "ready";
  }>;
};

export type AdminPlatformMarketingControl = {
  runtimeWarning?: string | null;
  campaigns: Array<{
    audienceBadgeTone: "amber" | "blue" | "green" | "red";
    audienceDescription: string;
    audienceKey:
      | "admins"
      | "affiliates"
      | "all_users"
      | "creators"
      | "existing_users"
      | "new_users"
      | "resellers"
      | "store_owners"
      | null;
    audienceLabel: string;
    endDate: string | null;
    id: string;
    lifecycleActions: Array<{
      action: "activate" | "archive" | "create_draft" | "pause" | "view_usage";
      description: string;
      foundationOnly: true;
      label: string;
      ready: boolean;
    }>;
    lifecycleDescription: string;
    lifecycleLabel: string;
    lifecycleState: "active" | "archived" | "draft" | "expired" | "paused";
    name: string;
    revenueImpact: number;
    section: "Affiliate program" | "Campaigns" | "Gift codes" | "Platform coupons" | "Platform promotions" | "Referral program";
    startDate: string | null;
    status: "active" | "archived" | "draft" | "expired" | "paused";
    statusBadgeTone: "amber" | "blue" | "green" | "red";
    statusDescription: string;
    statusLabel: string;
    targetAudience: string;
    targetAudienceSummary: string;
    type: "affiliate" | "campaign" | "coupon" | "gift_code" | "promotion" | "referral";
    typeBadgeTone: "amber" | "blue" | "green" | "red";
    typeDescription: string;
    typeLabel: string;
    usage: number;
  }>;
  coupons: Array<{
    amount: string;
    code: string;
    couponDescription: string;
    couponLabel: string;
    description: string;
    discountType: "fixed" | "percentage" | "plan_credit";
    metadataSummary: string;
    name: string;
    planEligibility: string;
    registryKey: string;
    revenueImpact: number;
    slug: string;
    status: "active" | "archived" | "draft" | "expired" | "paused";
    statusBadgeTone: "amber" | "blue" | "green" | "red";
    statusDescription: string;
    statusLabel: string;
    targetAudienceSummary: string;
    usageCount: number;
    usageLimit: string;
    validationBadgeTone: "amber" | "blue" | "green" | "red";
    validationDescription: string;
    validationIssues: Array<{
      code: string;
      message: string;
      severity: "error" | "warning";
    }>;
    validationLabel: string;
    validationReady: boolean;
    validationState: "invalid" | "needs_review" | "valid";
    eligibilityBadgeTone: "amber" | "blue" | "green" | "red";
    eligibilityDescription: string;
    eligibilityIssues: Array<{
      code: string;
      message: string;
      severity: "blocker" | "review";
    }>;
    eligibilityLabel: string;
    eligibilityReady: boolean;
    eligibilityState: "eligible" | "needs_review" | "not_eligible" | "unknown";
    usageSummary: string;
    usageTrackingBadgeTone: "amber" | "blue" | "green" | "red";
    usageTrackingDescription: string;
    usageTrackingLabel: string;
    usageTrackingSource: "fallback" | "registry" | "summary_table";
    usageTrackingState: "placeholder" | "tracked" | "unknown" | "untracked";
  }>;
  promotions: Array<{
    description: string;
    incentiveLabel: string;
    incentiveType: "fixed" | "percentage" | "plan_credit" | "upgrade_offer";
    lifecycleDescription: string;
    lifecycleLabel: string;
    lifecycleState: "active" | "archived" | "draft" | "expired" | "paused";
    metadataSummary: string;
    name: string;
    planScope: string;
    promotionDescription: string;
    promotionLabel: string;
    registryKey: string;
    audienceBadgeTone: "amber" | "blue" | "green" | "red";
    audienceDescription: string;
    audienceKey:
      | "admins"
      | "affiliates"
      | "all_users"
      | "creators"
      | "existing_users"
      | "new_users"
      | "resellers"
      | "store_owners"
      | null;
    audienceLabel: string;
    promotionAudienceDescription: string;
    promotionAudienceLabel: string;
    promotionAudienceReadinessState: "classified" | "custom" | "unclassified" | "unknown";
    revenueImpact: number;
    slug: string;
    status: "active" | "archived" | "draft" | "expired" | "paused";
    statusBadgeTone: "amber" | "blue" | "green" | "red";
    statusDescription: string;
    statusLabel: string;
    targetAudienceSummary: string;
    usageCount: number;
    endsAt: string | null;
    scheduleBadgeTone: "amber" | "blue" | "green" | "red";
    scheduleDescription: string;
    scheduleLabel: string;
    scheduleState: "ended" | "invalid_schedule" | "live" | "scheduled" | "unknown" | "unscheduled";
    startsAt: string | null;
    timezoneDisplay: string | null;
  }>;
  futureHooks: string[];
  giftCodes: Array<{
    audienceBadgeTone: "amber" | "blue" | "green" | "red";
    audienceDescription: string;
    audienceKey:
      | "admins"
      | "affiliates"
      | "all_users"
      | "creators"
      | "existing_users"
      | "new_users"
      | "resellers"
      | "store_owners"
      | null;
    audienceLabel: string;
    code: string;
    creditAmount: number;
    creditAmountDisplay: string;
    creditGrantingStatus: string;
    creditLabel: string;
    creditReadinessBadgeTone: "amber" | "blue" | "green" | "red";
    creditReadinessDescription: string;
    creditReadinessLabel: string;
    creditReadinessReady: boolean;
    creditReadinessState:
      | "already_used"
      | "expired"
      | "needs_review"
      | "not_ready"
      | "paused"
      | "ready"
      | "unknown";
    creditType: "fixed_credit" | "platform_credit" | "subscription_credit";
    creditTypeLabel: string;
    creditUnitDisplay: string;
    description: string;
    giftCodeDescription: string;
    giftCodeLabel: string;
    lifecycleDescription: string;
    lifecycleLabel: string;
    lifecycleState: "active" | "archived" | "draft" | "expired" | "paused";
    metadataSummary: string;
    name: string;
    planCredit: string;
    redemptionBadgeTone: "amber" | "blue" | "green" | "red";
    redemptionDescription: string;
    redemptionEngineStatus: string;
    redemptionLabel: string;
    redemptionReady: boolean;
    redemptionState:
      | "already_used"
      | "expired"
      | "needs_review"
      | "not_redeemable"
      | "paused"
      | "redeemable"
      | "unknown";
    redemptionReadinessLabel: string;
    redemptionStatus: string;
    registryKey: string;
    revenueImpact: number;
    slug: string;
    status: "active" | "archived" | "draft" | "expired" | "paused";
    statusBadgeTone: "amber" | "blue" | "green" | "red";
    statusDescription: string;
    statusLabel: string;
    targetAudienceSummary: string;
    usageCount: number;
  }>;
  overview: {
    activeSections: number;
    archivedSections: number;
    draftSections: number;
    expiredSections: number;
    pausedSections: number;
    totalSections: number;
  };
  couponAnalytics: {
    activeCouponItems: number;
    analyticsDescription: string;
    analyticsReady: boolean;
    archivedCouponItems: number;
    averageUsageCount: number;
    draftCouponItems: number;
    expiredCouponItems: number;
    highUsageCouponCount: number;
    needsReviewCouponCount: number;
    pausedCouponItems: number;
    totalCouponItems: number;
    totalUsageCount: number;
  };
  campaignAnalytics: {
    activeCampaignItems: number;
    analyticsDescription: string;
    analyticsReady: boolean;
    archivedCampaignItems: number;
    averageUsageCount: number;
    draftCampaignItems: number;
    emailReadyCampaignCount: number;
    expiredCampaignItems: number;
    invalidCampaignCount: number;
    needsReviewCampaignCount: number;
    notificationReadyCampaignCount: number;
    pausedCampaignItems: number;
    totalCampaignItems: number;
    totalRevenueImpact: number;
    totalUsageCount: number;
  };
  promotionMetrics: {
    activePromotionItems: number;
    archivedPromotionItems: number;
    averageUsageCount: number;
    draftPromotionItems: number;
    endedPromotionItems: number;
    expiredPromotionItems: number;
    invalidSchedulePromotionItems: number;
    livePromotionItems: number;
    metricsDescription: string;
    metricsReady: boolean;
    needsReviewPromotionCount: number;
    pausedPromotionItems: number;
    scheduledPromotionItems: number;
    totalPromotionItems: number;
    totalRevenueImpact: number;
    totalUsageCount: number;
  };
  marketingAudit: {
    auditBadgeTone: "amber" | "blue" | "green" | "red";
    auditDescription: string;
    auditLabel: string;
    auditReady: boolean;
    auditState: "audit_ready" | "incomplete" | "invalid" | "needs_review" | "unknown";
    auditSummary: string;
    invalidItemCount: number;
    lastUpdatedDisplay: string | null;
    missingRequiredRuntimeFieldsCount: number;
    needsReviewCount: number;
    reviewedStatus: string;
    riskyMetadataCount: number;
    totalMarketingItems: number;
  };
  marketingSecurityCertification: {
    certificationDescription: string;
    certifiedAt: string;
    failedChecks: number;
    passedChecks: number;
    securityReview: Array<{
      category: string;
      message: string;
      passed: boolean;
    }>;
    securityReviewPassed: boolean;
    totalChecks: number;
  };
  marketingProductionCertification: {
    certificationDescription: string;
    certifiedAt: string;
    conversionComplete: boolean;
    failedChecks: number;
    passedChecks: number;
    productionReady: boolean;
    productionReview: Array<{
      category: string;
      message: string;
      passed: boolean;
    }>;
    supportedStatuses: readonly ("active" | "archived" | "draft" | "expired" | "paused")[];
    supportedTypes: readonly ("affiliate" | "campaign" | "coupon" | "gift_code" | "promotion" | "referral")[];
    totalChecks: number;
  };
  platformCampaigns: Array<{
    audienceBadgeTone: "amber" | "blue" | "green" | "red";
    audienceDescription: string;
    audienceKey:
      | "admins"
      | "affiliates"
      | "all_users"
      | "creators"
      | "existing_users"
      | "new_users"
      | "resellers"
      | "store_owners"
      | null;
    audienceLabel: string;
    campaignBadgeTone: "amber" | "blue" | "green" | "red";
    campaignDescription: string;
    campaignEngineStatus: string;
    campaignLabel: string;
    campaignProgramType: "newsletter" | "onboarding_sequence" | "platform_announcement" | "product_update";
    campaignState: "campaign_disabled" | "campaign_ready" | "invalid" | "needs_review" | "unknown";
    campaignSummary: string;
    campaignTypeLabel: string;
    code: string;
    deliveryStatus: string;
    description: string;
    emailBadgeTone: "amber" | "blue" | "green" | "red";
    emailDescription: string;
    emailEngineStatus: string;
    emailLabel: string;
    emailReady: boolean;
    emailState: "email_disabled" | "email_ready" | "invalid" | "needs_review" | "unknown";
    emailSubjectLabel: string;
    emailSummary: string;
    emailTemplateLabel: string;
    endDateDisplay: string | null;
    lifecycleDescription: string;
    lifecycleLabel: string;
    lifecycleState: "active" | "archived" | "draft" | "expired" | "paused";
    massSendBadgeTone: "amber" | "blue" | "green" | "red";
    massSendDescription: string;
    massSendLabel: string;
    massSendReady: boolean;
    massSendState: "invalid" | "mass_send_disabled" | "mass_send_ready" | "needs_review" | "unknown";
    metadataSummary: string;
    name: string;
    notificationBadgeTone: "amber" | "blue" | "green" | "red";
    notificationChannelLabel: string;
    notificationDescription: string;
    notificationEngineStatus: string;
    notificationLabel: string;
    notificationReady: boolean;
    notificationState: "invalid" | "needs_review" | "notification_disabled" | "notification_ready" | "unknown";
    notificationSummary: string;
    notificationTemplateLabel: string;
    registryKey: string;
    revenueImpact: number;
    slug: string;
    senderLabel: string;
    startDateDisplay: string | null;
    status: "active" | "archived" | "draft" | "expired" | "paused";
    statusBadgeTone: "amber" | "blue" | "green" | "red";
    statusDescription: string;
    statusLabel: string;
    targetAudienceSummary: string;
    usageCount: number;
  }>;
  referralAffiliates: Array<{
    commission: number;
    payoutStatus: string;
    referredUsers: number;
    referrer: string;
    status: "active" | "archived" | "draft" | "expired" | "paused";
    type: "affiliate" | "referral";
  }>;
  affiliates: Array<{
    affiliateDescription: string;
    affiliateLabel: string;
    affiliateProgramType: "agency_partner" | "creator_partner" | "platform_partner";
    audienceBadgeTone: "amber" | "blue" | "green" | "red";
    audienceDescription: string;
    audienceKey:
      | "admins"
      | "affiliates"
      | "all_users"
      | "creators"
      | "existing_users"
      | "new_users"
      | "resellers"
      | "store_owners"
      | null;
    audienceLabel: string;
    code: string;
    commissionBadgeTone: "amber" | "blue" | "green" | "red";
    commissionDescription: string;
    commissionDisplay: string;
    commissionEngineStatus: string;
    commissionLabel: string;
    commissionModelLabel: string;
    commissionRateDisplay: string;
    commissionReady: boolean;
    commissionState: "commission_disabled" | "commission_ready" | "invalid" | "needs_review" | "unknown";
    commissionSummary: string;
    description: string;
    estimatedCommissionDisplay: string;
    lifecycleDescription: string;
    lifecycleLabel: string;
    lifecycleState: "active" | "archived" | "draft" | "expired" | "paused";
    metadataSummary: string;
    name: string;
    payoutStatus: string;
    registryKey: string;
    revenueImpact: number;
    slug: string;
    status: "active" | "archived" | "draft" | "expired" | "paused";
    statusBadgeTone: "amber" | "blue" | "green" | "red";
    statusDescription: string;
    statusLabel: string;
    targetAudienceSummary: string;
    trackedConversionsCount: number;
    trackedSignupsCount: number;
    trackedVisitsCount: number;
    trackingBadgeTone: "amber" | "blue" | "green" | "red";
    trackingDescription: string;
    trackingEngineStatus: string;
    trackingLabel: string;
    trackingReady: boolean;
    trackingState: "invalid" | "needs_review" | "tracking_disabled" | "tracking_ready" | "unknown";
    trackingStatus: string;
    trackingSummary: string;
    usageCount: number;
  }>;
  referrals: Array<{
    audienceBadgeTone: "amber" | "blue" | "green" | "red";
    audienceDescription: string;
    audienceKey:
      | "admins"
      | "affiliates"
      | "all_users"
      | "creators"
      | "existing_users"
      | "new_users"
      | "resellers"
      | "store_owners"
      | null;
    audienceLabel: string;
    code: string;
    commissionBadgeTone: "amber" | "blue" | "green" | "red";
    commissionDescription: string;
    commissionDisplay: string;
    commissionEngineStatus: string;
    commissionLabel: string;
    commissionModelLabel: string;
    commissionRateDisplay: string;
    commissionReady: boolean;
    commissionState: "commission_disabled" | "commission_ready" | "invalid" | "needs_review" | "unknown";
    commissionSummary: string;
    description: string;
    estimatedCommissionDisplay: string;
    lifecycleDescription: string;
    lifecycleLabel: string;
    lifecycleState: "active" | "archived" | "draft" | "expired" | "paused";
    metadataSummary: string;
    name: string;
    payoutStatus: string;
    referralDescription: string;
    referralLabel: string;
    referralProgramType: "owner_invite" | "partner_invite" | "platform_invite";
    registryKey: string;
    revenueImpact: number;
    slug: string;
    status: "active" | "archived" | "draft" | "expired" | "paused";
    statusBadgeTone: "amber" | "blue" | "green" | "red";
    statusDescription: string;
    statusLabel: string;
    targetAudienceSummary: string;
    trackedConversionsCount: number;
    trackedSignupsCount: number;
    trackedVisitsCount: number;
    trackingBadgeTone: "amber" | "blue" | "green" | "red";
    trackingDescription: string;
    trackingEngineStatus: string;
    trackingLabel: string;
    trackingReady: boolean;
    trackingState: "invalid" | "needs_review" | "tracking_disabled" | "tracking_ready" | "unknown";
    trackingStatus: string;
    trackingSummary: string;
    usageCount: number;
  }>;
};

export type AdminEmailControl = {
  campaignMonitoring: Array<{
    lastActivity: string | null;
    name: string;
    note: string;
    status: "monitoring" | "placeholder";
    total: number;
  }>;
  emailCampaignEmails: Array<{
    campaignEmailLabel: string;
    campaignScopeLabel: string;
    metadataSummary: string;
    providerKey: "future" | "resend" | "smtp" | null;
    readinessState:
      | "campaign_ready"
      | "disabled"
      | "draft"
      | "invalid"
      | "missing_provider"
      | "missing_template"
      | "needs_review"
      | "unknown";
    readinessStateLabel: string;
    templateKey: string;
  }>;
  emailCampaignEmailStats: {
    campaignReadyCampaignEmails: number;
    disabledCampaignEmails: number;
    draftCampaignEmails: number;
    invalidCampaignEmails: number;
    missingProviderCampaignEmails: number;
    missingTemplateCampaignEmails: number;
    needsReviewCampaignEmails: number;
    totalCampaignEmails: number;
    unknownCampaignEmails: number;
  };
  emailCampaignQueueRuntimeSummary: {
    campaignCancelledCount: number;
    campaignFailedCount: number;
    campaignQueuedCount: number;
    campaignRetryPendingCount: number;
    campaignSentCount: number;
    lastActivityLabel: string;
    metadataSummary: string;
    pausedCount: number;
    processingCount: number;
    queueReadinessState:
      | "cancelled"
      | "failed"
      | "needs_review"
      | "paused"
      | "processing"
      | "queue_ready"
      | "queued"
      | "retry_pending"
      | "sent"
      | "unknown";
    queueReadinessStateLabel: string;
    totalCount: number;
    unknownCount: number;
  };
  emailCampaignQueueRuntimeStats: {
    cancelledCampaignQueueItems: number;
    failedCampaignQueueItems: number;
    needsReviewCampaignQueueItems: number;
    pausedCampaignQueueItems: number;
    processingCampaignQueueItems: number;
    queueReadyCampaignQueueItems: number;
    queuedCampaignQueueItems: number;
    retryPendingCampaignQueueItems: number;
    sentCampaignQueueItems: number;
    totalCampaignQueueItems: number;
    unknownCampaignQueueItems: number;
  };
  emailCampaignQueueScopeRecords: Array<{
    campaignScopeLabel: string;
    campaignScopeSlug: string;
    cancelledCount: number;
    failedCount: number;
    lastActivityLabel: string;
    metadataSummary: string;
    pausedCount: number;
    processingCount: number;
    queuedCount: number;
    queueReadinessState:
      | "cancelled"
      | "failed"
      | "needs_review"
      | "paused"
      | "processing"
      | "queue_ready"
      | "queued"
      | "retry_pending"
      | "sent"
      | "unknown";
    queueReadinessStateLabel: string;
    retryPendingCount: number;
    sentCount: number;
  }>;
  emailCampaignMonitoringRuntimeSummary: {
    campaignAnalyticsHookReserved: boolean;
    campaignHealthState:
      | "degraded"
      | "failed"
      | "healthy"
      | "monitoring"
      | "needs_review"
      | "paused"
      | "unknown"
      | "warning";
    campaignHealthStateLabel: string;
    deliverySummaryState: string;
    deliverySummaryStateLabel: string;
    exportEmailLogsHookReserved: boolean;
    failureSummaryState: string;
    failureSummaryStateLabel: string;
    lastActivityLabel: string;
    metadataSummary: string;
    monitoringReadinessState:
      | "degraded"
      | "failed"
      | "healthy"
      | "monitoring"
      | "needs_review"
      | "paused"
      | "unknown"
      | "warning";
    monitoringReadinessStateLabel: string;
    queueHealthState:
      | "degraded"
      | "failed"
      | "healthy"
      | "monitoring"
      | "needs_review"
      | "paused"
      | "unknown"
      | "warning";
    queueHealthStateLabel: string;
  };
  emailCampaignMonitoringRuntimeStats: {
    degradedMonitoringItems: number;
    failedMonitoringItems: number;
    healthyMonitoringItems: number;
    monitoringMonitoringItems: number;
    needsReviewMonitoringItems: number;
    pausedMonitoringItems: number;
    totalMonitoringItems: number;
    unknownMonitoringItems: number;
    warningMonitoringItems: number;
  };
  emailCampaignMonitoringScopeRecords: Array<{
    campaignHealthState:
      | "degraded"
      | "failed"
      | "healthy"
      | "monitoring"
      | "needs_review"
      | "paused"
      | "unknown"
      | "warning";
    campaignHealthStateLabel: string;
    campaignScopeLabel: string;
    campaignScopeSlug: string;
    deliverySummaryState: string;
    deliverySummaryStateLabel: string;
    failureSummaryState: string;
    failureSummaryStateLabel: string;
    lastActivityLabel: string;
    metadataSummary: string;
    monitoringReadinessState:
      | "degraded"
      | "failed"
      | "healthy"
      | "monitoring"
      | "needs_review"
      | "paused"
      | "unknown"
      | "warning";
    monitoringReadinessStateLabel: string;
    queueHealthState:
      | "degraded"
      | "failed"
      | "healthy"
      | "monitoring"
      | "needs_review"
      | "paused"
      | "unknown"
      | "warning";
    queueHealthStateLabel: string;
  }>;
  emailAnalyticsRuntimeSummary: {
    activeTemplatesCount: number;
    campaignReadinessCount: number;
    cancelledCount: number;
    failedCount: number;
    metadataSummary: string;
    monitoringHealthSummary: string;
    needsReviewCount: number;
    providersConfiguredCount: number;
    queuedCount: number;
    retryPendingCount: number;
    sentCount: number;
    templatesCount: number;
  };
  emailAnalyticsRuntimeStats: {
    activeTemplatesAnalyticsItems: number;
    campaignReadyAnalyticsItems: number;
    cancelledAnalyticsItems: number;
    failedAnalyticsItems: number;
    needsReviewAnalyticsItems: number;
    providersConfiguredAnalyticsItems: number;
    queuedAnalyticsItems: number;
    retryPendingAnalyticsItems: number;
    sentAnalyticsItems: number;
    templatesAnalyticsItems: number;
    totalQueueAnalyticsItems: number;
  };
  emailAuditRuntimeSummary: {
    auditState:
      | "audit_ready"
      | "incomplete"
      | "invalid"
      | "missing_required_fields"
      | "needs_review"
      | "risky_metadata"
      | "unknown";
    auditStateLabel: string;
    invalidItemCount: number;
    lastUpdatedLabel: string;
    metadataSummary: string;
    missingRequiredRuntimeFieldsCount: number;
    needsReviewCount: number;
    riskyMetadataCount: number;
  };
  emailAuditRuntimeStats: {
    auditReadyAuditItems: number;
    incompleteAuditItems: number;
    invalidAuditItems: number;
    missingRequiredFieldsAuditItems: number;
    needsReviewAuditItems: number;
    riskyMetadataAuditItems: number;
    totalAuditItems: number;
    unknownAuditItems: number;
  };
  emailSecurityCertification: {
    certificationDescription: string;
    certifiedAt: string;
    failedChecks: number;
    passedChecks: number;
    securityReview: Array<{
      category: string;
      message: string;
      passed: boolean;
    }>;
    securityReviewPassed: boolean;
    totalChecks: number;
  };
  emailProductionHardening: {
    conversionComplete: boolean;
    failedChecks: number;
    hardenedAt: string;
    hardeningDescription: string;
    hardeningPassed: boolean;
    hardeningReview: Array<{
      category: string;
      message: string;
      passed: boolean;
    }>;
    passedChecks: number;
    productionStable: boolean;
    totalChecks: number;
  };
  emailProductionCertification: {
    certificationDescription: string;
    certifiedAt: string;
    conversionComplete: boolean;
    failedChecks: number;
    passedChecks: number;
    productionCertified: boolean;
    productionReview: Array<{
      category: string;
      message: string;
      passed: boolean;
    }>;
    productionReady: boolean;
    totalChecks: number;
  };
  failedEmails: Array<{
    createdAt: string;
    emailType: string;
    errorSummary: string;
    id: string;
    recipientMasked: string;
  }>;
  emailTypeStats: {
    campaignScopeItems: number;
    futureHookItems: number;
    providerItems: number;
    queueSummaryItems: number;
    templateItems: number;
    totalItems: number;
    transactionalSectionItems: number;
  };
  emailStatusStats: {
    activeItems: number;
    configuredItems: number;
    disabledItems: number;
    draftItems: number;
    failedItems: number;
    healthyItems: number;
    missingItems: number;
    monitoringItems: number;
    placeholderItems: number;
    reservedPlaceholderItems: number;
    totalItems: number;
    unknownItems: number;
  };
  emailTemplateRegistry: Array<{
    category: "billing" | "domain_email_setup" | "order" | "security" | "support" | "welcome";
    categoryLabel: string;
    description: string;
    id: string;
    language: "Arabic" | "English" | "French";
    lastUpdated: string | null;
    metadataSummary: string;
    name: string;
    providerKey: "future" | "resend" | "smtp" | null;
    registryKey: string;
    registryStatusLabel: string;
    slug: string;
    status: "active" | "disabled" | "draft";
    templateKey: string;
    usageCount: number;
  }>;
  emailTemplateRegistryStats: {
    activeTemplates: number;
    billingTemplates: number;
    disabledTemplates: number;
    domainEmailSetupTemplates: number;
    draftTemplates: number;
    orderTemplates: number;
    securityTemplates: number;
    supportTemplates: number;
    totalTemplates: number;
    welcomeTemplates: number;
  };
  emailTemplateCategoryStats: {
    billingTemplates: number;
    campaignTemplates: number;
    domainEmailSetupTemplates: number;
    orderTemplates: number;
    placeholderTemplates: number;
    securityTemplates: number;
    supportTemplates: number;
    systemTemplates: number;
    totalTemplates: number;
    unknownTemplates: number;
    welcomeTemplates: number;
  };
  emailTemplateCategoryGroups: Array<{
    category: "billing" | "domain_email_setup" | "order" | "security" | "support" | "welcome";
    categoryLabel: string;
    description: string;
    templateCount: number;
  }>;
  emailTemplateVersionRecords: Array<{
    currentVersionLabel: string | null;
    draftVersionLabel: string | null;
    lastUpdatedLabel: string;
    metadataSummary: string;
    publishedVersionLabel: string | null;
    templateKey: string;
    versionState:
      | "draft_available"
      | "invalid"
      | "needs_review"
      | "published"
      | "unknown"
      | "unversioned"
      | "versioned";
    versionStateLabel: string;
  }>;
  emailTemplateVersionStats: {
    draftAvailableTemplates: number;
    invalidTemplates: number;
    needsReviewTemplates: number;
    publishedTemplates: number;
    totalTemplates: number;
    unknownTemplates: number;
    unversionedTemplates: number;
    versionedTemplates: number;
  };
  emailTemplatePreviewRecords: Array<{
    bodyPreviewSummary: string | null;
    metadataSummary: string;
    previewLabel: string;
    previewState:
      | "invalid"
      | "needs_review"
      | "placeholder"
      | "preview_ready"
      | "preview_unavailable"
      | "unknown";
    previewStateLabel: string;
    subjectPreview: string | null;
    templateKey: string;
    variablePlaceholdersSummary: string | null;
  }>;
  emailTemplatePreviewStats: {
    invalidTemplates: number;
    needsReviewTemplates: number;
    placeholderTemplates: number;
    previewReadyTemplates: number;
    previewUnavailableTemplates: number;
    totalTemplates: number;
    unknownTemplates: number;
  };
  emailTemplateValidationRecords: Array<{
    issueLabels: string[];
    metadataSummary: string;
    templateKey: string;
    validationState:
      | "invalid"
      | "missing_body"
      | "missing_subject"
      | "missing_variables"
      | "needs_review"
      | "placeholder"
      | "unsafe_content"
      | "unknown"
      | "valid";
    validationStateLabel: string;
    validationSummary: string;
  }>;
  emailTemplateValidationStats: {
    invalidTemplates: number;
    missingBodyTemplates: number;
    missingSubjectTemplates: number;
    missingVariablesTemplates: number;
    needsReviewTemplates: number;
    placeholderTemplates: number;
    totalTemplates: number;
    unknownTemplates: number;
    unsafeContentTemplates: number;
    validTemplates: number;
  };
  emailWelcomeEmails: Array<{
    metadataSummary: string;
    name: string;
    previewState:
      | "invalid"
      | "needs_review"
      | "placeholder"
      | "preview_ready"
      | "preview_unavailable"
      | "unknown";
    previewStateLabel: string;
    providerKey: "future" | "resend" | "smtp" | null;
    readinessState:
      | "draft"
      | "invalid"
      | "missing_provider"
      | "missing_template"
      | "needs_review"
      | "placeholder"
      | "ready"
      | "unknown";
    readinessStateLabel: string;
    status: "active" | "disabled" | "draft";
    templateCategory: "welcome";
    templateKey: string;
    validationState:
      | "invalid"
      | "missing_body"
      | "missing_subject"
      | "missing_variables"
      | "needs_review"
      | "placeholder"
      | "unsafe_content"
      | "unknown"
      | "valid";
    validationStateLabel: string;
    versionState:
      | "draft_available"
      | "invalid"
      | "needs_review"
      | "published"
      | "unknown"
      | "unversioned"
      | "versioned";
    versionStateLabel: string;
  }>;
  emailWelcomeEmailStats: {
    draftWelcomeEmails: number;
    invalidWelcomeEmails: number;
    missingProviderWelcomeEmails: number;
    missingTemplateWelcomeEmails: number;
    needsReviewWelcomeEmails: number;
    placeholderWelcomeEmails: number;
    readyWelcomeEmails: number;
    totalWelcomeEmails: number;
    unknownWelcomeEmails: number;
  };
  emailBillingEmails: Array<{
    metadataSummary: string;
    name: string;
    previewState:
      | "invalid"
      | "needs_review"
      | "placeholder"
      | "preview_ready"
      | "preview_unavailable"
      | "unknown";
    previewStateLabel: string;
    providerKey: "future" | "resend" | "smtp" | null;
    readinessState:
      | "active"
      | "draft"
      | "invalid"
      | "missing_provider"
      | "missing_template"
      | "needs_review"
      | "placeholder"
      | "ready"
      | "unknown";
    readinessStateLabel: string;
    status: "active" | "disabled" | "draft";
    templateCategory: "billing";
    templateKey: string;
    validationState:
      | "invalid"
      | "missing_body"
      | "missing_subject"
      | "missing_variables"
      | "needs_review"
      | "placeholder"
      | "unsafe_content"
      | "unknown"
      | "valid";
    validationStateLabel: string;
    versionState:
      | "draft_available"
      | "invalid"
      | "needs_review"
      | "published"
      | "unknown"
      | "unversioned"
      | "versioned";
    versionStateLabel: string;
  }>;
  emailBillingEmailStats: {
    activeBillingEmails: number;
    draftBillingEmails: number;
    invalidBillingEmails: number;
    missingProviderBillingEmails: number;
    missingTemplateBillingEmails: number;
    needsReviewBillingEmails: number;
    placeholderBillingEmails: number;
    readyBillingEmails: number;
    totalBillingEmails: number;
    unknownBillingEmails: number;
  };
  emailOrderEmails: Array<{
    metadataSummary: string;
    name: string;
    previewState:
      | "invalid"
      | "needs_review"
      | "placeholder"
      | "preview_ready"
      | "preview_unavailable"
      | "unknown";
    previewStateLabel: string;
    providerKey: "future" | "resend" | "smtp" | null;
    readinessState:
      | "active"
      | "draft"
      | "invalid"
      | "missing_provider"
      | "missing_template"
      | "needs_review"
      | "placeholder"
      | "ready"
      | "unknown";
    readinessStateLabel: string;
    status: "active" | "disabled" | "draft";
    templateCategory: "order";
    templateKey: string;
    validationState:
      | "invalid"
      | "missing_body"
      | "missing_subject"
      | "missing_variables"
      | "needs_review"
      | "placeholder"
      | "unsafe_content"
      | "unknown"
      | "valid";
    validationStateLabel: string;
    versionState:
      | "draft_available"
      | "invalid"
      | "needs_review"
      | "published"
      | "unknown"
      | "unversioned"
      | "versioned";
    versionStateLabel: string;
  }>;
  emailOrderEmailStats: {
    activeOrderEmails: number;
    draftOrderEmails: number;
    invalidOrderEmails: number;
    missingProviderOrderEmails: number;
    missingTemplateOrderEmails: number;
    needsReviewOrderEmails: number;
    placeholderOrderEmails: number;
    readyOrderEmails: number;
    totalOrderEmails: number;
    unknownOrderEmails: number;
  };
  emailDomainEmailSetupEmails: Array<{
    metadataSummary: string;
    name: string;
    previewState:
      | "invalid"
      | "needs_review"
      | "placeholder"
      | "preview_ready"
      | "preview_unavailable"
      | "unknown";
    previewStateLabel: string;
    providerKey: "future" | "resend" | "smtp" | null;
    readinessState:
      | "draft"
      | "invalid"
      | "missing_provider"
      | "missing_template"
      | "needs_review"
      | "placeholder"
      | "ready"
      | "unknown";
    readinessStateLabel: string;
    status: "active" | "disabled" | "draft";
    templateCategory: "domain_email_setup";
    templateKey: string;
    validationState:
      | "invalid"
      | "missing_body"
      | "missing_subject"
      | "missing_variables"
      | "needs_review"
      | "placeholder"
      | "unsafe_content"
      | "unknown"
      | "valid";
    validationStateLabel: string;
    versionState:
      | "draft_available"
      | "invalid"
      | "needs_review"
      | "published"
      | "unknown"
      | "unversioned"
      | "versioned";
    versionStateLabel: string;
  }>;
  emailDomainEmailSetupEmailStats: {
    draftDomainEmailSetupEmails: number;
    invalidDomainEmailSetupEmails: number;
    missingProviderDomainEmailSetupEmails: number;
    missingTemplateDomainEmailSetupEmails: number;
    needsReviewDomainEmailSetupEmails: number;
    placeholderDomainEmailSetupEmails: number;
    readyDomainEmailSetupEmails: number;
    totalDomainEmailSetupEmails: number;
    unknownDomainEmailSetupEmails: number;
  };
  emailSupportEmails: Array<{
    metadataSummary: string;
    name: string;
    previewState:
      | "invalid"
      | "needs_review"
      | "placeholder"
      | "preview_ready"
      | "preview_unavailable"
      | "unknown";
    previewStateLabel: string;
    providerKey: "future" | "resend" | "smtp" | null;
    readinessState:
      | "draft"
      | "invalid"
      | "missing_provider"
      | "missing_template"
      | "needs_review"
      | "placeholder"
      | "ready"
      | "unknown";
    readinessStateLabel: string;
    status: "active" | "disabled" | "draft";
    templateCategory: "support";
    templateKey: string;
    validationState:
      | "invalid"
      | "missing_body"
      | "missing_subject"
      | "missing_variables"
      | "needs_review"
      | "placeholder"
      | "unsafe_content"
      | "unknown"
      | "valid";
    validationStateLabel: string;
    versionState:
      | "draft_available"
      | "invalid"
      | "needs_review"
      | "published"
      | "unknown"
      | "unversioned"
      | "versioned";
    versionStateLabel: string;
  }>;
  emailSupportEmailStats: {
    draftSupportEmails: number;
    invalidSupportEmails: number;
    missingProviderSupportEmails: number;
    missingTemplateSupportEmails: number;
    needsReviewSupportEmails: number;
    placeholderSupportEmails: number;
    readySupportEmails: number;
    totalSupportEmails: number;
    unknownSupportEmails: number;
  };
  emailSecurityEmails: Array<{
    metadataSummary: string;
    name: string;
    previewState:
      | "invalid"
      | "needs_review"
      | "placeholder"
      | "preview_ready"
      | "preview_unavailable"
      | "unknown";
    previewStateLabel: string;
    providerKey: "future" | "resend" | "smtp" | null;
    readinessState:
      | "draft"
      | "invalid"
      | "missing_provider"
      | "missing_template"
      | "needs_review"
      | "placeholder"
      | "ready"
      | "unknown";
    readinessStateLabel: string;
    status: "active" | "disabled" | "draft";
    templateCategory: "security";
    templateKey: string;
    validationState:
      | "invalid"
      | "missing_body"
      | "missing_subject"
      | "missing_variables"
      | "needs_review"
      | "placeholder"
      | "unsafe_content"
      | "unknown"
      | "valid";
    validationStateLabel: string;
    versionState:
      | "draft_available"
      | "invalid"
      | "needs_review"
      | "published"
      | "unknown"
      | "unversioned"
      | "versioned";
    versionStateLabel: string;
  }>;
  emailSecurityEmailStats: {
    draftSecurityEmails: number;
    invalidSecurityEmails: number;
    missingProviderSecurityEmails: number;
    missingTemplateSecurityEmails: number;
    needsReviewSecurityEmails: number;
    placeholderSecurityEmails: number;
    readySecurityEmails: number;
    totalSecurityEmails: number;
    unknownSecurityEmails: number;
  };
  emailQueueRuntimeSummary: {
    cancelledCount: number;
    failedCount: number;
    lastActivityLabel: string;
    metadataSummary: string;
    pausedCount: number;
    processingCount: number;
    queuedCount: number;
    retryPendingCount: number;
    sentCount: number;
    totalCount: number;
    unknownCount: number;
  };
  emailQueueRuntimeStats: {
    cancelledQueueItems: number;
    failedQueueItems: number;
    pausedQueueItems: number;
    processingQueueItems: number;
    queuedQueueItems: number;
    retryPendingQueueItems: number;
    sentQueueItems: number;
    totalQueueItems: number;
    unknownQueueItems: number;
  };
  emailRetryRuntimeSummary: {
    failedCount: number;
    lastRetryLabel: string;
    metadataSummary: string;
    nextRetryLabel: string;
    retryAttemptsSummary: string;
    retryPendingCount: number;
    retryReadinessState:
      | "failed"
      | "not_retryable"
      | "retry_blocked"
      | "retry_exhausted"
      | "retry_pending"
      | "retry_ready"
      | "unknown";
    retryReadinessStateLabel: string;
  };
  emailRetryRuntimeStats: {
    failedRetryItems: number;
    notRetryableRetryItems: number;
    retryBlockedRetryItems: number;
    retryExhaustedRetryItems: number;
    retryPendingRetryItems: number;
    retryReadyRetryItems: number;
    unknownRetryItems: number;
  };
  emailFailureRuntimeRecords: Array<{
    errorCategoryLabel: string;
    failureState:
      | "failed"
      | "no_failures"
      | "provider_error"
      | "recipient_error"
      | "retry_exhausted"
      | "retry_pending"
      | "template_error"
      | "unknown";
    failureStateLabel: string;
    id: string;
    lastFailureLabel: string;
    metadataSummary: string;
    retryReadinessState:
      | "failed"
      | "not_retryable"
      | "retry_blocked"
      | "retry_exhausted"
      | "retry_pending"
      | "retry_ready"
      | "unknown";
    retryReadinessStateLabel: string;
    sanitizedErrorSummary: string;
    templateKey: string;
  }>;
  emailFailureRuntimeSummary: {
    errorCategoryLabel: string;
    failedCount: number;
    failureState:
      | "failed"
      | "no_failures"
      | "provider_error"
      | "recipient_error"
      | "retry_exhausted"
      | "retry_pending"
      | "template_error"
      | "unknown";
    failureStateLabel: string;
    lastFailureLabel: string;
    metadataSummary: string;
    retryReadinessState:
      | "failed"
      | "not_retryable"
      | "retry_blocked"
      | "retry_exhausted"
      | "retry_pending"
      | "retry_ready"
      | "unknown";
    retryReadinessStateLabel: string;
    sanitizedErrorSummary: string;
  };
  emailFailureRuntimeStats: {
    failedFailureItems: number;
    noFailuresItems: number;
    providerErrorFailureItems: number;
    recipientErrorFailureItems: number;
    retryExhaustedFailureItems: number;
    retryPendingFailureItems: number;
    templateErrorFailureItems: number;
    unknownFailureItems: number;
  };
  emailDeliveryRuntimeSummary: {
    cancelledCount: number;
    deliveredCount: number;
    deliveryState:
      | "cancelled"
      | "delivered"
      | "failed"
      | "queued"
      | "retry_pending"
      | "sent"
      | "unknown";
    deliveryStateLabel: string;
    failedCount: number;
    lastDeliveryLabel: string;
    metadataSummary: string;
    queuedCount: number;
    retryPendingCount: number;
    sentCount: number;
  };
  emailDeliveryRuntimeStats: {
    cancelledDeliveryItems: number;
    deliveredDeliveryItems: number;
    failedDeliveryItems: number;
    queuedDeliveryItems: number;
    retryPendingDeliveryItems: number;
    sentDeliveryItems: number;
    unknownDeliveryItems: number;
  };
  emailProviderStats: {
    configuredProviders: number;
    futurePlaceholderProviders: number;
    healthyProviders: number;
    missingProviders: number;
    partialProviders: number;
    resendProviders: number;
    smtpPlaceholderProviders: number;
    totalProviders: number;
  };
  emailProviderHealth: Array<{
    configurationState: "configured" | "missing" | "partial";
    healthLabel: string;
    healthState:
      | "degraded"
      | "failed"
      | "healthy"
      | "missing_config"
      | "monitoring"
      | "not_configured"
      | "placeholder"
      | "unknown";
    lastCheckedLabel: string;
    metadataSummary: string;
    providerKey: "future" | "resend" | "smtp";
    providerLabel: string;
  }>;
  emailProviderHealthStats: {
    degradedProviders: number;
    failedProviders: number;
    healthyProviders: number;
    missingConfigProviders: number;
    monitoringProviders: number;
    notConfiguredProviders: number;
    placeholderProviders: number;
    totalProviders: number;
    unknownProviders: number;
  };
  emailProviderFailoverRecords: Array<{
    backupProviderLabel: string | null;
    failoverReadinessState:
      | "backup_available"
      | "disabled"
      | "failover_ready"
      | "needs_review"
      | "no_backup"
      | "primary_only"
      | "provider_unhealthy"
      | "unknown";
    failoverReadinessStateLabel: string;
    metadataSummary: string;
    primaryProviderLabel: string;
    providerHealthState:
      | "degraded"
      | "failed"
      | "healthy"
      | "missing_config"
      | "monitoring"
      | "not_configured"
      | "placeholder"
      | "unknown";
    providerHealthStateLabel: string;
    providerKey: "future" | "resend" | "smtp";
    providerLabel: string;
    providerRole: "backup" | "primary" | "reserved";
  }>;
  emailProviderFailoverRuntimeSummary: {
    backupProviderLabel: string | null;
    failoverReadinessState:
      | "backup_available"
      | "disabled"
      | "failover_ready"
      | "needs_review"
      | "no_backup"
      | "primary_only"
      | "provider_unhealthy"
      | "unknown";
    failoverReadinessStateLabel: string;
    metadataSummary: string;
    primaryProviderLabel: string;
    providerHealthState:
      | "degraded"
      | "failed"
      | "healthy"
      | "missing_config"
      | "monitoring"
      | "not_configured"
      | "placeholder"
      | "unknown";
    providerHealthStateLabel: string;
  };
  emailProviderFailoverRuntimeStats: {
    backupAvailableFailoverItems: number;
    disabledFailoverItems: number;
    failoverReadyFailoverItems: number;
    needsReviewFailoverItems: number;
    noBackupFailoverItems: number;
    primaryOnlyFailoverItems: number;
    providerUnhealthyFailoverItems: number;
    totalFailoverItems: number;
    unknownFailoverItems: number;
  };
  futureHooks: string[];
  overview: {
    activeTemplates: number;
    failedEmails: number;
    providersConfigured: number;
    queuedEmails: number;
    sentEmails: number;
    totalTemplates: number;
  };
  providers: Array<{
    configurationStatus: "configured" | "missing" | "partial";
    healthStatus: "healthy" | "missing_config" | "placeholder" | "warning";
    name: string;
    provider: "future" | "resend" | "smtp";
    secretStatus: "masked_configured" | "masked_partial" | "missing" | "no_secret_required";
  }>;
  queue: {
    cancelled: number;
    failed: number;
    queued: number;
    retryPending: number;
    sent: number;
  };
  runtimeWarning?: string | null;
  templates: Array<{
    category: "billing" | "domain_email_setup" | "order" | "security" | "support" | "welcome";
    id: string;
    language: "Arabic" | "English" | "French";
    lastUpdated: string | null;
    name: string;
    status: "active" | "disabled" | "draft";
  }>;
  transactionalSections: Array<{
    key: string;
    name: string;
    note: string;
    status: "active" | "draft" | "placeholder";
  }>;
};

export type AdminNotificationControl = {
  channels: Array<{
    channel: NotificationChannel;
    channelLabel: string;
    configuredStatus: "configured" | "missing" | "placeholder";
    description: string;
    healthStatus: "healthy" | "missing_config" | "placeholder" | "warning";
    placeholderOnly: boolean;
    runtimeState: "active" | "missing_config" | "placeholder";
    secretStatus: "masked_configured" | "masked_partial" | "missing" | "no_secret_required";
  }>;
  futureHooks: string[];
  logs: Array<{
    category: NotificationCategory;
    categoryLabel: string;
    channel: NotificationChannel;
    channelLabel: string;
    createdAt: string;
    errorSummary: string | null;
    id: string;
    recipientMasked: string;
    status: NotificationDeliveryStatus;
    statusLabel: string;
    providerKey: NotificationProviderKey;
    providerLabel: string;
    storeOrUser: string;
    templateKey: string;
    templateLabel: string;
    type: string;
    typeBadgeTone: "amber" | "blue" | "green" | "red";
    typeKey: NotificationType;
    typeLabel: string;
  }>;
  notificationCategoryStats: {
    accountItems: number;
    aiItems: number;
    billingItems: number;
    domainItems: number;
    emailItems: number;
    securityItems: number;
    storeItems: number;
    supportItems: number;
    systemItems: number;
    totalItems: number;
    transactionalItems: number;
    unknownItems: number;
  };
  notificationChannelStats: {
    emailItems: number;
    inAppItems: number;
    pushItems: number;
    smsItems: number;
    systemAlertItems: number;
    totalItems: number;
    unknownItems: number;
    whatsappItems: number;
  };
  notificationDeliveryStatusStats: {
    archivedItems: number;
    cancelledItems: number;
    deliveredItems: number;
    draftItems: number;
    failedItems: number;
    queuedItems: number;
    readItems: number;
    retryItems: number;
    sentItems: number;
    totalItems: number;
  };
  notificationDeliveryRuntimeStats: {
    archivedDeliveries: number;
    cancelledDeliveries: number;
    deliveredDeliveries: number;
    draftDeliveries: number;
    emailDeliveries: number;
    failedDeliveries: number;
    inAppDeliveries: number;
    placeholderChannelDeliveries: number;
    queuedDeliveries: number;
    readDeliveries: number;
    retryDeliveries: number;
    sentDeliveries: number;
    systemAlertDeliveries: number;
    totalDeliveries: number;
    unknownDeliveries: number;
  };
  deliveries: NotificationDeliveryRecord[];
  notificationQueueRuntimeStats: {
    emailQueueItems: number;
    failedItems: number;
    inAppQueueItems: number;
    placeholderChannelQueueItems: number;
    processingItems: number;
    queuedItems: number;
    retryPendingItems: number;
    sentItems: number;
    systemAlertQueueItems: number;
    totalQueueItems: number;
    unknownItems: number;
  };
  queueItems: NotificationQueueRecord[];
  notificationRetryRuntimeStats: {
    emailRetryItems: number;
    failedRetryItems: number;
    inAppRetryItems: number;
    placeholderChannelRetryItems: number;
    retryBlockedItems: number;
    retryExhaustedItems: number;
    retryPendingItems: number;
    retryReadyItems: number;
    systemAlertRetryItems: number;
    totalRetryItems: number;
    unknownRetryItems: number;
  };
  retryItems: NotificationRetryRecord[];
  notificationFailureRuntimeStats: {
    emailFailures: number;
    providerErrorFailures: number;
    recipientErrorFailures: number;
    retryExhaustedFailures: number;
    retryPendingFailures: number;
    reviewedFailures: number;
    systemAlertFailures: number;
    templateErrorFailures: number;
    totalFailures: number;
    unreviewedFailures: number;
    unknownFailures: number;
  };
  failureItems: NotificationFailureRecord[];
  notificationAuditRuntimeStats: {
    disableTemplateActions: number;
    markReviewedActions: number;
    platformActions: number;
    retryPlaceholderActions: number;
    superAdminActions: number;
    systemActions: number;
    totalAuditItems: number;
    unknownActions: number;
    viewDetailsActions: number;
  };
  auditItems: NotificationAuditRecord[];
  notificationMonitoringRuntimeStats: {
    degradedMonitors: number;
    failedMonitors: number;
    healthyMonitors: number;
    missingConfigMonitors: number;
    placeholderMonitors: number;
    totalFailureSignals: number;
    totalMonitors: number;
    unknownMonitors: number;
    warningMonitors: number;
  };
  monitoringItems: NotificationMonitoringRecord[];
  metrics: NotificationMetricsSnapshot;
  metricViews: NotificationMetricView[];
  analytics: NotificationAnalyticsSnapshot;
  analyticsBreakdownItems: NotificationAnalyticsBreakdownItem[];
  analyticsPeriodViews: NotificationAnalyticsPeriodView[];
  analyticsRateViews: NotificationAnalyticsRateView[];
  notificationAnalyticsRuntimeStats: NotificationAnalyticsRuntimeStats;
  health: NotificationHealthSnapshot;
  healthItems: NotificationHealthRecord[];
  notificationHealthRuntimeStats: NotificationHealthRuntimeStats;
  notificationSecurityCertification: NotificationSecurityCertificationSummary;
  notificationSecurityRuntimeStats: NotificationSecurityRuntimeStats;
  securityRecords: NotificationSecurityRecord[];
  recipientItems: NotificationRecipientRecord[];
  notificationRecipientRuntimeStats: NotificationRecipientRuntimeStats;
  eventItems: NotificationEventRecord[];
  notificationEventRuntimeStats: NotificationEventRuntimeStats;
  logItems: NotificationLogRecord[];
  notificationLogRuntimeStats: NotificationLogRuntimeStats;
  reviewItems: NotificationReviewRecord[];
  notificationReviewRuntimeStats: NotificationReviewRuntimeStats;
  safeActionItems: NotificationSafeActionRecord[];
  notificationSafeActionPolicy: NotificationSafeActionPolicySummary;
  notificationSafeActionRuntimeStats: NotificationSafeActionRuntimeStats;
  errorSanitizationItems: NotificationErrorSanitizationRecord[];
  notificationErrorSanitizationSummary: NotificationErrorSanitizationSummary;
  notificationErrorSanitizationRuntimeStats: NotificationErrorSanitizationRuntimeStats;
  providerAbstractionItems: NotificationProviderAbstractionRecord[];
  notificationProviderAbstractionSummary: NotificationProviderAbstractionSummary;
  notificationProviderAbstractionRuntimeStats: NotificationProviderAbstractionRuntimeStats;
  readOnlyProtectionItems: NotificationReadOnlyProtectionRecord[];
  notificationReadOnlyProtectionSummary: NotificationReadOnlyProtectionSummary;
  notificationReadOnlyProtectionRuntimeStats: NotificationReadOnlyProtectionRuntimeStats;
  notificationReadOnlyProtectionVerified: boolean;
  dataCertificationItems: NotificationDataCertificationRecord[];
  notificationDataCertificationSummary: NotificationDataCertificationSummary;
  notificationDataCertificationRuntimeStats: NotificationDataCertificationRuntimeStats;
  securityCertificationDomainItems: NotificationSecurityCertificationDomainRecord[];
  notificationSecurityCertificationDomainSummary: NotificationSecurityCertificationDomainSummary;
  notificationSecurityCertificationDomainRuntimeStats: NotificationSecurityCertificationDomainRuntimeStats;
  runtimeCertificationItems: NotificationRuntimeCertificationRecord[];
  notificationRuntimeCertificationSummary: NotificationRuntimeCertificationSummary;
  notificationRuntimeCertificationRuntimeStats: NotificationRuntimeCertificationRuntimeStats;
  notificationRuntimeCertificationVerified: boolean;
  productionCertificationItems: NotificationProductionCertificationRecord[];
  notificationProductionCertificationSummary: NotificationProductionCertificationSummary;
  notificationProductionCertificationRuntimeStats: NotificationProductionCertificationRuntimeStats;
  notificationProductionCertificationVerified: boolean;
  notificationsRuntimeConversionComplete: boolean;
  notificationRegistryCategoryStats: {
    accountItems: number;
    aiItems: number;
    billingItems: number;
    domainItems: number;
    emailItems: number;
    securityItems: number;
    storeItems: number;
    supportItems: number;
    systemItems: number;
    totalItems: number;
    transactionalItems: number;
    unknownItems: number;
  };
  notificationRegistryStatusStats: {
    configuredItems: number;
    failedItems: number;
    healthyItems: number;
    missingItems: number;
    placeholderItems: number;
    reservedPlaceholderItems: number;
    reviewedItems: number;
    totalItems: number;
    unknownItems: number;
    warningItems: number;
  };
  overview: {
    archived: number;
    cancelled: number;
    delivered: number;
    draft: number;
    failed: number;
    queued: number;
    reviewedFailures: number;
    retry: number;
    sent: number;
    totalNotifications: number;
  };
  providerStatus: Array<{
    configuredStatus: "configured" | "missing" | "partial" | "placeholder";
    description: string;
    healthStatus: "healthy" | "missing_config" | "placeholder" | "warning";
    metadataSummary: string;
    placeholderOnly: boolean;
    providerKey: NotificationProviderKey;
    providerLabel: string;
    providerType: "active" | "internal" | "placeholder";
    registryLabel: string;
    secretStatus: "masked_configured" | "masked_partial" | "missing" | "no_secret_required";
  }>;
  notificationProviderStats: {
    activeProviders: number;
    emailProviders: number;
    internalInAppProviders: number;
    placeholderProviders: number;
    pushPlaceholderProviders: number;
    smsPlaceholderProviders: number;
    systemAlertProviders: number;
    totalProviders: number;
    whatsappPlaceholderProviders: number;
  };
  notificationRegistryProviderStats: {
    activeProviders: number;
    emailProviders: number;
    internalInAppProviders: number;
    placeholderProviders: number;
    pushPlaceholderProviders: number;
    smsPlaceholderProviders: number;
    systemAlertProviders: number;
    totalProviders: number;
    whatsappPlaceholderProviders: number;
  };
  notificationTemplateStats: {
    disabledTemplates: number;
    emailTemplates: number;
    enabledTemplates: number;
    inAppTemplates: number;
    placeholderTemplates: number;
    previewReadyTemplates: number;
    systemTemplates: number;
    totalTemplates: number;
    unknownTemplates: number;
  };
  templates: NotificationTemplateView[];
  types: Array<{
    badgeTone: "amber" | "blue" | "green" | "red";
    count: number;
    description: string;
    key: NotificationType;
    label: string;
  }>;
  notificationTypeStats: {
    aiVisualsItems: number;
    billingItems: number;
    domainsItems: number;
    emailSetupItems: number;
    securityItems: number;
    storePublishingItems: number;
    supportItems: number;
    systemHealthItems: number;
    totalItems: number;
    unknownItems: number;
  };
  runtimeWarning: string | null;
};

export type AdminSEOControl = {
  analyticsReadiness: Array<{
    name: string;
    note: string;
    status: "configured" | "missing" | "placeholder";
  }>;
  futureHooks: string[];
  overview: {
    canonicalReady: number;
    indexedPagesPlaceholder: string;
    languageReady: number;
    missingMetaDescriptions: number;
    missingMetaTitles: number;
    robotsStatus: "ready" | "warning";
    sitemapStatus: "ready" | "warning";
    structuredDataStatus: "placeholder" | "ready";
  };
  pages: Array<{
    canonicalPath: string;
    canonicalStatus: "missing" | "ready";
    language: string;
    languageStatus: "placeholder" | "ready";
    lastUpdated: string | null;
    metaDescription: string;
    metaDescriptionStatus: "missing" | "ready";
    metaTitle: string;
    metaTitleStatus: "missing" | "ready";
    openGraphStatus: "placeholder" | "ready";
    openGraphTitle: string;
    page: string;
    slug: string;
  }>;
  robots: {
    allowedPaths: string[];
    blockedPaths: string[];
    environmentWarning: string;
    platformRouteCount: number;
    status: "ready" | "warning";
  };
  sitemap: {
    entryCount: number;
    excludedRoutes: string[];
    includedRoutes: string[];
    lastGenerated: string;
    status: "ready" | "warning";
  };
  structuredData: Array<{
    name: string;
    note: string;
    status: "placeholder" | "ready";
  }>;
};

export type AdminReportingControl = {
  categories: Array<{
    description: string;
    name:
      | "AI Reports"
      | "Domain & Email Reports"
      | "Marketplace Reports"
      | "Operations Reports"
      | "Payment Reports"
      | "Revenue Reports"
      | "Security Reports"
      | "Store Reports"
      | "Subscription Reports"
      | "User Reports";
    status: "ready" | "review" | "placeholder";
  }>;
  dateFilters: Array<{
    active: boolean;
    href: string;
    label: "Today" | "7 days" | "30 days" | "Month" | "Year";
    value: "today" | "7d" | "30d" | "month" | "year";
  }>;
  futureHooks: string[];
  overview: {
    activeStores: number;
    activeUsers: number;
    aiUsage: number;
    domainOrders: number;
    failedPayments: number;
    paidSubscriptions: number;
    securityEvents: number;
    supportTickets: number;
    totalRevenueEstimate: number;
  };
  reports: Array<{
    category: AdminReportingControl["categories"][number]["name"];
    exportPlaceholder: string;
    lastGenerated: string;
    name: string;
    reportId: string;
    status: "ready" | "review" | "placeholder";
    visibility: "internal" | "owner";
  }>;
  selectedRange: "today" | "7d" | "30d" | "month" | "year";
  sources: string[];
};

export type AdminAdvancedSecurityControl = {
  events: Array<{
    browser: string;
    createdAt: string;
    device: string;
    eventType: string;
    id: string;
    ipMasked: string;
    severity: "critical" | "high" | "low" | "medium";
    status: "blocked" | "failed" | "recorded" | "reviewed" | "watching";
    storeId: string | null;
    summary: string;
    userId: string | null;
  }>;
  futureHooks: string[];
  overview: {
    deniedAccessEvents: number;
    failedLogins: number;
    highRiskStores: number;
    highRiskUsers: number;
    rateLimitEvents: number;
    suspiciousEvents: number;
    totalLoginEvents: number;
  };
  riskScores: Array<{
    count: number;
    description: string;
    level: "critical" | "high" | "low" | "medium";
  }>;
  sections: Array<{
    name:
      | "Abuse Detection"
      | "Audit Logs"
      | "Device Monitoring"
      | "Fraud Detection"
      | "IP Monitoring"
      | "Login Monitoring"
      | "Rate Limits"
      | "Risk Score Engine";
    note: string;
    status: "monitoring" | "placeholder" | "review";
  }>;
};

export type AdminOperationsControl = {
  backupRecovery: Array<{
    name: string;
    note: string;
    status: "placeholder" | "ready" | "review";
  }>;
  cronJobs: Array<{
    lastRun: string | null;
    name: string;
    nextRun: string;
    schedule: string;
    status: "placeholder" | "ready" | "review";
  }>;
  databaseStorage: Array<{
    metric: string;
    note: string;
    status: "configured" | "missing" | "placeholder" | "ready" | "review";
    value: string;
  }>;
  futureHooks: string[];
  overview: {
    aiQueueHealth: "healthy" | "missing_config" | "needs_review" | "placeholder";
    cronHealth: "healthy" | "needs_review" | "placeholder";
    databaseHealth: "healthy" | "missing_config" | "needs_review";
    domainEmailQueueHealth: "healthy" | "needs_review" | "placeholder";
    emailQueueHealth: "healthy" | "missing_config" | "needs_review" | "placeholder";
    queueHealth: "healthy" | "needs_review" | "placeholder";
    storageHealth: "healthy" | "missing_config" | "needs_review" | "placeholder";
    workerHealth: "healthy" | "needs_review" | "placeholder";
  };
  queues: Array<{
    completed: number;
    failed: number;
    lastProcessed: string | null;
    name: string;
    pending: number;
    processing: number;
  }>;
  sections: Array<{
    name:
      | "Backups"
      | "Cron Jobs"
      | "Database Health"
      | "Disaster Recovery"
      | "Queues"
      | "Storage Health"
      | "System Monitoring"
      | "Workers";
    note: string;
    status: "monitoring" | "placeholder" | "review";
  }>;
  workers: Array<{
    failures: number;
    lastRun: string | null;
    name: string;
    nextRun: string;
    status: "idle" | "placeholder" | "running" | "warning";
  }>;
};

export type AdminInternalTeamControl = {
  accessSafety: Array<{
    name: string;
    note: string;
    status: "enforced" | "runtime";
  }>;
  invitations: Array<{
    acceptedAt: string | null;
    createdAt: string | null;
    email: string;
    emailStatus: string;
    expiresAt: string | null;
    id: string;
    invitedAt: string | null;
    lastSentAt: string | null;
    name: string;
    role: string;
    roleKey: string;
    status: "accepted" | "cancelled" | "expired" | "pending";
  }>;
  members: Array<{
    acceptedAt: string | null;
    assignedArea: string;
    createdAt: string | null;
    email: string;
    id: string;
    invitedAt: string | null;
    lastActiveAt: string | null;
    name: string;
    permissionsSummary: string;
    role: string;
    roleKey: string;
    status: "active" | "suspended";
    userId: string | null;
  }>;
  overview: {
    activeStaff: number;
    finalSuperAdminProtected: "enforced";
    pendingInvites: number;
    permissionGroups: number;
    roles: number;
    suspendedStaff: number;
  };
  permissionGroups: Array<{
    description: string;
    key: string;
    label: string;
  }>;
  roles: Array<{
    accessLevel: "full" | "limited" | "read_only" | "specialized";
    assignedArea: string;
    key: string;
    name: string;
    permissionsSummary: string;
  }>;
};

export type AdminPlatformSettingsControl = {
  currencies: Array<{
    code: "AED" | "EUR" | "MAD" | "SAR" | "USD";
    isDefault: boolean;
    name: string;
    status: "enabled" | "placeholder_disabled";
  }>;
  defaultLimits: Array<{
    description: string;
    key: string;
    value: string;
  }>;
  featureFlags: Array<{
    key: string;
    note: string;
    status: "placeholder";
  }>;
  futureHooks: string[];
  general: Array<{
    key: string;
    label: string;
    note: string;
    value: string;
  }>;
  languages: Array<{
    code: "ar" | "en" | "fr";
    direction: "LTR" | "RTL";
    name: string;
    readiness: "ready" | "placeholder";
  }>;
  legalPolicies: Array<{
    name: string;
    note: string;
    status: "placeholder" | "ready";
  }>;
  maintenanceModes: Array<{
    name: string;
    note: string;
    status: "off_placeholder";
    warning: string;
  }>;
  overview: {
    currencies: number;
    defaultCurrency: string;
    defaultLanguage: string;
    languages: number;
    maintenanceModes: number;
    sections: number;
    storeSettingsTouched: 0;
  };
  regionalSettings: Array<{
    key: string;
    label: string;
    value: string;
  }>;
  safety: Array<{
    name: string;
    note: string;
    status: "enforced";
  }>;
  sections: Array<{
    name:
      | "Currencies"
      | "Default limits"
      | "Feature flags placeholder"
      | "General settings"
      | "Languages"
      | "Legal/platform policies"
      | "Maintenance mode"
      | "Regional settings"
      | "Taxes"
      | "Timezones";
    note: string;
    status: "placeholder" | "ready";
  }>;
  taxes: Array<{
    key: string;
    label: string;
    note: string;
    value: string;
  }>;
  timezones: Array<{
    isDefault: boolean;
    label: string;
    value: string;
  }>;
};

type AdminLanding = {
  id: string;
  ownerEmail: string;
  title: string;
  status: string;
  template: string;
  publishedUrl: string | null;
  createdAt: string;
  ordersCount: number;
  viewsCount: number;
};

type AdminOrder = {
  id: string;
  ownerEmail: string;
  sourceType: string;
  customer: string;
  paymentMethod: string;
  status: string;
  total: number;
  currency: string;
  createdAt: string;
};

type AdminCustomer = {
  id: string;
  ownerEmail: string;
  name: string;
  phone: string | null;
  email: string | null;
  totalSpent: number;
  ordersCount: number;
};

type AdminSubscription = {
  subscriptionId: string;
  userId: string;
  email: string;
  plan: string;
  planId: string;
  status: string;
  billingProvider: string;
  billingCycle: string;
  billingReview: boolean;
  amount: number;
  currency: string;
  createdAt: string | null;
  currentPeriodEnd: string | null;
  currentPeriodStart: string | null;
  cancelAtPeriodEnd: boolean;
  cancellationDate: string | null;
  failedPayments: number;
  landingsUsed: number;
  landingLimit: string;
  manualOverrideActive: boolean;
  nextBillingDate: string | null;
  previousPlanId: string | null;
  providerSubscriptionId: string | null;
  providerUrl: string | null;
  renewalStatus: string;
  stores: Array<{
    id: string;
    name: string;
    slug: string | null;
    status: string;
    workspaceId: string | null;
  }>;
  workspaceIds: string[];
  storesUsed: number;
  storeLimit: string;
  domainsUsed: number;
  domainLimit: string;
  publishedStoresUsed: number;
  ordersUsed: number;
  invoices: Array<{
    createdAt: string | null;
    provider: string;
    status: string;
  }>;
  lastBillingEvent: {
    createdAt: string | null;
    eventType: string;
    provider: string;
  } | null;
  warningBadges: Array<"limit_exceeded" | "manual_override_active" | "payment_failed" | "subscription_cancelled">;
};

type AdminAnalytics = {
  visitors: number;
  orders: number;
  conversions: number;
  conversionRate: number;
  revenueEstimate: number;
  whatsappClicks: number;
  topStores: Array<{ label: string; count: number }>;
  topLandings: Array<{ label: string; count: number }>;
  topProducts: Array<{ label: string; count: number }>;
};

export type AdminPlatformHealth = {
  failedMonitoringEvents: number;
  label: "Needs review" | "Stable";
  openSupportTickets: number;
  recentSecurityEvents: number;
};

async function getAdminClient(): Promise<{
  supabase: SupabaseClient<Database>;
  serviceRoleConfigured: boolean;
}> {
  await getAdminAccess();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (url && serviceRoleKey) {
    return {
      serviceRoleConfigured: true,
      supabase: createServiceClient<Database>(url, serviceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      })
    };
  }

  return {
    serviceRoleConfigured: false,
    supabase: await createClient()
  };
}

function asRecords(data: unknown): AnyRecord[] {
  return Array.isArray(data) ? (data as AnyRecord[]) : [];
}

function isRecord(value: unknown): value is AnyRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" && value ? value : fallback;
}

function numberValue(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function countBy(records: AnyRecord[], key: string) {
  const counts = new Map<string, number>();
  for (const record of records) {
    const value = text(record[key]);
    if (value) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }
  return counts;
}

function ownerUserId(record: AnyRecord) {
  return text(record.owner_user_id) || text(record.user_id);
}

function governanceStatus(storeData: unknown, fallback: string) {
  if (!storeData || typeof storeData !== "object" || Array.isArray(storeData)) {
    return fallback;
  }

  const governance = (storeData as Record<string, unknown>).adminGovernance;

  if (!governance || typeof governance !== "object" || Array.isArray(governance)) {
    return fallback;
  }

  const status = text((governance as AnyRecord).status);

  return status === "suspended" || status === "under_review" ? status : fallback;
}

function storeGovernanceRisk(storeData: unknown): {
  reviewedAt: string | null;
  riskStatus: AdminStore["riskStatus"];
} {
  if (!isRecord(storeData) || !isRecord(storeData.adminGovernance)) {
    return {
      reviewedAt: null,
      riskStatus: "clear"
    };
  }

  const governance = storeData.adminGovernance;
  const riskStatus = text(governance.riskStatus);
  const status = text(governance.status);
  const reviewedAt = text(governance.reviewedAt) || null;

  if (riskStatus === "high_risk") {
    return { reviewedAt, riskStatus: "high_risk" };
  }

  if (riskStatus === "reviewed" || reviewedAt || status === "reviewed") {
    return { reviewedAt, riskStatus: "reviewed" };
  }

  return { reviewedAt, riskStatus: "clear" };
}

function countStoresByOwner(records: AnyRecord[]) {
  const counts = new Map<string, number>();

  for (const record of records) {
    const ownerId = ownerUserId(record);

    if (ownerId) {
      counts.set(ownerId, (counts.get(ownerId) ?? 0) + 1);
    }
  }

  return counts;
}

function sumBy(records: AnyRecord[], key: string) {
  return records.reduce((total, record) => total + numberValue(record[key]), 0);
}

function emailMap(users: Array<{ id: string; email: string }>) {
  return new Map(users.map((user) => [user.id, user.email]));
}

function dateValue(value: unknown) {
  const timestamp = Date.parse(text(value));
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function userGovernanceStatus(value: unknown): "suspended" | null {
  if (!isRecord(value)) {
    return null;
  }

  const governance = value.adminGovernance;

  if (!isRecord(governance)) {
    return null;
  }

  return text(governance.status) === "suspended" ? "suspended" : null;
}

function maskEmail(value: string) {
  const [localPart = "", domain = ""] = value.split("@");

  if (!domain) {
    return value ? `${value.slice(0, 4)}...` : "No email";
  }

  const visibleLocal = localPart.length <= 2 ? localPart.slice(0, 1) : `${localPart.slice(0, 2)}...${localPart.slice(-1)}`;
  const [domainName = "", ...domainRest] = domain.split(".");
  const maskedDomain = domainRest.length
    ? `${domainName.slice(0, 1)}...${domainName.slice(-1)}.${domainRest.join(".")}`
    : domain;

  return `${visibleLocal}@${maskedDomain}`;
}

function securitySignalSeverity(action: string): "high" | "low" | "medium" {
  const lowered = action.toLowerCase();

  if (lowered.includes("high") || lowered.includes("risk") || lowered.includes("failed") || lowered.includes("suspend")) {
    return "high";
  }

  if (lowered.includes("warning") || lowered.includes("review")) {
    return "medium";
  }

  return "low";
}

function adminGovernanceStatus(value: unknown): "suspended" | "under_review" | null {
  if (!isRecord(value)) {
    return null;
  }

  const governance = value.adminGovernance;

  if (!isRecord(governance)) {
    return null;
  }

  const status = text(governance.status);

  return status === "suspended" || status === "under_review" ? status : null;
}

function sellerGovernanceRisk(value: unknown): {
  reviewedAt: string | null;
  riskStatus: AdminSeller["riskStatus"];
} {
  if (!isRecord(value) || !isRecord(value.adminGovernance)) {
    return {
      reviewedAt: null,
      riskStatus: "clear"
    };
  }

  const governance = value.adminGovernance;
  const riskStatus = text(governance.riskStatus);
  const status = text(governance.status);
  const reviewedAt = text(governance.reviewedAt) || null;

  if (riskStatus === "high_risk") {
    return { reviewedAt, riskStatus: "high_risk" };
  }

  if (riskStatus === "reviewed" || reviewedAt || status === "reviewed") {
    return { reviewedAt, riskStatus: "reviewed" };
  }

  return { reviewedAt, riskStatus: "clear" };
}

function resellerGovernance(value: unknown): {
  governanceStatus: AdminReseller["governanceStatus"];
  verificationStatus: AdminReseller["verificationStatus"];
} {
  if (!isRecord(value) || !isRecord(value.adminGovernance)) {
    return {
      governanceStatus: "active",
      verificationStatus: "pending_verification"
    };
  }

  const governance = value.adminGovernance;
  const status = text(governance.status);
  const verificationStatus = text(governance.verificationStatus);

  return {
    governanceStatus:
      status === "suspended" ? "suspended" : status === "pending_review" ? "pending_review" : "active",
    verificationStatus: verificationStatus === "verified" ? "verified" : "pending_verification"
  };
}

function resellerGovernanceRisk(value: unknown): {
  reviewedAt: string | null;
  riskStatus: AdminReseller["riskStatus"];
} {
  if (!isRecord(value) || !isRecord(value.adminGovernance)) {
    return {
      reviewedAt: null,
      riskStatus: "clear"
    };
  }

  const governance = value.adminGovernance;
  const riskStatus = text(governance.riskStatus);
  const status = text(governance.status);
  const reviewedAt = text(governance.reviewedAt) || null;

  if (riskStatus === "high_risk") {
    return { reviewedAt, riskStatus: "high_risk" };
  }

  if (riskStatus === "reviewed" || reviewedAt || status === "reviewed") {
    return { reviewedAt, riskStatus: "reviewed" };
  }

  return { reviewedAt, riskStatus: "clear" };
}

async function safeSelect(
  supabase: SupabaseClient<Database>,
  table: string,
  columns = "*",
  limit = 1000
) {
  const { data } = await supabase
    .from(table as never)
    .select(columns)
    .limit(limit);
  return asRecords(data);
}

async function safeCount(supabase: SupabaseClient<Database>, table: string) {
  const { count } = await supabase
    .from(table as never)
    .select("id", { count: "exact", head: true });
  return count ?? 0;
}

export async function getAdminUsersBase() {
  const { supabase, serviceRoleConfigured } = await getAdminClient();
  let users: Array<{
    createdAt: string | null;
    email: string;
    fullName: string | null;
    id: string;
    lastLoginAt: string | null;
  }> = [];

  if (serviceRoleConfigured) {
    const { data } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    users =
      data.users?.map((user) => {
        const metadata = isRecord(user.user_metadata) ? user.user_metadata : {};

        return {
          createdAt: user.created_at ?? null,
          email: user.email ?? "No email",
          fullName: text(metadata.full_name) || text(metadata.name) || null,
          id: user.id,
          lastLoginAt: user.last_sign_in_at ?? null
        };
      }) ?? [];
  }

  if (!users.length) {
    const profiles = await safeSelect(supabase, "profiles", "id, email, full_name, created_at");
    users = profiles.map((profile) => ({
      createdAt: text(profile.created_at, "") || null,
      email: text(profile.email, "No email"),
      fullName: text(profile.full_name) || null,
      id: text(profile.id),
      lastLoginAt: null
    }));
  }

  return { serviceRoleConfigured, supabase, users };
}

export async function getAdminOverview() {
  const { supabase } = await getAdminClient();
  const [{ users }, stores, landings, orders, customers, analytics] = await Promise.all([
    getAdminUsersBase(),
    safeCount(supabase, "stores"),
    safeCount(supabase, "landing_pages"),
    safeSelect(supabase, "commerce_orders", "id, total_amount, total, status"),
    safeCount(supabase, "commerce_customers"),
    getAdminAnalytics()
  ]);
  const revenueEstimate = sumBy(orders, "total_amount") || sumBy(orders, "total");

  return {
    conversions: analytics.conversions,
    customers,
    landings,
    orders: orders.length,
    revenueEstimate,
    stores,
    users: users.length,
    visitors: analytics.visitors
  };
}

export async function getAdminUsers(): Promise<AdminUser[]> {
  const { supabase, users } = await getAdminUsersBase();
  const [
    stores,
    landings,
    orders,
    subscriptions,
    workspaceMembers,
    accountProfiles,
    billingEvents,
    accountRoles,
    monitoringEvents,
    securityAuditLogs
  ] = await Promise.all([
    safeSelect(supabase, "stores", "id, user_id, owner_user_id, workspace_id, name, store_name, status, created_at"),
    safeSelect(supabase, "landing_pages", "user_id"),
    safeSelect(supabase, "commerce_orders", "user_id"),
    safeSelect(
      supabase,
      "user_subscriptions",
      "user_id, plan_id, status, current_period_start, current_period_end, cancel_at_period_end, limits_snapshot"
    ),
    safeSelect(supabase, "workspace_members", "workspace_id, user_id, role, status, created_at"),
    safeSelect(supabase, "account_profiles", "user_id, display_name, account_id, account_type"),
    safeSelect(supabase, "billing_events", "user_id, event_type, processed_at, created_at"),
    safeSelect(supabase, "account_roles", "user_id, role, status, updated_at"),
    safeSelect(
      supabase,
      "monitoring_events",
      "user_id, entity_id, event_type, event_status, entity_type, metadata, created_at",
      5000
    ),
    safeSelect(supabase, "security_audit_logs", "user_id, action, reason, created_at", 5000)
  ]);
  const storeCounts = countStoresByOwner(stores);
  const landingCounts = countBy(landings, "user_id");
  const orderCounts = countBy(orders, "user_id");
  const subscriptionsByUser = new Map(subscriptions.map((row) => [text(row.user_id), row]));
  const rolesByUser = new Map(accountRoles.map((row) => [text(row.user_id), row]));
  const accountProfilesByUser = new Map(
    accountProfiles
      .filter((profile) => text(profile.account_type, "user") === "user")
      .map((profile) => [text(profile.user_id), profile])
  );
  const workspacesByUser = new Map<string, AnyRecord[]>();
  for (const member of workspaceMembers) {
    const userId = text(member.user_id);

    if (!userId) {
      continue;
    }

    workspacesByUser.set(userId, [...(workspacesByUser.get(userId) ?? []), member]);
  }
  const activityByUser = new Map<string, AnyRecord[]>();
  for (const event of billingEvents) {
    const userId = text(event.user_id);

    if (!userId) {
      continue;
    }

    activityByUser.set(userId, [...(activityByUser.get(userId) ?? []), event]);
  }
  const monitoringByUser = new Map<string, AnyRecord[]>();
  for (const event of monitoringEvents) {
    const userId = text(event.entity_type) === "admin_user" ? text(event.entity_id) : text(event.user_id);

    if (!userId) {
      continue;
    }

    monitoringByUser.set(userId, [...(monitoringByUser.get(userId) ?? []), event]);
  }
  const securityByUser = new Map<string, AnyRecord[]>();
  for (const event of securityAuditLogs) {
    const userId = text(event.user_id);

    if (!userId) {
      continue;
    }

    securityByUser.set(userId, [...(securityByUser.get(userId) ?? []), event]);
  }

  return users.map((user) => {
    const subscription = subscriptionsByUser.get(user.id);
    const plan = getBillingPlan(text(subscription?.plan_id, "free"));
    const governanceStatus = userGovernanceStatus(subscription?.limits_snapshot);
    const subscriptionStatus = text(subscription?.status, "active");
    const role = rolesByUser.get(user.id);
    const roleStatus = text(role?.status);
    const profile = accountProfilesByUser.get(user.id);
    const workspaces = workspacesByUser.get(user.id) ?? [];
    const workspaceIds = new Set(workspaces.map((workspace) => text(workspace.workspace_id)).filter(Boolean));
    const monitoring = (monitoringByUser.get(user.id) ?? [])
      .sort((left, right) => dateValue(right.created_at) - dateValue(left.created_at));
    const latestRiskEvent = monitoring.find((event) => {
      const eventType = text(event.event_type);
      return (
        eventType === "admin_user_mark_high_risk" ||
        eventType === "admin_user_clear_risk" ||
        eventType === "admin_user_mark_reviewed"
      );
    });
    const riskEventType = text(latestRiskEvent?.event_type);
    const riskStatus =
      riskEventType === "admin_user_mark_high_risk"
        ? "high_risk"
        : riskEventType === "admin_user_mark_reviewed"
          ? "reviewed"
          : "clear";
    const securitySignals = [
      ...(securityByUser.get(user.id) ?? []).map((event) => ({
        createdAt: text(event.created_at),
        label: text(event.action, text(event.reason, "security_audit")),
        severity: securitySignalSeverity(`${text(event.action)} ${text(event.reason)}`)
      })),
      ...monitoring
        .filter((event) => text(event.entity_type) === "admin_user")
        .map((event) => ({
          createdAt: text(event.created_at),
          label: text(event.event_type, "admin_user_event"),
          severity: securitySignalSeverity(text(event.event_type))
        }))
    ]
      .filter((signal) => signal.createdAt)
      .sort((left, right) => dateValue(right.createdAt) - dateValue(left.createdAt))
      .slice(0, 5);
    const accountStatus =
      roleStatus === "suspended" || roleStatus === "disabled" || roleStatus === "pending"
        ? roleStatus
        : governanceStatus ?? (subscriptionStatus === "incomplete" ? "suspended" : subscriptionStatus);
    const userStores = stores
      .filter((store) => ownerUserId(store) === user.id)
      .map((store) => ({
        createdAt: text(store.created_at),
        id: text(store.id),
        name: text(store.store_name, text(store.name, "Untitled store")),
        status: text(store.status, "draft")
      }));

    return {
      activeSubscriptionLabel: `${plan.name} · ${subscriptionStatus}`,
      accountStatus,
      createdAt: user.createdAt,
      email: user.email,
      emailMasked: maskEmail(user.email),
      fullName: user.fullName ?? (text(profile?.display_name) || null),
      governanceStatus,
      id: user.id,
      isHighRisk: riskStatus === "high_risk",
      landingsCount: landingCounts.get(user.id) ?? 0,
      lastLoginAt: user.lastLoginAt,
      ordersCount: orderCounts.get(user.id) ?? 0,
      plan: plan.name,
      planId: plan.id,
      primaryRole: text(role?.role, "unknown"),
      recentActivity: (activityByUser.get(user.id) ?? [])
        .sort(
          (left, right) =>
            dateValue(right.processed_at ?? right.created_at) -
            dateValue(left.processed_at ?? left.created_at)
        )
        .slice(0, 5)
        .map((event) => ({
          createdAt: text(event.processed_at) || text(event.created_at),
          label: text(event.event_type, "billing_event")
        })),
      status: subscriptionStatus,
      reviewedAt: riskStatus === "reviewed" ? text(latestRiskEvent?.created_at) || null : null,
      riskStatus,
      securitySignals,
      stores: userStores,
      storesCount: storeCounts.get(user.id) ?? 0,
      subscription: {
        cancelAtPeriodEnd: subscription?.cancel_at_period_end === true,
        currentPeriodEnd: text(subscription?.current_period_end) || null,
        currentPeriodStart: text(subscription?.current_period_start) || null,
        planId: plan.id,
        planName: plan.name,
        status: subscriptionStatus
      },
      workspaceCount: workspaceIds.size,
      workspaces: workspaces.map((workspace) => ({
        createdAt: text(workspace.created_at) || null,
        id: text(workspace.workspace_id),
        role: text(workspace.role, "member"),
        status: text(workspace.status, "active")
      }))
    };
  });
}

export async function getAdminUserDetail(userId: string): Promise<AdminUserDetail | null> {
  const users = await getAdminUsers();
  const user = users.find((candidate) => candidate.id === userId);

  if (!user) {
    return null;
  }

  const { supabase } = await getAdminClient();
  const [stores, orders] = await Promise.all([
    safeSelect(supabase, "stores", "id, user_id, owner_user_id, name, store_name, status, created_at"),
    safeSelect(
      supabase,
      "commerce_orders",
      "id, user_id, source_type, status, total_amount, total, currency, created_at"
    )
  ]);

  return {
    ...user,
    recentOrders: orders
      .filter((order) => text(order.user_id) === userId)
      .slice(0, 10)
      .map((order) => ({
        createdAt: text(order.created_at),
        currency: text(order.currency, "USD"),
        id: text(order.id),
        sourceType: text(order.source_type, "unknown"),
        status: text(order.status, "new"),
        total: numberValue(order.total_amount) || numberValue(order.total)
      })),
    stores: stores
      .filter((store) => ownerUserId(store) === userId)
      .map((store) => ({
        createdAt: text(store.created_at),
        id: text(store.id),
        name: text(store.store_name, text(store.name, "Untitled store")),
        status: text(store.status, "draft")
      }))
  };
}

export async function getAdminStores(): Promise<AdminStore[]> {
  const { supabase, users } = await getAdminUsersBase();
  const owners = emailMap(users);
  const [
    stores,
    publications,
    commerceOrders,
    storeOrders,
    events,
    products,
    paymentMethods,
    providerConnections,
    shippingProfiles,
    shippingZones,
    shippingMethods,
    legalPages,
    storeDomains,
    subscriptions,
    workspaceMembers,
    monitoringEvents,
    securityAuditLogs
  ] = await Promise.all([
    safeSelect(
      supabase,
      "stores",
      "id, user_id, owner_user_id, workspace_id, name, store_name, slug, status, store_data, template_id, created_at, updated_at, delivery_enabled, pickup_enabled, delivery_notes"
    ),
    safeSelect(supabase, "published_stores", "store_id, slug, url, status, custom_domain"),
    safeSelect(supabase, "commerce_orders", "source_id, source_type, total_amount, total"),
    safeSelect(supabase, "store_orders", "store_id, total, total_amount"),
    safeSelect(supabase, "analytics_events", "source_id, source_type, event_type"),
    safeSelect(supabase, "store_products", "store_id, status"),
    safeSelect(supabase, "store_payment_methods", "store_id, is_enabled"),
    safeSelect(supabase, "store_payment_provider_connections", "store_id, connection_status, charges_enabled, paypal_status"),
    safeSelect(supabase, "shipping_profiles", "store_id"),
    safeSelect(supabase, "shipping_zones", "store_id, enabled"),
    safeSelect(supabase, "shipping_methods", "store_id, enabled"),
    safeSelect(supabase, "store_pages", "store_id, page_type, status"),
    safeSelect(supabase, "store_domains", "store_id, hostname, status, verification_status"),
    safeSelect(supabase, "user_subscriptions", "user_id, plan_id, status"),
    safeSelect(supabase, "workspace_members", "workspace_id, user_id, role, status"),
    safeSelect(supabase, "monitoring_events", "entity_id, entity_type, event_type, event_status, metadata, created_at", 1000),
    safeSelect(supabase, "security_audit_logs", "user_id, action, reason, metadata, created_at", 1000)
  ]);
  const publicationByStore = new Map(publications.map((row) => [text(row.store_id), row]));
  const commerceStoreOrders = commerceOrders.filter((order) => order.source_type === "store");
  const storeViews = events.filter(
    (event) => event.source_type === "store" && event.event_type === "page_view"
  );
  const commerceOrderCounts = countBy(commerceStoreOrders, "source_id");
  const directOrderCounts = countBy(storeOrders, "store_id");
  const viewCounts = countBy(storeViews, "source_id");
  const productCounts = countBy(products, "store_id");
  const subscriptionByUser = new Map(subscriptions.map((row) => [text(row.user_id), row]));
  const membersByWorkspace = new Map<string, AnyRecord[]>();
  for (const member of workspaceMembers) {
    const workspaceId = text(member.workspace_id);
    if (!workspaceId) {
      continue;
    }
    membersByWorkspace.set(workspaceId, [...(membersByWorkspace.get(workspaceId) ?? []), member]);
  }

  return stores.map((store) => {
    const publication = publicationByStore.get(text(store.id));
    const ownerId = ownerUserId(store);
    const workspaceId = text(store.workspace_id) || null;
    const url = text(publication?.url) || (text(publication?.slug) ? `/store/${text(publication?.slug)}` : null);
    const storeId = text(store.id);
    const storeProducts = products.filter((product) => text(product.store_id) === storeId);
    const activeProductCount = storeProducts.filter((product) => text(product.status) === "active").length;
    const storePaymentMethods = paymentMethods.filter((method) => text(method.store_id) === storeId);
    const storeProviderConnections = providerConnections.filter((connection) => text(connection.store_id) === storeId);
    const hasPaymentMethod =
      storePaymentMethods.some((method) => method.is_enabled === true) ||
      storeProviderConnections.some(
        (connection) =>
          text(connection.connection_status) === "connected" ||
          connection.charges_enabled === true ||
          text(connection.paypal_status) === "connected"
      );
    const hasShipping =
      store.delivery_enabled === true ||
      store.pickup_enabled === true ||
      text(store.delivery_notes).length > 0 ||
      shippingProfiles.some((profile) => text(profile.store_id) === storeId) ||
      shippingZones.some((zone) => text(zone.store_id) === storeId && zone.enabled !== false) ||
      shippingMethods.some((method) => text(method.store_id) === storeId && method.enabled !== false);
    const requiredLegalPages = new Set(["privacy", "returns", "shipping", "terms"]);
    for (const page of legalPages) {
      if (text(page.store_id) === storeId && text(page.status) !== "archived") {
        requiredLegalPages.delete(text(page.page_type));
      }
    }
    const storeDomainRows = storeDomains.filter((domain) => text(domain.store_id) === storeId);
    const hasCustomDomain =
      text(publication?.custom_domain).length > 0 ||
      storeDomainRows.some(
        (domain) =>
          (text(domain.status) === "verified" || text(domain.verification_status) === "verified")
      );
    const orderCount = (commerceOrderCounts.get(storeId) ?? 0) + (directOrderCounts.get(storeId) ?? 0);
    const storeRevenue =
      sumBy(commerceStoreOrders.filter((order) => text(order.source_id) === storeId), "total_amount") ||
      sumBy(commerceStoreOrders.filter((order) => text(order.source_id) === storeId), "total");
    const directRevenue =
      sumBy(storeOrders.filter((order) => text(order.store_id) === storeId), "total_amount") ||
      sumBy(storeOrders.filter((order) => text(order.store_id) === storeId), "total");
    const blockingHealth = [
      activeProductCount ? null : "missing_products",
      hasPaymentMethod ? null : "no_payment_method",
      hasShipping ? null : "no_shipping_settings",
      requiredLegalPages.size ? "missing_legal_pages" : null
    ].filter(Boolean);
    const health: AdminStore["health"] = [
      {
        key: "missing_products",
        label: activeProductCount ? "Products ready" : "Missing products",
        status: activeProductCount ? "ready" : "blocked"
      },
      {
        key: "no_payment_method",
        label: hasPaymentMethod ? "Payment configured" : "No payment method",
        status: hasPaymentMethod ? "ready" : "blocked"
      },
      {
        key: "no_shipping_settings",
        label: hasShipping ? "Shipping configured" : "No shipping settings",
        status: hasShipping ? "ready" : "blocked"
      },
      {
        key: "missing_legal_pages",
        label: requiredLegalPages.size ? "Missing legal pages" : "Legal pages ready",
        status: requiredLegalPages.size ? "blocked" : "ready"
      },
      {
        key: "domain_not_connected",
        label: hasCustomDomain ? "Domain connected" : "Domain not connected",
        status: hasCustomDomain ? "ready" : "warning"
      },
      {
        key: blockingHealth.length ? "publish_blocked" : "publish_ready",
        label: blockingHealth.length ? "Publish blocked" : "Publish ready",
        status: blockingHealth.length ? "blocked" : "ready"
      }
    ];
    const subscription = subscriptionByUser.get(ownerId);
    const planId = text(subscription?.plan_id, "free");
    const subscriptionStatus = text(subscription?.status, "none");
    const plan = getBillingPlan(planId);
    const workspaceMemberRows = workspaceId ? membersByWorkspace.get(workspaceId) ?? [] : [];
    const storeStatus = text(store.status, "draft");
    const adminStatus = governanceStatus(store.store_data, storeStatus);
    const risk = storeGovernanceRisk(store.store_data);
    const monitoringSignals = monitoringEvents
      .filter((event) => {
        const metadata = isRecord(event.metadata) ? event.metadata : {};
        return text(event.entity_id) === storeId || text(metadata.store_id) === storeId;
      })
      .slice(0, 3)
      .map((event) => ({
        createdAt: text(event.created_at) || null,
        label: text(event.event_type, "Monitoring event"),
        severity: text(event.event_status) === "warning" || text(event.event_type).includes("risk") ? "high" as const : "medium" as const
      }));
    const securitySignals = securityAuditLogs
      .filter((event) => {
        const metadata = isRecord(event.metadata) ? event.metadata : {};
        return text(metadata.store_id) === storeId || text(event.reason).includes(storeId);
      })
      .slice(0, 2)
      .map((event) => ({
        createdAt: text(event.created_at) || null,
        label: text(event.action, "Security audit"),
        severity: securitySignalSeverity(text(event.action))
      }));
    const riskSignals = [
      ...(risk.riskStatus === "high_risk"
        ? [{
            createdAt: risk.reviewedAt,
            label: "Marked high risk by Super Admin",
            severity: "high" as const
          }]
        : []),
      ...monitoringSignals,
      ...securitySignals
    ];

    return {
      createdAt: text(store.created_at),
      domainStatus: hasCustomDomain ? "connected" : storeDomainRows.length ? "pending" : "not_connected",
      domains: storeDomainRows.map((domain) => ({
        hostname: text(domain.hostname, "Unknown domain"),
        status: text(domain.status, "pending"),
        verificationStatus: text(domain.verification_status, "pending")
      })),
      health,
      hasDomain: hasCustomDomain,
      id: storeId,
      name: text(store.store_name, text(store.name, "Untitled store")),
      ordersCount: orderCount,
      ownerEmail: owners.get(ownerId) ?? text(ownerId, "Unknown owner"),
      ownerId: ownerId || null,
      ownerType: ownerId ? "owner" : "unknown",
      plan: plan.name,
      planId,
      productsCount: productCounts.get(storeId) ?? 0,
      publicationStatus: text(publication?.status, "not_published"),
      publishedUrl: url,
      revenue: storeRevenue + directRevenue,
      reviewedAt: risk.reviewedAt,
      riskSignals,
      riskStatus: risk.riskStatus,
      slug: text(store.slug) || text(publication?.slug) || null,
      status: adminStatus,
      storeStatus,
      subscriptionStatus,
      template: text(store.template_id, "default"),
      updatedAt: text(store.updated_at) || null,
      viewsCount: viewCounts.get(storeId) ?? 0,
      workspaceId,
      workspaceMembers: workspaceMemberRows.map((member) => ({
        email: owners.get(text(member.user_id)) ?? text(member.user_id, "Unknown member"),
        role: text(member.role, "member"),
        status: text(member.status, "active"),
        userId: text(member.user_id)
      }))
    };
  });
}

export async function getAdminSellers(): Promise<AdminSeller[]> {
  const { supabase, users } = await getAdminUsersBase();
  const owners = emailMap(users);
  const namesByUser = new Map(users.map((user) => [user.id, user.fullName]));
  const createdByUser = new Map(users.map((user) => [user.id, user.createdAt]));
  const [
    stores,
    publications,
    products,
    commerceOrders,
    storeOrders,
    storeCustomers,
    commerceCustomers,
    subscriptions,
    workspaceMembers,
    accountRoles,
    monitoringEvents,
    securityAuditLogs
  ] = await Promise.all([
    safeSelect(
      supabase,
      "stores",
      "id, user_id, owner_user_id, workspace_id, name, store_name, slug, status, store_data, created_at"
    ),
    safeSelect(supabase, "published_stores", "store_id, status"),
    safeSelect(supabase, "store_products", "store_id"),
    safeSelect(
      supabase,
      "commerce_orders",
      "id, user_id, source_id, source_type, status, total_amount, total, currency, created_at"
    ),
    safeSelect(
      supabase,
      "store_orders",
      "id, store_id, owner_user_id, user_id, status, total_amount, total, currency, created_at"
    ),
    safeSelect(supabase, "customers", "id, store_id"),
    safeSelect(supabase, "commerce_customers", "id, user_id"),
    safeSelect(supabase, "user_subscriptions", "user_id, plan_id, status, limits_snapshot"),
    safeSelect(supabase, "workspace_members", "workspace_id, user_id, role, status"),
    safeSelect(supabase, "account_roles", "user_id, role, status"),
    safeSelect(supabase, "monitoring_events", "entity_id, entity_type, event_type, event_status, metadata, user_id, created_at", 1000),
    safeSelect(supabase, "security_audit_logs", "user_id, action, reason, metadata, created_at", 1000)
  ]);
  const sellerIds = new Set(stores.map(ownerUserId).filter(Boolean));
  const storesBySeller = new Map<string, AnyRecord[]>();

  for (const store of stores) {
    const sellerId = ownerUserId(store);

    if (!sellerId) {
      continue;
    }

    storesBySeller.set(sellerId, [...(storesBySeller.get(sellerId) ?? []), store]);
  }

  const publicationsByStore = new Map(publications.map((publication) => [text(publication.store_id), publication]));
  const productsByStore = countBy(products, "store_id");
  const storeCustomersByStore = countBy(storeCustomers, "store_id");
  const commerceCustomersByUser = countBy(commerceCustomers, "user_id");
  const subscriptionByUser = new Map(subscriptions.map((subscription) => [text(subscription.user_id), subscription]));
  const accountRoleByUser = new Map(accountRoles.map((role) => [text(role.user_id), role]));
  const workspaceMembershipsByUser = new Map<string, AnyRecord[]>();
  for (const member of workspaceMembers) {
    const userId = text(member.user_id);
    if (!userId) {
      continue;
    }
    workspaceMembershipsByUser.set(userId, [...(workspaceMembershipsByUser.get(userId) ?? []), member]);
  }

  return [...sellerIds].map((sellerId) => {
    const sellerStores = storesBySeller.get(sellerId) ?? [];
    const storeIds = new Set(sellerStores.map((store) => text(store.id)).filter(Boolean));
    const subscription = subscriptionByUser.get(sellerId);
    const plan = getBillingPlan(text(subscription?.plan_id, "free"));
    const sellerGovernance = adminGovernanceStatus(subscription?.limits_snapshot);
    const sellerRisk = sellerGovernanceRisk(subscription?.limits_snapshot);
    const storeGovernance = sellerStores
      .map((store) => adminGovernanceStatus(store.store_data))
      .find((status) => status === "suspended" || status === "under_review");
    const subscriptionStatus = text(subscription?.status, "active");
    const accountRole = accountRoleByUser.get(sellerId);
    const accountStatus = text(accountRole?.status, "active");
    const sellerStatus =
      sellerGovernance ??
      storeGovernance ??
      (accountStatus === "suspended" || accountStatus === "disabled"
        ? "suspended"
        : subscriptionStatus === "incomplete"
          ? "suspended"
          : accountStatus === "pending"
            ? "under_review"
            : "active");
    const sellerCommerceOrders = commerceOrders.filter(
      (order) =>
        (order.source_type === "store" && storeIds.has(text(order.source_id))) ||
        text(order.user_id) === sellerId
    );
    const sellerStoreOrders = storeOrders.filter(
      (order) => storeIds.has(text(order.store_id)) || text(order.owner_user_id) === sellerId
    );
    const recentOrders = [
      ...sellerCommerceOrders.map((order) => ({
        createdAt: text(order.created_at),
        currency: text(order.currency, "USD"),
        id: text(order.id),
        source: text(order.source_type, "commerce"),
        status: text(order.status, "new"),
        storeId: text(order.source_id),
        total: numberValue(order.total_amount) || numberValue(order.total)
      })),
      ...sellerStoreOrders.map((order) => ({
        createdAt: text(order.created_at),
        currency: text(order.currency, "USD"),
        id: text(order.id),
        source: "store_order",
        status: text(order.status, "new"),
        storeId: text(order.store_id),
        total: numberValue(order.total_amount) || numberValue(order.total)
      }))
    ]
      .sort((left, right) => dateValue(right.createdAt) - dateValue(left.createdAt))
      .slice(0, 5);
    const workspaceIds = [
      ...new Set([
        ...sellerStores.map((store) => text(store.workspace_id)).filter(Boolean),
        ...(workspaceMembershipsByUser.get(sellerId) ?? []).map((member) => text(member.workspace_id)).filter(Boolean)
      ])
    ];
    const monitoringSignals = monitoringEvents
      .filter((event) => {
        const metadata = isRecord(event.metadata) ? event.metadata : {};
        return text(event.user_id) === sellerId || text(event.entity_id) === sellerId || text(metadata.seller_id) === sellerId;
      })
      .slice(0, 3)
      .map((event) => ({
        createdAt: text(event.created_at) || null,
        label: text(event.event_type, "Monitoring event"),
        severity: text(event.event_status) === "warning" || text(event.event_type).includes("risk") ? "high" as const : "medium" as const
      }));
    const securitySignals = securityAuditLogs
      .filter((event) => text(event.user_id) === sellerId)
      .slice(0, 2)
      .map((event) => ({
        createdAt: text(event.created_at) || null,
        label: text(event.action, "Security audit"),
        severity: securitySignalSeverity(text(event.action))
      }));
    const riskSignals = [
      ...(sellerRisk.riskStatus === "high_risk"
        ? [{
            createdAt: sellerRisk.reviewedAt,
            label: "Marked high risk by Super Admin",
            severity: "high" as const
          }]
        : []),
      ...monitoringSignals,
      ...securitySignals
    ];

    return {
      accountStatus,
      createdAt: createdByUser.get(sellerId) ?? null,
      customersCount:
        [...storeIds].reduce((total, storeId) => total + (storeCustomersByStore.get(storeId) ?? 0), 0) +
        (commerceCustomersByUser.get(sellerId) ?? 0),
      email: owners.get(sellerId) ?? text(sellerId, "Unknown seller"),
      fullName: namesByUser.get(sellerId) ?? null,
      governanceStatus: sellerStatus,
      ordersCount: sellerCommerceOrders.length + sellerStoreOrders.length,
      plan: plan.name,
      planId: plan.id,
      productsCount: [...storeIds].reduce((total, storeId) => total + (productsByStore.get(storeId) ?? 0), 0),
      publishedStores: sellerStores.filter(
        (store) => text(publicationsByStore.get(text(store.id))?.status) === "published"
      ).length,
      recentOrders,
      revenue:
        (sumBy(sellerCommerceOrders, "total_amount") || sumBy(sellerCommerceOrders, "total")) +
        (sumBy(sellerStoreOrders, "total_amount") || sumBy(sellerStoreOrders, "total")),
      reviewedAt: sellerRisk.reviewedAt,
      riskSignals,
      riskStatus: sellerRisk.riskStatus,
      roleType: text(accountRole?.role, "owner"),
      status: sellerStatus,
      stores: sellerStores.map((store) => ({
        createdAt: text(store.created_at),
        id: text(store.id),
        name: text(store.store_name, text(store.name, "Untitled store")),
        slug: text(store.slug) || null,
        status: governanceStatus(store.store_data, text(store.status, "draft")),
        workspaceId: text(store.workspace_id) || null
      })),
      storesOwned: sellerStores.length,
      subscription: {
        planId: plan.id,
        planName: plan.name,
        status: subscriptionStatus
      },
      userId: sellerId,
      workspaceIds
    };
  });
}

export async function getAdminResellers(): Promise<AdminReseller[]> {
  const { supabase, users } = await getAdminUsersBase();
  const owners = emailMap(users);
  const namesByUser = new Map(users.map((user) => [user.id, user.fullName]));
  const createdByUser = new Map(users.map((user) => [user.id, user.createdAt]));
  const [
    resellerProfiles,
    accountProfiles,
    stores,
    subscriptions,
    purchaseRequests,
    provisionedStores,
    storeTransfers,
    workspaceMembers,
    accountRoles,
    affiliateOrders,
    monitoringEvents,
    securityAuditLogs
  ] = await Promise.all([
    safeSelect(
      supabase,
      "reseller_profiles",
      "id, user_id, slug, display_name, is_published, created_at"
    ),
    safeSelect(supabase, "account_profiles", "user_id, account_type, display_name, created_at"),
    safeSelect(
      supabase,
      "stores",
      "id, user_id, owner_user_id, workspace_id, name, store_name, slug, status, store_data, created_at"
    ),
    safeSelect(supabase, "user_subscriptions", "user_id, plan_id, status, limits_snapshot"),
    safeSelect(supabase, "store_purchase_requests", "id, reseller_id, buyer_email, request_status, created_at"),
    safeSelect(
      supabase,
      "provisioned_stores",
      "id, reseller_id, buyer_email, provisioned_store_name, provisioning_status, ownership_status, created_at"
    ),
    safeSelect(supabase, "store_transfers", "id, reseller_id, buyer_email, transfer_status, transferred_at, created_at"),
    safeSelect(supabase, "workspace_members", "workspace_id, user_id, role, status"),
    safeSelect(supabase, "account_roles", "user_id, role, status"),
    safeSelect(supabase, "store_affiliate_orders", "store_id, commission_amount, status", 1000),
    safeSelect(supabase, "monitoring_events", "entity_id, entity_type, event_type, event_status, metadata, user_id, created_at", 1000),
    safeSelect(supabase, "security_audit_logs", "user_id, action, reason, metadata, created_at", 1000)
  ]);
  const profileById = new Map(resellerProfiles.map((profile) => [text(profile.id), profile]));
  const profilesByUser = new Map(resellerProfiles.map((profile) => [text(profile.user_id), profile]));
  const accountProfilesByUser = new Map(
    accountProfiles
      .filter((profile) => text(profile.account_type) === "reseller")
      .map((profile) => [text(profile.user_id), profile])
  );
  const resellerIds = new Set<string>();

  for (const profile of resellerProfiles) {
    const userId = text(profile.user_id);

    if (userId) {
      resellerIds.add(userId);
    }
  }

  for (const profile of accountProfilesByUser.keys()) {
    if (profile) {
      resellerIds.add(profile);
    }
  }

  for (const request of purchaseRequests) {
    const profile = profileById.get(text(request.reseller_id));
    const userId = text(profile?.user_id);

    if (userId) {
      resellerIds.add(userId);
    }
  }

  let brandingSummaries = new Map<string, EffectiveResellerBranding>();

  if ((await getAdminAccess()).internalRole === "super_admin") {
    brandingSummaries = await listResellerBrandingSummaries([...resellerIds]);
  }

  const storesByOwner = new Map<string, AnyRecord[]>();
  for (const store of stores) {
    const ownerId = ownerUserId(store);

    if (!ownerId) {
      continue;
    }

    storesByOwner.set(ownerId, [...(storesByOwner.get(ownerId) ?? []), store]);
  }

  const subscriptionsByUser = new Map(subscriptions.map((subscription) => [text(subscription.user_id), subscription]));
  const accountRoleByUser = new Map(accountRoles.map((role) => [text(role.user_id), role]));
  const workspaceMembershipsByUser = new Map<string, AnyRecord[]>();
  for (const member of workspaceMembers) {
    const userId = text(member.user_id);
    if (!userId) {
      continue;
    }
    workspaceMembershipsByUser.set(userId, [...(workspaceMembershipsByUser.get(userId) ?? []), member]);
  }

  return [...resellerIds].map((userId) => {
    const profile = profilesByUser.get(userId);
    const accountProfile = accountProfilesByUser.get(userId);
    const resellerProfileId = text(profile?.id);
    const subscription = subscriptionsByUser.get(userId);
    const governance = resellerGovernance(subscription?.limits_snapshot);
    const risk = resellerGovernanceRisk(subscription?.limits_snapshot);
    const ownedStores = storesByOwner.get(userId) ?? [];
    const ownedStoreIds = new Set(ownedStores.map((store) => text(store.id)).filter(Boolean));
    const resellerRequests = purchaseRequests.filter((request) => text(request.reseller_id) === resellerProfileId);
    const resellerProvisionedStores = provisionedStores.filter(
      (store) => text(store.reseller_id) === resellerProfileId
    );
    const resellerTransfers = storeTransfers.filter((transfer) => text(transfer.reseller_id) === resellerProfileId);
    const referredCustomers = new Set(
      resellerRequests
        .map((request) => text(request.buyer_email).toLowerCase())
        .filter(Boolean)
    );
    const transferredStores = [
      ...resellerProvisionedStores.map((store) => ({
        buyerEmail: text(store.buyer_email) || null,
        id: text(store.id),
        name: text(store.provisioned_store_name, "Provisioned store"),
        status: text(store.provisioning_status, text(store.ownership_status, "draft")),
        transferredAt: null
      })),
      ...resellerTransfers.map((transfer) => ({
        buyerEmail: text(transfer.buyer_email) || null,
        id: text(transfer.id),
        name: "Store transfer",
        status: text(transfer.transfer_status, "preparing"),
        transferredAt: text(transfer.transferred_at) || null
      }))
    ];
    const storesSold = Math.max(
      resellerRequests.filter((request) => text(request.request_status) === "delivered").length,
      resellerProvisionedStores.filter((store) => text(store.provisioning_status) === "delivered").length,
      resellerTransfers.filter((transfer) => text(transfer.transferred_at)).length
    );
    const planId = text(subscription?.plan_id, "free");
    const plan = getBillingPlan(planId);
    const subscriptionStatus = text(subscription?.status, "none");
    const accountRole = accountRoleByUser.get(userId);
    const accountStatus = text(accountRole?.status, "active");
    const accountSuspended = accountStatus === "suspended" || accountStatus === "disabled";
    const status: AdminReseller["status"] =
      governance.governanceStatus === "suspended" || accountSuspended
        ? "suspended"
        : governance.verificationStatus === "verified"
          ? "verified"
          : "pending_verification";
    const resellerAffiliateOrders = affiliateOrders.filter((order) => ownedStoreIds.has(text(order.store_id)));
    const commissionTotal = resellerAffiliateOrders.reduce((total, order) => total + numberValue(order.commission_amount), 0);
    const commissionStatuses = new Set(resellerAffiliateOrders.map((order) => text(order.status, "pending")));
    const commissionStatus =
      resellerAffiliateOrders.length === 0
        ? "not_available"
        : commissionStatuses.has("pending")
          ? "pending"
          : commissionStatuses.has("approved")
            ? "approved"
            : commissionStatuses.has("paid")
              ? "paid"
              : "mixed";
    const workspaceIds = [
      ...new Set([
        ...ownedStores.map((store) => text(store.workspace_id)).filter(Boolean),
        ...(workspaceMembershipsByUser.get(userId) ?? []).map((member) => text(member.workspace_id)).filter(Boolean)
      ])
    ];
    const monitoringSignals = monitoringEvents
      .filter((event) => {
        const metadata = isRecord(event.metadata) ? event.metadata : {};
        return text(event.user_id) === userId || text(event.entity_id) === userId || text(metadata.reseller_id) === userId;
      })
      .slice(0, 3)
      .map((event) => ({
        createdAt: text(event.created_at) || null,
        label: text(event.event_type, "Monitoring event"),
        severity: text(event.event_status) === "warning" || text(event.event_type).includes("risk") ? "high" as const : "medium" as const
      }));
    const securitySignals = securityAuditLogs
      .filter((event) => text(event.user_id) === userId)
      .slice(0, 2)
      .map((event) => ({
        createdAt: text(event.created_at) || null,
        label: text(event.action, "Security audit"),
        severity: securitySignalSeverity(text(event.action))
      }));
    const riskSignals = [
      ...(risk.riskStatus === "high_risk"
        ? [{
            createdAt: risk.reviewedAt,
            label: "Marked high risk by Super Admin",
            severity: "high" as const
          }]
        : []),
      ...monitoringSignals,
      ...securitySignals
    ];

    return {
      branding: (() => {
        const summary = brandingSummaries.get(userId);

        if (!summary) {
          return {
            customDraft: {
              brandName: "",
              documentationUrl: null,
              legalName: null,
              poweredByLabel: null,
              showPoweredBy: true,
              supportEmail: null,
              supportUrl: null
            },
            customPreview: {
              brandName: "",
              documentationUrl: null,
              legalName: null,
              poweredByLabel: null,
              showPoweredBy: true,
              supportEmail: null,
              supportUrl: null
            },
            effective: defaultPlatformWhiteLabelSettings,
            effectiveSource: "platform" as const,
            hasCustomDraftChanges: false,
            hasCustomPublished: false,
            inheritanceMode: "inherit_platform" as const,
            platformPreview: defaultPlatformWhiteLabelSettings,
            publishStatus: "draft" as const,
            validationOk: false
          };
        }

        return {
          customDraft: summary.record.customDraft,
          customPreview: summary.customPreview,
          effective: summary.branding,
          effectiveSource: summary.effectiveSource,
          hasCustomDraftChanges: summary.record.hasCustomDraftChanges,
          hasCustomPublished: summary.record.hasCustomPublished,
          inheritanceMode: summary.inheritanceMode,
          platformPreview: summary.platformPreview,
          publishStatus: summary.publishStatus,
          validationOk: summary.record.validation.ok
        };
      })(),
      commissionSummary: {
        note: resellerAffiliateOrders.length
          ? `Affiliate commission records found with ${commissionStatus} status.`
          : "No commission records found.",
        total: commissionTotal
      },
      commissionStatus,
      commissionsPlaceholder: resellerAffiliateOrders.length ? `$${commissionTotal.toFixed(2)}` : "No commission records",
      createdAt: text(profile?.created_at) || text(accountProfile?.created_at) || (createdByUser.get(userId) ?? null),
      customersReferred: referredCustomers.size,
      email: owners.get(userId) ?? text(userId, "Unknown reseller"),
      fullName: namesByUser.get(userId) ?? (text(accountProfile?.display_name) || text(profile?.display_name) || null),
      governanceStatus: governance.governanceStatus,
      ownedStores: ownedStores.map((store) => ({
        createdAt: text(store.created_at),
        id: text(store.id),
        name: text(store.store_name, text(store.name, "Untitled store")),
        slug: text(store.slug) || null,
        status: governanceStatus(store.store_data, text(store.status, "draft")),
        workspaceId: text(store.workspace_id) || null
      })),
      plan: plan.name,
      planId,
      profile: {
        displayName: text(profile?.display_name) || text(accountProfile?.display_name) || null,
        id: resellerProfileId || null,
        isPublished: profile?.is_published === true,
        slug: text(profile?.slug) || null
      },
      reviewedAt: risk.reviewedAt,
      riskSignals,
      riskStatus: risk.riskStatus,
      status,
      storesCreated: ownedStores.length + resellerProvisionedStores.length,
      storesSold,
      subscriptionStatus,
      transferredStores,
      userId,
      verificationStatus: governance.verificationStatus,
      workspaceIds
    };
  });
}

export async function getAdminLandings(): Promise<AdminLanding[]> {
  const { supabase, users } = await getAdminUsersBase();
  const owners = emailMap(users);
  const [landings, publications, orders, events] = await Promise.all([
    safeSelect(supabase, "landing_pages", "id, user_id, product_name, status, template_id, slug, created_at"),
    safeSelect(supabase, "publications", "landing_page_id, url, status"),
    safeSelect(supabase, "commerce_orders", "source_id, source_type"),
    safeSelect(supabase, "analytics_events", "source_id, source_type, event_type")
  ]);
  const publicationByLanding = new Map(publications.map((row) => [text(row.landing_page_id), row]));
  const landingOrders = orders.filter((order) => order.source_type === "landing");
  const landingViews = events.filter(
    (event) => event.source_type === "landing" && event.event_type === "page_view"
  );
  const orderCounts = countBy(landingOrders, "source_id");
  const viewCounts = countBy(landingViews, "source_id");

  return landings.map((landing) => {
    const publication = publicationByLanding.get(text(landing.id));
    const url = text(publication?.url) || (text(landing.slug) ? `/l/${text(landing.slug)}` : null);
    return {
      createdAt: text(landing.created_at),
      id: text(landing.id),
      ordersCount: orderCounts.get(text(landing.id)) ?? 0,
      ownerEmail: owners.get(text(landing.user_id)) ?? text(landing.user_id, "Unknown owner"),
      publishedUrl: url,
      status: text(publication?.status, text(landing.status, "draft")),
      template: text(landing.template_id, "default"),
      title: text(landing.product_name, "Untitled landing"),
      viewsCount: viewCounts.get(text(landing.id)) ?? 0
    };
  });
}

export async function getAdminOrders(): Promise<AdminOrder[]> {
  const { supabase, users } = await getAdminUsersBase();
  const owners = emailMap(users);
  const orders = await safeSelect(
    supabase,
    "commerce_orders",
    "id, user_id, source_type, customer_name, customer_phone, payment_method, status, total_amount, total, currency, created_at"
  );

  return orders.map((order) => ({
    createdAt: text(order.created_at),
    currency: text(order.currency, "USD"),
    customer: text(order.customer_name, text(order.customer_phone, "Unknown customer")),
    id: text(order.id),
    ownerEmail: owners.get(text(order.user_id)) ?? text(order.user_id, "Unknown owner"),
    paymentMethod: text(order.payment_method, "unknown"),
    sourceType: text(order.source_type, "unknown"),
    status: text(order.status, "new"),
    total: numberValue(order.total_amount) || numberValue(order.total)
  }));
}

export async function getAdminCustomers(): Promise<AdminCustomer[]> {
  const { supabase, users } = await getAdminUsersBase();
  const owners = emailMap(users);
  const customers = await safeSelect(
    supabase,
    "commerce_customers",
    "id, user_id, name, phone, email, total_spent, order_count"
  );

  return customers.map((customer) => ({
    email: text(customer.email) || null,
    id: text(customer.id),
    name: text(customer.name, "Unknown customer"),
    ordersCount: numberValue(customer.order_count),
    ownerEmail: owners.get(text(customer.user_id)) ?? text(customer.user_id, "Unknown owner"),
    phone: text(customer.phone) || null,
    totalSpent: numberValue(customer.total_spent)
  }));
}

export async function getAdminSubscriptions(): Promise<AdminSubscription[]> {
  const { supabase, users } = await getAdminUsersBase();
  const [subscriptions, stores, publishedStores, landings, domains, orders, invoices, billingEvents] = await Promise.all([
    safeSelect(
      supabase,
      "user_subscriptions",
      "id, user_id, plan_id, status, stripe_customer_id, stripe_subscription_id, current_period_start, current_period_end, cancel_at_period_end, created_at, limits_snapshot"
    ),
    safeSelect(supabase, "stores", "id, user_id, owner_user_id, workspace_id, name, store_name, slug, status, store_data"),
    safeSelect(supabase, "published_stores", "user_id, status"),
    safeSelect(supabase, "landing_pages", "user_id"),
    safeSelect(supabase, "commerce_domain_publications", "user_id"),
    safeSelect(supabase, "commerce_orders", "user_id"),
    safeSelect(supabase, "invoices", "user_id, provider, status, created_at"),
    safeSelect(supabase, "billing_events", "user_id, provider, event_type, created_at, processed_at")
  ]);
  const usersById = new Map(users.map((user) => [user.id, user]));
  const storeCounts = countStoresByOwner(stores);
  const storesByOwner = new Map<string, AnyRecord[]>();
  for (const store of stores) {
    const ownerId = ownerUserId(store);

    if (!ownerId) {
      continue;
    }

    storesByOwner.set(ownerId, [...(storesByOwner.get(ownerId) ?? []), store]);
  }
  const landingCounts = countBy(landings, "user_id");
  const domainCounts = countBy(domains, "user_id");
  const orderCounts = countBy(orders, "user_id");
  const publishedCounts = countBy(
    publishedStores.filter((row) => row.status === "published"),
    "user_id"
  );
  const invoicesByUser = new Map<string, AnyRecord[]>();
  for (const invoice of invoices) {
    const userId = text(invoice.user_id);

    if (!userId) {
      continue;
    }

    invoicesByUser.set(userId, [...(invoicesByUser.get(userId) ?? []), invoice]);
  }
  const billingEventsByUser = new Map<string, AnyRecord[]>();
  for (const event of billingEvents) {
    const userId = text(event.user_id);

    if (!userId) {
      continue;
    }

    billingEventsByUser.set(userId, [...(billingEventsByUser.get(userId) ?? []), event]);
  }

  return subscriptions.map((subscription) => {
    const userId = text(subscription.user_id);
    const user = usersById.get(userId);
    const plan = getBillingPlan(text(subscription?.plan_id, "free"));
    const metadata = isRecord(subscription?.limits_snapshot) ? subscription.limits_snapshot : {};
    const adminBilling = isRecord(metadata.adminBilling) ? metadata.adminBilling : {};
    const billingCycle = text(metadata.billingCycle, plan.id === "free" ? "not_available" : "monthly");
    const currency = text(metadata.currency, "USD").toUpperCase();
    const userInvoices = invoicesByUser.get(userId) ?? [];
    const userEvents = billingEventsByUser.get(userId) ?? [];
    const failedPayments =
      userInvoices.filter((invoice) => ["failed", "uncollectible", "void"].includes(text(invoice.status))).length +
      userEvents.filter((event) => text(event.event_type).toLowerCase().includes("payment_failed")).length;
    const billingProvider =
      text(userInvoices[0]?.provider) ||
      text(userEvents[0]?.provider) ||
      (text(subscription?.stripe_subscription_id) || text(subscription?.stripe_customer_id) ? "stripe" : "manual");
    const ownedStores = storesByOwner.get(userId) ?? [];
    const workspaceIds = [
      ...new Set(ownedStores.map((store) => text(store.workspace_id)).filter(Boolean))
    ];
    const storesUsed = storeCounts.get(userId) ?? 0;
    const domainsUsed = domainCounts.get(userId) ?? 0;
    const limitExceeded =
      (plan.storeLimit !== null && storesUsed > plan.storeLimit) ||
      (plan.domainLimit !== null && domainsUsed > plan.domainLimit);
    const status = text(subscription?.status, "active");
    const manualOverrideActive = adminBilling.manualOverrideActive === true;
    const billingReview = adminBilling.reviewStatus === "review";
    const currentPeriodEnd = text(subscription?.current_period_end) || null;
    const currentPeriodStart = text(subscription?.current_period_start) || null;
    const cancelAtPeriodEnd = subscription?.cancel_at_period_end === true;
    const providerSubscriptionId = text(subscription?.stripe_subscription_id) || null;
    const providerUrl =
      billingProvider === "stripe" && providerSubscriptionId
        ? `https://dashboard.stripe.com/subscriptions/${providerSubscriptionId}`
        : null;
    const renewalStatus =
      cancelAtPeriodEnd || status === "canceled" || status === "cancelled"
        ? "cancels_at_period_end"
        : ["active", "trialing"].includes(status)
          ? "renews"
          : "not_available";
    const warningBadges: AdminSubscription["warningBadges"] = [
      failedPayments > 0 ? "payment_failed" : null,
      status === "canceled" || status === "cancelled" ? "subscription_cancelled" : null,
      limitExceeded ? "limit_exceeded" : null,
      manualOverrideActive ? "manual_override_active" : null
    ].filter(Boolean) as AdminSubscription["warningBadges"];

    return {
      amount: plan.priceCents / 100,
      billingProvider,
      billingCycle,
      billingReview,
      cancelAtPeriodEnd,
      cancellationDate: cancelAtPeriodEnd ? currentPeriodEnd : null,
      createdAt: text(subscription?.created_at) || user?.createdAt || null,
      currency,
      currentPeriodEnd,
      currentPeriodStart,
      email: user?.email ?? text(userId, "Unknown owner"),
      failedPayments,
      domainLimit: plan.domainLimit === null ? "Unlimited" : String(plan.domainLimit),
      domainsUsed,
      invoices: userInvoices.slice(0, 5).map((invoice) => ({
        createdAt: text(invoice.created_at) || null,
        provider: text(invoice.provider, "not_available"),
        status: text(invoice.status, "not_available")
      })),
      landingLimit: plan.landingLimit === null ? "Unlimited" : String(plan.landingLimit),
      landingsUsed: landingCounts.get(userId) ?? 0,
      lastBillingEvent: userEvents.length
        ? {
            createdAt: text(userEvents[0].processed_at) || text(userEvents[0].created_at) || null,
            eventType: text(userEvents[0].event_type, "billing_event"),
            provider: text(userEvents[0].provider, "admin")
          }
        : null,
      manualOverrideActive,
      nextBillingDate: currentPeriodEnd,
      ordersUsed: orderCounts.get(userId) ?? 0,
      plan: plan.name,
      planId: plan.id,
      previousPlanId: text(adminBilling.previousPlanId) || null,
      providerSubscriptionId,
      providerUrl,
      publishedStoresUsed: publishedCounts.get(userId) ?? 0,
      renewalStatus,
      status,
      storeLimit: plan.storeLimit === null ? "Unlimited" : String(plan.storeLimit),
      stores: ownedStores.map((store) => ({
        id: text(store.id),
        name: text(store.store_name, text(store.name, "Untitled store")),
        slug: text(store.slug) || null,
        status: governanceStatus(store.store_data, text(store.status, "draft")),
        workspaceId: text(store.workspace_id) || null
      })),
      storesUsed,
      subscriptionId: text(subscription.id, userId),
      userId,
      warningBadges,
      workspaceIds
    };
  });
}

function envConfigured(names: string[]) {
  return names.some((name) => Boolean(process.env[name]));
}

function envConfigurationChecks(names: Array<{ label: string; names: string[] }>): AdminPaymentProviderControl["providers"][number]["configChecks"] {
  return names.map((entry) => ({
    label: entry.label,
    status: !entry.names.length
      ? "not_applicable"
      : entry.names.some((name) => Boolean(process.env[name]))
        ? "configured"
        : "missing"
  }));
}

function configurationStatusFromChecks(
  checks: AdminPaymentProviderControl["providers"][number]["configChecks"]
): AdminPaymentProviderControl["providers"][number]["configurationStatus"] {
  const applicable = checks.filter((check) => check.status !== "not_applicable");

  if (!applicable.length || applicable.every((check) => check.status === "configured")) {
    return "configured";
  }

  return applicable.some((check) => check.status === "configured") ? "partial" : "missing";
}

function providerMode(providerKey: string): AdminPaymentProviderControl["providers"][number]["environmentMode"] {
  if (providerKey.includes("paypal")) {
    return process.env.PAYPAL_ENVIRONMENT === "live" ? "live" : "sandbox";
  }

  if (providerKey.includes("stripe")) {
    return process.env.NODE_ENV === "production" ? "live" : "test";
  }

  return "placeholder";
}

function providerWarningList({
  configured,
  mode,
  webhookConfigured
}: {
  configured: boolean;
  mode: AdminPaymentProviderControl["providers"][number]["environmentMode"];
  webhookConfigured: boolean | null;
}) {
  const warnings: AdminPaymentProviderControl["providers"][number]["warnings"] = [];

  if (!configured) {
    warnings.push("provider_not_configured");
  }

  if (webhookConfigured === false) {
    warnings.push("webhook_missing");
  }

  if (mode === "test" || mode === "sandbox") {
    warnings.push("test_mode");
  }

  if (mode === "live" && webhookConfigured !== true) {
    warnings.push("live_mode_not_verified");
  }

  return warnings;
}

function recordsFromStoreData(storeData: unknown, key: string): AnyRecord[] {
  if (!isRecord(storeData) || !isRecord(storeData[key])) {
    return [];
  }

  return Object.values(storeData[key]).filter(isRecord);
}

function recordFromStoreDataById(storeData: unknown, key: string, id: string) {
  return recordsFromStoreData(storeData, key).find((record) => text(record.id) === id) ?? null;
}

function firstTextValue(record: AnyRecord, keys: string[]) {
  for (const key of keys) {
    const value = text(record[key]);

    if (value) {
      return value;
    }
  }

  return null;
}

function nestedRecord(value: unknown, key: string): AnyRecord | null {
  return isRecord(value) && isRecord(value[key]) ? value[key] : null;
}

function providerRegistrationResponse(providerRawResponse: unknown) {
  return nestedRecord(providerRawResponse, "registration") ?? responseRecord(providerRawResponse);
}

function responseRecord(value: unknown): AnyRecord {
  return isRecord(value) ? value : {};
}

function nameserverListFromWorkflow(workflow: AnyRecord) {
  const registrationResponse = nestedRecord(workflow.providerRawResponse, "registration");
  const candidates = [
    workflow.nameservers,
    workflow.nameServers,
    workflow.providerNameservers,
    registrationResponse?.nameservers,
    registrationResponse?.ns
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.map((value) => text(value)).filter(Boolean);
    }
  }

  return [];
}

function providerErrorFromWorkflow(workflow: AnyRecord) {
  const registrationError = isRecord(workflow.registrationError) ? workflow.registrationError : {};
  const directMessage = text(registrationError.message);

  return directMessage || extractHttpApiErrorMessage(workflow.providerRawResponse);
}

const sensitiveProviderResponseKeys = new Set([
  "address-line-1",
  "address-line-2",
  "address-line-3",
  "address1",
  "api-key",
  "api_key",
  "authorization",
  "auth",
  "city",
  "company",
  "country",
  "email",
  "name",
  "phone",
  "phone-cc",
  "state",
  "token",
  "zipcode",
  "zip"
]);

function sanitizedProviderResponse(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizedProviderResponse(item));
  }

  if (typeof value === "string") {
    return value
      .replace(/api-key=([^&\s]+)/gi, "api-key=[redacted]")
      .replace(/authorization=([^&\s]+)/gi, "authorization=[redacted]")
      .replace(/token=([^&\s]+)/gi, "token=[redacted]");
  }

  if (!isRecord(value)) {
    return value ?? null;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, nestedValue]) => [
      key,
      sensitiveProviderResponseKeys.has(key.toLowerCase())
        ? "[redacted]"
        : sanitizedProviderResponse(nestedValue)
    ])
  );
}

function timelineEvent({
  label,
  providerError = null,
  providerMessage = null,
  providerOrderId = null,
  status,
  timestamp = null
}: {
  label: string;
  providerError?: string | null;
  providerMessage?: string | null;
  providerOrderId?: string | null;
  status: "failed" | "info" | "pending" | "success";
  timestamp?: string | null;
}) {
  return {
    label,
    providerError,
    providerMessage,
    providerOrderId,
    status,
    timestamp
  };
}

function domainTimelineFromDraft({
  draft,
  providerMessage
}: {
  draft: AnyRecord;
  providerMessage?: string | null;
}) {
  const createdAt = text(draft.createdAt) || null;

  return [
    timelineEvent({
      label: "Draft created",
      providerMessage: providerMessage ?? (text(draft.paymentPreparationStatus) || null),
      status: "success",
      timestamp: createdAt
    }),
    timelineEvent({
      label: "Availability checked",
      providerMessage: providerMessage ?? "Domain availability confirmed before draft creation.",
      status: "success",
      timestamp: createdAt
    }),
    timelineEvent({
      label: "Waiting provider balance / locked processing",
      providerMessage: text(draft.platformBalanceSafetyStatus) || null,
      status: "info",
      timestamp: createdAt
    })
  ];
}

function idText(value: unknown) {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function contactCreateId(contactCreateResponse: unknown) {
  const direct = idText(contactCreateResponse);

  if (direct) {
    return direct;
  }

  return firstTextValue(responseRecord(contactCreateResponse), ["contactid", "contact-id", "entityid", "id"]);
}

function workflowTimelineEvents({
  contactCreateResponse,
  dnsSetup,
  draft,
  preview,
  providerErrorMessage,
  providerOrderId,
  registrationResponse,
  sslSetup,
  workflow
}: {
  contactCreateResponse: unknown;
  dnsSetup: AnyRecord;
  draft: AnyRecord | null;
  preview: AnyRecord | null;
  providerErrorMessage: string | null;
  providerOrderId: string | null;
  registrationResponse: AnyRecord;
  sslSetup: AnyRecord;
  workflow: AnyRecord;
}) {
  const status = text(workflow.status);
  const workflowCreatedAt = text(workflow.createdAt) || null;
  const orderId = providerOrderId;
  const providerStatus = firstTextValue(registrationResponse, ["status", "actionstatus", "actionStatus"]);
  const contactId = contactCreateId(contactCreateResponse);
  const dnsStatus = text(dnsSetup.status);
  const sslStatus = text(sslSetup.status);
  const events = [
    ...domainTimelineFromDraft({
      draft: draft ?? workflow,
      providerMessage: null
    })
  ];

  if (preview) {
    events.push(
      timelineEvent({
        label: "Checkout preview prepared",
        providerMessage: text(preview.status) || null,
        status: "success",
        timestamp: text(preview.createdAt) || null
      })
    );
  }

  events.push(
    timelineEvent({
      label: "Registration submitted",
      providerMessage: text(workflow.registrationStatus, status) || null,
      providerOrderId: orderId,
      status: "success",
      timestamp: workflowCreatedAt
    })
  );

  if (contactId || (isRecord(contactCreateResponse) && Object.keys(contactCreateResponse).length > 0)) {
    events.push(
      timelineEvent({
        label: "Provider contact created",
        providerMessage: contactId ? `Contact ID ${contactId}` : null,
        providerOrderId: orderId,
        status: contactId ? "success" : "info",
        timestamp: workflowCreatedAt
      })
    );
  }

  if (orderId || isRecord(registrationResponse)) {
    events.push(
      timelineEvent({
        label: "Provider order submitted",
        providerMessage: providerStatus,
        providerOrderId: orderId,
        status: providerErrorMessage ? "failed" : "success",
        timestamp: workflowCreatedAt
      })
    );
  }

  if (["registration_completed", "awaiting_dns", "ssl_pending", "ssl_active"].includes(status) && !providerErrorMessage) {
    events.push(
      timelineEvent({
        label: "Provider accepted",
        providerMessage: providerStatus ?? "Registration accepted by provider.",
        providerOrderId: orderId,
        status: "success",
        timestamp: workflowCreatedAt
      })
    );
  }

  if (providerErrorMessage || status === "registration_failed") {
    events.push(
      timelineEvent({
        label: "Provider failed",
        providerError: providerErrorMessage,
        providerOrderId: orderId,
        status: "failed",
        timestamp: workflowCreatedAt
      })
    );
  }

  if (["ready_for_registration", "registration_pending", "registration_processing"].includes(status)) {
    events.push(
      timelineEvent({
        label: "Waiting provider balance / locked processing",
        providerMessage: text(workflow.paymentConfirmationStatus) || null,
        providerOrderId: orderId,
        status: status === "registration_processing" ? "pending" : "info",
        timestamp: workflowCreatedAt
      })
    );
  }

  if (dnsStatus || ["awaiting_dns", "ssl_pending", "ssl_active"].includes(status)) {
    events.push(
      timelineEvent({
        label: "DNS pending",
        providerMessage: dnsStatus || null,
        providerOrderId: orderId,
        status: dnsStatus === "verified" ? "success" : "pending",
        timestamp: text(workflow.updatedAt) || workflowCreatedAt
      })
    );
  }

  if (sslStatus || ["ssl_pending", "ssl_active"].includes(status)) {
    events.push(
      timelineEvent({
        label: "SSL pending",
        providerMessage: sslStatus || null,
        providerOrderId: orderId,
        status: sslStatus === "ssl_active" ? "success" : "pending",
        timestamp: text(workflow.updatedAt) || workflowCreatedAt
      })
    );
  }

  if (status === "ssl_active" || sslStatus === "ssl_active") {
    events.push(
      timelineEvent({
        label: "Connected to store",
        providerMessage: text(workflow.status) || null,
        providerOrderId: orderId,
        status: "success",
        timestamp: text(workflow.updatedAt) || workflowCreatedAt
      })
    );
  }

  return events;
}

function centsValue(value: unknown) {
  return Math.max(0, Math.round(numberValue(value)));
}

function envConfigurationStatus(names: string[]): AdminIntegrationsControl["integrations"][number]["configurationStatus"] {
  if (!names.length) {
    return "configured";
  }

  const configuredCount = names.filter((name) => Boolean(process.env[name])).length;

  if (configuredCount === names.length) {
    return "configured";
  }

  return configuredCount > 0 ? "partial" : "missing";
}

function integrationSecretStatus(
  names: string[]
): AdminIntegrationsControl["integrations"][number]["secretStatus"] {
  const status = envConfigurationStatus(names);

  if (!names.length) {
    return "no_secret_required";
  }

  if (status === "configured") {
    return "masked_configured";
  }

  return status === "partial" ? "masked_partial" : "missing";
}

function integrationMode(providerKey: string): AdminIntegrationsControl["integrations"][number]["mode"] {
  if (providerKey === "paypal") {
    return process.env.PAYPAL_ENVIRONMENT === "live" ? "live" : "sandbox";
  }

  if (["openai", "stripe", "resend", "cloudflare_r2"].includes(providerKey)) {
    return process.env.NODE_ENV === "production" ? "live" : "test";
  }

  return "placeholder";
}

function aiVisualJobCost(job: AnyRecord) {
  const providerPlan = isRecord(job.providerPlan) ? job.providerPlan : {};
  const explicitCost = numberValue(providerPlan.estimatedCostUsd ?? providerPlan.estimatedCost);

  if (explicitCost > 0) {
    return explicitCost;
  }

  const kind = text(job.kind);

  if (kind.includes("hero") || kind.includes("banner")) {
    return 0.08;
  }

  return text(job.status) === "completed" ? 0.04 : 0;
}

function safeAIErrorSummary(value: unknown) {
  const raw = text(value, "").replace(/\s+/g, " ").trim();

  if (!raw) {
    return null;
  }

  return raw
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, "[redacted]")
    .replace(/\bAKIA[0-9A-Z]{16}\b/g, "[redacted]")
    .slice(0, 180);
}

function safeEmailSummary(value: unknown) {
  return (
    safeAIErrorSummary(value)
      ?.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
      .slice(0, 180) ?? "No error summary recorded."
  );
}

function maskedEmail(value: unknown) {
  const raw = text(value);
  const [local, domain] = raw.split("@");

  if (!local || !domain) {
    return raw ? "[masked-recipient]" : "Unknown recipient";
  }

  const visibleLocal = local.slice(0, 2);
  const domainParts = domain.split(".");
  const domainName = domainParts[0] ?? "";
  const extension = domainParts.slice(1).join(".");

  return `${visibleLocal}${"*".repeat(Math.max(2, local.length - 2))}@${domainName.slice(0, 1)}***${extension ? `.${extension}` : ""}`;
}

function maskedIP(value: unknown) {
  const raw = text(value);

  if (!raw) {
    return "IP not recorded";
  }

  if (raw.includes(":")) {
    const parts = raw.split(":").filter(Boolean);
    return `${parts.slice(0, 2).join(":")}:****`;
  }

  const parts = raw.split(".");

  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.***.***`;
  }

  return "[masked-ip]";
}

function safeSecuritySummary(value: unknown) {
  const raw = text(value, "").replace(/\s+/g, " ").trim();

  if (!raw) {
    return "No safe summary recorded.";
  }

  return raw
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, "[redacted]")
    .replace(/\b[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, "[redacted-token]")
    .replace(/\bAKIA[0-9A-Z]{16}\b/g, "[redacted]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .slice(0, 180);
}

function classifyAIError(value: string | null) {
  const error = (value ?? "").toLowerCase();

  if (!error) {
    return "provider_errors";
  }

  if (error.includes("r2") || error.includes("storage") || error.includes("bucket") || error.includes("upload")) {
    return "storage_errors";
  }

  if (error.includes("timeout") || error.includes("timed out")) {
    return "timeout_errors";
  }

  if (error.includes("prompt") || error.includes("invalid") || error.includes("moderation")) {
    return "invalid_prompt_errors";
  }

  return "provider_errors";
}

export async function getAdminPaymentProviderControl(): Promise<AdminPaymentProviderControl> {
  const { supabase, users } = await getAdminUsersBase();
  const owners = emailMap(users);
  const [
    stores,
    methods,
    connections,
    monitoringEvents,
    billingEvents
  ] = await Promise.all([
    safeSelect(supabase, "stores", "id, owner_user_id, user_id, name, store_name, slug"),
    safeSelect(supabase, "store_payment_methods", "store_id, method, is_enabled"),
    safeSelect(
      supabase,
      "store_payment_provider_connections",
      "store_id, provider, connection_mode, connection_status, config_status, charges_enabled, payouts_enabled, paypal_status, last_sync_at, environment, publishable_key, public_key"
    ),
    safeSelect(
      supabase,
      "monitoring_events",
      "event_type, event_status, entity_type, metadata, created_at",
      500
    ),
    safeSelect(supabase, "billing_events", "event_type, provider, payload, processed_at, created_at", 500)
  ]);
  const paymentProviderEvents = monitoringEvents.filter((event) => {
    const eventType = text(event.event_type).toLowerCase();
    const entityType = text(event.entity_type).toLowerCase();

    return entityType.includes("payment") || eventType.includes("payment") || eventType.includes("webhook");
  });
  const billingWebhookEvents = billingEvents.filter((event) => {
    const eventType = text(event.event_type).toLowerCase();

    return eventType.includes("webhook") || eventType.includes("invoice") || eventType.includes("payment");
  });
  const recentEvents = [
    ...paymentProviderEvents.map((event) => ({
      createdAt: text(event.created_at),
      eventStatus: text(event.event_status, "info"),
      eventType: text(event.event_type, "payment_event"),
      provider: text(isRecord(event.metadata) ? event.metadata.provider : null, "store")
    })),
    ...billingWebhookEvents.map((event) => ({
      createdAt: text(event.processed_at) || text(event.created_at),
      eventStatus: text(event.event_type).toLowerCase().includes("failed") ? "failed" : "success",
      eventType: text(event.event_type, "billing_event"),
      provider: text(event.provider, "billing")
    }))
  ].sort((left, right) => dateValue(right.createdAt) - dateValue(left.createdAt));
  const controlEvents = billingEvents
    .filter((event) => text(event.event_type).startsWith("admin_payment_provider_"))
    .sort((left, right) => dateValue(right.processed_at ?? right.created_at) - dateValue(left.processed_at ?? left.created_at));
  const latestControlByProvider = new Map<string, AnyRecord>();
  for (const event of controlEvents) {
    const payload = isRecord(event.payload) ? event.payload : {};
    const providerKey = text(payload.providerKey);

    if (providerKey && !latestControlByProvider.has(providerKey)) {
      latestControlByProvider.set(providerKey, event);
    }
  }
  const enabledMethods = methods.filter((method) => method.is_enabled === true);
  const connectedStoreCountsByProvider = new Map<string, number>();
  const configuredStoreCountsByProvider = new Map<string, number>();
  const latestSyncByProvider = new Map<string, string>();

  for (const connection of connections) {
    const provider = text(connection.provider);
    const storeId = text(connection.store_id);

    if (!provider || !storeId) {
      continue;
    }

    if (
      text(connection.connection_status) === "connected" ||
      text(connection.config_status) === "configured" ||
      text(connection.paypal_status) === "connected"
    ) {
      configuredStoreCountsByProvider.set(provider, (configuredStoreCountsByProvider.get(provider) ?? 0) + 1);
    }

    if (
      text(connection.connection_status) === "connected" ||
      (text(connection.config_status) === "configured" && (text(connection.publishable_key) || text(connection.public_key)))
    ) {
      connectedStoreCountsByProvider.set(provider, (connectedStoreCountsByProvider.get(provider) ?? 0) + 1);
    }

    const lastSyncAt = text(connection.last_sync_at);
    const currentLatest = latestSyncByProvider.get(provider);

    if (lastSyncAt && (!currentLatest || dateValue(lastSyncAt) > dateValue(currentLatest))) {
      latestSyncByProvider.set(provider, lastSyncAt);
    }
  }

  const enabledMethodCounts = new Map<string, number>();
  for (const method of enabledMethods) {
    const methodName = text(method.method);

    if (methodName) {
      enabledMethodCounts.set(methodName, (enabledMethodCounts.get(methodName) ?? 0) + 1);
    }
  }

  const providerDefinitions = [
    {
      checks: [
        { label: "Platform secret key", names: ["PLATFORM_BILLING_STRIPE_SECRET_KEY", "STRIPE_SECRET_KEY"] },
        { label: "Platform webhook secret", names: ["PLATFORM_BILLING_STRIPE_WEBHOOK_SECRET", "STRIPE_WEBHOOK_SECRET"] },
        { label: "Platform publishable key", names: ["NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "STRIPE_PUBLISHABLE_KEY"] }
      ],
      connectedStoresCount: 0,
      docsUrl: "https://docs.stripe.com/billing",
      key: "stripe_platform",
      name: "Stripe Platform Billing",
      scope: "platform_billing" as const,
      webhookConfigured: envConfigured(["PLATFORM_BILLING_STRIPE_WEBHOOK_SECRET", "STRIPE_WEBHOOK_SECRET"])
    },
    {
      checks: [
        { label: "Store payments secret key", names: ["STRIPE_SECRET_KEY"] },
        { label: "Stripe Connect client ID", names: ["STRIPE_CONNECT_CLIENT_ID"] }
      ],
      connectedStoresCount: Math.max(
        connectedStoreCountsByProvider.get("stripe") ?? 0,
        configuredStoreCountsByProvider.get("stripe") ?? 0
      ),
      docsUrl: "https://docs.stripe.com/connect",
      key: "stripe_store",
      name: "Stripe Store Payments",
      scope: "store_payments" as const,
      webhookConfigured: envConfigured(["STRIPE_WEBHOOK_SECRET"])
    },
    {
      checks: [
        { label: "NOWPayments API key", names: ["NOWPAYMENTS_API_KEY"] },
        { label: "NOWPayments IPN secret", names: ["NOWPAYMENTS_IPN_SECRET"] }
      ],
      connectedStoresCount: 0,
      docsUrl: "https://nowpayments.io/payment-integration",
      key: "nowpayments",
      name: "NOWPayments",
      scope: "platform_billing" as const,
      webhookConfigured: envConfigured(["NOWPAYMENTS_IPN_SECRET"])
    },
    {
      checks: [
        { label: "PayPal client ID", names: ["PAYPAL_CLIENT_ID"] },
        { label: "PayPal client secret", names: ["PAYPAL_CLIENT_SECRET"] },
        { label: "PayPal webhook ID", names: ["PAYPAL_WEBHOOK_ID"] }
      ],
      connectedStoresCount: 0,
      docsUrl: "https://developer.paypal.com/docs/api/orders/v2/",
      key: "paypal_platform",
      name: "PayPal Platform Billing",
      scope: "platform_billing" as const,
      webhookConfigured: envConfigured(["PAYPAL_WEBHOOK_ID"])
    },
    {
      checks: [
        { label: "PayPal client ID", names: ["PAYPAL_CLIENT_ID"] },
        { label: "PayPal client secret", names: ["PAYPAL_CLIENT_SECRET"] },
        { label: "PayPal partner merchant ID", names: ["PAYPAL_PARTNER_MERCHANT_ID"] }
      ],
      connectedStoresCount: Math.max(
        connectedStoreCountsByProvider.get("paypal") ?? 0,
        configuredStoreCountsByProvider.get("paypal") ?? 0
      ),
      docsUrl: "https://developer.paypal.com/docs/multiparty/",
      key: "paypal",
      name: "PayPal Store Payments",
      scope: "store_payments" as const,
      webhookConfigured: null
    },
    {
      checks: [
        { label: "YouCan Pay public key", names: ["YOUCANPAY_PUBLIC_KEY"] },
        { label: "YouCan Pay private key", names: ["YOUCANPAY_PRIVATE_KEY"] },
        { label: "YouCan Pay sandbox mode", names: ["YOUCANPAY_SANDBOX"] }
      ],
      connectedStoresCount: Math.max(
        connectedStoreCountsByProvider.get("youcan_pay") ?? 0,
        configuredStoreCountsByProvider.get("youcan_pay") ?? 0
      ),
      docsUrl: null,
      key: "youcan_pay",
      name: "YouCan Pay",
      scope: "store_payments" as const,
      webhookConfigured: null
    },
    {
      checks: [{ label: "Store-level instructions", names: [] }],
      connectedStoresCount: enabledMethodCounts.get("bank_transfer") ?? 0,
      docsUrl: null,
      key: "bank_transfer",
      name: "Bank Transfer",
      scope: "manual_offline" as const,
      webhookConfigured: null
    },
    {
      checks: [{ label: "Store-level manual methods", names: [] }],
      connectedStoresCount:
        (enabledMethodCounts.get("cod") ?? 0) +
        (enabledMethodCounts.get("cash_on_delivery") ?? 0) +
        (enabledMethodCounts.get("whatsapp") ?? 0) +
        (enabledMethodCounts.get("whatsapp_order") ?? 0),
      docsUrl: null,
      key: "manual_payments",
      name: "Manual Payments",
      scope: "manual_offline" as const,
      webhookConfigured: null
    }
  ];
  const providers: AdminPaymentProviderControl["providers"] = providerDefinitions.map((provider) => {
    const configChecks = envConfigurationChecks(provider.checks);
    const configurationStatus = configurationStatusFromChecks(configChecks);
    const configured = configurationStatus === "configured";
    const mode = providerMode(provider.key);
    const warnings = providerWarningList({
      configured,
      mode,
      webhookConfigured: provider.webhookConfigured
    });
    const controlEvent = latestControlByProvider.get(provider.key);
    const controlType = text(controlEvent?.event_type);
    const enabledStatus =
      controlType === "admin_payment_provider_mark_review"
        ? "under_review"
        : controlType === "admin_payment_provider_disable"
          ? "placeholder_disabled"
          : configured || provider.connectedStoresCount > 0
            ? "enabled"
            : "disabled";
    const providerEvents = recentEvents.filter((event) => {
      const eventProvider = event.provider.toLowerCase();

      return eventProvider === provider.key ||
        provider.key.includes(eventProvider) ||
        eventProvider.includes(provider.key.split("_")[0] ?? provider.key);
    });
    const hasFailures = providerEvents.some((event) => event.eventStatus === "failed");
    const lastCheckedAt =
      latestSyncByProvider.get(provider.key.replace("_store", "").replace("_platform", "")) ??
      text(controlEvent?.processed_at) ??
      text(controlEvent?.created_at) ??
      providerEvents[0]?.createdAt ??
      null;

    return {
      configurationStatus,
      configChecks,
      connectedStoresCount: provider.connectedStoresCount,
      docsUrl: provider.docsUrl,
      enabledStatus,
      environmentMode: mode,
      healthStatus:
        enabledStatus === "under_review"
          ? "needs_review"
          : !configured && provider.connectedStoresCount === 0
            ? "missing_config"
            : hasFailures || warnings.length
              ? "warning"
              : "healthy",
      key: provider.key,
      lastCheckedAt,
      lastEvent: providerEvents[0]?.eventType ?? null,
      name: provider.name,
      scope: provider.scope,
      warnings,
      webhookStatus:
        provider.webhookConfigured === null
          ? "not_applicable"
          : provider.webhookConfigured
            ? "configured"
            : "missing"
    };
  });
  const storesWithSavedPaymentMethods = new Set(
    methods.map((method) => text(method.store_id)).filter(Boolean)
  );
  const storesWithImplicitCod = new Set(
    stores
      .map((store) => text(store.id))
      .filter((storeId) => storeId && !storesWithSavedPaymentMethods.has(storeId))
  );
  const stripeStores = new Set(
    connections
      .filter(
        (connection) =>
          text(connection.provider) === "stripe" &&
          text(connection.connection_status) === "connected" &&
          connection.charges_enabled === true &&
          connection.payouts_enabled === true
      )
      .map((connection) => text(connection.store_id))
      .filter(Boolean)
  );
  const stripePendingStores = new Set(
    connections
      .filter(
        (connection) =>
          text(connection.provider) === "stripe" &&
          text(connection.connection_status) === "pending"
      )
      .map((connection) => text(connection.store_id))
      .filter(Boolean)
  );
  const stripeRestrictedStores = new Set(
    connections
      .filter(
        (connection) =>
          text(connection.provider) === "stripe" &&
          text(connection.connection_status) === "restricted"
      )
      .map((connection) => text(connection.store_id))
      .filter(Boolean)
  );
  const paypalStores = new Set(
    connections
      .filter(
        (connection) =>
          text(connection.provider) === "paypal" &&
          (text(connection.connection_status) === "connected" || text(connection.paypal_status) === "connected")
      )
      .map((connection) => text(connection.store_id))
      .filter(Boolean)
  );
  const codStores = new Set(
    [
      ...enabledMethods
        .filter((method) => text(method.method) === "cod")
        .map((method) => text(method.store_id))
        .filter(Boolean),
      ...storesWithImplicitCod
    ]
  );
  const externalMethodRisks = enabledMethods
    .filter((method) => {
      const storeId = text(method.store_id);
      const methodName = text(method.method);

      if (methodName === "paypal") {
        return !paypalStores.has(storeId);
      }

      if (methodName === "youcan_pay") {
        return !connections.some(
          (connection) =>
            text(connection.store_id) === storeId &&
            text(connection.provider) === "youcan_pay" &&
            text(connection.config_status) === "configured"
        );
      }

      return false;
    })
    .map((method) => {
      const store = stores.find((candidate) => text(candidate.id) === text(method.store_id));
      return {
        id: text(method.store_id),
        name: text(store?.store_name, text(store?.name, "Untitled store")),
        ownerEmail: owners.get(ownerUserId(store ?? {})) ?? text(ownerUserId(store ?? {}), "Unknown owner"),
        reason: `${text(method.method).replace(/_/g, " ")} enabled but provider connection is not ready.`,
        slug: text(store?.slug) || null
      };
    });
  const manualStores = new Set(
    [
      ...enabledMethods
        .filter((method) => ["cod", "whatsapp"].includes(text(method.method)))
        .map((method) => text(method.store_id))
        .filter(Boolean),
      ...storesWithImplicitCod
    ]
  );
  const storesWithPayment = new Set([
    ...stripeStores,
    ...paypalStores,
    ...manualStores,
    ...enabledMethods
      .map((method) => text(method.store_id))
      .filter(Boolean)
  ]);
  const paymentSetupRisks = [
    ...externalMethodRisks,
    ...stores
      .filter((store) => !storesWithPayment.has(text(store.id)))
      .map((store) => ({
        id: text(store.id),
        name: text(store.store_name, text(store.name, "Untitled store")),
        ownerEmail: owners.get(ownerUserId(store)) ?? text(ownerUserId(store), "Unknown owner"),
        reason: "No enabled payment method or connected provider found.",
        slug: text(store.slug) || null
      }))
  ].slice(0, 25);

  return {
    paymentSetupRisks,
    providers,
    storePaymentAdoption: {
      codStores: codStores.size,
      manualStores: manualStores.size,
      missingPaymentMethodStores: paymentSetupRisks.length,
      paypalStores: paypalStores.size,
      stripePendingStores: stripePendingStores.size,
      stripeRestrictedStores: stripeRestrictedStores.size,
      stripeStores: stripeStores.size,
      totalStores: stores.length
    },
    webhookMonitoring: {
      failedEvents: recentEvents.filter((event) => event.eventStatus === "failed").length,
      recentEvents: recentEvents.slice(0, 20),
      totalEvents: recentEvents.length
    }
  };
}

export async function getAdminIntegrationsControl(): Promise<AdminIntegrationsControl> {
  const { supabase } = await getAdminUsersBase();
  const [monitoringEvents, billingEvents, healthStates] = await Promise.all([
    safeSelect(supabase, "monitoring_events", "event_type, event_status, entity_type, metadata, created_at", 500),
    safeSelect(supabase, "billing_events", "event_type, provider, payload, processed_at, created_at", 500),
    listIntegrationHealth()
  ]);
  const definitions = integrationDefinitions;
  const healthByProvider = new Map(healthStates.map((health) => [health.providerKey, health]));
  const controlEvents = monitoringEvents
    .filter((event) => text(event.event_type).startsWith("admin_integration_"))
    .sort((left, right) => dateValue(right.created_at) - dateValue(left.created_at));
  const latestControlByIntegration = new Map<string, AnyRecord>();

  for (const event of controlEvents) {
    const metadata = isRecord(event.metadata) ? event.metadata : {};
    const integrationKey = text(metadata.integration_key);

    if (integrationKey && !latestControlByIntegration.has(integrationKey)) {
      latestControlByIntegration.set(integrationKey, event);
    }
  }

  const providerEventDates = new Map<string, string>();
  const providerFailures = new Map<string, number>();
  const recordProviderSignal = ({
    createdAt,
    failed,
    provider
  }: {
    createdAt: string;
    failed: boolean;
    provider: string;
  }) => {
    const key = provider.toLowerCase();

    if (!key) {
      return;
    }

    if (!providerEventDates.has(key) || dateValue(createdAt) > dateValue(providerEventDates.get(key))) {
      providerEventDates.set(key, createdAt);
    }

    if (failed) {
      providerFailures.set(key, (providerFailures.get(key) ?? 0) + 1);
    }
  };

  for (const event of monitoringEvents) {
    const metadata = isRecord(event.metadata) ? event.metadata : {};
    recordProviderSignal({
      createdAt: text(event.created_at),
      failed: text(event.event_status) === "failed",
      provider: text(metadata.provider, text(event.entity_type))
    });
  }

  for (const event of billingEvents) {
    recordProviderSignal({
      createdAt: text(event.processed_at) || text(event.created_at),
      failed: text(event.event_type).toLowerCase().includes("failed"),
      provider: text(event.provider)
    });
  }

  const integrations: AdminIntegrationsControl["integrations"] = definitions.map((definition) => {
    const configurationStatus = envConfigurationStatus(definition.requiredEnv);
    const controlEvent = latestControlByIntegration.get(definition.key);
    const controlType = text(controlEvent?.event_type);
    const health = healthByProvider.get(definition.key);
    const providerLookupKeys = [
      definition.key,
      definition.name.toLowerCase(),
      definition.key.replace(/_/g, "")
    ];
    const lastChecked =
      text(controlEvent?.created_at) ||
      providerLookupKeys.map((key) => providerEventDates.get(key)).find(Boolean) ||
      null;
    const hasFailures = providerLookupKeys.some((key) => (providerFailures.get(key) ?? 0) > 0);
    const enabledStatus =
      controlType === "admin_integration_mark_review"
        ? "under_review"
        : configurationStatus === "missing"
          ? "disabled"
          : "enabled";
    const healthStatus =
      enabledStatus === "under_review"
        ? "needs_review"
        : configurationStatus === "missing"
          ? "missing_config"
          : configurationStatus === "partial" || hasFailures
            ? "warning"
            : definition.requiredEnv.length
              ? "healthy"
              : "placeholder";

    return {
      category: definition.category,
      configurationStatus,
      consecutiveFailures: health?.consecutiveFailures ?? 0,
      enabledStatus,
      healthStatus: health?.status === "not_checked" || !health ? healthStatus : health.status,
      key: definition.key,
      lastChecked: health?.lastCheckedAt ?? lastChecked,
      lastErrorCode: health?.lastErrorCode ?? null,
      lastErrorMessage: health?.lastErrorMessage ?? null,
      lastFailureAt: health?.lastFailureAt ?? null,
      lastSafeResponseSummary: health?.lastSafeResponseSummary ?? {},
      lastSuccessAt: health?.lastSuccessAt ?? null,
      mode: integrationMode(definition.key),
      name: definition.name,
      responseTimeMs: health?.responseTimeMs ?? null,
      secretStatus: integrationSecretStatus(definition.requiredEnv)
    };
  });
  const webhooks: AdminIntegrationsControl["webhooks"] = [
    {
      name: "Stripe billing webhook",
      provider: "Stripe",
      recentFailures: providerFailures.get("stripe") ?? 0,
      retryStatus: "retry_placeholder_only",
      status: envConfigured(["STRIPE_WEBHOOK_SECRET", "PLATFORM_BILLING_STRIPE_WEBHOOK_SECRET"]) ? "configured" : "missing"
    },
    {
      name: "NOWPayments IPN",
      provider: "NOWPayments",
      recentFailures: providerFailures.get("nowpayments") ?? 0,
      retryStatus: "retry_placeholder_only",
      status: envConfigured(["NOWPAYMENTS_IPN_SECRET"]) ? "configured" : "missing"
    },
    {
      name: "Store payment webhooks",
      provider: "Store payments",
      recentFailures: providerFailures.get("store_payments") ?? 0,
      retryStatus: "retry_placeholder_only",
      status: "placeholder"
    },
    {
      name: "Domain/email/hosting webhooks",
      provider: "Domain & Hosting",
      recentFailures: providerFailures.get("domain_service") ?? 0,
      retryStatus: "retry_placeholder_only",
      status: "placeholder"
    }
  ];
  const categories = [...new Set(definitions.map((definition) => definition.category))];

  return {
    categories,
    futureHooks: [
      "Test connection",
      "Rotate secret",
      "Disable provider",
      "Enable provider",
      "Sync provider status",
      "Export integration report"
    ],
    integrations,
    overview: {
      configured: integrations.filter((integration) => integration.configurationStatus === "configured").length,
      missing: integrations.filter((integration) => integration.configurationStatus === "missing").length,
      partial: integrations.filter((integration) => integration.configurationStatus === "partial").length,
      total: integrations.length,
      underReview: integrations.filter((integration) => integration.enabledStatus === "under_review").length,
      webhookFailures: webhooks.reduce((total, webhook) => total + webhook.recentFailures, 0)
    },
    webhooks
  };
}

export async function getAdminAIControl(): Promise<AdminAIControl> {
  const { supabase, users } = await getAdminUsersBase();
  const owners = emailMap(users);
  const [stores, legacyQueues, legacyResults, monitoringEvents] = await Promise.all([
    safeSelect(supabase, "stores", "id, owner_user_id, user_id, name, store_name, slug, store_data, created_at"),
    safeSelect(
      supabase,
      "ai_generation_queue",
      "id, store_instance_id, owner_user_id, workflow_state, queue_status, attempts, max_attempts, completed_at, failed_at, error_message, created_at, updated_at",
      500
    ),
    safeSelect(
      supabase,
      "ai_generation_results",
      "id, store_instance_id, owner_user_id, result_status, cost_estimate, metadata, created_at, updated_at",
      500
    ),
    safeSelect(supabase, "monitoring_events", "event_type, event_status, entity_type, metadata, created_at", 500)
  ]);
  const storeById = new Map(stores.map((store) => [text(store.id), store]));
  const jobs: AdminAIControl["jobs"] = [];

  for (const store of stores) {
    const storeId = text(store.id);
    const queue = aiVisualQueueFromStoreData(store.store_data);
    const ownerId = ownerUserId(store);
    const ownerEmail = owners.get(ownerId) ?? text(ownerId, "Unknown owner");
    const storeName = text(store.store_name, text(store.name, text(store.slug, "Untitled store")));

    for (const job of Object.values(queue.jobs) as AnyRecord[]) {
      const result = isRecord(job.result) ? job.result : {};
      const asset = isRecord(result.asset) ? result.asset : {};
      const errorSummary = safeAIErrorSummary(job.error);

      jobs.push({
        assetUrl: text(result.publicUrl) || text(asset.publicUrl) || text(asset.url) || null,
        completedAt: text(job.completedAt) || null,
        costEstimate: aiVisualJobCost(job),
        createdAt: text(job.createdAt, text(store.created_at)),
        errorSummary,
        id: text(job.jobId, text(job.requestId, `${storeId}-ai-visual-job`)),
        jobType: text(job.kind, text(job.slot, "ai_visual")),
        ownerEmail,
        provider: text(job.provider, "ai_visual_provider"),
        status: text(job.status, "pending"),
        storeId,
        storeName
      });
    }
  }

  for (const queue of legacyQueues) {
    const storeId = text(queue.store_instance_id);
    const store = storeById.get(storeId);
    const ownerId = text(queue.owner_user_id) || (store ? ownerUserId(store) : "");
    const ownerEmail = owners.get(ownerId) ?? text(ownerId, "Unknown owner");
    const status = text(queue.queue_status, text(queue.workflow_state, "waiting"));
    const errorSummary = safeAIErrorSummary(queue.error_message);

    jobs.push({
      assetUrl: null,
      completedAt: text(queue.completed_at) || text(queue.failed_at) || null,
      costEstimate: 0,
      createdAt: text(queue.created_at),
      errorSummary,
      id: text(queue.id),
      jobType: text(queue.workflow_state, "store_generation"),
      ownerEmail,
      provider: "workflow_placeholder",
      status,
      storeId: storeId || null,
      storeName: store ? text(store.store_name, text(store.name, "Untitled store")) : "AI workflow"
    });
  }

  for (const result of legacyResults) {
    const status = text(result.result_status);

    if (status !== "failed" && status !== "succeeded") {
      continue;
    }

    const storeId = text(result.store_instance_id);
    const store = storeById.get(storeId);
    const ownerId = text(result.owner_user_id) || (store ? ownerUserId(store) : "");
    const ownerEmail = owners.get(ownerId) ?? text(ownerId, "Unknown owner");
    const costEstimate = isRecord(result.cost_estimate)
      ? numberValue(result.cost_estimate.totalUsd ?? result.cost_estimate.estimatedUsd ?? result.cost_estimate.total)
      : 0;

    jobs.push({
      assetUrl: null,
      completedAt: text(result.updated_at) || null,
      costEstimate,
      createdAt: text(result.created_at),
      errorSummary: status === "failed" ? "Legacy AI generation result failed." : null,
      id: text(result.id),
      jobType: "legacy_ai_generation_result",
      ownerEmail,
      provider: "ai_result_placeholder",
      status: status === "succeeded" ? "completed" : "failed",
      storeId: storeId || null,
      storeName: store ? text(store.store_name, text(store.name, "Untitled store")) : "AI result"
    });
  }

  jobs.sort((left, right) => dateValue(right.createdAt) - dateValue(left.createdAt));
  const jobsByStore = new Map<string, AdminAIControl["storeUsage"][number]>();

  for (const job of jobs) {
    if (!job.storeId) {
      continue;
    }

    const current = jobsByStore.get(job.storeId) ?? {
      completed: 0,
      estimatedCost: 0,
      failed: 0,
      lastActivity: null,
      ownerEmail: job.ownerEmail,
      storeId: job.storeId,
      storeName: job.storeName,
      totalJobs: 0
    };

    current.totalJobs += 1;
    current.completed += job.status === "completed" || job.status === "succeeded" ? 1 : 0;
    current.failed += job.status === "failed" ? 1 : 0;
    current.estimatedCost += job.costEstimate;
    current.lastActivity =
      !current.lastActivity || dateValue(job.createdAt) > dateValue(current.lastActivity)
        ? job.createdAt
        : current.lastActivity;
    jobsByStore.set(job.storeId, current);
  }

  const assetTypeCounts = countBy(jobs.map((job) => ({ jobType: job.jobType })), "jobType");
  const topAssetTypes = [...assetTypeCounts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([assetType, count]) => `${assetType} (${count})`)
    .join(", ") || "No AI assets yet";
  const failureCounts = new Map<string, number>([
    ["provider_errors", 0],
    ["storage_errors", 0],
    ["timeout_errors", 0],
    ["invalid_prompt_errors", 0]
  ]);

  for (const job of jobs.filter((item) => item.status === "failed")) {
    const key = classifyAIError(job.errorSummary);
    failureCounts.set(key, (failureCounts.get(key) ?? 0) + 1);
  }

  for (const event of monitoringEvents) {
    const eventType = text(event.event_type).toLowerCase();
    const entityType = text(event.entity_type).toLowerCase();

    if ((eventType.includes("ai") || entityType.includes("ai")) && text(event.event_status) === "failed") {
      failureCounts.set("provider_errors", (failureCounts.get("provider_errors") ?? 0) + 1);
    }
  }

  const runtime = getAIVisualProviderRuntimeConfig();
  const openAIConfigured = runtime.apiKeyConfigured && runtime.status === "configured";

  return {
    failureMonitoring: [
      { count: jobs.filter((job) => job.status === "failed").length, label: "Failed jobs", note: "Failed AI visual and legacy AI workflow jobs." },
      { count: failureCounts.get("provider_errors") ?? 0, label: "Provider errors", note: "Provider or generic AI failures from safe metadata." },
      { count: failureCounts.get("storage_errors") ?? 0, label: "Storage errors", note: "R2/storage/upload related failures." },
      { count: failureCounts.get("timeout_errors") ?? 0, label: "Timeout errors", note: "Jobs that timed out or exceeded processing limits." },
      { count: failureCounts.get("invalid_prompt_errors") ?? 0, label: "Invalid prompt/errors", note: "Prompt, moderation, or invalid request failures." }
    ],
    futureHooks: [
      "Pause AI provider",
      "Disable AI for store",
      "Retry failed job",
      "Export AI usage report",
      "Cost limit enforcement"
    ],
    jobs: jobs.slice(0, 100),
    overview: {
      completedJobs: jobs.filter((job) => job.status === "completed" || job.status === "succeeded").length,
      estimatedCost: jobs.reduce((total, job) => total + job.costEstimate, 0),
      failedJobs: jobs.filter((job) => job.status === "failed").length,
      pendingJobs: jobs.filter((job) => job.status === "pending" || job.status === "waiting").length,
      processingJobs: jobs.filter((job) => job.status === "processing" || job.status === "active").length,
      storesUsingAI: jobsByStore.size,
      topAssetTypes,
      totalJobs: jobs.length
    },
    providers: [
      {
        configurationStatus:
          runtime.status === "disabled" ? "disabled" : openAIConfigured ? "configured" : "missing",
        costTracking: "estimated_from_safe_job_metadata",
        healthStatus:
          runtime.status === "disabled"
            ? "placeholder"
            : openAIConfigured
              ? "healthy"
              : "missing_config",
        name: "OpenAI",
        provider: runtime.provider,
        secretStatus: openAIConfigured ? "masked_configured" : "missing"
      },
      {
        configurationStatus: "disabled",
        costTracking: "future_provider_placeholder",
        healthStatus: "placeholder",
        name: "Future AI providers",
        provider: "replicate/stability/custom",
        secretStatus: "no_secret_required"
      }
    ],
    storeUsage: [...jobsByStore.values()]
      .sort((left, right) => right.totalJobs - left.totalJobs)
      .slice(0, 50)
  };
}

function platformLanguageRows(page: PlatformPageRegistryRecord) {
  const statuses = getPlatformTranslationStatus(page);

  return (["en", "ar", "fr"] as const).map((language) => ({
    language,
    status: statuses[language]
  }));
}

function platformPageDefinitionFromRegistry(page: PlatformPageRegistryRecord) {
  const openGraphStatus = isRecord(page.openGraph) && Object.keys(page.openGraph).length
    ? text(page.openGraph.status) || "ready"
    : "missing";
  const languages = platformLanguageRows(page);
  const translationValidation = validatePlatformTranslations(page);
  const contentReady = page.contentStatus !== "placeholder";
  const routeReady = Boolean(page.routePath);
  const seoReady = Boolean(page.seoTitle && page.seoDescription);
  const missingOpenGraph = !isRecord(page.openGraph) ||
    !text(page.openGraph.title) ||
    !text(page.openGraph.description) ||
    !text(page.openGraph.image_url);
  const translationStatus = languages.every((language) => language.status === "ready")
    ? "ready" as const
    : languages.some((language) => language.status === "partial")
      ? "partial" as const
      : "missing" as const;
  const publishingStatus: AdminPlatformWebsiteControl["pages"][number]["publishingStatus"] = page.status === "published"
    ? "Published"
    : page.status === "archived"
      ? "Archived"
      : !contentReady
        ? "Needs Content"
        : !seoReady
          ? "Needs SEO"
          : "Draft";

  return {
    canonical: page.canonicalPath || page.routePath,
    contentStatus: page.contentStatus,
    id: page.id,
    isLive: page.status === "published" && isConnectedPlatformRoute(page.routePath),
    languages,
    lastUpdated: page.updatedAt,
    metaDescription: page.seoDescription || "Platform SEO metadata is missing from content storage.",
    metaTitle: page.seoTitle || `${page.title} - SHASTORE AI`,
    openGraph: openGraphStatus,
    previewHref: page.status === "published" ? page.routePath : null,
    route: page.routePath,
    publishingReadiness: {
      contentReady,
      routeReady,
      seoReady,
      translationStatus
    },
    publishingStatus,
    section: page.pageType.replaceAll("_", " "),
    seoReadiness: {
      isReady: Boolean(page.seoTitle && page.seoDescription && page.canonicalPath && !missingOpenGraph),
      missingCanonical: !page.canonicalPath,
      missingDescription: !page.seoDescription,
      missingOpenGraph,
      missingTitle: !page.seoTitle
    },
    seoStatus: page.seoStatus,
    slug: page.slug,
    status: page.status,
    title: page.title,
    translationMissingFields: translationValidation.missingFields
  };
}

export async function getAdminPlatformWebsiteControl(
  analyticsRange?: string | null,
  monitoringFilters?: PlatformWebsiteMonitoringFilters
): Promise<AdminPlatformWebsiteControl> {
  const [registryPages, blogPosts, blogCategories, blogTags, advancedPublishing, analytics, monitoring, certification] = await Promise.all([
    ensurePlatformPagesRegistry(),
    listPlatformBlogPosts(),
    listCategories(),
    listTags(),
    getAdvancedPublishingDashboard(),
    getPlatformAnalyticsSummary(analyticsRange),
    getPlatformWebsiteMonitoring(monitoringFilters),
    getPlatformWebsiteCertification()
  ]);
  const pageDefinitions = registryPages.map((page) => platformPageDefinitionFromRegistry(page));
  const pages: AdminPlatformWebsiteControl["pages"] = pageDefinitions;
  const readyRoutes = new Set(pages.filter((page) => page.status === "published").map((page) => page.canonical));
  const landingStatus = [
    { label: "Homepage ready", ready: readyRoutes.has("/"), route: "/" },
    { label: "Pricing ready", ready: readyRoutes.has("/pricing"), route: "/pricing" },
    { label: "Features ready", ready: readyRoutes.has("/features"), route: "/features" },
    { label: "Contact ready", ready: readyRoutes.has("/contact"), route: "/contact" },
    { label: "Legal ready", ready: readyRoutes.has("/legal"), route: "/legal" },
    { label: "Reseller page ready", ready: readyRoutes.has("/reseller"), route: "/reseller" }
  ];

  return {
    advancedPublishing,
    analytics,
    certification,
    monitoring,
    blogFoundation: {
      archivedPosts: blogPosts.filter((post) => post.status === "archived").length,
      categories: blogCategories,
      draftPosts: blogPosts.filter((post) => post.status === "draft").length,
      publishedPosts: blogPosts.filter((post) => post.status === "published").length,
      recentPosts: blogPosts.slice(0, 10),
      tags: blogTags,
      totalCategories: blogCategories.length,
      totalPosts: blogPosts.length,
      totalTags: blogTags.length
    },
    futureHooks: [
      "Platform page editor",
      "Platform blog editor",
      "Landing page builder",
      "SEO generator",
      "Translation workflow",
      "Publish workflow"
    ],
    landingStatus,
    overview: {
      archivedPages: pages.filter((page) => page.status === "archived").length,
      draftPages: pages.filter((page) => page.status === "draft").length,
      publishedPages: pages.filter((page) => page.status === "published").length,
      readyLandingPages: landingStatus.filter((item) => item.ready).length,
      seoReadyPages: pages.filter((page) => page.seoStatus === "ready").length,
      totalPages: pages.length
    },
    pages
  };
}

function platformThemeJsonValue(value: Record<string, unknown>, fallback: string) {
  return text(value.value) ||
    text(value.text) ||
    text(value.hex) ||
    text(value.path) ||
    text(value.url) ||
    text(value.stack) ||
    text(value.mode) ||
    fallback;
}

function platformThemeValue(
  section: PlatformThemeRegistrySection | undefined,
  setting: PlatformBrandSettingRecord | undefined,
  fallback: string
) {
  if (setting) return platformThemeJsonValue(setting.draftValue, fallback);
  if (!section) return fallback;

  return platformThemeJsonValue(section.value, fallback);
}

export async function getAdminPlatformThemeControl(): Promise<AdminPlatformThemeControl> {
  const [registrySections, draft, publishReadiness, currentLogo, currentFavicon, assets, publicTheme, adminTheme, versions, presets, whiteLabelRecord] = await Promise.all([
    ensurePlatformThemeRegistry(),
    getThemeDraft(),
    validateThemeBeforePublish(),
    getCurrentPlatformLogo(),
    getCurrentPlatformFavicon(),
    listPlatformThemeAssets(),
    resolvePlatformBranding(),
    resolveAdminBranding(),
    listThemeVersions(),
    listThemePresets(),
    getWhiteLabelSettings()
  ]);
  const sectionsByKey = new Map(registrySections.map((section) => [section.sectionKey, section]));
  const settingsByKey = new Map(draft.settings.map((setting) => [setting.settingKey, setting]));
  const branding: AdminPlatformThemeControl["branding"] = {
    accentColor: platformThemeValue(sectionsByKey.get("accent_color"), settingsByKey.get("accent_color"), "#f97316"),
    darkMode: platformThemeValue(sectionsByKey.get("dark_mode"), settingsByKey.get("dark_mode"), "placeholder"),
    favicon: platformThemeValue(sectionsByKey.get("favicon"), settingsByKey.get("favicon"), "Platform favicon placeholder"),
    lightMode: platformThemeValue(sectionsByKey.get("light_mode"), settingsByKey.get("light_mode"), "placeholder"),
    logo: platformThemeValue(sectionsByKey.get("platform_logo"), settingsByKey.get("platform_logo"), "SHASTORE AI"),
    primaryColor: platformThemeValue(sectionsByKey.get("primary_color"), settingsByKey.get("primary_color"), "#0f172a"),
    secondaryColor: platformThemeValue(sectionsByKey.get("secondary_color"), settingsByKey.get("secondary_color"), "#2563eb"),
    typography: platformThemeValue(sectionsByKey.get("typography"), settingsByKey.get("typography"), "Inter / system sans")
  };

  return {
    assets,
    adminTheme,
    branding,
    draft,
    favicon: currentFavicon.favicon,
    futureHooks: [] as string[],
    logo: currentLogo.logo,
    publicTheme,
    publishReadiness,
    previews: {
      adminDashboard: [
        {
          description: "Sidebar preview uses platform admin navigation styling only.",
          label: "Sidebar preview",
          status: "ready"
        },
        {
          description: "Card preview mirrors current Super Admin card surfaces.",
          label: "Card preview",
          status: "ready"
        },
        {
          description: "Badge preview uses existing AdminBadge tones.",
          label: "Badge preview",
          status: "ready"
        },
        {
          description: "Button preview is a placeholder for future admin button theming.",
          label: "Button preview",
          status: "placeholder"
        }
      ],
      publicWebsite: [
        {
          description: "Navbar preview mirrors SHASTORE platform marketing navigation.",
          label: "Navbar preview",
          status: "ready"
        },
        {
          description: "Hero preview shows platform public website direction, not a store template.",
          label: "Hero preview",
          status: "ready"
        },
        {
          description: "Button preview uses platform CTA colors.",
          label: "Button preview",
          status: "ready"
        },
        {
          description: "Footer preview is reserved until platform footer management is built.",
          label: "Footer preview",
          status: "placeholder"
        }
      ]
    },
    readiness: [
      { direction: "RTL", language: "Arabic", status: "placeholder" },
      { direction: "LTR", language: "English", status: "ready" },
      { direction: "LTR", language: "French", status: "placeholder" }
    ],
    sections: registrySections.map((section) => ({
      description: section.description ?? "Platform theme registry section.",
      draftChanged: settingsByKey.get(section.sectionKey)?.hasChanged ?? false,
      lastSavedAt: settingsByKey.get(section.sectionKey)?.updatedAt ?? null,
      label: section.sectionLabel,
      publishedValue: settingsByKey.get(section.sectionKey)?.publishedDisplayValue ?? "Not published",
      settingKey: section.sectionKey,
      settingType: section.sectionType,
      status: section.status,
      validationStatus: settingsByKey.get(section.sectionKey)?.validationStatus ?? "placeholder",
      validationMessage: settingsByKey.get(section.sectionKey)?.validationMessage ?? null,
      value: platformThemeValue(section, settingsByKey.get(section.sectionKey), "Not configured")
    })),
    presets,
    versions,
    whiteLabel: {
      draft: whiteLabelRecord.draft,
      hasDraftChanges: whiteLabelRecord.hasDraftChanges,
      hasPublished: whiteLabelRecord.hasPublished,
      published: whiteLabelRecord.published,
      status: whiteLabelRecord.status,
      validation: whiteLabelRecord.validation
    }
  };
}

export async function getAdminTemplateManagementControl(): Promise<AdminTemplateManagementControl> {
  const { supabase, users } = await getAdminUsersBase();
  const owners = emailMap(users);
  const [registryTemplates, stats, activationStats, stores, allVersions, visibilityStats, archivedTemplates, officialStats, recommendedStats, recommendedTemplates, allPackages, packageStats, allScreenshots, allAssets, allInstalls, allAssignments, allIsolationSnapshots, allUpdateJobs, allRollbackJobs, installTargetStores, allMarketplaceListings, marketplaceListingStats, marketplaceCatalogPreview, marketplaceApprovalStats, marketplaceApprovalQueue, templatePublishEvents, resellerProfiles, allResellerTemplateAccess, resellerTemplateStats] =
    await Promise.all([
    listTemplates(),
    getTemplateRegistryStats(),
    getTemplateActivationStats(),
    safeSelect(supabase, "stores", "id, template_id, store_data, created_at, updated_at", 1000),
    listAllTemplateVersions(),
    getTemplateVisibilityStats(),
    listArchivedTemplates(),
    getOfficialTemplateStats(),
    getRecommendedTemplateStats(),
    listRecommendedTemplates(),
    listTemplatePackages(),
    getTemplatePackageStats(),
    listAllTemplateScreenshots(),
    listAllTemplateAssets(),
    listTemplateInstalls(200),
    listStoreTemplateAssignments({ limit: 200 }),
    listStoreThemeIsolationIssues({ limit: 200 }),
    listTemplateUpdateJobs({ limit: 200 }),
    listTemplateRollbackJobs({ limit: 200 }),
    safeSelect(supabase, "stores", "id, name, store_name, slug, user_id, workspace_id", 500),
    listMarketplaceListings({ limit: 200 }),
    getMarketplaceListingStats(),
    getMarketplaceCatalogPreview(),
    getMarketplaceApprovalStats(),
    listPendingMarketplaceListings(),
    listTemplatePublishEvents({ limit: 50 }),
    safeSelect(supabase, "reseller_profiles", "id, slug, display_name", 500),
    listResellerTemplates({ limit: 200 }),
    getResellerTemplateStats()
  ]);

  const draftPublishReadiness = await Promise.all(
    allVersions
      .filter((version) => version.status === "draft")
      .map(async (version) => ({
        versionId: version.id,
        readiness: await validateTemplateVersionPublish(version.id)
      }))
  );
  const publishReadinessByVersionId = new Map(
    draftPublishReadiness.map((entry) => [
      entry.versionId,
      {
        canPublish: entry.readiness.canPublish,
        issues: entry.readiness.issues
      }
    ])
  );

  const packageValidations = await Promise.all(
    allPackages.map(async (pkg) => ({
      templateId: pkg.templateId,
      validation: await validateTemplatePackage(pkg.templateId)
    }))
  );
  const validationByTemplateId = new Map(
    packageValidations.map((entry) => [entry.templateId, entry.validation])
  );
  const packagesByTemplateId = new Map(allPackages.map((pkg) => [pkg.templateId, pkg]));
  const screenshotsByTemplateId = new Map<string, typeof allScreenshots>();

  for (const screenshot of allScreenshots) {
    const existing = screenshotsByTemplateId.get(screenshot.templateId) ?? [];
    existing.push(screenshot);
    screenshotsByTemplateId.set(screenshot.templateId, existing);
  }

  const assetsByTemplateId = new Map<string, typeof allAssets>();

  for (const asset of allAssets) {
    const existing = assetsByTemplateId.get(asset.templateId) ?? [];
    existing.push(asset);
    assetsByTemplateId.set(asset.templateId, existing);
  }

  const templateKeyByRegistryId = new Map(registryTemplates.map((template) => [template.id, template.templateKey]));
  const templateNameByRegistryId = new Map(registryTemplates.map((template) => [template.id, template.name]));
  const versionNumberById = new Map(allVersions.map((version) => [version.id, version.versionNumber]));
  const publishedVersionByTemplateId = new Map(
    allVersions
      .filter((version) => version.status === "published")
      .map((version) => [version.templateId, version])
  );
  const ownerEmailByStoreId = new Map(
    installTargetStores.map((store) => [
      text(store.id),
      owners.get(text(store.user_id)) ?? "—"
    ])
  );
  const storeNameById = new Map(
    installTargetStores.map((store) => [text(store.id), text(store.store_name, text(store.name, "Store"))])
  );
  const installableStores = installTargetStores
    .filter((store) => text(store.id) && text(store.user_id) && text(store.workspace_id))
    .map((store) => ({
      id: text(store.id),
      name: text(store.store_name, text(store.name, "Store")),
      slug: text(store.slug) || null
    }))
    .sort((left, right) => left.name.localeCompare(right.name));

  const assignableTemplates = registryTemplates
    .filter((template) => template.status === "active")
    .map((template) => {
      const publishedVersion = publishedVersionByTemplateId.get(template.id);

      if (!publishedVersion) return null;

      return {
        name: template.name,
        publishedVersionId: publishedVersion.id,
        publishedVersionNumber: publishedVersion.versionNumber,
        registryId: template.id
      };
    })
    .filter((template): template is NonNullable<typeof template> => Boolean(template))
    .sort((left, right) => left.name.localeCompare(right.name));

  const activeAssignmentStoreIds = [
    ...new Set(
      allAssignments
        .filter(
          (assignment) =>
            assignment.assignmentStatus === "active" || assignment.assignmentStatus === "assigned"
        )
        .map((assignment) => assignment.storeId)
    )
  ];

  const compareTemplateVersionNumbers = (left: string, right: string) => {
    const leftParts = left.split(".").map((part) => Number.parseInt(part, 10));
    const rightParts = right.split(".").map((part) => Number.parseInt(part, 10));
    const length = Math.max(leftParts.length, rightParts.length);

    for (let index = 0; index < length; index += 1) {
      const leftValue = Number.isFinite(leftParts[index]) ? leftParts[index] : 0;
      const rightValue = Number.isFinite(rightParts[index]) ? rightParts[index] : 0;

      if (leftValue !== rightValue) {
        return leftValue - rightValue;
      }
    }

    return left.localeCompare(right);
  };

  const latestPublishedVersionByTemplateId = new Map<string, (typeof allVersions)[number]>();

  for (const version of allVersions) {
    if (version.status !== "published") continue;

    const existing = latestPublishedVersionByTemplateId.get(version.templateId);

    if (!existing || compareTemplateVersionNumbers(version.versionNumber, existing.versionNumber) > 0) {
      latestPublishedVersionByTemplateId.set(version.templateId, version);
    }
  }

  const activeRegistryIds = new Set(registryTemplates.filter((template) => template.status === "active").map((template) => template.id));

  const updatableTargets = allAssignments
    .filter(
      (assignment) =>
        (assignment.assignmentStatus === "active" || assignment.assignmentStatus === "assigned") &&
        activeRegistryIds.has(assignment.templateId)
    )
    .map((assignment) => {
      const targetVersion = latestPublishedVersionByTemplateId.get(assignment.templateId);

      if (!targetVersion) return null;

      const currentVersion = assignment.templateVersionId
        ? allVersions.find((version) => version.id === assignment.templateVersionId) ?? null
        : null;

      if (targetVersion.id === assignment.templateVersionId) return null;

      if (
        currentVersion &&
        compareTemplateVersionNumbers(targetVersion.versionNumber, currentVersion.versionNumber) <= 0
      ) {
        return null;
      }

      return {
        assignmentId: assignment.id,
        currentVersionId: assignment.templateVersionId,
        currentVersionNumber: currentVersion?.versionNumber ?? versionNumberById.get(assignment.templateVersionId ?? "") ?? null,
        registryId: assignment.templateId,
        storeId: assignment.storeId,
        storeName: storeNameById.get(assignment.storeId) ?? assignment.storeId,
        targetVersionId: targetVersion.id,
        targetVersionNumber: targetVersion.versionNumber,
        templateName: templateNameByRegistryId.get(assignment.templateId) ?? "Template"
      };
    })
    .filter((target): target is NonNullable<typeof target> => Boolean(target))
    .sort((left, right) => left.storeName.localeCompare(right.storeName));

  const rollbackableTargets = allAssignments
    .filter(
      (assignment) =>
        (assignment.assignmentStatus === "active" || assignment.assignmentStatus === "assigned") &&
        activeRegistryIds.has(assignment.templateId)
    )
    .flatMap((assignment) => {
      const currentVersion = assignment.templateVersionId
        ? allVersions.find((version) => version.id === assignment.templateVersionId) ?? null
        : null;

      if (!currentVersion) return [];

      const knownVersionIds = new Set<string>();

      for (const historyAssignment of allAssignments) {
        if (historyAssignment.storeId !== assignment.storeId) continue;
        if (historyAssignment.templateId !== assignment.templateId) continue;

        if (historyAssignment.templateVersionId) {
          knownVersionIds.add(historyAssignment.templateVersionId);
        }

        const metadata = historyAssignment.metadata;

        for (const key of ["previous_template_version_id", "updated_to_version_id"] as const) {
          const value = typeof metadata[key] === "string" ? metadata[key] : "";

          if (value) knownVersionIds.add(value);
        }
      }

      for (const install of allInstalls) {
        if (install.storeId !== assignment.storeId) continue;
        if (install.templateId !== assignment.templateId) continue;
        if (install.status !== "completed") continue;
        if (install.templateVersionId) knownVersionIds.add(install.templateVersionId);
      }

      for (const updateJob of allUpdateJobs) {
        if (updateJob.storeId !== assignment.storeId) continue;
        if (updateJob.templateId !== assignment.templateId) continue;
        if (updateJob.status !== "completed") continue;
        if (updateJob.fromVersionId) knownVersionIds.add(updateJob.fromVersionId);
        if (updateJob.toVersionId) knownVersionIds.add(updateJob.toVersionId);
      }

      const linkedUpdateJob =
        allUpdateJobs.find(
          (updateJob) =>
            updateJob.storeId === assignment.storeId &&
            updateJob.templateId === assignment.templateId &&
            updateJob.status === "completed" &&
            updateJob.toVersionId === currentVersion.id
        ) ?? null;

      const targets: Array<{
        assignmentId: string;
        currentVersionId: string;
        currentVersionNumber: string;
        registryId: string;
        storeId: string;
        storeName: string;
        targetVersionId: string;
        targetVersionNumber: string;
        templateName: string;
        updateJobId: string | null;
      }> = [];

      for (const versionId of knownVersionIds) {
        if (versionId === currentVersion.id) continue;

        const targetVersion = allVersions.find((version) => version.id === versionId);

        if (!targetVersion || targetVersion.status !== "published") continue;
        if (targetVersion.templateId !== assignment.templateId) continue;

        const isKnown = knownVersionIds.has(targetVersion.id);
        const isOlderOrEqual =
          compareTemplateVersionNumbers(targetVersion.versionNumber, currentVersion.versionNumber) <= 0;

        if (!isKnown && !isOlderOrEqual) continue;

        targets.push({
          assignmentId: assignment.id,
          currentVersionId: currentVersion.id,
          currentVersionNumber: currentVersion.versionNumber,
          registryId: assignment.templateId,
          storeId: assignment.storeId,
          storeName: storeNameById.get(assignment.storeId) ?? assignment.storeId,
          targetVersionId: targetVersion.id,
          targetVersionNumber: targetVersion.versionNumber,
          templateName: templateNameByRegistryId.get(assignment.templateId) ?? "Template",
          updateJobId:
            linkedUpdateJob && linkedUpdateJob.fromVersionId === targetVersion.id
              ? linkedUpdateJob.id
              : null
        });
      }

      const unique = new Map(targets.map((target) => [target.targetVersionId, target]));

      return [...unique.values()];
    })
    .sort((left, right) => left.storeName.localeCompare(right.storeName));

  const activeMarketplaceListingTemplateIds = new Set(
    allMarketplaceListings
      .filter((listing) => listing.listingStatus === "draft" || listing.listingStatus === "published")
      .map((listing) => listing.templateId)
  );

  const marketplaceEligibleTemplates = registryTemplates
    .filter((template) => {
      if (template.status !== "active") return false;
      if (
        template.visibility !== "marketplace" &&
        template.metadata.marketplaceAllowed !== true &&
        template.metadata.allowMarketplace !== true
      ) {
        return false;
      }
      if (!publishedVersionByTemplateId.has(template.id)) return false;
      const pkg = packagesByTemplateId.get(template.id);
      if (!pkg || pkg.readinessStatus !== "ready") return false;
      if (activeMarketplaceListingTemplateIds.has(template.id)) return false;
      return true;
    })
    .map((template) => {
      const publishedVersion = publishedVersionByTemplateId.get(template.id);
      const screenshots = screenshotsByTemplateId.get(template.id) ?? [];
      const warnings =
        screenshots.filter((screenshot) => screenshot.status === "published").length === 0
          ? ["No published screenshots found; marketplace preview will use generated placeholders."]
          : [];

      return {
        packageReadiness: packagesByTemplateId.get(template.id)?.readinessStatus ?? "missing",
        publishedVersionNumber: publishedVersion?.versionNumber ?? null,
        registryId: template.id,
        templateName: template.name,
        visibility: template.visibility,
        warnings
      };
    })
    .sort((left, right) => left.templateName.localeCompare(right.templateName));

  const resellerAssignableTemplates = registryTemplates
    .filter((template) => {
      if (template.status !== "active") return false;
      if (
        template.visibility !== "reseller" &&
        template.visibility !== "marketplace" &&
        template.metadata.resellerAllowed !== true &&
        template.metadata.allowReseller !== true
      ) {
        return false;
      }
      if (!publishedVersionByTemplateId.has(template.id)) return false;
      return true;
    })
    .map((template) => ({
      publishedVersionNumber: publishedVersionByTemplateId.get(template.id)?.versionNumber ?? null,
      registryId: template.id,
      templateName: template.name,
      visibility: template.visibility
    }))
    .sort((left, right) => left.templateName.localeCompare(right.templateName));

  const resellerNameById = new Map(
    resellerProfiles.map((profile) => [
      text(profile.id),
      text(profile.display_name) || text(profile.slug) || "Reseller"
    ])
  );
  const resellerSlugById = new Map(
    resellerProfiles.map((profile) => [text(profile.id), text(profile.slug) || null])
  );

  const marketplacePricingLabel = (listing: (typeof allMarketplaceListings)[number]) => {
    if (listing.pricingType === "included") return "Included";
    if (listing.pricingType === "paid") {
      if (listing.priceAmount !== null) {
        const currency = listing.currency?.toUpperCase() || "USD";
        return `${currency} ${listing.priceAmount.toFixed(2)}`;
      }
      return "Paid";
    }
    return "Free";
  };

  const publishedTemplateIds = new Set(
    allVersions.filter((version) => version.status === "published").map((version) => version.templateId)
  );
  const versionStats = {
    archivedVersions: allVersions.filter((version) => version.status === "archived").length,
    draftVersions: allVersions.filter((version) => version.status === "draft").length,
    publishedVersions: allVersions.filter((version) => version.status === "published").length,
    templatesWithPublishedVersion: publishedTemplateIds.size,
    totalVersions: allVersions.length
  };

  const versionsByTemplateId = new Map<string, typeof allVersions>();

  for (const version of allVersions) {
    const existing = versionsByTemplateId.get(version.templateId) ?? [];
    existing.push(version);
    versionsByTemplateId.set(version.templateId, existing);
  }

  for (const [templateId, versions] of versionsByTemplateId) {
    versionsByTemplateId.set(
      templateId,
      [...versions].sort((left, right) => {
        const leftParts = left.versionNumber.split(".").map((part) => Number.parseInt(part, 10));
        const rightParts = right.versionNumber.split(".").map((part) => Number.parseInt(part, 10));
        const length = Math.max(leftParts.length, rightParts.length);

        for (let index = 0; index < length; index += 1) {
          const leftValue = Number.isFinite(leftParts[index]) ? leftParts[index] : 0;
          const rightValue = Number.isFinite(rightParts[index]) ? rightParts[index] : 0;

          if (leftValue !== rightValue) {
            return rightValue - leftValue;
          }
        }

        return right.versionNumber.localeCompare(left.versionNumber);
      })
    );
  }

  const installedVersionsByTemplate = new Map<string, Set<string>>();

  for (const store of stores) {
    const storeData = isRecord(store.store_data) ? store.store_data : {};
    const installed = isRecord(storeData.installedTemplatePackage) ? storeData.installedTemplatePackage : {};
    const installedTemplateId = text(installed.templateId, text(store.template_id));
    const version = text(installed.packageVersion, text(installed.packageId, "legacy"));

    if (installedTemplateId) {
      const versions = installedVersionsByTemplate.get(installedTemplateId) ?? new Set<string>();
      versions.add(version);
      installedVersionsByTemplate.set(installedTemplateId, versions);
    }
  }

  const templates: AdminTemplateManagementControl["templates"] = registryTemplates
    .filter((template) => template.status !== "archived")
    .map((template) => {
    const storeTemplateId = text(template.metadata.storeTemplateId, template.templateKey);
    const templateVersions = versionsByTemplateId.get(template.id) ?? [];
    const latestVersion = templateVersions[0] ?? null;
    const parsedVersion = latestVersion
      ? Number.parseInt(latestVersion.versionNumber, 10)
      : Number.parseInt(template.version, 10);
    const premium =
      template.badges.includes("premium") ||
      template.badges.includes("ready-to-use") ||
      template.packageSummary.domainEmailReadiness === "ready";
    const recommendationOrder =
      typeof template.metadata.recommendationOrder === "number" && Number.isFinite(template.metadata.recommendationOrder)
        ? Math.trunc(template.metadata.recommendationOrder)
        : null;

    return {
      badges: {
        official: template.isOfficial,
        premium,
        recommended: template.isRecommended
      },
      category: text(template.category, "general"),
      createdAt: template.createdAt,
      domainEmailReadiness: template.packageSummary.domainEmailReadiness,
      id: storeTemplateId,
      industry: text(template.industry, "general"),
      installedVersionCount: installedVersionsByTemplate.get(storeTemplateId)?.size ?? 0,
      lastUpdated: template.updatedAt,
      latestVersion: latestVersion
        ? {
            publishedAt: latestVersion.publishedAt,
            status: latestVersion.status,
            versionNumber: latestVersion.versionNumber
          }
        : null,
      name: template.name,
      packageRuntime: (() => {
        const pkg = packagesByTemplateId.get(template.id);

        if (!pkg) return null;

        return {
          contents: pkg.contents,
          packageId: pkg.id,
          packageKey: pkg.packageKey,
          packageName: pkg.packageName,
          readinessStatus: pkg.readinessStatus,
          validationIssues: validationByTemplateId.get(template.id)?.issues ?? []
        };
      })(),
      packageSummary: {
        aiVisualSupport: template.packageSummary.aiVisualSupport,
        blogCount: template.packageSummary.blogCount,
        categoriesCount: template.packageSummary.categoriesCount,
        faqCount: template.packageSummary.faqCount,
        pagesCount: template.packageSummary.pagesCount,
        productsCount: template.packageSummary.productsCount
      },
      packageVersion: Number.isFinite(parsedVersion) ? parsedVersion : null,
      previewHref: `/admin/templates/preview/${encodeURIComponent(template.id)}`,
      recommendationOrder,
      registryId: template.id,
      assets: [
        ...(assetsByTemplateId.get(template.id) ?? []).map((asset) => ({
          assetType: asset.assetType,
          fileSize: asset.fileSize,
          id: asset.id,
          managedExternally: false,
          mimeType: asset.mimeType,
          originalFilename: asset.originalFilename,
          previewUrl: asset.previewUrl,
          status: asset.status,
          uploadedAt: asset.createdAt
        })),
        ...(screenshotsByTemplateId.get(template.id) ?? []).map((screenshot) => ({
          assetType: "screenshot",
          fileSize: screenshot.fileSize,
          id: screenshot.id,
          managedExternally: true,
          mimeType: screenshot.mimeType,
          originalFilename: screenshot.originalFilename,
          previewUrl: screenshot.previewUrl,
          status: screenshot.status,
          uploadedAt: screenshot.createdAt
        }))
      ],
      screenshots: (screenshotsByTemplateId.get(template.id) ?? []).map((screenshot) => ({
        id: screenshot.id,
        originalFilename: screenshot.originalFilename,
        previewUrl: screenshot.previewUrl,
        screenshotType: screenshot.screenshotType,
        sortOrder: screenshot.sortOrder,
        status: screenshot.status
      })),
      status: template.status,
      updateAvailable: "placeholder",
      versions: templateVersions.map((version) => ({
        changelog: version.changelog,
        createdAt: version.createdAt,
        id: version.id,
        publishReadiness: publishReadinessByVersionId.get(version.id) ?? {
          canPublish: version.status === "draft",
          issues: version.status === "draft" ? [] : ["Only draft versions can be published."]
        },
        publishedAt: version.publishedAt,
        status: version.status,
        versionNumber: version.versionNumber
      })),
      visibility: template.visibility
    };
  });

  return {
    archivedTemplates: archivedTemplates.map((template) => ({
      archivedAt: template.archivedAt,
      category: text(template.category, "general"),
      latestVersion: template.latestVersionNumber,
      name: template.name,
      previousVisibility: template.previousVisibility ?? template.visibility,
      registryId: template.registryId,
      templateKey: template.templateKey
    })),
    futureHooks: [
      "Create new template",
      "Upload template preview",
      "Approve marketplace template",
      "Reseller exclusive templates"
    ],
    overview: {
      activeTemplates: activationStats.activeTemplates,
      archivedTemplates: activationStats.archivedTemplates,
      draftTemplates: activationStats.draftTemplates,
      officialTemplates: officialStats.officialTemplates,
      recommendedTemplates: recommendedStats.recommendedTemplates,
      resellerVisibleTemplates: stats.resellerVisible,
      totalTemplates: stats.totalTemplates
    },
    packageOverview: {
      draftPackages: packageStats.draftPackages,
      invalidPackages: packageStats.invalidPackages,
      needsAttentionPackages: packageStats.needsAttentionPackages,
      readyPackages: packageStats.readyPackages,
      totalPackages: packageStats.totalPackages
    },
    packages: allPackages.map((pkg) => ({
      contents: pkg.contents,
      packageId: pkg.id,
      packageKey: pkg.packageKey,
      packageName: pkg.packageName,
      readinessStatus: pkg.readinessStatus,
      registryId: pkg.templateId,
      templateKey: templateKeyByRegistryId.get(pkg.templateId) ?? pkg.packageKey,
      templateName: templateNameByRegistryId.get(pkg.templateId) ?? pkg.packageName,
      validationIssues: validationByTemplateId.get(pkg.templateId)?.issues ?? []
    })),
    recommendedTemplates: recommendedTemplates.map((template) => ({
      category: text(template.category, "general"),
      latestVersion: template.latestPublishedVersion,
      name: template.name,
      recommendationOrder: template.recommendationOrder,
      registryId: template.id,
      templateKey: template.templateKey,
      visibility: template.visibility
    })),
    screenshotOverview: {
      archivedScreenshots: allScreenshots.filter((screenshot) => screenshot.status === "archived").length,
      draftScreenshots: allScreenshots.filter((screenshot) => screenshot.status === "draft").length,
      publishedScreenshots: allScreenshots.filter((screenshot) => screenshot.status === "published").length,
      totalScreenshots: allScreenshots.length
    },
    assetOverview: {
      archivedAssets: allAssets.filter((asset) => asset.status === "archived").length,
      draftAssets: allAssets.filter((asset) => asset.status === "draft").length,
      publishedAssets: allAssets.filter((asset) => asset.status === "published").length,
      totalAssets: allAssets.length
    },
    assets: [
      ...allAssets.map((asset) => ({
        assetType: asset.assetType,
        fileSize: asset.fileSize,
        id: asset.id,
        managedExternally: false,
        mimeType: asset.mimeType,
        originalFilename: asset.originalFilename,
        previewUrl: asset.previewUrl,
        registryId: asset.templateId,
        source: "template_assets" as const,
        status: asset.status,
        templateName: templateNameByRegistryId.get(asset.templateId) ?? "Template",
        uploadedAt: asset.createdAt
      })),
      ...allScreenshots.map((screenshot) => ({
        assetType: "screenshot",
        fileSize: screenshot.fileSize,
        id: screenshot.id,
        managedExternally: true,
        mimeType: screenshot.mimeType,
        originalFilename: screenshot.originalFilename,
        previewUrl: screenshot.previewUrl,
        registryId: screenshot.templateId,
        source: "template_screenshots" as const,
        status: screenshot.status,
        templateName: templateNameByRegistryId.get(screenshot.templateId) ?? "Template",
        uploadedAt: screenshot.createdAt
      }))
    ],
    installableStores,
    installOverview: {
      completedInstalls: allInstalls.filter((install) => install.status === "completed").length,
      failedInstalls: allInstalls.filter((install) => install.status === "failed").length,
      preparedInstalls: allInstalls.filter((install) => install.status === "prepared").length,
      totalInstalls: allInstalls.length
    },
    assignmentOverview: {
      activeAssignments: allAssignments.filter((assignment) => assignment.assignmentStatus === "active").length,
      assignedAssignments: allAssignments.filter((assignment) => assignment.assignmentStatus === "assigned").length,
      totalAssignments: allAssignments.length,
      unassignedAssignments: allAssignments.filter((assignment) => assignment.assignmentStatus === "unassigned")
        .length
    },
    assignableTemplates,
    activeAssignmentStoreIds,
    storeTemplateAssignments: allAssignments.map((assignment) => ({
      assignedAt: assignment.assignedAt,
      assignmentSource: assignment.assignmentSource,
      assignmentStatus: assignment.assignmentStatus,
      id: assignment.id,
      installId: assignment.installId,
      ownerEmail: ownerEmailByStoreId.get(assignment.storeId) ?? "—",
      storeId: assignment.storeId,
      storeName: storeNameById.get(assignment.storeId) ?? assignment.storeId,
      templateId: assignment.templateId,
      templateName: templateNameByRegistryId.get(assignment.templateId) ?? "Template",
      versionNumber: assignment.templateVersionId
        ? versionNumberById.get(assignment.templateVersionId) ?? null
        : null
    })),
    isolationOverview: {
      failedSnapshots: allIsolationSnapshots.filter((snapshot) => snapshot.isolationStatus === "failed").length,
      safeSnapshots: allIsolationSnapshots.filter((snapshot) => snapshot.isolationStatus === "safe").length,
      totalSnapshots: allIsolationSnapshots.length,
      warningSnapshots: allIsolationSnapshots.filter((snapshot) => snapshot.isolationStatus === "warning").length
    },
    storeThemeIsolationSnapshots: allIsolationSnapshots.map((snapshot) => ({
      createdAt: snapshot.createdAt,
      id: snapshot.id,
      installId: snapshot.installId,
      isolationStatus: snapshot.isolationStatus,
      issueSummary:
        snapshot.issues[0]?.message ??
        (snapshot.isolationStatus === "safe" ? "No isolation issues detected." : null),
      issuesCount: snapshot.issues.length,
      storeId: snapshot.storeId,
      storeName: storeNameById.get(snapshot.storeId) ?? snapshot.storeId,
      templateId: snapshot.templateId,
      templateName: snapshot.templateId
        ? templateNameByRegistryId.get(snapshot.templateId) ?? "Template"
        : "—"
    })),
    updateOverview: {
      completedUpdates: allUpdateJobs.filter((job) => job.status === "completed").length,
      failedUpdates: allUpdateJobs.filter((job) => job.status === "failed").length,
      preparedUpdates: allUpdateJobs.filter((job) => job.status === "prepared").length,
      totalUpdates: allUpdateJobs.length
    },
    updatableTargets,
    templateUpdateJobs: allUpdateJobs.map((job) => ({
      assignmentId: job.assignmentId,
      completedAt: job.completedAt,
      conflictSummary: job.conflicts[0]?.note ?? null,
      conflictsCount: job.conflicts.length,
      createdAt: job.createdAt,
      currentVersionNumber: job.fromVersionId ? versionNumberById.get(job.fromVersionId) ?? null : null,
      errorMessage: job.errorMessage,
      id: job.id,
      status: job.status,
      storeId: job.storeId,
      storeName: storeNameById.get(job.storeId) ?? job.storeId,
      summaryNote: typeof job.updateSummary.note === "string" ? job.updateSummary.note : null,
      targetVersionNumber: versionNumberById.get(job.toVersionId) ?? null,
      templateId: job.templateId,
      templateName: templateNameByRegistryId.get(job.templateId) ?? "Template"
    })),
    rollbackOverview: {
      completedRollbacks: allRollbackJobs.filter((job) => job.status === "completed").length,
      failedRollbacks: allRollbackJobs.filter((job) => job.status === "failed").length,
      preparedRollbacks: allRollbackJobs.filter((job) => job.status === "prepared").length,
      totalRollbacks: allRollbackJobs.length
    },
    rollbackableTargets,
    templateRollbackJobs: allRollbackJobs.map((job) => ({
      assignmentId: job.assignmentId,
      completedAt: job.completedAt,
      conflictSummary: job.conflicts[0]?.note ?? null,
      conflictsCount: job.conflicts.length,
      createdAt: job.createdAt,
      currentVersionNumber: job.fromVersionId ? versionNumberById.get(job.fromVersionId) ?? null : null,
      errorMessage: job.errorMessage,
      id: job.id,
      status: job.status,
      storeId: job.storeId,
      storeName: storeNameById.get(job.storeId) ?? job.storeId,
      summaryNote: typeof job.rollbackSummary.note === "string" ? job.rollbackSummary.note : null,
      targetVersionNumber: versionNumberById.get(job.toVersionId) ?? null,
      templateId: job.templateId,
      templateName: templateNameByRegistryId.get(job.templateId) ?? "Template",
      updateJobId: job.updateJobId
    })),
    marketplaceListingOverview: marketplaceListingStats,
    marketplaceApprovalOverview: marketplaceApprovalStats,
    marketplaceApprovalQueue: marketplaceApprovalQueue.map((item) => ({
      approvalStatus: item.approvalStatus,
      id: item.id,
      lastReviewNote: item.lastReviewNote,
      listingDescription: item.listingDescription,
      listingStatus: item.listingStatus,
      listingTitle: item.listingTitle,
      pricingType: item.pricingType,
      readinessLabel: item.readinessLabel,
      rejectionReason: item.rejectionReason,
      templateId: item.templateId,
      templateName: item.templateName,
      updatedAt: item.updatedAt,
      versionNumber: item.versionNumber
    })),
    marketplaceEligibleTemplates,
    marketplaceListings: allMarketplaceListings.map((listing) => ({
      approvalStatus: listing.approvalStatus,
      createdAt: listing.createdAt,
      currency: listing.currency,
      featured: listing.featured,
      id: listing.id,
      listingDescription: listing.listingDescription,
      listingStatus: listing.listingStatus,
      listingTitle: listing.listingTitle,
      priceAmount: listing.priceAmount,
      pricingLabel: marketplacePricingLabel(listing),
      pricingType: listing.pricingType,
      publishedAt: listing.publishedAt,
      templateId: listing.templateId,
      templateName: templateNameByRegistryId.get(listing.templateId) ?? "Template",
      versionNumber: listing.templateVersionId
        ? versionNumberById.get(listing.templateVersionId) ?? null
        : publishedVersionByTemplateId.get(listing.templateId)?.versionNumber ?? null
    })),
    marketplaceCatalogPreview,
    templatePublishOverview: {
      draftVersions: allVersions.filter((version) => version.status === "draft").length,
      publishedVersions: allVersions.filter((version) => version.status === "published").length,
      recentPublishEvents: templatePublishEvents.length,
      templatesWithPublishedVersion: publishedTemplateIds.size
    },
    templatePublishEvents: templatePublishEvents.map((event) => ({
      createdAt: event.createdAt,
      eventType: event.eventType,
      templateId: event.templateId,
      templateName: event.templateName,
      versionId: event.versionId,
      versionNumber: event.versionNumber
    })),
    templatePublishStatuses: registryTemplates
      .filter((template) => template.status !== "archived")
      .map((template) => {
        const templateVersions = versionsByTemplateId.get(template.id) ?? [];
        const publishedVersion = templateVersions.find((version) => version.status === "published") ?? null;

        return {
          currentPublishedVersion: publishedVersion?.versionNumber ?? null,
          draftVersionCount: templateVersions.filter((version) => version.status === "draft").length,
          lastPublishedAt: publishedVersion?.publishedAt ?? null,
          registryId: template.id,
          templateName: template.name,
          templateStatus: template.status
        };
      })
      .sort((left, right) => left.templateName.localeCompare(right.templateName)),
    resellerAssignableTemplates,
    resellerOptions: resellerProfiles
      .map((profile) => ({
        displayName: text(profile.display_name) || text(profile.slug) || "Reseller",
        id: text(profile.id),
        slug: text(profile.slug) || null
      }))
      .filter((profile) => profile.id)
      .sort((left, right) => left.displayName.localeCompare(right.displayName)),
    resellerTemplateAssignments: allResellerTemplateAccess.map((access) => ({
      accessId: access.id,
      accessStatus: access.accessStatus,
      accessType: access.accessType,
      assignedAt: access.assignedAt,
      resellerId: access.resellerId,
      resellerName: resellerNameById.get(access.resellerId) ?? access.resellerId,
      resellerSlug: resellerSlugById.get(access.resellerId) ?? null,
      templateId: access.templateId,
      templateName: templateNameByRegistryId.get(access.templateId) ?? "Template",
      versionNumber: access.templateVersionId
        ? versionNumberById.get(access.templateVersionId) ?? null
        : publishedVersionByTemplateId.get(access.templateId)?.versionNumber ?? null
    })),
    resellerTemplateOverview: {
      activeAssignments: resellerTemplateStats.activeAssignments,
      assignedTemplates: resellerTemplateStats.assignedTemplates,
      revokedAssignments: resellerTemplateStats.revokedAssignments,
      suspendedAssignments: resellerTemplateStats.suspendedAssignments,
      totalAssignments: resellerTemplateStats.totalAssignments
    },
    templateInstalls: allInstalls.map((install) => ({
      completedAt: install.completedAt,
      createdAt: install.createdAt,
      errorMessage: install.errorMessage,
      id: install.id,
      status: install.status,
      storeId: install.storeId,
      storeName: storeNameById.get(install.storeId) ?? install.storeId,
      templateId: install.templateId,
      templateName: templateNameByRegistryId.get(install.templateId) ?? "Template"
    })),
    screenshots: allScreenshots.map((screenshot) => ({
      id: screenshot.id,
      originalFilename: screenshot.originalFilename,
      previewUrl: screenshot.previewUrl,
      registryId: screenshot.templateId,
      screenshotType: screenshot.screenshotType,
      sortOrder: screenshot.sortOrder,
      status: screenshot.status,
      templateName: templateNameByRegistryId.get(screenshot.templateId) ?? "Template"
    })),
    templates,
    versionOverview: versionStats,
    visibility: {
      hiddenInternal: visibilityStats.hiddenInternal,
      marketplaceVisible: visibilityStats.marketplaceVisible,
      ownerVisible: visibilityStats.ownerVisible,
      resellerVisible: visibilityStats.resellerVisible
    }
  };
}

export function createEmptyAdminMarketplaceControl(): AdminMarketplaceControl {
  return {
    creators: [],
    futureHooks: [
      "Creator accounts",
      "Marketplace payouts",
      "App/plugin installation",
      "Template sales",
      "Reseller-exclusive marketplace items",
      "Reviews and ratings",
      "Revenue sharing"
    ],
    items: [],
    overview: {
      activeCreatorAccounts: 0,
      approvedItems: 0,
      archivedItems: 0,
      draftItems: 0,
      liveInstalls: 0,
      moderatedItems: 0,
      paymentsProcessed: 0,
      pendingReviewItems: 0,
      rejectedItems: 0,
      submittedItems: 0,
      totalCreatorAccounts: 0,
      totalCreatorRevenueProcessed: 0,
      totalItems: 0,
      totalMarketplaceAssets: 0,
      activeMarketplaceAssets: 0,
      verifiedAssetItems: 0,
      totalPlatformFeesProcessed: 0,
      verifiedAppBindings: 0,
      verifiedCreatorAccounts: 0,
      verifiedPluginBindings: 0,
      verifiedServiceBindings: 0,
      verifiedTemplateBindings: 0,
      verifiedThemeBindings: 0
    },
    sections: [
      { itemCount: 0, itemType: "template", name: "Template Marketplace", status: "ready" },
      { itemCount: 0, itemType: "theme", name: "Theme Marketplace", status: "ready" },
      { itemCount: 0, itemType: "plugin", name: "Plugin Marketplace", status: "ready" },
      { itemCount: 0, itemType: "app", name: "App Marketplace", status: "ready" },
      { itemCount: 0, itemType: "service", name: "Service Marketplace", status: "ready" }
    ]
  };
}

export async function getAdminMarketplaceControl(): Promise<AdminMarketplaceControl> {
  const loadStep = async <T,>(step: string, loader: () => Promise<T>, fallback: T): Promise<T> => {
    try {
      return await loader();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[getAdminMarketplaceControl] failed at ${step}: ${message}`, error);
      return fallback;
    }
  };

  const emptyRegistryStats = {
    approvedItems: 0,
    archivedItems: 0,
    draftItems: 0,
    pendingReviewItems: 0,
    rejectedItems: 0,
    totalItems: 0
  };

  const emptySectionGroups = createEmptyMarketplaceSectionItemGroups();

  const [sectionGroups, registryStats, revenueEvents, installEvents, templates, themePresets, pluginBindings, appBindings, serviceBindings, creatorAccounts, marketplaceAssets] =
    await Promise.all([
    loadStep("listMarketplaceSectionItemGroupsReadOnly", () => listMarketplaceSectionItemGroupsReadOnly(), emptySectionGroups),
    loadStep("getMarketplaceRegistryStatsReadOnly", () => getMarketplaceRegistryStatsReadOnly(), emptyRegistryStats),
    loadStep("listMarketplaceRevenueEvents", () => listMarketplaceRevenueEvents({ limit: 1000 }), [] as MarketplaceRevenueEventRecord[]),
    loadStep("listMarketplaceInstallEvents", () => listMarketplaceInstallEvents({ limit: 1000 }), [] as MarketplaceInstallEventRecord[]),
    loadStep("listTemplatesReadOnly", () => listTemplatesReadOnly(), []),
    loadStep("listThemePresets", () => listThemePresets(), []),
    loadStep("listMarketplacePluginBindings", () => listMarketplacePluginBindings({ limit: 1000 }), []),
    loadStep("listMarketplaceAppBindings", () => listMarketplaceAppBindings({ limit: 1000 }), []),
    loadStep("listMarketplaceServiceBindings", () => listMarketplaceServiceBindings({ limit: 1000 }), []),
    loadStep("listMarketplaceCreatorAccounts", () => listMarketplaceCreatorAccounts({ limit: 1000 }), []),
    loadStep("listMarketplaceAssets", () => listMarketplaceAssets({ limit: 5000 }), [])
  ]);
  const registryItems = sectionGroups.flatMap((section) => section.items);
  const templateById = new Map(templates.map((template) => [template.id, template]));
  const themePresetById = new Map(themePresets.map((preset) => [preset.id, preset]));
  const pluginBindingByItemId = new Map(pluginBindings.map((binding) => [binding.marketplaceItemId, binding]));
  const appBindingByItemId = new Map(appBindings.map((binding) => [binding.marketplaceItemId, binding]));
  const serviceBindingByItemId = new Map(serviceBindings.map((binding) => [binding.marketplaceItemId, binding]));
  const creatorById = new Map(creatorAccounts.map((creator) => [creator.id, creator]));
  const assetsByItemId = marketplaceAssets.reduce<Map<string, typeof marketplaceAssets>>((map, asset) => {
    const existing = map.get(asset.marketplaceItemId) ?? [];
    existing.push(asset);
    map.set(asset.marketplaceItemId, existing);
    return map;
  }, new Map());
  const itemCountByCreatorId = registryItems.reduce<Map<string, number>>((counts, item) => {
    if (!item.creatorAccountId) return counts;
    counts.set(item.creatorAccountId, (counts.get(item.creatorAccountId) ?? 0) + 1);
    return counts;
  }, new Map());
  const revenueEventsByItemId = new Map<string, MarketplaceRevenueEventRecord[]>();
  const installEventsByItemId = new Map<string, MarketplaceInstallEventRecord[]>();

  const revenueStats = revenueEvents.reduce(
    (stats, event) => {
      if (event.revenueStatus === "processed") {
        stats.processedEvents += 1;
        stats.totalGrossProcessed = Math.round((stats.totalGrossProcessed + event.grossAmount) * 100) / 100;
        stats.totalPlatformFeesProcessed =
          Math.round((stats.totalPlatformFeesProcessed + event.platformFeeAmount) * 100) / 100;
        stats.totalCreatorRevenueProcessed =
          Math.round((stats.totalCreatorRevenueProcessed + event.creatorRevenueAmount) * 100) / 100;
      }

      return stats;
    },
    {
      processedEvents: 0,
      totalCreatorRevenueProcessed: 0,
      totalGrossProcessed: 0,
      totalPlatformFeesProcessed: 0
    }
  );

  for (const event of revenueEvents) {
    const existing = revenueEventsByItemId.get(event.marketplaceItemId) ?? [];
    existing.push(event);
    revenueEventsByItemId.set(event.marketplaceItemId, existing);
  }

  for (const event of installEvents) {
    const existing = installEventsByItemId.get(event.marketplaceItemId) ?? [];
    existing.push(event);
    installEventsByItemId.set(event.marketplaceItemId, existing);
  }

  const items: AdminMarketplaceControl["items"] = registryItems.map((item) => {
    const itemEvents = revenueEventsByItemId.get(item.id) ?? [];
    const itemInstallEvents = installEventsByItemId.get(item.id) ?? [];
    const calculated = calculateMarketplaceRevenue(
      item.pricing,
      getMarketplacePlatformFeeRate(item.metadata)
    );
    const linkedTemplate = item.linkedTemplateId ? templateById.get(item.linkedTemplateId) ?? null : null;
    const templateBindingEvaluation =
      item.itemType === "template"
        ? evaluateMarketplaceTemplateBinding({
            itemKey: item.itemKey,
            itemType: item.itemType,
            linkedTemplateId: item.linkedTemplateId,
            marketplaceStatus: item.status,
            marketplaceVisibility: item.visibility,
            storedBindingStatus: item.templateBinding.bindingStatus,
            template: linkedTemplate,
            templateVersion: item.templateBinding.templateVersion
          })
        : null;
    const linkedThemePreset = item.linkedThemeId ? themePresetById.get(item.linkedThemeId) ?? null : null;
    const themeBindingEvaluation =
      item.itemType === "theme"
        ? evaluateMarketplaceThemeBinding({
            itemKey: item.itemKey,
            itemType: item.itemType,
            linkedThemeId: item.linkedThemeId,
            marketplaceStatus: item.status,
            marketplaceVisibility: item.visibility,
            preset: linkedThemePreset,
            storedBindingStatus: item.themeBinding.bindingStatus,
            themeVersion: item.themeBinding.themeVersion
          })
        : null;
    const pluginBindingEvaluation =
      item.itemType === "plugin"
        ? evaluateMarketplacePluginBinding({
            binding: pluginBindingByItemId.get(item.id) ?? null,
            itemKey: item.itemKey,
            itemType: item.itemType,
            marketplaceStatus: item.status,
            marketplaceVisibility: item.visibility,
            pricingMode: item.pricing.mode
          })
        : null;
    const appBindingEvaluation =
      item.itemType === "app"
        ? evaluateMarketplaceAppBinding({
            binding: appBindingByItemId.get(item.id) ?? null,
            itemKey: item.itemKey,
            itemType: item.itemType,
            marketplaceStatus: item.status,
            marketplaceVisibility: item.visibility,
            pricingMode: item.pricing.mode
          })
        : null;
    const serviceBindingEvaluation =
      item.itemType === "service"
        ? evaluateMarketplaceServiceBinding({
            binding: serviceBindingByItemId.get(item.id) ?? null,
            itemKey: item.itemKey,
            itemType: item.itemType,
            marketplaceStatus: item.status,
            marketplaceVisibility: item.visibility,
            pricingMode: item.pricing.mode
          })
        : null;
    const itemAssets = assetsByItemId.get(item.id) ?? [];
    const assetInspection = evaluateMarketplaceItemAssetsInspection({
      assets: itemAssets,
      itemType: item.itemType,
      marketplaceStatus: item.status,
      marketplaceVisibility: item.visibility
    });
    const creatorLinkEvaluation = evaluateMarketplaceItemCreatorLink({
      creator: item.creatorAccountId ? creatorById.get(item.creatorAccountId) ?? null : null,
      creatorAccountId: item.creatorAccountId,
      marketplaceStatus: item.status,
      marketplaceVisibility: item.visibility
    });
    const linkedCreator = item.creatorAccountId ? creatorById.get(item.creatorAccountId) ?? null : null;
    const submissionInspection = evaluateMarketplaceCreatorSubmissionInspection({
      creator: linkedCreator,
      item: {
        creatorAccountId: item.creatorAccountId,
        status: item.status,
        submissionNote: item.submissionNote,
        submissionStatus:
          item.submissionStatus === "draft" ||
          item.submissionStatus === "submitted" ||
          item.submissionStatus === "withdrawn" ||
          item.submissionStatus === "rejected" ||
          item.submissionStatus === "approved"
            ? item.submissionStatus
            : null,
        submittedAt: item.submittedAt,
        submittedBy: item.submittedBy
      }
    });
    const moderationInspection = evaluateMarketplaceModerationInspection({
      creatorDisplayName: linkedCreator?.displayName ?? null,
      item: {
        creatorAccountId: item.creatorAccountId,
        itemType: item.itemType,
        moderatedAt: item.moderation?.moderatedAt ?? null,
        moderatedBy: item.moderation?.moderatedBy ?? null,
        moderationAction: item.moderation?.moderationAction ?? null,
        moderationNote: item.moderation?.moderationNote ?? null,
        moderationReason: item.moderation?.moderationReason ?? null,
        name: item.name,
        pricing: item.pricing,
        status: item.status,
        submissionNote: item.submissionNote,
        submissionStatus:
          item.submissionStatus === "draft" ||
          item.submissionStatus === "submitted" ||
          item.submissionStatus === "withdrawn" ||
          item.submissionStatus === "rejected" ||
          item.submissionStatus === "approved"
            ? item.submissionStatus
            : null,
        submittedAt: item.submittedAt,
        visibility: item.visibility
      }
    });

    return {
    approval: {
      action: item.approval.approvalAction,
      approvalNote: item.approval.approvalNote,
      approvalUpdatedAt: item.approval.approvalUpdatedAt,
      approvedAt: item.approval.approvedAt,
      approvedBy: item.approval.approvedBy,
      availableActions: getAvailableMarketplaceApprovalActions(item.status).filter(
        (action) => action === "submit_for_review"
      ),
      rejectedAt: item.approval.rejectedAt,
      rejectedBy: item.approval.rejectedBy,
      reviewedAt: item.approval.reviewedAt,
      reviewedBy: item.approval.reviewedBy
    },
    creator: item.creatorSource ?? "SHASTORE platform",
    creatorAccount: {
      accountId: creatorLinkEvaluation.creatorInspection?.accountId ?? null,
      creatorAccountId: creatorLinkEvaluation.creatorAccountId,
      creatorStatus: creatorLinkEvaluation.creatorInspection?.creatorStatus ?? null,
      creatorType: creatorLinkEvaluation.creatorInspection?.creatorType ?? null,
      displayName: creatorLinkEvaluation.creatorInspection?.displayName ?? null,
      linkedUserId: creatorLinkEvaluation.creatorInspection?.linkedUserId ?? null,
      publicEligible: creatorLinkEvaluation.publicEligible,
      publicSlug: creatorLinkEvaluation.creatorInspection?.publicSlug ?? null,
      verificationIssues: creatorLinkEvaluation.verificationIssues,
      verificationStatus: creatorLinkEvaluation.creatorInspection?.verificationStatus ?? null,
      verified: creatorLinkEvaluation.verified
    },
    id: item.id,
    installInspection: {
      eventCount: itemInstallEvents.length,
      installCount: item.installCount,
      installCountUpdatedAt: item.installCountUpdatedAt,
      installEligible: item.itemType !== "service",
      liveInstalls: item.liveInstalls,
      publicInstallEligible: item.status === "approved" && item.visibility === "public",
      recentEvents: itemInstallEvents.slice(0, 5).map((event) => ({
        createdAt: event.createdAt,
        id: event.id,
        installStatus: event.installStatus,
        source: event.source,
        storeId: event.storeId
      }))
    },
    installs: item.liveInstalls,
    lastUpdated: item.updatedAt,
    moderation: {
      availableActions: getAvailableMarketplaceModerationActions(item.status),
      creatorAccountId: moderationInspection.creatorAccountId,
      creatorDisplayName: moderationInspection.creatorDisplayName,
      itemName: moderationInspection.itemName,
      itemType: moderationInspection.itemType,
      marketplaceStatus: moderationInspection.marketplaceStatus,
      moderatedAt: moderationInspection.moderatedAt,
      moderatedBy: moderationInspection.moderatedBy,
      moderationAction: moderationInspection.moderationAction,
      moderationNote: moderationInspection.moderationNote,
      moderationReason: moderationInspection.moderationReason,
      pricingMode: moderationInspection.pricingMode,
      publicEligible: moderationInspection.publicEligible,
      submissionNote: moderationInspection.submissionNote,
      submissionStatus: moderationInspection.submissionStatus,
      submittedAt: moderationInspection.submittedAt,
      verificationIssues: moderationInspection.verificationIssues,
      verified: moderationInspection.verified,
      visibility: moderationInspection.visibility
    },
    name: item.name,
    pricing: {
      billingInterval: item.pricing.billingInterval,
      currency: item.pricing.currency,
      mode: item.pricing.mode,
      priceAmount: item.pricing.priceAmount,
      pricingUpdatedAt: item.pricing.pricingUpdatedAt,
      trialDays: item.pricing.trialDays
    },
    revenue: item.revenueAmount,
    revenueInspection: {
      creatorRevenueAmount: calculated.creatorRevenueAmount,
      currency: calculated.currency,
      eventCount: itemEvents.length,
      grossAmount: calculated.grossAmount,
      platformFeeAmount: calculated.platformFeeAmount,
      platformFeeRate: calculated.platformFeeRate,
      processedEventCount: itemEvents.filter((event) => event.revenueStatus === "processed").length,
      recordedAmount: item.revenueAmount,
      recentEvents: itemEvents.slice(0, 5).map((event) => ({
        createdAt: event.createdAt,
        creatorRevenueAmount: event.creatorRevenueAmount,
        currency: event.currency,
        grossAmount: event.grossAmount,
        id: event.id,
        platformFeeAmount: event.platformFeeAmount,
        revenueStatus: event.revenueStatus,
        source: event.source
      }))
    },
    section: toAdminMarketplaceSectionName(item.section),
    status: item.status,
    templateBinding:
      item.itemType === "template" && templateBindingEvaluation
        ? {
            bindingStatus: templateBindingEvaluation.bindingStatus,
            bindingUpdatedAt: item.templateBinding.bindingUpdatedAt,
            linkedTemplateId: templateBindingEvaluation.linkedTemplateId,
            templateKey: templateBindingEvaluation.templateKey,
            templateName: templateBindingEvaluation.templateName,
            templateSlug: templateBindingEvaluation.templateSlug,
            templateStatus: templateBindingEvaluation.templateStatus,
            templateVersion: templateBindingEvaluation.templateVersion,
            templateVisibility: templateBindingEvaluation.templateVisibility,
            verificationIssues: templateBindingEvaluation.verificationIssues,
            verified: templateBindingEvaluation.verified
          }
        : null,
    themeBinding:
      item.itemType === "theme" && themeBindingEvaluation
        ? {
            bindingStatus: themeBindingEvaluation.bindingStatus,
            bindingUpdatedAt: item.themeBinding.bindingUpdatedAt,
            linkedThemeId: themeBindingEvaluation.linkedThemeId,
            themeKey: themeBindingEvaluation.themeKey,
            themeName: themeBindingEvaluation.themeName,
            themeStatus: themeBindingEvaluation.themeStatus,
            themeVersion: themeBindingEvaluation.themeVersion,
            verificationIssues: themeBindingEvaluation.verificationIssues,
            verified: themeBindingEvaluation.verified
          }
        : null,
    pluginBinding:
      item.itemType === "plugin" && pluginBindingEvaluation
        ? {
            bindingStatus: pluginBindingEvaluation.bindingStatus,
            marketplaceStatus: pluginBindingEvaluation.marketplaceStatus,
            marketplaceVisibility: pluginBindingEvaluation.marketplaceVisibility,
            pluginKey: pluginBindingEvaluation.pluginKey,
            pluginManifestSummary: pluginBindingEvaluation.pluginManifestSummary,
            pluginName: pluginBindingEvaluation.pluginName,
            pluginVersion: pluginBindingEvaluation.pluginVersion,
            pricingMode: pluginBindingEvaluation.pricingMode,
            publicEligible: pluginBindingEvaluation.publicEligible,
            verificationIssues: pluginBindingEvaluation.verificationIssues,
            verified: pluginBindingEvaluation.verified
          }
        : null,
    appBinding:
      item.itemType === "app" && appBindingEvaluation
        ? {
            appKey: appBindingEvaluation.appKey,
            appManifestSummary: appBindingEvaluation.appManifestSummary,
            appName: appBindingEvaluation.appName,
            appVersion: appBindingEvaluation.appVersion,
            bindingStatus: appBindingEvaluation.bindingStatus,
            marketplaceStatus: appBindingEvaluation.marketplaceStatus,
            marketplaceVisibility: appBindingEvaluation.marketplaceVisibility,
            pricingMode: appBindingEvaluation.pricingMode,
            publicEligible: appBindingEvaluation.publicEligible,
            verificationIssues: appBindingEvaluation.verificationIssues,
            verified: appBindingEvaluation.verified
          }
        : null,
    serviceBinding:
      item.itemType === "service" && serviceBindingEvaluation
        ? {
            bindingStatus: serviceBindingEvaluation.bindingStatus,
            marketplaceStatus: serviceBindingEvaluation.marketplaceStatus,
            marketplaceVisibility: serviceBindingEvaluation.marketplaceVisibility,
            pricingMode: serviceBindingEvaluation.pricingMode,
            publicEligible: serviceBindingEvaluation.publicEligible,
            serviceCategory: serviceBindingEvaluation.serviceCategory,
            serviceDescription: serviceBindingEvaluation.serviceDescription,
            serviceDurationDays: serviceBindingEvaluation.serviceDurationDays,
            serviceKey: serviceBindingEvaluation.serviceKey,
            serviceName: serviceBindingEvaluation.serviceName,
            serviceRequirementsSummary: serviceBindingEvaluation.serviceRequirementsSummary,
            verificationIssues: serviceBindingEvaluation.verificationIssues,
            verified: serviceBindingEvaluation.verified
          }
        : null,
    assetInspection: {
      activeAssetCount: assetInspection.activeAssetCount,
      assetCount: assetInspection.assetCount,
      assets: assetInspection.assets,
      marketplaceStatus: assetInspection.marketplaceStatus,
      marketplaceVisibility: assetInspection.marketplaceVisibility,
      publicEligible: assetInspection.publicEligible,
      publicEligibleAssetCount: assetInspection.publicEligibleAssetCount,
      verificationIssues: assetInspection.verificationIssues,
      verified: assetInspection.verified
    },
    submission: {
      creatorAccountId: submissionInspection.creatorAccountId,
      creatorDisplayName: submissionInspection.creatorDisplayName,
      creatorPublicSlug: submissionInspection.creatorPublicSlug,
      marketplaceStatus: submissionInspection.marketplaceStatus,
      submissionNote: submissionInspection.submissionNote,
      submissionStatus: submissionInspection.submissionStatus,
      submittedAt: submissionInspection.submittedAt,
      submittedBy: submissionInspection.submittedBy,
      verificationIssues: submissionInspection.verificationIssues,
      verified: submissionInspection.verified
    },
    type: item.itemType,
    visibility: item.visibility
  };
  });

  return {
    creators: creatorAccounts.map((creator) => {
      const inspection = evaluateMarketplaceCreatorAccount(creator);

      return {
        accountId: creator.accountId,
        creatorStatus: creator.creatorStatus,
        creatorType: creator.creatorType,
        displayName: creator.displayName,
        id: creator.id,
        itemCount: itemCountByCreatorId.get(creator.id) ?? 0,
        linkedUserId: creator.userId,
        publicEligible: inspection.publicEligible,
        publicSlug: creator.publicSlug,
        verificationIssues: inspection.verificationIssues,
        verificationStatus: creator.verificationStatus,
        verified: inspection.verified
      };
    }),
    futureHooks: [
      "Creator accounts",
      "Marketplace payouts",
      "App/plugin installation",
      "Template sales",
      "Reseller-exclusive marketplace items",
      "Reviews and ratings",
      "Revenue sharing"
    ],
    items,
    overview: {
      approvedItems: registryStats.approvedItems,
      archivedItems: registryStats.archivedItems,
      draftItems: registryStats.draftItems,
      liveInstalls: registryItems.reduce((sum, item) => sum + item.liveInstalls, 0),
      paymentsProcessed: revenueStats.totalGrossProcessed,
      pendingReviewItems: registryStats.pendingReviewItems,
      rejectedItems: registryStats.rejectedItems,
      totalCreatorRevenueProcessed: revenueStats.totalCreatorRevenueProcessed,
      totalItems: registryStats.totalItems,
      totalPlatformFeesProcessed: revenueStats.totalPlatformFeesProcessed,
      verifiedTemplateBindings: registryItems.reduce((count, item) => {
        if (item.itemType !== "template") return count;
        const linkedTemplate = item.linkedTemplateId ? templateById.get(item.linkedTemplateId) ?? null : null;
        const evaluation = evaluateMarketplaceTemplateBinding({
          itemKey: item.itemKey,
          itemType: item.itemType,
          linkedTemplateId: item.linkedTemplateId,
          marketplaceStatus: item.status,
          marketplaceVisibility: item.visibility,
          storedBindingStatus: item.templateBinding.bindingStatus,
          template: linkedTemplate,
          templateVersion: item.templateBinding.templateVersion
        });
        return count + (evaluation.verified ? 1 : 0);
      }, 0),
      verifiedThemeBindings: registryItems.reduce((count, item) => {
        if (item.itemType !== "theme") return count;
        const linkedThemePreset = item.linkedThemeId ? themePresetById.get(item.linkedThemeId) ?? null : null;
        const evaluation = evaluateMarketplaceThemeBinding({
          itemKey: item.itemKey,
          itemType: item.itemType,
          linkedThemeId: item.linkedThemeId,
          marketplaceStatus: item.status,
          marketplaceVisibility: item.visibility,
          preset: linkedThemePreset,
          storedBindingStatus: item.themeBinding.bindingStatus,
          themeVersion: item.themeBinding.themeVersion
        });
        return count + (evaluation.verified ? 1 : 0);
      }, 0),
      verifiedPluginBindings: registryItems.reduce((count, item) => {
        if (item.itemType !== "plugin") return count;
        const evaluation = evaluateMarketplacePluginBinding({
          binding: pluginBindingByItemId.get(item.id) ?? null,
          itemKey: item.itemKey,
          itemType: item.itemType,
          marketplaceStatus: item.status,
          marketplaceVisibility: item.visibility,
          pricingMode: item.pricing.mode
        });
        return count + (evaluation.verified ? 1 : 0);
      }, 0),
      verifiedAppBindings: registryItems.reduce((count, item) => {
        if (item.itemType !== "app") return count;
        const evaluation = evaluateMarketplaceAppBinding({
          binding: appBindingByItemId.get(item.id) ?? null,
          itemKey: item.itemKey,
          itemType: item.itemType,
          marketplaceStatus: item.status,
          marketplaceVisibility: item.visibility,
          pricingMode: item.pricing.mode
        });
        return count + (evaluation.verified ? 1 : 0);
      }, 0),
      verifiedServiceBindings: registryItems.reduce((count, item) => {
        if (item.itemType !== "service") return count;
        const evaluation = evaluateMarketplaceServiceBinding({
          binding: serviceBindingByItemId.get(item.id) ?? null,
          itemKey: item.itemKey,
          itemType: item.itemType,
          marketplaceStatus: item.status,
          marketplaceVisibility: item.visibility,
          pricingMode: item.pricing.mode
        });
        return count + (evaluation.verified ? 1 : 0);
      }, 0),
      activeCreatorAccounts: creatorAccounts.filter((creator) => creator.creatorStatus === "active").length,
      totalCreatorAccounts: creatorAccounts.length,
      verifiedCreatorAccounts: creatorAccounts.filter((creator) => creator.verificationStatus === "verified").length,
      submittedItems: registryItems.filter((item) => item.submissionStatus === "submitted").length,
      moderatedItems: registryItems.filter((item) => item.moderation?.moderationAction).length,
      totalMarketplaceAssets: marketplaceAssets.length,
      activeMarketplaceAssets: marketplaceAssets.filter((asset) => asset.assetStatus === "active").length,
      verifiedAssetItems: registryItems.reduce((count, item) => {
        const inspection = evaluateMarketplaceItemAssetsInspection({
          assets: assetsByItemId.get(item.id) ?? [],
          itemType: item.itemType,
          marketplaceStatus: item.status,
          marketplaceVisibility: item.visibility
        });
        return count + (inspection.verified ? 1 : 0);
      }, 0)
    },
    sections: sectionGroups.map((section) => ({
      itemCount: section.itemCount,
      itemType: section.itemType,
      name: toAdminMarketplaceSectionName(section.section),
      status:
        section.section === "template_marketplace" ||
        section.section === "theme_marketplace" ||
        section.section === "plugin_marketplace" ||
        section.section === "app_marketplace" ||
        section.section === "service_marketplace"
          ? "ready"
          : "placeholder"
    }))
  };
}

function buildAdminPlatformMarketingControl(params: {
  affiliateTrackingSummariesByRegistryKey?: Map<string, MarketingAffiliateTrackingSummaryRecord>;
  campaignEmailSummariesByRegistryKey?: Map<string, MarketingCampaignEmailSummaryRecord>;
  campaignNotificationSummariesByRegistryKey?: Map<string, MarketingCampaignNotificationSummaryRecord>;
  campaigns: AdminPlatformMarketingControl["campaigns"];
  commissionSummariesByRegistryKey?: Map<string, MarketingCommissionSummaryRecord>;
  couponMetadataByRegistryKey?: Map<string, Record<string, unknown>>;
  couponUsageSummariesByRegistryKey?: Map<string, MarketingCouponUsageSummaryRecord>;
  referralTrackingSummariesByRegistryKey?: Map<string, MarketingReferralTrackingSummaryRecord>;
  registryAuditItems?: Array<{
    name: string;
    registryKey: string;
    slug: string | null;
    updatedAt: string | null;
  }>;
  runtimeWarning?: string | null;
}): AdminPlatformMarketingControl {
  const {
    affiliateTrackingSummariesByRegistryKey = new Map(),
    campaignEmailSummariesByRegistryKey = new Map(),
    campaignNotificationSummariesByRegistryKey = new Map(),
    campaigns,
    commissionSummariesByRegistryKey = new Map(),
    couponMetadataByRegistryKey = new Map(),
    couponUsageSummariesByRegistryKey = new Map(),
    referralTrackingSummariesByRegistryKey = new Map(),
    registryAuditItems = [],
    runtimeWarning = null
  } = params;
  const couponLoad = buildMarketingCouponViewsSafe(
    campaigns,
    couponMetadataByRegistryKey,
    couponUsageSummariesByRegistryKey
  );
  const promotionLoad = buildMarketingPromotionViewsSafe(campaigns, couponMetadataByRegistryKey);
  const giftCodeLoad = buildMarketingGiftCodeViewsSafe(campaigns, couponMetadataByRegistryKey);
  const referralLoad = buildMarketingReferralViewsSafe(
    campaigns,
    couponMetadataByRegistryKey,
    referralTrackingSummariesByRegistryKey,
    commissionSummariesByRegistryKey
  );
  const affiliateLoad = buildMarketingAffiliateViewsSafe(
    campaigns,
    couponMetadataByRegistryKey,
    affiliateTrackingSummariesByRegistryKey,
    commissionSummariesByRegistryKey
  );
  const platformCampaignLoad = buildMarketingCampaignViewsSafe(
    campaigns,
    couponMetadataByRegistryKey,
    campaignEmailSummariesByRegistryKey,
    campaignNotificationSummariesByRegistryKey
  );
  const combinedWarning =
    [
      runtimeWarning,
      couponLoad.warning,
      promotionLoad.warning,
      giftCodeLoad.warning,
      referralLoad.warning,
      affiliateLoad.warning,
      platformCampaignLoad.warning
    ]
      .filter(Boolean)
      .join(" ") || null;
  const couponAnalytics = buildMarketingCouponAnalyticsSummarySafe(couponLoad.coupons);
  const promotionMetrics = buildMarketingPromotionMetricsSummarySafe(promotionLoad.promotions);
  const campaignAnalytics = buildMarketingCampaignAnalyticsSummarySafe(platformCampaignLoad.platformCampaigns);
  const marketingAudit = buildMarketingAuditSummarySafe({
    affiliates: affiliateLoad.affiliates,
    coupons: couponLoad.coupons,
    giftCodes: giftCodeLoad.giftCodes,
    platformCampaigns: platformCampaignLoad.platformCampaigns,
    promotions: promotionLoad.promotions,
    referrals: referralLoad.referrals,
    registryItems: registryAuditItems.length
      ? registryAuditItems
      : campaigns.map((campaign) => ({
          name: campaign.name,
          registryKey: campaign.id,
          slug: campaign.id,
          updatedAt: null
        })),
    runtimeWarning: combinedWarning
  });
  const marketingSecurityCertification = buildMarketingSecurityCertificationSafe({
    metadataSummaries: collectMarketingMetadataSummariesForCertification({
      affiliates: affiliateLoad.affiliates,
      campaigns: [],
      coupons: couponLoad.coupons,
      giftCodes: giftCodeLoad.giftCodes,
      platformCampaigns: platformCampaignLoad.platformCampaigns,
      promotions: promotionLoad.promotions,
      referrals: referralLoad.referrals
    }),
    runtimeWarning: combinedWarning
  });
  const marketingProductionCertification = buildMarketingProductionCertificationSafe({
    campaigns,
    campaignAnalytics,
    couponAnalytics,
    marketingAudit,
    marketingSecurityCertification,
    overview: countMarketingStatusOverview(campaigns),
    promotionMetrics,
    runtimeWarning: combinedWarning
  });

  return {
    campaigns,
    campaignAnalytics,
    couponAnalytics,
    marketingAudit,
    marketingProductionCertification,
    marketingSecurityCertification,
    coupons: couponLoad.coupons,
    giftCodes: giftCodeLoad.giftCodes,
    promotionMetrics,
    promotions: promotionLoad.promotions,
    affiliates: affiliateLoad.affiliates,
    referrals: referralLoad.referrals,
    platformCampaigns: platformCampaignLoad.platformCampaigns,
    futureHooks: [
      "Platform coupon redemption",
      "Plan discount application",
      "Affiliate tracking",
      "Payout system",
      "Campaign email sending",
      "Campaign analytics"
    ],
    overview: countMarketingStatusOverview(campaigns),
    referralAffiliates: [
      ...referralLoad.referrals.map((referral) => ({
        commission: 0,
        payoutStatus: referral.payoutStatus,
        referredUsers: referral.usageCount,
        referrer: referral.name,
        status: referral.status,
        type: "referral" as const
      })),
      ...affiliateLoad.affiliates.map((affiliate) => ({
        commission: 0,
        payoutStatus: affiliate.payoutStatus,
        referredUsers: affiliate.usageCount,
        referrer: affiliate.name,
        status: affiliate.status,
        type: "affiliate" as const
      }))
    ],
    runtimeWarning: combinedWarning
  };
}

export function createFallbackAdminPlatformMarketingControl(): AdminPlatformMarketingControl {
  const campaigns = MARKETING_REGISTRY_FALLBACK_ITEMS.map((item) => toMarketingRegistryCampaignView(item));

  return buildAdminPlatformMarketingControl({
    campaigns,
    registryAuditItems: MARKETING_REGISTRY_FALLBACK_ITEMS.map((item) => ({
      name: item.name,
      registryKey: item.registryKey,
      slug: item.slug,
      updatedAt: item.updatedAt
    })),
    couponMetadataByRegistryKey: new Map(
      MARKETING_REGISTRY_FALLBACK_ITEMS.map((item) => [item.registryKey, item.metadata])
    ),
    couponUsageSummariesByRegistryKey: new Map(
      MARKETING_COUPON_USAGE_FALLBACK_SUMMARIES.map((summary) => [summary.registryKey, summary])
    ),
    referralTrackingSummariesByRegistryKey: new Map(
      MARKETING_REFERRAL_TRACKING_FALLBACK_SUMMARIES.map((summary) => [summary.registryKey, summary])
    ),
    affiliateTrackingSummariesByRegistryKey: new Map(
      MARKETING_AFFILIATE_TRACKING_FALLBACK_SUMMARIES.map((summary) => [summary.registryKey, summary])
    ),
    commissionSummariesByRegistryKey: new Map(
      MARKETING_COMMISSION_FALLBACK_SUMMARIES.map((summary) => [summary.registryKey, summary])
    ),
    campaignEmailSummariesByRegistryKey: new Map(
      MARKETING_CAMPAIGN_EMAIL_FALLBACK_SUMMARIES.map((summary) => [summary.registryKey, summary])
    ),
    campaignNotificationSummariesByRegistryKey: new Map(
      MARKETING_CAMPAIGN_NOTIFICATION_FALLBACK_SUMMARIES.map((summary) => [summary.registryKey, summary])
    ),
    runtimeWarning: "Marketing registry runtime unavailable. Showing fallback registry rows."
  });
}

export async function getAdminPlatformMarketingControl(): Promise<AdminPlatformMarketingControl> {
  const {
    listMarketingAffiliateTrackingSummariesReadOnlySafe,
    listMarketingCampaignEmailSummariesReadOnlySafe,
    listMarketingCampaignNotificationSummariesReadOnlySafe,
    listMarketingCommissionSummariesReadOnlySafe,
    listMarketingCouponUsageSummariesReadOnlySafe,
    listMarketingReferralTrackingSummariesReadOnlySafe,
    listMarketingRegistryItemsReadOnlySafe,
    toMarketingRegistryCampaignView
  } = await import("@/src/lib/marketing/marketing-registry-runtime");
  const { supabase } = await getAdminUsersBase();
  const monitoringEvents = await safeSelect(
    supabase,
    "monitoring_events",
    "event_type, event_status, entity_type, metadata, created_at",
    500
  );
  const marketingEvents = monitoringEvents.filter((event) =>
    text(event.event_type).startsWith("admin_platform_marketing_")
  );
  const latestActionByCampaign = indexLatestMarketingPlatformActions(marketingEvents);

  const [registryLoad, usageLoad, referralTrackingLoad, affiliateTrackingLoad, commissionLoad, campaignEmailLoad, campaignNotificationLoad] =
    await Promise.all([
      listMarketingRegistryItemsReadOnlySafe(),
      listMarketingCouponUsageSummariesReadOnlySafe(),
      listMarketingReferralTrackingSummariesReadOnlySafe(),
      listMarketingAffiliateTrackingSummariesReadOnlySafe(),
      listMarketingCommissionSummariesReadOnlySafe(),
      listMarketingCampaignEmailSummariesReadOnlySafe(),
      listMarketingCampaignNotificationSummariesReadOnlySafe()
    ]);
  const campaigns = registryLoad.items.map((item) =>
    toMarketingRegistryCampaignView(
      item,
      resolveMarketingRegistryStatus({
        fallbackStatus: item.status,
        latestActionByCampaign,
        registryKey: item.registryKey
      })
    )
  );
  const runtimeWarning =
    [
      registryLoad.warning,
      usageLoad.warning,
      referralTrackingLoad.warning,
      affiliateTrackingLoad.warning,
      commissionLoad.warning,
      campaignEmailLoad.warning,
      campaignNotificationLoad.warning
    ]
      .filter(Boolean)
      .join(" ") || null;

  return buildAdminPlatformMarketingControl({
    affiliateTrackingSummariesByRegistryKey: indexMarketingAffiliateTrackingSummariesByRegistryKey(
      affiliateTrackingLoad.summaries
    ),
    campaignEmailSummariesByRegistryKey: indexMarketingCampaignEmailSummariesByRegistryKey(
      campaignEmailLoad.summaries
    ),
    campaignNotificationSummariesByRegistryKey: indexMarketingCampaignNotificationSummariesByRegistryKey(
      campaignNotificationLoad.summaries
    ),
    campaigns,
    commissionSummariesByRegistryKey: indexMarketingCommissionSummariesByRegistryKey(
      commissionLoad.summaries
    ),
    couponMetadataByRegistryKey: new Map(registryLoad.items.map((item) => [item.registryKey, item.metadata])),
    couponUsageSummariesByRegistryKey: indexMarketingCouponUsageSummariesByRegistryKey(usageLoad.summaries),
    referralTrackingSummariesByRegistryKey: indexMarketingReferralTrackingSummariesByRegistryKey(
      referralTrackingLoad.summaries
    ),
    registryAuditItems: registryLoad.items.map((item) => ({
      name: item.name,
      registryKey: item.registryKey,
      slug: item.slug,
      updatedAt: item.updatedAt
    })),
    runtimeWarning
  });
}

function buildAdminEmailControl(params: {
  emailLogs: AnyRecord[];
  monitoringEvents: AnyRecord[];
  registryItems: import("@/src/lib/email/email-registry-runtime").EmailRegistryItemRecord[];
  registryWarning?: string | null;
  storeMarketingMessages: AnyRecord[];
}): AdminEmailControl {
  const { emailLogs, monitoringEvents, registryItems, registryWarning = null, storeMarketingMessages } = params;
  const adminEmailEvents = monitoringEvents
    .filter((event) => text(event.event_type).startsWith("admin_email_"))
    .sort((left, right) => dateValue(right.created_at) - dateValue(left.created_at));
  const latestEventByTemplate = new Map<string, AnyRecord>();

  for (const event of adminEmailEvents) {
    const metadata = isRecord(event.metadata) ? event.metadata : {};
    const templateId = text(metadata.template_id);

    if (templateId && !latestEventByTemplate.has(templateId)) {
      latestEventByTemplate.set(templateId, event);
    }
  }

  function templateStatus(
    templateId: string,
    fallback: EmailTemplateDisplayStatus
  ): EmailTemplateDisplayStatus {
    const eventType = text(latestEventByTemplate.get(templateId)?.event_type);

    if (eventType === "admin_email_disable_template") {
      return "disabled";
    }

    return fallback;
  }

  const queue = buildEmailQueueStatusSummaryFromLogsSafe(emailLogs);
  const failedEmails = emailLogs
    .filter((log) => text(log.status) === "failed")
    .sort((left, right) => dateValue(right.created_at) - dateValue(left.created_at))
    .slice(0, 25)
    .map((log) => ({
      createdAt: text(log.created_at, new Date(0).toISOString()),
      emailType: text(log.template_key) || text(log.subject, "Unknown email"),
      errorSummary: safeEmailSummary(log.last_error || log.error_message),
      id: text(log.id) || `failed-email:${text(log.created_at)}`,
      recipientMasked: maskedEmail(log.recipient)
    }));
  const latestStoreMarketingActivity = storeMarketingMessages
    .map((message) => text(message.updated_at) || text(message.created_at))
    .filter(Boolean)
    .sort((left, right) => dateValue(right) - dateValue(left))[0] ?? null;
  const resolveCampaignTotals = (slug: string) => {
    if (slug === "platform-campaigns") {
      return {
        lastActivity: null,
        total: adminEmailEvents.filter((event) => text(event.event_type) === "admin_email_template_preview").length
      };
    }

    if (slug === "store-owner-campaigns") {
      return {
        lastActivity: latestStoreMarketingActivity,
        total: storeMarketingMessages.length
      };
    }

    return { lastActivity: null, total: 0 };
  };
  const registryViews = buildEmailRegistryViewsSafe({
    items: registryItems,
    resolveCampaignTotals,
    resolveTemplateStatus: templateStatus
  });
  const combinedWarning =
    [registryWarning, registryViews.warning].filter(Boolean).join(" ") || null;
  const templates = registryViews.templates;
  const providers = registryViews.providers;
  const emailTypeStats = buildEmailRegistryTypeStatsSafe(registryItems);
  const emailStatusStats = buildEmailRegistryStatusStatsSafe(registryItems);
  const emailProviderStats = buildEmailProviderStatsSafe(registryItems);
  const emailProviderHealth = buildEmailProviderHealthRecordsSafe(registryItems);
  const emailProviderHealthStats = buildEmailProviderHealthStatsSafe(registryItems);
  const emailProviderFailoverRecords = buildEmailProviderFailoverRecordsSafe(registryItems);
  const emailProviderFailoverRuntimeSummary = buildEmailProviderFailoverRuntimeSummarySafe(registryItems);
  const emailProviderFailoverRuntimeStats = buildEmailProviderFailoverRuntimeStatsSafe(registryItems);
  const emailTemplateRegistry = buildEmailTemplateRegistryRecordsSafe(registryItems, templateStatus);
  const emailTemplateRegistryStats = buildEmailTemplateRegistryStatsSafe(registryItems, templateStatus);
  const emailTemplateCategoryStats = buildEmailTemplateCategoryStatsSafe(registryItems);
  const emailTemplateCategoryGroups = groupEmailTemplateRecordsByCategorySafe(emailTemplateRegistry).map((group) => ({
    category: group.category,
    categoryLabel: group.categoryLabel,
    description: group.description,
    templateCount: group.items.length
  }));
  const emailTemplateVersionRecords = buildEmailTemplateVersionRecordsSafe(emailTemplateRegistry);
  const emailTemplateVersionStats = buildEmailTemplateVersionStatsSafe(emailTemplateRegistry);
  const emailTemplatePreviewRecords = buildEmailTemplatePreviewRecordsSafe(emailTemplateRegistry);
  const emailTemplatePreviewStats = buildEmailTemplatePreviewStatsSafe(emailTemplateRegistry);
  const emailTemplateValidationRecords = buildEmailTemplateValidationRecordsSafe(emailTemplateRegistry);
  const emailTemplateValidationStats = buildEmailTemplateValidationStatsSafe(emailTemplateRegistry);
  const emailWelcomeEmails = buildEmailWelcomeEmailRecordsSafe(registryItems, templateStatus);
  const emailWelcomeEmailStats = buildEmailWelcomeEmailStatsSafe(registryItems, templateStatus);
  const emailBillingEmails = buildEmailBillingEmailRecordsSafe(registryItems, templateStatus);
  const emailBillingEmailStats = buildEmailBillingEmailStatsSafe(registryItems, templateStatus);
  const emailOrderEmails = buildEmailOrderEmailRecordsSafe(registryItems, templateStatus);
  const emailOrderEmailStats = buildEmailOrderEmailStatsSafe(registryItems, templateStatus);
  const emailDomainEmailSetupEmails = buildEmailDomainEmailSetupEmailRecordsSafe(registryItems, templateStatus);
  const emailDomainEmailSetupEmailStats = buildEmailDomainEmailSetupEmailStatsSafe(registryItems, templateStatus);
  const emailSupportEmails = buildEmailSupportEmailRecordsSafe(registryItems, templateStatus);
  const emailSupportEmailStats = buildEmailSupportEmailStatsSafe(registryItems, templateStatus);
  const emailSecurityEmails = buildEmailSecurityEmailRecordsSafe(registryItems, templateStatus);
  const emailSecurityEmailStats = buildEmailSecurityEmailStatsSafe(registryItems, templateStatus);
  const emailQueueRuntimeSummary = buildEmailQueueRuntimeSummarySafe(emailLogs, registryItems);
  const emailQueueRuntimeStats = buildEmailQueueRuntimeStatsSafe(emailLogs, registryItems);
  const emailRetryRuntimeSummary = buildEmailRetryRuntimeSummarySafe(emailLogs, registryItems);
  const emailRetryRuntimeStats = buildEmailRetryRuntimeStatsSafe(emailLogs, registryItems);
  const emailFailureRuntimeRecords = buildEmailFailureRuntimeRecordsSafe(emailLogs);
  const emailFailureRuntimeSummary = buildEmailFailureRuntimeSummarySafe(emailLogs, registryItems);
  const emailFailureRuntimeStats = buildEmailFailureRuntimeStatsSafe(emailLogs, registryItems);
  const emailDeliveryRuntimeSummary = buildEmailDeliveryRuntimeSummarySafe(emailLogs, registryItems);
  const emailDeliveryRuntimeStats = buildEmailDeliveryRuntimeStatsSafe(emailLogs, registryItems);
  const emailCampaignEmails = buildEmailCampaignEmailRecordsSafe(
    registryItems,
    resolveCampaignTotals,
    templateStatus
  );
  const emailCampaignEmailStats = buildEmailCampaignEmailStatsSafe(
    registryItems,
    resolveCampaignTotals,
    templateStatus
  );
  const emailCampaignQueueScopeRecords = buildEmailCampaignQueueScopeRecordsSafe(
    registryItems,
    emailLogs,
    storeMarketingMessages,
    resolveCampaignTotals
  );
  const emailCampaignQueueRuntimeSummary = buildEmailCampaignQueueRuntimeSummarySafe(
    emailLogs,
    registryItems,
    storeMarketingMessages,
    resolveCampaignTotals
  );
  const emailCampaignQueueRuntimeStats = buildEmailCampaignQueueRuntimeStatsSafe(
    emailLogs,
    registryItems,
    storeMarketingMessages,
    resolveCampaignTotals
  );
  const campaignMonitoringSnapshot = {
    campaignEmails: emailCampaignEmails,
    campaignMonitoring: registryViews.campaignMonitoring,
    campaignQueueScopeRecords: emailCampaignQueueScopeRecords,
    campaignQueueSummary: emailCampaignQueueRuntimeSummary,
    deliverySummary: emailDeliveryRuntimeSummary,
    failureSummary: emailFailureRuntimeSummary,
    futureHooks: registryViews.futureHooks,
    queueSummary: emailQueueRuntimeSummary
  };
  const emailCampaignMonitoringScopeRecords = buildEmailCampaignMonitoringScopeRecordsSafe(
    campaignMonitoringSnapshot,
    registryItems
  );
  const emailCampaignMonitoringRuntimeSummary = buildEmailCampaignMonitoringRuntimeSummarySafe(
    campaignMonitoringSnapshot,
    registryItems
  );
  const emailCampaignMonitoringRuntimeStats = buildEmailCampaignMonitoringRuntimeStatsSafe(
    campaignMonitoringSnapshot,
    registryItems
  );
  const emailAnalyticsSnapshot = {
    campaignEmailStats: emailCampaignEmailStats,
    campaignMonitoringStats: emailCampaignMonitoringRuntimeStats,
    campaignMonitoringSummary: emailCampaignMonitoringRuntimeSummary,
    providerStats: emailProviderStats,
    queueSummary: emailQueueRuntimeSummary,
    templateRegistryStats: emailTemplateRegistryStats,
    templateValidationStats: emailTemplateValidationStats
  };
  const emailAnalyticsRuntimeSummary = buildEmailAnalyticsRuntimeSummarySafe(emailAnalyticsSnapshot);
  const emailAnalyticsRuntimeStats = buildEmailAnalyticsRuntimeStatsSafe(emailAnalyticsSnapshot);
  const emailAuditSnapshot = {
    analyticsSummary: emailAnalyticsRuntimeSummary,
    campaignEmailStats: emailCampaignEmailStats,
    campaignMonitoringStats: emailCampaignMonitoringRuntimeStats,
    failureStats: emailFailureRuntimeStats,
    failoverSummary: emailProviderFailoverRuntimeSummary,
    lastActivityCandidates: [
      text(adminEmailEvents[0]?.created_at),
      ...registryItems.map((item) => text(item.updatedAt)).filter(Boolean)
    ],
    providerHealthStats: emailProviderHealthStats,
    providerStats: emailProviderStats,
    templateValidationStats: emailTemplateValidationStats,
    typeStats: emailTypeStats
  };
  const emailAuditRuntimeSummary = buildEmailAuditRuntimeSummarySafe(emailAuditSnapshot, registryItems);
  const emailAuditRuntimeStats = buildEmailAuditRuntimeStatsSafe(emailAuditSnapshot, registryItems);
  const overview = {
    activeTemplates: templates.filter((template) => template.status === "active").length,
    failedEmails: queue.failed,
    providersConfigured: providers.filter((provider) => provider.configurationStatus === "configured").length,
    queuedEmails: queue.queued + queue.retryPending,
    sentEmails: queue.sent,
    totalTemplates: templates.length
  };
  const certificationMetadataSummaries = collectEmailMetadataSummariesForCertification({
    auditMetadataSummary: emailAuditRuntimeSummary.metadataSummary,
    billingEmails: emailBillingEmails,
    campaignEmails: emailCampaignEmails,
    campaignMonitoringScopeRecords: emailCampaignMonitoringScopeRecords,
    campaignQueueScopeRecords: emailCampaignQueueScopeRecords,
    domainEmailSetupEmails: emailDomainEmailSetupEmails,
    failureRecords: emailFailureRuntimeRecords,
    orderEmails: emailOrderEmails,
    providerFailoverRecords: emailProviderFailoverRecords,
    providerHealth: emailProviderHealth,
    securityEmails: emailSecurityEmails,
    supportEmails: emailSupportEmails,
    templateRegistry: emailTemplateRegistry,
    templateValidationRecords: emailTemplateValidationRecords,
    transactionalSections: registryViews.transactionalSections,
    welcomeEmails: emailWelcomeEmails
  });
  const foundationsPresent = verifyEmailRuntimeFoundationsPresent({
    emailAnalyticsRuntimeSummary,
    emailAuditRuntimeSummary,
    emailBillingEmails,
    emailCampaignEmails,
    emailCampaignMonitoringRuntimeSummary,
    emailCampaignQueueRuntimeSummary,
    emailDeliveryRuntimeSummary,
    emailFailureRuntimeSummary,
    emailProviderFailoverRuntimeSummary,
    emailProviderHealth,
    emailQueueRuntimeSummary,
    emailRetryRuntimeSummary,
    emailSecurityEmails,
    emailTemplateRegistry,
    emailTypeStats,
    emailWelcomeEmails,
    providers,
    queue,
    templates
  });
  const emailSecurityCertification = buildEmailSecurityCertificationSafe({
    errorSummaries: failedEmails.map((email) => email.errorSummary),
    foundationsPresent,
    metadataSummaries: certificationMetadataSummaries,
    providerSecretStatuses: providers.map((provider) => provider.secretStatus),
    recipientDisplays: failedEmails.map((email) => email.recipientMasked),
    runtimeWarning: combinedWarning
  });
  const emailProductionHardening = buildEmailProductionHardeningSafe({
    emailSecurityCertification,
    errorSummaries: failedEmails.map((email) => email.errorSummary),
    foundationsPresent: verifyEmailProductionFoundationsPresent({
      emailAnalyticsRuntimeSummary,
      emailAuditRuntimeSummary,
      emailBillingEmails,
      emailCampaignEmails,
      emailCampaignMonitoringRuntimeSummary,
      emailCampaignQueueRuntimeSummary,
      emailDeliveryRuntimeSummary,
      emailFailureRuntimeSummary,
      emailProviderFailoverRuntimeSummary,
      emailProviderHealth,
      emailQueueRuntimeSummary,
      emailRetryRuntimeSummary,
      emailSecurityCertification,
      emailSecurityEmails,
      emailTemplateRegistry,
      emailTypeStats,
      emailWelcomeEmails,
      providers,
      queue,
      templates
    }),
    metadataSummaries: certificationMetadataSummaries,
    overview,
    providerSecretStatuses: providers.map((provider) => provider.secretStatus),
    recipientDisplays: failedEmails.map((email) => email.recipientMasked),
    registryItemCount: registryItems.length,
    reservedFutureHookCount: registryViews.futureHooks.length,
    runtimeWarning: combinedWarning
  });
  const emailProductionCertification = buildEmailProductionCertificationSafe({
    emailProductionHardening,
    emailSecurityCertification,
    overview,
    registryItemCount: registryItems.length,
    reservedFutureHookCount: registryViews.futureHooks.length,
    runtimeWarning: combinedWarning
  });

  return {
    campaignMonitoring: registryViews.campaignMonitoring,
    emailProviderHealth,
    emailProviderHealthStats,
    emailProviderFailoverRecords,
    emailProviderFailoverRuntimeStats,
    emailProviderFailoverRuntimeSummary,
    emailProviderStats,
    emailStatusStats,
    emailTemplateCategoryGroups,
    emailTemplateCategoryStats,
    emailTemplatePreviewRecords,
    emailTemplatePreviewStats,
    emailTemplateRegistry,
    emailTemplateRegistryStats,
    emailTemplateValidationRecords,
    emailTemplateValidationStats,
    emailBillingEmailStats,
    emailBillingEmails,
    emailCampaignEmailStats,
    emailCampaignEmails,
    emailCampaignQueueRuntimeStats,
    emailCampaignQueueRuntimeSummary,
    emailCampaignQueueScopeRecords,
    emailCampaignMonitoringRuntimeStats,
    emailCampaignMonitoringRuntimeSummary,
    emailCampaignMonitoringScopeRecords,
    emailAnalyticsRuntimeStats,
    emailAnalyticsRuntimeSummary,
    emailAuditRuntimeStats,
    emailAuditRuntimeSummary,
    emailSecurityCertification,
    emailProductionHardening,
    emailProductionCertification,
    emailDomainEmailSetupEmailStats,
    emailDomainEmailSetupEmails,
    emailSupportEmailStats,
    emailSupportEmails,
    emailSecurityEmailStats,
    emailSecurityEmails,
    emailQueueRuntimeStats,
    emailQueueRuntimeSummary,
    emailRetryRuntimeStats,
    emailRetryRuntimeSummary,
    emailFailureRuntimeRecords,
    emailFailureRuntimeStats,
    emailFailureRuntimeSummary,
    emailDeliveryRuntimeStats,
    emailDeliveryRuntimeSummary,
    emailOrderEmailStats,
    emailOrderEmails,
    emailWelcomeEmailStats,
    emailWelcomeEmails,
    emailTemplateVersionRecords,
    emailTemplateVersionStats,
    emailTypeStats,
    failedEmails,
    futureHooks: registryViews.futureHooks,
    overview,
    providers,
    queue,
    runtimeWarning: combinedWarning,
    templates,
    transactionalSections: registryViews.transactionalSections
  };
}

export function createFallbackAdminEmailControl(): AdminEmailControl {
  return buildAdminEmailControl({
    emailLogs: [],
    monitoringEvents: [],
    registryItems: [...EMAIL_REGISTRY_FALLBACK_ITEMS],
    registryWarning: "Email registry runtime unavailable. Showing fallback registry rows.",
    storeMarketingMessages: []
  });
}

export async function getAdminEmailControl(): Promise<AdminEmailControl> {
  const { supabase } = await getAdminUsersBase();
  const [registryLoad, emailLogs, storeMarketingMessages, monitoringEvents] = await Promise.all([
    listEmailRegistryItemsReadOnlySafe(),
    safeSelect(
      supabase,
      "email_event_logs",
      "id, recipient, subject, template_key, status, error_message, last_error, created_at",
      500
    ),
    safeSelect(supabase, "store_marketing_messages", "id, type, status, updated_at, created_at", 500),
    safeSelect(supabase, "monitoring_events", "event_type, event_status, entity_type, metadata, created_at", 500)
  ]);

  return buildAdminEmailControl({
    emailLogs,
    monitoringEvents,
    registryItems: registryLoad.items,
    registryWarning: registryLoad.warning,
    storeMarketingMessages
  });
}

export async function getAdminNotificationControl(): Promise<AdminNotificationControl> {
  const { supabase } = await getAdminUsersBase();
  const [registryLoad, notifications, emailLogs, monitoringEvents] = await Promise.all([
    listNotificationRegistryItemsReadOnlySafe(),
    safeSelect(supabase, "notifications", "id, user_id, workspace_id, store_id, type, title, status, read_at, created_at", 500),
    safeSelect(
      supabase,
      "email_event_logs",
      "id, recipient, template_key, status, error_message, last_error, retry_count, attempt_count, sent_at, locked_at, next_retry_at, last_attempt_at, created_at, updated_at",
      500
    ),
    safeSelect(supabase, "monitoring_events", "id, event_type, event_status, entity_type, entity_id, metadata, store_id, user_id, created_at", 500)
  ]);

  return buildAdminNotificationControl({
    emailLogs,
    monitoringEvents,
    notifications,
    registryItems: registryLoad.items,
    registryWarning: registryLoad.warning
  });
}

function maskedNotificationEntityId(value: unknown) {
  const raw = text(value);
  if (!raw) return "";
  if (raw.length <= 8) return `${raw.slice(0, 2)}***`;
  return `${raw.slice(0, 8)}...`;
}

function buildAdminNotificationControl(params: {
  emailLogs: AnyRecord[];
  monitoringEvents: AnyRecord[];
  notifications: AnyRecord[];
  registryItems: import("@/src/lib/notifications/notification-registry-runtime").NotificationRegistryItemRecord[];
  registryWarning?: string | null;
}): AdminNotificationControl {
  const { emailLogs, monitoringEvents, notifications, registryItems, registryWarning = null } = params;
  const registryViews = buildNotificationRegistryViewsSafe({ items: registryItems });
  const notificationRegistryStatusStats = buildNotificationRegistryStatusStatsSafe(registryItems);
  const adminReviewEvents = monitoringEvents.filter(
    (event) => text(event.event_type) === "admin_notification_mark_reviewed"
  );
  const reviewedByNotificationId = new Map<string, string>();

  for (const event of adminReviewEvents) {
    const metadata = isRecord(event.metadata) ? event.metadata : {};
    const notificationId = text(metadata.notification_id);
    const reviewedAt = text(event.created_at);

    if (notificationId && reviewedAt) {
      reviewedByNotificationId.set(notificationId, reviewedAt);
    }
  }

  function mapNotificationLogType(rawType: unknown) {
    const resolved = resolveNotificationTypeFromSourceSafe(rawType);

    return {
      type: resolved.source,
      typeBadgeTone: resolved.typeBadgeTone,
      typeKey: resolved.type,
      typeLabel: resolved.typeLabel
    };
  }

  function mapNotificationLogStatus(value: unknown, readAt?: unknown) {
    const status = parseNotificationDeliveryStatusSafe(value, { readAt });

    return {
      status,
      statusLabel: getNotificationStatusLabel(status)
    };
  }

  function mapNotificationLogChannel(value: unknown) {
    const channel = parseNotificationChannelSafe(value);

    return {
      channel,
      channelLabel: getNotificationChannelLabel(channel)
    };
  }

  function mapNotificationLogCategory(...sources: unknown[]) {
    const category = classifyNotificationCategoryFromSource(sources.filter(Boolean).join(" "));

    return {
      category,
      categoryLabel: getNotificationCategoryLabel(category)
    };
  }

  function mapNotificationLogProvider(channel: NotificationChannel) {
    const providerKey = mapNotificationChannelToProvider(channel);

    return {
      providerKey,
      providerLabel: getNotificationProviderLabel(providerKey)
    };
  }

  function mapNotificationLogTemplate(templateKey: unknown) {
    const key = parseNotificationTemplateKeySafe(templateKey);

    return {
      templateKey: key,
      templateLabel: resolveNotificationTemplateLabel(key)
    };
  }

  const inAppLogs: AdminNotificationControl["logs"] = notifications.map((notification) => {
    const rawType = text(notification.type, "system");
    const typeView = mapNotificationLogType(rawType);
    const statusView = mapNotificationLogStatus(notification.status, notification.read_at);
    const categoryView = mapNotificationLogCategory(notification.type, notification.title);

    return {
      ...categoryView,
      ...mapNotificationLogChannel("in_app"),
      ...mapNotificationLogProvider("in_app"),
      ...mapNotificationLogTemplate(`in_app:${rawType}`),
      createdAt: text(notification.created_at, new Date(0).toISOString()),
      errorSummary: null,
      id: text(notification.id) || `notification:${text(notification.created_at)}`,
      recipientMasked: text(notification.user_id)
        ? `user:${text(notification.user_id).slice(0, 8)}...`
        : text(notification.workspace_id)
          ? `workspace:${text(notification.workspace_id).slice(0, 8)}...`
          : "platform recipient",
      ...statusView,
      storeOrUser:
        text(notification.store_id)
          ? `store:${maskedNotificationEntityId(notification.store_id)}`
          : text(notification.user_id)
            ? `user:${maskedNotificationEntityId(notification.user_id)}`
            : text(notification.workspace_id)
              ? `workspace:${maskedNotificationEntityId(notification.workspace_id)}`
              : "platform",
      ...typeView
    };
  });
  const emailChannelLogs: AdminNotificationControl["logs"] = emailLogs.map((log) => {
    const rawType = text(log.template_key, "email");
    const typeView = mapNotificationLogType(rawType);
    const statusView = mapNotificationLogStatus(log.status);
    const categoryView = mapNotificationLogCategory(log.template_key);

    return {
      ...categoryView,
      ...mapNotificationLogChannel("email"),
      ...mapNotificationLogProvider("email"),
      ...mapNotificationLogTemplate(log.template_key),
      createdAt: text(log.created_at, new Date(0).toISOString()),
      errorSummary: text(log.status) === "failed" ? safeEmailSummary(log.last_error || log.error_message) : null,
      id: text(log.id) || `email:${text(log.created_at)}`,
      recipientMasked: maskedEmail(log.recipient),
      ...statusView,
      storeOrUser: "email_event_logs",
      ...typeView
    };
  });
  const systemAlertLogs: AdminNotificationControl["logs"] = monitoringEvents
    .filter((event) => ["failed", "warning"].includes(text(event.event_status)))
    .map((event) => {
      const metadata = isRecord(event.metadata) ? event.metadata : {};
      const rawType = text(event.event_type, "system_alert");
      const typeView = mapNotificationLogType(rawType);
      const eventStatus = text(event.event_status) === "failed" ? "failed" : "queued";
      const statusView = mapNotificationLogStatus(eventStatus);
      const categoryView = mapNotificationLogCategory(event.event_type, metadata.note);

      return {
        ...categoryView,
        ...mapNotificationLogChannel("system_alert"),
        ...mapNotificationLogProvider("system_alert"),
        ...mapNotificationLogTemplate(`system_alert:${rawType}`),
        createdAt: text(event.created_at, new Date(0).toISOString()),
        errorSummary: safeEmailSummary(metadata.error || metadata.message || metadata.note || event.event_type),
        id: text(event.id) || `monitoring:${text(event.created_at)}`,
        recipientMasked: "platform admins",
        ...statusView,
        storeOrUser: text(event.store_id)
          ? `store:${maskedNotificationEntityId(event.store_id)}`
          : text(event.user_id)
            ? `user:${maskedNotificationEntityId(event.user_id)}`
            : text(event.entity_type, "platform"),
        ...typeView
      };
    });
  const logs = [...inAppLogs, ...emailChannelLogs, ...systemAlertLogs]
    .sort((left, right) => dateValue(right.createdAt) - dateValue(left.createdAt))
    .slice(0, 100);
  const notificationDeliveryStatusStats = buildNotificationDeliveryStatusSummaryFromLogsSafe(
    logs.map((log) => ({ status: log.status }))
  );
  const notificationChannelStats = buildNotificationChannelStatsSafe(logs.map((log) => log.channel));
  const notificationCategoryStats = buildNotificationCategoryStatsSafe(logs.map((log) => log.category));
  const notificationRegistryCategoryStats = buildNotificationRegistryCategoryStatsSafe(registryItems);
  const notificationRegistryProviderStats = buildNotificationRegistryProviderStatsSafe(registryItems);
  const notificationTypeStats = buildNotificationTypeStatsSafe(logs.map((log) => log.type));
  const typeCounts = new Map<NotificationType, number>();

  for (const log of logs) {
    typeCounts.set(log.typeKey, (typeCounts.get(log.typeKey) ?? 0) + 1);
  }

  const emailConfigured =
    process.env.EMAIL_PROVIDER?.trim().toLowerCase() === "resend" &&
    envConfigurationStatus(["RESEND_API_KEY", "EMAIL_FROM"]) === "configured";
  const channelViews = buildNotificationChannelViewsSafe({
    emailConfigured,
    monitoringHasFailed: monitoringEvents.some((event) => text(event.event_status) === "failed"),
    registryChannels: registryViews.channels.map((channel) => ({
      configuredStatus: channel.configuredStatus,
      healthStatus: channel.healthStatus,
      key: channel.key,
      name: channel.name,
      secretStatus: channel.secretStatus
    }))
  });
  const channels: AdminNotificationControl["channels"] = channelViews.channels;
  const providerViews = buildNotificationProviderViewsSafe({
    monitoringHasFailed: monitoringEvents.some((event) => text(event.event_status) === "failed"),
    registryProviders: registryItems
      .filter((item) => item.registryType === "provider")
      .map((item) => ({
        channel: item.channel,
        configuredState: item.configuredState,
        description: item.description,
        health: item.health,
        metadata: item.metadata,
        name: item.name,
        secretsState: item.secretsState,
        slug: item.slug
      }))
  });
  const providerStatus: AdminNotificationControl["providerStatus"] = providerViews.providers;
  const notificationProviderStats = buildNotificationProviderStatsSafe(providerStatus);
  const disabledTemplateKeys = monitoringEvents
    .filter((event) => text(event.event_type) === "admin_notification_disable_template")
    .map((event) => {
      const metadata = isRecord(event.metadata) ? event.metadata : {};
      return text(metadata.notification_type) || text(metadata.template_key);
    })
    .filter(Boolean);
  const templateViews = buildNotificationTemplateViewsSafe({
    disabledTemplateKeys,
    emailLogs,
    notifications,
    registryItems: registryItems.map((item) => ({
      createdAt: item.createdAt,
      notificationType: item.notificationType,
      registryType: item.registryType,
      slug: item.slug,
      updatedAt: item.updatedAt
    }))
  });
  const templates: AdminNotificationControl["templates"] = templateViews.templates;
  const notificationTemplateStats = buildNotificationTemplateStatsSafe(templates);
  const deliveryViews = buildNotificationDeliveryRecordsSafe({
    emailLogs,
    monitoringEvents: monitoringEvents.filter((event) =>
      ["failed", "warning"].includes(text(event.event_status))
    ),
    notifications
  });
  const deliveries: AdminNotificationControl["deliveries"] = deliveryViews.deliveries;
  const recipientViews = buildNotificationRecipientRecordsSafe({ deliveries, logs });
  const recipientItems: AdminNotificationControl["recipientItems"] = recipientViews.recipientItems;
  const notificationRecipientRuntimeStats = buildNotificationRecipientRuntimeStatsSafe(recipientItems);
  const eventViews = buildNotificationEventRecordsSafe({ logs });
  const eventItems: AdminNotificationControl["eventItems"] = eventViews.eventItems;
  const notificationEventRuntimeStats = buildNotificationEventRuntimeStatsSafe(eventItems);
  const logViews = buildNotificationLogRecordsSafe({ deliveries, eventItems, logs });
  const logItems: AdminNotificationControl["logItems"] = logViews.logItems;
  const notificationLogRuntimeStats = buildNotificationLogRuntimeStatsSafe(logItems);
  const notificationDeliveryRuntimeStats = buildNotificationDeliveryRuntimeStatsSafe(deliveries);
  const queueViews = buildNotificationQueueRecordsSafe({
    emailLogs,
    monitoringEvents,
    notifications
  });
  const queueItems: AdminNotificationControl["queueItems"] = queueViews.queueItems;
  const notificationQueueRuntimeStats = buildNotificationQueueRuntimeStatsSafe(queueItems);
  const retryViews = buildNotificationRetryRecordsSafe({
    emailLogs,
    monitoringEvents
  });
  const retryItems: AdminNotificationControl["retryItems"] = retryViews.retryItems;
  const notificationRetryRuntimeStats = buildNotificationRetryRuntimeStatsSafe(retryItems);
  const failureViews = buildNotificationFailureRecordsSafe({
    emailLogs,
    monitoringEvents: monitoringEvents.filter((event) => text(event.event_status) === "failed"),
    reviewedByNotificationId
  });
  const failureItems: AdminNotificationControl["failureItems"] = failureViews.failureItems;
  const notificationFailureRuntimeStats = buildNotificationFailureRuntimeStatsSafe(failureItems);
  const auditViews = buildNotificationAuditRecordsSafe({ monitoringEvents });
  const auditItems: AdminNotificationControl["auditItems"] = auditViews.auditItems;
  const notificationAuditRuntimeStats = buildNotificationAuditRuntimeStatsSafe(auditItems);
  const reviewViews = buildNotificationReviewRecordsSafe({ auditItems, failureItems });
  const reviewItems: AdminNotificationControl["reviewItems"] = reviewViews.reviewItems;
  const notificationReviewRuntimeStats = buildNotificationReviewRuntimeStatsSafe(reviewItems);
  const safeActionViews = buildNotificationSafeActionRecordsSafe({
    logs: logs.map((log) => ({
      channel: log.channel,
      id: log.id,
      status: log.status,
      type: log.type
    }))
  });
  const safeActionItems: AdminNotificationControl["safeActionItems"] = safeActionViews.safeActionItems;
  const notificationSafeActionRuntimeStats = buildNotificationSafeActionRuntimeStatsSafe(safeActionItems);
  const notificationSafeActionPolicy = buildNotificationSafeActionPolicySummarySafe();
  const errorSanitizationViews = buildNotificationErrorSanitizationRecordsSafe();
  const errorSanitizationItems: AdminNotificationControl["errorSanitizationItems"] =
    errorSanitizationViews.errorSanitizationItems;
  const notificationErrorSanitizationRuntimeStats =
    buildNotificationErrorSanitizationRuntimeStatsSafe(errorSanitizationItems);
  const notificationErrorSanitizationSummary = buildNotificationErrorSanitizationSummarySafe();
  const monitoringViews = buildNotificationMonitoringRecordsSafe({
    channelSnapshots: channels,
    emailLogs,
    monitoringEvents,
    notifications,
    providerSnapshots: providerStatus
  });
  const monitoringItems: AdminNotificationControl["monitoringItems"] = monitoringViews.monitoringItems;
  const notificationMonitoringRuntimeStats = buildNotificationMonitoringRuntimeStatsSafe(monitoringItems);
  const registryProviderSnapshots = registryItems
    .filter((item) => item.registryType === "provider")
    .map((item) => ({
      channel: item.channel,
      configuredState: item.configuredState,
      description: item.description,
      health: item.health,
      metadata: item.metadata,
      name: item.name,
      secretsState: item.secretsState,
      slug: item.slug
    }));
  const providerAbstractionViews = buildNotificationProviderAbstractionRecordsSafe({
    monitoringItems,
    providers: providerStatus,
    registryProviders: registryProviderSnapshots
  });
  const providerAbstractionItems: AdminNotificationControl["providerAbstractionItems"] =
    providerAbstractionViews.providerAbstractionItems;
  const notificationProviderAbstractionRuntimeStats = buildNotificationProviderAbstractionRuntimeStatsSafe(
    providerAbstractionItems
  );
  const notificationProviderAbstractionSummary = buildNotificationProviderAbstractionSummarySafe();
  const metrics = buildNotificationMetricsSnapshotSafe({
    channelStats: notificationChannelStats,
    deliveryStatusStats: notificationDeliveryStatusStats,
    logCount: logs.length,
    notifications,
    reviewedFailuresCount: adminReviewEvents.length
  });
  const metricViews = buildNotificationMetricViewsSafe(metrics);
  const analyticsReferenceMs = Date.now();
  const analytics = buildNotificationAnalyticsSnapshotSafe({
    deliveryStatusStats: notificationDeliveryStatusStats,
    logs,
    referenceMs: analyticsReferenceMs
  });
  const analyticsBreakdownItems = buildNotificationAnalyticsBreakdownViewsSafe(logs);
  const analyticsRateViews = buildNotificationAnalyticsRateViewsSafe(analytics);
  const analyticsPeriodViews = buildNotificationAnalyticsPeriodViewsSafe({
    logs,
    referenceMs: analyticsReferenceMs
  });
  const notificationAnalyticsRuntimeStats = buildNotificationAnalyticsRuntimeStatsSafe(analytics);
  const healthViews = buildNotificationHealthRecordsSafe({
    deliveries,
    failureItems,
    failureStats: notificationFailureRuntimeStats,
    monitoringItems,
    providerStatus,
    queueItems,
    queueStats: notificationQueueRuntimeStats,
    retryItems,
    retryStats: notificationRetryRuntimeStats
  });
  const healthItems: AdminNotificationControl["healthItems"] = healthViews.healthItems;
  const health = buildNotificationHealthSnapshotSafe(healthItems);
  const notificationHealthRuntimeStats = buildNotificationHealthRuntimeStatsSafe(healthItems);
  const combinedWarning =
    [
      registryWarning,
      registryViews.warning,
      channelViews.warning,
      providerViews.warning,
      templateViews.warning,
      deliveryViews.warning,
      queueViews.warning,
      retryViews.warning,
      failureViews.warning,
      auditViews.warning,
      monitoringViews.warning,
      healthViews.warning,
      recipientViews.warning,
      eventViews.warning,
      logViews.warning,
      reviewViews.warning,
      safeActionViews.warning,
      errorSanitizationViews.warning,
      providerAbstractionViews.warning
    ]
      .filter(Boolean)
      .join(" ") || null;
  const types: AdminNotificationControl["types"] = registryViews.types.map((type) => ({
    badgeTone: type.badgeTone,
    count: typeCounts.get(type.key) ?? 0,
    description: type.description,
    key: type.key,
    label: type.label
  }));
  const sanitizedRuntimeWarning = sanitizeNotificationAdminDisplayTextSafe(combinedWarning, 500) || null;
  const securityFoundationsPresent = verifyNotificationSecurityFoundationsPresent({
    analyticsReady: analytics.analyticsReady,
    channelsPresent: channels.length > 0,
    healthReady: health.healthReady,
    metricsReady: true,
    monitoringPresent: monitoringItems.length > 0,
    providerStatusPresent: providerStatus.length > 0,
    registryPresent: registryItems.length > 0,
    templatesPresent: templates.length > 0,
    typesPresent: registryViews.types.length > 0
  });
  const securityCertificationInput = collectNotificationSecurityCertificationInput({
    auditItems,
    channels,
    deliveries,
    failureItems,
    foundationsPresent: securityFoundationsPresent,
    healthItems,
    logs,
    monitoringItems,
    providerStatus,
    queueItems,
    retryItems,
    runtimeWarning: sanitizedRuntimeWarning,
    templates
  });
  const notificationSecurityCertification = buildNotificationSecurityCertificationSafe(securityCertificationInput);
  const securityRecords = buildNotificationSecurityRecordsSafe({
    certification: securityCertificationInput,
    certificationSummary: notificationSecurityCertification
  });
  const notificationSecurityRuntimeStats = buildNotificationSecurityRuntimeStatsSafe({
    certification: notificationSecurityCertification,
    securityRecords
  });
  const readOnlyProtectionViews = buildNotificationReadOnlyProtectionRecordsSafe({
    surfaceAvailability: {
      analytics: analytics.analyticsReady,
      audit: auditItems.length > 0,
      categories: notificationCategoryStats.totalItems > 0,
      channels: channels.length > 0,
      deliveries: deliveries.length > 0,
      events: eventItems.length > 0,
      failures: failureItems.length > 0,
      health: health.healthReady,
      logs: logItems.length > 0 || logs.length > 0,
      metrics: true,
      monitoring: monitoringItems.length > 0,
      provider_abstraction: providerAbstractionItems.length > 0,
      providers: providerStatus.length > 0,
      queue: queueItems.length > 0,
      recipients: recipientItems.length > 0,
      registry: registryItems.length > 0,
      retries: retryItems.length > 0,
      reviews: reviewItems.length > 0,
      safe_actions: safeActionItems.length > 0,
      statuses: notificationDeliveryStatusStats.totalItems > 0,
      templates: templates.length > 0,
      types: types.length > 0
    }
  });
  const readOnlyProtectionItems: AdminNotificationControl["readOnlyProtectionItems"] =
    readOnlyProtectionViews.readOnlyProtectionItems;
  const notificationReadOnlyProtectionRuntimeStats =
    buildNotificationReadOnlyProtectionRuntimeStatsSafe(readOnlyProtectionItems);
  const notificationReadOnlyProtectionSummary = buildNotificationReadOnlyProtectionSummarySafe();
  const notificationReadOnlyProtectionVerified = verifyNotificationReadOnlyProtectionPresent(readOnlyProtectionItems);
  const sanitizedErrors = applyNotificationControlErrorSanitizationSafe({
    auditItems,
    deliveries,
    eventItems,
    failureItems,
    health,
    healthItems,
    logItems,
    logs,
    monitoringItems,
    queueItems,
    retryItems,
    reviewItems,
    safeActionItems,
    securityRecords
  });
  const notificationSurfaceAvailability = {
    analytics: analytics.analyticsReady,
    audit: sanitizedErrors.auditItems.length > 0,
    categories: notificationCategoryStats.totalItems > 0,
    channels: channels.length > 0,
    deliveries: sanitizedErrors.deliveries.length > 0,
    events: sanitizedErrors.eventItems.length > 0,
    failures: sanitizedErrors.failureItems.length > 0,
    health: health.healthReady,
    logs: sanitizedErrors.logItems.length > 0 || sanitizedErrors.logs.length > 0,
    metrics: true,
    monitoring: sanitizedErrors.monitoringItems.length > 0,
    provider_abstraction: providerAbstractionItems.length > 0,
    providers: providerStatus.length > 0,
    queue: sanitizedErrors.queueItems.length > 0,
    recipients: recipientItems.length > 0,
    registry: registryItems.length > 0,
    retries: sanitizedErrors.retryItems.length > 0,
    reviews: sanitizedErrors.reviewItems.length > 0,
    safe_actions: sanitizedErrors.safeActionItems.length > 0,
    statuses: notificationDeliveryStatusStats.totalItems > 0,
    templates: templates.length > 0,
    types: types.length > 0,
    read_only_protection: notificationReadOnlyProtectionVerified
  };
  const dataCertificationInput = collectNotificationDataCertificationInput({
    auditItems: sanitizedErrors.auditItems,
    channels,
    deliveries: sanitizedErrors.deliveries,
    errorSanitizationReady:
      notificationErrorSanitizationRuntimeStats.readySurfaces >=
      notificationErrorSanitizationRuntimeStats.totalSurfaces,
    eventItems: sanitizedErrors.eventItems,
    failureItems: sanitizedErrors.failureItems,
    foundationsPresent: securityFoundationsPresent,
    healthItems: sanitizedErrors.healthItems,
    logItems: sanitizedErrors.logItems,
    logs: sanitizedErrors.logs,
    monitoringItems: sanitizedErrors.monitoringItems,
    providerAbstractionItems,
    providerStatus,
    queueItems: sanitizedErrors.queueItems,
    readOnlyProtectionVerified: notificationReadOnlyProtectionVerified,
    recipientItems,
    retryItems: sanitizedErrors.retryItems,
    reviewItems: sanitizedErrors.reviewItems,
    runtimeWarning: sanitizedRuntimeWarning,
    safeActionItems: sanitizedErrors.safeActionItems,
    securityReviewPassed: notificationSecurityCertification.securityReviewPassed,
    surfaceAvailability: notificationSurfaceAvailability,
    templates
  });
  const dataCertificationViews = buildNotificationDataCertificationRecordsSafe(dataCertificationInput);
  const dataCertificationItems: AdminNotificationControl["dataCertificationItems"] =
    dataCertificationViews.dataCertificationItems;
  const notificationDataCertificationRuntimeStats =
    buildNotificationDataCertificationRuntimeStatsSafe(dataCertificationItems);
  const notificationDataCertificationSummary = buildNotificationDataCertificationSummarySafe(
    dataCertificationItems,
    dataCertificationInput
  );
  const securityCertificationDomainInput = collectNotificationSecurityCertificationDomainInput({
    auditItems: sanitizedErrors.auditItems,
    channels,
    dataCertificationPassed: notificationDataCertificationSummary.certificationPassed,
    deliveries: sanitizedErrors.deliveries,
    errorSanitizationReady:
      notificationErrorSanitizationRuntimeStats.readySurfaces >=
      notificationErrorSanitizationRuntimeStats.totalSurfaces,
    failureItems: sanitizedErrors.failureItems,
    foundationsPresent: securityFoundationsPresent,
    healthItems: sanitizedErrors.healthItems,
    logItems: sanitizedErrors.logItems,
    logs: sanitizedErrors.logs,
    monitoringItems: sanitizedErrors.monitoringItems,
    providerStatus,
    queueItems: sanitizedErrors.queueItems,
    readOnlyProtectionVerified: notificationReadOnlyProtectionVerified,
    recipientItems,
    retryItems: sanitizedErrors.retryItems,
    reviewItems: sanitizedErrors.reviewItems,
    runtimeWarning: sanitizedRuntimeWarning,
    safeActionItems: sanitizedErrors.safeActionItems,
    securityReviewPassed: notificationSecurityCertification.securityReviewPassed,
    templates
  });
  const securityCertificationDomainViews = buildNotificationSecurityCertificationDomainRecordsSafe(
    securityCertificationDomainInput
  );
  const securityCertificationDomainItems: AdminNotificationControl["securityCertificationDomainItems"] =
    securityCertificationDomainViews.securityCertificationDomainItems;
  const notificationSecurityCertificationDomainRuntimeStats =
    buildNotificationSecurityCertificationDomainRuntimeStatsSafe(securityCertificationDomainItems);
  const notificationSecurityCertificationDomainSummary = buildNotificationSecurityCertificationDomainSummarySafe(
    securityCertificationDomainItems,
    securityCertificationDomainInput
  );
  const runtimeCertificationInput = collectNotificationRuntimeCertificationInput({
    dataCertificationItems,
    dataCertificationPassed: notificationDataCertificationSummary.certificationPassed,
    errorSanitizationReady:
      notificationErrorSanitizationRuntimeStats.readySurfaces >=
      notificationErrorSanitizationRuntimeStats.totalSurfaces,
    foundationsPresent: securityFoundationsPresent,
    readOnlyProtectionItems,
    readOnlyProtectionVerified: notificationReadOnlyProtectionVerified,
    runtimeWarning: sanitizedRuntimeWarning,
    securityCertificationDomainItems: securityCertificationDomainItems,
    securityCertificationPassed: notificationSecurityCertificationDomainSummary.certificationPassed,
    securityRecords: sanitizedErrors.securityRecords,
    securityReviewPassed: notificationSecurityCertification.securityReviewPassed,
    safeActionsGuarded:
      notificationSafeActionRuntimeStats.guardedActions >= notificationSafeActionRuntimeStats.totalActions,
    surfaceAvailability: {
      ...notificationSurfaceAvailability,
      data_certification: dataCertificationItems.length > 0,
      error_sanitization: errorSanitizationItems.length > 0,
      security: sanitizedErrors.securityRecords.length > 0,
      security_certification: securityCertificationDomainItems.length > 0
    }
  });
  const runtimeCertificationViews = buildNotificationRuntimeCertificationRecordsSafe(runtimeCertificationInput);
  const runtimeCertificationItems: AdminNotificationControl["runtimeCertificationItems"] =
    runtimeCertificationViews.runtimeCertificationItems;
  const notificationRuntimeCertificationRuntimeStats =
    buildNotificationRuntimeCertificationRuntimeStatsSafe(runtimeCertificationItems);
  const notificationRuntimeCertificationSummary = buildNotificationRuntimeCertificationSummarySafe(
    runtimeCertificationItems,
    runtimeCertificationInput
  );
  const notificationRuntimeCertificationVerified =
    verifyNotificationRuntimeCertificationPresent(runtimeCertificationItems);
  const productionCertificationInput = collectNotificationProductionCertificationInput({
    dataCertificationPassed: notificationDataCertificationSummary.certificationPassed,
    errorSanitizationReady:
      notificationErrorSanitizationRuntimeStats.readySurfaces >=
      notificationErrorSanitizationRuntimeStats.totalSurfaces,
    foundationsPresent: securityFoundationsPresent,
    readOnlyProtectionVerified: notificationReadOnlyProtectionVerified,
    runtimeCertificationItems,
    runtimeCertificationPassed: notificationRuntimeCertificationSummary.certificationPassed,
    runtimeWarning: sanitizedRuntimeWarning,
    securityCertificationPassed: notificationSecurityCertificationDomainSummary.certificationPassed,
    securityReviewPassed: notificationSecurityCertification.securityReviewPassed,
    safeActionsGuarded:
      notificationSafeActionRuntimeStats.guardedActions >= notificationSafeActionRuntimeStats.totalActions,
    surfaceAvailability: {
      ...notificationSurfaceAvailability,
      data_certification: dataCertificationItems.length > 0,
      error_sanitization: errorSanitizationItems.length > 0,
      runtime_certification: runtimeCertificationItems.length > 0,
      security: sanitizedErrors.securityRecords.length > 0,
      security_certification: securityCertificationDomainItems.length > 0
    }
  });
  const productionCertificationViews = buildNotificationProductionCertificationRecordsSafe(productionCertificationInput);
  const productionCertificationItems: AdminNotificationControl["productionCertificationItems"] =
    productionCertificationViews.productionCertificationItems;
  const notificationProductionCertificationRuntimeStats =
    buildNotificationProductionCertificationRuntimeStatsSafe(productionCertificationItems);
  const notificationProductionCertificationSummary = buildNotificationProductionCertificationSummarySafe(
    productionCertificationItems,
    productionCertificationInput
  );
  const notificationProductionCertificationVerified =
    verifyNotificationProductionCertificationPresent(productionCertificationItems);
  const notificationsRuntimeConversionComplete =
    notificationProductionCertificationSummary.notificationsRuntimeConversionComplete;

  return {
    channels,
    auditItems: sanitizedErrors.auditItems,
    analytics,
    analyticsBreakdownItems,
    analyticsPeriodViews,
    analyticsRateViews,
    deliveries: sanitizedErrors.deliveries,
    failureItems: sanitizedErrors.failureItems,
    futureHooks: registryViews.futureHooks,
    health: sanitizedErrors.health ?? health,
    healthItems: sanitizedErrors.healthItems,
    logItems: sanitizedErrors.logItems,
    logs: sanitizedErrors.logs as AdminNotificationControl["logs"],
    metricViews,
    metrics,
    monitoringItems: sanitizedErrors.monitoringItems,
    notificationAnalyticsRuntimeStats,
    notificationHealthRuntimeStats,
    notificationCategoryStats,
    notificationChannelStats,
    notificationDeliveryRuntimeStats,
    notificationEventRuntimeStats,
    notificationLogRuntimeStats,
    notificationDeliveryStatusStats,
    notificationFailureRuntimeStats,
    notificationAuditRuntimeStats,
    notificationMonitoringRuntimeStats,
    notificationSecurityCertification,
    notificationSecurityRuntimeStats,
    notificationQueueRuntimeStats,
    notificationRetryRuntimeStats,
    notificationProviderStats,
    notificationRegistryCategoryStats,
    notificationRegistryProviderStats,
    notificationRegistryStatusStats,
    notificationRecipientRuntimeStats,
    notificationReviewRuntimeStats,
    reviewItems: sanitizedErrors.reviewItems,
    safeActionItems: sanitizedErrors.safeActionItems,
    notificationSafeActionPolicy,
    notificationSafeActionRuntimeStats,
    errorSanitizationItems,
    notificationErrorSanitizationSummary,
    notificationErrorSanitizationRuntimeStats,
    providerAbstractionItems,
    notificationProviderAbstractionSummary,
    notificationProviderAbstractionRuntimeStats,
    readOnlyProtectionItems,
    notificationReadOnlyProtectionSummary,
    notificationReadOnlyProtectionRuntimeStats,
    notificationReadOnlyProtectionVerified,
    dataCertificationItems,
    notificationDataCertificationSummary,
    notificationDataCertificationRuntimeStats,
    securityCertificationDomainItems,
    notificationSecurityCertificationDomainSummary,
    notificationSecurityCertificationDomainRuntimeStats,
    runtimeCertificationItems,
    notificationRuntimeCertificationSummary,
    notificationRuntimeCertificationRuntimeStats,
    notificationRuntimeCertificationVerified,
    productionCertificationItems,
    notificationProductionCertificationSummary,
    notificationProductionCertificationRuntimeStats,
    notificationProductionCertificationVerified,
    notificationsRuntimeConversionComplete,
    notificationTemplateStats,
    notificationTypeStats,
    overview: {
      archived: notificationDeliveryStatusStats.archivedItems,
      cancelled: notificationDeliveryStatusStats.cancelledItems,
      delivered: notificationDeliveryStatusStats.deliveredItems,
      draft: notificationDeliveryStatusStats.draftItems,
      failed: notificationDeliveryStatusStats.failedItems,
      queued: notificationDeliveryStatusStats.queuedItems,
      reviewedFailures: adminReviewEvents.length,
      retry: notificationDeliveryStatusStats.retryItems,
      sent:
        notificationDeliveryStatusStats.sentItems +
        notificationDeliveryStatusStats.readItems +
        notificationDeliveryStatusStats.deliveredItems,
      totalNotifications: logs.length
    },
    providerStatus,
    queueItems: sanitizedErrors.queueItems,
    recipientItems,
    eventItems: sanitizedErrors.eventItems,
    retryItems: sanitizedErrors.retryItems,
    runtimeWarning:
      [
        sanitizedRuntimeWarning,
        readOnlyProtectionViews.warning,
        dataCertificationViews.warning,
        securityCertificationDomainViews.warning,
        runtimeCertificationViews.warning,
        productionCertificationViews.warning
      ]
        .filter(Boolean)
        .join(" ") || null,
    securityRecords: sanitizedErrors.securityRecords,
    templates,
    types
  };
}

export function createFallbackAdminNotificationControl(): AdminNotificationControl {
  return buildAdminNotificationControl({
    emailLogs: [],
    monitoringEvents: [],
    notifications: [],
    registryItems: [...NOTIFICATION_REGISTRY_FALLBACK_ITEMS],
    registryWarning: "Notification registry runtime unavailable. Showing fallback registry rows."
  });
}

export async function getAdminSEOControl(): Promise<AdminSEOControl> {
  const seoPages = await listSeoPages();
  const pages: AdminSEOControl["pages"] = seoPages.map((seoPage) => ({
    ...mapSeoPageRuntimeToAdminSeoPage(seoPage),
    ...mapMetaTitleRuntimeToAdminFields(seoPage),
    ...mapMetaDescriptionRuntimeToAdminFields(seoPage),
    ...mapCanonicalRuntimeToAdminFields(seoPage),
    ...mapOpenGraphRuntimeToAdminFields(seoPage),
    ...mapSeoLanguageRuntimeToAdminFields(seoPage)
  }));
  const sitemapRuntime = await mapSitemapRuntimeToAdminFields();
  const robotsRuntime = await mapRobotsRuntimeToAdminFields();
  const structuredDataRuntime = mapStructuredDataRuntimeToAdminFields();
  const searchConsoleRuntime = mapSearchConsoleRuntimeToAdminFields();
  const isProduction = process.env.NODE_ENV === "production";

  return {
    analyticsReadiness: [
      {
        name: "Google Analytics placeholder",
        note: "Platform GA readiness placeholder only. Store Owner analytics remain separate.",
        status: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ? "configured" : "placeholder"
      },
      searchConsoleRuntime.analyticsReadinessItem,
      {
        name: "Indexing warnings placeholder",
        note: isProduction ? "Production indexing warnings can attach here." : "Non-production environment should be reviewed before indexing.",
        status: isProduction ? "placeholder" : "missing"
      }
    ],
    futureHooks: [
      "SEO editor",
      "AI SEO generator",
      "Sitemap regeneration",
      "Search Console integration",
      "SEO audit export"
    ],
    overview: {
      canonicalReady: pages.filter((page) => page.canonicalStatus === "ready").length,
      indexedPagesPlaceholder: searchConsoleRuntime.indexedPagesPlaceholder,
      languageReady: pages.filter((page) => page.languageStatus === "ready").length,
      missingMetaDescriptions: pages.filter((page) => page.metaDescriptionStatus === "missing").length,
      missingMetaTitles: pages.filter((page) => page.metaTitleStatus === "missing").length,
      robotsStatus: robotsRuntime.status,
      sitemapStatus: sitemapRuntime.status,
      structuredDataStatus: structuredDataRuntime.structuredDataStatus,
    },
    pages,
    robots: robotsRuntime,
    sitemap: sitemapRuntime,
    structuredData: structuredDataRuntime.structuredData
  };
}

export async function getAdminReportingControl(
  range: AdminReportingControl["selectedRange"] = "30d"
): Promise<AdminReportingControl> {
  const selectedRange: AdminReportingControl["selectedRange"] =
    range === "today" || range === "7d" || range === "30d" || range === "month" || range === "year"
      ? range
      : "30d";
  const [
    analytics,
    users,
    stores,
    subscriptions,
    domainsHosting,
    aiControl,
    marketplace,
    platformHealth
  ] = await Promise.all([
    getAdminAnalytics(),
    getAdminUsers(),
    getAdminStores(),
    getAdminSubscriptions(),
    getAdminDomainsHostingControl(),
    getAdminAIControl(),
    getAdminMarketplaceControl(),
    getAdminPlatformHealth()
  ]);
  const categories: AdminReportingControl["categories"] = [
    {
      description: "Revenue estimates from existing commerce and analytics aggregates.",
      name: "Revenue Reports",
      status: "ready"
    },
    {
      description: "Store health, publishing, products, views, and revenue rollups.",
      name: "Store Reports",
      status: "ready"
    },
    {
      description: "User account, plan, governance, and workspace rollups.",
      name: "User Reports",
      status: "ready"
    },
    {
      description: "Subscription plan, payment health, limits, and lifecycle rollups.",
      name: "Subscription Reports",
      status: "ready"
    },
    {
      description: "Payment provider and failed payment monitoring placeholders.",
      name: "Payment Reports",
      status: "review"
    },
    {
      description: "AI job usage, failures, stores using AI, and estimated costs.",
      name: "AI Reports",
      status: "ready"
    },
    {
      description: "Domain drafts, DNS/SSL, email mailbox drafts, and future hosting rollups.",
      name: "Domain & Email Reports",
      status: "ready"
    },
    {
      description: "Marketplace item, approval, visibility, and revenue placeholder rollups.",
      name: "Marketplace Reports",
      status: "ready"
    },
    {
      description: "Security events and audit monitoring from existing logs.",
      name: "Security Reports",
      status: "ready"
    },
    {
      description: "Support tickets, monitoring events, platform health, and operational review.",
      name: "Operations Reports",
      status: platformHealth.label === "Needs review" ? "review" : "ready"
    }
  ];
  const reports: AdminReportingControl["reports"] = [
    {
      category: "Revenue Reports",
      exportPlaceholder: "CSV/PDF export reserved",
      lastGenerated: "Live aggregate",
      name: "Platform revenue estimate",
      reportId: "revenue:platform-estimate",
      status: "ready",
      visibility: "internal"
    },
    {
      category: "Store Reports",
      exportPlaceholder: "CSV export reserved",
      lastGenerated: "Live aggregate",
      name: "Store activity and health",
      reportId: "stores:activity-health",
      status: "ready",
      visibility: "internal"
    },
    {
      category: "User Reports",
      exportPlaceholder: "CSV export reserved",
      lastGenerated: "Live aggregate",
      name: "User growth and governance",
      reportId: "users:growth-governance",
      status: "ready",
      visibility: "internal"
    },
    {
      category: "Subscription Reports",
      exportPlaceholder: "CSV/PDF export reserved",
      lastGenerated: "Live aggregate",
      name: "Subscription plan health",
      reportId: "subscriptions:plan-health",
      status: "ready",
      visibility: "internal"
    },
    {
      category: "Payment Reports",
      exportPlaceholder: "Provider export reserved",
      lastGenerated: "Placeholder",
      name: "Failed payment monitoring",
      reportId: "payments:failed-monitoring",
      status: "review",
      visibility: "internal"
    },
    {
      category: "AI Reports",
      exportPlaceholder: "Usage export reserved",
      lastGenerated: "Live aggregate",
      name: "AI usage and failures",
      reportId: "ai:usage-failures",
      status: aiControl.overview.failedJobs ? "review" : "ready",
      visibility: "internal"
    },
    {
      category: "Domain & Email Reports",
      exportPlaceholder: "CSV export reserved",
      lastGenerated: "Live aggregate",
      name: "Domain and email order readiness",
      reportId: "domains-email:readiness",
      status: domainsHosting.overview.failedOperations ? "review" : "ready",
      visibility: "internal"
    },
    {
      category: "Marketplace Reports",
      exportPlaceholder: "Marketplace export reserved",
      lastGenerated: "Live aggregate",
      name: "Marketplace approval pipeline",
      reportId: "marketplace:approval-pipeline",
      status: marketplace.overview.pendingReviewItems ? "review" : "ready",
      visibility: "internal"
    },
    {
      category: "Security Reports",
      exportPlaceholder: "Audit export reserved",
      lastGenerated: "Live aggregate",
      name: "Security event summary",
      reportId: "security:event-summary",
      status: platformHealth.recentSecurityEvents ? "review" : "ready",
      visibility: "internal"
    },
    {
      category: "Operations Reports",
      exportPlaceholder: "Scheduled delivery reserved",
      lastGenerated: "Live aggregate",
      name: "Operations and support health",
      reportId: "operations:support-health",
      status: platformHealth.label === "Needs review" ? "review" : "ready",
      visibility: "internal"
    }
  ];
  const dateFilters: AdminReportingControl["dateFilters"] = [
    { active: selectedRange === "today", href: "/admin/reports?range=today", label: "Today", value: "today" },
    { active: selectedRange === "7d", href: "/admin/reports?range=7d", label: "7 days", value: "7d" },
    { active: selectedRange === "30d", href: "/admin/reports?range=30d", label: "30 days", value: "30d" },
    { active: selectedRange === "month", href: "/admin/reports?range=month", label: "Month", value: "month" },
    { active: selectedRange === "year", href: "/admin/reports?range=year", label: "Year", value: "year" }
  ];

  return {
    categories,
    dateFilters,
    futureHooks: [
      "CSV export",
      "PDF export",
      "Scheduled reports",
      "Email report delivery",
      "BI dashboard integration"
    ],
    overview: {
      activeStores: stores.filter((store) => store.storeStatus === "active" || store.publicationStatus === "published").length,
      activeUsers: users.filter((user) => user.accountStatus === "active").length,
      aiUsage: aiControl.overview.totalJobs,
      domainOrders:
        domainsHosting.overview.domainDrafts +
        domainsHosting.overview.pendingDomainOrders +
        domainsHosting.overview.readyForRegistration,
      failedPayments: subscriptions.reduce((total, subscription) => total + subscription.failedPayments, 0),
      paidSubscriptions: subscriptions.filter((subscription) => subscription.planId !== "free" && subscription.status === "active").length,
      securityEvents: platformHealth.recentSecurityEvents,
      supportTickets: platformHealth.openSupportTickets,
      totalRevenueEstimate: analytics.revenueEstimate
    },
    reports,
    selectedRange,
    sources: [
      "getAdminAnalytics",
      "getAdminUsers",
      "getAdminStores",
      "getAdminSubscriptions",
      "getAdminDomainsHostingControl",
      "getAdminAIControl",
      "getAdminMarketplaceControl",
      "getAdminPlatformHealth"
    ]
  };
}

export async function getAdminAdvancedSecurityControl(): Promise<AdminAdvancedSecurityControl> {
  const { supabase } = await getAdminClient();
  const [securityLogs, adminEvents] = await Promise.all([
    safeSelect(
      supabase,
      "security_audit_logs",
      "id, workspace_id, store_id, user_id, action, reason, route, ip_address, user_agent, metadata, created_at",
      500
    ),
    safeSelect(supabase, "monitoring_events", "event_type, event_status, entity_type, metadata, created_at", 500)
  ]);
  const reviewedIds = new Set(
    adminEvents
      .filter((event) => text(event.event_type) === "admin_security_mark_reviewed")
      .map((event) => {
        const metadata = isRecord(event.metadata) ? event.metadata : {};
        return text(metadata.event_id);
      })
      .filter(Boolean)
  );

  function severityFor(log: AnyRecord): AdminAdvancedSecurityControl["events"][number]["severity"] {
    const action = text(log.action).toLowerCase();
    const reason = text(log.reason).toLowerCase();

    if (action.includes("token") || reason.includes("token") || action.includes("fraud")) {
      return "critical";
    }

    if (action.includes("denied") || action.includes("unauthorized") || action.includes("rate_limit") || reason.includes("abuse")) {
      return "high";
    }

    if (action.includes("login") && (action.includes("failed") || reason.includes("failed"))) {
      return "medium";
    }

    return "low";
  }

  function statusFor(
    log: AnyRecord,
    severity: AdminAdvancedSecurityControl["events"][number]["severity"]
  ): AdminAdvancedSecurityControl["events"][number]["status"] {
    const id = text(log.id);
    const action = text(log.action).toLowerCase();

    if (id && reviewedIds.has(id)) {
      return "reviewed";
    }

    if (action.includes("denied") || action.includes("rate_limit") || action.includes("blocked")) {
      return "blocked";
    }

    if (action.includes("failed")) {
      return "failed";
    }

    return severity === "high" || severity === "critical" ? "watching" : "recorded";
  }

  const events = securityLogs
    .sort((left, right) => dateValue(right.created_at) - dateValue(left.created_at))
    .slice(0, 100)
    .map((log) => {
      const severity = severityFor(log);
      const userAgent = text(log.user_agent);
      const { browserLabel, deviceLabel } = summarizeUserAgent(userAgent);

      return {
        browser: browserLabel,
        createdAt: text(log.created_at, new Date(0).toISOString()),
        device: deviceLabel,
        eventType: text(log.action, "security.event"),
        id: text(log.id) || `security:${text(log.created_at)}`,
        ipMasked: maskedIP(log.ip_address),
        severity,
        status: statusFor(log, severity),
        storeId: text(log.store_id) || null,
        summary: safeSecuritySummary(log.reason),
        userId: text(log.user_id) || null
      };
    });
  const highRiskUsers = new Set(
    events.filter((event) => (event.severity === "high" || event.severity === "critical") && event.userId).map((event) => event.userId)
  ).size;
  const highRiskStores = new Set(
    events.filter((event) => (event.severity === "high" || event.severity === "critical") && event.storeId).map((event) => event.storeId)
  ).size;
  const suspiciousEvents = events.filter((event) => event.severity === "high" || event.severity === "critical").length;
  const sections: AdminAdvancedSecurityControl["sections"] = [
    {
      name: "Audit Logs",
      note: "Uses existing security_audit_logs records without duplicating audit storage.",
      status: "monitoring"
    },
    {
      name: "Login Monitoring",
      note: "Login success and failure events are summarized from security audit actions.",
      status: "monitoring"
    },
    {
      name: "IP Monitoring",
      note: "IP addresses are masked before display.",
      status: "monitoring"
    },
    {
      name: "Device Monitoring",
      note: "Browser/device labels are derived from user-agent summaries only.",
      status: "monitoring"
    },
    {
      name: "Abuse Detection",
      note: "Unauthorized, denied, and repeated-action signals feed review status.",
      status: suspiciousEvents ? "review" : "monitoring"
    },
    {
      name: "Fraud Detection",
      note: "Fraud rules engine is reserved; current phase monitors high-risk audit patterns.",
      status: "placeholder"
    },
    {
      name: "Rate Limits",
      note: "Rate-limit exceeded events come from existing rate-limit audit logging.",
      status: events.some((event) => event.eventType.includes("rate_limit")) ? "review" : "monitoring"
    },
    {
      name: "Risk Score Engine",
      note: "Risk levels are derived from event classification; no automated enforcement here.",
      status: "placeholder"
    }
  ];

  return {
    events,
    futureHooks: [
      "Fraud rules engine",
      "IP blocklist",
      "Device fingerprinting",
      "Automated abuse detection",
      "Security alert notifications",
      "Export audit logs"
    ],
    overview: {
      deniedAccessEvents: events.filter((event) => event.eventType.toLowerCase().includes("denied")).length,
      failedLogins: events.filter((event) => event.eventType.toLowerCase().includes("login") && event.status === "failed").length,
      highRiskStores,
      highRiskUsers,
      rateLimitEvents: events.filter((event) => event.eventType.toLowerCase().includes("rate_limit")).length,
      suspiciousEvents,
      totalLoginEvents: events.filter((event) => event.eventType.toLowerCase().includes("login")).length
    },
    riskScores: [
      { count: events.filter((event) => event.severity === "low").length, description: "Routine or informational audit events.", level: "low" },
      { count: events.filter((event) => event.severity === "medium").length, description: "Failed login or moderate review signals.", level: "medium" },
      { count: events.filter((event) => event.severity === "high").length, description: "Denied access, abuse, or rate-limit signals.", level: "high" },
      { count: events.filter((event) => event.severity === "critical").length, description: "Token, fraud, or severe security signals.", level: "critical" }
    ],
    sections
  };
}

export async function getAdminOperationsControl(): Promise<AdminOperationsControl> {
  const { supabase, serviceRoleConfigured } = await getAdminClient();
  const [monitoringEvents, emailLogs, aiQueues, domainsHosting] = await Promise.all([
    safeSelect(supabase, "monitoring_events", "event_type, event_status, entity_type, metadata, created_at", 500),
    safeSelect(supabase, "email_event_logs", "id, status, sent_at, created_at, next_retry_at", 500),
    safeSelect(
      supabase,
      "ai_generation_queue",
      "id, workflow_state, queue_status, attempts, max_attempts, completed_at, failed_at, created_at, updated_at",
      500
    ),
    getAdminDomainsHostingControl()
  ]);
  const monitoringFailures = monitoringEvents.filter((event) => {
    const eventStatus = text(event.event_status).toLowerCase();
    const eventType = text(event.event_type).toLowerCase();
    return eventStatus === "failed" || eventType.includes("failed") || eventType.includes("error");
  });
  const latestMonitoring = monitoringEvents
    .map((event) => text(event.created_at))
    .filter(Boolean)
    .sort((left, right) => dateValue(right) - dateValue(left))[0] ?? null;

  function latestDate(rows: AnyRecord[], keys: string[]) {
    return rows
      .flatMap((row) => keys.map((key) => text(row[key])).filter(Boolean))
      .sort((left, right) => dateValue(right) - dateValue(left))[0] ?? null;
  }

  const emailQueue = {
    completed: emailLogs.filter((log) => text(log.status) === "sent").length,
    failed: emailLogs.filter((log) => text(log.status) === "failed").length,
    lastProcessed: latestDate(emailLogs, ["sent_at", "created_at"]),
    name: "Email event queue",
    pending: emailLogs.filter((log) => ["pending", "queued", "retry_pending"].includes(text(log.status))).length,
    processing: emailLogs.filter((log) => text(log.status) === "processing").length
  };
  const aiQueue = {
    completed: aiQueues.filter((queue) => ["succeeded", "completed", "ready"].includes(text(queue.queue_status, text(queue.workflow_state)))).length,
    failed: aiQueues.filter((queue) => text(queue.queue_status) === "failed" || text(queue.workflow_state) === "failed").length,
    lastProcessed: latestDate(aiQueues, ["completed_at", "failed_at", "updated_at", "created_at"]),
    name: "AI generation queue",
    pending: aiQueues.filter((queue) => ["queued", "waiting", "pending"].includes(text(queue.queue_status, text(queue.workflow_state)))).length,
    processing: aiQueues.filter((queue) => ["running", "processing", "generating"].includes(text(queue.queue_status, text(queue.workflow_state)))).length
  };
  const domainEmailQueue = {
    completed: domainsHosting.overview.connectedDomains,
    failed: domainsHosting.overview.failedOperations,
    lastProcessed:
      [...domainsHosting.domainOrders, ...domainsHosting.emailOrders]
        .map((order) => order.createdAt)
        .filter(Boolean)
        .sort((left, right) => dateValue(right) - dateValue(left))[0] ?? null,
    name: "Domain/email workflow queue",
    pending:
      domainsHosting.overview.pendingDomainOrders +
      domainsHosting.overview.dnsPending +
      domainsHosting.overview.sslPending +
      domainsHosting.overview.emailMailboxDrafts,
    processing: domainsHosting.overview.readyForRegistration
  };
  const monitoringQueue = {
    completed: monitoringEvents.filter((event) => ["info", "success", "recorded"].includes(text(event.event_status))).length,
    failed: monitoringFailures.length,
    lastProcessed: latestMonitoring,
    name: "Monitoring event stream",
    pending: monitoringEvents.filter((event) => ["warning", "retry_pending"].includes(text(event.event_status))).length,
    processing: 0
  };
  const queues = [emailQueue, aiQueue, domainEmailQueue, monitoringQueue];
  const r2Status = envConfigurationStatus([
    "CLOUDFLARE_R2_ACCOUNT_ID",
    "CLOUDFLARE_R2_ACCESS_KEY_ID",
    "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
    "CLOUDFLARE_R2_BUCKET"
  ]);
  const supabaseConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const queueHasFailures = queues.some((queue) => queue.failed > 0);
  const workerFailures = aiQueue.failed + emailQueue.failed + domainEmailQueue.failed + monitoringFailures.length;
  const aiWorkerStatus: AdminOperationsControl["workers"][number]["status"] =
    aiQueue.processing > 0 ? "running" : aiQueue.failed > 0 ? "warning" : "idle";
  const emailWorkerStatus: AdminOperationsControl["workers"][number]["status"] =
    emailQueue.processing > 0 ? "running" : emailQueue.failed > 0 ? "warning" : "idle";

  return {
    backupRecovery: [
      {
        name: "Backup status",
        note: "Supabase backup status is not queried in this phase.",
        status: "placeholder"
      },
      {
        name: "Last backup placeholder",
        note: "Backup timestamp will attach when provider backup APIs are connected.",
        status: "placeholder"
      },
      {
        name: "Restore test placeholder",
        note: "No restore is triggered from Super Admin Operations.",
        status: "placeholder"
      },
      {
        name: "Disaster recovery readiness",
        note: "Runbook readiness placeholder only; no production reset or restore action exists.",
        status: "review"
      }
    ],
    cronJobs: [
      {
        lastRun: latestMonitoring,
        name: "Billing sync monitor",
        nextRun: "Placeholder schedule",
        schedule: "Provider webhook driven",
        status: "placeholder"
      },
      {
        lastRun: emailQueue.lastProcessed,
        name: "Email retry monitor",
        nextRun: "Future cron placeholder",
        schedule: "Manual/store-triggered queue today",
        status: emailQueue.failed ? "review" : "placeholder"
      },
      {
        lastRun: aiQueue.lastProcessed,
        name: "AI queue monitor",
        nextRun: "Future worker schedule",
        schedule: "Worker/runtime driven",
        status: aiQueue.failed ? "review" : "placeholder"
      },
      {
        lastRun: domainEmailQueue.lastProcessed,
        name: "Domain/email workflow monitor",
        nextRun: "Future provider sync",
        schedule: "Placeholder",
        status: domainEmailQueue.failed ? "review" : "placeholder"
      }
    ],
    databaseStorage: [
      {
        metric: "Supabase health",
        note: "Presence check only. No destructive database operation is exposed.",
        status: supabaseConfigured ? "configured" : "missing",
        value: supabaseConfigured ? "Configured" : "Missing environment"
      },
      {
        metric: "R2 storage health",
        note: "Secret values remain hidden; only configuration status is shown.",
        status: r2Status === "configured" ? "configured" : r2Status === "partial" ? "review" : "missing",
        value: r2Status
      },
      {
        metric: "Database size",
        note: "Database size metrics require provider integration.",
        status: "placeholder",
        value: "Placeholder"
      },
      {
        metric: "Storage usage",
        note: "Storage usage metrics require provider integration.",
        status: "placeholder",
        value: "Placeholder"
      },
      {
        metric: "Service role readiness",
        note: "Status only; key is never displayed.",
        status: serviceRoleConfigured ? "configured" : "missing",
        value: serviceRoleConfigured ? "Configured" : "Missing"
      }
    ],
    futureHooks: [
      "Retry failed queue",
      "Restart worker",
      "Run cron manually",
      "Trigger backup",
      "Restore backup",
      "Export logs",
      "Incident notifications"
    ],
    overview: {
      aiQueueHealth: aiQueue.failed ? "needs_review" : aiQueues.length ? "healthy" : "placeholder",
      cronHealth: monitoringFailures.length ? "needs_review" : "placeholder",
      databaseHealth: supabaseConfigured ? "healthy" : "missing_config",
      domainEmailQueueHealth: domainEmailQueue.failed ? "needs_review" : domainEmailQueue.pending ? "healthy" : "placeholder",
      emailQueueHealth: emailQueue.failed ? "needs_review" : emailLogs.length ? "healthy" : "placeholder",
      queueHealth: queueHasFailures ? "needs_review" : "healthy",
      storageHealth: r2Status === "configured" ? "healthy" : r2Status === "partial" ? "needs_review" : "missing_config",
      workerHealth: workerFailures ? "needs_review" : "placeholder"
    },
    queues,
    sections: [
      {
        name: "Queues",
        note: "Aggregates existing email, AI, domain/email, and monitoring queues/log streams.",
        status: queueHasFailures ? "review" : "monitoring"
      },
      {
        name: "Workers",
        note: "Worker status is inferred from existing queue activity. No worker restart is available.",
        status: workerFailures ? "review" : "monitoring"
      },
      {
        name: "Cron Jobs",
        note: "Cron schedules are placeholders until scheduler integration is added.",
        status: "placeholder"
      },
      {
        name: "Storage Health",
        note: "Supabase/R2 configuration status only; no storage operations run here.",
        status: r2Status === "partial" ? "review" : "monitoring"
      },
      {
        name: "Database Health",
        note: "Environment and service-role readiness only; no direct database action.",
        status: supabaseConfigured ? "monitoring" : "review"
      },
      {
        name: "Backups",
        note: "Backup status is a non-destructive placeholder.",
        status: "placeholder"
      },
      {
        name: "Disaster Recovery",
        note: "Restore tests and disaster recovery runbooks are placeholders only.",
        status: "placeholder"
      },
      {
        name: "System Monitoring",
        note: "Uses existing monitoring_events without duplicating monitoring storage.",
        status: monitoringFailures.length ? "review" : "monitoring"
      }
    ],
    workers: [
      {
        failures: aiQueue.failed,
        lastRun: aiQueue.lastProcessed,
        name: "AI visual/generation worker",
        nextRun: "Runtime driven",
        status: aiWorkerStatus
      },
      {
        failures: emailQueue.failed,
        lastRun: emailQueue.lastProcessed,
        name: "Email delivery worker",
        nextRun: "Queue driven",
        status: emailWorkerStatus
      },
      {
        failures: domainEmailQueue.failed,
        lastRun: domainEmailQueue.lastProcessed,
        name: "Domain/email provider worker placeholder",
        nextRun: "Future provider sync",
        status: domainEmailQueue.failed ? "warning" : "placeholder"
      },
      {
        failures: monitoringFailures.length,
        lastRun: latestMonitoring,
        name: "Monitoring event processor",
        nextRun: "Live event stream",
        status: monitoringFailures.length ? "warning" : "idle"
      }
    ]
  };
}

const internalPermissionGroups: AdminInternalTeamControl["permissionGroups"] = [
  { description: "Platform user review and account governance.", key: "users", label: "Users" },
  { description: "Store monitoring and seller/store governance.", key: "stores", label: "Stores" },
  { description: "Subscriptions, invoices, payment provider monitoring, and revenue reports.", key: "billing", label: "Billing" },
  { description: "Domain, hosting, professional email, DNS, and SSL monitoring.", key: "domains", label: "Domains" },
  { description: "AI jobs, provider readiness, usage, and failure monitoring.", key: "ai", label: "AI" },
  { description: "Support tickets, user issues, and safe assistance workflows.", key: "support", label: "Support" },
  { description: "Security events, risk review, fraud/abuse placeholders, and audit logs.", key: "security", label: "Security" },
  { description: "Queues, workers, cron placeholders, backups, and runtime health.", key: "operations", label: "Operations" },
  { description: "Templates, themes, plugins, apps, and approval workflow placeholders.", key: "marketplace", label: "Marketplace" },
  { description: "Platform settings, integrations, branding, SEO, and governance foundations.", key: "settings", label: "Settings" }
];

export async function getAdminInternalTeamControl(): Promise<AdminInternalTeamControl> {
  const { supabase, users } = await getAdminUsersBase();
  const usersByEmail = new Map(users.map((user) => [user.email.toLowerCase(), user]));
  const [memberRows, inviteRows] = await Promise.all([
    safeSelect(
      supabase,
      "internal_team_members",
      "id, user_id, email, display_name, role, status, invited_at, accepted_at, last_active_at, created_at",
      1000
    ),
    safeSelect(
      supabase,
      "internal_team_invitations",
      "id, email, display_name, role, status, expires_at, accepted_at, accepted_user_id, invited_by, last_sent_at, email_status, email_error, created_at",
      1000
    )
  ]);
  const configuredEmails = (process.env.ADMIN_EMAILS ?? process.env.ADMIN_EMAIL ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  const configuredSuperAdminMembers = configuredEmails
    .filter((email) => !memberRows.some((row) => text(row.email).toLowerCase() === email))
    .map((email, index) => {
      const user = usersByEmail.get(email);
      const role = internalTeamRoleMeta("super_admin");

      return {
        acceptedAt: user?.createdAt ?? null,
        assignedArea: role.assignedArea,
        createdAt: user?.createdAt ?? null,
        email,
        id: user?.id ?? `configured-super-admin-${index}`,
        invitedAt: null,
        lastActiveAt: user?.lastLoginAt ?? null,
        name: user?.fullName ?? email,
        permissionsSummary: role.permissionsSummary,
        role: role.name,
        roleKey: role.key,
        status: "active" as const,
        userId: user?.id ?? null
      };
    });
  const members: AdminInternalTeamControl["members"] = [
    ...configuredSuperAdminMembers,
    ...memberRows.map((row) => {
      const member = row as InternalTeamMemberRow;
      const user = usersByEmail.get(text(member.email).toLowerCase());
      const roleKey = normalizeInternalTeamRole(member.role);
      const role = internalTeamRoleMeta(roleKey);

      return {
        acceptedAt: text(member.accepted_at) || null,
        assignedArea: role.assignedArea,
        createdAt: text(member.created_at) || null,
        email: text(member.email, "unknown@internal.local").toLowerCase(),
        id: text(member.id, text(member.user_id, text(member.email))),
        invitedAt: text(member.invited_at) || null,
        lastActiveAt: text(member.last_active_at) || user?.lastLoginAt || null,
        name: text(member.display_name) || user?.fullName || text(member.email),
        permissionsSummary: role.permissionsSummary,
        role: role.name,
        roleKey,
        status: member.status === "suspended" ? "suspended" as const : "active" as const,
        userId: text(member.user_id) || null
      };
    })
  ].sort((left, right) => dateValue(right.lastActiveAt ?? right.createdAt) - dateValue(left.lastActiveAt ?? left.createdAt));
  const invitations: AdminInternalTeamControl["invitations"] = inviteRows
    .map((row) => {
      const invite = row as InternalTeamInvitationRow;
      const roleKey = normalizeInternalTeamRole(invite.role);
      const role = internalTeamRoleMeta(roleKey);
      const expiresAt = text(invite.expires_at) || null;
      const expired = invite.status === "pending" && expiresAt ? dateValue(expiresAt) < Date.now() : false;

      return {
        acceptedAt: text(invite.accepted_at) || null,
        createdAt: text(invite.created_at) || null,
        email: text(invite.email, "pending@internal.local").toLowerCase(),
        emailStatus: text(invite.email_status, "not_sent"),
        expiresAt,
        id: text(invite.id),
        invitedAt: text(invite.created_at) || null,
        lastSentAt: text(invite.last_sent_at) || null,
        name: text(invite.display_name) || text(invite.email, "Pending invite"),
        role: role.name,
        roleKey,
        status: expired ? "expired" : invite.status
      };
    })
    .sort((left, right) => dateValue(right.createdAt) - dateValue(left.createdAt));

  return {
    accessSafety: [
      {
        name: "Final Super Admin protection",
        note: "Runtime actions block self-removal and protect the final active Super Admin from suspension or downgrade.",
        status: "enforced"
      },
      {
        name: "No destructive staff deletion",
        note: "Members and invitations are suspended, restored, cancelled, or expired; no destructive deletion is exposed.",
        status: "enforced"
      },
      {
        name: "Internal role RBAC",
        note: "Admin access is restricted by internal role while configured Super Admins retain full access.",
        status: "runtime"
      },
      {
        name: "Secure invite tokens",
        note: "Invitation tokens are stored only as SHA-256 hashes with expiration dates.",
        status: "enforced"
      },
      {
        name: "Audit every team action",
        note: "Invitation, acceptance, role, suspend, restore, resend, and cancel actions write monitoring and security audit events.",
        status: "enforced"
      }
    ],
    invitations,
    members,
    overview: {
      activeStaff: members.filter((member) => member.status === "active").length,
      finalSuperAdminProtected: "enforced",
      pendingInvites: invitations.filter((invite) => invite.status === "pending").length,
      permissionGroups: internalPermissionGroups.length,
      roles: internalTeamRoles.length,
      suspendedStaff: members.filter((member) => member.status === "suspended").length
    },
    permissionGroups: internalPermissionGroups,
    roles: internalTeamRoles
  };
}

function formattedLimit(value: number | null | undefined) {
  return value === null ? "Unlimited" : String(value ?? "Placeholder");
}

export async function getAdminPlatformSettingsControl(): Promise<AdminPlatformSettingsControl> {
  await getAdminAccess();

  const platformName = process.env.NEXT_PUBLIC_PLATFORM_NAME?.trim() || "SHASTORE";
  const supportEmail = process.env.SUPPORT_EMAIL?.trim() || process.env.EMAIL_FROM?.trim() || "support@shastore.local";
  const defaultCountry = process.env.NEXT_PUBLIC_DEFAULT_COUNTRY?.trim() || "MA";
  const defaultTimezone = process.env.NEXT_PUBLIC_DEFAULT_TIMEZONE?.trim() || "UTC";
  const defaultLanguage = process.env.NEXT_PUBLIC_DEFAULT_LANGUAGE?.trim() || "en";
  const defaultCurrency = process.env.NEXT_PUBLIC_DEFAULT_CURRENCY?.trim().toUpperCase() || "USD";
  const starterLimits = planLimitsConfig.starter;
  const proLimits = planLimitsConfig.pro;

  return {
    currencies: [
      { code: "USD", isDefault: defaultCurrency === "USD", name: "US Dollar", status: "enabled" },
      { code: "EUR", isDefault: defaultCurrency === "EUR", name: "Euro", status: "placeholder_disabled" },
      { code: "MAD", isDefault: defaultCurrency === "MAD", name: "Moroccan Dirham", status: "placeholder_disabled" },
      { code: "AED", isDefault: defaultCurrency === "AED", name: "UAE Dirham", status: "placeholder_disabled" },
      { code: "SAR", isDefault: defaultCurrency === "SAR", name: "Saudi Riyal", status: "placeholder_disabled" }
    ],
    defaultLimits: [
      {
        description: "Read-only reference from existing billing plan limits. No billing rewrite.",
        key: "default_stores_per_plan",
        value: `Starter ${formattedLimit(starterLimits.stores)} / Pro ${formattedLimit(proLimits.stores)}`
      },
      {
        description: "Read-only reference from existing product limits.",
        key: "default_products_per_plan",
        value: `Starter ${formattedLimit(starterLimits.products)} / Pro ${formattedLimit(proLimits.products)}`
      },
      {
        description: "Read-only reference from existing AI generation limits.",
        key: "default_ai_credits",
        value: `Starter ${formattedLimit(starterLimits.aiGenerations)} / Pro ${formattedLimit(proLimits.aiGenerations)}`
      },
      {
        description: "Read-only reference from existing domain limits.",
        key: "default_domain_credit",
        value: `Starter ${formattedLimit(starterLimits.domains)} / Pro ${formattedLimit(proLimits.domains)}`
      },
      {
        description: "Read-only reference from existing team member limits.",
        key: "default_team_members",
        value: `Starter ${formattedLimit(starterLimits.teamMembers)} / Pro ${formattedLimit(proLimits.teamMembers)}`
      }
    ],
    featureFlags: [
      {
        key: "platform_feature_rollout",
        note: "Future rollout control only. No feature gate changes are applied in this phase.",
        status: "placeholder"
      },
      {
        key: "marketplace_seller_access",
        note: "Future marketplace seller access flag placeholder.",
        status: "placeholder"
      },
      {
        key: "maintenance_scheduling",
        note: "Future scheduled maintenance flag placeholder.",
        status: "placeholder"
      },
      {
        key: "regional_tax_engine",
        note: "Future tax rules engine flag placeholder.",
        status: "placeholder"
      }
    ],
    futureHooks: [
      "Save global settings",
      "Feature flag rollout",
      "Regional defaults",
      "Tax rules engine",
      "Platform-wide maintenance scheduling",
      "Export settings snapshot"
    ],
    general: [
      {
        key: "platform_name",
        label: "Platform name",
        note: "Display default only; Platform Theme remains separate.",
        value: platformName
      },
      {
        key: "support_email",
        label: "Support email",
        note: "Public support reference only; no mail provider secret is shown.",
        value: supportEmail
      },
      {
        key: "default_country",
        label: "Default country",
        note: "Global default for future onboarding only.",
        value: defaultCountry
      },
      {
        key: "default_timezone",
        label: "Default timezone",
        note: "Does not overwrite Store Owner timezone settings.",
        value: defaultTimezone
      },
      {
        key: "default_language",
        label: "Default language",
        note: "Does not overwrite Store Owner language settings.",
        value: defaultLanguage
      },
      {
        key: "default_currency",
        label: "Default currency",
        note: "Does not overwrite Store Owner currency settings.",
        value: defaultCurrency
      }
    ],
    languages: [
      { code: "ar", direction: "RTL", name: "Arabic", readiness: "ready" },
      { code: "en", direction: "LTR", name: "English", readiness: "ready" },
      { code: "fr", direction: "LTR", name: "French", readiness: "placeholder" }
    ],
    legalPolicies: [
      {
        name: "Terms of Service",
        note: "Platform policy reference placeholder for public website/legal pages.",
        status: "placeholder"
      },
      {
        name: "Privacy Policy",
        note: "Platform policy reference placeholder, separate from Store Owner legal pages.",
        status: "placeholder"
      },
      {
        name: "Refund and billing policy",
        note: "Platform billing policy reference only; billing logic remains unchanged.",
        status: "placeholder"
      },
      {
        name: "Acceptable use policy",
        note: "Future moderation/security policy reference.",
        status: "placeholder"
      }
    ],
    maintenanceModes: [
      {
        name: "Platform maintenance",
        note: "Placeholder only. No platform shutdown or redirect is enabled.",
        status: "off_placeholder",
        warning: "Future toggle must require confirmation and scheduling."
      },
      {
        name: "Owner dashboard maintenance",
        note: "Placeholder only. Store Owner dashboards remain available.",
        status: "off_placeholder",
        warning: "Future toggle must not block billing, support, or auth unexpectedly."
      },
      {
        name: "Public website maintenance",
        note: "Placeholder only. Public marketing pages remain available.",
        status: "off_placeholder",
        warning: "Future toggle must preserve legal/status access."
      },
      {
        name: "Storefront maintenance",
        note: "Placeholder only. Existing storefront runtime remains untouched.",
        status: "off_placeholder",
        warning: "Future toggle must not affect stores without explicit migration/rollout."
      }
    ],
    overview: {
      currencies: 5,
      defaultCurrency,
      defaultLanguage,
      languages: 3,
      maintenanceModes: 4,
      sections: 10,
      storeSettingsTouched: 0
    },
    regionalSettings: [
      { key: "country", label: "Default country", value: defaultCountry },
      { key: "timezone", label: "Default timezone", value: defaultTimezone },
      { key: "language_direction", label: "RTL/LTR readiness", value: "Arabic RTL, English/French LTR" },
      { key: "number_format", label: "Number format", value: "Future regional default placeholder" },
      { key: "date_format", label: "Date format", value: "Future regional default placeholder" }
    ],
    safety: [
      {
        name: "Global defaults only",
        note: "Settings shown here do not overwrite existing stores or Store Owner settings.",
        status: "enforced"
      },
      {
        name: "No immediate destructive toggle",
        note: "Maintenance, feature flags, taxes, and limits are placeholder controls only.",
        status: "enforced"
      },
      {
        name: "Store Owner settings separation",
        note: "Store-specific settings remain under dashboard routes and store records.",
        status: "enforced"
      },
      {
        name: "Platform Theme separation",
        note: "Branding and theme publishing remain in /admin/platform-theme.",
        status: "enforced"
      },
      {
        name: "Billing separation",
        note: "Plan limits are displayed as references only; billing enforcement is not modified.",
        status: "enforced"
      }
    ],
    sections: [
      { name: "General settings", note: "Platform identity and default locale references.", status: "ready" },
      { name: "Languages", note: "Arabic, English, French, and direction readiness.", status: "ready" },
      { name: "Currencies", note: "Currency availability placeholders and default currency.", status: "ready" },
      { name: "Timezones", note: "Default timezone references for future onboarding.", status: "ready" },
      { name: "Taxes", note: "Tax settings are placeholders; Store Owner tax settings remain separate.", status: "placeholder" },
      { name: "Default limits", note: "Read-only billing plan limit references.", status: "ready" },
      { name: "Regional settings", note: "Regional defaults for future onboarding only.", status: "placeholder" },
      { name: "Maintenance mode", note: "Non-destructive maintenance placeholders.", status: "placeholder" },
      { name: "Legal/platform policies", note: "Platform policy references, separate from store legal pages.", status: "placeholder" },
      { name: "Feature flags placeholder", note: "Future rollout controls with no live effect.", status: "placeholder" }
    ],
    taxes: [
      {
        key: "tax_enabled",
        label: "Tax enabled",
        note: "Placeholder only; Store Owner tax settings remain store-specific.",
        value: "Off placeholder"
      },
      {
        key: "default_tax_rate",
        label: "Default tax rate",
        note: "Future onboarding default only.",
        value: "0% placeholder"
      },
      {
        key: "regional_tax_mode",
        label: "Regional tax mode",
        note: "Future tax rules engine placeholder.",
        value: "Manual placeholder"
      }
    ],
    timezones: [
      { isDefault: defaultTimezone === "UTC", label: "UTC", value: "UTC" },
      { isDefault: defaultTimezone === "Africa/Casablanca", label: "Casablanca", value: "Africa/Casablanca" },
      { isDefault: defaultTimezone === "Europe/Paris", label: "Paris", value: "Europe/Paris" },
      { isDefault: defaultTimezone === "Asia/Dubai", label: "Dubai", value: "Asia/Dubai" },
      { isDefault: defaultTimezone === "Asia/Riyadh", label: "Riyadh", value: "Asia/Riyadh" }
    ]
  };
}

export async function getAdminDomainsHostingControl(): Promise<AdminDomainsHostingControl> {
  const { supabase, users } = await getAdminUsersBase();
  const httpApiReadiness = getHttpApiReadiness();
  const owners = emailMap(users);
  const [stores, storeDomains, runtimeDomainOrders, runtimeDnsRecords] = await Promise.all([
    safeSelect(supabase, "stores", "id, owner_user_id, user_id, name, store_name, slug, store_data, created_at"),
    safeSelect(
      supabase,
      "store_domains",
      "id, store_id, store_instance_id, owner_user_id, hostname, domain_type, status, verification_status, dns_status, ssl_status, is_primary, primary_domain, created_at"
    ),
    safeSelect(
      supabase,
      "domain_orders",
      "id, store_id, domain_name, tld, provider, provider_order_id, provider_entity_id, registration_years, status, raw_response, created_at"
    ),
    safeSelect(
      supabase,
      "domain_dns_records",
      "id, domain_order_id, domain_name, record_type, name, value, ttl, priority, status, verification_status, created_at, updated_at"
    )
  ]);
  const storeById = new Map(stores.map((store) => [text(store.id), store]));
  const runtimeDomainOrderById = new Map(runtimeDomainOrders.map((order) => [text(order.id), order]));
  const dnsRecordsByOrderId = new Map<string, DomainDnsRuntimeRecord[]>();

  for (const record of runtimeDnsRecords) {
    const domainOrderId = text(record.domain_order_id);
    const recordType = text(record.record_type, "TXT") as DomainDnsRuntimeRecord["recordType"];

    if (!domainOrderId || !["A", "ALIAS", "CNAME", "TXT"].includes(recordType)) {
      continue;
    }

    const records = dnsRecordsByOrderId.get(domainOrderId) ?? [];
    records.push({
      createdAt: text(record.created_at) || null,
      domainName: text(record.domain_name),
      domainOrderId,
      id: text(record.id, `${domainOrderId}-${recordType}-${text(record.name)}`),
      name: text(record.name),
      priority: numberValue(record.priority),
      recordType,
      status: (["pending", "configured", "verified", "failed"].includes(text(record.status))
        ? text(record.status)
        : "pending") as DomainDnsRuntimeRecord["status"],
      ttl: numberValue(record.ttl) || 3600,
      updatedAt: text(record.updated_at) || null,
      value: text(record.value),
      verificationStatus: (["pending", "configured", "verified", "failed"].includes(text(record.verification_status))
        ? text(record.verification_status)
        : "pending") as DomainDnsRuntimeRecord["verificationStatus"]
    });
    dnsRecordsByOrderId.set(domainOrderId, records);
  }

  const projectedRuntimeDomainOrderIds = new Set<string>();
  const domainOrders: AdminDomainsHostingControl["domainOrders"] = [];
  const emailOrders: AdminDomainsHostingControl["emailOrders"] = [];

  for (const store of stores) {
    const storeId = text(store.id);
    const ownerId = ownerUserId(store);
    const ownerEmail = owners.get(ownerId) ?? text(ownerId, "Unknown owner");
    const storeName = text(store.store_name, text(store.name, "Untitled store"));
    const storeData = store.store_data;

    for (const draft of recordsFromStoreData(storeData, "domainOrderDrafts")) {
      const domain = text(draft.selectedDomain);

      domainOrders.push({
        adminContactId: null,
        autoRenew: null,
        billingContactId: null,
        createdAt: text(draft.createdAt),
        customerDueCents: centsValue(draft.customerDueCents ?? draft.customerDue),
        domain,
        domainOrderId: null,
        dnsRecords: [],
        extension: text(draft.extension, domain.includes(".") ? `.${domain.split(".").pop()}` : "unknown"),
        id: text(draft.id, `${storeId}-domain-draft-${domain}`),
        nameserverCount: 0,
        nameservers: [],
        nextStep: text(isRecord(draft.paymentPreparation) ? draft.paymentPreparation.nextStep : null, "Prepare payment or registration workflow"),
        ownerEmail,
        planCreditUsedCents: centsValue(draft.creditUsedCents ?? draft.creditUsed),
        provider: null,
        providerCustomerId: null,
        providerEntityId: null,
        providerErrorMessage: null,
        providerOrderId: null,
        providerResponse: null,
        providerStatusSyncedAt: null,
        registrantContactId: null,
        registrationYears: null,
        status: text(draft.status, "draft"),
        storeId,
        storeName,
        techContactId: null,
        timelineEvents: domainTimelineFromDraft({ draft }),
        updatedAt: text(draft.updatedAt, text(draft.createdAt))
      });
    }

    for (const workflow of recordsFromStoreData(storeData, "domainRegistrationWorkflows")) {
      const domain = text(workflow.domain);
      const dnsSetup = isRecord(workflow.dnsSetup) ? workflow.dnsSetup : {};
      const sslSetup = isRecord(workflow.sslSetup) ? workflow.sslSetup : {};
      const providerRawResponse = workflow.providerRawResponse;
      const registrationResponse = providerRegistrationResponse(providerRawResponse);
      const contactCreateResponse = isRecord(providerRawResponse)
        ? providerRawResponse.contactCreate
        : null;
      const nameservers = nameserverListFromWorkflow(workflow);
      const contactId = contactCreateId(contactCreateResponse);
      const providerErrorMessage = providerErrorFromWorkflow(workflow);
      const providerOrderId = text(workflow.providerOrderId) || firstTextValue(registrationResponse, ["orderid", "orderId", "entityid", "entityId"]);
      const draft = recordFromStoreDataById(storeData, "domainOrderDrafts", text(workflow.domainOrderDraftId));
      const preview = recordFromStoreDataById(storeData, "domainCheckoutPreviews", text(workflow.domainCheckoutPreviewId));
      const domainOrderId = text(workflow.registrationOrderId) || null;
      const runtimeOrder = domainOrderId ? runtimeDomainOrderById.get(domainOrderId) : null;
      const runtimeRawResponse = runtimeOrder?.raw_response;
      const runtimeStatusSync = responseRecord(runtimeRawResponse);
      const providerStatusSyncedAt = firstTextValue(runtimeStatusSync, ["providerStatusSyncedAt", "syncedAt"]);
      const dnsRecords = domainOrderId
        ? dnsRecordsByOrderId.get(domainOrderId) ??
          buildDefaultDomainDnsRecords({
            domainName: domain,
            domainOrderId,
            dnsSetup: {
              domain,
              records: [],
              status: "pending",
              targetStore: storeName
            }
          })
        : [];

      if (domainOrderId) {
        projectedRuntimeDomainOrderIds.add(domainOrderId);
      }

      domainOrders.push({
        adminContactId: firstTextValue(workflow, ["adminContactId", "admin-contact-id"]) ?? contactId,
        autoRenew: firstTextValue(registrationResponse, ["auto-renew", "autoRenew"]),
        billingContactId: firstTextValue(workflow, ["billingContactId", "billing-contact-id"]) ?? contactId,
        createdAt: text(workflow.createdAt),
        customerDueCents: centsValue(workflow.customerDueCents ?? workflow.customerDue),
        domain,
        domainOrderId,
        dnsRecords,
        extension: domain.includes(".") ? `.${domain.split(".").pop()}` : "unknown",
        id: text(workflow.id, `${storeId}-domain-workflow-${domain}`),
        nameserverCount: nameservers.length,
        nameservers,
        nextStep: text(dnsSetup.status) === "verified" ? "Request SSL placeholder" : "Verify DNS placeholder",
        ownerEmail,
        planCreditUsedCents: 0,
        provider: text(workflow.provider) || null,
        providerCustomerId: firstTextValue(workflow, ["customerId", "customer-id"]) ?? firstTextValue(registrationResponse, ["customerid", "customer-id", "customerId"]),
        providerEntityId: text(workflow.providerEntityId) || text(runtimeOrder?.provider_entity_id) || firstTextValue(registrationResponse, ["entityid", "entityId"]),
        providerErrorMessage,
        providerOrderId: providerOrderId || text(runtimeOrder?.provider_order_id) || null,
        providerResponse: sanitizedProviderResponse(runtimeRawResponse ?? providerRawResponse),
        providerStatusSyncedAt,
        registrantContactId: firstTextValue(workflow, ["registrantContactId", "reg-contact-id"]) ?? contactId,
        registrationYears: numberValue(workflow.registrationYears) || null,
        status: text(runtimeOrder?.status, text(workflow.status, "ready_for_registration")),
        storeId,
        storeName,
        techContactId: firstTextValue(workflow, ["techContactId", "tech-contact-id"]) ?? contactId,
        timelineEvents: workflowTimelineEvents({
          contactCreateResponse,
          dnsSetup,
          draft,
          preview,
          providerErrorMessage,
          providerOrderId,
          registrationResponse,
          sslSetup,
          workflow
        }),
        updatedAt: text(workflow.updatedAt, text(workflow.createdAt))
      });

      if (text(sslSetup.status) || text(dnsSetup.status)) {
        // Registration workflows also represent DNS/SSL placeholders before a store_domains row exists.
      }
    }

    for (const draft of [
      ...recordsFromStoreData(storeData, "professionalEmailMailboxDrafts"),
      ...recordsFromStoreData(storeData, "professionalEmailOrderDrafts")
    ]) {
      const emailDnsSetup = isRecord(draft.emailDnsSetup) ? draft.emailDnsSetup : {};
      const mailboxPlan = isRecord(draft.mailboxPlan) ? draft.mailboxPlan : {};

      emailOrders.push({
        activationStatus: text(draft.activationStatus, text(draft.status, "draft")),
        createdAt: text(draft.createdAt),
        dnsStatus: text(emailDnsSetup.status, "dns_pending"),
        domain: text(draft.domain),
        id: text(draft.id, `${storeId}-email-${text(draft.mailboxAddress, text(draft.emailAddress))}`),
        mailboxAddress: text(draft.mailboxAddress, text(draft.emailAddress, "Not prepared")),
        mailboxPlan: text(mailboxPlan.label, text(draft.mailboxType, "Mailbox draft")),
        ownerEmail,
        status: text(draft.status, "draft"),
        storeId,
        storeName
      });
    }
  }

  for (const order of runtimeDomainOrders) {
    const domainOrderId = text(order.id);

    if (projectedRuntimeDomainOrderIds.has(domainOrderId)) {
      continue;
    }

    const store = storeById.get(text(order.store_id));
    const ownerId = store ? ownerUserId(store) : "";
    const domain = text(order.domain_name, "Unknown domain");
    const rawResponse = order.raw_response;
    const rawRecord = responseRecord(rawResponse);
    const statusSync = responseRecord(rawRecord.statusSync);
    const providerStatus = firstTextValue(rawRecord, ["latestProviderStatus", "providerStatus", "currentstatus", "status"]);
    const providerStatusSyncedAt =
      firstTextValue(rawRecord, ["providerStatusSyncedAt", "syncedAt"]) ??
      firstTextValue(statusSync, ["syncedAt"]);
    const providerOrderId = text(order.provider_order_id) || firstTextValue(rawRecord, ["orderid", "orderId"]);
    const providerEntityId = text(order.provider_entity_id) || firstTextValue(rawRecord, ["entityid", "entityId"]);
    const dnsRecords =
      dnsRecordsByOrderId.get(domainOrderId) ??
      buildDefaultDomainDnsRecords({
        domainName: domain,
        domainOrderId
      });

    domainOrders.push({
      adminContactId: firstTextValue(rawRecord, ["adminContactId", "admin-contact-id"]),
      autoRenew: firstTextValue(rawRecord, ["auto-renew", "autoRenew"]),
      billingContactId: firstTextValue(rawRecord, ["billingContactId", "billing-contact-id"]),
      createdAt: text(order.created_at),
      customerDueCents: 0,
      domain,
      domainOrderId,
      dnsRecords,
      extension: text(order.tld, domain.includes(".") ? `.${domain.split(".").pop()}` : "unknown"),
      id: domainOrderId,
      nameserverCount: 0,
      nameservers: [],
      nextStep: providerStatusSyncedAt ? "Provider status synced" : "Sync provider status",
      ownerEmail: store ? owners.get(ownerId) ?? text(ownerId, "Unknown owner") : "Unknown owner",
      planCreditUsedCents: 0,
      provider: text(order.provider, "httpapi") || null,
      providerCustomerId: firstTextValue(rawRecord, ["customerid", "customer-id", "customerId"]),
      providerEntityId,
      providerErrorMessage: providerErrorFromWorkflow({ providerRawResponse: rawResponse, registrationError: null }),
      providerOrderId,
      providerResponse: sanitizedProviderResponse(rawResponse),
      providerStatusSyncedAt,
      registrantContactId: firstTextValue(rawRecord, ["registrantContactId", "reg-contact-id"]),
      registrationYears: numberValue(order.registration_years) || null,
      status: text(order.status, providerStatus ?? "unknown"),
      storeId: text(order.store_id),
      storeName: store ? text(store.store_name, text(store.name, "Untitled store")) : "Unknown store",
      techContactId: firstTextValue(rawRecord, ["techContactId", "tech-contact-id"]),
      timelineEvents: [
        timelineEvent({
          label: "Runtime domain order created",
          providerMessage: text(order.status) || null,
          providerOrderId,
          status: text(order.status) === "failed" ? "failed" : "info",
          timestamp: text(order.created_at) || null
        }),
        ...(providerStatusSyncedAt
          ? [
              timelineEvent({
                label: "Provider status synced",
                providerMessage: providerStatus,
                providerOrderId,
                status: providerStatus === "active" ? "success" : providerStatus === "failed" ? "failed" : "info",
                timestamp: providerStatusSyncedAt
              })
            ]
          : [])
      ],
      updatedAt: providerStatusSyncedAt ?? text(order.created_at)
    });
  }

  const sslStatuses: AdminDomainsHostingControl["sslStatuses"] = storeDomains.map((domain) => {
    const store = storeById.get(text(domain.store_id)) ?? storeById.get(text(domain.store_instance_id));
    const ownerId = store ? ownerUserId(store) : text(domain.owner_user_id);

    return {
      createdAt: text(domain.created_at),
      dnsStatus: text(domain.dns_status, text(domain.verification_status, "pending")),
      domain: text(domain.hostname, text(domain.primary_domain, "Unknown domain")),
      id: text(domain.id),
      ownerEmail: owners.get(ownerId) ?? text(ownerId, "Unknown owner"),
      primaryDomainStatus: domain.is_primary === true ? "primary" : "secondary",
      provider: null,
      sslStatus: text(domain.ssl_status, "pending"),
      storeId: store ? text(store.id) : text(domain.store_id, text(domain.store_instance_id)),
      storeName: store ? text(store.store_name, text(store.name, "Untitled store")) : "Unknown store"
    };
  });
  const workflowSslStatuses = stores.flatMap((store) =>
    recordsFromStoreData(store.store_data, "domainRegistrationWorkflows").map((workflow) => {
      const dnsSetup = isRecord(workflow.dnsSetup) ? workflow.dnsSetup : {};
      const sslSetup = isRecord(workflow.sslSetup) ? workflow.sslSetup : {};

      return {
        createdAt: text(workflow.createdAt),
        dnsStatus: text(dnsSetup.status, "not_started"),
        domain: text(workflow.domain, "Pending domain"),
        id: text(workflow.id, `${text(store.id)}-workflow-ssl`),
        ownerEmail: owners.get(ownerUserId(store)) ?? text(ownerUserId(store), "Unknown owner"),
        primaryDomainStatus: "workflow placeholder",
        provider: text(workflow.provider) || null,
        sslStatus: text(sslSetup.status, "ssl_pending"),
        storeId: text(store.id),
        storeName: text(store.store_name, text(store.name, "Untitled store"))
      };
    })
  );
  const allSslStatuses = [...sslStatuses, ...workflowSslStatuses];
  const allDnsRecords = domainOrders.flatMap((order) => order.dnsRecords);
  const failedDomainOperations = domainOrders.filter((order) => order.status.includes("failed")).length;
  const failedEmailOperations = emailOrders.filter(
    (order) => order.status.includes("failed") || order.activationStatus.includes("failed")
  ).length;

  return {
    domainOrders,
    emailOrders,
    hostingPlaceholder: {
      orders: "No hosting orders are provisioned in this phase.",
      providerHook: "Hosting provider hook is reserved for future implementation.",
      provisioning: "No real hosting provisioning runs from Super Admin."
    },
    overview: {
      connectedDomains: storeDomains.filter(
        (domain) =>
          text(domain.status) === "active" ||
          text(domain.verification_status) === "verified" ||
          text(domain.dns_status) === "verified"
      ).length,
      dnsPending:
        allDnsRecords.filter((record) => record.status === "pending").length +
        storeDomains.filter((domain) => ["pending", "verifying", "not_configured"].includes(text(domain.dns_status))).length +
        workflowSslStatuses.filter((status) => status.dnsStatus !== "verified").length,
      dnsConfigured: allDnsRecords.filter((record) => record.status === "configured").length,
      dnsFailed: allDnsRecords.filter((record) => record.status === "failed" || record.verificationStatus === "failed").length,
      dnsVerified: allDnsRecords.filter((record) => record.status === "verified" || record.verificationStatus === "verified").length,
      domainDrafts: stores.reduce(
        (total, store) => total + recordsFromStoreData(store.store_data, "domainOrderDrafts").length,
        0
      ),
      emailMailboxDrafts: emailOrders.length,
      failedOperations: failedDomainOperations + failedEmailOperations + storeDomains.filter((domain) =>
        [text(domain.status), text(domain.verification_status), text(domain.dns_status), text(domain.ssl_status)].includes("failed")
      ).length,
      pendingDomainOrders: domainOrders.filter((order) => order.status === "draft" || order.status.includes("pending")).length,
      readyForRegistration: domainOrders.filter((order) => order.status === "ready_for_registration").length,
      sslPending: allSslStatuses.filter((status) => !["active", "ssl_active", "ready"].includes(status.sslStatus)).length
    },
    platformBalance: {
      note: "Internal Super Admin placeholder only. No provider balance API is connected.",
      status: "blocked_until_future_provider_balance_check"
    },
    providerHealth: [
      {
        service: "Domain service health",
        status: httpApiReadiness.enabled ? "ready" : "review",
        note: httpApiReadiness.enabled
          ? "HTTPAPI domain availability search is configured. Admin health does not call the provider."
          : "Configure HTTPAPI_BASE_URL, HTTPAPI_RESELLER_ID, and HTTPAPI_API_KEY to enable domain availability search."
      },
      { service: "Email service health", status: "placeholder", note: "Mailbox provider checks are reserved." },
      { service: "SSL service health", status: "placeholder", note: "SSL issuance checks are placeholders only." },
      { service: "Hosting service health", status: "placeholder", note: "Hosting provisioning is not implemented yet." }
    ],
    sslStatuses: allSslStatuses
  };
}

export async function getAdminAnalytics(): Promise<AdminAnalytics> {
  const { supabase } = await getAdminClient();
  const [orders, events] = await Promise.all([
    safeSelect(supabase, "commerce_orders", "id, total_amount, total, products, status"),
    safeSelect(
      supabase,
      "analytics_events",
      "source_type, source_slug, event_type, visitor_id, product_name"
    )
  ]);
  const pageViews = events.filter((event) => event.event_type === "page_view");
  const visitors = new Set(
    events.filter((event) => event.visitor_id).map((event) => text(event.visitor_id))
  ).size;
  const conversions = events.filter((event) => event.event_type === "conversion").length;
  const landingCounts = new Map<string, { label: string; count: number }>();
  const storeCounts = new Map<string, { label: string; count: number }>();
  const productCounts = new Map<string, { label: string; count: number }>();

  for (const event of pageViews) {
    const slug = text(event.source_slug, "unknown");
    const target = event.source_type === "store" ? storeCounts : landingCounts;
    const current = target.get(slug);
    target.set(slug, { label: slug, count: (current?.count ?? 0) + 1 });
  }

  for (const event of events) {
    if (event.event_type === "product_view" && text(event.product_name)) {
      const name = text(event.product_name);
      const current = productCounts.get(name);
      productCounts.set(name, { label: name, count: (current?.count ?? 0) + 1 });
    }
  }

  for (const order of orders) {
    const products = Array.isArray(order.products) ? order.products : [];
    for (const product of products) {
      if (product && typeof product === "object" && "name" in product) {
        const name = text((product as AnyRecord).name, "Product");
        const current = productCounts.get(name);
        productCounts.set(name, { label: name, count: (current?.count ?? 0) + 1 });
      }
    }
  }

  return {
    conversionRate: pageViews.length ? Math.round((conversions / pageViews.length) * 1000) / 10 : 0,
    conversions,
    orders: orders.length,
    revenueEstimate: sumBy(orders, "total_amount") || sumBy(orders, "total"),
    topLandings: [...landingCounts.values()]
      .filter((source) => source.label !== "unknown")
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
    topProducts: [...productCounts.values()].sort((a, b) => b.count - a.count).slice(0, 5),
    topStores: [...storeCounts.values()]
      .filter((source) => source.label !== "unknown")
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
    visitors,
    whatsappClicks: events.filter((event) => event.event_type === "whatsapp_click").length
  };
}

export async function getAdminPlatformHealth(): Promise<AdminPlatformHealth> {
  const { supabase } = await getAdminClient();
  const [monitoringEvents, securityEvents, supportTickets] = await Promise.all([
    safeSelect(supabase, "monitoring_events", "event_status, event_type"),
    safeSelect(supabase, "security_audit_logs", "action"),
    safeSelect(supabase, "support_tickets", "status")
  ]);
  const failedMonitoringEvents = monitoringEvents.filter(
    (event) =>
      text(event.event_status) === "failed" ||
      text(event.event_type).toLowerCase().includes("error") ||
      text(event.event_type).toLowerCase().includes("failed")
  ).length;
  const openSupportTickets = supportTickets.filter((ticket) => {
    const status = text(ticket.status).toLowerCase();
    return status !== "resolved" && status !== "closed";
  }).length;

  return {
    failedMonitoringEvents,
    label: failedMonitoringEvents || openSupportTickets ? "Needs review" : "Stable",
    openSupportTickets,
    recentSecurityEvents: securityEvents.length
  };
}
