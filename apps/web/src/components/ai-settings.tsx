"use client";

import { useEffect, useState } from "react";
import {
  AI_DEFAULT_MODELS,
  AI_PROVIDER_NAMES,
  AI_PROVIDERS,
  type AiProvider,
  type AiSettingsPayload,
} from "@/lib/ai-settings";
import { postJson, useApi } from "@/lib/use-api";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { OptionSelect } from "./ui/option-select";

export function AiSettings() {
  const { data, error, loading, refresh } = useApi<AiSettingsPayload>("/api/settings");
  const [provider, setProvider] = useState<AiProvider>("anthropic");
  const [model, setModel] = useState(AI_DEFAULT_MODELS.anthropic);
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  const [saved, setSaved] = useState("");

  useEffect(() => {
    if (!data) return;
    setProvider(data.aiProvider);
    setModel(data.aiModel);
  }, [data]);

  const connection = data?.aiConnections[provider];
  const environment = connection?.source === "environment";
  const name = AI_PROVIDER_NAMES[provider];
  const disabled = busy || loading || !data;

  const save = async (remove = false) => {
    setBusy(true);
    setFailure("");
    setSaved("");
    try {
      await postJson(
        "/api/settings",
        remove
          ? {
              [`${provider}Key`]: null,
            }
          : {
              aiProvider: provider,
              aiModel: model.trim(),
              ...(apiKey.trim() ? { [`${provider}Key`]: apiKey.trim() } : {}),
            },
        "PATCH",
      );
      setApiKey("");
      setSaved(remove ? `Ключ ${name} удалён.` : `Настройки ${name} сохранены.`);
      refresh();
    } catch (cause) {
      setFailure(cause instanceof Error ? cause.message : "Не удалось сохранить настройки ИИ.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card id="ai-settings" className="scroll-mt-24">
      <CardHeader>
        <CardTitle>ИИ (используйте свой ключ)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Используйте Anthropic или OpenAI для сводок, критики сделок и «спросите свой журнал».
          Ваш ключ шифруется при хранении. Запросы ИИ идут с вашего сервера напрямую к выбранному
          провайдеру.
        </p>
        {data && (
          <p className="text-xs text-muted-foreground">
            Активный провайдер: {AI_PROVIDER_NAMES[data.aiProvider]} ·{" "}
            {data.aiConfigured ? "Ключ настроен" : "Не настроено"}
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="ai-provider">Провайдер</Label>
            <OptionSelect
              id="ai-provider"
              value={provider}
              disabled={disabled}
              onValueChange={(value) => {
                const next = value as AiProvider;
                setProvider(next);
                setModel(data?.aiConnections[next].model ?? AI_DEFAULT_MODELS[next]);
                setApiKey("");
                setSaved("");
                setFailure("");
              }}
            >
              {AI_PROVIDERS.map((id) => (
                <option key={id} value={id}>
                  {AI_PROVIDER_NAMES[id]}
                </option>
              ))}
            </OptionSelect>
          </div>
          <div className="space-y-1">
            <Label htmlFor="ai-model">ID модели</Label>
            <Input
              id="ai-model"
              value={model}
              disabled={disabled}
              placeholder={AI_DEFAULT_MODELS[provider]}
              onChange={(event) => {
                setModel(event.target.value);
                setSaved("");
              }}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Используйте текстовую модель, доступную в вашем аккаунте провайдера. Каждый провайдер
          хранит свою модель и ключ.
        </p>
        <div className="space-y-1">
          <Label htmlFor="ai-api-key">API-ключ {name}</Label>
          <Input
            id="ai-api-key"
            type="password"
            value={apiKey}
            disabled={disabled || environment}
            onChange={(event) => {
              setApiKey(event.target.value);
              setSaved("");
            }}
            placeholder={
              connection?.configured
                ? "Ключ настроен"
                : provider === "anthropic"
                  ? "sk-ant-…"
                  : "sk-…"
            }
            autoComplete="off"
            spellCheck={false}
          />
          <p className="text-xs text-muted-foreground">
            {environment
              ? `Используется ${provider === "openai" ? "OPENAI_API_KEY" : "ANTHROPIC_API_KEY"} из переменных окружения сервера. Измените или удалите эту переменную на сервере, чтобы обновить ключ.`
              : connection?.configured
                ? "Оставьте пустым, чтобы сохранить текущий ключ, или введите новый."
                : "Добавьте ваш API-ключ, затем сохраните, чтобы использовать этого провайдера."}
          </p>
        </div>
        {(error || failure) && (
          <p role="alert" className="text-xs text-destructive">
            {failure || error}
          </p>
        )}
        {saved && (
          <p role="status" className="text-xs text-profit">
            {saved}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={disabled || !model.trim() || (!apiKey.trim() && !connection?.configured)}
            onClick={() => save()}
          >
            {busy ? "Сохранение…" : "Сохранить настройки ИИ"}
          </Button>
          {connection?.source === "saved" && (
            <Button variant="outline" disabled={disabled} onClick={() => save(true)}>
              Удалить ключ {name}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}