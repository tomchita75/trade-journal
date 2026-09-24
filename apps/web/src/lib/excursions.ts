import { RESOLUTIONS, type ExcursionEstimate, type MarketHistory } from "./market-data";

interface Fill {
  side: "buy" | "sell";
  quantity: number;
  price: number;
  executedAt: string;
}
interface Trade {
  direction: string;
  openedAt: string;
  closedAt?: string | null;
  assetClass?: string | null;
  contractMultiplier?: number | null;
}

/** Gross position-equity excursions: realized cash flows + value of the remaining position.
 * Uses complete candles only while the position is constant; never invents an intrabar path.
 * Fees and FX conversion are excluded. Fill facts are not modified or persisted.
 */
export function estimateExcursions(
  trade: Trade,
  fills: Fill[],
  history: MarketHistory,
  basisConfirmed: boolean,
): ExcursionEstimate {
  const warnings: string[] = [];
  const empty = (reason: string): ExcursionEstimate => ({
    mae: null,
    mfe: null,
    sampledBars: 0,
    excludedBars: 0,
    warnings: [reason],
  });
  const candleDuration = RESOLUTIONS[history.resolution];
  // A coarse sanity check, not proof that currencies, contracts or adjustments match.
  // Reject a conspicuous mismatch even if the user checked the confirmation box.
  for (const fill of fills) {
    const time = Date.parse(fill.executedAt);
    let lo = 0,
      hi = history.bars.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (history.bars[mid]!.time <= time) lo = mid + 1;
      else hi = mid;
    }
    const candidate = history.bars[lo - 1];
    const bar = candidate && candidate.time + candleDuration > time ? candidate : undefined;
    if (!bar || !Number.isFinite(fill.price)) continue;
    const distance = Math.max(bar.low - fill.price, fill.price - bar.high, 0);
    if (distance > 0.2 * Math.max(Math.abs(bar.close), Math.abs(fill.price), 1e-9)) {
      return {
        ...empty(
          "Записанные филлы отличаются более чем на 20% от соответствующих рыночных свечей. Проверьте демо-сделки, другой инструмент, валюту котировки или базис корректировки цен. Оценки MAE/MFE и метки филлов недоступны, пока цены не согласованы.",
        ),
        priceBasisMismatch: true,
      };
    }
  }
  if (!basisConfirmed)
    return empty(
      "Подтвердите, что инструмент провайдера, базис цены и валюта котировки соответствуют вашим филлам и валюте счёта для расчёта оценок.",
    );
  if (!trade.closedAt) return empty("Оценки доступны только для закрытых сделок.");
  if (history.truncated)
    return empty("История обрезана. Загрузите более грубое разрешение для оценок.");
  const multiplier =
    trade.contractMultiplier ?? (["equity", "crypto"].includes(trade.assetClass ?? "") ? 1 : null);
  if (multiplier === null || !Number.isFinite(multiplier) || multiplier <= 0)
    return empty(
      "Укажите множитель контракта этого символа в настройках перед расчётом денежных оценок.",
    );
  const open = Date.parse(trade.openedAt),
    close = Date.parse(trade.closedAt);
  const step = RESOLUTIONS[history.resolution];
  const sorted = fills
    .map((fill) => ({ ...fill, time: Date.parse(fill.executedAt) }))
    .sort((a, b) => a.time - b.time);
  if (
    !Number.isFinite(open) ||
    !Number.isFinite(close) ||
    close <= open ||
    sorted.length < 2 ||
    sorted.some(
      (f) =>
        !Number.isFinite(f.time) ||
        !Number.isFinite(f.price) ||
        !Number.isFinite(f.quantity) ||
        f.quantity <= 0 ||
        f.time < open ||
        f.time > close,
    ) ||
    sorted[0]!.time !== open ||
    sorted.at(-1)!.time !== close
  )
    return empty("Временные метки исполнения или количества не описывают полный цикл позиции.");
  const bars = history.bars.filter((bar) => bar.time < close && bar.time + step > open);
  if (!bars.length || bars[0]!.time > open || bars.at(-1)!.time + step < close)
    return empty("История рынка не покрывает вход и выход. Оценки недоступны.");
  if (bars.some((bar, index) => index > 0 && bar.time - bars[index - 1]!.time > step))
    warnings.push(
      "История содержит пробелы, которые могут быть закрытыми сессиями или отсутствующими данными. Оценки используют только наблюдаемые свечи.",
    );
  let position = 0,
    cash = 0,
    minimum = 0,
    maximum = 0,
    index = 0,
    sampledBars = 0,
    excludedBars = 0;
  const direction = trade.direction === "long" ? 1 : -1;
  const epsilon = sorted.reduce((largest, fill) => Math.max(largest, fill.quantity), 1) * 1e-8;
  const mark = (price: number) => {
    const value = (cash + position * price) * multiplier;
    minimum = Math.min(minimum, value);
    maximum = Math.max(maximum, value);
  };
  const apply = (fill: (typeof sorted)[number]) => {
    mark(fill.price);
    const quantity = fill.side === "buy" ? fill.quantity : -fill.quantity;
    cash -= quantity * fill.price;
    position += quantity;
    mark(fill.price);
    return position * direction >= -epsilon;
  };
  for (const bar of bars) {
    while (index < sorted.length && sorted[index]!.time <= bar.time) {
      if (!apply(sorted[index++]!))
        return empty(
          "Разворачивающееся исполнение охватывает несколько сделок. Оценки экскурсии недоступны для этого цикла.",
        );
    }
    const nextFill = sorted[index]?.time ?? Infinity;
    if (
      bar.time < open ||
      bar.time + step > close ||
      nextFill < bar.time + step ||
      Math.abs(position) <= epsilon
    ) {
      excludedBars++;
      continue;
    }
    mark(bar.high);
    mark(bar.low);
    sampledBars++;
  }
  while (index < sorted.length)
    if (!apply(sorted[index++]!))
      return empty(
        "Разворачивающееся исполнение охватывает несколько сделок. Оценки экскурсии недоступны для этого цикла.",
      );
  if (Math.abs(position) > epsilon)
    return empty(
      "Записанные филлы не возвращают эту позицию в ноль. Оценки недоступны.",
    );
  if (!sampledBars)
    return empty(
      "Ни одна полная свеча не попадает между филлами. Выберите более мелкое разрешение; только цен филлов недостаточно для оценки экскурсий.",
    );
  if (excludedBars)
    warnings.push(
      `${excludedBars} свечей пересекают границу филла или сделки и были исключены; экскурсии могут быть занижены.`,
    );
  warnings.push(
    "Оценочный валовый P&L позиции, включая реализованные частичные выходы и оставшуюся экспозицию. Комиссии и конвертация валюты исключены; порядок максимумов и минимумов внутри свечи неизвестен.",
  );
  if (![minimum, maximum].every(Number.isFinite))
    return empty("Значения позиции превышают поддерживаемый числовой диапазон.");
  return { mae: Math.abs(minimum), mfe: maximum, sampledBars, excludedBars, warnings };
}