import { eq } from "drizzle-orm";
import { db, settings } from "@/db";
import { decryptJson, encryptJson } from "./crypto";
import { EMPTY_DEFAULTS, type JournalDefaults } from "@/lib/journal-defaults";
import {
  AI_DEFAULT_MODELS,
  isAiProvider,
  isLocalAiProvider,
  type AiProvider,
  type AiSettingsPayload,
} from "@/lib/ai-settings";

export const getJournalDefaults = (): JournalDefaults => {
  try {
    return { ...EMPTY_DEFAULTS, ...JSON.parse(getSetting("journalDefaults") ?? "{}") };
  } catch {
    return EMPTY_DEFAULTS;
  }
};

export const getSetting = (key: string): string | null =>
  db.select().from(settings).where(eq(settings.key, key)).get()?.value ?? null;

export const setSetting = (key: string, value: string): void => {
  db.insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } })
    .run();
};

export const deleteSetting = (key: string): void => {
  db.delete(settings).where(eq(settings.key, key)).run();
};

export const getTimeZone = (): string => getSetting("timeZone") ?? "UTC";

export const getImportTimeZone = (): string => getSetting("importTimeZone") ?? getTimeZone();

export const getMultipliers = (): Record<string, number> => {
  const raw = getSetting("multipliers");
  if (!raw) return {};

  try {
    return JSON.parse(raw) as Record<string, number>;
  } catch {
    return {};
  }
};

export const aiKeyEnvironment = (provider: AiProvider): string | null => {
  if (provider === "openai") return process.env.OPENAI_API_KEY?.trim() || null;
  if (provider === "anthropic") return process.env.ANTHROPIC_API_KEY?.trim() || null;
  return null;
};

export const getAiKey = (provider: AiProvider): string | null => {
  if (isLocalAiProvider(provider)) return "local";

  const environment = aiKeyEnvironment(provider);
  if (environment) return environment;

  const envelope = getSetting(`${provider}KeyEnc`);
  if (!envelope) return null;

  try {
    const key = decryptJson<unknown>(envelope);
    return typeof key === "string" ? key.trim() || null : null;
  } catch {
    return null;
  }
};

export const setAiKey = (provider: AiProvider, key: string | null): void => {
  if (isLocalAiProvider(provider)) return;

  if (key === null) deleteSetting(`${provider}KeyEnc`);
  else setSetting(`${provider}KeyEnc`, encryptJson(key.trim()));
};

export const getAnthropicKey = (): string | null => getAiKey("anthropic");

export const setAnthropicKey = (key: string | null): void => setAiKey("anthropic", key);

export const getAiProvider = (): AiProvider => {
  const selected = getSetting("aiProvider");
  if (isAiProvider(selected)) return selected;

  return !getAiKey("anthropic") && getAiKey("openai") ? "openai" : "anthropic";
};

export const aiModelSetting = (provider: AiProvider): string => {
  switch (provider) {
    case "anthropic":
      return "aiModel";
    case "openai":
      return "openaiModel";
    case "lmstudio":
      return "lmstudioModel";
    case "ollama":
      return "ollamaModel";
  }
};

export const getAiModel = (provider: AiProvider): string =>
  getSetting(aiModelSetting(provider))?.trim() || AI_DEFAULT_MODELS[provider];

export const getAiSettings = (): AiSettingsPayload => {
  const aiProvider = getAiProvider();

  const connection = (provider: AiProvider) => ({
    configured: Boolean(getAiKey(provider)),
    source: isLocalAiProvider(provider)
      ? ("local" as const)
      : aiKeyEnvironment(provider)
        ? ("environment" as const)
        : getAiKey(provider)
          ? ("saved" as const)
          : null,
    model: getAiModel(provider),
  });

  const aiConnections = {
    anthropic: connection("anthropic"),
    openai: connection("openai"),
    lmstudio: connection("lmstudio"),
    ollama: connection("ollama"),
  };

  return {
    aiProvider,
    aiConfigured: aiConnections[aiProvider].configured,
    aiModel: aiConnections[aiProvider].model,
    aiConnections,
  };
};