"use client";

import { Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Landmark, PencilLine } from "lucide-react";
import { AccountPicker } from "@/components/account-picker";
import { ManualTradeEntry } from "@/components/manual-trade-entry";
import { FilterBar } from "@/components/filter-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { postJson, useApi } from "@/lib/use-api";
import { decodeImportFile } from "@/lib/decode-import";
import { formatTimestamp, isTimeZone } from "@/lib/timezone";
import { dayKeyOf } from "@luxalgo/journal-core";
import { ImportReconciliation } from "@/components/import-reconciliation";
import type { ImportReview, ImportReviewOptions } from "@/lib/import-review";
import { TimeZonePicker } from "@/components/timezone-picker";

interface BrokerInfo {
  id: string;
  displayName: string;
  credentials: { key: string; label: string; secret?: boolean }[];
  readOnlySetup: string;
}

interface PreviewTotals {
  executions: number;
  symbols: number;
  skippedRows: number;
  from: string | null;
  to: string | null;
}

interface PreviewResponse {
  reconciliation?: ImportReview;
  detected: string | null;
  timeZone: string;
  needsMapping?: boolean;
  headers?: string[];
  totals?: PreviewTotals;
  warnings?: string[];
  errors?: string[];
  needsSymbol?: boolean;
  executions?: {
    symbol: string;
    side: string;
    quantity: number;
    price: number;
    executedAt: string;
  }[];
}

export default function ImportPage() {
  return (
    <Suspense>
      <ImportView />
    </Suspense>
  );
}

function ImportView() {
  const router = useRouter();
  return (
    <div>
      <FilterBar title="Импорт сделок" />
      <div className="mx-auto max-w-3xl p-4">
        <Tabs defaultValue="file">
          <TabsList>
            <TabsTrigger value="file" className="max-sm:px-2 max-sm:text-xs">
              <FileUp className="mr-1.5 hidden h-4 w-4 min-[420px]:block" />
              Загрузка файла
            </TabsTrigger>
            <TabsTrigger value="sync" className="max-sm:px-2 max-sm:text-xs">
              <Landmark className="mr-1.5 hidden h-4 w-4 min-[420px]:block" />
              Синхронизация с брокером
            </TabsTrigger>
            <TabsTrigger value="manual" className="max-sm:px-2 max-sm:text-xs">
              <PencilLine className="mr-1.5 hidden h-4 w-4 min-[420px]:block" />
              Вручную
            </TabsTrigger>
          </TabsList>
          <TabsContent value="file">
            <FileImport />
          </TabsContent>
          <TabsContent value="sync">
            <BrokerConnect />
          </TabsContent>
          <TabsContent value="manual">
            <Card>
              <CardHeader>
                <CardTitle>Добавить исполнения вручную</CardTitle>
              </CardHeader>
              <CardContent>
                <ManualTradeEntry onSaved={() => router.push("/trades")} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function FileImport() {
  const router = useRouter();
  const [accountId, setAccountId] = useState("");
  const [reviewOptions, setReviewOptions] = useState<ImportReviewOptions>({});
  const changeReview = (options: ImportReviewOptions) => {
    setReviewOptions(options);
    setPreview((current) =>
      current
        ? {
            ...current,
            reconciliation: current.reconciliation
              ? { ...current.reconciliation, token: null }
              : undefined,
          }
        : null,
    );
  };
  const [content, setContent] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [mappingApplied, setMappingApplied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const { data: formatData } = useApi<{ formats: { id: string; label: string }[] }>("/api/import");
  const { data: settingsData, error: settingsError } = useApi<{
    timeZone: string;
    importTimeZone: string;
  }>("/api/settings");
  const [statementTimeZone, setStatementTimeZone] = useState<string | null>(null);
  const timeZone = statementTimeZone ?? settingsData?.importTimeZone ?? "";
  const validTimeZone = isTimeZone(timeZone);
  const displayTimeZone = settingsData?.timeZone ?? "UTC";

  const onFile = async (file: File) => {
    if (!validTimeZone) return;
    setStatementTimeZone(timeZone);
    setPreview(null);
    setContent(null);
    setFileName(file.name);
    setReviewOptions({});
    setSymbol("");
    setMapping({});
    setMappingApplied(false);
    setError(null);
    setBusy(true);
    try {
      const text = decodeImportFile(await file.arrayBuffer());
      setContent(text);
      setPreview(
        await postJson<PreviewResponse>("/api/import", {
          mode: "preview",
          content: text,
          accountId: accountId || undefined,
          review: {},
          fileName: file.name,
          timeZone,
        }),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ошибка предпросмотра импорта");
    } finally {
      setBusy(false);
    }
  };

  const previewFile = async () => {
    if (!content || !validTimeZone) return;
    setBusy(true);
    setError(null);
    try {
      setPreview(
        await postJson<PreviewResponse>("/api/import", {
          mode: "preview",
          content,
          accountId: accountId || undefined,
          review: reviewOptions,
          fileName,
          symbol,
          timeZone,
        }),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ошибка предпросмотра импорта");
    } finally {
      setBusy(false);
    }
  };

  const previewWithMapping = async () => {
    if (!content || !validTimeZone) return;
    setBusy(true);
    setError(null);
    try {
      setPreview(
        await postJson<PreviewResponse>("/api/import", {
          mode: "preview",
          content,
          mapping,
          timeZone,
        }),
      );
      setMappingApplied(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ошибка предпросмотра импорта");
    } finally {
      setBusy(false);
    }
  };

  const commit = async () => {
    if (!content || !accountId || !preview) return;
    setBusy(true);
    try {
      const result = await postJson<{
        inserted: number;
        duplicates: number;
        corrected?: number;
        skipped?: number;
        warnings?: string[];
      }>("/api/import", {
        mode: "commit",
        review: { ...reviewOptions, previewToken: preview.reconciliation?.token ?? undefined },
        content,
        accountId,
        mapping: mappingApplied ? mapping : undefined,
        fileName,
        symbol,
        timeZone: preview.timeZone,
      });
      const skippedNote =
        result.skipped && result.skipped > 0
          ? ` ${result.skipped} неверных строк пропущено: ${(result.warnings ?? []).at(-1) ?? ""}`
          : "";
      alert(
        `Импортировано ${result.inserted} исполнений (${result.duplicates} дубликатов пропущено, ${result.corrected ?? 0} исправлений комиссий).${skippedNote}`,
      );
      router.push(`/?accounts=${encodeURIComponent(accountId)}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ошибка импорта");
    } finally {
      setBusy(false);
    }
  };

  const mappingFields = ["symbol", "side", "quantity", "price", "fee", "timestamp"] as const;

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader>
          <CardTitle>Загрузить отчёт или экспорт</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label
              htmlFor="statement-timezone"
              className="mb-1 block text-xs text-muted-foreground"
            >
              Часовой пояс отчёта (IANA)
            </Label>
            <TimeZonePicker
              id="statement-timezone"
              label="Часовой пояс отчёта"
              value={timeZone}
              disabled={busy || !settingsData}
              describedBy="statement-timezone-help"
              onValueChange={(zone) => {
                setStatementTimeZone(zone);
                setPreview(null);
                setMappingApplied(false);
              }}
            />
            <p id="statement-timezone-help" className="mt-1 text-xs text-muted-foreground">
              Выберите часовой пояс, используемый в отчёте вашего брокера. Временные метки с явным
              смещением сохранят это смещение. Ваш журнал отображает время в {displayTimeZone}.
            </p>
            {timeZone && !validTimeZone && (
              <p role="alert" className="mt-1 text-xs text-loss">
                Введите корректный часовой пояс IANA, например Europe/Helsinki.
              </p>
            )}
            {settingsError && (
              <p role="alert" className="mt-1 text-xs text-loss">
                {settingsError}
              </p>
            )}
          </div>
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-8 text-center hover:border-ring">
            <FileUp className="h-6 w-6 text-muted-foreground" />
            <span className="text-sm">{fileName || "Перетащите или выберите CSV / HTML отчёт"}</span>
            <span className="text-xs text-muted-foreground">
              Автоопределение:{" "}
              {formatData?.formats.map((format) => format.label.split(" (")[0]).join(", ")} —
              остальное через маппинг колонок.
            </span>
            <input
              type="file"
              accept=".csv,.txt,.htm,.html,.tsv"
              disabled={busy || !settingsData || !validTimeZone}
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void onFile(file);
              }}
            />
          </label>
          {content && !preview && (
            <Button onClick={previewFile} disabled={busy || !validTimeZone} variant="outline">
              {busy ? "Чтение…" : "Предпросмотр файла"}
            </Button>
          )}

          {error && (
            <p role="alert" className="text-sm text-loss">
              {error}
            </p>
          )}
          {preview?.needsSymbol && (
            <div className="flex flex-wrap items-end gap-2">
              <label className="min-w-0 flex-1 text-xs text-muted-foreground">
                Тикер
                <Input
                  value={symbol}
                  onChange={(event) => setSymbol(event.target.value.toUpperCase())}
                  placeholder="AAPL, EURUSD…"
                  className="mt-1"
                />
              </label>
              <Button
                size="sm"
                variant="outline"
                onClick={previewFile}
                disabled={busy || !symbol.trim()}
              >
                Предпросмотр
              </Button>
            </div>
          )}
          {preview?.needsMapping && preview.headers && (
            <div className="space-y-2 rounded-md border p-3">
              <p className="text-sm">
                Формат не распознан — сопоставьте ваши колонки (ничего не угадывается автоматически):
              </p>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                {mappingFields.map((field) => (
                  <div key={field}>
                    <Label className="mb-1 block text-xs capitalize text-muted-foreground">
                      {field === "symbol" ? "Тикер" : field === "side" ? "Сторона" : field === "quantity" ? "Количество" : field === "price" ? "Цена" : field === "fee" ? "Комиссия (необязательно)" : field === "timestamp" ? "Время" : field}
                      {field === "fee" ? " (необязательно)" : ""}
                    </Label>
                    <Select
                      value={mapping[field] ?? "none"}
                      onValueChange={(value) =>
                        setMapping((m) => ({ ...m, [field]: value === "none" ? "" : value }))
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="колонка" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">—</SelectItem>
                        {preview.headers!.map((header) => (
                          <SelectItem key={header} value={header}>
                            {header}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              <Button
                size="sm"
                onClick={previewWithMapping}
                disabled={
                  busy ||
                  !mapping.symbol ||
                  !mapping.side ||
                  !mapping.quantity ||
                  !mapping.price ||
                  !mapping.timestamp
                }
              >
                Предпросмотр с маппингом
              </Button>
            </div>
          )}

          {preview && !preview.needsMapping && preview.totals && (
            <div className="space-y-2 rounded-md border p-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant="secondary">{preview.detected}</Badge>
                <span>{preview.totals.executions} исполнений</span>
                <span className="text-muted-foreground">· {preview.totals.symbols} тикеров</span>
                {preview.totals.from && (
                  <span className="text-muted-foreground">
                    · {dayKeyOf(preview.totals.from, displayTimeZone)} →{" "}
                    {preview.totals.to && dayKeyOf(preview.totals.to, displayTimeZone)}
                  </span>
                )}
                {preview.totals.skippedRows > 0 && (
                  <span className="text-muted-foreground">
                    · {preview.totals.skippedRows} строк пропущено
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Часовой пояс отчёта: {preview.timeZone}. Время предпросмотра: {displayTimeZone}.
              </p>
              {!!preview.executions?.length && (
                <div className="space-y-1 border-t pt-2 text-xs">
                  {preview.executions.slice(0, 5).map((execution, index) => (
                    <div key={index} className="flex flex-wrap gap-x-3">
                      <span>
                        {execution.symbol} · {execution.side.toUpperCase()}
                      </span>
                      <span className="text-muted-foreground">
                        {formatTimestamp(execution.executedAt, displayTimeZone)}
                      </span>
                    </div>
                  ))}
                  {preview.totals.executions > 5 && (
                    <p className="text-muted-foreground">Показаны первые 5 исполнений.</p>
                  )}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                {preview.detected === "ninjatrader"
                  ? "Восстанавливаете старый импорт NinjaTrader или исправляете часовой пояс? Импортируйте полную историю в новый аккаунт журнала, затем сравните итоги. Сохраните оригинальный аккаунт и его просмотры, пока не проверите восстановление."
                  : "Исправляете предыдущий импорт? Удалите затронутые сделки перед повторным импортом с другим часовым поясом, чтобы избежать дубликатов. Сначала сделайте резервную копию данных."}
              </p>
              {preview.warnings?.map((warning, index) => (
                <p key={index} className="text-xs text-muted-foreground">
                  ⚠ {warning}
                </p>
              ))}
              {!preview.needsSymbol &&
                preview.errors?.map((message, index) => (
                  <p key={index} role="alert" className="text-xs text-loss">
                    {message}
                  </p>
                ))}
              <fieldset disabled={busy}>
                <AccountPicker
                  value={accountId}
                  onChange={(id) => {
                    setAccountId(id);
                    setReviewOptions({});
                    setPreview((current) =>
                      current ? { ...current, reconciliation: undefined } : null,
                    );
                  }}
                  kind="import"
                />
              </fieldset>
              {preview.detected === "ninjatrader" && accountId && (
                <ImportReconciliation
                  review={preview.reconciliation}
                  options={reviewOptions}
                  onChange={changeReview}
                  onReview={previewFile}
                  busy={busy}
                />
              )}
              <Button
                onClick={commit}
                disabled={
                  !accountId ||
                  busy ||
                  !!preview.errors?.length ||
                  !preview.totals.executions ||
                  (preview.detected === "ninjatrader" && !preview.reconciliation?.token)
                }
              >
                {busy ? "Импорт…" : "Импортировать"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function BrokerConnect() {
  const router = useRouter();
  const { data } = useApi<{ brokers: BrokerInfo[] }>("/api/brokers");
  const [brokerId, setBrokerId] = useState("");
  const [name, setName] = useState("");
  const [marketType, setMarketType] = useState<"linear" | "spot">("linear");
  const [credentials, setCredentials] = useState<Record<string, string>>({});  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const broker = data?.brokers.find((b) => b.id === brokerId) ?? null;

  const connect = async () => {
    if (!broker) return;
    setBusy(true);
    setError(null);
    try {
     const created = await postJson<{ id: string }>("/api/accounts", {
  name:
    name ||
    (broker.id === "bybit"
      ? `${broker.displayName} ${marketType === "spot" ? "Spot" : "Futures"}`
      : broker.displayName),
  kind: "sync",
  broker: broker.id,
  credentials:
    broker.id === "bybit"
      ? { ...credentials, marketType }
      : credentials,
});
      router.push(`/?accounts=${encodeURIComponent(created.id)}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ошибка подключения");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Подключить брокера (ключи только для чтения, хранятся зашифрованными на ВАШЕМ устройстве)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label className="mb-1 block text-xs text-muted-foreground">Брокер / биржа</Label>
          <Select
            value={brokerId}
            onValueChange={(value) => {
  setBrokerId(value);
  setMarketType("linear");
  setCredentials({});
}}
          >
            <SelectTrigger>
              <SelectValue placeholder="Выберите брокера" />
            </SelectTrigger>
            <SelectContent>
              {data?.brokers.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {broker && (
          <>
            <p className="rounded-md bg-muted/60 p-2.5 text-xs text-muted-foreground">
              {broker.readOnlySetup}
            </p>
{broker.id === "bybit" && (
  <div>
    <Label className="mb-1 block text-xs text-muted-foreground">
      Рынок Bybit
    </Label>

    <Select
      value={marketType}
      onValueChange={(value) => setMarketType(value as "linear" | "spot")}
    >
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>

      <SelectContent>
        <SelectItem value="linear">
          Фьючерсы — USDT / USDC Linear
        </SelectItem>
        <SelectItem value="spot">Спот</SelectItem>
      </SelectContent>
    </Select>

    <p className="mt-1 text-xs text-muted-foreground">
      Для каждого подключённого аккаунта синхронизируется только выбранный
      рынок.
    </p>
  </div>
)}
            <div>
              <Label className="mb-1 block text-xs text-muted-foreground">Название аккаунта</Label>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={broker.displayName}
              />
            </div>
            {broker.credentials.map((field) => (
              <div key={field.key}>
                <Label className="mb-1 block text-xs text-muted-foreground">{field.label}</Label>
                <Input
                  type={field.secret ? "password" : "text"}
                  value={credentials[field.key] ?? ""}
                  onChange={(event) =>
                    setCredentials((c) => ({ ...c, [field.key]: event.target.value }))
                  }
                  autoComplete="off"
                />
              </div>
            ))}
            {error && <p className="text-sm text-loss">{error}</p>}
            <Button
              onClick={connect}
              disabled={busy || broker.credentials.some((field) => !credentials[field.key])}
            >
              {busy ? "Подключение…" : "Подключить и синхронизировать"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}