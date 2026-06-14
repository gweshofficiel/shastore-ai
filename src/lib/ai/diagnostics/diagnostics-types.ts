export type AIDiagnosticsProviderKey =
  | "deepgram"
  | "elevenlabs"
  | "fal"
  | "gemini"
  | "kling"
  | "openai"
  | "replicate"
  | "runway";

export type AIDiagnosticStatus =
  | "connected"
  | "disabled"
  | "failed"
  | "missing_config"
  | "placeholder"
  | "skipped";

export type AIDiagnosticResult = {
  configured: boolean;
  enabled: boolean;
  error_code: string | null;
  error_message: string | null;
  last_checked_at: string;
  provider: AIDiagnosticsProviderKey;
  provider_name: string;
  response_time_ms: number;
  safe_message: string;
  status: AIDiagnosticStatus;
};

export type AIDiagnosticsSnapshot = {
  generated_at: string;
  providers: AIDiagnosticResult[];
};
