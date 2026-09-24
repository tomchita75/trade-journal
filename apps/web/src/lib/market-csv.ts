import { headerKey, parseCsv } from "@luxalgo/journal-importers";
import { RESOLUTIONS, type Resolution, type MarketBar } from "./market-data";
export const MAX_CSV_BYTES = 5 * 1024 * 1024;
export const MAX_CSV_BARS = 50_000;
export function parseMarketCsv(
  content: string,
  symbol: string,
  resolution: Resolution,
): MarketBar[] {
  if (new TextEncoder().encode(content).byteLength > MAX_CSV_BYTES)
    throw new Error("Используйте CSV меньше 5 МБ.");
  if ((content.match(/"/g)?.length ?? 0) % 2 !== 0)
    throw new Error("CSV содержит незавершённое поле в кавычках.");
  const [header, ...rows] = parseCsv(content);
  if (!header || !rows.length || rows.length > MAX_CSV_BARS)
    throw new Error("CSV должен содержать 1–50 000 строк свечей.");
  const aliases: Record<string, string[]> = {
    time: ["time", "timestamp", "datetime", "date"],
    open: ["open", "o"],
    high: ["high", "h"],
    low: ["low", "l"],
    close: ["close", "c"],
    volume: ["volume", "v"],
    symbol: ["symbol", "ticker"],
  };
  const columns: Record<string, number> = {};
  for (const [name, keys] of Object.entries(aliases)) {
    const matches = header
      .map((cell, index) => (keys.includes(headerKey(cell)) ? index : -1))
      .filter((index) => index >= 0);
    if (matches.length > 1) throw new Error(`Неоднозначные столбцы ${name}. Укажите только один.`);
    if (!matches.length && !["symbol", "volume"].includes(name))
      throw new Error(`Отсутствует столбец ${name}.`);
    columns[name] = matches[0] ?? -1;
  }
  const bars = rows
    .map((row, index): MarketBar => {
      const fail = (message: string): never => {
        throw new Error(`Row ${index + 2}: ${message}`);
      };
      if (row.length !== header.length) fail("количество столбцов не совпадает с заголовком.");
      if (columns.symbol! >= 0 && row[columns.symbol!]!.trim() !== symbol)
        fail("символ не соответствует этому набору данных.");
      const rawTime = row[columns.time!]!.trim();
      if (/^\d{4}-\d{2}-\d{2}T/.test(rawTime)) {
        const [year, month, day] = rawTime.slice(0, 10).split("-").map(Number);
        if (!month || month > 12 || !day || day > new Date(Date.UTC(year!, month!, 0)).getUTCDate())
          fail("неверная календарная дата.");
      }
      const time = /^\d{10}$/.test(rawTime)
        ? Number(rawTime) * 1000
        : /^\d{13}$/.test(rawTime)
          ? Number(rawTime)
          : /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/i.test(
                rawTime,
              )
            ? Date.parse(rawTime)
            : NaN;
      if (!Number.isSafeInteger(time) || time < 0)
        fail(
          "используйте ISO-8601 с часовым поясом или Unix-секунды (10 цифр) / миллисекунды (13 цифр).",
        );
      const numeric = (name: string) => {
        if (name === "volume" && columns.volume === -1) return 0;
        const value = row[columns[name]!]!.trim();
        if (
          !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value) ||
          !Number.isFinite(Number(value))
        )
          fail(`неверный ${name}.`);
        return Number(value);
      };
      const bar = {
        time,
        open: numeric("open"),
        high: numeric("high"),
        low: numeric("low"),
        close: numeric("close"),
        volume: numeric("volume"),
      };
      if (
        bar.low > Math.min(bar.open, bar.close) ||
        bar.high < Math.max(bar.open, bar.close) ||
        bar.low > bar.high ||
        bar.volume < 0
      )
        fail("неверный диапазон OHLC или отрицательный объём.");
      if (bar.time + RESOLUTIONS[resolution] > Date.now())
        fail("импортировать можно только завершённые исторические свечи.");
      return bar;
    })
    .sort((a, b) => a.time - b.time);
  const step = RESOLUTIONS[resolution];
  const phase = resolution === "1d" ? 0 : bars[0]!.time % step;
  bars.forEach((bar, index) => {
    if (bar.time % step !== phase)
      throw new Error(
        "Временные метки свечей не выровнены по выбранному разрешению. Дневные свечи должны начинаться в 00:00 UTC.",
      );
    if (index && bar.time === bars[index - 1]!.time)
      throw new Error("Дублирующиеся временные метки свечей. Удалите дубликаты перед импортом.");
  });
  return bars;
}
export interface MarketCsvDataset {
  id: string;
  name: string;
  symbol: string;
  resolution: Resolution;
  currency: string;
  priceBasis: string;
  count: number;
  from: string;
  to: string;
  importedAt: string;
}