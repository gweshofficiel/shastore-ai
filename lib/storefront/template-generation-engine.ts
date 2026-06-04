import {
  getTemplateBlueprint,
  getTemplateBlueprintForTemplate,
  inheritedStorefrontRuntimeSlots,
  templateBlueprintRegistry,
  verifyBlueprintRuntimeInheritance,
  type TemplateBlueprint,
  type TemplateIndustry
} from "@/lib/storefront/template-blueprints";
import {
  getTemplatePackageForTemplate,
  templatePackageRegistry,
  type TemplatePackage
} from "@/lib/storefront/template-packages";

export type TemplateGenerationProfile = {
  blueprint: TemplateBlueprint;
  blueprintId: TemplateIndustry;
  industry: TemplateIndustry;
  package: TemplatePackage | null;
  packageVersion: number | null;
  recommendedAudience: string[];
  style: string;
  visualProfile: TemplateBlueprint["visualProfile"];
};

export type FutureTemplateConfiguration = {
  blueprintId: TemplateIndustry;
  package?: Partial<TemplatePackage>;
  templateId: string;
  templateName: string;
};

/** Official templates prepared for registry expansion (blueprint-backed; packages optional). */
export const officialTemplateRegistryEntries = templateBlueprintRegistry.map((blueprint) => ({
  blueprintId: blueprint.id,
  industry: blueprint.industry,
  isOfficial: blueprint.id === "multi-purpose",
  isRecommended: blueprint.id === "multi-purpose" || blueprint.id === "fashion" || blueprint.id === "beauty",
  packageEnabled: blueprint.id === "multi-purpose",
  packageVersion: blueprint.packageVersion,
  primaryTemplateId: blueprint.templateIds[0] ?? `shastore-${blueprint.id}`,
  recommendedAudience: blueprint.recommendedAudience,
  style: blueprint.style,
  templateIds: blueprint.templateIds,
  visualProfile: blueprint.visualProfile
}));

export function resolveTemplateGenerationProfile(templateId?: string | null): TemplateGenerationProfile {
  const blueprint = getTemplateBlueprintForTemplate(templateId);
  const templatePackage = getTemplatePackageForTemplate(templateId ?? blueprint.templateIds[0] ?? "");

  return {
    blueprint,
    blueprintId: blueprint.id,
    industry: blueprint.industry,
    package: templatePackage,
    packageVersion: templatePackage?.version ?? blueprint.packageVersion,
    recommendedAudience: blueprint.recommendedAudience,
    style: blueprint.style,
    visualProfile: blueprint.visualProfile
  };
}

export function buildFutureTemplateConfiguration(input: FutureTemplateConfiguration) {
  const blueprint = getTemplateBlueprint(input.blueprintId);

  return {
    blueprint,
    inheritedRuntimeSlots: [...inheritedStorefrontRuntimeSlots],
    packageDefinition: input.package
      ? {
          ...input.package,
          id: input.package.id ?? `${input.templateId}-foundation`,
          name: input.package.name ?? input.templateName,
          templateIds: input.package.templateIds ?? [input.templateId],
          version: input.package.version ?? blueprint.packageVersion
        }
      : null,
    runtimeSectionOrder: blueprint.runtimeSectionOrder,
    templateId: input.templateId,
    templateMetadata: {
      blueprintId: blueprint.id,
      industry: blueprint.industry,
      packageVersion: blueprint.packageVersion,
      recommendedAudience: blueprint.recommendedAudience,
      style: blueprint.style,
      visualProfile: blueprint.visualProfile
    }
  };
}

export function listInstallableTemplatePackages() {
  return templatePackageRegistry.map((templatePackage) => ({
    packageId: templatePackage.id,
    packageVersion: templatePackage.version,
    templateIds: templatePackage.templateIds
  }));
}

export function verifyTemplateGenerationInheritance(templateId?: string | null) {
  const profile = resolveTemplateGenerationProfile(templateId);
  const blueprintCheck = verifyBlueprintRuntimeInheritance(profile.blueprint);

  return {
    blueprint: blueprintCheck,
    generationHooksReady: Boolean(profile.blueprint.aiGenerationHooks.bannerPromptKey),
    industry: profile.industry,
    packageCompatible: profile.package ? profile.package.templateIds.includes(templateId ?? "") : true,
    profile,
    runtimeInherited: blueprintCheck.ok
  };
}
