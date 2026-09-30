"use client";

import {
  CandlestickSeries,
  ColorType,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type MouseEventParams,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import { useEffect, useMemo, useRef, useState } from "react";

type Bar = {
  time: number | string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

type Execution = {
  id?: string;
  executionId?: string;
  side: "buy" | "sell";
  quantity: number;
  price: number;
  fee?: number;
  executedAt: string;
};

type Trade = {
  symbol?: string;
  ticker?: string;
  openedAt?: string;
  closedAt?: string | null;
  stopLoss?: number | null;
  profitTarget?: number | null;
};

type History = {
  bars: Bar[];
  provider?: string;
  symbol?: string;
  resolution?: string;
};

interface HistoricalReplayProps {
  history: History;
  trade: Trade;
  executions: Execution[];
privacy: boolean;
}

const formatNumber = (value: number, maximumFractionDigits = 6) =>
  new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits,
  }).format(value);

const formatDateTime = (value: string | number) =>
  new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(new Date(value));

const toTimestamp = (value: number | string): UTCTimestamp => {
  if (typeof value === "number") {
    return Math.floor(value > 10_000_000_000 ? value / 1000 : value) as UTCTimestamp;
  }

  const milliseconds = Date.parse(value);
  return Math.floor(milliseconds / 1000) as UTCTimestamp;
};

const toExecutionTime = (executedAt: string): UTCTimestamp =>
  Math.floor(new Date(executedAt).getTime() / 1000) as UTCTimestamp;

const asFiniteNumber = (value: unknown): number | null => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const candleTimeForExecution = (
  executionTime: UTCTimestamp,
  candleTimes: UTCTimestamp[],
): UTCTimestamp | null => {
  if (candleTimes.length === 0) return null;

  let chosen = candleTimes[0];

  for (const candleTime of candleTimes) {
    if (candleTime > executionTime) break;
    chosen = candleTime;
  }

  return chosen ?? null;
};

export function HistoricalReplay({
  history,
  trade,
  executions,
privacy,
}: HistoricalReplayProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const [hoveredPrice, setHoveredPrice] = useState<number | null>(null);
  const [hoveredTime, setHoveredTime] = useState<Time | null>(null);

  const bars = useMemo(() => {
    const deduplicated = new Map<UTCTimestamp, Bar>();

    for (const bar of history.bars ?? []) {
      const time = toTimestamp(bar.time);

      if (
        !Number.isFinite(bar.open) ||
        !Number.isFinite(bar.high) ||
        !Number.isFinite(bar.low) ||
        !Number.isFinite(bar.close)
      ) {
        continue;
      }

      deduplicated.set(time, {
        ...bar,
        time,
      });
    }

    return [...deduplicated.values()]
      .sort((left, right) => toTimestamp(left.time) - toTimestamp(right.time))
      .map((bar) => ({
        time: toTimestamp(bar.time),
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
      }));
  }, [history.bars]);

  const orderedExecutions = useMemo(
    () =>
      [...(executions ?? [])].sort(
        (left, right) =>
          new Date(left.executedAt).getTime() -
          new Date(right.executedAt).getTime(),
      ),
    [executions],
  );

  const symbol = history.symbol ?? trade.symbol ?? trade.ticker ?? "—";
  const resolution = history.resolution ?? "—";

  useEffect(() => {
    const host = hostRef.current;
    if (!host || bars.length === 0) return;

    const chart = createChart(host, {
      autoSize: true,
      height: 540,
      layout: {
        background: {
          type: ColorType.Solid,
          color: "hsl(var(--card))",
        },
        textColor: "hsl(var(--muted-foreground))",
        fontFamily:
          "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
      },
      grid: {
        vertLines: {
          color: "hsl(var(--border) / 0.45)",
        },
        horzLines: {
          color: "hsl(var(--border) / 0.45)",
        },
      },
      crosshair: {
        vertLine: {
          color: "hsl(var(--primary) / 0.55)",
          labelBackgroundColor: "hsl(var(--primary))",
        },
        horzLine: {
          color: "hsl(var(--primary) / 0.55)",
          labelBackgroundColor: "hsl(var(--primary))",
        },
      },
      rightPriceScale: {
        borderColor: "hsl(var(--border))",
        scaleMargins: {
          top: 0.12,
          bottom: 0.12,
        },
      },
      timeScale: {
        borderColor: "hsl(var(--border))",
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 6,
        barSpacing: 8,
        minBarSpacing: 2,
      },
      localization: {
        locale: "ru-RU",
        timeFormatter: (time: Time) => {
          const timestamp: number =
  typeof time === "number"
    ? time
    : typeof time === "string"
      ? Math.floor(new Date(time).getTime() / 1000)
      : "timestamp" in time && typeof time.timestamp === "number"
        ? time.timestamp
        : "year" in time && "month" in time && "day" in time
          ? Date.UTC(
              Number(time.year),
              Number(time.month) - 1,
              Number(time.day),
            ) / 1000
          : 0;
        },
        priceFormatter: (price: number) => formatNumber(price),
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderVisible: false,
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
      priceLineVisible: true,
      lastValueVisible: true,
    });

    series.setData(bars);

    const candleTimes = bars.map((bar) => bar.time);

    const markers = orderedExecutions
      .map((execution) => {
        const executionTime = toExecutionTime(execution.executedAt);
        const markerTime = candleTimeForExecution(executionTime, candleTimes);

        if (markerTime === null) return null;

        const side = execution.side.toLowerCase() === "buy" ? "buy" : "sell";
        const sideLabel = side === "buy" ? "BUY" : "SELL";

        return {
          time: markerTime,
          position: side === "buy" ? "belowBar" : "aboveBar",
          color: side === "buy" ? "#22c55e" : "#ef4444",
          shape: side === "buy" ? "arrowUp" : "arrowDown",
          text: `${sideLabel} ${formatNumber(execution.quantity)} @ ${formatNumber(execution.price)}`,
        } as const;
      })
      .filter((marker): marker is NonNullable<typeof marker> => marker !== null);

    createSeriesMarkers(series, markers);

    const stopLoss = asFiniteNumber(trade.stopLoss);
    if (stopLoss !== null && stopLoss > 0) {
      series.createPriceLine({
        price: stopLoss,
        color: "#ef4444",
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: "SL",
      });
    }

    const profitTarget = asFiniteNumber(trade.profitTarget);
    if (profitTarget !== null && profitTarget > 0) {
      series.createPriceLine({
        price: profitTarget,
        color: "#22c55e",
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: "TP",
      });
    }

    const onCrosshairMove = (param: MouseEventParams<Time>) => {
      const data = param.seriesData.get(series);

      if (!data || typeof data !== "object" || !("close" in data)) {
        setHoveredPrice(null);
        setHoveredTime(null);
        return;
      }

      setHoveredPrice(data.close);
      setHoveredTime(param.time ?? null);
    };

    chart.subscribeCrosshairMove(onCrosshairMove);
    chart.timeScale().fitContent();

    chartRef.current = chart;
    seriesRef.current = series;

    return () => {
      chart.unsubscribeCrosshairMove(onCrosshairMove);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [bars, orderedExecutions, trade.profitTarget, trade.stopLoss]);

  if (bars.length === 0) {
    return (
      <section className="rounded-xl border border-dashed bg-card p-5">
        <h3 className="font-semibold">Воспроизведение сделки</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Свечи ещё не загружены. Выберите источник рыночных данных и нажмите
          «Загрузить свечи и воспроизведение».
        </p>
      </section>
    );
  }

  const firstBar = bars[0];
  const lastBar = bars[bars.length - 1];

 const tooltipDate =
  hoveredTime === null
    ? null
    : typeof hoveredTime === "number"
      ? new Date(hoveredTime * 1000)
      : typeof hoveredTime === "string"
        ? new Date(hoveredTime)
        : "timestamp" in hoveredTime && typeof hoveredTime.timestamp === "number"
          ? new Date(hoveredTime.timestamp * 1000)
          : new Date(
              hoveredTime.year,
              hoveredTime.month - 1,
              hoveredTime.day,
            );

  return (
    <section className="space-y-4 rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">Воспроизведение сделки</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {symbol} · {resolution} · {bars.length} свечей
          </p>
        </div>

        <div className="grid grid-cols-2 gap-x-5 gap-y-1 rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
         <span>Диапазон</span>
<span className="text-right font-medium text-foreground">
  {firstBar && lastBar
    ? `${formatDateTime(firstBar.time * 1000)} — ${formatDateTime(lastBar.time * 1000)}`
    : "—"}
</span>

          <span>Цена под курсором</span>
          <span className="text-right font-medium text-foreground">
            {hoveredPrice === null ? "—" : formatNumber(hoveredPrice)}
          </span>

          <span>Время</span>
          <span className="text-right font-medium text-foreground">
            {tooltipDate
              ? new Intl.DateTimeFormat("ru-RU", {
                  dateStyle: "short",
                  timeStyle: "short",
                }).format(tooltipDate)
              : "—"}
          </span>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border bg-background">
        <div ref={hostRef} className="h-[540px] w-full" />
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <i className="h-2.5 w-2.5 rounded-full bg-profit" />
          BUY — вход / покупка
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="h-2.5 w-2.5 rounded-full bg-loss" />
          SELL — выход / продажа
        </span>
        {trade.stopLoss ? (
          <span className="inline-flex items-center gap-1.5">
            <i className="h-px w-3 border-t border-dashed border-loss" />
            Stop loss
          </span>
        ) : null}
        {trade.profitTarget ? (
          <span className="inline-flex items-center gap-1.5">
            <i className="h-px w-3 border-t border-dashed border-profit" />
            Profit target
          </span>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-lg border">
        <div className="grid grid-cols-[1.1fr_1fr_1fr_1fr] gap-3 border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
          <span>Время</span>
          <span>Сторона</span>
          <span>Количество</span>
          <span className="text-right">Цена</span>
        </div>

        {orderedExecutions.map((execution, index) => {
          const buy = execution.side.toLowerCase() === "buy";

          return (
            <div
              className="grid grid-cols-[1.1fr_1fr_1fr_1fr] gap-3 border-b px-3 py-2.5 text-sm last:border-b-0"
              key={
                execution.id ??
                execution.executionId ??
                `${execution.executedAt}-${index}`
              }
            >
              <time className="truncate text-xs text-muted-foreground">
                {formatDateTime(execution.executedAt)}
              </time>

              <span className={buy ? "font-medium text-profit" : "font-medium text-loss"}>
                {buy ? "▲ BUY" : "▼ SELL"}
              </span>

              <span>{formatNumber(execution.quantity)}</span>

              <span className="text-right font-medium">
                {formatNumber(execution.price)}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}