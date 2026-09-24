"use client";
import { OptionSelect } from "@/components/ui/option-select";
import { Checkbox } from "@/components/ui/checkbox";

import type { AnalysisFilters, FilterKey } from "@luxalgo/journal-core";
import { useApi } from "@/lib/use-api";
import { MonetaryField } from "./privacy";
import { ChevronDown, CircleHelp } from "lucide-react";
import { HoverHint } from "./ui/tooltip";
import { DatePicker } from "./ui/date-picker";
const FIELD_HINTS: Record<string, string> = {
  From: "Первая включаемая дата. Закрытые сделки используют день закрытия; открытые сделки — день открытия.",
  To: "Последняя включаемая дата. Даты следуют часовому поясу журнала.",
  Strategy: "Включить сделки, назначенные на этот плейбук. «Все» включает сделки без плейбука.",
  "Symbols (comma-separated)":
    "Включить эти тикеры. Разделяйте несколько тикеров запятыми, например AAPL, NVDA.",
  "Exclude symbols": "Скрыть эти тикеры из результатов. Разделяйте несколько тикеров запятыми.",
  "Required tags (comma-separated)":
    "Фильтр по тегам, записанным в ваших сделках. Разделяйте несколько тегов запятыми.",
  "Required mistakes":
    "Фильтр по записанным торговым ошибкам. Разделяйте несколько ошибок запятыми.",
  "Review status": "Найти сделки, которые вы отметили как просмотренные, или те, которые ещё ожидают просмотра.",
  "Realized R": "Прибыль или убыток сделки, выраженные как множитель первоначального риска сделки.",
  "Planned R": "Планируемая награда относительно первоначального риска сделки.",
  "Minutes held": "Время между открытием и закрытием сделки, измеренное в минутах.",
};
export const fieldClass = "h-9 w-full min-w-0 rounded-md border bg-background px-2 text-sm";
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="journal-filter-field grid min-w-0 gap-1 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        {label}
        {FIELD_HINTS[label.split(" · ")[0]!] && (
          <HoverHint heading={label} content={FIELD_HINTS[label.split(" · ")[0]!]}>
            <span
              tabIndex={0}
              aria-label={`О ${label}`}
              className="inline-flex cursor-help rounded-sm text-muted-foreground/70 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <CircleHelp aria-hidden="true" className="h-3 w-3" />
            </span>
          </HoverHint>
        )}
      </span>
      {children}
    </label>
  );
}
export function FilterFields({
  value,
  onChange,
}: {
  value: AnalysisFilters;
  onChange: (v: AnalysisFilters) => void;
}) {
  const { data: accounts } = useApi<{
    accounts: { id: string; name: string; archivedAt: string | null }[];
  }>("/api/accounts");
  const { data: playbooks } = useApi<{ playbooks: { id: string; name: string }[] }>(
    "/api/playbooks",
  );
  const set = (key: FilterKey, v: string) => onChange({ ...value, [key]: v });
  const input = (key: FilterKey, label: string, type = "text") => (
    <Field key={key} label={label}>
      <MonetaryField sensitive={/^(entry|exit|pnl)(Min|Max)$/.test(key)}>
        {type === "date" ? (
          <DatePicker
            value={value[key] ?? ""}
            onValueChange={(next) => set(key, next)}
            label={label}
          />
        ) : (
          <input
            className={fieldClass}
            aria-label={label}
            type={type}
            step={type === "number" ? "any" : undefined}
            value={value[key] ?? ""}
            onChange={(e) => set(key, e.target.value)}
          />
        )}
      </MonetaryField>
    </Field>
  );
  const select = (key: FilterKey, label: string, choices: [string, string][]) => (
    <Field key={key} label={label}>
      <span className="journal-filter-select relative block min-w-0">
        <OptionSelect
          className={fieldClass}
          value={value[key] ?? ""}
          onValueChange={(next) => set(key, next)}
        >
          <option value="">Все</option>
          {choices.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </OptionSelect>
      </span>
    </Field>
  );
  return (
    <div className="journal-filter-fields space-y-5">
      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 md:grid-cols-3">
        {input("from", "С ·", "date")}
        {input("to", "По ·", "date")}
        {select(
          "playbookId",
          "Стратегия",
          (playbooks?.playbooks ?? []).map((p) => [p.id, p.name]),
        )}
        {input("symbol", "Тикеры (через запятую)")}
        {input("excludeSymbol", "Исключить тикеры")}
        {input("tag", "Требуемые теги (через запятую)")}
        {input("mistake", "Требуемые ошибки")}
        {select("direction", "Направление", [
          ["long", "Лонг"],
          ["short", "Шорт"],
        ])}
        {select("status", "Результат", [
          ["closed", "Все закрытые"],
          ["open", "Открытые"],
          ["win", "Прибыль"],
          ["loss", "Убыток"],
          ["breakeven", "Безубыток"],
        ])}
        {select("reviewed", "Статус просмотра", [
          ["yes", "Просмотрено"],
          ["no", "Не просмотрено"],
        ])}
        {select(
          "assetClass",
          "Класс активов",
          ["equity", "futures", "forex", "option", "crypto", "cfd", "other"].map((v) => [v, v]),
        )}
      </div>
      <fieldset className="journal-filter-accounts rounded-lg border p-3">
        <legend className="px-1 text-xs text-muted-foreground">
          Аккаунты · ничего не выбрано = все
        </legend>
        <div className="flex flex-wrap gap-3">
          {accounts?.accounts
            .filter((a) => !a.archivedAt)
            .map((a) => (
              <label key={a.id} className="journal-filter-choice flex items-center gap-2 text-xs">
                <Checkbox
                  checked={(value.accounts ?? "").split(",").includes(a.id)}
                  onCheckedChange={(checked) => {
                    const ids = new Set((value.accounts ?? "").split(",").filter(Boolean));
                    if (checked === true) ids.add(a.id);
                    else ids.delete(a.id);
                    set("accounts", [...ids].join(","));
                  }}
                />
                {a.name}
              </label>
            ))}
        </div>
      </fieldset>
      <details className="journal-filter-advanced">
        <summary className="flex cursor-pointer items-center justify-between gap-3 text-sm">
          <span>Размер, цена, риск и время</span>
          <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
        </summary>
        <div className="journal-filter-advanced-grid mt-3 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 md:grid-cols-4">
          {(
            [
              ["quantity", "Общее количество на входе"],
              ["entry", "Цена входа"],
              ["exit", "Цена выхода"],
              ["duration", "Длительность (мин)"],
              ["r", "Realized R"],
              ["plannedR", "Planned R"],
              ["pnl", "Чистый P&L"],
              ["rating", "Рейтинг"],
            ] as const
          ).flatMap(([k, l]) => [
            input(`${k}Min` as FilterKey, `${l} · мин`, "number"),
            input(`${k}Max` as FilterKey, `${l} · макс`, "number"),
          ])}
          {input("entryAfter", "Вход после", "time")}
          {input("entryBefore", "Вход до", "time")}
          {input("exitAfter", "Выход после", "time")}
          {input("exitBefore", "Выход до", "time")}
        </div>
        <div className="journal-filter-weekdays mt-3 flex flex-wrap gap-2">
          {["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"].map((day, i) => (
            <label key={day} className="journal-filter-choice flex items-center gap-2 text-xs">
              <Checkbox
                checked={(value.weekdays ?? "").split(",").includes(String(i))}
                onCheckedChange={(checked) => {
                  const days = new Set((value.weekdays ?? "").split(",").filter(Boolean));
                  if (checked === true) days.add(String(i));
                  else days.delete(String(i));
                  set("weekdays", [...days].join(","));
                }}
              />
              {day}
            </label>
          ))}
        </div>
      </details>
    </div>
  );
}