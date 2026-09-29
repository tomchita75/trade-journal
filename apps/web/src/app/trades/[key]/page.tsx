"use client";

import { use, useRef, useState } from "react";
import { Sparkles, Star } from "lucide-react";
import { AiNotice } from "@/components/ai-notice";
import { Attachments } from "@/components/attachments";
import { EquityArea } from "@/components/charts/equity-area";
import { FilterBar } from "@/components/filter-bar";
import { Pnl } from "@/components/pnl";
import { MonetaryField, MonetaryValue } from "@/components/privacy";
import { ReviewExport } from "@/components/review-export";
import { RichEditor, type RichEditorHandle } from "@/components/rich-editor";
import { RuleChecklist } from "@/components/rule-checklist";
import { TradeMarketData } from "@/components/trade-market-data";
import { VoiceNote } from "@/components/voice-note";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatTimestamp } from "@/lib/timezone";
import { tradeKeyFromSegment } from "@/lib/trade-links";
import { postJson, useApi } from "@/lib/use-api";
import { useAutosave } from "@/lib/use-autosave";
import { fmtDuration, fmtMoney, fmtNumber, fmtPercent } from "@/lib/utils";

interface TradeDetail {
  riskAmount: number | null;
  realizedR: number | null;
  plannedR: number | null;
  contractMultiplier: number | null;
  currency: string;
  key: string;
  accountId: string;
  symbol: string;
  assetClass: string | null;
  direction: "long" | "short";
  status: string;
  openedAt: string;
  closedAt: string | null;
  quantity: number;
  avgEntry: number;
  avgExit: number | null;
  grossPnl: number;
  fees: number;
  netPnl: number;
  durationMs: number | null;
  exitsJson: string;
  notes: string | null;
  tagsJson: string | null;
  mistakesJson: string | null;
  playbookId: string | null;
  rating: number | null;
  stopLoss: number | null;
  profitTarget: number | null;
  reviewedAt: string | null;
}

interface ExecutionRow {
  id: string;
  side: "buy" | "sell";
  quantity: number;
  price: number;
  fee: number;
  executedAt: string;
}

const directionLabel = (direction: TradeDetail["direction"]) =>
  direction === "long" ? "ЛОНГ" : "ШОРТ";

const statusLabel = (status: string) => {
  switch (status) {
    case "win":
      return "ПРИБЫЛЬ";
    case "loss":
      return "УБЫТОК";
    case "open":
      return "ОТКРЫТА";
    default:
      return status.toUpperCase();
  }
};

export default function TradePage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = use(params);
  const tradeKey = tradeKeyFromSegment(key);

  return <TradeView key={tradeKey} tradeKey={tradeKey} />;
}

function TradeView({ tradeKey }: { tradeKey: string }) {
  const { data, error, refresh } = useApi<{
    trade: TradeDetail;
    executions: ExecutionRow[];
    timeZone: string;
  }>(`/api/trades/${encodeURIComponent(tradeKey)}`);

  const [aiBusy, setAiBusy] = useState(false);
  const [critique, setCritique] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  if (!data) {
    return (
      <div>
        <FilterBar title="Сделка" />
        <div className="p-4">
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : (
            <Skeleton className="h-96" />
          )}
        </div>
      </div>
    );
  }

  const { trade, executions, timeZone } = data;

  const patch = async (body: Record<string, unknown>) => {
    if (Object.keys(body).length) {
      await postJson(`/api/trades/${encodeURIComponent(tradeKey)}`, body, "PATCH");
    }

    refresh();
  };

  const exits = JSON.parse(trade.exitsJson) as {
  executionId: string;
  grossPnl: number;
  quantity: number;
}[];

const times = new Map(executions.map((execution) => [execution.id, execution.executedAt]));
const totalExitQty = exits.reduce((total, exit) => total + exit.quantity, 0);
let cumulativePnl = 0;

const runningPnl = exits
  .map((exit) => ({
    time: times.get(exit.executionId) ?? trade.openedAt,
    pnl:
      exit.grossPnl -
      (totalExitQty > 0 ? trade.fees * (exit.quantity / totalExitQty) : 0),
  }))
  .sort((a, b) => Date.parse(a.time) - Date.parse(b.time))
  .map((event) => ({
    t: formatTimestamp(event.time, timeZone).slice(11, 16),
    cumNetPnl: (cumulativePnl += event.pnl),
  }));

  const askCritique = async () => {
    setAiBusy(true);
    setAiError(null);

    try {
      const result = await postJson<{ critique: string }>("/api/ai/critique", {
        key: tradeKey,
      });
      setCritique(result.critique);
    } catch (cause) {
      setAiError(cause instanceof Error ? cause.message : "Не удалось получить ИИ-разбор.");
    } finally {
      setAiBusy(false);
    }
  };

  return (
    <div>
      <FilterBar title={`${trade.symbol} · ${directionLabel(trade.direction)}`} />

      <div className="grid gap-3 p-4 xl:grid-cols-3">
        <div className="min-w-0 space-y-3 xl:col-span-2">
          <Card>
            <CardContent className="flex flex-wrap items-center gap-x-8 gap-y-3 py-4">
              <div>
                <div className="text-xs text-muted-foreground">Чистый P&L</div>
                <Pnl value={trade.netPnl} className="text-2xl font-semibold" />
              </div>

              <Badge
                variant={
                  trade.status === "win"
                    ? "profit"
                    : trade.status === "loss"
                      ? "loss"
                      : "secondary"
                }
                className="text-sm"
              >
                {statusLabel(trade.status)}
              </Badge>

              <Meta label="Валовый P&L" value={fmtMoney(trade.grossPnl)} monetary />
              <Meta label="Комиссии" value={fmtMoney(trade.fees)} monetary />
              <Meta label="Объём" value={fmtNumber(trade.quantity, 4)} />
              <Meta label="Средняя цена входа" value={fmtNumber(trade.avgEntry)} monetary />
              <Meta
                label="Средняя цена выхода"
                monetary
                value={trade.avgExit === null ? "Открыта" : fmtNumber(trade.avgExit)}
              />
              <Meta label="Длительность" value={fmtDuration(trade.durationMs)} />
              <Meta
                label="Чистый P&L / объём входа"
                value={fmtPercent(
                  trade.avgEntry * trade.quantity > 0 &&
                    (trade.contractMultiplier !== null ||
                      !["futures", "option", "forex", "cfd"].includes(
                        trade.assetClass ?? "",
                      ))
                    ? trade.netPnl /
                        (Math.abs(trade.avgEntry) *
                          trade.quantity *
                          (trade.contractMultiplier ?? 1))
                    : null,
                  2,
                )}
              />
              <Meta
                label="Плановый R"
                value={trade.plannedR === null ? "—" : `${fmtNumber(trade.plannedR)}R`}
              />
              <Meta
                label="Фактический R"
                value={trade.realizedR === null ? "—" : `${fmtNumber(trade.realizedR)}R`}
              />
            </CardContent>
          </Card>

          <TradeMarketData trade={trade} executions={executions} />

          {runningPnl.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle>Накопительный P&L</CardTitle>
                <p className="text-xs text-muted-foreground">Время: {timeZone}</p>
              </CardHeader>

              <CardContent>
                <EquityArea data={runningPnl} height={180} />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Исполнения</CardTitle>
              <p className="text-xs text-muted-foreground">Время: {timeZone}</p>
            </CardHeader>

            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Время</TableHead>
                    <TableHead>Сторона</TableHead>
                    <TableHead>Количество</TableHead>
                    <TableHead>Цена</TableHead>
                    <TableHead>Комиссия</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {executions
                    .sort((a, b) => a.executedAt.localeCompare(b.executedAt))
                    .map((execution) => (
                      <TableRow key={execution.id}>
                        <TableCell className="text-muted-foreground">
                          {formatTimestamp(execution.executedAt, timeZone)}
                        </TableCell>

                        <TableCell>
                          <span
                            className={
                              execution.side === "buy" ? "text-profit" : "text-loss"
                            }
                          >
                            {execution.side === "buy" ? "▲ ПОКУПКА" : "▼ ПРОДАЖА"}
                          </span>
                        </TableCell>

                        <TableCell className="tnum">
                          {fmtNumber(execution.quantity, 4)}
                        </TableCell>

                        <TableCell className="tnum">
                          <MonetaryValue>{fmtNumber(execution.price)}</MonetaryValue>
                        </TableCell>

                        <TableCell className="tnum text-muted-foreground">
                          <MonetaryValue>{fmtMoney(execution.fee)}</MonetaryValue>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <div className="min-w-0 space-y-3">
          <AnnotationsCard key={trade.key} trade={trade} onPatch={patch} />

          <RuleChecklist tradeKey={trade.key} playbookId={trade.playbookId} />

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>ИИ-разбор</CardTitle>

              <Button variant="outline" size="sm" onClick={askCritique} disabled={aiBusy}>
                <Sparkles />
                {aiBusy ? "Разбор…" : "Разобрать сделку"}
              </Button>
            </CardHeader>

            {aiError && (
              <CardContent>
                <AiNotice
                  error={aiError}
                  onRetry={() => void askCritique()}
                  onDismiss={() => setAiError(null)}
                />
              </CardContent>
            )}

            {critique && (
              <CardContent>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{critique}</p>
              </CardContent>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Meta({
  label,
  value,
  monetary = false,
}: {
  label: string;
  value: string;
  monetary?: boolean;
}) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="tnum text-sm font-medium">
        {monetary ? <MonetaryValue>{value}</MonetaryValue> : value}
      </div>
    </div>
  );
}

function AnnotationsCard({
  trade,
  onPatch,
}: {
  trade: TradeDetail;
  onPatch: (body: Record<string, unknown>) => Promise<void>;
}) {
  const [notes, setNotes] = useState(trade.notes ?? "");
  const noteEditor = useRef<RichEditorHandle>(null);
  const [tags, setTags] = useState(
    (JSON.parse(trade.tagsJson ?? "[]") as string[]).join(", "),
  );
  const [mistakes, setMistakes] = useState(
    (JSON.parse(trade.mistakesJson ?? "[]") as string[]).join(", "),
  );
  const [stopLoss, setStopLoss] = useState(trade.stopLoss?.toString() ?? "");
  const [profitTarget, setProfitTarget] = useState(trade.profitTarget?.toString() ?? "");

  const { data: playbookData } = useApi<{
    playbooks: { id: string; name: string }[];
  }>("/api/playbooks");

  const {
    save: debounced,
    status: saveStatus,
    flush,
  } = useAutosave(`/api/trades/${encodeURIComponent(trade.key)}`, "PATCH", () =>
    void onPatch({}),
  );

  const parseList = (value: string) =>
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Журнал сделки</CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => void onPatch({ rating: trade.rating === star ? null : star })}
                aria-label={`Оценить сделку: ${star} из 5`}
              >
                <Star
                  className={`h-4 w-4 ${
                    trade.rating !== null && star <= trade.rating
                      ? "fill-current text-series-4 text-yellow-600"
                      : "text-muted-foreground"
                  }`}
                />
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={trade.reviewedAt !== null}
              onCheckedChange={(checked) => void onPatch({ reviewed: checked === true })}
            />
            Сделка разобрана
          </label>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground">Стоп-лосс</label>
            <MonetaryField>
              <Input
                value={stopLoss}
                onChange={(event) => {
                  setStopLoss(event.target.value);
                  debounced({
                    stopLoss: event.target.value === "" ? null : Number(event.target.value),
                  });
                }}
                placeholder="Плановый стоп"
                inputMode="decimal"
              />
            </MonetaryField>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Цель прибыли</label>
            <MonetaryField>
              <Input
                value={profitTarget}
                onChange={(event) => {
                  setProfitTarget(event.target.value);
                  debounced({
                    profitTarget: event.target.value === "" ? null : Number(event.target.value),
                  });
                }}
                placeholder="Плановая цель"
                inputMode="decimal"
              />
            </MonetaryField>
          </div>
        </div>

        <div>
          <label className="text-xs text-muted-foreground">Плейбук</label>

          <Select
            value={trade.playbookId ?? "none"}
            onValueChange={(value) =>
              void onPatch({ playbookId: value === "none" ? null : value })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Без плейбука" />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value="none">Без плейбука</SelectItem>

              {playbookData?.playbooks.map((playbook) => (
                <SelectItem key={playbook.id} value={playbook.id}>
                  {playbook.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-xs text-muted-foreground">Теги (через запятую)</label>
          <Input
            value={tags}
            onChange={(event) => {
              setTags(event.target.value);
              debounced({ tags: parseList(event.target.value) });
            }}
            placeholder="пробой, сетап A+"
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground">Ошибки</label>
          <Input
            value={mistakes}
            onChange={(event) => {
              setMistakes(event.target.value);
              debounced({ mistakes: parseList(event.target.value) });
            }}
            placeholder="поздний вход, передвинул стоп"
          />
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-xs text-muted-foreground">Заметки</label>

            <VoiceNote
              onPrepare={() => noteEditor.current?.focus()}
              onText={(text) => {
                const next = notes ? `${notes} ${text}` : text;
                setNotes(next);
                debounced({ notes: next });
              }}
            />
          </div>

          <RichEditor
            editorRef={noteEditor}
            value={notes}
            onChange={(value) => {
              setNotes(value);
              debounced({ notes: value });
            }}
          />

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span role="status">{saveStatus}</span>

            <Button variant="ghost" size="sm" onClick={() => void flush()}>
              Сохранить сейчас
            </Button>
          </div>

          <ReviewExport
            containsFinancialData
            document={{
              title: `${trade.symbol} · ${directionLabel(trade.direction)} — разбор`,
              subtitle: `${trade.openedAt} · ${trade.currency}`,
              lines: [
                `Статус: ${statusLabel(trade.status)} | Количество: ${trade.quantity}`,
                `Вход: ${trade.avgEntry} | Выход: ${trade.avgExit ?? "Открыта"}`,
                `Чистый P&L: ${trade.netPnl.toFixed(2)} | Комиссии: ${trade.fees.toFixed(2)}`,
                `Стоп: ${stopLoss || "Не указан"} | Цель: ${profitTarget || "Не указана"}`,
                `Теги: ${tags || "Нет"} | Ошибки: ${mistakes || "Нет"}`,
                "",
                notes,
              ],
            }}
          />

          <Attachments type="trade" id={trade.key} />
        </div>
      </CardContent>
    </Card>
  );
}