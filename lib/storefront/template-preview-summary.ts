import { getTemplateBlueprintForTemplate } from "@/lib/storefront/template-blueprints";
import {
  getTemplatePackageForTemplate,
  type TemplatePackage
} from "@/lib/storefront/template-packages";
import type { StoreTemplateRecord } from "@/lib/storefront/template-library";

export type TemplatePreviewSummary = {
  aiVisualSlotCount: number;
  blogArticleCount: number;
  categoryCount: number;
  customPageCount: number;
  faqCount: number;
  hasAIVisualSupport: boolean;
  hasPackage: boolean;
  homepageSectionCount: number;
  legalPageCount: number;
  packageName: string | null;
  packageVersion: number | null;
  productCount: number;
  reviewCount: number;
  templateSectionCount: number;
  variantCount: number;
};

export function templatePackageForRecord(template: StoreTemplateRecord) {
  return getTemplatePackageForTemplate(template.id);
}

export function templatePreviewSummary(
  template: StoreTemplateRecord,
  templatePackage: TemplatePackage | null = templatePackageForRecord(template)
): TemplatePreviewSummary {
  const blueprint = getTemplateBlueprintForTemplate(template.id);
  const packageVisualSlots = templatePackage?.visualAssetSlots
    ? Object.keys(templatePackage.visualAssetSlots).length
    : 0;
  const aiVisualSlotCount = Math.max(packageVisualSlots, blueprint.visualAssetSlots.length);
  const templateSectionCount = Array.isArray(template.layout_schema.sections)
    ? template.layout_schema.sections.length
    : 0;

  return {
    aiVisualSlotCount,
    blogArticleCount: templatePackage?.blogArticles?.length ?? 0,
    categoryCount: templatePackage?.categories?.length ?? 0,
    customPageCount: (templatePackage?.pages?.length ?? 0) + (templatePackage?.aboutPage ? 1 : 0),
    faqCount: templatePackage?.faq?.length ?? 0,
    hasAIVisualSupport: aiVisualSlotCount > 0 || Boolean(templatePackage?.generationHooks),
    hasPackage: Boolean(templatePackage),
    homepageSectionCount: templatePackage?.homepageSections?.length ?? templateSectionCount,
    legalPageCount: templatePackage?.legalPages?.length ?? 0,
    packageName: templatePackage?.name ?? null,
    packageVersion: templatePackage?.version ?? null,
    productCount: templatePackage?.products?.length ?? 0,
    reviewCount: templatePackage?.reviews?.length ?? 0,
    templateSectionCount,
    variantCount: templatePackage?.variants?.length ?? 0
  };
}

export function templateLibraryBadges(
  template: StoreTemplateRecord,
  summary: TemplatePreviewSummary = templatePreviewSummary(template)
) {
  return [
    template.is_official ? "Official" : null,
    template.is_recommended ? "Recommended" : null,
    template.package_enabled || summary.hasPackage ? "Ready-to-use" : null,
    summary.hasAIVisualSupport ? "AI visuals" : null
  ].filter((badge): badge is string => Boolean(badge));
}
