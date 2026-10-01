export const AI_PROVIDERS = [
  "anthropic",
  "openai",
  "openrouter",
  "lmstudio",
  "ollama",
] as const;

export type AiProvider = (typeof AI_PROVIDERS)[number];

export const AI_DEFAULT_MODELS: Record<AiProvider, string> = {
  anthropic: "claude-opus-5",
  openai: "gpt-4.1-mini",
  openrouter: "google/gemini-2.5-flash",
  lmstudio: "google/gemma-4-12b-qat",
  ollama: "qwen3:8b",
};

export const AI_PROVIDER_NAMES: Record<AiProvider, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  openrouter: "OpenRouter",
  lmstudio: "LM Studio (локально)",
  ollama: "Ollama (локально)",
};

export interface AiConnection {
  configured: boolean;
  source: "environment" | "saved" | "local" | null;
  model: string;
}

export interface AiSettingsPayload {
  aiProvider: AiProvider;
  aiConfigured: boolean;
  aiModel: string;
  aiConnections: Record<AiProvider, AiConnection>;
}

export const isAiProvider = (value: unknown): value is AiProvider =>
  AI_PROVIDERS.includes(value as AiProvider);

export const isLocalAiProvider = (provider: AiProvider): boolean =>
  provider === "lmstudio" || provider === "ollama";