import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { APICallError, RetryError, generateText } from "ai";
import { AI_PROVIDER_NAMES, isLocalAiProvider } from "@/lib/ai-settings";
import { getAiKey, getAiModel, getAiProvider } from "./settings";

const LOCAL_AI_BASE_URL = {
  lmstudio: "http://127.0.0.1:1234/v1",
  ollama: "http://127.0.0.1:11434/v1",
} as const;

type LocalAiProvider = keyof typeof LOCAL_AI_BASE_URL;

const isConfiguredLocalProvider = (provider: string): provider is LocalAiProvider =>
  provider === "lmstudio" || provider === "ollama";

export const aiConfigured = (): boolean => getAiKey(getAiProvider()) !== null;

const SYSTEM = `You are the reflection layer of a trader's journal.
You see only the trader's own recorded data — trades, stats, and notes. Ground every
statement in those numbers; never invent trades, prices, or market context you weren't given.
Be direct and specific like a good trading coach: name the behavior, cite the numbers,
say what to keep and what to fix. No platitudes, no disclaimers about trading being risky —
the trader knows. Keep it tight.
Always answer in Russian. Keep standard trading terms such as P&L, R, MAE, MFE, USDT and ticker symbols unchanged.`;

export const runAi = async (prompt: string, maxOutputTokens = 1200): Promise<string> => {
  const provider = getAiProvider();
  const apiKey = getAiKey(provider);

  if (!apiKey) {
    throw new Error(
      `AI is not configured — add your ${AI_PROVIDER_NAMES[provider]} API key in Settings.`,
    );
  }

  const model = getAiModel(provider);
  const localProvider = isConfiguredLocalProvider(provider);
  const openAiCompatible = provider === "openai" || localProvider;

  try {
    const result = await generateText({
      model: openAiCompatible
        ? provider === "openai"
          ? createOpenAI({ apiKey }).responses(model)
          : createOpenAI({
              apiKey,
              baseURL: LOCAL_AI_BASE_URL[provider as LocalAiProvider],
            }).chat(model)
        : createAnthropic({ apiKey })(model),

      ...(provider === "openai"
        ? {
            providerOptions: {
              openai: {
                store: false,
              },
            },
          }
        : {}),

      ...(provider === "lmstudio"
        ? {
            providerOptions: {
              openai: {
                chatTemplateKwargs: {
                  enable_thinking: false,
                },
              },
            },
          }
        : {}),

      system: SYSTEM,
      prompt,
      maxOutputTokens,
    });

    if (!result.text.trim()) {
      if (provider === "lmstudio") {
        throw new Error(
          "LM Studio вернул рассуждение без итогового текста. Проверьте режим thinking модели.",
        );
      }

      throw new Error("ИИ не вернул текст. Проверьте выбранную модель и повторите попытку.");
    }

    return result.text;
  } catch (error) {
    if (RetryError.isInstance(error)) error = error.lastError;

    if (APICallError.isInstance(error)) {
      if (isLocalAiProvider(provider)) {
        if (error.statusCode === 404) {
          throw new Error(
            `Локальная модель недоступна. Запустите ${AI_PROVIDER_NAMES[provider]} и проверьте ID модели в настройках.`,
          );
        }

        throw new Error(
          `${AI_PROVIDER_NAMES[provider]} недоступен. Запустите локальный сервер и проверьте его адрес.`,
        );
      }

      if (error.statusCode === 401 || error.statusCode === 403) {
        throw new Error("Ошибка авторизации ИИ: проверьте API-ключ и права доступа.");
      }

      if (/credit balance|billing|insufficient_quota|exceeded your current quota/i.test(error.message)) {
        throw new Error("Недостаточно средств или квоты API у выбранного ИИ-провайдера.");
      }

      if (error.statusCode === 429 || error.statusCode === 529) {
        throw new Error("Лимит запросов ИИ. Повторите попытку немного позже.");
      }

      if (
        error.statusCode === 404 ||
        /model.*(?:not found|does not exist|access)/i.test(error.message)
      ) {
        throw new Error("Модель ИИ недоступна: проверьте ID модели в настройках.");
      }
    }

    throw new Error("Запрос к ИИ не выполнен. Проверьте настройки и повторите попытку.");
  }
};