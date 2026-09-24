"use client";

import { Suspense, useEffect, useState } from "react";
import { JournalDefaultSettings } from "@/components/journal-default-settings";
import { MarketDataSettings } from "@/components/market-data-settings";
import { AiSettings } from "@/components/ai-settings";
import { Download } from "lucide-react";
import { FilterBar } from "@/components/filter-bar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TimeZonePicker } from "@/components/timezone-picker";
import { Label } from "@/components/ui/label";
import { postJson, useApi } from "@/lib/use-api";

interface SettingsPayload {
  timeZone: string;
  importTimeZone: string;
  multipliers: Record<string, number>;
}

export default function SettingsPage() {
  return (
    <Suspense>
      <Settings />
    </Suspense>
  );
}

function Settings() {
  const { data, refresh } = useApi<SettingsPayload>("/api/settings");
  const [timeZone, setTimeZone] = useState("");
  const [importTimeZone, setImportTimeZone] = useState("");
  const [multipliers, setMultipliers] = useState("");
  const [saved, setSaved] = useState(false);
  const [failure, setFailure] = useState("");

  useEffect(() => {
    if (data) {
      setTimeZone(data.timeZone);
      setImportTimeZone(data.importTimeZone);
      setMultipliers(
        Object.entries(data.multipliers)
          .map(([symbol, multiplier]) => `${symbol}=${multiplier}`)
          .join("\n"),
      );
    }
  }, [data]);

  const save = async () => {
    const parsedMultipliers: Record<string, number> = {};
    for (const line of multipliers.split("\n")) {
      const [symbol, value] = line.split("=").map((part) => part.trim());
      if (symbol && value && Number.isFinite(Number(value))) {
        parsedMultipliers[symbol.toUpperCase()] = Number(value);
      }
    }
    try {
      await postJson(
        "/api/settings",
        { timeZone, importTimeZone, multipliers: parsedMultipliers },
        "PATCH",
      );
      setFailure("");
    } catch (e) {
      setFailure(e instanceof Error ? e.message : "Ошибка сохранения");
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
    refresh();
  };

  return (
    <div>
      <FilterBar title="Настройки" />
      <div className="mx-auto max-w-2xl space-y-3 p-4">
        <JournalDefaultSettings />
        <MarketDataSettings />
        <Card>
          <CardHeader>
            <CardTitle>Журнал</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label
                htmlFor="display-timezone"
                className="mb-1 block text-xs text-muted-foreground"
              >
                Часовой пояс отображения (IANA)
              </Label>
              <TimeZonePicker
                id="display-timezone"
                label="Часовой пояс отображения"
                value={timeZone}
                onValueChange={setTimeZone}
                disabled={!data}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Время сделок, календари, дни журнала и аналитика используют этот часовой пояс.
              </p>
              <button
                className="mt-1 text-xs text-muted-foreground underline"
                onClick={() => setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone)}
              >
                Использовать часовой пояс устройства ({Intl.DateTimeFormat().resolvedOptions().timeZone})
              </button>
            </div>
            <div>
              <Label htmlFor="import-timezone" className="mb-1 block text-xs text-muted-foreground">
                Часовой пояс импорта по умолчанию (IANA)
              </Label>
              <TimeZonePicker
                id="import-timezone"
                label="Часовой пояс импорта по умолчанию"
                value={importTimeZone}
                onValueChange={setImportTimeZone}
                disabled={!data}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Используйте часовой пояс отчёта вашего брокера для временных меток без смещения.
                Вы можете переопределить его для каждого файла. Изменение этой настройки влияет
                только на будущие импорты.
              </p>
            </div>
            <div>
              <Label className="mb-1 block text-xs text-muted-foreground">
                Множители контрактов (фьючерсы/опционы) — по одному на строку, SYMBOL=множитель
              </Label>
              <textarea
                value={multipliers}
                onChange={(event) => setMultipliers(event.target.value)}
                placeholder={"ES=50\nNQ=20\nMES=5"}
                className="flex min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-sm shadow-sm"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Сохранение множителей пересчитывает существующий P&L сделок по исполнениям и сохраняет
              аннотации.
            </p>
            {failure && (
              <p role="alert" className="text-xs text-destructive">
                {failure}
              </p>
            )}
            <Button onClick={save} disabled={!data}>
              {saved ? "Сохранено ✓" : "Сохранить"}
            </Button>
          </CardContent>
        </Card>

        <AiSettings />

        <Card>
          <CardHeader>
            <CardTitle>Ваши данные</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <a href="/api/export" download="trade-journal-export.json">
              <Button variant="outline">
                <Download />
                Полная резервная копия (JSON)
              </Button>
            </a>
            <a href="/api/export?format=csv" download>
              <Button variant="outline">
                <Download />
                Сделки (CSV)
              </Button>
            </a>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}