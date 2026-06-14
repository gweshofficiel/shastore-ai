export type AIHealthProviderKey =
  | "deepgram"
  | "elevenlabs"
  | "fal"
  | "gemini"
  | "kling"
  | "openai"
  | "replicate"
  | "runway";

export type AIHealthStatus = "degraded" | "healthy" | "offline" | "unknown";

export type AIProviderRuntimeMetadata = {
  configured: boolean;
  enabled: boolean;
  provider: AIHealthProviderKey;
};

export type AIHealthJobSignal = {
  completedAt: string | null;
  createdAt: string | null;
  errorSummary: string | null;
  provider: string;
  status: string;
};

export type AIHealthLogSignal = {
  createdAt: string | null;
  eventStatus: string;
  eventType: string;
  provider: string;
};

export type AIProviderHealth = {
  configured: boolean;
  enabled: boolean;
  health: AIHealthStatus;
  lastActivity: string | null;
  provider: AIHealthProviderKey;
  providerName: string;
  recentFailures: number;
};

export type AIHealthSnapshot = {
  generatedAt: string;
  providers: AIProviderHealth[];
};
