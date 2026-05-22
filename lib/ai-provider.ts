import { normalizeBuilderPageSchema, type BuilderPageSchema } from "@/lib/storefront/builder";
import {
  mapAISchemaToBuilderDraft,
  normalizeGeneratedStoreSchema,
  prepareStoreGenerationPrompt,
  type AIStoreGenerationRequest,
  type GeneratedStoreSchema
} from "@/lib/storefront/ai-generation";
import { createClient } from "@/lib/supabase/server";

export type AIProviderRecord = {
  id: string | null;
  modelKey: string;
  providerKey: string;
  providerName: string;
  status: "disabled" | "configured" | "testing" | "active" | "failed";
};

export type AIProviderRequest = {
  prompt: string;
  requestPayload: Record<string, unknown>;
  responseFormat: "json" | "json_schema" | "text";
  storeInstanceId: string;
};

export type AIProviderResponse = {
  metadata: Record<string, unknown>;
  raw: Record<string, unknown>;
  status: "prepared" | "succeeded" | "failed";
  tokenUsage: {
    input: number;
    output: number;
    total: number;
  };
};

const fallbackProvider: AIProviderRecord = {
  id: null,
  modelKey: "gpt-4o-mini",
  providerKey: "openai",
  providerName: "OpenAI",
  status: "disabled"
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function textValue(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export async function getAIProvider(storeInstanceId?: string, providerKey = "openai"): Promise<AIProviderRecord> {
  const supabase = await createClient();

  if (!storeInstanceId) {
    return fallbackProvider;
  }

  const { data } = await supabase
    .from("ai_providers" as never)
    .select("id, provider_key, provider_name, provider_status")
    .eq("store_instance_id", storeInstanceId)
    .eq("provider_key", providerKey)
    .maybeSingle();
  const provider = data as {
    id?: string;
    provider_key?: string;
    provider_name?: string;
    provider_status?: AIProviderRecord["status"];
  } | null;
  const { data: configData } = provider?.id
    ? await supabase
        .from("ai_provider_configs" as never)
        .select("model_key")
        .eq("provider_id", provider.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };
  const config = configData as { model_key?: string } | null;

  return {
    id: provider?.id ?? null,
    modelKey: textValue(config?.model_key, fallbackProvider.modelKey),
    providerKey: textValue(provider?.provider_key, fallbackProvider.providerKey),
    providerName: textValue(provider?.provider_name, fallbackProvider.providerName),
    status: provider?.provider_status ?? "disabled"
  };
}

export async function resolvePromptTemplate({
  promptType = "store_generation",
  request,
  storeInstanceId
}: {
  promptType?: string;
  request: AIStoreGenerationRequest;
  storeInstanceId?: string;
}) {
  const supabase = await createClient();
  const { data } = storeInstanceId
    ? await supabase
        .from("ai_prompt_templates" as never)
        .select("id, template_body, output_schema, variables")
        .eq("store_instance_id", storeInstanceId)
        .eq("prompt_type", promptType)
        .eq("status", "active")
        .order("version_number", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };
  const template = data as {
    id?: string;
    output_schema?: unknown;
    template_body?: string;
    variables?: unknown;
  } | null;

  return {
    body: textValue(template?.template_body, prepareStoreGenerationPrompt(request)),
    id: template?.id ?? null,
    outputSchema: isRecord(template?.output_schema) ? template?.output_schema : {},
    variables: Array.isArray(template?.variables) ? template?.variables : []
  };
}

export async function executeAIProviderRequest(
  provider: AIProviderRecord,
  request: AIProviderRequest
): Promise<AIProviderResponse> {
  return {
    metadata: {
      modelKey: provider.modelKey,
      networkCall: false,
      providerKey: provider.providerKey,
      reason: "Provider execution is prepared but disabled until API keys are configured."
    },
    raw: {
      branding: {
        accentColor: "#f59e0b",
        logoPrompt: "Provider placeholder logo prompt",
        primaryColor: "#0f172a",
        secondaryColor: "#2563eb",
        tone: "modern"
      },
      sections: [
        {
          id: "provider-hero-placeholder",
          order: 10,
          props: {
            eyebrow: "Provider foundation",
            heading: "AI provider output preview",
            subheading: "Structured JSON output will map into builder drafts when real provider calls are enabled."
          },
          type: "hero"
        }
      ],
      store: {
        description: "No-network provider response placeholder.",
        language: "en",
        niche: textValue(request.requestPayload.niche, "AI provider storefront"),
        title: "AI Provider Preview",
        type: "general"
      }
    },
    status: provider.status === "active" ? "prepared" : "prepared",
    tokenUsage: {
      input: 0,
      output: 0,
      total: 0
    }
  };
}

export function normalizeAIProviderResponse(response: AIProviderResponse): GeneratedStoreSchema {
  return normalizeGeneratedStoreSchema(response.raw);
}

export function validateAIProviderOutput(value: unknown) {
  const schema = normalizeGeneratedStoreSchema(value);

  return {
    errors: schema.sections.length ? [] : ["Provider output must contain at least one valid section."],
    schema
  };
}

export function mapAIResponseToBuilderSchema(value: unknown): BuilderPageSchema {
  const validation = validateAIProviderOutput(value);

  if (validation.errors.length) {
    return normalizeBuilderPageSchema(null);
  }

  return mapAISchemaToBuilderDraft(validation.schema);
}
