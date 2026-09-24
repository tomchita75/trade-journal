"use client";

import type { ImportReview, ImportReviewOptions } from "@/lib/import-review";
import { Button } from "@/components/ui/button";
import { fmtMoney } from "@/lib/utils";

export function ImportReconciliation({
  review,
  options,
  onChange,
  onReview,
  busy,
}: {
  review?: ImportReview;
  options: ImportReviewOptions;
  onChange: (next: ImportReviewOptions) => void;
  onReview: () => void;
  busy: boolean;
}) {
  return (
    <div className="space-y-3 border-t pt-3">
      <p className="text-sm font-medium">Проверка импорта NinjaTrader</p>
      <p className="text-xs text-muted-foreground">
        Держите каждый исходный аккаунт отдельно внутри выбранного аккаунта журнала. Проверьте
        результат перед сохранением.
      </p>
      {review && (
        <>
          {review.sources.map((source) => (
            <label key={source.key} className="block space-y-1 text-sm">
              <span>{source.label}</span>
              <select
                aria-label={`Сопоставление источника для ${source.label}`}
                disabled={busy || source.saved}
                className="block w-full rounded-md border bg-background p-2 text-sm"
                value={options.sourceMappings?.[source.key] ?? source.selected ?? ""}
                onChange={(event) =>
                  onChange({
                    ...options,
                    sourceMappings: { ...options.sourceMappings, [source.key]: event.target.value },
                  })
                }
              >
                <option value="">Выберите источник, к которому относится этот файл</option>
                {review.savedSources.map((saved) => (
                  <option key={saved.id} value={saved.id}>
                    {saved.name}
                  </option>
                ))}
                <option value="new">Создать отдельный исходный аккаунт</option>
              </select>
            </label>
          ))}
          <p className="text-xs text-muted-foreground">
            Если аккаунт или подключение было переименовано, выберите его существующий источник.
            Выбирайте новый источник только для действительно другого аккаунта.
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm" role="status">
            <span>{review.inserted} новых исполнений</span>
            <span>{review.duplicates} дубликатов исполнений</span>
            <span>{review.corrections.length} корректировок комиссий</span>
          </div>
          {review.multipliers.map((item) => (
            <p key={item.symbol} className="text-xs">
              {item.symbol} множитель: {item.value ?? "отсутствует — настройте в Настройках"}
            </p>
          ))}
          {review.multipliers.some((item) => item.value === null) && (
            <a className="text-sm underline" href="/settings" target="_blank" rel="noreferrer">
              Откройте Настройки, затем проверьте снова
            </a>
          )}
          {review.totals && (
            <div className="rounded-md bg-muted/40 p-3 text-sm">
              <p className="font-medium">Аккаунт назначения после импорта ({review.currency})</p>
              <p>
                {review.totals.closedTrades} закрытых сделок · {review.totals.openTrades} открытых
                сделок
              </p>
              <p>
                Чистый P&amp;L закрытых сделок: {fmtMoney(review.totals.netPnl, review.currency)} ·
                Комиссии: {fmtMoney(review.totals.fees, review.currency)}
              </p>
            </div>
          )}
          {review.needsCompleteHistory && (
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!options.completeHistory}
                disabled={busy}
                onChange={(event) =>
                  onChange({ ...options, completeHistory: event.target.checked })
                }
              />
              <span>
                Этот экспорт включает все исполнения для каждого указанного исходного контракта
                между его первым и последним временным штампом. Это не частичный выбор
                повторяющихся исполнений.
              </span>
            </label>
          )}
          {!!review.corrections.length && (
            <div className="space-y-2">
              {review.corrections.slice(0, 10).map((correction, index) => (
                <p key={index} className="text-xs">
                  {correction.symbol} · {correction.executedAt}: комиссия{" "}
                  {fmtMoney(correction.oldFee, review.currency)} →{" "}
                  {fmtMoney(correction.newFee, review.currency)}
                </p>
              ))}
              {review.corrections.length > 10 && (
                <p className="text-xs">
                  И ещё {review.corrections.length - 10} корректировок комиссий.
                </p>
              )}
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!options.approveFeeCorrections}
                  disabled={busy}
                  onChange={(event) =>
                    onChange({ ...options, approveFeeCorrections: event.target.checked })
                  }
                />
                <span>
                  Применить эти корректировки комиссий к существующим исполнениям и пересчитать
                  P&amp;L.
                </span>
              </label>
            </div>
          )}
          {review.warnings.map((message) => (
            <p key={message} className="text-xs text-muted-foreground">
              {message}
            </p>
          ))}
          {review.conflicts.map((message) => (
            <p key={message} role="alert" className="text-xs text-loss">
              {message}
            </p>
          ))}
        </>
      )}
      <Button variant="outline" disabled={busy} onClick={onReview}>
        {busy ? "Проверка…" : "Проверить импорт"}
      </Button>
      {review?.token && (
        <p className="text-xs text-muted-foreground">
          Проверка завершена. Импорт сохранит этот результат; если файл, настройки или журнал
          изменятся, потребуется другая проверка.
        </p>
      )}
    </div>
  );
}