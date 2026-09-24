import type { AnalysisFilters } from "@luxalgo/journal-core";
const names: Record<string, string> = {
  accounts: "Счета",
  from: "С",
  to: "По",
  symbol: "Символы",
  excludeSymbol: "Исключить символы",
  tag: "Обязательные теги",
  mistake: "Обязательные ошибки",
  playbookId: "Стратегия",
  direction: "Направление",
  status: "Результат",
  assetClass: "Класс активов",
  reviewed: "Проверено",
  ratingMin: "Мин. рейтинг",
  ratingMax: "Макс. рейтинг",
  quantityMin: "Мин. количество",
  quantityMax: "Макс. количество",
  entryMin: "Мин. цена входа",
  entryMax: "Макс. цена входа",
  exitMin: "Мин. цена выхода",
  exitMax: "Макс. цена выхода",
  durationMin: "Мин. минут удержания",
  durationMax: "Макс. минут удержания",
  rMin: "Мин. реализованный R",
  rMax: "Макс. реализованный R",
  plannedRMin: "Мин. плановый R",
  plannedRMax: "Макс. плановый R",
  pnlMin: "Мин. P&L",
  pnlMax: "Макс. P&L",
  weekdays: "Дни недели входа",
  entryAfter: "Вход после",
  entryBefore: "Вход до",
  exitAfter: "Выход после",
  exitBefore: "Выход до",
};
export function describeFilters(
  filters: AnalysisFilters,
  accounts: { id: string; name: string }[] = [],
  playbooks: { id: string; name: string }[] = [],
  privateMode = false,
) {
  return (
    Object.entries(filters)
      .filter(([, v]) => v)
      .map(([k, v]) => {
        let value = v;
        if (k === "accounts")
          value = v
            .split(",")
            .map((id) => accounts.find((a) => a.id === id)?.name ?? "Выбранный счёт")
            .join(", ");
        if (k === "playbookId")
          value = playbooks.find((p) => p.id === v)?.name ?? "Выбранная стратегия";
        if (k === "weekdays")
          value = v
            .split(",")
            .map((d) => ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"][Number(d)] ?? d)
            .join(", ");
        if (privateMode && /^(entry|exit|pnl)(Min|Max)$/.test(k)) value = "••••";
        return `${names[k] ?? k}: ${value}`;
      })
      .join(" · ") || "Все сделки"
  );
}