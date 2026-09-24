"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import { MIN_TREND_POINTS, type PerformanceTrendsResponse } from "@/lib/performance-trends";
import { useApi } from "@/lib/use-api";
import { fmtPercent } from "@/lib/utils";
import { Pnl } from "./pnl";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";

const RollingTradeChart = dynamic(
  () => import("./charts/rolling-trade-chart").then((module) => module.RollingTradeChart),
  {
    loading: () => (
      <div role="status" aria-label="Загрузка графика тренда">
        <Skeleton className="h-60" />
      </div>
    ),
  },
);
const tradeHref = (key: string) => `/trades/${encodeURIComponent(key)}`;

export function PerformanceTrendsReport({ query }: { query: string }) {
  const { data, loading, error, refresh } = useApi<PerformanceTrendsResponse>(
    `/api/performance-trends?${query}`,
  );
  const [tableOpen, setTableOpen] = useState(false);
  const dateFormat = useMemo(
    () =>
      new Intl.DateTimeFormat("en", {
        timeZone: data?.timeZone ?? "UTC",
        dateStyle: "medium",
        timeStyle: "short",
      }),
    [data?.timeZone],
  );
  if (loading)
    return (
      <div
        role="status"
        aria-label="Загрузка трендов производительности"
        className="grid gap-3 md:grid-cols-2"
      >
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
    );
  if (error || !data)
    return (
      <div role="alert" className="rounded-xl border p-5">
        <p className="text-sm text-destructive">{error ?? "Не удалось загрузить тренды производительности."}</p>
        <Button onClick={refresh} variant="outline" size="sm" className="mt-3">
          Попробовать снова
        </Button>
      </div>
    );
  const { trends, timeZone, currencies } = data;
  const currency = currencies[0] ?? "USD";
  const monetary = currencies.length <= 1;
  const latest = trends.points.at(-1);
  const chartReady = trends.points.length >= MIN_TREND_POINTS;
  return (
    <section
      className="space-y-4"
      aria-labelledby="performance-trends-title"
      data-performance-trends
    >
      <div>
        <h2 id="performance-trends-title" className="text-lg font-semibold">
          Тренды производительности
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {trends.count} закрыт{trends.count === 1 ? "а" : "ых"} сделк{trends.count === 1 ? "а" : "ок"} · Активный счёт и фильтры · Закрывающее исполнение · {timeZone}
          {monetary && trends.count > 0 ? ` · ${currency}` : ""}
        </p>
      </div>
      {trends.count === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <h3 className="font-medium">В этой выборке нет закрытых сделок</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Измените диапазон дат или фильтры, чтобы изучить историю торговли. Открытые позиции не учитываются.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {!monetary && (
            <p
              role="note"
              className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground"
            >
              Эти сделки используют разные валюты ({currencies.join(", ")}). Доступен только процент побед; выберите счета с одной валютой для сравнения P&L и крупнейших сделок. Конвертация валют не применяется.
            </p>
          )}
          <div className={`grid items-start gap-3 ${monetary ? "lg:grid-cols-2" : ""}`}>
            {(["winRate", ...(monetary ? ["avgNetPnl" as const] : [])] as const).map((metric) => {
              const rate = metric === "winRate";
              const reference = rate ? trends.overallWinRate! : trends.overallAvgNetPnl!;
              return (
                <Card key={metric} className="min-w-0 overflow-hidden">
                  <CardHeader>
                    <CardTitle>{rate ? "Тренд процента побед" : "Тренд среднего P&L сделки"}</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      Последние 20 закрытых сделок в каждой точке
                      {rate ? " · Безубытки включены" : " · После комиссий"}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap items-end justify-between gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Последнее полное окно</p>
                        <p className="mt-1 text-2xl font-semibold tabular-nums">
                          {latest ? (
                            rate ? (
                              fmtPercent(latest.winRate, 1)
                            ) : (
                              <Pnl value={latest.avgNetPnl} currency={currency} />
                            )
                          ) : (
                            "—"
                          )}
                        </p>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        <p>За выбранный период {rate ? "процент побед" : "среднее"}</p>
                        <p className="mt-1 text-sm tabular-nums">
                          {rate ? (
                            fmtPercent(reference, 1)
                          ) : (
                            <Pnl value={reference} currency={currency} />
                          )}
                        </p>
                      </div>
                    </div>
                    {chartReady ? (
                      <>
                        <RollingTradeChart
                          data={trends.points}
                          metric={metric}
                          reference={reference}
                          currency={currency}
                          timeZone={timeZone}
                        />
                        <p className="text-xs text-muted-foreground">
                          Последовательность закрытых сделок · Пунктирная линия: среднее за выбранный период{" "}
                          {rate ? "процент побед" : "среднее"}
                        </p>
                      </>
                    ) : (
                      <div className="rounded-lg bg-muted/30 px-4 py-6 text-sm leading-relaxed text-muted-foreground">
                        {!latest
                          ? `Ещё ${20 - trends.count} закрыт${20 - trends.count === 1 ? "а" : "ых"} сделк${20 - trends.count === 1 ? "и" : "ок"} необходим${20 - trends.count === 1 ? "а" : "ы"} для первого полного окна из 20 сделок.`
                          : `Последнее окно доступно. Линейный график появляется при 27 закрытых сделках, когда есть 8 полных окон для сравнения.`}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
          {monetary && (
            <Card className="min-w-0">
              <CardHeader>
                <CardTitle>Крупнейшая выигрышная и проигрышная сделка</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Отдельные закрытые сделки, после комиссий — не дневные итоги. Используется ваша классификация выигрыш/проигрыш из журнала.
                </p>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                {(
                  [
                    ["Крупнейший выигрыш", trends.largestWin],
                    ["Крупнейший проигрыш", trends.largestLoss],
                  ] as const
                ).map(([label, trade]) => (
                  <div key={label} className="min-w-0 rounded-lg border p-4">
                    <h3 className="text-xs text-muted-foreground">{label}</h3>
                    {trade ? (
                      <>
                        <p className="mt-2 text-xl font-semibold">
                          <Pnl value={trade.netPnl} currency={currency} />
                        </p>
                        <Link
                          href={tradeHref(trade.key)}
                          className="mt-2 inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 rounded text-sm underline decoration-muted-foreground/40 underline-offset-4 hover:decoration-current"
                        >
                          <span className="break-all font-medium">
                            {trade.symbol} · {trade.direction}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {dateFormat.format(new Date(trade.closedAt))} ↗
                          </span>
                        </Link>
                      </>
                    ) : (
                      <p className="mt-3 text-sm text-muted-foreground">
                        В этой выборке нет {label === "Крупнейший выигрыш" ? "выигрышных" : "проигрышных"} сделок.
                      </p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          {latest && (
            <details
              className="rounded-xl border bg-card"
              onToggle={(event) => setTableOpen(event.currentTarget.open)}
            >
              <summary className="cursor-pointer rounded-xl px-4 py-3 text-sm font-medium">
                Изучить значения окон и сделки
              </summary>
              {tableOpen && (
                <div className="max-h-72 overflow-auto px-4 pb-4">
                  <table className="w-full text-left text-xs">
                    <caption className="pb-3 text-left text-muted-foreground">
                      Каждая строка охватывает 20 сделок, заканчиваясь на связанной сделке. Даты используют {timeZone}.
                    </caption>
                    <thead>
                      <tr className="border-b">
                        <th scope="col" className="py-2 pr-3">
                          Окно / закрывающая сделка
                        </th>
                        <th scope="col" className="px-2 text-right">
                          Процент побед
                        </th>
                        {monetary && (
                          <th scope="col" className="pl-2 text-right">
                            Средний чистый P&L
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {trends.points.map((point) => (
                        <tr key={point.key} className="border-b last:border-0">
                          <th scope="row" className="py-3 pr-3 font-normal">
                            <Link
                              className="rounded underline underline-offset-4"
                              href={tradeHref(point.key)}
                            >
                              #{point.sequence - 19}–{point.sequence}
                              <span className="mt-1 block text-muted-foreground">
                                {dateFormat.format(new Date(point.closedAt))}
                              </span>
                            </Link>
                          </th>
                          <td className="px-2 text-right tabular-nums">
                            {fmtPercent(point.winRate, 1)}
                          </td>
                          {monetary && (
                            <td className="pl-2 text-right">
                              <Pnl value={point.avgNetPnl} currency={currency} />
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </details>
          )}
          <p className="text-xs leading-relaxed text-muted-foreground">
            Используются только сделки из вашей выборки; более ранние сделки не заимствуются для заполнения окна. Скользящие окна перекрываются и описывают недавние результаты — не прогноз. Малые выборки могут резко меняться.
          </p>
        </>
      )}
    </section>
  );
}