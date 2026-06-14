export type AISecretsProviderKey =
  | "deepgram"
  | "elevenlabs"
  | "fal"
  | "gemini"
  | "kling"
  | "openai"
  | "replicate"
  | "runway";

export type AISecretsStatus =
  | "configured"
  | "disabled"
  | "missing_config"
  | "partial_config"
  | "rotation_required"
  | "unknown";

export type AISecretsProviderRecord = {
  configured: boolean;
  last_rotated_at: string | null;
  missing_required_secrets: string[];
  optional_secrets_missing: string[];
  provider: AISecretsProviderKey;
  provider_name: string;
  required_secret_names: string[];
  rotation_required: boolean;
  status: AISecretsStatus;
};

export type AISecretsSnapshot = {
  generated_at: string;
  providers: AISecretsProviderRecord[];
};

export type AISecretRotationInput = {
  provider: AISecretsProviderKey;
};
