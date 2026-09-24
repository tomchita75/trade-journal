"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Vela } from "@luxalgo/vela";
import {
  RESOLUTIONS,
  type MarketConnection,
  type ExcursionEstimate,
  type Resolution,
  type TradeMarketResult,
} from "@/lib/market-data";
import { providerInfo } from "@/lib/market-providers";
import type { MarketCsvDataset } from "@/lib/market-csv";
import { replayFrame } from "@/lib/trade-replay";
import { useApi } from "@/lib/use-api";
import { fmtMoney } from "@/lib/utils";
import { TradeChart, type ChartExecution, type ChartTrade } from "./trade-chart";
import { usePrivacy } from "./privacy";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { OptionSelect } from "./ui/option-select";
import { HistoricalReplay } from "./historical-replay";

export function TradeMarketData({
  trade,
  executions,
}: {
  trade: ChartTrade & { currency: string };
  executions: ChartExecution[];
}) {
  const privacy = usePrivacy();
  const { data: saved, refresh: refreshSaved } = useApi<{
    saved: { estimate: ExcursionEstimate } | null;
  }>(`/api/trades/${encodeURIComponent(trade.key)}/market-data`);
  const { data: connections, error: connectionError } = useApi<{ connections: MarketConnection[] }>(
    "/api/market-data/connections",
  );
  const available = connections?.connections.filter((connection) => connection.configured) ?? [];
  const [provider, setProvider] = useState("");
  const [symbol, setSymbol] = useState(trade.symbol);
  const [dataset, setDataset] = useState("");
  const [resolution, setResolution] = useState<Resolution>("1m");
  const info = providerInfo(provider);
  const { data: csv } = useApi<{ datasets: MarketCsvDataset[] }>(
    info?.mode === "csv" ? "/api/market-data/csv" : null,
  );
  const [confirmed, setConfirmed] = useState(false);
  const [result, setResult] = useState<TradeMarketResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const invalidate = () => {
    controller.current?.abort();
    setBusy(false);
    setResult(null);
    setError("");
  };
  const load = async () => {
    if (!available.some((item) => item.id === provider) || (info?.datasets && !dataset)) return;
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch(`/api/trades/${encodeURIComponent(trade.key)}/market-data`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          symbol,
          dataset,
          resolution,
          basisConfirmed: confirmed,
        }),
        signal: request.signal,
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "History request failed.");
      if (!request.signal.aborted) {
        setResult(body);
        refreshSaved();
      }
    } catch (cause) {
      if (!request.signal.aborted)
        setError(cause instanceof Error ? cause.message : "History request failed.");
    } finally {
      if (!request.signal.aborted) setBusy(false);
    }
  };
  return (
    <div className="space-y-3">
      <Card>
        <CardHeader>
          <CardTitle>Рыночные данные и воспроизведение</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Загрузите свечи для этой сделки, чтобы использовать воспроизведение. Включите флажок для расчёта и сохранения денежных оценок MAE/MFE для отчётов.
          </p>
          {connectionError && (
            <p role="alert" className="text-sm text-destructive">
              {connectionError}
            </p>
          )}
          {!available.length && (
            <p className="text-sm text-muted-foreground">
              <a className="underline" href="/settings#market-data">
                Подключите провайдера рыночных данных в настройках
              </a>{" "}
              для использования исторического воспроизведения и оценок.
            </p>
          )}
          {!trade.closedAt ? (
            <p className="text-sm text-muted-foreground">Доступно после закрытия этой сделки.</p>
          ) : (
            available.length > 0 && (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="market-provider">Провайдер данных</Label>
                    <OptionSelect
                      id="market-provider"
                      value={provider}
                      onValueChange={(value) => {
                        invalidate();
                        setProvider(value);
                        setDataset("");
                        setConfirmed(false);
                      }}
                    >
                      <option value="" disabled>
                        Выберите источник данных
                      </option>
                      {available.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </OptionSelect>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="market-symbol">Символ провайдера</Label>
                    <Input
                      id="market-symbol"
                      value={symbol}
                      onChange={(event) => {
                        invalidate();
                        setSymbol(event.target.value);
                        setConfirmed(false);
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="market-resolution">Разрешение свечей</Label>
                    <OptionSelect
                      id="market-resolution"
                      value={resolution}
                      onValueChange={(value) => {
                        invalidate();
                        setResolution(value as Resolution);
                      }}
                    >
                      {Object.keys(RESOLUTIONS).map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </OptionSelect>
                  </div>
                  {(info?.datasets ||
                    info?.mode === "csv" ||
                    info?.id === "london-strategic-edge") && (
                    <div className="space-y-1">
                      <Label htmlFor="market-dataset">Канал данных / набор данных</Label>
                      {info?.datasets || info?.mode === "csv" ? (
                        <OptionSelect
                          id="market-dataset"
                          value={dataset}
                          onValueChange={(value) => {
                            invalidate();
                            setDataset(value);
                            setConfirmed(false);
                          }}
                        >
                          {(
                            info.datasets ?? [
                              { value: "", label: "Автоматический подбор файла" },
                              ...(csv?.datasets ?? []).map((item) => ({
                                value: item.id,
                                label: `${item.name} · ${item.symbol} · ${item.resolution}`,
                              })),
                            ]
                          ).map((item) => (
                            <option key={item.value} value={item.value}>
                              {item.label}
                            </option>
                          ))}
                        </OptionSelect>
                      ) : (
                        <Input
                          id="market-dataset"
                          value={dataset}
                          placeholder="Оставьте пустым для автоматического выбора"
                          onChange={(event) => {
                            invalidate();
                            setDataset(event.target.value);
                            setConfirmed(false);
                          }}
                        />
                      )}
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {info?.description} {info?.symbolHint} История опционных контрактов пока не поддерживается.
                </p>
                <label className="flex items-start gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    className="mt-0.5"
                    onChange={(event) => {
                      invalidate();
                      setConfirmed(event.target.checked);
                    }}
                  />
                  <span>
                    Рассчитать и сохранить оценки MAE/MFE для отчётов. Я подтверждаю, что этот инструмент, корректировки цен и валюта котировок соответствуют моим исполнениям и счёту ({trade.currency}).
                  </span>
                </label>
                <p className="text-xs text-muted-foreground">
                  Не отмечено: загрузить свечи и воспроизведение. Отмечено: также рассчитать денежные оценки и сохранить валидные результаты в отчёты. Отсутствующие или несоответствующие данные остаются недоступными.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={
                      busy ||
                      !symbol.trim() ||
                      !available.some((item) => item.id === provider) ||
                      Boolean(info?.datasets && !dataset)
                    }
                    onClick={() => void load()}
                  >
                    {busy
                      ? "Загрузка истории…"
                      : confirmed
                        ? "Загрузить данные и сохранить оценки"
                        : "Загрузить свечи и воспроизведение"}
                  </Button>
                  {busy && (
                    <Button variant="outline" onClick={invalidate}>
                      Отмена
                    </Button>
                  )}
                  {result && (
                    <Button variant="outline" onClick={invalidate}>
                      Показать оригинальный график
                    </Button>
                  )}
                </div>
              </>
            )
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </CardContent>
      </Card>
      {!result && saved?.saved && (
        <p className="text-xs text-muted-foreground">
          Ранее сохранённые оценки MAE/MFE показаны ниже. Загрузка свечей без флажка сохраняет эти оценки; новые не рассчитываются.
        </p>
      )}
      {result && result.bars.length > 0 ? (
        <HistoricalReplay
          history={result}
          trade={trade}
          executions={executions}
          privacy={privacy}
        />
      ) : (
        <>
          <div
            className="grid gap-3 rounded-lg border bg-card p-3 sm:grid-cols-3"
            aria-label="Market data feature status"
          >
            <div>
              <p className="text-xs text-muted-foreground">Оценочный MAE</p>
              <p className="text-sm">
                {busy
                  ? "Загрузка свечей…"
                  : error
                    ? "Запрос данных не удался"
                    : saved?.saved
                      ? privacy
                        ? "••••"
                        : fmtMoney(saved.saved.estimate.mae!, trade.currency)
                      : "Загрузите рыночные данные для расчёта"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Оценочный MFE</p>
              <p className="text-sm">
                {busy
                  ? "Загрузка свечей…"
                  : error
                    ? "Запрос данных не удался"
                    : saved?.saved
                      ? privacy
                        ? "••••"
                        : fmtMoney(saved.saved.estimate.mfe!, trade.currency)
                      : "Загрузите рыночные данные для расчёта"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Воспроизведение сделки</p>
              <p className="text-sm">
                {busy ? "Загрузка свечей…" : "Доступно после загрузки свечей"}
              </p>
            </div>
          </div>
          {result && (
            <p role="status" className="text-sm text-muted-foreground">
              Свечи не возвращены для этого инструмента и периода сделки. Проверьте символ, набор данных и покрытие плана.
            </p>
          )}
          <TradeChart trade={trade} executions={executions} />
        </>
      )}
    </div>
  );
}

// ... остальная часть компонента HistoricalReplay и ReplayChart с переводами