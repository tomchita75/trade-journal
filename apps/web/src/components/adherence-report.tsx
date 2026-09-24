"use client";
import { useApi } from "@/lib/use-api";
import { useFilters } from "@/components/filter-bar";
import { MonetaryValue } from "./privacy";
import type { GroupSummary } from "@luxalgo/journal-core";
interface Adherence {
  id: string;
  total: number;
  evaluated: number;
  possible: number;
  rate: number | null;
  currencies: string[];
  followed: GroupSummary;
  broken: GroupSummary;
  unassessed: number;
  rules: {
    rule: string;
    evaluated: number;
    rate: number | null;
    followed: GroupSummary;
    broken: GroupSummary;
  }[];
}
const pct = (n: number | null) => (n === null ? "-" : `${Math.round(n * 100)}%`);
export function AdherenceReport({ bookId }: { bookId: string }) {
  const { query } = useFilters();
  const { data, error } = useApi<{ books: Adherence[] }>(`/api/adherence?${query}`);
  const b = data?.books.find((b) => b.id === bookId);
  if (error)
    return (
      <p role="alert" className="text-xs text-destructive">
        {error}
      </p>
    );
  if (!b) return null;
  return (
    <div className="space-y-3 border-t pt-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Соблюдение правил</span>
        <strong className="text-lg">{pct(b.rate)}</strong>
      </div>
      <p className="text-xs text-muted-foreground">
        {b.evaluated}/{b.possible} оценок правил по {b.total} закрытым сделкам.{" "}
        {b.unassessed} сделок ещё требуют оценки.
      </p>
      <div className="grid grid-cols-2 gap-3 text-xs">
        {[
          ["Все правила соблюдены", b.followed],
          ["Хотя бы одно нарушено", b.broken],
        ].map(([title, stats]) => {
          const s = stats as GroupSummary;
          return (
            <div key={String(title)} className="rounded-md bg-muted/40 p-2">
              <p className="mb-1 font-medium">{String(title)}</p>
              <p>
                {s.trades} сделок · {pct(s.winRate)} побед
              </p>
              {b.currencies.length <= 1 && (
                <p className={s.netPnl >= 0 ? "text-profit" : "text-loss"}>
                  <MonetaryValue>
                    {s.netPnl.toLocaleString(undefined, { maximumFractionDigits: 2 })}{" "}
                    {b.currencies[0] ?? ""}
                  </MonetaryValue>
                </p>
              )}
            </div>
          );
        })}
      </div>
      {b.currencies.length > 1 && (
        <p className="text-xs text-muted-foreground">P&L скрыт для смешанных валют.</p>
      )}
      <details className="text-xs">
        <summary className="cursor-pointer text-muted-foreground">Эффективность по правилам</summary>
        <div className="mt-2 space-y-3">
          {b.rules.map((r) => (
            <div key={r.rule} className="border-t pt-2">
              <p className="font-medium">{r.rule}</p>
              <p className="text-muted-foreground">
                {pct(r.rate)} соблюдено · {r.evaluated} оценок
              </p>
              <p>
                Соблюдено: {r.followed.trades} сделок / {pct(r.followed.winRate)} побед · Нарушено:{" "}
                {r.broken.trades} / {pct(r.broken.winRate)} побед
              </p>
              {b.currencies.length <= 1 && (
                <p>
                  Чистый P&L: <MonetaryValue>{r.followed.netPnl.toFixed(2)}</MonetaryValue> соблюдено /{" "}
                  <MonetaryValue>{r.broken.netPnl.toFixed(2)}</MonetaryValue> нарушено{" "}
                  {b.currencies[0] ?? ""}
                </p>
              )}
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}