import {
  promptBlueprintForAssetSlot,
  renderAIVisualPrompt,
  type AIVisualPromptBlueprint,
  type AIVisualPromptContext
} from "@/lib/storefront/ai-visual-prompts";
import type { TemplateBlueprint } from "@/lib/storefront/template-blueprints";
import type {
  VisualAssetReference,
  VisualAssetSlot,
  VisualAssetSource
} from "@/lib/storefront/visual-assets";

export type AIVisualAssetRequestKind =
  | "product_image"
  | "category_image"
  | "hero_banner"
  | "promo_banner"
  | "collection_banner";

export type AIVisualAssetGenerationStatus =
  | "pending"
  | "processing"
  | "generating"
  | "completed"
  | "failed"
  | "cancelled"
  | "skipped";

export type AIVisualAssetStorageDestination = {
  bucket: string | null;
  provider: "cloudflare-r2" | "asset-resolver" | "external-url" | "none";
  resolverSource: VisualAssetSource;
  r2KeyPrefix: string | null;
  slot: VisualAssetSlot;
};

export type AIVisualAssetRequest = {
  adminActionRequired: true;
  createdAt: string;
  entityId: string | null;
  entityTitle: string;
  kind: AIVisualAssetRequestKind;
  metadata: Record<string, unknown>;
  prompt: {
    blueprint: AIVisualPromptBlueprint;
    negativePrompt: string;
    promptText: string;
  };
  requestedByUserId: string | null;
  requestId: string;
  slot: VisualAssetSlot;
  status: AIVisualAssetGenerationStatus;
  storage: AIVisualAssetStorageDestination;
  storeId: string;
  templateId: string | null;
};

export type AIVisualAssetRequestInput = {
  entityId?: string | null;
  entityTitle: string;
  kind: AIVisualAssetRequestKind;
  metadata?: Record<string, unknown>;
  promptContext?: AIVisualPromptContext;
  requestedByUserId?: string | null;
  requestId?: string;
  slot: VisualAssetSlot;
  status?: AIVisualAssetGenerationStatus;
  storeId: string;
  templateId?: string | null;
};

export type AIVisualAssetProviderPlan = {
  canRunAutomatically: false;
  providerConnected: false;
  providerKeyRequired: string | null;
  request: AIVisualAssetRequest;
  safety: {
    explicitAdminActionRequired: true;
    noClientSecrets: true;
    noPageLoadGeneration: true;
    paidGenerationDisabled: true;
  };
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "visual-asset";
}

function requestIdFor(input: AIVisualAssetRequestInput) {
  return [
    "ai-visual",
    input.storeId,
    input.templateId ?? "template",
    input.kind,
    input.slot.replace(/\./g, "-"),
    input.entityId ?? slugify(input.entityTitle)
  ].map(slugify).join("-");
}

export function requestKindForVisualAssetSlot(slot: VisualAssetSlot): AIVisualAssetRequestKind {
  if (slot.startsWith("product.")) {
    return "product_image";
  }

  if (slot.startsWith("category.")) {
    return "category_image";
  }

  if (slot.startsWith("hero.")) {
    return "hero_banner";
  }

  if (slot === "marketing.collection") {
    return "collection_banner";
  }

  return "promo_banner";
}

export function storageDestinationForVisualAssetSlot({
  slot,
  storeId,
  templateId
}: {
  slot: VisualAssetSlot;
  storeId: string;
  templateId?: string | null;
}): AIVisualAssetStorageDestination {
  return {
    bucket: "storefront-visual-assets",
    provider: "cloudflare-r2",
    resolverSource: "r2",
    r2KeyPrefix: [
      "storefronts",
      slugify(storeId),
      templateId ? slugify(templateId) : "template",
      slot.replace(/\./g, "/")
    ].join("/"),
    slot
  };
}

export function createAIVisualAssetRequest(input: AIVisualAssetRequestInput): AIVisualAssetRequest {
  const blueprint = promptBlueprintForAssetSlot(input.slot);
  const promptText = renderAIVisualPrompt({
    blueprint,
    context: input.promptContext ?? {},
    slot: input.slot
  });

  return {
    adminActionRequired: true,
    createdAt: new Date().toISOString(),
    entityId: input.entityId ?? null,
    entityTitle: input.entityTitle,
    kind: input.kind,
    metadata: input.metadata ?? {},
    prompt: {
      blueprint,
      negativePrompt: blueprint.negativePrompt,
      promptText
    },
    requestedByUserId: input.requestedByUserId ?? null,
    requestId: input.requestId ?? requestIdFor(input),
    slot: input.slot,
    status: input.status ?? "pending",
    storage: storageDestinationForVisualAssetSlot({
      slot: input.slot,
      storeId: input.storeId,
      templateId: input.templateId
    }),
    storeId: input.storeId,
    templateId: input.templateId ?? null
  };
}

export function createSkippedAIVisualAssetRequest(input: Omit<AIVisualAssetRequestInput, "status">) {
  return createAIVisualAssetRequest({
    ...input,
    metadata: {
      ...input.metadata,
      skipReason: "No explicit admin/store-owner action was provided."
    },
    status: "skipped"
  });
}

export function planAIVisualAssetProviderRequest(request: AIVisualAssetRequest): AIVisualAssetProviderPlan {
  return {
    canRunAutomatically: false,
    providerConnected: false,
    providerKeyRequired: null,
    request,
    safety: {
      explicitAdminActionRequired: true,
      noClientSecrets: true,
      noPageLoadGeneration: true,
      paidGenerationDisabled: true
    }
  };
}

export function visualAssetReferenceForCompletedRequest({
  publicUrl,
  request
}: {
  publicUrl: string | null;
  request: AIVisualAssetRequest;
}): VisualAssetReference {
  return {
    alt: request.entityTitle,
    bucket: request.storage.bucket,
    promptKey: request.prompt.blueprint.id,
    publicUrl,
    r2Key: request.storage.r2KeyPrefix,
    source: publicUrl ? request.storage.resolverSource : "ai-ready",
    url: publicUrl
  };
}

export function planBlueprintAIVisualAssetRequests({
  blueprint,
  brandName,
  requestedByUserId = null,
  storeId,
  templateId
}: {
  blueprint: TemplateBlueprint;
  brandName: string;
  requestedByUserId?: string | null;
  storeId: string;
  templateId: string;
}) {
  return blueprint.visualAssetSlots.map((slot) =>
    createAIVisualAssetRequest({
      entityTitle: brandName,
      kind: requestKindForVisualAssetSlot(slot),
      metadata: {
        blueprintId: blueprint.id,
        industry: blueprint.industry,
        style: blueprint.style
      },
      promptContext: {
        brandName,
        categoryName: brandName,
        collectionName: `${brandName} collection`,
        colorPalette: blueprint.visualProfile.accentColor,
        industry: blueprint.industry,
        marketingTheme: "seasonal campaign",
        productName: `${brandName} product`,
        style: blueprint.style,
        targetAudience: blueprint.recommendedAudience.join(", "),
        visualMood: blueprint.visualProfile.heroMood
      },
      requestedByUserId,
      slot,
      storeId,
      templateId
    })
  );
}

