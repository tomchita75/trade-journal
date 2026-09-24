"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
} from "recharts";
import { Card, CardContent } from "./ui/card";
import { useVizTokens, tooltipStyle } from "./charts/tokens";
import { cashSummary, currencyDigits, propMoney } from "@/lib/prop-firms";

type Summary = ReturnType<typeof cashSummary>;
export function PropCashSummary({
  summary,
  currency,
  privacy,
}: {
  summary: Summary;
  currency: string;
  privacy: boolean;
}) {
  const money = (value: number) => (privacy ? "••••" : currency ? propMoney(value, currency) : "—");
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <Card>
        <CardContent className="p-5 sm:p-6">
          <p className="flex items-center gap-2 text-sm font-medium">
            <span className="h-2 w-2 rounded-full bg-[var(--loss)]" />
            Потрачено
          </p>
          <p className="mt-3 break-words text-3xl font-semibold tracking-tight tabular-nums">
            {money(summary.spent)}
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            Все комиссии, подписки и другие расходы
          </p>
          <div className="mt-4 flex flex-wrap justify-between gap-2 border-t pt-3 text-xs">
            <span className="text-muted-foreground">
              Возвращено <span className="text-foreground">{money(summary.refunds)}</span>
            </span>
            <span className="text-muted-foreground">
              Чистые расходы <span className="text-foreground">{money(summary.netSpend)}</span>
            </span>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-5 sm:p-6">
          <p className="flex items-center gap-2 text-sm font-medium">
            <span className="h-2 w-2 rounded-full bg-[var(--brand)]" />
            Полученные выплаты
          </p>
          <p className="mt-3 break-words text-3xl font-semibold tracking-tight tabular-nums">
            {money(summary.received)}
          </p>
          <p className="mt-3 text-xs text-muted-foreground">Полученные деньги, после любых отмен</p>
          <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">
            Ожидающие запросы отслеживаются отдельно ниже.
          </p>
        </CardContent>
      </Card>
      <Card className="bg-muted/30">
        <CardContent className="p-5 sm:p-6">
          <p className="text-sm font-medium">Итого после расходов</p>
          <p
            className="mt-3 break-words text-3xl font-semibold tracking-tight tabular-nums"
            style={{
              color:
                privacy || !currency
                  ? undefined
                  : summary.net < 0
                    ? "var(--loss)"
                    : summary.net > 0
                      ? "var(--profit)"
                      : undefined,
            }}
          >
            {money(summary.net)}
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            Выплаты + возвраты − потрачено
          </p>
          <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">
            Доходность от чистых расходов{" "}
            <span className="text-foreground">
              {privacy
                ? "••••"
                : !currency || summary.roi === null
                  ? "—"
                  : `${(summary.roi * 100).toFixed(1)}%`}
            </span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
export function PropCashComparison({
  months,
  currency,
  privacy,
}: {
  months: (Summary & { month: string })[];
  currency: string;
  privacy: boolean;
}) {
  const t = useVizTokens();
  const divisor = currency ? 10 ** currencyDigits(currency) : 1;
  const rows = [...months]
    .reverse()
    .map((row) => ({ ...row, spent: row.spent / divisor, received: row.received / divisor }));
  return (
    <Card>
      <CardContent className="p-5 sm:p-6">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold">Расходы vs выплаты</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Ежемесячный денежный поток{currency ? ` · ${currency}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-sm bg-[var(--loss)]" />
              Потрачено
            </span>
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-sm bg-[var(--brand)]" />
              Полученные выплаты
            </span>
          </div>
        </div>
        {privacy || !currency || !rows.length ? (
          <p className="flex min-h-48 items-center justify-center text-center text-sm text-muted-foreground">
            {privacy
              ? "График скрыт в режиме приватности."
              : !currency
                ? "Выберите валюту в фильтрах для сравнения расходов и выплат."
                : "Запишите расход или получение выплаты, чтобы начать сравнение."}
          </p>
        ) : (
          <div className="h-64 min-w-0 sm:h-72">
            {t && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  accessibilityLayer
                  data={rows}
                  margin={{ top: 8, right: 0, left: 0, bottom: 0 }}
                  barGap={2}
                >
                  <CartesianGrid vertical={false} stroke={t.gridline} />
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    minTickGap={28}
                    tick={{ fill: t.inkMuted, fontSize: 11 }}
                    tickFormatter={(v) =>
                      new Intl.DateTimeFormat("en", {
                        month: "short",
                        year: "2-digit",
                        timeZone: "UTC",
                      }).format(new Date(`${v}-01T12:00:00Z`))
                    }
                  />
                  <YAxis
                    width={65}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: t.inkMuted, fontSize: 11 }}
                    tickFormatter={(v) =>
                      new Intl.NumberFormat("en", {
                        notation: "compact",
                        maximumFractionDigits: 1,
                      }).format(v)
                    }
                  />
                  <ReferenceLine y={0} stroke={t.baseline} />
                  <Tooltip
                    cursor={{ fill: t.gridline, opacity: 0.35 }}
                    content={({ active, payload, label }) =>
                      active && payload?.length ? (
                        <div style={tooltipStyle(t)}>
                          <p className="mb-1 font-medium">{String(label)}</p>
                          {payload.map((item) => (
                            <p key={String(item.dataKey)}>
                              {item.name}:{" "}
                              {propMoney(Math.round(Number(item.value) * divisor), currency)}
                            </p>
                          ))}
                          <p>Возвраты: {propMoney(payload[0]!.payload.refunds, currency)}</p>
                          <p className="mt-1 border-t pt-1">
                            Итого после расходов: {propMoney(payload[0]!.payload.net, currency)}
                          </p>
                        </div>
                      ) : null
                    }
                  />
                  <Bar
                    name="Потрачено"
                    dataKey="spent"
                    fill={t.loss}
                    radius={[3, 3, 0, 0]}
                    maxBarSize={24}
                    isAnimationActive={false}
                  />
                  <Bar
                    name="Полученные выплаты"
                    dataKey="received"
                    fill={t.brand}
                    radius={[3, 3, 0, 0]}
                    maxBarSize={24}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        )}
        <p className="mt-4 text-xs text-muted-foreground">
          Возвраты уменьшают чистые расходы. Наведите на месяц, чтобы увидеть возвраты и итоговую сумму.
        </p>
      </CardContent>
    </Card>
  );
}