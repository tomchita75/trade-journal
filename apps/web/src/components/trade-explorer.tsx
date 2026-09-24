"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  clockLabel,
  plotTradePoints,
  type PlottedTrade,
  type TradeExplorerResponse,
  type TradeXAxis,
  type TradeYAxis,
} from "@/lib/trade-explorer";
import { useApi } from "@/lib/use-api";
import { ReportMarketEstimates } from "./report-market-estimates";
import { MonetaryValue } from "./privacy";
import { fmtMoney } from "@/lib/utils";
import { Pnl } from "./pnl";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { OptionSelect } from "./ui/option-select";
import { Skeleton } from "./ui/skeleton";

const TradeScatter = dynamic(
  () => import("./charts/trade-scatter").then((module) => module.TradeScatter),
  {
    loading: () => (
      <div role="status" aria-label="Загрузка диаграммы рассеяния">
        <Skeleton className="h-80" />
      </div>
    ),
  },
);
const PAGE_SIZE = 25;
const detailHref = (key: string) => `/trades/${encodeURIComponent(key)}`;

export function TradeExplorer({ query }: { query: string }) {
  const { data, error, loading, refresh } = useApi<TradeExplorerResponse>(
    `/api/trade-explorer?${query}`,
  );
  const [x, setX] = useState<TradeXAxis>("durationMinutes");
  const [y, setY] = useState<TradeYAxis>("netPnl");
  const [selected, setSelected] = useState<PlottedTrade | null>(null);
  const [page, setPage] = useState(0);
  const [tableOpen, setTableOpen] = useState(false);
  const points = useMemo(() => plotTradePoints(data?.points ?? [], x, y), [data, x, y]);
  const date = useMemo(
    () =>
      new Intl.DateTimeFormat("ru", {
        timeZone: data?.timeZone ?? "UTC",
        dateStyle: "medium",
        timeStyle: "short",
      }),
    [data?.timeZone],
  );
  if (loading && !data)
    return (
      <div role="status" aria-label="Загрузка обозревателя сделок">
        <Skeleton className="h-96" />
      </div>
    );
  if (error || !data)
    return (
      <div role="alert" className="rounded-xl border p-5">
        <p className="text-sm text-destructive">{error ?? "Не удалось загрузить обозреватель сделок."}</p>
        <Button onClick={refresh} variant="outline" size="sm" className="mt-3">
          Попробовать снова
        </Button>
      </div>
    );
  const currency = data.currencies[0] ?? "USD";
  const excursion = x === "mae" || x === "mfe" || y === "mae" || y === "mfe";
  const blocked = (y !== "realizedR" || excursion) && data.currencies.length > 1;
  const xTitle =
    x === "durationMinutes"
      ? "Длительность (мин)"
      : x === "entryMinute"
        ? `Время входа (${data.timeZone})`
        : `Оценочный ${x.toUpperCase()} (${currency})`;
  const yTitle =
    y === "netPnl"
      ? `Чистый P&L (${currency})`
      : y === "realizedR"
        ? "Реализованный R"
        : `Оценочный ${y.toUpperCase()} (${currency})`;
  const value = (point: PlottedTrade) =>
    y === "mae" || y === "mfe" ? (
      <MonetaryValue>{fmtMoney(point.y, currency)}</MonetaryValue>
    ) : y === "netPnl" ? (
      <Pnl value={point.y} currency={currency} />
    ) : (
      <span className="tabular-nums">
        {point.y > 0 ? "+" : ""}
        {point.y.toFixed(2)}R
      </span>
    );
  const xValue = (point: PlottedTrade) =>
    x === "mae" || x === "mfe" ? (
      <MonetaryValue>{fmtMoney(point.x, currency)}</MonetaryValue>
    ) : x === "entryMinute" ? (
      clockLabel(point.x)
    ) : (
      `${point.x.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} мин`
    );
  const pages = Math.ceil(points.length / PAGE_SIZE);
  const shownPage = Math.min(page, Math.max(0, pages - 1));
  const table = (
    <div className="space-y-3 px-4 pb-4">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <caption className="pb-3 text-left text-muted-foreground">
            Все {points.length} сопоставимых сделок, сначала новые. Каждая ссылка открывает оригинальную сделку.
          </caption>
          <thead>
            <tr className="border-b">
              <th scope="col" className="py-2 pr-3">
                Сделка / закрыта
              </th>
              <th scope="col" className="px-2 text-right">
                {xTitle}
              </th>
              <th scope="col" className="pl-2 text-right">
                {yTitle}
              </th>
            </tr>
          </thead>
          <tbody>
            {points.slice(shownPage * PAGE_SIZE, (shownPage + 1) * PAGE_SIZE).map((point) => (
              <tr key={point.key} className="border-b last:border-0">
                <th scope="row" className="py-3 pr-3 font-normal">
                  <Link
                    href={detailHref(point.key)}
                    className="rounded underline underline-offset-4"
                  >
                    <span className="break-all font-medium">
                      {point.symbol} · {point.direction}
                    </span>
                    <span className="mt-1 block text-muted-foreground">
                      {date.format(new Date(point.closedAt))}
                    </span>
                  </Link>
                </th>
                <td className="px-2 text-right tabular-nums">{xValue(point)}</td>
                <td className="pl-2 text-right">{value(point)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-between gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={shownPage === 0}
            onClick={() => setPage(shownPage - 1)}
          >
            Назад
          </Button>
          <p aria-live="polite" className="text-xs text-muted-foreground">
            Страница {shownPage + 1} из {pages}
          </p>
          <Button
            size="sm"
            variant="outline"
            disabled={shownPage === pages - 1}
            onClick={() => setPage(shownPage + 1)}
          >
            Вперёд
          </Button>
        </div>
      )}
    </div>
  );
  return (
    <section className="space-y-4" aria-labelledby="trade-explorer-title" data-trade-explorer>
      <div>
        <h2 id="trade-explorer-title" className="text-lg font-semibold">
          Обозреватель сделок
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Сравнивайте отдельные сделки, не средние по группе · Активный аккаунт и фильтры ·{" "}
          {data.timeZone}
        </p>
      </div>
      <ReportMarketEstimates
        points={data.points}
        currencies={data.currencies}
        onComplete={refresh}
      />
      <div className="flex flex-wrap gap-2" aria-label="Пресеты диаграммы рассеяния">
        {(
          [
            ["durationMinutes", "netPnl", "Время удержания"],
            ["mae", "netPnl", "MAE против чистого P&L"],
            ["mfe", "netPnl", "MFE против чистого P&L"],
            ["mae", "mfe", "MAE против MFE"],
          ] as const
        ).map(([nextX, nextY, label]) => (
          <Button
            key={label}
            size="sm"
            variant={x === nextX && y === nextY ? "secondary" : "outline"}
            onClick={() => {
              setX(nextX);
              setY(nextY);
              setSelected(null);
              setPage(0);
            }}
          >
            {label}
          </Button>
        ))}
      </div>
      <Card className="min-w-0 overflow-hidden">
        <CardHeader>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <CardTitle>
                {excursion
                  ? `${xTitle} против ${yTitle}`
                  : `Исходы сделок по ${x === "durationMinutes" ? "времени удержания" : "времени входа"}`}
              </CardTitle>
              <p className="mt-2 text-xs text-muted-foreground">
                {blocked
                  ? `${data.points.length} закрытых сделок`
                  : `${points.length} из ${data.points.length} закрытых сделок сопоставимы`}{" "}
                · Одна точка на сделку ·{" "}
                {excursion ? "Оценочный грубый эксурсив; чистый P&L после комиссий" : "После комиссий"}
              </p>
            </div>
            <div className="flex w-full flex-wrap gap-3 sm:w-auto">
              <div className="min-w-0 flex-1 sm:w-44">
                <label
                  htmlFor="trade-x-axis"
                  className="mb-1.5 block text-xs text-muted-foreground"
                >
                  Ось X
                </label>
                <OptionSelect
                  id="trade-x-axis"
                  value={x}
                  onValueChange={(value) => {
                    setX(value as TradeXAxis);
                    setSelected(null);
                    setPage(0);
                  }}
                >
                  <option value="durationMinutes">Длительность (мин)</option>
                  <option value="entryMinute">Время входа</option>
                  <option value="mae">Оценочный MAE</option>
                  <option value="mfe">Оценочный MFE</option>
                </OptionSelect>
              </div>
              <div className="min-w-0 flex-1 sm:w-44">
                <label
                  htmlFor="trade-y-axis"
                  className="mb-1.5 block text-xs text-muted-foreground"
                >
                  Ось Y
                </label>
                <OptionSelect
                  id="trade-y-axis"
                  value={y}
                  onValueChange={(value) => {
                    setY(value as TradeYAxis);
                    setSelected(null);
                    setPage(0);
                  }}
                >
                  <option value="netPnl">Чистый P&L</option>
                  <option value="realizedR">Реализованный R</option>
                  <option value="mae">Оценочный MAE</option>
                  <option value="mfe">Оценочный MFE</option>
                </OptionSelect>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.points.length === 0 ? (
            <div className="py-10 text-center">
              <h3 className="font-medium">Нет закрытых сделок в этом выборе</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Измените диапазон дат или фильтры, чтобы изучить вашу историю. Открытые позиции
                исключены.
              </p>
            </div>
          ) : blocked ? (
            <p role="note" className="rounded-lg bg-muted/30 p-4 text-sm text-muted-foreground">
              Эти сделки используют разные валюты ({data.currencies.join(", ")}). Выберите аккаунты
              с одной валютой для денежных осей или используйте Длительность и Реализованный R для
              сравнения нормализованных по риску исходов. Конвертация валют не применяется.
            </p>
          ) : (
            <>
              {points.length < data.points.length && (
                <p role="note" className="text-xs leading-relaxed text-muted-foreground">
                  {data.points.length - points.length} сделок исключено:{" "}
                  {y === "realizedR"
                    ? "реализованный R требует валидный запланированный стоп-лосс и любой требуемый множитель контракта; "
                    : ""}
                  {excursion ? "MAE/MFE требуют сохранённые, текущие оценки рыночных данных. " : ""}Обе
                  оси требуют валидные значения и временные метки.
                </p>
              )}
              {y === "realizedR" && (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  R = чистый P&L ÷ запланированный риск от вашего стоп-лосса. Использует взвешенный
                  вход и общее количество на входе; не измеряет максимальный внутридневной риск.
                </p>
              )}
              {points.length >= (excursion ? 1 : 8) ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                    <span>{yTitle}</span>
                    <span className="flex flex-wrap gap-x-4 gap-y-1">
                      <span>
                        <span aria-hidden="true" className="text-[var(--profit)]">
                          ●
                        </span>{" "}
                        Положительный чистый P&L
                      </span>
                      <span>
                        <span aria-hidden="true" className="text-[var(--loss)]">
                          ●
                        </span>{" "}
                        Отрицательный чистый P&L
                      </span>
                      <span>
                        <span aria-hidden="true">●</span> Нулевой чистый P&L
                      </span>
                    </span>
                  </div>
                  <TradeScatter
                    points={points}
                    x={x}
                    y={y}
                    currency={currency}
                    timeZone={data.timeZone}
                    onSelect={setSelected}
                  />
                  <p className="text-center text-xs text-muted-foreground">{xTitle}</p>
                  <p className="text-xs text-muted-foreground">
                    Выберите точку, чтобы изучить её сделку. Перекрывающиеся точки остаются
                    индивидуально доступными в таблице.
                  </p>
                  <div aria-live="polite">
                    {selected && (
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/20 p-4">
                        <div>
                          <p className="text-sm font-medium break-all">
                            {selected.symbol} · {selected.direction} · {value(selected)}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {xValue(selected)} · Закрыта {date.format(new Date(selected.closedAt))}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Link
                            href={detailHref(selected.key)}
                            className="rounded text-sm underline underline-offset-4"
                          >
                            Открыть сделку ↗
                          </Link>
                          <Button size="sm" variant="ghost" onClick={() => setSelected(null)}>
                            Закрыть
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <p className="rounded-lg bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
                  {points.length === 0
                    ? "Нет сделок с данными, требуемыми для этих осей. Попробуйте другую ось или измените фильтры."
                    : "Менее 8 сопоставимых сделок. Просмотрите точные значения ниже или расширьте фильтры, чтобы получить полезную диаграмму рассеяния."}
                </p>
              )}
              {points.length > 0 && points.length < 20 && (
                <p className="text-xs text-muted-foreground">
                  Маленькая выборка: относитесь к видимым паттернам осторожно, пока не станет
                  доступно больше сделок.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
      {!blocked &&
        points.length > 0 &&
        (points.length < 8 ? (
          <Card>
            <CardHeader>
              <CardTitle>Сопоставимые сделки</CardTitle>
            </CardHeader>
            {table}
          </Card>
        ) : (
          <details
            className="rounded-xl border bg-card"
            onToggle={(event) => setTableOpen(event.currentTarget.open)}
          >
            <summary className="cursor-pointer rounded-xl px-4 py-3 text-sm font-medium">
              Изучить все {points.length} сделок
            </summary>
            {tableOpen && table}
          </details>
        ))}
      <p className="text-xs leading-relaxed text-muted-foreground">
        Длительность — это прошедшее время от первого входа до окончательного выхода, включая
        ночные часы. Время входа использует часовой пояс журнала; соседи около полуночи появляются
        на противоположных концах этой оси. Паттерны описывают этот выбор, не причинность или
        рекомендуемое время удержания.
      </p>
    </section>
  );
}