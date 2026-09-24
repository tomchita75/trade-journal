"use client";

import type { AnalysisFilters, BucketStats } from "@luxalgo/journal-core";
import { TimeHeatmap } from "./charts/time-heatmap";
import { ReviewExport } from "./review-export";
import { MonetaryValue } from "./privacy";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Skeleton } from "./ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { useApi } from "@/lib/use-api";
import { fmtMoney, fmtPercent, pnlClass } from "@/lib/utils";
import { describeFilters } from "@/lib/filter-description";

interface OverviewData {
  buckets: Record<
    "symbol" | "tag" | "mistake" | "playbook" | "weekday" | "hour" | "duration" | "direction",
    BucketStats[]
  >;
  currencies: string[];
  timeZone: string;
  accounts: { id: string; name: string }[];
  playbooks: { id: string; name: string }[];
}

// Keep the original overview's aggregations and ordering alongside the advanced reports.
const SECTIONS = [
  { key: "symbol", title: "По тикеру" },
  { key: "direction", title: "Лонг против шорт" },
  { key: "weekday", title: "По дню недели" },
  { key: "duration", title: "По времени удержания" },
  { key: "tag", title: "По тегу" },
  { key: "mistake", title: "По ошибке" },
  { key: "playbook", title: "По плейбуку" },
] as const;

export function ReportOverview({ query, filters }: { query: string; filters: AnalysisFilters }) {
  const { data, error, loading } = useApi<OverviewData>(`/api/stats?${query}`);
  if (error)
    return (
      <p role="alert" className="text-sm text-destructive">
        {error}
      </p>
    );
  if (loading || !data) return <Skeleton className="h-72" />;
  if (data.currencies.length > 1)
    return (
      <p className="rounded-lg border p-4 text-sm">
        Эти аккаунты используют разные валюты ({data.currencies.join(", ")}). Выберите аккаунты с
        одинаковой валютой в фильтрах для сравнения денежных результатов.
      </p>
    );
  const currency = data.currencies[0] ?? "USD";
  const label = (dimension: string, key: string) =>
    dimension === "playbook" ? (data.playbooks.find((book) => book.id === key)?.name ?? key) : key;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Обзор торговли · {data.timeZone} · {currency}
        </p>
        <ReviewExport
          containsFinancialData
          document={{
            title: "Обзор торговли",
            subtitle: `${data.timeZone} · ${currency}`,
            lines: [
              `Фильтры: ${describeFilters(filters, data.accounts, data.playbooks)}`,
              "",
              "Эффективность по времени сделок (час открытия)",
              ...data.buckets.hour.map(
                (b) => `${b.key}:00: ${b.trades} сделок | Чистый P&L ${fmtMoney(b.netPnl, currency)}`,
              ),
              ...SECTIONS.flatMap((section) => [
                "",
                section.title,
                ...data.buckets[section.key].map(
                  (b) =>
                    `${label(section.key, b.key)}: ${b.trades} сделок | Побед ${fmtPercent(b.winRate, 0)} | Чистый P&L ${fmtMoney(b.netPnl, currency)}`,
                ),
              ]),
            ],
          }}
        />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Эффективность по времени сделок</CardTitle>
          </CardHeader>
          <CardContent>
            <TimeHeatmap hours={data.buckets.hour} currency={currency} />
          </CardContent>
        </Card>
        {SECTIONS.map((section) => (
          <Card key={section.key}>
            <CardHeader>
              <CardTitle>{section.title}</CardTitle>
            </CardHeader>
            <CardContent>
              {data.buckets[section.key].length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {section.key === "tag" || section.key === "mistake" || section.key === "playbook"
                    ? "Помечайте сделки, чтобы разблокировать эту разбивку."
                    : "Данных пока нет."}
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{section.title.replace("По ", "")}</TableHead>
                      <TableHead className="text-right">Сделок</TableHead>
                      <TableHead className="text-right">Побед %</TableHead>
                      <TableHead className="text-right">Чистый P&L</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.buckets[section.key].map((bucket) => (
                      <TableRow key={bucket.key}>
                        <TableCell className="font-medium">
                          {label(section.key, bucket.key)}
                        </TableCell>
                        <TableCell className="tnum text-right text-muted-foreground">
                          {bucket.trades}
                        </TableCell>
                        <TableCell className="tnum text-right">
                          {fmtPercent(bucket.winRate, 0)}
                        </TableCell>
                        <TableCell className={`tnum text-right ${pnlClass(bucket.netPnl)}`}>
                          <MonetaryValue>{fmtMoney(bucket.netPnl, currency)}</MonetaryValue>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        День недели и час используют время открытия сделки. Количество сделок в обзоре включает
        открытые позиции; процент побед использует закрытые сделки. Время удержания требует закрытой
        сделки. Теги и ошибки могут пересекаться. По тикеру показывает топ-20 по чистому P&L;
        Разбивки включают каждый тикер и дополнительные метрики для закрытых сделок.
      </p>
    </div>
  );
}